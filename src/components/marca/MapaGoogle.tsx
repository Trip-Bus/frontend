import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cargarGoogleMaps, type GoogleMapsApi, type LineaG, type MapaG, type MarcadorG, type Simbolo } from '@/features/googleMaps'
import { claveGoogleMaps } from '@/lib/configuracion'

type LatLng = { lat: number; lng: number }

export type BusEnMapa = LatLng & { id: string; etiqueta?: string; sinSenal?: boolean; color?: string }

const TINTA = '#0d1411'
const ACENTO = '#c6f24e'
const GRIS = '#8c948e'

/** Icono del bus: círculo con el color de la marca (gris si no hay señal). */
function iconoBus(maps: GoogleMapsApi, b: BusEnMapa): Simbolo {
  return { path: maps.SymbolPath.CIRCLE, scale: 11, fillColor: b.color ?? (b.sinSenal ? GRIS : ACENTO), fillOpacity: 1, strokeColor: TINTA, strokeWeight: 3 }
}

function iconoParada(maps: GoogleMapsApi, extremo: boolean, destino: boolean): Simbolo {
  return {
    path: maps.SymbolPath.CIRCLE,
    scale: extremo ? 7 : 5,
    fillColor: destino ? TINTA : '#ffffff',
    fillOpacity: 1,
    strokeColor: TINTA,
    strokeWeight: 3,
    // El nombre va encima del punto (unidades del símbolo: 7 × -3 ≈ 21 px).
    labelOrigin: new maps.Point(0, -3),
  }
}

/**
 * Mapa de Google Maps con la ruta (paradas), lo ya recorrido y los buses. Si no hay clave configurada o la API
 * no carga, muestra `respaldo` (el mapa propio en SVG), así la pantalla nunca queda vacía.
 */
export function MapaGoogle({
  paradas = [],
  recorrido = [],
  buses = [],
  etiqueta,
  className,
  respaldo,
}: {
  paradas?: (LatLng & { nombre: string })[]
  recorrido?: LatLng[]
  buses?: BusEnMapa[]
  etiqueta: string
  className?: string
  respaldo: ReactNode
}) {
  const clave = claveGoogleMaps()
  const contenedor = useRef<HTMLDivElement>(null)
  const mapa = useRef<MapaG | null>(null)
  const capas = useRef<{ ruta?: LineaG; hecho?: LineaG; paradas: MarcadorG[]; buses: Map<string, MarcadorG> }>({
    paradas: [],
    buses: new Map(),
  })
  const [maps, setMaps] = useState<GoogleMapsApi | null>(null)
  const [fallo, setFallo] = useState(false)
  const encuadrado = useRef(false)

  useEffect(() => {
    if (!clave) return
    let vivo = true
    cargarGoogleMaps(clave)
      .then((m) => vivo && setMaps(m))
      .catch(() => vivo && setFallo(true))
    return () => {
      vivo = false
    }
  }, [clave])

  // Crear el mapa una vez.
  useEffect(() => {
    if (!maps || !contenedor.current || mapa.current) return
    mapa.current = new maps.Map(contenedor.current, {
      center: paradas[0] ?? buses[0] ?? { lat: 4.65, lng: -74.1 },
      zoom: 7,
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: 'greedy',
      clickableIcons: false,
    })
  }, [maps, paradas, buses])

  // Ruta y paradas.
  useEffect(() => {
    const m = mapa.current
    if (!maps || !m) return
    const c = capas.current
    c.ruta?.setMap(null)
    c.paradas.forEach((p) => p.setMap(null))
    c.paradas = []
    if (paradas.length > 1) {
      c.ruta = new maps.Polyline({
        map: m,
        path: paradas,
        strokeOpacity: 0,
        icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.55, strokeColor: TINTA, scale: 3 }, offset: '0', repeat: '14px' }],
      })
    }
    paradas.forEach((p, i) => {
      const extremo = i === 0 || i === paradas.length - 1
      c.paradas.push(
        new maps.Marker({
          map: m,
          position: p,
          title: p.nombre,
          icon: iconoParada(maps, extremo, i === paradas.length - 1),
          label: extremo ? { text: p.nombre, color: TINTA, fontWeight: '700', fontSize: '13px' } : undefined,
          zIndex: 1,
        }),
      )
    })
  }, [maps, paradas])

  // Tramo recorrido.
  useEffect(() => {
    const m = mapa.current
    if (!maps || !m) return
    const c = capas.current
    c.hecho?.setMap(null)
    c.hecho = recorrido.length > 1 ? new maps.Polyline({ map: m, path: recorrido, strokeColor: TINTA, strokeWeight: 5, strokeOpacity: 0.9 }) : undefined
  }, [maps, recorrido])

  // Buses: se mueven en su lugar (sin recrear el marcador) para que no parpadeen.
  useEffect(() => {
    const m = mapa.current
    if (!maps || !m) return
    const actuales = capas.current.buses
    const ids = new Set(buses.map((b) => b.id))
    for (const [id, marcador] of actuales) {
      if (!ids.has(id)) {
        marcador.setMap(null)
        actuales.delete(id)
      }
    }
    for (const b of buses) {
      const existente = actuales.get(b.id)
      if (existente) {
        existente.setPosition(b)
        existente.setIcon(iconoBus(maps, b))
      } else {
        actuales.set(b.id, new maps.Marker({ map: m, position: b, title: b.etiqueta, icon: iconoBus(maps, b), zIndex: 10 }))
      }
    }
  }, [maps, buses])

  // Encuadre inicial: toda la ruta (o todos los buses).
  useEffect(() => {
    const m = mapa.current
    if (!maps || !m || encuadrado.current) return
    const puntos: LatLng[] = paradas.length > 0 ? paradas : buses
    if (puntos.length === 0) return
    if (puntos.length === 1) {
      m.setCenter(puntos[0])
      m.setZoom(12)
    } else {
      const limites = new maps.LatLngBounds()
      puntos.forEach((p) => limites.extend(p))
      m.fitBounds(limites, { top: 70, bottom: 40, left: 30, right: 30 })
    }
    encuadrado.current = true
  }, [maps, paradas, buses])

  if (!clave || fallo) return <>{respaldo}</>
  return <div ref={contenedor} role="img" aria-label={etiqueta} className={className} />
}
