import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, construirQuery, solicitar } from './api'
import { esperaReconexion } from './tiempoReal'

afterEach(() => vi.unstubAllGlobals())

/** Espera que la promesa falle y devuelve el ApiError. */
const fallo = (p: Promise<unknown>): Promise<ApiError> =>
  p.then(
    () => {
      throw new Error('se esperaba un error')
    },
    (x: unknown) => x as ApiError,
  )

function respuesta(status: number, cuerpo?: unknown, headers: Record<string, string> = {}) {
  return new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), { status, headers })
}

describe('cliente de la API', () => {
  it('arma la query omitiendo vacíos', () => {
    expect(construirQuery({ origin: 'Bogotá', destination: 'Medellín', date: '2026-10-09', x: undefined, y: '' })).toBe(
      '?origin=Bogot%C3%A1&destination=Medell%C3%ADn&date=2026-10-09',
    )
    expect(construirQuery()).toBe('')
  })

  it('convierte el error estándar del backend en ApiError con mensaje amigable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      respuesta(409, { error: { code: 'SEAT_LOCKED', message: 'locked', details: { asiento: '14' } } }),
    ))
    const e = await fallo(solicitar('POST', '/seats/holds', { auth: 'ninguno', body: {} }))
    expect(e).toBeInstanceOf(ApiError)
    expect(e.status).toBe(409)
    expect(e.code).toBe('SEAT_LOCKED')
    expect(e.details).toEqual({ asiento: '14' })
    expect(e.paraUsuario).toMatch(/Alguien está tomando ese puesto/)
  })

  it('lee Retry-After en el 429 del gateway', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      respuesta(429, { error: { code: 'RATE_LIMITED', message: 'x', details: {} } }, { 'Retry-After': '1' }),
    ))
    const e = await fallo(solicitar('GET', '/trips/search', { auth: 'ninguno' }))
    expect(e.code).toBe('RATE_LIMITED')
    expect(e.reintentarEn).toBe(1)
  })

  it('sin red devuelve SIN_CONEXION', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }))
    const e = await fallo(solicitar('GET', '/trips/cities', { auth: 'ninguno' }))
    expect(e.code).toBe('SIN_CONEXION')
    expect(e.status).toBe(0)
  })

  it('manda la Idempotency-Key en el pago y el prefijo /api', async () => {
    const f = vi.fn(async (_url: string, _init?: RequestInit) => respuesta(200, { paymentId: 'p1' }))
    vi.stubGlobal('fetch', f)
    await solicitar('POST', '/bookings/b1/pay', { auth: 'ninguno', body: { cardToken: 't' }, idempotencyKey: 'k-1' })
    const [url, init] = f.mock.calls[0]
    const headers = (init ?? {}).headers as Record<string, string>
    expect(url).toBe('/api/bookings/b1/pay')
    expect(headers['Idempotency-Key']).toBe('k-1')
  })

  it('exige sesión cuando la ruta lo pide', async () => {
    const e = await fallo(solicitar('GET', '/bookings', { auth: 'requerido' }))
    expect(e.code).toBe('UNAUTHENTICATED')
  })

  it('204 devuelve undefined', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuesta(204)))
    await expect(solicitar('POST', '/auth/logout', { auth: 'ninguno' })).resolves.toBeUndefined()
  })
})

describe('reconexión del tiempo real', () => {
  it('backoff exponencial con tope de 30 s', () => {
    expect(esperaReconexion(0, () => 1)).toBe(1000)
    expect(esperaReconexion(3, () => 1)).toBe(8000)
    expect(esperaReconexion(10, () => 1)).toBe(30000)
    expect(esperaReconexion(10, () => 0)).toBe(500)
  })
})
