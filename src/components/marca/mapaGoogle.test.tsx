// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { createElement as h } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Registro = { tipo: string; opciones: Record<string, unknown>; mapa: unknown; posicion?: unknown; icono?: unknown }

/** Doble de google.maps que registra lo que el componente crea. */
function crearApiFalsa() {
  const creados: Registro[] = []
  const mapas: { setCenter: ReturnType<typeof vi.fn>; setZoom: ReturnType<typeof vi.fn>; fitBounds: ReturnType<typeof vi.fn> }[] = []
  class Capa {
    r: Registro
    constructor(tipo: string, opciones: Record<string, unknown>) {
      this.r = { tipo, opciones, mapa: opciones.map, posicion: opciones.position, icono: opciones.icon }
      creados.push(this.r)
    }
    setMap(m: unknown) {
      this.r.mapa = m
    }
    setPosition(p: unknown) {
      this.r.posicion = p
    }
    setIcon(i: unknown) {
      this.r.icono = i
    }
  }
  const api = {
    Map: class {
      setCenter = vi.fn()
      setZoom = vi.fn()
      fitBounds = vi.fn()
      constructor() {
        mapas.push(this)
      }
    },
    Marker: class extends Capa {
      constructor(o: Record<string, unknown>) {
        super('marker', o)
      }
    },
    Polyline: class extends Capa {
      constructor(o: Record<string, unknown>) {
        super('polyline', o)
      }
    },
    LatLngBounds: class {
      puntos: unknown[] = []
      extend(p: unknown) {
        this.puntos.push(p)
      }
    },
    Point: class {
      x: number
      y: number
      constructor(x: number, y: number) {
        this.x = x
        this.y = y
      }
    },
    SymbolPath: { CIRCLE: 0 },
  }
  return { api, creados, mapas }
}

type Ventana = Record<string, unknown> & { google?: unknown; __TRIPBUS_CONFIG__?: { googleMapsKey?: string } }
const w = () => window as unknown as Ventana

beforeEach(() => {
  vi.resetModules()
  delete w().google
  delete w().__TRIPBUS_CONFIG__
  document.head.querySelectorAll('script[src*="maps.googleapis.com"]').forEach((s) => s.remove())
})
afterEach(() => cleanup())

describe('claveGoogleMaps', () => {
  it('lee la clave de /config.js y descarta la variable sin reemplazar', async () => {
    const { claveGoogleMaps } = await import('@/lib/configuracion')
    expect(claveGoogleMaps()).toBeNull()
    w().__TRIPBUS_CONFIG__ = { googleMapsKey: '${GOOGLE_MAPS_KEY}' }
    expect(claveGoogleMaps()).toBeNull()
    w().__TRIPBUS_CONFIG__ = { googleMapsKey: '  AIza-prueba ' }
    expect(claveGoogleMaps()).toBe('AIza-prueba')
  })
})

describe('cargarGoogleMaps', () => {
  it('usa la API si ya está cargada', async () => {
    const { api } = crearApiFalsa()
    w().google = { maps: api }
    const { cargarGoogleMaps } = await import('@/features/googleMaps')
    await expect(cargarGoogleMaps('k')).resolves.toBe(api)
  })

  it('inserta el script una sola vez y resuelve con el callback', async () => {
    const { cargarGoogleMaps } = await import('@/features/googleMaps')
    const p1 = cargarGoogleMaps('mi clave')
    const p2 = cargarGoogleMaps('mi clave')
    expect(p1).toBe(p2)
    const scripts = document.head.querySelectorAll<HTMLScriptElement>('script[src*="maps.googleapis.com"]')
    expect(scripts).toHaveLength(1)
    expect(scripts[0].src).toContain('key=mi%20clave')
    const { api } = crearApiFalsa()
    w().google = { maps: api }
    ;(w().__tripbusMapsListo as () => void)()
    await expect(p1).resolves.toBe(api)
  })

  it('rechaza si el script no carga y permite reintentar', async () => {
    const { cargarGoogleMaps } = await import('@/features/googleMaps')
    const p = cargarGoogleMaps('k')
    const script = document.head.querySelector<HTMLScriptElement>('script[src*="maps.googleapis.com"]')!
    script.onerror?.(new Event('error'))
    await expect(p).rejects.toThrow('No se pudo cargar Google Maps')
    expect(cargarGoogleMaps('k')).not.toBe(p)
  })

  it('rechaza si Google no acepta la clave o la API no queda disponible', async () => {
    const mod = await import('@/features/googleMaps')
    const p = mod.cargarGoogleMaps('k')
    ;(w().gm_authFailure as () => void)()
    await expect(p).rejects.toThrow('rechazó la clave')
    vi.resetModules()
    const mod2 = await import('@/features/googleMaps')
    const p2 = mod2.cargarGoogleMaps('k')
    ;(w().__tripbusMapsListo as () => void)()
    await expect(p2).rejects.toThrow('no quedó disponible')
  })
})

describe('MapaGoogle', () => {
  const paradas = [
    { lat: 4.6, lng: -74.1, nombre: 'Bogotá' },
    { lat: 4.4, lng: -74.0, nombre: 'Chipaque' },
    { lat: 4.1, lng: -73.6, nombre: 'Villavicencio' },
  ]

  it('sin clave muestra el mapa de respaldo', async () => {
    const { MapaGoogle } = await import('./MapaGoogle')
    render(h(MapaGoogle, { etiqueta: 'Mapa', respaldo: h('p', null, 'mapa propio') }))
    expect(screen.getByText('mapa propio')).toBeTruthy()
  })

  it('si Google Maps falla vuelve al respaldo', async () => {
    w().__TRIPBUS_CONFIG__ = { googleMapsKey: 'k' }
    const { MapaGoogle } = await import('./MapaGoogle')
    render(h(MapaGoogle, { etiqueta: 'Mapa', paradas, respaldo: h('p', null, 'mapa propio') }))
    expect(screen.getByRole('img', { name: 'Mapa' })).toBeTruthy()
    document.head.querySelector<HTMLScriptElement>('script[src*="maps.googleapis.com"]')!.onerror?.(new Event('error'))
    await waitFor(() => expect(screen.getByText('mapa propio')).toBeTruthy())
  })

  it('dibuja la ruta, las paradas, lo recorrido y mueve el bus sin recrearlo', async () => {
    w().__TRIPBUS_CONFIG__ = { googleMapsKey: 'k' }
    const { api, creados, mapas } = crearApiFalsa()
    w().google = { maps: api }
    const { MapaGoogle } = await import('./MapaGoogle')
    const recorrido = [paradas[0], { lat: 4.5, lng: -74.05 }]
    const props = { etiqueta: 'Mapa de la ruta', paradas, recorrido, respaldo: h('p', null, 'x') }
    const { rerender } = render(h(MapaGoogle, { ...props, buses: [{ id: 'b1', lat: 4.5, lng: -74.05 }] }))
    await waitFor(() => expect(creados.filter((c) => c.tipo === 'marker')).toHaveLength(4))
    expect(creados.filter((c) => c.tipo === 'polyline')).toHaveLength(2)
    expect(mapas[0].fitBounds).toHaveBeenCalledTimes(1)
    const bus = creados.filter((c) => c.tipo === 'marker').at(-1)!
    rerender(h(MapaGoogle, { ...props, buses: [{ id: 'b1', lat: 4.3, lng: -73.9, sinSenal: true }] }))
    await waitFor(() => expect(bus.posicion).toEqual({ id: 'b1', lat: 4.3, lng: -73.9, sinSenal: true }))
    expect((bus.icono as { fillColor: string }).fillColor).toBe('#8c948e')
    expect(creados.filter((c) => c.tipo === 'marker')).toHaveLength(4)
    rerender(h(MapaGoogle, { ...props, buses: [] }))
    await waitFor(() => expect(bus.mapa).toBeNull())
  })

  it('con un solo bus y sin ruta centra el mapa en él', async () => {
    w().__TRIPBUS_CONFIG__ = { googleMapsKey: 'k' }
    const { api, mapas } = crearApiFalsa()
    w().google = { maps: api }
    const { MapaGoogle } = await import('./MapaGoogle')
    render(h(MapaGoogle, { etiqueta: 'Flota', buses: [{ id: 'b', lat: 5, lng: -75, color: '#ff0000' }], respaldo: h('p', null, 'x') }))
    await waitFor(() => expect(mapas[0]?.setZoom).toHaveBeenCalledWith(12))
    expect(mapas[0].setCenter).toHaveBeenCalledWith({ id: 'b', lat: 5, lng: -75, color: '#ff0000' })
  })
})
