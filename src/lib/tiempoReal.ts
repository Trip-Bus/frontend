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
 *   cliente → subscribe | resume | unsubscribe | ping | pong
 *   servidor → connected | subscribed | snapshot | event | resumed | unsubscribed | ping | pong | error
 *
 * Orden y reconexión (US-184): cada evento trae `seq` ("<ms>-<n>") y cada snapshot `asOfSeq`. Se guarda el
 * último por tópico, se ignoran los eventos ya incluidos en el snapshot y al reconectar se manda
 * {"type":"resume","topic","lastSeq"}: el servidor reenvía lo perdido o manda un snapshot nuevo.
 * Límite de suscripciones por sesión: 20 autenticada, 5 anónima (o el `maxSubscriptions` de `connected`);
 * las que sobran esperan turno y entran cuando otra pantalla suelta su tópico.
 *
 * Reglas del documento de arquitectura:
 *  - Heartbeat: el servidor manda ping cada 20 s y cierra a los 45 s sin pong.
 *  - Reconexión con backoff exponencial: base 1 s, tope 30 s, con jitter.
 *  - Al (re)suscribirse el gateway envía un snapshot completo del tópico.
 *  - Si el canal no está "en-vivo", cada pantalla consulta por REST cada pocos segundos.
 */

export type EstadoConexion = 'sin-sesion' | 'conectando' | 'en-vivo' | 'reconectando'

export type MensajeTopico =
  | { type: 'snapshot'; topic: string; data: unknown; error?: string; seq?: number | string; asOfSeq?: number | string }
  | { type: 'event'; topic: string; event: string; eventId: string; occurredAt: string; data: unknown; seq?: number | string }

type MensajeServidor =
  | MensajeTopico
  | { type: 'connected'; userId?: string; role?: string; anonymous?: boolean; heartbeatSeconds: number; maxSubscriptions?: number }
  | { type: 'subscribed' | 'unsubscribed' | 'resumed'; topic: string }
  | { type: 'ping' | 'pong' }
  | { type: 'error'; code: string; message: string }

type Manejador = (mensaje: MensajeTopico) => void

const id = (v: string) => v.toLowerCase()

export const topicos = {
  asientos: (itineraryId: string) => `itinerario:${id(itineraryId)}:asientos`,
  cupoOferta: (offerId: string) => `oferta:${id(offerId)}:cupo`,
  ofertasActivas: () => 'ofertas:activas',
  novedades: (itineraryId: string) => `viaje:${id(itineraryId)}:eventos`,
  /** PositionUpdated, TrackingStatusChanged y EtaUpdated del viaje (reemplaza al deprecado bus:{id}:posicion). */
  posicionViaje: (itineraryId: string) => `viaje:${id(itineraryId)}:posicion`,
  tiquetesUsuario: (userId: string) => `usuario:${id(userId)}:tiquetes`,
  avisosUsuario: (userId: string) => `usuario:${id(userId)}:avisos`,
  viajeConductor: (userId: string) => `conductor:${id(userId)}:viaje`,
  alertasEmpresa: (companyId: string) => `empresa:${id(companyId)}:alertas`,
  flotaEmpresa: (companyId: string) => `empresa:${id(companyId)}:flota`,
}

export const LIMITE_SUSCRIPCIONES = { autenticada: 20, anonima: 5 }

/** Compara dos `seq` del gateway ("<ms>-<n>" o número): negativo si a es anterior a b. */
export function compararSeq(a: string, b: string): number {
  const [ma, na = '0'] = a.split('-')
  const [mb, nb = '0'] = b.split('-')
  return Number(ma) - Number(mb) || Number(na) - Number(nb)
}

function urlBase(): string {
  const configurada = import.meta.env.VITE_WS_URL as string | undefined
  if (configurada) return configurada
  const proto = globalThis.location?.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${globalThis.location?.host}/ws`
}

/** Espera antes del intento n (0, 1, 2…): 1, 2, 4… segundos, con tope de 30 s. */
export function esperaReconexion(intento: number): number {
  return Math.min(30_000, 1_000 * 2 ** intento)
}

export const EVENTO_WS_DUPLICADO = 'tripbus:websocket-duplicado'

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
  private debeReanudar = false
  private detenidoPorLimite = false
  private ultimoSeq = new Map<string, string>()
  /** Tópicos que el servidor ya tiene suscritos en esta conexión (cuentan para el límite). */
  private activos = new Set<string>()
  private limite = LIMITE_SUSCRIPCIONES.anonima
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
      if (this.autenticado) this.activar(topico, false)
    }
    set.add(manejador)
    this.asegurarConexion()

    return () => {
      const actual = this.manejadores.get(topico)
      if (!actual) return
      actual.delete(manejador)
      if (actual.size === 0) {
        this.manejadores.delete(topico)
        this.ultimoSeq.delete(topico)
        if (this.autenticado && this.activos.delete(topico)) {
          this.enviar({ type: 'unsubscribe', topic: topico })
          this.activarPendientes(false)
        }
        if (this.manejadores.size === 0) this.cerrar('sin-sesion')
      }
    }
  }

  /** Suscribe (o reanuda) un tópico si hay cupo; si no, queda esperando turno. */
  private activar(topico: string, reanudar: boolean) {
    if (this.activos.has(topico) || this.activos.size >= this.limite) return
    this.activos.add(topico)
    const ultimo = this.ultimoSeq.get(topico)
    if (reanudar && ultimo) this.enviar({ type: 'resume', topic: topico, lastSeq: ultimo })
    else this.enviar({ type: 'subscribe', topic: topico })
  }

  private activarPendientes(reanudar: boolean) {
    this.manejadores.forEach((_, topico) => this.activar(topico, reanudar))
  }

  private cambiarEstado(e: EstadoConexion) {
    if (this.estado === e) return
    this.estado = e
    this.oyentesEstado.forEach((o) => o())
  }

  private asegurarConexion() {
    if (this.ws || this.temporizador || this.manejadores.size === 0 || this.detenidoPorLimite) return
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
          this.activos.clear()
          this.limite = msg.maxSubscriptions ?? (token ? LIMITE_SUSCRIPCIONES.autenticada : LIMITE_SUSCRIPCIONES.anonima)
          this.activarPendientes(this.debeReanudar)
          this.debeReanudar = false
          this.cambiarEstado('en-vivo')
          return
        case 'snapshot':
        case 'event': {
          const seq = msg.type === 'snapshot' ? (msg.asOfSeq ?? msg.seq) : msg.seq
          const ultimo = this.ultimoSeq.get(msg.topic)
          // Un evento con seq <= al último ya está incluido (snapshot o evento anterior).
          if (msg.type === 'event' && seq !== undefined && ultimo && compararSeq(String(seq), ultimo) <= 0) return
          if (seq !== undefined) this.ultimoSeq.set(msg.topic, String(seq))
          this.manejadores.get(msg.topic)?.forEach((h) => h(msg))
          return
        }
        case 'error':
          if (!token && (msg.code === 'TOKEN_REQUIRED' || msg.code === 'UNAUTHENTICATED')) {
            // Servidor sin seguimiento público: se queda en REST hasta que haya sesión.
            this.anonimoRechazado = true
            this.cerrar('sin-sesion')
            return
          }
          if (msg.code === 'TOO_MANY_SUBSCRIPTIONS') return
          if (msg.code === 'TOO_MANY_CONNECTIONS') {
            this.detenidoPorLimite = true
            this.debeReanudar = false
            this.ws?.close(4429, 'TOO_MANY_CONNECTIONS')
            globalThis.dispatchEvent?.(new Event(EVENTO_WS_DUPLICADO))
            return
          }
          if (import.meta.env.DEV) console.warn('[tiempo real]', msg.code, msg.message)
          return
        default:
          return
      }
    }
    ws.onclose = (evento) => {
      if (this.ws !== ws) return
      this.ws = null
      this.debeReanudar = this.autenticado
      this.autenticado = false
      this.activos.clear()
      this.limpiarVigia()
      if (evento.code === 4429) {
        const yaDetenido = this.detenidoPorLimite
        this.detenidoPorLimite = true
        this.debeReanudar = false
        this.cambiarEstado('sin-sesion')
        if (!yaDetenido) globalThis.dispatchEvent?.(new Event(EVENTO_WS_DUPLICADO))
        return
      }
      if (this.detenidoPorLimite) {
        this.cambiarEstado('sin-sesion')
        return
      }
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
    this.activos.clear()
    ws?.close()
    this.intento = 0
    this.cambiarEstado(estado)
  }

  private reiniciar() {
    this.detenidoPorLimite = false
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
