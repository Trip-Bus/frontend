import { describe, expect, it } from 'vitest'
import {
  codigoTotpValido,
  confirmaEliminar,
  esMfaRequerido,
  nombreArchivoMisDatos,
  normalizarCodigo,
  passwordValida,
  secretoLegible,
  telefonoParaApi,
  telefonoValido,
  textoCodigosRecuperacion,
} from './cuenta'

describe('cuenta (Identity)', () => {
  it('distingue el desafío de 2FA de los tokens del login', () => {
    expect(esMfaRequerido({ mfaRequired: true, mfaToken: 'abc' })).toBe(true)
    expect(esMfaRequerido({ accessToken: 't', expiresAt: '2026-11-09T00:00:00Z', userId: 'u', rol: 'ADMIN' })).toBe(false)
  })

  it('valida la contraseña con las reglas de Identity', () => {
    expect(passwordValida('Passw0rd1')).toBe(true)
    expect(passwordValida('passw0rd1')).toBe(false)
    expect(passwordValida('Password')).toBe(false)
    expect(passwordValida('Pa0')).toBe(false)
  })

  it('acepta un celular colombiano o vacío', () => {
    expect(telefonoValido('3001234567')).toBe(true)
    expect(telefonoValido('300 123 4567')).toBe(true)
    expect(telefonoValido('')).toBe(true)
    expect(telefonoValido('6011234567')).toBe(false)
    expect(telefonoValido('30012345')).toBe(false)
    expect(telefonoParaApi(' 300-123-4567 ')).toBe('3001234567')
    expect(telefonoParaApi('  ')).toBeNull()
  })

  it('normaliza y valida el código de la app', () => {
    expect(normalizarCodigo('123 456')).toBe('123456')
    expect(codigoTotpValido('123 456')).toBe(true)
    expect(codigoTotpValido('12345')).toBe(false)
    expect(codigoTotpValido('12345a')).toBe(false)
  })

  it('agrupa el secreto de 4 en 4', () => {
    expect(secretoLegible('JBSWY3DPEHPK3PXP')).toBe('JBSW Y3DP EHPK 3PXP')
    expect(secretoLegible('ABCDE')).toBe('ABCD E')
  })

  it('nombra el archivo de mis datos con la fecha de Colombia', () => {
    // 03:00 UTC del 10 de noviembre = 22:00 del 9 en Colombia.
    expect(nombreArchivoMisDatos(new Date('2026-11-10T03:00:00Z'))).toBe('tripbus-mis-datos-2026-11-09.json')
  })

  it('arma el texto de los códigos de recuperación', () => {
    const t = textoCodigosRecuperacion(['aaaa-bbbb', 'cccc-dddd'], 'ana@tripbus.co')
    expect(t).toContain('ana@tripbus.co')
    expect(t.split('\n')).toContain('cccc-dddd')
  })

  it('pide escribir ELIMINAR para borrar la cuenta', () => {
    expect(confirmaEliminar(' eliminar ')).toBe(true)
    expect(confirmaEliminar('borrar')).toBe(false)
  })
})
