import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, EVENTO_MFA_OBLIGATORIA, construirQuery, solicitar } from './api'
import { sesion } from './sesion'
import { esperaReconexion } from './tiempoReal'

afterEach(() => {
  vi.unstubAllGlobals()
  sesion.cerrar()
})

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
    expect(url).toBe('/api/v1/bookings/b1/pay')
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
  it('renueva una sola vez cuando varias peticiones reciben 401 y rota los tokens', async () => {
    sesion.iniciar({
      accessToken: 'access-old',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      refreshToken: 'refresh-old',
      refreshExpiresAt: new Date(Date.now() + 120_000).toISOString(),
      userId: 'user-1',
      rol: 'PASAJERO',
    })
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/v1/auth/refresh') {
        return respuesta(200, {
          accessToken: 'access-new',
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          refreshToken: 'refresh-new',
          refreshExpiresAt: new Date(Date.now() + 120_000).toISOString(),
        })
      }
      const auth = (init?.headers as Record<string, string> | undefined)?.Authorization
      return auth === 'Bearer access-old'
        ? respuesta(401, { error: { code: 'TOKEN_INVALID_OR_EXPIRED', message: 'expired' } })
        : respuesta(200, { ok: true })
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      Promise.all([solicitar('GET', '/one', { auth: 'requerido' }), solicitar('GET', '/two', { auth: 'requerido' })]),
    ).resolves.toEqual([{ ok: true }, { ok: true }])

    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/v1/auth/refresh')).toHaveLength(1)
    expect(sesion.token()).toBe('access-new')
    expect(sesion.refreshToken()).toBe('refresh-new')
  })
  it('avisa a la app cuando el rol exige activar la verificación en dos pasos (US-106)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      respuesta(403, { error: { code: 'MFA_SETUP_REQUIRED', message: 'Tu rol exige la verificación en dos pasos' } }),
    ))
    // En Node globalThis no es un EventTarget: se observa el dispatchEvent que usa el navegador.
    const dispatch = vi.fn()
    vi.stubGlobal('dispatchEvent', dispatch)
    const e = await fallo(solicitar('GET', '/bookings'))
    expect(e.code).toBe('MFA_SETUP_REQUIRED')
    expect(e.paraUsuario).toContain('verificación en dos pasos')
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect((dispatch.mock.calls[0][0] as Event).type).toBe(EVENTO_MFA_OBLIGATORIA)
  })
})

describe('reconexión del tiempo real', () => {
  it('backoff exponencial con tope de 30 s', () => {
    expect(esperaReconexion(0)).toBe(1000)
    expect(esperaReconexion(1)).toBe(2000)
    expect(esperaReconexion(2)).toBe(4000)
    expect(esperaReconexion(10)).toBe(30000)
  })
})
