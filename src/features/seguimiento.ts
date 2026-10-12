import type { Novedad, ParadaSeguimiento, Posicion } from '@/lib/tipos'

/**
 * Cálculos de "dónde va mi bus" (US-039 / US-047) sin servicios de mapas pagos:
 * las paradas reales (lat/lng) se proyectan a un SVG y la posición del bus se ubica sobre la ruta.
 */

export type Punto = { x: number; y: number }

const RADIO_TIERRA_KM = 6371

export function distanciaKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * RADIO_TIERRA_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * Proyección equirectangular ajustada a una caja (ancho × alto) con margen. Para rutas de unos
 * cientos de km la deformación es mínima y no hace falta una librería de mapas.
 */
export function crearProyeccion(puntos: { lat: number; lng: number }[], ancho: number, alto: number, margen = 32, margenArriba = margen) {
  const lats = puntos.map((p) => p.lat)
  const lngs = puntos.map((p) => p.lng)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  const latMedia = ((minLat + maxLat) / 2) * (Math.PI / 180)
  const spanX = Math.max(1e-6, (maxLng - minLng) * Math.cos(latMedia))
  const spanY = Math.max(1e-6, maxLat - minLat)
  const escala = Math.min((ancho - 2 * margen) / spanX, (alto - margen - margenArriba) / spanY)
  const offX = (ancho - spanX * escala) / 2
  const offY = margenArriba + (alto - margen - margenArriba - spanY * escala) / 2
  return (p: { lat: number; lng: number }): Punto => ({
    x: offX + (p.lng - minLng) * Math.cos(latMedia) * escala,
    y: offY + (maxLat - p.lat) * escala,
  })
}

export type Avance = {
  /** índice de la última parada ya pasada (0 = origen) */
  ultimaParada: number
  /** km que faltan hasta el destino siguiendo las paradas */
  kmRestantes: number
  /** 0..1 a lo largo de toda la ruta */
  fraccion: number
}

/** Ubica la posición sobre el tramo de paradas más cercano. */
export function calcularAvance(paradas: ParadaSeguimiento[], pos: { lat: number; lng: number } | null): Avance | null {
  if (!pos || paradas.length < 2) return null
  const tramos = paradas.slice(1).map((p, i) => distanciaKm(paradas[i], p))
  const total = tramos.reduce((a, b) => a + b, 0)
  let mejor = { i: 0, t: 0, d: Infinity }
  for (let i = 0; i < tramos.length; i++) {
    const a = paradas[i]
    const b = paradas[i + 1]
    // proyección del punto sobre el segmento (en grados, suficiente para elegir el tramo)
    const vx = b.lng - a.lng
    const vy = b.lat - a.lat
    const largo2 = vx * vx + vy * vy || 1e-12
    const t = Math.max(0, Math.min(1, ((pos.lng - a.lng) * vx + (pos.lat - a.lat) * vy) / largo2))
    const cerca = { lat: a.lat + vy * t, lng: a.lng + vx * t }
    const d = distanciaKm(pos, cerca)
    if (d < mejor.d) mejor = { i, t, d }
  }
  const recorrido = tramos.slice(0, mejor.i).reduce((a, b) => a + b, 0) + tramos[mejor.i] * mejor.t
  return {
    ultimaParada: mejor.t >= 0.98 ? mejor.i + 1 : mejor.i,
    kmRestantes: Math.max(0, total - recorrido),
    fraccion: total > 0 ? recorrido / total : 0,
  }
}

/** Minutos de retraso reportados por el conductor u operador (último RETRASO con detalle.minutos). */
export function minutosDeRetraso(novedades: Novedad[]): number {
  const retrasos = novedades
    .filter((n) => n.tipo === 'RETRASO')
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  const ultimo = retrasos.at(-1)
  const m = Number((ultimo?.detalle as { minutos?: unknown } | null)?.minutos)
  return Number.isFinite(m) && m > 0 ? Math.round(m) : 0
}

/** Segundos desde la última señal del bus (para "En vivo · hace 4 s" o "Sin señal"). */
export function segundosDesde(pos: Posicion | null, ahora: number): number | null {
  if (!pos) return null
  return Math.max(0, Math.round((ahora - new Date(pos.timestamp).getTime()) / 1000))
}

export function haceCuanto(segundos: number): string {
  if (segundos < 60) return `${segundos} s`
  const min = Math.round(segundos / 60)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  return `${h} h ${String(min % 60).padStart(2, '0')}`
}

/** Rumbo en grados (0 = norte) entre dos puntos, para simular el GPS. */
export function rumbo(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180
  const y = Math.sin((b.lng - a.lng) * rad) * Math.cos(b.lat * rad)
  const x = Math.cos(a.lat * rad) * Math.sin(b.lat * rad) - Math.sin(a.lat * rad) * Math.cos(b.lat * rad) * Math.cos((b.lng - a.lng) * rad)
  return ((Math.atan2(y, x) / rad) + 360) % 360
}

/** Punto a una fracción 0..1 del recorrido completo (simulador del panel de la empresa). */
export function puntoEnRuta(paradas: { lat: number; lng: number }[], fraccion: number): { lat: number; lng: number; rumbo: number } {
  const tramos = paradas.slice(1).map((p, i) => distanciaKm(paradas[i], p))
  const total = tramos.reduce((a, b) => a + b, 0)
  let objetivo = Math.max(0, Math.min(1, fraccion)) * total
  for (let i = 0; i < tramos.length; i++) {
    if (objetivo <= tramos[i] || i === tramos.length - 1) {
      const t = tramos[i] > 0 ? Math.min(1, objetivo / tramos[i]) : 1
      const a = paradas[i]
      const b = paradas[i + 1]
      return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t, rumbo: rumbo(a, b) }
    }
    objetivo -= tramos[i]
  }
  const ultima = paradas[paradas.length - 1]
  return { ...ultima, rumbo: 0 }
}
