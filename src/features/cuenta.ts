import type { MfaRequerido, RespuestaLogin } from '@/lib/tipos'

/**
 * Reglas de la cuenta (Identity): las mismas validaciones del backend para avisar antes de enviar.
 * Funciones puras (sin React) para probarlas con Vitest.
 */

/** US-106: el login respondió el desafío de la verificación en dos pasos en vez de los tokens. */
export function esMfaRequerido(r: RespuestaLogin): r is MfaRequerido {
  return 'mfaRequired' in r && r.mfaRequired === true
}

/** Igual que RegistroRequest / CambiarPasswordRequest: ≥ 8 caracteres, una mayúscula y un número. */
export function passwordValida(p: string): boolean {
  return p.length >= 8 && /[A-Z]/.test(p) && /\d/.test(p)
}

/** US-128: vacío (se borra) o celular colombiano: 10 dígitos que empiezan por 3. */
export function telefonoValido(t: string): boolean {
  const limpio = t.replace(/[\s-]/g, '')
  return limpio === '' || /^3\d{9}$/.test(limpio)
}

/** Teléfono para la API: sin espacios ni guiones; vacío = null (lo borra). */
export function telefonoParaApi(t: string): string | null {
  const limpio = t.replace(/[\s-]/g, '')
  return limpio === '' ? null : limpio
}

/** Lo que escribe la persona en el código de la app ("123 456") → "123456". */
export function normalizarCodigo(c: string): string {
  return c.replace(/[\s-]/g, '')
}

/** Código TOTP de la app: 6 dígitos. */
export function codigoTotpValido(c: string): boolean {
  return /^\d{6}$/.test(normalizarCodigo(c))
}

/** Secreto TOTP en grupos de 4 para escribirlo a mano sin perderse: "JBSW Y3DP EHPK 3PXP". */
export function secretoLegible(secret: string): string {
  return secret.replace(/\s/g, '').replace(/(.{4})(?=.)/g, '$1 ')
}

/** US-131: nombre del archivo con mis datos, con la fecha de Colombia (UTC-5, sin horario de verano). */
export function nombreArchivoMisDatos(ahora: Date = new Date()): string {
  const colombia = new Date(ahora.getTime() - 5 * 3600 * 1000)
  return `tripbus-mis-datos-${colombia.toISOString().slice(0, 10)}.json`
}

/** Los códigos de recuperación como texto para copiar o guardar en un archivo. */
export function textoCodigosRecuperacion(codigos: string[], correo?: string): string {
  const titulo = `TripBus · códigos de recuperación${correo ? ` de ${correo}` : ''}`
  return [titulo, 'Cada código sirve una sola vez para entrar sin la app.', '', ...codigos, ''].join('\n')
}

/** Confirmación para eliminar la cuenta: hay que escribir ELIMINAR (sin importar mayúsculas ni espacios). */
export function confirmaEliminar(texto: string): boolean {
  return texto.trim().toUpperCase() === 'ELIMINAR'
}
