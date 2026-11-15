// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { sesion } from '@/lib/sesion'
import type { MensajeTopico } from '@/lib/tiempoReal'
import type { Rol } from '@/lib/tipos'
import { ordenarAlertas } from '@/features/sonido'
import { Flota } from './Flota'
import { listaAsientos } from '@/features/opcionesGestion'
import { InicioOperador } from './InicioOperador'
import { Viajes } from './Viajes'

const { toast, manejadores, sonarAlerta } = vi.hoisted(() => ({ toast: vi.fn(), manejadores: new Map<string, (m: MensajeTopico) => void>(), sonarAlerta: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
vi.mock('@/features/sonido', async (original) => ({ ...(await original<typeof import('@/features/sonido')>()), sonarAlerta }))
vi.mock('@/lib/tiempoReal', () => ({
  topicos: { flotaEmpresa: (id: string) => `empresa:${id}:flota`, alertasEmpresa: (id: string) => `empresa:${id}:alertas` },
  useTopico: (topico: string | null, alRecibir: (m: MensajeTopico) => void) => {
    if (topico) manejadores.set(topico, alRecibir)
  },
  useIntervaloRespaldo: () => 60_000,
  useEstadoTiempoReal: () => 'en-vivo',
}))

type Rutas = Record<string, (url: string, init?: RequestInit) => Response>
const pagina = (content: unknown[], extra: Record<string, unknown> = {}) => Response.json({ content, page: 0, size: 20, totalElements: content.length, totalPages: 1, ...extra })

function servidor(rutas: Rutas) {
  return vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = String(entrada)
    const clave = Object.keys(rutas).find((k) => url.includes(k))
    if (clave) return rutas[clave](url, init)
    if (url.includes('/users/')) return Response.json({ id: 'op', nombre: 'Op', rol: 'OPERADOR', companyId: 'c-1', activo: true })
    if (url.includes('/routes')) return pagina([{ id: 'r-1', origen: 'Bogotá', destino: 'Tunja', estado: 'ACTIVA' }])
    if (url.includes('/buses')) return pagina([{ id: 'bus-1', placa: 'ABC123', tipo: 'UN_PISO' }, { id: 'bus-2', placa: 'XYZ987', tipo: 'DOS_PISOS' }])
    if (url.includes('/companies')) return pagina([{ id: 'c-1', nombre: 'Expreso' }])
    return Response.json({})
  })
}

function montar(fetchMock: ReturnType<typeof servidor>, componente: () => ReturnType<typeof h>, ruta = '/x', rol: Rol = 'OPERADOR') {
  sesion.iniciar({ accessToken: 'a', expiresAt: new Date(Date.now() + 3_600_000).toISOString(), userId: 'op', rol })
  vi.stubGlobal('fetch', fetchMock)
  const router = createMemoryRouter([{ path: '/x', element: componente() }, { path: '*', element: h('p', null, 'Otra') }], { initialEntries: [ruta] })
  render(h(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }) }, h(RouterProvider, { router })))
  return router
}

const viajeOperador = (v: Record<string, unknown> = {}) => ({
  itineraryId: 'i-1',
  origen: 'Bogotá',
  destino: 'Tunja',
  fechaSalida: '2099-01-01T12:00:00Z',
  fechaLlegadaEstimada: '2099-01-01T15:00:00Z',
  placa: 'ABC123',
  tipoBus: 'UN_PISO',
  estado: 'PROGRAMADO',
  precioBase: 80_000,
  ofertaActiva: null,
  ocupacion: { vendidos: 10, disponibles: 30, bloqueados: 2, porcentaje: 23.8, tasaAbandono: 5 },
  ocupacionConocida: true,
  ...v,
})

const posts = (f: ReturnType<typeof servidor>, parte: string, metodo = 'POST') => f.mock.calls.filter(([u, i]) => String(u).includes(parte) && i?.method === metodo)

beforeEach(() => manejadores.clear())
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  sesion.cerrar()
})

describe('inicio del operador', () => {
  it('resume la semana y muestra la ocupación o "sin dato"', async () => {
    const fetchMock = servidor({
      '/operator/trips': () =>
        pagina([viajeOperador(), viajeOperador({ itineraryId: 'i-2', ocupacion: null, ocupacionConocida: false, ofertaActiva: { offerId: 'o', precioOferta: 50_000, fin: '' }, estado: 'CANCELADO' })], {
          resumen: { viajes: 2, ocupacionPromedio: 23.8, candidatosOferta: 1 },
        }),
    })
    montar(fetchMock, () => h(InicioOperador))
    expect(await screen.findByText('Bajo 40 % a 24 h')).toBeTruthy()
    expect(screen.getAllByText('23,8 %').length).toBeGreaterThan(0)
    expect(screen.getByText(/10 vendidos · 30 disponibles · 2 bloqueados · abandono 5 %/)).toBeTruthy()
    expect(screen.getByText('Ocupación: sin dato')).toBeTruthy()
    expect(screen.getByText('Cancelado')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2099-01-31' } })
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).includes('hasta=2099-01-31'))).toBe(true))
  })

  it('el ADMIN elige la empresa antes de ver datos', async () => {
    const fetchMock = servidor({ '/operator/trips': () => pagina([], { resumen: { viajes: 0, ocupacionPromedio: null, candidatosOferta: 0 } }) })
    const router = montar(fetchMock, () => h(InicioOperador), '/x', 'ADMIN')
    expect(await screen.findByText('Elige una empresa para ver y administrar sus datos.')).toBeTruthy()
    await screen.findByRole('option', { name: 'Expreso' })
    fireEvent.change(screen.getByLabelText('Empresa'), { target: { value: 'c-1' } })
    await waitFor(() => expect(router.state.location.search).toBe('?companyId=c-1'))
    expect(await screen.findByText('No hay viajes programados en esas fechas.')).toBeTruthy()
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/operator/trips') && String(u).includes('companyId=c-1'))).toBe(true)
  })
})

describe('viajes del operador', () => {
  const itinerario = { itineraryId: 'i-1', routeId: 'r-1', busId: 'bus-1', companyId: 'c-1', empresa: 'E', origen: 'Bogotá', destino: 'Tunja', placa: 'ABC123', fechaSalida: '2099-01-01T12:00:00Z', fechaLlegadaEstimada: '', estado: 'PROGRAMADO', precioBase: 80_000, moneda: 'COP' }

  it('programa un viaje suelto y uno recurrente con omitidos', async () => {
    const fetchMock = servidor({
      '/itineraries/schedule': () => Response.json({ creados: [itinerario, itinerario], omitidos: [{ fecha: '2099-01-03', fechaSalida: '', codigo: 'BUS_SCHEDULE_CONFLICT', motivo: 'El bus ya tiene un viaje' }] }),
      '/itineraries?': () => pagina([itinerario]),
      '/itineraries': () => Response.json(itinerario, { status: 201 }),
    })
    montar(fetchMock, () => h(Viajes))
    const programar = await screen.findByRole('region', { name: 'Programar viajes' })
    await within(programar).findByRole('option', { name: 'Bogotá → Tunja' })
    fireEvent.change(within(programar).getByLabelText('Ruta'), { target: { value: 'r-1' } })
    fireEvent.change(within(programar).getByLabelText('Bus'), { target: { value: 'bus-1' } })
    fireEvent.change(within(programar).getByLabelText('Precio base (COP)'), { target: { value: '80.000' } })
    fireEvent.change(within(programar).getByLabelText('Salida (hora de Colombia)'), { target: { value: '2099-01-01T07:00' } })
    fireEvent.click(within(programar).getByRole('button', { name: 'Programar viaje' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Viaje programado.'))
    expect(JSON.parse(String(posts(fetchMock, '/itineraries')[0][1]?.body))).toEqual({ routeId: 'r-1', busId: 'bus-1', fechaSalida: '2099-01-01T12:00:00.000Z', precioBase: 80_000 })

    fireEvent.click(within(programar).getByRole('radio', { name: 'Recurrente' }))
    fireEvent.click(within(programar).getByLabelText('Sáb'))
    fireEvent.click(within(programar).getByRole('button', { name: 'Programar viajes' }))
    expect(await screen.findByText('Creamos 2 viajes.')).toBeTruthy()
    expect(screen.getByText(/El bus ya tiene un viaje/)).toBeTruthy()
    expect(JSON.parse(String(posts(fetchMock, '/itineraries/schedule')[0][1]?.body)).diasSemana).toEqual(['LUNES', 'MIERCOLES', 'VIERNES', 'SABADO'])
  })

  it('gestiona un viaje: salida, bus con conflicto, bloqueos, ocupación, historial y cancelación', async () => {
    const fetchMock = servidor({
      '/itineraries/i-1/departure': () => Response.json(itinerario),
      '/itineraries/i-1/bus': () => Response.json({ error: { code: 'SEATS_CONFLICT', message: 'x', details: { asientos: ['39', '40'] } } }, { status: 409 }),
      '/itineraries/i-1/changes': () => Response.json([{ id: 'ch', tipo: 'RETRASO', salidaAnterior: '2099-01-01T12:00:00Z', salidaNueva: '2099-01-01T13:00:00Z', busAnterior: null, busNuevo: null, motivo: 'Vía', hechoPor: null, creadoEn: '2099-01-01T10:00:00Z' }]),
      '/seats/itineraries/i-1/blocks': () => Response.json({ itineraryId: 'i-1', cambiados: ['1', '2'], sinCambio: [] }),
      '/seats/itineraries/i-1/occupancy': () => Response.json({ itineraryId: 'i-1', capacidad: 40, disponibles: 30, retenidos: 1, vendidos: 9, enOferta: 0, bloqueados: 2, enTramos: 0, porcentajeOcupacion: 22.5, tasaAbandono: 3 }),
      '/admin/itineraries/i-1/cancel': () => Response.json({}),
      '/itineraries?': () => pagina([itinerario]),
    })
    montar(fetchMock, () => h(Viajes))
    const abrir = async () => fireEvent.click(await screen.findByRole('button', { name: 'Gestionar' }))
    const elegir = (accion: string) => fireEvent.change(screen.getByLabelText('¿Qué quieres hacer?'), { target: { value: accion } })

    await abrir()
    fireEvent.change(await screen.findByLabelText('Nueva salida (hora de Colombia)'), { target: { value: '2099-01-01T08:00' } })
    fireEvent.change(screen.getByLabelText('Motivo (lo ven los pasajeros)'), { target: { value: 'Cierre de vía' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar la nueva salida' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Cambiamos la salida. Avisamos a los pasajeros.'))
    expect(JSON.parse(String(posts(fetchMock, '/departure', 'PATCH')[0][1]?.body))).toEqual({ nuevaFechaSalida: '2099-01-01T13:00:00.000Z', motivo: 'Cierre de vía' })

    await abrir()
    elegir('bus')
    await screen.findByRole('option', { name: /XYZ987/ })
    fireEvent.change(screen.getByLabelText('Bus nuevo'), { target: { value: 'bus-2' } })
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Falla mecánica' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar el bus' }))
    expect(await screen.findByText('39, 40')).toBeTruthy()

    elegir('asientos')
    fireEvent.change(screen.getByLabelText('Puestos (separados por coma)'), { target: { value: '1, 2' } })
    fireEvent.change(screen.getByLabelText('Motivo del bloqueo'), { target: { value: 'Tripulación' } })
    fireEvent.click(screen.getByRole('button', { name: 'Bloquear' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Bloqueados: 1, 2'))
    fireEvent.click(screen.getByRole('button', { name: 'Desbloquear' }))
    await waitFor(() => expect(posts(fetchMock, '/blocks', 'DELETE')).toHaveLength(1))

    elegir('ocupacion')
    expect(await screen.findByText('22,5 %')).toBeTruthy()
    elegir('historial')
    expect(await screen.findByText('Retraso')).toBeTruthy()
    elegir('cancelar')
    fireEvent.change(screen.getByLabelText('Motivo de la cancelación'), { target: { value: 'Paro' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar el viaje' }))
    await waitFor(() => expect(posts(fetchMock, '/cancel')).toHaveLength(1))
  })

  it('separa la lista de puestos', () => {
    expect(listaAsientos(' 1, 2;3  4,,1 ')).toEqual(['1', '2', '3', '4'])
  })
})

describe('flota en vivo', () => {
  const viaje = (v: Record<string, unknown> = {}) => ({
    itineraryId: 'i-1',
    busId: 'b',
    origen: 'Bogotá',
    destino: 'Tunja',
    fechaSalida: '2099-01-01T12:00:00Z',
    fechaLlegada: '',
    iniciado: true,
    finalizado: false,
    estadoRastreo: 'ACTIVO',
    posicion: { lat: 5, lng: -73.8, velocidad: 50, rumbo: 0, timestamp: '2099-01-01T12:30:00Z' },
    retrasoMinutos: 12,
    siguienteParada: { orden: 2, nombre: 'Chocontá', programada: '2099-01-01T13:00:00Z', estimada: '2099-01-01T13:12:00Z' },
    ultimaParadaAlcanzada: null,
    alertas: { abiertas: 1, mayorGravedad: 'ALTA' },
    conductor: { conductorId: 'c', nombre: 'Luis' },
    ...v,
  })
  const alerta = (a: Record<string, unknown>) => ({ alertId: 'a', itineraryId: 'i-1', companyId: 'c-1', busId: 'b', tipo: 'AVERIA', gravedad: 'MEDIA', lat: null, lng: null, mensaje: 'Llanta', puedeContinuar: true, estado: 'ABIERTA', creadoEn: '2099-01-01T12:00:00Z', ...a })

  it('ordena primero SOS y accidentes', () => {
    const lista = ordenarAlertas([alerta({ alertId: '1' }), alerta({ alertId: '2', tipo: 'SOS' }), alerta({ alertId: '3', tipo: 'ACCIDENTE', creadoEn: '2099-01-01T13:00:00Z' })])
    expect(lista.map((a) => a.alertId)).toEqual(['3', '2', '1'])
  })

  it('pinta el mapa, resuelve alertas, suena con un SOS y fuerza el fin', async () => {
    const fetchMock = servidor({
      '/fleet/live': () => Response.json({ generadoEn: '', resumen: { total: 2, enRuta: 2, activos: 1, enPausa: 0, sinSenal: 1, retrasados: 1, conAlerta: 1 }, viajes: [viaje(), viaje({ itineraryId: 'i-2', estadoRastreo: 'SIN_SENAL', alertas: null, retrasoMinutos: 0, siguienteParada: null })] }),
      '/alerts': () => Response.json([alerta({}), alerta({ alertId: 'sos', tipo: 'SOS', gravedad: 'CRITICA', mensaje: 'Ayuda', puedeContinuar: false })]),
      '/alerts/sos/resolve': () => Response.json(alerta({ estado: 'RESUELTA' })),
      '/trips/i-1/finish': () => Response.json({ itineraryId: 'i-1', estadoRastreo: 'FINALIZADO' }),
      '/trips/i-1/timeline': () => Response.json([{ tripEventId: 'n', itineraryId: 'i-1', tipo: 'INICIO', descripcion: 'Salimos', detalle: null, origen: 'C', timestamp: '2099-01-01T12:00:00Z' }]),
    })
    montar(fetchMock, () => h(Flota))
    expect(await screen.findByRole('img', { name: 'Mapa de la flota con 2 buses' })).toBeTruthy()
    expect(screen.getByText(/\+12 min/)).toBeTruthy()
    expect(screen.getByText('Ayuda')).toBeTruthy()
    expect(screen.getByText(/el bus no puede continuar/)).toBeTruthy()

    fireEvent.click(screen.getAllByRole('button', { name: 'Resolver' })[0])
    fireEvent.change(await screen.findByLabelText('Nota de lo que se hizo'), { target: { value: 'Llamamos al conductor' } })
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como resuelta' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Alerta resuelta.'))
    expect(JSON.parse(String(posts(fetchMock, '/alerts/sos/resolve')[0][1]?.body))).toEqual({ nota: 'Llamamos al conductor' })

    await waitFor(() => expect(manejadores.has('empresa:c-1:alertas')).toBe(true))
    await act(() => manejadores.get('empresa:c-1:alertas')?.({ type: 'event', topic: '', event: 'TripAlertRaised', eventId: 'e', occurredAt: '', data: { tipo: 'SOS' } }))
    expect(sonarAlerta).toHaveBeenCalled()
    expect(toast).toHaveBeenCalledWith('SOS de un conductor')
    await act(() =>
      manejadores.get('empresa:c-1:flota')?.({ type: 'event', topic: '', event: 'PositionUpdated', eventId: 'p', occurredAt: '', data: { itineraryId: 'i-1', lat: 5.1, lng: -73.7, timestamp: '' } }),
    )
    await act(() => manejadores.get('empresa:c-1:flota')?.({ type: 'event', topic: '', event: 'EtaUpdated', eventId: 'q', occurredAt: '', data: {} }))

    fireEvent.click(screen.getAllByRole('button', { name: 'Forzar fin' })[0])
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, finalizar el viaje' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Finalizamos el viaje.'))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    fireEvent.click(screen.getAllByRole('button', { name: 'Línea de tiempo' })[0])
    expect(await screen.findByText('Salimos')).toBeTruthy()
  })

  it('sin buses en ruta ni alertas lo dice', async () => {
    montar(
      servidor({
        '/fleet/live': () => Response.json({ generadoEn: '', resumen: { total: 0, enRuta: 0, activos: 0, enPausa: 0, sinSenal: 0, retrasados: 0, conAlerta: 0 }, viajes: [] }),
        '/alerts': () => Response.json([]),
      }),
      () => h(Flota),
    )
    expect(await screen.findByText('No hay buses en ruta en este momento.')).toBeTruthy()
    expect(screen.getByText('No hay alertas abiertas.')).toBeTruthy()
  })
})
