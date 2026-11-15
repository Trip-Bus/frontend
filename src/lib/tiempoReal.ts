import { useEffect, useRef, useSyncExternalStore } from 'react'
import { sesion } from './sesion'

/**
 * Cliente WebSocket del Realtime Gateway (repo Realtime-Gateway, RealtimeHandler.java).
 *
 * Protocolo (vale para main y para develop):
 *   1. Se abre `/ws` SIN token en la URL (en PROD el ?token= se ignora: US-030).
 *   2. Apenas abre, el cliente manda {"type":"connect","token":JWT}. Sin sesión manda
 *      {"type":"connect"}: en develop eso abre una sesión anónima de solo lectura para los
 *      tópicos públicos (US-039); en main responde TOKEN_REQUIRED y la app sigue por REST.
 *   3. Con {"type":"connected"} recién se suscribe (antes respondería UNAUTHENTICATED).
 *   cliente → subscribe | unsubscribe | ping | pong
 *   servidor → connected | subscribed | snapshot | event | unsubscribed | ping | pong | error
 *
 * Reglas del documento de arquitectura:
 *  - Heartbeat: el servidor manda ping cada 20 s y cierra a los 45 s sin pong.
 *  - Reconexión con backoff exponencial: base 1 s, tope 30 s, con jitter.
 *  - Al (re)suscribirse el gateway envía un snapshot completo del tópico.
 *  - Si el canal no está "en-vivo", cada pantalla consulta por REST cada pocos segundos.
 */

export type EstadoConexion = 'sin-sesion' | 'conectando' | 'en-vivo' | 'reconectando'

export type MensajeTopico =
  | { type: 'snapshot'; topic: string; data: unknown; error?: string }
  | { type: 'event'; topic: string; event: string; eventId: string; occurredAt: string; data: unknown }

type MensajeServidor =
  | MensajeTopico
  | { type: 'connected'; userId?: string; role?: string; anonymous?: boolean; heartbeatSeconds: number }
  | { type: 'subscribed' | 'unsubscribed'; topic: string }
  | { type: 'ping' | 'pong' }
  | { type: 'error'; code: string; message: string }

type Manejador = (mensaje: MensajeTopico) => void

export const topicos = {
  asientos: (itineraryId: string) => `itinerario:${itineraryId.toLowerCase()}:asientos`,
  cupoOferta: (offerId: string) => `oferta:${offerId.toLowerCase()}:cupo`,
  novedades: (itineraryId: string) => `viaje:${itineraryId.toLowerCase()}:eventos`,
  posicionBus: (busId: string) => `bus:${busId.toLowerCase()}:posicion`,
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
  private autenticado = false
  /** El servidor (rama main) no acepta sesiones anónimas: sin token no se intenta de nuevo. */
  private anonimoRechazado = false

  constructor() {
    // Login/logout: reconecta con el token nuevo (o como anónimo).
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
      if (this.autenticado) this.enviar({ type: 'subscribe', topic: topico })
    }
    set.add(manejador)
    this.asegurarConexion()

    return () => {
      const actual = this.manejadores.get(topico)
      if (!actual) return
      actual.delete(manejador)
      if (actual.size === 0) {
        this.manejadores.delete(topico)
        if (this.autenticado) this.enviar({ type: 'unsubscribe', topic: topico })
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
    if (!token && this.anonimoRechazado) {
      this.cambiarEstado('sin-sesion')
      return
    }
    this.tokenUsado = token
    this.autenticado = false
    this.cambiarEstado(this.intento === 0 ? 'conectando' : 'reconectando')

    let ws: WebSocket
    try {
      ws = new WebSocket(urlBase())
    } catch {
      this.programarReconexion()
      return
    }
    this.ws = ws

    ws.onopen = () => {
      this.enviar(token ? { type: 'connect', token } : { type: 'connect' })
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
          this.autenticado = true
          this.manejadores.forEach((_, topico) => this.enviar({ type: 'subscribe', topic: topico }))
          this.cambiarEstado('en-vivo')
          return
        case 'snapshot':
        case 'event':
          this.manejadores.get(msg.topic)?.forEach((h) => h(msg))
          return
        case 'error':
          if (!token && (msg.code === 'TOKEN_REQUIRED' || msg.code === 'UNAUTHENTICATED')) {
            // Servidor sin seguimiento público: se queda en REST hasta que haya sesión.
            this.anonimoRechazado = true
            this.cerrar('sin-sesion')
            return
          }
          if (import.meta.env.DEV) console.warn('[tiempo real]', msg.code, msg.message)
          return
        default:
          return
      }
    }
    ws.onclose = () => {
      if (this.ws !== ws) return
      this.ws = null
      this.autenticado = false
      this.limpiarVigia()
      if (this.manejadores.size > 0 && (sesion.token() || !this.anonimoRechazado)) this.programarReconexion()
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
    this.autenticado = false
    ws?.close()
    this.intento = 0
    this.cambiarEstado(estado)
  }

  private reiniciar() {
    if (sesion.token()) this.anonimoRechazado = false
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

/**
 * Cada cuánto consultar por REST según el canal: lento si hay "en vivo" (red de seguridad),
 * rápido si no (US-094: la pantalla nunca se queda congelada).
 */
export function useIntervaloRespaldo(rapidoMs = 5_000, lentoMs = 30_000): number {
  const estado = useEstadoTiempoReal()
  return estado === 'en-vivo' ? lentoMs : rapidoMs
}
