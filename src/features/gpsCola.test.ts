import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/lib/endpoints'
import { sesion } from '@/lib/sesion'
import { ColaGps } from './gpsCola'

afterEach(() => {
  vi.unstubAllGlobals()
  sesion.cerrar()
})

const posicion = (lat: number) => ({
  lat,
  lng: -74,
  precision: 12,
  velocidad: 30,
  rumbo: 90,
  timestamp: new Date(lat * 1_000).toISOString(),
})

describe('cola de posiciones GPS', () => {
  it('conserva como máximo 50 posiciones recientes', () => {
    const cola = new ColaGps()
    for (let lat = 0; lat < 51; lat += 1) cola.agregar(posicion(lat))

    expect(cola.cantidad).toBe(50)
    expect(cola.lote()[0].lat).toBe(1)
    expect(cola.lote()[49].lat).toBe(50)
  })

  it('confirma solo el prefijo que se envió', () => {
    const cola = new ColaGps()
    cola.agregar(posicion(1))
    cola.agregar(posicion(2))
    cola.agregar(posicion(3))

    cola.confirmar(2)

    expect(cola.lote().map((p) => p.lat)).toEqual([3])
  })

  it('envía ubicaciones sin ids de bus ni itinerario', async () => {
    sesion.iniciar({
      accessToken: 'access',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      userId: 'driver-1',
      rol: 'CONDUCTOR',
    })
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(null, { status: 202 }))
    vi.stubGlobal('fetch', fetchMock)
    const ubicacion = {
      lat: 4.65,
      lng: -74.1,
      precision: 12,
      velocidad: 36,
      rumbo: 90,
      timestamp: new Date().toISOString(),
    }

    await api.conductor.enviarUbicacion(ubicacion)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/v1/driver/location')
    expect(JSON.parse(String(init?.body))).toEqual(ubicacion)
    expect(init?.body).not.toContain('busId')
    expect(init?.body).not.toContain('itineraryId')
  })
})
