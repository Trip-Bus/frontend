/**
 * Tarjeta de crédito en el navegador.
 *
 * Regla dura del backend: el número completo NUNCA sale del teléfono. Booking + Payment solo
 * recibe un `cardToken` (lo que entregaría la pasarela real al tokenizar) y los últimos 4 dígitos.
 * En el MVP la pasarela es el sandbox de booking-payment-service: aprueba cualquier token salvo
 * los que contienen "declined". Para la demo se usan las tarjetas de prueba de siempre:
 *   4242 4242 4242 4242 → aprobada · 4000 0000 0000 0002 → rechazada (fondos insuficientes)
 */

export type Marca = 'visa' | 'mastercard' | 'amex' | 'diners' | 'otra'

export const TARJETA_RECHAZADA = '4000000000000002'

export function soloDigitos(v: string): string {
  return v.replace(/\D/g, '')
}

export function marcaDe(numero: string): Marca {
  const n = soloDigitos(numero)
  if (/^4/.test(n)) return 'visa'
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(n)) return 'mastercard'
  if (/^3[47]/.test(n)) return 'amex'
  if (/^3(0[0-5]|[68])/.test(n)) return 'diners'
  return 'otra'
}

export const NOMBRE_MARCA: Record<Marca, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  diners: 'Diners Club',
  otra: 'Tarjeta',
}

/** "4242424242424242" → "4242 4242 4242 4242" (Amex: 4-6-5). */
export function formatearNumero(v: string): string {
  const n = soloDigitos(v).slice(0, 19)
  if (marcaDe(n) === 'amex') {
    return [n.slice(0, 4), n.slice(4, 10), n.slice(10, 15)].filter(Boolean).join(' ')
  }
  return n.replace(/(.{4})/g, '$1 ').trim()
}

/** "1228" → "12/28" mientras se escribe. */
export function formatearVence(v: string): string {
  const n = soloDigitos(v).slice(0, 4)
  return n.length > 2 ? `${n.slice(0, 2)}/${n.slice(2)}` : n
}

export function luhnValido(numero: string): boolean {
  const n = soloDigitos(numero)
  if (n.length < 13 || n.length > 19) return false
  let suma = 0
  for (let i = 0; i < n.length; i++) {
    let d = Number(n[n.length - 1 - i])
    if (i % 2 === 1) {
      d *= 2
      if (d > 9) d -= 9
    }
    suma += d
  }
  return suma % 10 === 0
}

/** MM/AA vigente a la fecha `hoy`. */
export function venceValido(v: string, hoy: Date = new Date()): boolean {
  const n = soloDigitos(v)
  if (n.length !== 4) return false
  const mes = Number(n.slice(0, 2))
  const anio = 2000 + Number(n.slice(2))
  if (mes < 1 || mes > 12) return false
  const fin = new Date(anio, mes, 1) // primer día del mes siguiente
  return fin > hoy
}

export function cvcValido(cvc: string, marca: Marca): boolean {
  const n = soloDigitos(cvc)
  return marca === 'amex' ? n.length === 4 : n.length === 3
}

export type ErroresTarjeta = Partial<Record<'numero' | 'vence' | 'cvc', string>>

export function validarTarjeta(numero: string, vence: string, cvc: string, hoy?: Date): ErroresTarjeta {
  const e: ErroresTarjeta = {}
  if (!luhnValido(numero)) e.numero = 'Revisa el número de la tarjeta.'
  if (!venceValido(vence, hoy)) e.vence = soloDigitos(vence).length === 4 ? 'La tarjeta está vencida.' : 'Escribe mes y año (MM/AA).'
  if (!cvcValido(cvc, marcaDe(numero))) e.cvc = marcaDe(numero) === 'amex' ? 'Son 4 dígitos.' : 'Son 3 dígitos.'
  return e
}

/**
 * Lo que la pasarela devolvería al tokenizar. En el sandbox el token decide el resultado:
 * la tarjeta de prueba de rechazo produce `tok_<marca>_declined`; las demás, `tok_<marca>_approved`.
 */
export function tokenSandbox(numero: string): { cardToken: string; cardLast4: string; cardBrand: string } {
  const n = soloDigitos(numero)
  const marca = marcaDe(n)
  const resultado = n === TARJETA_RECHAZADA ? 'declined' : 'approved'
  return { cardToken: `tok_${marca}_${resultado}`, cardLast4: n.slice(-4), cardBrand: NOMBRE_MARCA[marca] }
}
