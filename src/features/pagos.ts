import { nuevaClaveIdempotencia } from '@/lib/api'
import type { DatosPse } from '@/lib/tipos'

/**
 * Idempotency-Key por intento de pago (US-034). Se guarda por reserva y método en sessionStorage para que
 * un reintento (doble toque, red que se cae, volver del banco, recargar la página) reutilice la MISMA clave
 * y el backend cobre una sola vez. Si el navegador no deja guardar, se usa una clave en memoria.
 */
const enMemoria = new Map<string, string>()
/** La tarjeta conserva la clave histórica; PSE y Nequi tienen la suya (otro cuerpo es otro intento). */
const clave = (bookingId: string, metodo: string) =>
  metodo === 'TARJETA' ? `tripbus.pago.${bookingId}` : `tripbus.pago.${bookingId}.${metodo}`

export function claveDePago(bookingId: string, metodo = 'TARJETA'): string {
  const k = clave(bookingId, metodo)
  try {
    const guardada = globalThis.sessionStorage?.getItem(k)
    if (guardada) return guardada
    const nueva = nuevaClaveIdempotencia()
    globalThis.sessionStorage?.setItem(k, nueva)
    return nueva
  } catch {
    let v = enMemoria.get(k)
    if (!v) {
      v = nuevaClaveIdempotencia()
      enMemoria.set(k, v)
    }
    return v
  }
}

/** Celular colombiano de 10 dígitos que empieza por 3 (Nequi). */
export function celularValido(telefono: string): boolean {
  return /^3\d{9}$/.test(telefono)
}

export const ESTADOS_EN_PROCESO = new Set(['PAGO_EN_PROCESO', 'PAGO_APROBADO'])

export const MOTIVOS_RECHAZO: Record<string, string> = {
  FONDOS_INSUFICIENTES: 'La tarjeta no tiene fondos suficientes.',
  TARJETA_RECHAZADA: 'El banco no aprobó la tarjeta.',
  PUESTO_PERDIDO: 'El puesto se liberó antes de que llegara la aprobación. Te devolvemos el dinero.',
  RECHAZADO_POR_USUARIO: 'Rechazaste el pago en tu app.',
  NEQUI_RECHAZADO: 'Nequi no aprobó el pago.',
  PSE_RECHAZADO: 'El banco no aprobó el pago por PSE.',
  VENCIDO: 'El pago no se completó a tiempo.',
}

export type ErroresPse = Partial<Record<keyof DatosPse, string>>

export function validarPse(d: DatosPse): ErroresPse {
  const e: ErroresPse = {}
  if (!d.bancoCodigo) e.bancoCodigo = 'Elige tu banco.'
  if (!/^[A-Za-z0-9-]{4,20}$/.test(d.numeroDocumento.trim())) e.numeroDocumento = 'Entre 4 y 20 letras o números, sin espacios.'
  return e
}
