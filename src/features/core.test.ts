import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  aParametros,
  busquedaInicial,
  desdeParametros,
  recordarBusqueda,
  rutasRecientes,
} from './busqueda'
import { visualDe, ciudadesConFoto, tamanoTitulo, veloFoto } from './ciudadVisual'
import { ESTADOS_EN_PROCESO, claveDePago } from './pagos'
import { codigoReserva, guardarPase, paseGuardado, pasesGuardados } from './pases'
import { olvidarRetencion, recordarRetencion, recordarViajero, retencionDeViaje, ultimoViajero } from './retenciones'
import type { Retencion, Tiquete } from '@/lib/tipos'

function almacenamiento() {
  const datos = new Map<string, string>()
  return {
    getItem: (clave: string) => datos.get(clave) ?? null,
    setItem: (clave: string, valor: string) => datos.set(clave, valor),
    removeItem: (clave: string) => datos.delete(clave),
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', almacenamiento())
  vi.stubGlobal('sessionStorage', almacenamiento())
})

afterEach(() => vi.unstubAllGlobals())

describe('búsqueda guardada', () => {
  it('valida los parámetros y limita pasajeros entre uno y seis', () => {
    expect(desdeParametros(new URLSearchParams('origen=Bogota&destino=Cali&fecha=2026-11-15&pasajeros=9'))).toEqual({
      origen: 'Bogota',
      destino: 'Cali',
      fecha: '2026-11-15',
      pasajeros: 6,
    })
    expect(desdeParametros(new URLSearchParams('origen=Bogota&destino=Cali&fecha=ayer'))).toBeNull()
    expect(desdeParametros(new URLSearchParams('origen=Bogota&destino=Cali&fecha=2026-11-15&pasajeros=0'))?.pasajeros).toBe(1)
  })

  it('serializa la búsqueda y recuerda las seis rutas recientes sin duplicados', () => {
    const inicial = busquedaInicial()
    expect(desdeParametros(new URLSearchParams(aParametros(inicial)))).toEqual(inicial)
    for (let i = 0; i < 7; i += 1) {
      recordarBusqueda({ ...inicial, origen: `Origen ${i}`, destino: 'Destino' })
    }
    recordarBusqueda({ ...inicial, origen: 'Origen 6', destino: 'Destino' })
    expect(rutasRecientes()).toHaveLength(6)
    expect(rutasRecientes()[0]).toEqual({ origen: 'Origen 6', destino: 'Destino' })
  })
})

describe('visual de ciudad', () => {
  it('usa la ciudad normalizada o la paleta sin foto y calcula estilos legibles', () => {
    expect(visualDe('BOGOTÁ').nombreAcento).toBe('Ámbar farol')
    expect(visualDe('ciudad desconocida').foto).toBeNull()
    expect(ciudadesConFoto()).toHaveLength(7)
    expect(veloFoto(visualDe('Bogotá'))).toContain('linear-gradient')
    expect(tamanoTitulo('Villavicencio', 42)).toContain('min(42px')
  })
})

describe('pagos y pases guardados', () => {
  it('reutiliza una clave de idempotencia para el mismo pago', () => {
    expect(claveDePago('booking-1')).toBe(claveDePago('booking-1'))
    expect(claveDePago('booking-1')).not.toBe(claveDePago('booking-2'))
    expect(ESTADOS_EN_PROCESO.has('PAGO_EN_PROCESO')).toBe(true)
  })

  it('conserva los últimos diez pases y permite recuperar uno por id', () => {
    const pase = (ticketId: string): Tiquete => ({
      ticketId,
      bookingId: 'booking',
      estado: 'CONFIRMADA',
      emitidoEn: '2026-11-10T12:00:00Z',
      itineraryId: 'it',
      origen: 'Bogotá',
      destino: 'Cali',
      fechaSalida: '2026-11-15T12:00:00Z',
      empresa: 'TripBus',
      placa: 'ABC123',
      seatNumbers: ['1'],
      pasajeros: [],
      total: 10,
      moneda: 'COP',
      qrCode: 'code',
      qrImage: 'data:image/png;base64,abc',
    })
    for (let i = 0; i < 11; i += 1) guardarPase(pase(`ticket-${i}`))
    guardarPase(pase('ticket-10'))
    expect(pasesGuardados()).toHaveLength(10)
    expect(paseGuardado('ticket-10')?.ticketId).toBe('ticket-10')
    expect(paseGuardado('ticket-0')).toBeUndefined()
    expect(codigoReserva('ab-cd-ef')).toBe('TB-ABCDEF')
  })
})

describe('datos locales de retención', () => {
  it('reemplaza la retención del viaje y elimina la que ya venció', () => {
    const retencion = (holdId: string, itineraryId: string, expiraEn: string): Retencion => ({
      holdId,
      itineraryId,
      seatNumbers: ['2'],
      userId: 'user',
      offerId: null,
      bookingId: null,
      estado: 'ACTIVA',
      creadoEn: new Date().toISOString(),
      expiraEn,
      extendido: false,
      segundosRestantes: 60,
    })
    recordarRetencion(retencion('hold-old', 'it-1', new Date(Date.now() + 60_000).toISOString()))
    recordarRetencion(retencion('hold-new', 'it-1', new Date(Date.now() + 120_000).toISOString()))
    recordarRetencion(retencion('hold-expired', 'it-2', '2000-01-01T00:00:00Z'))
    expect(retencionDeViaje('it-1')?.holdId).toBe('hold-new')
    expect(retencionDeViaje('it-2')).toBeNull()
    olvidarRetencion('hold-new')
    expect(retencionDeViaje('it-1')).toBeNull()
  })

  it('recuerda los datos del último viajero', () => {
    const viajero = { nombre: 'Ana', tipoDocumento: 'CC' as const, numeroDocumento: '123' }
    recordarViajero(viajero)
    expect(ultimoViajero()).toEqual(viajero)
  })
})
