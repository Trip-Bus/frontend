import { describe, expect, it } from 'vitest'
import { codigoCiudad } from './ciudades'
import { formatearNumero, formatearVence, luhnValido, marcaDe, tokenSandbox, validarTarjeta, venceValido } from './tarjeta'

describe('tarjeta', () => {
  it('valida con Luhn', () => {
    expect(luhnValido('4242 4242 4242 4242')).toBe(true)
    expect(luhnValido('4000 0000 0000 0002')).toBe(true)
    expect(luhnValido('4242 4242 4242 4241')).toBe(false)
    expect(luhnValido('123')).toBe(false)
  })

  it('detecta la marca y formatea', () => {
    expect(marcaDe('4242')).toBe('visa')
    expect(marcaDe('5555 5555')).toBe('mastercard')
    expect(marcaDe('3782')).toBe('amex')
    expect(formatearNumero('4242424242424242')).toBe('4242 4242 4242 4242')
    expect(formatearNumero('378282246310005')).toBe('3782 822463 10005')
    expect(formatearVence('1228')).toBe('12/28')
    expect(formatearVence('1')).toBe('1')
  })

  it('valida la fecha de vencimiento', () => {
    const hoy = new Date('2026-10-12T12:00:00Z')
    expect(venceValido('10/26', hoy)).toBe(true)
    expect(venceValido('09/26', hoy)).toBe(false)
    expect(venceValido('13/30', hoy)).toBe(false)
    expect(validarTarjeta('4242424242424242', '12/30', '123', hoy)).toEqual({})
    expect(Object.keys(validarTarjeta('4242', '01/20', '1', hoy))).toEqual(['numero', 'vence', 'cvc'])
  })

  it('nunca manda el número: solo token sandbox y últimos 4', () => {
    expect(tokenSandbox('4242 4242 4242 4242')).toEqual({ cardToken: 'tok_visa_approved', cardLast4: '4242', cardBrand: 'Visa' })
    expect(tokenSandbox('4000 0000 0000 0002').cardToken).toBe('tok_visa_declined')
    expect(JSON.stringify(tokenSandbox('4242424242424242'))).not.toContain('424242424242')
  })

  it('códigos de ciudad', () => {
    expect(codigoCiudad('Medellín')).toBe('MDE')
    expect(codigoCiudad('bogota')).toBe('BOG')
    expect(codigoCiudad('San Gil')).toBe('SAN')
    expect(codigoCiudad('')).toBe('—')
  })
})
