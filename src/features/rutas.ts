import type { ParadaRuta, PrecioTramo } from '@/lib/tipos'

/** Mismas reglas que catalog (US-114), para avisar antes de enviar. Devuelve el primer problema o null. */
export function validarParadas(origen: string, destino: string, paradas: ParadaRuta[]): string | null {
  if (!origen.trim() || !destino.trim()) return 'Escribe el origen y el destino.'
  if (origen.trim().toLowerCase() === destino.trim().toLowerCase()) return 'El origen y el destino deben ser distintos.'
  if (paradas.length < 2) return 'La ruta necesita al menos 2 paradas: el origen y el destino.'
  if (paradas.some((p) => !p.nombre.trim())) return 'Cada parada necesita un nombre.'
  if (paradas[0].minutosDesdeSalida !== 0) return 'La primera parada sale en el minuto 0.'
  for (let i = 1; i < paradas.length; i++) {
    if (!(paradas[i].minutosDesdeSalida > paradas[i - 1].minutosDesdeSalida)) return `Los minutos deben crecer: revisa la parada ${i + 1}.`
  }
  const fuera = paradas.findIndex((p) => !(p.lat >= -4.3 && p.lat <= 13.5 && p.lng >= -79.1 && p.lng <= -66.8))
  if (fuera >= 0) return `La parada ${fuera + 1} queda por fuera de Colombia: revisa la latitud y la longitud.`
  return null
}

/** El orden de las paradas siempre es consecutivo desde 1. */
export function renumerar(paradas: ParadaRuta[]): ParadaRuta[] {
  return paradas.map((p, i) => ({ ...p, orden: i + 1 }))
}

/** Precios por tramo válidos: de una parada a otra posterior, sin repetir, sin el recorrido completo y > 0. */
export function validarPreciosTramo(precios: PrecioTramo[], paradas: number): string | null {
  const vistos = new Set<string>()
  for (const p of precios) {
    if (!(p.desdeOrden >= 1 && p.hastaOrden <= paradas && p.desdeOrden < p.hastaOrden)) return 'Cada tramo va de una parada a otra posterior.'
    if (p.desdeOrden === 1 && p.hastaOrden === paradas) return 'El recorrido completo usa el precio base del viaje.'
    if (!(p.precio > 0)) return 'El precio de cada tramo debe ser mayor que 0.'
    const k = `${p.desdeOrden}-${p.hastaOrden}`
    if (vistos.has(k)) return 'Hay tramos repetidos.'
    vistos.add(k)
  }
  return null
}
