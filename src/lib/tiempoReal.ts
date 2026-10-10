import { useEffect, useRef, useSyncExternalStore } from 'react'
import { sesion } from './sesion'

/**
 * Cliente WebSocket del Realtime Gateway (repo Realtime-Gateway, RealtimeHandler.java).
 *
 * Protocolo:
 *   cliente → {"type":"subscribe","topic":"itinerario:{id}:asientos"} | unsubscribe | pong
 *   servidor → connected | subscribed | snapshot | event | unsubscribed | ping | error
 * Tópicos: itinerario:{id}:asientos · oferta:{id}:cupo · viaje:{id}:eventos · bus:{id}:posicion
 *
 * Reglas del documento de arquitectura:
 *  - Heartbeat: el servidor manda ping cada 20 s y cierra a los 45 s sin pong.
 *  - Reconexión con backoff exponencial: base 1 s, tope 30 s, con jitter.
 *  - Al (re)suscribirse el gateway envía un snapshot completo del tópico.
 *  - El canal exige JWT: sin sesión no se conecta (la app sigue funcionando por REST).
 */

export type EstadoConexion = 'sin-sesion' | 'conectando' | 'en-vivo' | 'reconectando'

export type MensajeTopico =
  | { type: 'snapshot'; topic: string; data: unknown; error?: string }
  | { type: 'event'; topic: string; event: string; eventId: string; occurredAt: string; data: unknown }

type MensajeServidor =
  | MensajeTopico
  | { type: 'connected'; userId: string; role: string; heartbeatSeconds: number; tokenExpiresAt?: string }
  | { type: 'subscribed' | 'unsubscribed'; topic: string }
  | { type: 'ping' | 'pong' }
  | { type: 'error'; code: string; message: string }

type Manejador = (mensaje: MensajeTopico) => void

export const topicos = {
  asientos: (itineraryId: string) => `itinerario:${itineraryId}:asientos`,
  cupoOferta: (offerId: string) => `oferta:${offerId}:cupo`,
  novedades: (itineraryId: string) => `viaje:${itineraryId}:eventos`,
  posicionBus: (busId: string) => `bus:${busId}:posicion`,
}

function urlBase(): string {
  const configurada = import.meta.env.VITE_WS_URL as string | undefined
  if (configurada) return configurada
  const proto = globalThis.location?.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${globalThis.location?.host}/ws`
}

/** Espera antes del intento n (0, 1, 2…): base 1 s, tope 30 s, "full jitter". */
export function esperaReconexion(intento: number, aleatorio: () => number = Math.random): number {
  const tope = Math.min(30_000, 1_000 * 2 ** intento)
  return Math.round(500 + aleatorio() * (tope - 500))
}

class ConexionTiempoReal {
  private ws: WebSocket | null = null
  private manejadores = new Map<string, Set<Manejador>>()
  private estado: EstadoConexion = 'sin-sesion'
  private oyentesEstado = new Set<() => void>()
  private intento = 0
  private temporizador: ReturnType<typeof setTimeout> | null = null
  private vigia: ReturnType<typeof setTimeout> | null = null
  private tokenUsado: string | null = null

  constructor() {
    // Login/logout: reconecta con el token nuevo o cierra.
    sesion.suscribir(() => {
      if (sesion.token() !== this.tokenUsado) this.reiniciar()
    })
  }

  obtenerEstado = () => this.estado

  suscribirEstado = (oyente: () => void) => {
    this.oyentesEstado.add(oyente)
    return () => this.oyentesEstado.delete(oyente)
  }

  suscribir(topico: string, manejador: Manejador): () => void {
    let set = this.manejadores.get(topico)
    if (!set) {
      set = new Set()
      this.manejadores.set(topico, set)
      this.enviar({ type: 'subscribe', topic: topico })
    }
    set.add(manejador)
    this.asegurarConexion()

    return () => {
      const actual = this.manejadores.get(topico)
      if (!actual) return
      actual.delete(manejador)
      if (actual.size === 0) {
        this.manejadores.delete(topico)
        this.enviar({ type: 'unsubscribe', topic: topico })
        if (this.manejadores.size === 0) this.cerrar('sin-sesion')
      }
    }
  }

  private cambiarEstado(e: EstadoConexion) {
    if (this.estado === e) return
    this.estado = e
    this.oyentesEstado.forEach((o) => o())
  }

  private asegurarConexion() {
    if (this.ws || this.temporizador || this.manejadores.size === 0) return
    const token = sesion.token()
    if (!token) {
      this.cambiarEstado('sin-sesion')
      return
    }
    this.tokenUsado = token
    this.cambiarEstado(this.intento === 0 ? 'conectando' : 'reconectando')

    const ws = new WebSocket(`${urlBase()}?token=${encodeURIComponent(token)}`)
    this.ws = ws

    ws.onopen = () => {
      this.manejadores.forEach((_, topico) => this.enviar({ type: 'subscribe', topic: topico }))
      this.vigilar()
    }
    ws.onmessage = (m) => {
      this.vigilar()
      let msg: MensajeServidor
      try {
        msg = JSON.parse(String(m.data)) as MensajeServidor
      } catch {
        return
      }
      switch (msg.type) {
        case 'ping':
          this.enviar({ type: 'pong' })
          return
        case 'connected':
          this.intento = 0
          this.cambiarEstado('en-vivo')
          return
        case 'snapshot':
        case 'event':
          this.manejadores.get(msg.topic)?.forEach((h) => h(msg))
          return
        case 'error':
          if (import.meta.env.DEV) console.warn('[tiempo real]', msg.code, msg.message)
          return
        default:
          return
      }
    }
    ws.onclose = () => {
      if (this.ws !== ws) return
      this.ws = null
      this.limpiarVigia()
      if (this.manejadores.size > 0 && sesion.token()) this.programarReconexion()
      else this.cambiarEstado('sin-sesion')
    }
    ws.onerror = () => ws.close()
  }

  private programarReconexion() {
    this.cambiarEstado('reconectando')
    const espera = esperaReconexion(this.intento++)
    this.temporizador = setTimeout(() => {
      this.temporizador = null
      this.asegurarConexion()
    }, espera)
  }

  /** Si en 50 s no llega nada (ni el ping de 20 s), la conexión está muerta aunque no lo diga. */
  private vigilar() {
    this.limpiarVigia()
    this.vigia = setTimeout(() => this.ws?.close(), 50_000)
  }

  private limpiarVigia() {
    if (this.vigia) clearTimeout(this.vigia)
    this.vigia = null
  }

  private enviar(mensaje: object) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(mensaje))
  }

  private cerrar(estado: EstadoConexion) {
    if (this.temporizador) clearTimeout(this.temporizador)
    this.temporizador = null
    this.limpiarVigia()
    const ws = this.ws
    this.ws = null
    ws?.close()
    this.intento = 0
    this.cambiarEstado(estado)
  }

  private reiniciar() {
    this.cerrar('sin-sesion')
    this.asegurarConexion()
  }
}

export const tiempoReal = new ConexionTiempoReal()

/** Estado del canal en vivo, para mostrar "En vivo" o "Sin conexión en vivo" (US-094). */
export function useEstadoTiempoReal(): EstadoConexion {
  return useSyncExternalStore(tiempoReal.suscribirEstado, tiempoReal.obtenerEstado, () => 'sin-sesion')
}

/**
 * Se suscribe a un tópico mientras el componente está montado.
 * `alRecibir` recibe el snapshot inicial y luego cada evento.
 */
export function useTopico(topico: string | null, alRecibir: (m: MensajeTopico) => void) {
  const ref = useRef(alRecibir)
  useEffect(() => {
    ref.current = alRecibir
  })
  useEffect(() => {
    if (!topico) return
    return tiempoReal.suscribir(topico, (m) => ref.current(m))
  }, [topico])
}
