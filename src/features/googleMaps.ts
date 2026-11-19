/**
 * Carga única de Maps JavaScript API. Devuelve la promesa de `google.maps`; si la carga falla (sin red, clave
 * inválida o dominio no autorizado) se rechaza y la pantalla vuelve al mapa propio en SVG.
 *
 * Tipos mínimos propios (solo lo que usa MapaGoogle): @types/google.maps choca con la declaración global de
 * `google` que ya usa el ingreso con Google (accounts.id).
 */
export type LatLngLiteral = { lat: number; lng: number }
export type Simbolo = {
  path: number | string
  scale?: number
  fillColor?: string
  fillOpacity?: number
  strokeColor?: string
  strokeOpacity?: number
  strokeWeight?: number
  labelOrigin?: unknown
}
export interface MapaG {
  setCenter(c: LatLngLiteral): void
  setZoom(z: number): void
  fitBounds(b: unknown, padding?: { top: number; bottom: number; left: number; right: number }): void
}
export interface MarcadorG {
  setMap(m: MapaG | null): void
  setPosition(p: LatLngLiteral): void
  setIcon(i: Simbolo): void
}
export interface LineaG {
  setMap(m: MapaG | null): void
}
export interface LimitesG {
  extend(p: LatLngLiteral): void
}
export interface GoogleMapsApi {
  Map: new (el: HTMLElement, opciones: Record<string, unknown>) => MapaG
  Marker: new (opciones: Record<string, unknown>) => MarcadorG
  Polyline: new (opciones: Record<string, unknown>) => LineaG
  LatLngBounds: new () => LimitesG
  Point: new (x: number, y: number) => unknown
  SymbolPath: { CIRCLE: number }
}

type VentanaConMaps = { google?: { maps?: GoogleMapsApi } } & Record<string, unknown>

let carga: Promise<GoogleMapsApi> | null = null

function apiCargada(): GoogleMapsApi | null {
  const maps = (globalThis.window as unknown as VentanaConMaps | undefined)?.google?.maps
  return maps?.Map ? maps : null
}

export function cargarGoogleMaps(clave: string): Promise<GoogleMapsApi> {
  const ya = apiCargada()
  if (ya) return Promise.resolve(ya)
  if (carga) return carga
  carga = new Promise<GoogleMapsApi>((resolver, rechazar) => {
    const w = globalThis.window as unknown as VentanaConMaps
    const callback = '__tripbusMapsListo'
    w[callback] = () => {
      const maps = apiCargada()
      if (maps) resolver(maps)
      else rechazar(new Error('Google Maps no quedó disponible'))
    }
    // La API llama a gm_authFailure cuando la clave no sirve para este dominio.
    w.gm_authFailure = () => rechazar(new Error('Google Maps rechazó la clave'))
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(clave)}&v=weekly&language=es&region=CO&loading=async&callback=${callback}`
    script.async = true
    script.onerror = () => {
      carga = null
      rechazar(new Error('No se pudo cargar Google Maps'))
    }
    document.head.appendChild(script)
  })
  return carga
}
