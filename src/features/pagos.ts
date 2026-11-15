import { nuevaClaveIdempotencia } from '@/lib/api'

/**
 * Idempotency-Key por intento de pago (US-034). Se guarda por reserva en sessionStorage para que
 * un reintento (doble toque, red que se cae, recargar la página) reutilice la MISMA clave y el
 * backend cobre una sola vez. Si el navegador no deja guardar, se usa una clave en memoria.
 */
const enMemoria = new Map<string, string>()
const clave = (bookingId: string) => `tripbus.pago.${bookingId}`

export function claveDePago(bookingId: string): string {
  try {
    const guardada = globalThis.sessionStorage?.getItem(clave(bookingId))
    if (guardada) return guardada
    const nueva = nuevaClaveIdempotencia()
    globalThis.sessionStorage?.setItem(clave(bookingId), nueva)
    return nueva
  } catch {
    let v = enMemoria.get(bookingId)
    if (!v) {
      v = nuevaClaveIdempotencia()
      enMemoria.set(bookingId, v)
    }
    return v
  }
}

export const ESTADOS_EN_PROCESO = new Set(['PAGO_EN_PROCESO', 'PAGO_APROBADO'])

export const MOTIVOS_RECHAZO: Record<string, string> = {
  FONDOS_INSUFICIENTES: 'La tarjeta no tiene fondos suficientes.',
  TARJETA_RECHAZADA: 'El banco no aprobó la tarjeta.',
  PUESTO_PERDIDO: 'El puesto se liberó antes de que llegara la aprobación. Te devolvemos el dinero.',
}
