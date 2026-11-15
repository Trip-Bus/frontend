import { fechaParaApi, sumarDias } from '@/lib/formato'
import type { FiltrosBusqueda } from '@/lib/tipos'

/** Lo que el pasajero quiere buscar. La fecha va como YYYY-MM-DD en hora de Colombia. */
export type Busqueda = {
  origen: string
  destino: string
  fecha: string
  pasajeros: number
}

const CLAVE_ULTIMA = 'tripbus.busqueda'
const CLAVE_RECIENTES = 'tripbus.recientes'

export function hoy(): string {
  return fechaParaApi(new Date())
}

export function busquedaInicial(): Busqueda {
  const guardada = leer<Busqueda>(CLAVE_ULTIMA)
  const manana = sumarDias(hoy(), 1)
  if (guardada && guardada.origen && guardada.destino) {
    // Nunca proponer una fecha pasada.
    return { ...guardada, fecha: guardada.fecha >= hoy() ? guardada.fecha : manana }
  }
  return { origen: 'Bogotá', destino: 'Medellín', fecha: manana, pasajeros: 1 }
}

/** Recuerda la búsqueda (conveniencia por dispositivo; si el navegador no deja guardar, no pasa nada). */
export function recordarBusqueda(b: Busqueda) {
  escribir(CLAVE_ULTIMA, b)
  const ruta = { origen: b.origen, destino: b.destino }
  const previas = (leer<{ origen: string; destino: string }[]>(CLAVE_RECIENTES) ?? []).filter(
    (r) => !(r.origen === ruta.origen && r.destino === ruta.destino),
  )
  escribir(CLAVE_RECIENTES, [ruta, ...previas].slice(0, 6))
}

export function rutasRecientes(): { origen: string; destino: string }[] {
  return leer<{ origen: string; destino: string }[]>(CLAVE_RECIENTES) ?? []
}

export function aParametros(b: Busqueda): string {
  return new URLSearchParams({
    origen: b.origen,
    destino: b.destino,
    fecha: b.fecha,
    pasajeros: String(b.pasajeros),
  }).toString()
}

export function desdeParametros(p: URLSearchParams): Busqueda | null {
  const origen = p.get('origen')
  const destino = p.get('destino')
  const fecha = p.get('fecha')
  if (!origen || !destino || !fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null
  const pasajeros = Math.min(6, Math.max(1, Number(p.get('pasajeros')) || 1))
  return { origen, destino, fecha, pasajeros }
}

function leer<T>(clave: string): T | null {
  try {
    const v = globalThis.localStorage?.getItem(clave)
    return v ? (JSON.parse(v) as T) : null
  } catch {
    return null
  }
}

function escribir(clave: string, valor: unknown) {
  try {
    globalThis.localStorage?.setItem(clave, JSON.stringify(valor))
  } catch {
    /* sin almacenamiento disponible */
  }
}

/** Filtros de la pantalla de salidas (P-01). */
export type Filtros = Pick<FiltrosBusqueda, 'companyId' | 'franja' | 'precioMin' | 'precioMax' | 'tipoBus' | 'sort' | 'order'>

/** Cuántos filtros hay activos (para el botón "Filtros · 2"). */
export function cuantosFiltros(f: Filtros): number {
  return [f.companyId, f.franja, f.precioMin, f.precioMax, f.tipoBus].filter((x) => x != null && x !== '').length
}

/** Ruta de los puestos de un resultado: con el tramo (US-142) si la búsqueda encontró uno intermedio. */
export function rutaAsientos(v: { itineraryId: string; fromOrden?: number; toOrden?: number }, pasajeros: number): string {
  const p = new URLSearchParams({ pasajeros: String(pasajeros) })
  if (v.fromOrden != null && v.toOrden != null) {
    p.set('desde', String(v.fromOrden))
    p.set('hasta', String(v.toOrden))
  }
  return `/viaje/${v.itineraryId}/asientos?${p}`
}
