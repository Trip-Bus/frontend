// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { sesion } from '@/lib/sesion'
import type { Distribucion, ParadaRuta } from '@/lib/tipos'
import { cuantosFiltros, rutaAsientos } from './busqueda'
import { celdaEn, numerar, pintar, redimensionar } from './editorMapa'
import { activarPush, desactivarPush, estadoPush, llaveABytes, pushSoportado } from './push'
import { renumerar, validarParadas, validarPreciosTramo } from './rutas'
import { valor } from './valores'

const mapa = (): Distribucion => ({
  tipo: 'UN_PISO',
  capacidad: 2,
  pisos: [{ piso: 1, filas: 2, columnas: 2, celdas: [{ fila: 1, columna: 1, tipo: 'ASIENTO', asiento: '1' }, { fila: 2, columna: 2, tipo: 'CONDUCTOR' }] }],
})

describe('editor del mapa del bus', () => {
  it('pinta, quita, redimensiona y numera sin cambiar los números existentes', () => {
    let d = pintar(mapa(), 0, 1, 2, { tipo: 'ASIENTO', categoria: 'PREMIUM' })
    d = pintar(d, 0, 1, 1, { tipo: 'ASIENTO', categoria: 'ESTANDAR' })
    expect(celdaEn(d.pisos[0], 1, 1)?.asiento).toBe('1')
    d = pintar(d, 0, 2, 2, { tipo: 'VACIO' })
    expect(celdaEn(d.pisos[0], 2, 2)).toBeUndefined()
    d = pintar(d, 0, 2, 1, { tipo: 'BANO' })
    const n = numerar(d)
    expect(celdaEn(n.pisos[0], 1, 2)).toMatchObject({ asiento: '2', categoria: 'PREMIUM' })
    expect(n.capacidad).toBe(2)
    const r = redimensionar(n, 0, 1, 1)
    expect(r.pisos[0]).toMatchObject({ filas: 1, columnas: 1 })
    expect(r.pisos[0].celdas).toHaveLength(1)
    expect(redimensionar(n, 0, 99, 0).pisos[0]).toMatchObject({ filas: 30, columnas: 1 })
    expect(pintar(n, 5, 1, 1, { tipo: 'PUERTA' })).toEqual(n)
  })
})

describe('rutas', () => {
  const p = (orden: number, minutos: number, extra: Partial<ParadaRuta> = {}): ParadaRuta => ({ orden, nombre: `P${orden}`, lat: 5, lng: -74, minutosDesdeSalida: minutos, ...extra })
  it.each([
    ['', 'B', [p(1, 0), p(2, 10)], 'Escribe el origen y el destino.'],
    ['A', 'a', [p(1, 0), p(2, 10)], 'El origen y el destino deben ser distintos.'],
    ['A', 'B', [p(1, 0)], 'La ruta necesita al menos 2 paradas: el origen y el destino.'],
    ['A', 'B', [p(1, 0), p(2, 10, { nombre: ' ' })], 'Cada parada necesita un nombre.'],
    ['A', 'B', [p(1, 5), p(2, 10)], 'La primera parada sale en el minuto 0.'],
    ['A', 'B', [p(1, 0), p(2, 0)], 'Los minutos deben crecer: revisa la parada 2.'],
    ['A', 'B', [p(1, 0), p(2, 10, { lat: 40 })], 'La parada 2 queda por fuera de Colombia: revisa la latitud y la longitud.'],
    ['A', 'B', [p(1, 0), p(2, 10)], null],
  ])('valida %s → %s', (o, d, paradas, error) => {
    expect(validarParadas(o, d, paradas as ParadaRuta[])).toBe(error)
  })

  it('renumera y valida precios por tramo', () => {
    expect(renumerar([p(5, 0), p(9, 1)]).map((x) => x.orden)).toEqual([1, 2])
    expect(validarPreciosTramo([{ desdeOrden: 2, hastaOrden: 1, precio: 1 }], 3)).toMatch(/posterior/)
    expect(validarPreciosTramo([{ desdeOrden: 1, hastaOrden: 3, precio: 1 }], 3)).toMatch(/recorrido completo/)
    expect(validarPreciosTramo([{ desdeOrden: 1, hastaOrden: 2, precio: 0 }], 3)).toMatch(/mayor que 0/)
    expect(validarPreciosTramo([{ desdeOrden: 1, hastaOrden: 2, precio: 1 }, { desdeOrden: 1, hastaOrden: 2, precio: 2 }], 3)).toMatch(/repetidos/)
    expect(validarPreciosTramo([{ desdeOrden: 1, hastaOrden: 2, precio: 1 }], 3)).toBeNull()
  })
})

describe('búsqueda y formularios', () => {
  it('cuenta filtros, arma la ruta de puestos con tramo y convierte valores', () => {
    expect(cuantosFiltros({ franja: 'NOCHE', precioMax: 1, sort: 'precio' })).toBe(2)
    expect(rutaAsientos({ itineraryId: 'i' }, 2)).toBe('/viaje/i/asientos?pasajeros=2')
    expect(rutaAsientos({ itineraryId: 'i', fromOrden: 2, toOrden: 4 }, 1)).toBe('/viaje/i/asientos?pasajeros=1&desde=2&hasta=4')
    expect(valor.texto({ a: ' x ' }, 'a')).toBe('x')
    expect(valor.numero({ a: '' }, 'a')).toBeNull()
    expect(valor.numero({ a: '3' }, 'a')).toBe(3)
    expect(valor.opcional({ a: '' }, 'a')).toBeNull()
  })
})

describe('Web Push', () => {
  afterEach(() => vi.unstubAllGlobals())

  function navegador(permiso: NotificationPermission, sub: unknown = null) {
    const suscripcion = sub as { endpoint: string; unsubscribe: () => Promise<boolean> } | null
    const pushManager = {
      getSubscription: vi.fn(async () => suscripcion),
      subscribe: vi.fn(async () => ({ endpoint: 'https://push/1', toJSON: () => ({ endpoint: 'https://push/1', keys: { p256dh: 'p', auth: 'a' } }) })),
    }
    const reg = { pushManager }
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { register: vi.fn(async () => reg), getRegistration: vi.fn(async () => reg) } })
    vi.stubGlobal('PushManager', class {})
    vi.stubGlobal('Notification', { permission: permiso, requestPermission: vi.fn(async () => permiso) })
    return pushManager
  }

  it('convierte la llave base64url a bytes', () => {
    expect(Array.from(llaveABytes('AQID'))).toEqual([1, 2, 3])
    expect(Array.from(llaveABytes('_-8'))).toEqual([255, 239])
  })

  it('pide permiso solo al activar, se suscribe y lo registra en el gateway', async () => {
    const pm = navegador('granted')
    const fetchMock = vi.fn(async (u: RequestInfo | URL, _i?: RequestInit) => (String(u).endsWith('/push/public-key') ? Response.json({ publicKey: 'AQID' }) : new Response(null, { status: 201 })))
    vi.stubGlobal('fetch', fetchMock)
    sesion.iniciar({ accessToken: 't', expiresAt: new Date(Date.now() + 60_000).toISOString(), userId: 'u', rol: 'PASAJERO' })
    expect(pushSoportado()).toBe(true)
    expect(await estadoPush()).toBe('inactivo')
    expect(await activarPush()).toBe('activo')
    expect(pm.subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }))
    expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith('/push/subscriptions'))).toBe(true)
  })

  it('respeta el permiso bloqueado y desactiva la suscripción', async () => {
    navegador('denied')
    expect(await estadoPush()).toBe('bloqueado')
    expect(await activarPush()).toBe('bloqueado')
    const unsubscribe = vi.fn(async () => true)
    navegador('granted', { endpoint: 'https://push/1', unsubscribe })
    sesion.iniciar({ accessToken: 't', expiresAt: new Date(Date.now() + 60_000).toISOString(), userId: 'u', rol: 'PASAJERO' })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })))
    expect(await estadoPush()).toBe('activo')
    expect(await desactivarPush()).toBe('inactivo')
    expect(unsubscribe).toHaveBeenCalled()
    sesion.cerrar()
  })

  it('sin soporte lo dice', async () => {
    vi.stubGlobal('PushManager', undefined)
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: undefined })
    // @ts-expect-error se quita a propósito para simular un navegador sin push
    delete navigator.serviceWorker
    vi.stubGlobal('Notification', undefined)
    expect(await estadoPush()).toBe('no-soportado')
    expect(await activarPush()).toBe('no-soportado')
  })
})
