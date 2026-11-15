import { describe, expect, it } from 'vitest'
import {
  diasDespues,
  dinero,
  dineroCorto,
  duracion,
  fechaCorta,
  fechaDesdeApi,
  fechaParaApi,
  horaCorta,
  iniciales,
  nombreCiudad,
  plural,
  reloj,
  sumarDias,
} from './formato'

describe('formato', () => {
  it('formatea pesos sin decimales y sin espacios', () => {
    expect(dinero(85000)).toBe('$85.000')
    expect(dinero(1284000)).toBe('$1.284.000')
    expect(dinero(null)).toBe('—')
    expect(dinero(Number.NaN)).toBe('—')
  })

  it('abrevia precios solo para chips', () => {
    expect(dineroCorto(79000)).toBe('$79k')
    expect(dineroCorto(1_284_000)).toBe('$1,3M')
  })

  it('muestra la hora en Colombia aunque el servidor mande UTC', () => {
    expect(horaCorta('2026-10-09T10:30:00Z')).toBe('05:30')
    expect(horaCorta('2026-10-10T04:59:00Z')).toBe('23:59')
  })

  it('calcula el día de la búsqueda en hora de Colombia', () => {
    // 11:30 p. m. del 8 en Bogotá ya es 9 en UTC
    expect(fechaParaApi(new Date('2026-10-09T04:30:00Z'))).toBe('2026-10-08')
    expect(sumarDias('2026-10-31', 1)).toBe('2026-11-01')
  })

  it('detecta llegadas al día siguiente', () => {
    expect(diasDespues('2026-10-10T02:00:00Z', '2026-10-10T10:20:00Z')).toBe(1) // 21:00 → 05:20
    expect(diasDespues('2026-10-09T10:30:00Z', '2026-10-09T19:10:00Z')).toBe(0)
  })

  it('fecha corta sin puntos ni "de"', () => {
    expect(fechaCorta(fechaDesdeApi('2026-10-09'))).toBe('vie 9 oct')
  })

  it('formatea duraciones', () => {
    expect(duracion(520)).toBe('8 h 40')
    expect(duracion(480)).toBe('8 h')
    expect(duracion(45)).toBe('45 min')
    expect(duracion(-1)).toBe('—')
  })

  it('usa plurales reales', () => {
    expect(plural(1, 'salida', 'salidas')).toBe('1 salida')
    expect(plural(0, 'salida', 'salidas')).toBe('0 salidas')
    expect(plural(1284, 'puesto', 'puestos')).toBe('1.284 puestos')
  })

  it('cuenta regresiva', () => {
    expect(reloj(522)).toBe('8:42')
    expect(reloj(-3)).toBe('0:00')
  })

  it('saca iniciales del peor caso', () => {
    expect(iniciales('Ana Pérez')).toBe('AP')
    expect(iniciales('Jo')).toBe('J')
    expect(iniciales('Christopher Alexander Montgomery III')).toBe('CI')
    expect(iniciales('  Sam   Lee ')).toBe('SL')
    expect(iniciales('Ólafur Darri Ólafsson')).toBe('ÓÓ')
    expect(iniciales('🦊 Fox')).toBe('🦊F')
    expect(iniciales('')).toBe('?')
  })

  it('normaliza ciudades sin tildes', () => {
    expect(nombreCiudad('bogota', ['Bogotá', 'Medellín'])).toBe('Bogotá')
    expect(nombreCiudad('MEDELLIN', ['Bogotá', 'Medellín'])).toBe('Medellín')
    expect(nombreCiudad('tunja')).toBe('Tunja')
  })
})
