// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DetalleItinerario } from '@/lib/tipos'
import { sesion } from '@/lib/sesion'
import { useEnvioGps } from './gps'

const detalle: DetalleItinerario = {
  itineraryId: 'trip-1',
  routeId: 'route-1',
  busId: 'bus-1',
  companyId: 'company-1',
  empresa: 'TripBus',
  placa: 'ABC123',
  tipoBus: 'UN_PISO',
  capacidad: 40,
  origen: 'Bogotá',
  destino: 'Medellín',
  fechaSalida: new Date(Date.now() - 60_000).toISOString(),
  fechaLlegadaEstimada: new Date(Date.now() + 60_000).toISOString(),
  estado: 'EN_CURSO',
  precioBase: 100,
  moneda: 'COP',
  ofertaActiva: null,
  paradas: [
    { id: 'stop-1', orden: 0, nombre: 'Bogotá', lat: 4.65, lng: -74.1, minutosDesdeSalida: 0, horaProgramada: '' },
    { id: 'stop-2', orden: 1, nombre: 'Medellín', lat: 6.25, lng: -75.56, minutosDesdeSalida: 60, horaProgramada: '' },
  ],
}

const propiedadesOriginales = ['onLine', 'geolocation', 'wakeLock'] as const
const descriptoresOriginales = propiedadesOriginales.map((propiedad) => [
  propiedad,
  Object.getOwnPropertyDescriptor(navigator, propiedad),
] as const)

afterEach(() => {
  for (const [propiedad, descriptor] of descriptoresOriginales) {
    if (descriptor) Object.defineProperty(navigator, propiedad, descriptor)
    else Reflect.deleteProperty(navigator, propiedad)
  }
  vi.unstubAllGlobals()
  sesion.cerrar()
})

beforeEach(() => {
  sesion.iniciar({
    accessToken: 'access',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    userId: 'driver-1',
    rol: 'CONDUCTOR',
  })
})

function prepararNavegador(enLinea: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: enLinea })
  const liberarWakeLock = vi.fn(async () => {})
  Object.defineProperty(navigator, 'wakeLock', {
    configurable: true,
    value: { request: vi.fn(async () => ({ release: liberarWakeLock })) },
  })
  return liberarWakeLock
}

describe('seguimiento GPS del conductor', () => {
  it('no inicia el GPS si falta el itinerario y reporta que el navegador no ofrece ubicación', () => {
    prepararNavegador(true)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useEnvioGps(undefined))

    act(() => result.current.setModo('simulado'))
    expect(fetchMock).not.toHaveBeenCalled()
    act(() => result.current.setModo('apagado'))
    act(() => result.current.setModo('real'))
    expect(result.current.error).toContain('no tiene GPS disponible')
  })

  it('inicia el rastreo, publica una posición simulada y libera recursos al salir', async () => {
    const liberarWakeLock = prepararNavegador(true)
    const fetchMock = vi.fn(async (url: RequestInfo | URL, _init?: RequestInit) => {
      if (String(url).endsWith('/driver/location')) {
        return new Response(JSON.stringify({ aceptada: true }), { status: 200 })
      }
      return new Response(null, { status: 204 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const { result, unmount } = renderHook(() => useEnvioGps(detalle))

    act(() => result.current.setModo('simulado'))

    await waitFor(() => expect(result.current.ultimo).not.toBeNull())
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toContain('/api/v1/driver/tracking/start')
    const envio = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/driver/location'))
    expect(JSON.parse(String(envio?.[1]?.body))).toMatchObject({
      lat: expect.any(Number),
      lng: expect.any(Number),
      precision: 15,
    })

    unmount()
    await waitFor(() => expect(fetchMock.mock.calls.map(([url]) => String(url))).toContain('/api/v1/driver/tracking/stop'))
    await waitFor(() => expect(liberarWakeLock).toHaveBeenCalledOnce())
  })

  it('acumula ubicaciones sin conexión y envía el lote al reconectarse', async () => {
    prepararNavegador(false)
    let reportarPosicion: PositionCallback | undefined
    const geolocation = {
      watchPosition: vi.fn((success: PositionCallback) => {
        reportarPosicion = success
        return 7
      }),
      clearWatch: vi.fn(),
    }
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: geolocation })
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).endsWith('/driver/location/batch')) {
        return new Response(null, { status: 204 })
      }
      return new Response(null, { status: 204 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const { result, unmount } = renderHook(() => useEnvioGps(detalle))

    act(() => result.current.setModo('real'))
    await waitFor(() => expect(geolocation.watchPosition).toHaveBeenCalledOnce())
    act(() => reportarPosicion?.({
      coords: {
        latitude: 4.65,
        longitude: -74.1,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: 90,
        speed: 10,
      },
      timestamp: Date.now(),
    } as GeolocationPosition))
    expect(result.current.pendientes).toBe(1)

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    act(() => globalThis.dispatchEvent(new Event('online')))
    await waitFor(() => expect(result.current.pendientes).toBe(0))
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toContain('/api/v1/driver/location/batch')

    unmount()
    expect(geolocation.clearWatch).toHaveBeenCalledWith(7)
  })

  it('muestra el motivo cuando el servidor descarta una posición', async () => {
    prepararNavegador(true)
    vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).endsWith('/driver/location')) {
        return new Response(JSON.stringify({ aceptada: false, motivo: 'precision baja' }), { status: 200 })
      }
      return new Response(null, { status: 204 })
    }))
    const { result, unmount } = renderHook(() => useEnvioGps(detalle))

    act(() => result.current.setModo('simulado'))

    await waitFor(() => expect(result.current.error).toBe('precision baja'))
    unmount()
  })

  it('valida lecturas y apaga el rastreo cuando el permiso de ubicación es denegado', async () => {
    prepararNavegador(true)
    let reportarPosicion: PositionCallback | undefined
    let reportarError: PositionErrorCallback | undefined
    const geolocation = {
      watchPosition: vi.fn((success: PositionCallback, error: PositionErrorCallback) => {
        reportarPosicion = success
        reportarError = error
        return 12
      }),
      clearWatch: vi.fn(),
    }
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: geolocation })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })))
    const { result } = renderHook(() => useEnvioGps(detalle))
    act(() => result.current.setModo('real'))
    await waitFor(() => expect(geolocation.watchPosition).toHaveBeenCalledOnce())

    act(() => reportarPosicion?.({
      coords: {
        latitude: Number.NaN,
        longitude: -74,
        accuracy: -1,
        altitude: null,
        altitudeAccuracy: null,
        heading: Number.NaN,
        speed: null,
      },
      timestamp: Date.now(),
    } as GeolocationPosition))
    expect(result.current.error).toContain('posición inválida')

    act(() => reportarError?.({ code: 1, message: 'denied', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }))
    expect(result.current.error).toContain('Activa el permiso de ubicación')
    await waitFor(() => expect(result.current.modo).toBe('apagado'))
    expect(geolocation.clearWatch).toHaveBeenCalledWith(12)
  })

  it('muestra un mensaje genérico si el backend rechaza una posición sin motivo', async () => {
    prepararNavegador(true)
    vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo | URL) =>
      String(url).endsWith('/driver/location')
        ? Response.json({ aceptada: false })
        : new Response(null, { status: 204 }),
    ))
    const { result, unmount } = renderHook(() => useEnvioGps(detalle))
    act(() => result.current.setModo('simulado'))
    await waitFor(() => expect(result.current.error).toContain('El servidor descartó esta posición'))
    unmount()
  })
})
