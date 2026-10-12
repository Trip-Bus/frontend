import type { PasajeroRequest, Retencion, Uuid } from '@/lib/tipos'

/**
 * Lo que el teléfono recuerda entre pantallas (conveniencia por dispositivo):
 *  - la retención activa de cada viaje, para volver a ella si el pasajero sale y regresa
 *    (la API de estados dice "propio: true" pero no devuelve el holdId);
 *  - los datos del último viajero, para no escribirlos dos veces.
 * Si el navegador no deja guardar, todo sigue funcionando sin esto.
 */

export type RetencionGuardada = {
  holdId: Uuid
  itineraryId: Uuid
  seatNumbers: string[]
  expiraEn: string
  offerId: Uuid | null
}

const CLAVE_RETENCIONES = 'tripbus.retenciones'
const CLAVE_VIAJERO = 'tripbus.viajero'

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
    if (valor == null) globalThis.localStorage?.removeItem(clave)
    else globalThis.localStorage?.setItem(clave, JSON.stringify(valor))
  } catch {
    /* sin almacenamiento */
  }
}

function vigentes(): RetencionGuardada[] {
  const ahora = Date.now()
  return (leer<RetencionGuardada[]>(CLAVE_RETENCIONES) ?? []).filter((r) => new Date(r.expiraEn).getTime() > ahora)
}

export function recordarRetencion(r: Retencion) {
  const resto = vigentes().filter((x) => x.holdId !== r.holdId && x.itineraryId !== r.itineraryId)
  escribir(CLAVE_RETENCIONES, [
    { holdId: r.holdId, itineraryId: r.itineraryId, seatNumbers: r.seatNumbers, expiraEn: r.expiraEn, offerId: r.offerId },
    ...resto,
  ])
}

export function retencionDeViaje(itineraryId: Uuid): RetencionGuardada | null {
  return vigentes().find((r) => r.itineraryId === itineraryId) ?? null
}

export function olvidarRetencion(holdId: Uuid) {
  escribir(
    CLAVE_RETENCIONES,
    vigentes().filter((r) => r.holdId !== holdId),
  )
}

export function ultimoViajero(): PasajeroRequest | null {
  return leer<PasajeroRequest>(CLAVE_VIAJERO)
}

export function recordarViajero(p: PasajeroRequest) {
  escribir(CLAVE_VIAJERO, p)
}
