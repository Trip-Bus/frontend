import { describe, expect, it } from 'vitest'
import type { EstadosAsientos, MapaAsientos, Novedad } from '@/lib/tipos'
import { aplicarEvento, construirPisos, libreMasCercano } from './mapaAsientos'
import { calcularAvance, crearProyeccion, distanciaKm, haceCuanto, minutosDeRetraso, puntoEnRuta, rumbo, segundosDesde } from './seguimiento'

const mapa: MapaAsientos = {
  itineraryId: 'it',
  busId: 'bus',
  placa: 'TBO000',
  tipoBus: 'UN_PISO',
  capacidad: 4,
  asientos: ['1', '2', '3', '4'],
  distribucion: {
    tipo: 'UN_PISO',
    capacidad: 4,
    pisos: [
      {
        piso: 1,
        filas: 2,
        columnas: 5,
        celdas: [
          { fila: 0, columna: 1, tipo: 'CONDUCTOR' },
          { fila: 1, columna: 1, tipo: 'ASIENTO', asiento: '1' },
          { fila: 1, columna: 2, tipo: 'ASIENTO', asiento: '2' },
          { fila: 1, columna: 3, tipo: 'PASILLO' },
          { fila: 1, columna: 4, tipo: 'ASIENTO', asiento: '3' },
          { fila: 1, columna: 5, tipo: 'ASIENTO', asiento: '4' },
        ],
      },
    ],
  },
}

const estados: EstadosAsientos = {
  itineraryId: 'it',
  capacidad: 4,
  resumen: { disponibles: 2, retenidos: 1, vendidos: 1, enOferta: 0 },
  asientos: [
    { seatNumber: '1', estado: 'VENDIDO', offerId: null, propio: false },
    { seatNumber: '2', estado: 'DISPONIBLE', offerId: null, propio: false },
    { seatNumber: '3', estado: 'RETENIDO', offerId: null, propio: false },
    { seatNumber: '4', estado: 'DISPONIBLE', offerId: null, propio: false },
  ],
}

describe('mapa de asientos', () => {
  it('une distribución y estados, con ventana y pasillo', () => {
    const [p] = construirPisos(mapa, estados)
    const puestos = p.celdas.filter((c) => c.puesto).map((c) => [c.puesto!.numero, c.puesto!.estado, c.puesto!.ubicacion])
    expect(puestos).toEqual([
      ['1', 'vendido', 'ventana'],
      ['2', 'libre', 'pasillo'],
      ['3', 'ocupandose', 'pasillo'],
      ['4', 'libre', 'ventana'],
    ])
    expect(p.libres).toBe(2)
    expect(p.filas).toBe(2)
  })

  it('mis puestos mandan sobre el estado del servidor', () => {
    const [p] = construirPisos(mapa, estados, new Set(['3']))
    expect(p.celdas.find((c) => c.puesto?.numero === '3')?.puesto?.estado).toBe('tuyo')
  })

  it('sugiere el libre más cercano', () => {
    const pisos = construirPisos(mapa, estados)
    expect(libreMasCercano(pisos, '3')?.numero).toBe('4')
  })

  it('aplica eventos con número de puesto', () => {
    const r = aplicarEvento(estados, 'SeatHeld', { seatNumbers: ['2'] })
    expect(r?.asientos.find((a) => a.seatNumber === '2')?.estado).toBe('RETENIDO')
    expect(aplicarEvento(estados, 'OtroEvento', { seatNumbers: ['2'] })).toBeNull()
  })
})

describe('seguimiento', () => {
  const paradas = [
    { orden: 1, nombre: 'Bogotá', lat: 4.65, lng: -74.1, horaProgramada: '' },
    { orden: 2, nombre: 'Honda', lat: 5.2, lng: -74.74, horaProgramada: '' },
    { orden: 3, nombre: 'Medellín', lat: 6.25, lng: -75.57, horaProgramada: '' },
  ]

  it('distancias y avance sobre la ruta', () => {
    const total = distanciaKm(paradas[0], paradas[1]) + distanciaKm(paradas[1], paradas[2])
    const a = calcularAvance(paradas, { lat: 5.2, lng: -74.74 })!
    expect(a.ultimaParada).toBe(1)
    expect(a.kmRestantes).toBeCloseTo(distanciaKm(paradas[1], paradas[2]), 0)
    expect(a.fraccion).toBeGreaterThan(0.3)
    expect(calcularAvance(paradas, null)).toBeNull()
    expect(total).toBeGreaterThan(200)
  })

  it('cubre los límites y tramos degenerados de la ruta', () => {
    expect(calcularAvance(paradas.slice(0, 1), { lat: 4.65, lng: -74.1 })).toBeNull()
    expect(calcularAvance(paradas, { lat: 4, lng: -74 })).toMatchObject({ ultimaParada: 0, fraccion: 0 })
    expect(calcularAvance(paradas, paradas[2])).toMatchObject({ ultimaParada: 2, fraccion: 1 })

    const repetidas = [paradas[0], paradas[0]]
    expect(calcularAvance(repetidas, paradas[0])).toMatchObject({ ultimaParada: 0, kmRestantes: 0, fraccion: 0 })
    expect(puntoEnRuta(repetidas, 0.5)).toMatchObject({ lat: 4.65, lng: -74.1 })
    expect(puntoEnRuta(paradas, -1)).toMatchObject({ lat: 4.65, lng: -74.1 })
    expect(puntoEnRuta(paradas, 2).lat).toBeCloseTo(6.25)
  })

  it('el simulador recorre la ruta', () => {
    expect(puntoEnRuta(paradas, 0)).toMatchObject({ lat: 4.65, lng: -74.1 })
    const fin = puntoEnRuta(paradas, 1)
    expect(fin.lat).toBeCloseTo(6.25)
  })

  it('proyecta coordenadas y formatea tiempos de señal', () => {
    const proyectar = crearProyeccion(
      [{ lat: 4, lng: -74 }, { lat: 4, lng: -74 }],
      320,
      240,
    )
    expect(proyectar({ lat: 4, lng: -74 })).toMatchObject({ x: expect.any(Number), y: expect.any(Number) })
    expect(segundosDesde(null, Date.now())).toBeNull()
    expect(segundosDesde({
      busId: 'bus',
      itineraryId: 'trip',
      lat: 4,
      lng: -74,
      velocidad: null,
      rumbo: null,
      timestamp: new Date(10_000).toISOString(),
    }, 9_000)).toBe(0)
    expect(haceCuanto(59)).toBe('59 s')
    expect(haceCuanto(60)).toBe('1 min')
    expect(haceCuanto(3600)).toBe('1 h 00')
    expect(rumbo(paradas[0], paradas[1])).toBeGreaterThanOrEqual(0)
  })

  it('toma el último retraso reportado', () => {
    const n = (tipo: Novedad['tipo'], ts: string, minutos?: number): Novedad => ({
      tripEventId: ts,
      itineraryId: 'it',
      tipo,
      descripcion: null,
      detalle: minutos ? { minutos } : null,
      origen: 'CONDUCTOR',
      timestamp: ts,
    })
    expect(minutosDeRetraso([n('RETRASO', '2026-10-12T10:00:00Z', 25), n('RETRASO', '2026-10-12T11:00:00Z', 10), n('INICIO', '2026-10-12T09:00:00Z')])).toBe(10)
    expect(minutosDeRetraso([])).toBe(0)
    expect(minutosDeRetraso([n('RETRASO', '2026-10-12T10:00:00Z', -3)])).toBe(0)
    expect(minutosDeRetraso([n('RETRASO', '2026-10-12T10:00:00Z')])).toBe(0)
  })
})
