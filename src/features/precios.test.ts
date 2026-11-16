import { describe, expect, it } from 'vitest'
import type { EmpresaFaceta, ResultadoViaje } from '@/lib/tipos'
import {
  agruparEmpresas,
  esBogota,
  estadoDia,
  filtroDeRango,
  filtrosDelCalendario,
  indiceMasBarato,
  limitesDe,
  nombreTipoBus,
  pasoAbajo,
  pasoArriba,
  precioDe,
  rangoElegido,
  recortarPrecio,
  valorEnPosicion,
} from './precios'

const viaje = (v: Partial<ResultadoViaje>): ResultadoViaje => ({
  itineraryId: 'i',
  routeId: 'r',
  busId: 'b',
  empresa: 'E',
  origen: 'Bogotá',
  destino: 'Tunja',
  fechaSalida: '2099-01-10T11:00:00Z',
  fechaLlegadaEstimada: '2099-01-10T14:00:00Z',
  duracionMinutos: 180,
  precioBase: 50_000,
  moneda: 'COP',
  tipoBus: 'UN_PISO',
  capacidad: 40,
  asientosDisponibles: 10,
  agotado: false,
  ofertaActiva: null,
  ...v,
})

const L = { min: 45_500, max: 85_500 }

describe('precio de un resultado y del día', () => {
  it('usa precioDesde y, si no viene, el del tramo, la oferta o el base', () => {
    expect(precioDe(viaje({ precioDesde: 41_000, precio: 30_000 }))).toBe(41_000)
    expect(precioDe(viaje({ precio: 30_000 }))).toBe(30_000)
    expect(precioDe(viaje({ ofertaActiva: { offerId: 'o', precioOferta: 35_000 } as ResultadoViaje['ofertaActiva'] }))).toBe(35_000)
    expect(precioDe(viaje({}))).toBe(50_000)
  })

  it('el calendario lleva tramos y los filtros activos, sin precio ni orden', () => {
    expect(filtrosDelCalendario({ companyId: 'c', franja: 'NOCHE', tipoBus: 'DOS_PISOS', precioMin: 1, sort: 'precio' })).toEqual({
      tramos: true,
      companyId: 'c',
      franja: 'NOCHE',
      tipoBus: 'DOS_PISOS',
    })
  })

  it('estado de cada día: cargando, sin salidas, lleno o precio', () => {
    expect(estadoDia(undefined)).toEqual({ tipo: 'cargando' })
    expect(estadoDia({ fecha: 'f', precioMinimo: null, viajes: 0, hayCupo: null })).toEqual({ tipo: 'sin-salidas' })
    expect(estadoDia({ fecha: 'f', precioMinimo: null, viajes: 2, hayCupo: false })).toEqual({ tipo: 'lleno' })
    expect(estadoDia({ fecha: 'f', precioMinimo: 85_500, viajes: 2, hayCupo: true })).toEqual({ tipo: 'precio', precio: 85_500 })
  })

  it('"Más barato" es la primera tarjeta con cupo que tiene el precio del día', () => {
    const lista = [viaje({ precioDesde: 45_500, agotado: true }), viaje({ precioDesde: 60_000 }), viaje({ precioDesde: 45_500 })]
    expect(indiceMasBarato(lista, 45_500)).toBe(2)
    expect(indiceMasBarato(lista, null)).toBe(-1)
    expect(indiceMasBarato(lista, 1)).toBe(-1)
  })
})

describe('rango de precio', () => {
  it('límites de las facetas', () => {
    expect(limitesDe(undefined)).toBeNull()
    expect(limitesDe({ precioMin: null, precioMax: null })).toBeNull()
    expect(limitesDe({ precioMin: 50_000, precioMax: 40_000 })).toEqual({ min: 40_000, max: 50_000 })
  })

  it('pasos de 1.000 que ajustan los extremos al valor real', () => {
    expect(pasoArriba(45_500, L)).toBe(46_000)
    expect(pasoArriba(85_200, L)).toBe(85_500)
    expect(pasoArriba(85_500, L)).toBe(85_500)
    expect(pasoArriba(45_500, L, 10)).toBe(55_000)
    expect(pasoAbajo(46_000, L)).toBe(45_500)
    expect(pasoAbajo(85_500, L)).toBe(85_000)
    expect(pasoAbajo(55_000, L, 10)).toBe(45_500)
    expect(pasoAbajo(45_500, L)).toBe(45_500)
  })

  it('posición en la barra: múltiplo de 1.000 o el extremo real más cercano', () => {
    expect(valorEnPosicion(0, L)).toBe(45_500)
    expect(valorEnPosicion(0.004, L)).toBe(45_500)
    expect(valorEnPosicion(0.5, L)).toBe(66_000)
    expect(valorEnPosicion(0.996, L)).toBe(85_500)
    expect(valorEnPosicion(2, L)).toBe(85_500)
    expect(valorEnPosicion(-1, L)).toBe(45_500)
  })

  it('rango elegido y filtro: en los extremos no se envía min ni max', () => {
    expect(rangoElegido({}, L)).toEqual([45_500, 85_500])
    expect(rangoElegido({ precioMin: 90_000, precioMax: 10_000 }, L)).toEqual([45_500, 85_500])
    expect(rangoElegido({ precioMin: 70_000, precioMax: 60_000 }, L)).toEqual([60_000, 70_000])
    expect(filtroDeRango([45_500, 85_500], L)).toEqual({ precioMin: undefined, precioMax: undefined })
    expect(filtroDeRango([50_000, 60_000], L)).toEqual({ precioMin: 50_000, precioMax: 60_000 })
  })

  it('recorta el precio elegido al cambiar de día o de ruta', () => {
    const f = { franja: 'NOCHE' as const, precioMin: 40_000, precioMax: 70_000 }
    expect(recortarPrecio(f, undefined)).toBe(f)
    expect(recortarPrecio({ franja: 'NOCHE' }, { precioMin: 1, precioMax: 2 })).toEqual({ franja: 'NOCHE' })
    expect(recortarPrecio(f, { precioMin: 30_000, precioMax: 90_000 })).toBe(f)
    expect(recortarPrecio(f, { precioMin: 50_000, precioMax: 60_000 })).toEqual({ franja: 'NOCHE', precioMin: undefined, precioMax: undefined })
    expect(recortarPrecio(f, { precioMin: 50_000, precioMax: 90_000 })).toEqual({ franja: 'NOCHE', precioMin: undefined, precioMax: 70_000 })
    expect(recortarPrecio(f, { precioMin: 55_000, precioMax: 55_000 })).toEqual({ franja: 'NOCHE', precioMin: undefined, precioMax: undefined })
    expect(recortarPrecio(f, { precioMin: null, precioMax: null })).toEqual({ franja: 'NOCHE', precioMin: undefined, precioMax: undefined })
  })
})

describe('empresas y tipos de bus', () => {
  const e = (id: string, nombre: string, terminal: string | null, viajes = 1): EmpresaFaceta => ({ id, nombre, terminal, viajes })
  const empresas = [e('1', 'Bolivariano', 'Terminal Salitre'), e('2', 'Copetrán', 'Terminal del Norte'), e('3', 'Duitama', null, 0), e('4', 'Flota Sur', 'Terminal Sur'), e('5', 'Rápido', 'Terminal Salitre')]

  it('desde Bogotá agrupa por terminal: Salitre, del Norte, las demás y "Otras"', () => {
    const grupos = agruparEmpresas(empresas, 'Bogotá')
    expect(grupos.map((g) => g.terminal)).toEqual(['Terminal Salitre', 'Terminal del Norte', 'Terminal Sur', 'Otras'])
    expect(grupos[0].empresas.map((x) => x.nombre)).toEqual(['Bolivariano', 'Rápido'])
  })

  it('desde otra ciudad un solo grupo; el buscador ignora tildes y mayúsculas', () => {
    expect(agruparEmpresas(empresas, 'Tunja')).toEqual([{ terminal: null, empresas }])
    expect(agruparEmpresas(empresas, 'Bogota D.C.', 'COPETRAN')).toEqual([{ terminal: 'Terminal del Norte', empresas: [empresas[1]] }])
    expect(agruparEmpresas(empresas, 'Bogotá', 'zzz')).toEqual([])
    expect(esBogota('  BOGOTÁ ')).toBe(true)
    expect(esBogota('Medellín')).toBe(false)
  })

  it('nombres de los tipos de bus', () => {
    expect(nombreTipoBus('UN_PISO')).toBe('Un piso')
    expect(nombreTipoBus('DOS_PISOS')).toBe('Dos pisos')
    expect(nombreTipoBus('MINI_VAN')).toBe('Mini van')
  })
})
