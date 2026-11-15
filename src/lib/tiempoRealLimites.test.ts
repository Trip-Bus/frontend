import { afterEach, describe, expect, it, vi } from 'vitest'
import { compararSeq, esperaReconexion, LIMITE_SUSCRIPCIONES, tiempoReal, topicos } from './tiempoReal'
import { sesion } from './sesion'

class WebSocketFalso {
  static OPEN = 1
  static conexiones: WebSocketFalso[] = []
  readyState = 0
  onopen: (() => void) | null = null
  onmessage: ((evento: MessageEvent) => void) | null = null
  onclose: ((evento: CloseEvent) => void) | null = null
  onerror: (() => void) | null = null
  enviados: Record<string, unknown>[] = []
  constructor() {
    WebSocketFalso.conexiones.push(this)
  }
  send(m: string) {
    this.enviados.push(JSON.parse(m))
  }
  open() {
    this.readyState = 1
    this.onopen?.()
  }
  recibir(m: unknown) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(m) }))
  }
  close(code = 1000) {
    this.readyState = 3
    this.onclose?.({ code } as CloseEvent)
  }
}

const suscritos = (ws: WebSocketFalso) => ws.enviados.filter((m) => m.type === 'subscribe' || m.type === 'resume').map((m) => m.topic)

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  WebSocketFalso.conexiones = []
  sesion.cerrar()
})

describe('tópicos y orden de eventos', () => {
  it('arma los tópicos del gateway en minúsculas', () => {
    expect(topicos.posicionViaje('ABC')).toBe('viaje:abc:posicion')
    expect(topicos.ofertasActivas()).toBe('ofertas:activas')
    expect(topicos.tiquetesUsuario('U')).toBe('usuario:u:tiquetes')
    expect(topicos.avisosUsuario('U')).toBe('usuario:u:avisos')
    expect(topicos.viajeConductor('U')).toBe('conductor:u:viaje')
    expect(topicos.alertasEmpresa('C')).toBe('empresa:c:alertas')
    expect(topicos.flotaEmpresa('C')).toBe('empresa:c:flota')
  })

  it('compara secuencias "<ms>-<n>" y numéricas', () => {
    expect(compararSeq('100-2', '100-10')).toBeLessThan(0)
    expect(compararSeq('101-0', '100-9')).toBeGreaterThan(0)
    expect(compararSeq('7', '7')).toBe(0)
  })

  it('reintenta con espera creciente hasta 30 s', () => {
    expect([0, 1, 2, 3, 10].map(esperaReconexion)).toEqual([1_000, 2_000, 4_000, 8_000, 30_000])
  })

  it('ignora los eventos ya incluidos en el snapshot (asOfSeq) y reanuda desde el último', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('WebSocket', WebSocketFalso)
    const recibidos: string[] = []
    const soltar = tiempoReal.suscribir('viaje:1:eventos', (m) => recibidos.push(m.type === 'event' ? m.event : 'snapshot'))
    const ws = WebSocketFalso.conexiones[0]
    ws.open()
    ws.recibir({ type: 'connected', heartbeatSeconds: 20 })
    ws.recibir({ type: 'snapshot', topic: 'viaje:1:eventos', asOfSeq: '100-5', data: [] })
    ws.recibir({ type: 'event', topic: 'viaje:1:eventos', event: 'Viejo', eventId: 'a', occurredAt: '', seq: '100-4', data: {} })
    ws.recibir({ type: 'event', topic: 'viaje:1:eventos', event: 'Nuevo', eventId: 'b', occurredAt: '', seq: '100-6', data: {} })
    expect(recibidos).toEqual(['snapshot', 'Nuevo'])

    ws.close(1006)
    await vi.advanceTimersByTimeAsync(1_000)
    const otra = WebSocketFalso.conexiones[1]
    otra.open()
    otra.recibir({ type: 'connected', heartbeatSeconds: 20 })
    expect(otra.enviados).toContainEqual({ type: 'resume', topic: 'viaje:1:eventos', lastSeq: '100-6' })
    soltar()
  })
})

describe('límite de suscripciones', () => {
  it('una sesión anónima suscribe 5 tópicos y el resto espera turno', () => {
    vi.stubGlobal('WebSocket', WebSocketFalso)
    const soltar = Array.from({ length: 7 }, (_, i) => tiempoReal.suscribir(`oferta:${i}:cupo`, () => {}))
    const ws = WebSocketFalso.conexiones[0]
    ws.open()
    ws.recibir({ type: 'connected', anonymous: true, heartbeatSeconds: 20 })
    expect(suscritos(ws)).toHaveLength(LIMITE_SUSCRIPCIONES.anonima)

    // Al soltar uno, entra el siguiente que esperaba.
    soltar[0]()
    expect(ws.enviados).toContainEqual({ type: 'unsubscribe', topic: 'oferta:0:cupo' })
    expect(suscritos(ws)).toContain('oferta:5:cupo')
    expect(suscritos(ws)).not.toContain('oferta:6:cupo')
    soltar.slice(1).forEach((s) => s())
  })

  it('respeta el maxSubscriptions de connected y no se cae con TOO_MANY_SUBSCRIPTIONS', () => {
    vi.stubGlobal('WebSocket', WebSocketFalso)
    sesion.iniciar({ accessToken: 'jwt', expiresAt: new Date(Date.now() + 60_000).toISOString(), userId: 'u', rol: 'PASAJERO' })
    const soltar = Array.from({ length: 4 }, (_, i) => tiempoReal.suscribir(`viaje:${i}:posicion`, () => {}))
    const ws = WebSocketFalso.conexiones.at(-1)!
    ws.open()
    expect(ws.enviados[0]).toEqual({ type: 'connect', token: 'jwt' })
    ws.recibir({ type: 'connected', heartbeatSeconds: 20, maxSubscriptions: 3 })
    expect(suscritos(ws)).toHaveLength(3)
    ws.recibir({ type: 'error', code: 'TOO_MANY_SUBSCRIPTIONS', message: 'límite' })
    expect(ws.readyState).toBe(1)
    soltar.forEach((s) => s())
  })

  it('una sesión autenticada sin maxSubscriptions usa 20', () => {
    vi.stubGlobal('WebSocket', WebSocketFalso)
    sesion.iniciar({ accessToken: 'jwt', expiresAt: new Date(Date.now() + 60_000).toISOString(), userId: 'u', rol: 'PASAJERO' })
    const soltar = Array.from({ length: 22 }, (_, i) => tiempoReal.suscribir(`itinerario:${i}:asientos`, () => {}))
    const ws = WebSocketFalso.conexiones.at(-1)!
    ws.open()
    ws.recibir({ type: 'connected', heartbeatSeconds: 20 })
    expect(suscritos(ws)).toHaveLength(LIMITE_SUSCRIPCIONES.autenticada)
    soltar.forEach((s) => s())
  })
})
