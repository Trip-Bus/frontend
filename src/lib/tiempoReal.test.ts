import { afterEach, describe, expect, it, vi } from 'vitest'
import { EVENTO_WS_DUPLICADO, tiempoReal } from './tiempoReal'
import { sesion } from './sesion'

class WebSocketFalso {
  static OPEN = 1
  static CLOSED = 3
  static conexiones: WebSocketFalso[] = []
  readyState = 0
  onopen: ((evento: Event) => void) | null = null
  onmessage: ((evento: MessageEvent) => void) | null = null
  onclose: ((evento: CloseEvent) => void) | null = null
  onerror: ((evento: Event) => void) | null = null
  enviados: string[] = []

  constructor() {
    WebSocketFalso.conexiones.push(this)
  }

  send(mensaje: string) {
    this.enviados.push(mensaje)
  }

  open() {
    this.readyState = WebSocketFalso.OPEN
    this.onopen?.(new Event('open'))
  }

  recibir(mensaje: unknown) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(mensaje) }))
  }

  close(code = 1000) {
    this.readyState = WebSocketFalso.CLOSED
    this.onclose?.({ code } as CloseEvent)
  }
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  WebSocketFalso.conexiones = []
  sesion.cerrar()
})

describe('conexión de tiempo real', () => {
  it('reanuda cada tópico con la última secuencia recibida', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('WebSocket', WebSocketFalso)
    const unsubscribe = tiempoReal.suscribir('viaje:1:posicion', () => {})
    const primera = WebSocketFalso.conexiones[0]
    primera.open()
    primera.recibir({ type: 'connected', heartbeatSeconds: 20 })
    primera.recibir({
      type: 'event',
      topic: 'viaje:1:posicion',
      event: 'LocationChanged',
      eventId: 'evt-1',
      occurredAt: '2026-11-13T10:00:00Z',
      seq: 23,
      data: {},
    })
    primera.close(1006)

    await vi.advanceTimersByTimeAsync(1_000)
    const segunda = WebSocketFalso.conexiones[1]
    segunda.open()
    segunda.recibir({ type: 'connected', heartbeatSeconds: 20 })

    expect(segunda.enviados.map((x) => JSON.parse(x))).toContainEqual({
      type: 'resume',
      topic: 'viaje:1:posicion',
      lastSeq: '23',
    })
    unsubscribe()
  })

  it('detiene las reconexiones automáticas al alcanzar el límite de conexiones', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('WebSocket', WebSocketFalso)
    const dispatch = vi.fn()
    vi.stubGlobal('dispatchEvent', dispatch)
    const unsubscribe = tiempoReal.suscribir('viaje:2:posicion', () => {})
    const ws = WebSocketFalso.conexiones[0]
    ws.open()
    ws.recibir({ type: 'connected', heartbeatSeconds: 20 })
    ws.close(4429)

    await vi.advanceTimersByTimeAsync(60_000)

    expect(WebSocketFalso.conexiones).toHaveLength(1)
    expect(dispatch.mock.calls.some(([evento]) => (evento as Event).type === EVENTO_WS_DUPLICADO)).toBe(true)
    unsubscribe()
  })
})
