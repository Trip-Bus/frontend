// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { sesion } from '@/lib/sesion'
import type { DetalleItinerario, EstadosAsientos, MapaAsientos, Novedad, Oferta, Rol } from '@/lib/tipos'
import { PanelViaje } from './PanelViaje'

const { toast, gps } = vi.hoisted(() => ({
  toast: vi.fn(),
  gps: {
    modo: 'apagado' as 'apagado' | 'real' | 'simulado',
    setModo: vi.fn(),
    ultimo: null as { lat: number; lng: number; en: number } | null,
    error: null as string | null,
    pendientes: 0,
  },
}))

vi.mock('sonner', () => ({ toast }))
// El WebSocket y el GPS del navegador no existen en jsdom: se reemplazan por dobles.
vi.mock('@/lib/tiempoReal', () => ({
  topicos: { novedades: (id: string) => `viaje:${id}:eventos` },
  useTopico: vi.fn(),
}))
vi.mock('@/features/gps', () => ({ useEnvioGps: () => gps }))

const ID = 'trip-1'

const detalle: DetalleItinerario = {
  itineraryId: ID,
  routeId: 'route-1',
  busId: 'bus-1',
  companyId: 'co-1',
  empresa: 'Expreso',
  placa: 'ABC123',
  tipoBus: 'Bus',
  capacidad: 2,
  origen: 'Bogotá',
  destino: 'Tunja',
  fechaSalida: '2099-01-01T14:00:00Z',
  fechaLlegadaEstimada: '2099-01-01T17:00:00Z',
  estado: 'PROGRAMADO',
  precioBase: 100_000,
  moneda: 'COP',
  ofertaActiva: null,
  paradas: [
    { id: 'p-1', orden: 1, nombre: 'Bogotá', lat: 4.6, lng: -74, minutosDesdeSalida: 0, horaProgramada: '2099-01-01T14:00:00Z' },
    { id: 'p-2', orden: 2, nombre: 'Chocontá', lat: 5.1, lng: -73.6, minutosDesdeSalida: 60, horaProgramada: '2099-01-01T15:00:00Z' },
  ],
}

const novedad: Novedad = {
  tripEventId: 'ev-1',
  itineraryId: ID,
  tipo: 'RETRASO',
  descripcion: 'Trancón en la salida',
  detalle: { minutos: 10 },
  origen: 'OPERADOR',
  timestamp: '2099-01-01T14:05:00Z',
}

const oferta = (o: Partial<Oferta>): Oferta => ({
  offerId: 'of-1',
  itineraryId: ID,
  precioOferta: 60_000,
  cupoMax: 2,
  cupoRestante: 2,
  inicio: '2099-01-01T10:00:00Z',
  fin: '2099-01-01T11:00:00Z',
  estado: 'PROGRAMADA',
  segundosRestantes: 0,
  asientos: ['1', '2'],
  motivoCierre: null,
  ...o,
})

const mapa: MapaAsientos = {
  itineraryId: ID,
  busId: 'bus-1',
  placa: 'ABC123',
  tipoBus: 'Bus',
  capacidad: 2,
  asientos: ['1', '2'],
  distribucion: {
    tipo: 'SENCILLO',
    capacidad: 2,
    pisos: [{ piso: 1, filas: 1, columnas: 2, celdas: [{ fila: 1, columna: 1, tipo: 'ASIENTO', asiento: '1' }, { fila: 1, columna: 2, tipo: 'ASIENTO', asiento: '2' }] }],
  },
}

const estados: EstadosAsientos = {
  itineraryId: ID,
  capacidad: 2,
  resumen: { disponibles: 2, retenidos: 0, vendidos: 0, enOferta: 0 },
  asientos: [
    { seatNumber: '1', estado: 'DISPONIBLE', offerId: null, propio: false },
    { seatNumber: '2', estado: 'DISPONIBLE', offerId: null, propio: false },
  ],
}

type Ruta = (url: string, init?: RequestInit) => Response | Promise<Response> | undefined

function json(cuerpo: unknown, status = 200) {
  return new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })
}

function errorApi(message: string, status = 409) {
  return json({ error: { code: 'ERROR_DE_PRUEBA', message } }, status)
}

/** fetch simulado: las rutas propias de cada prueba primero, luego respuestas por defecto. */
function servidor(propias: Ruta = () => undefined) {
  return vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = String(entrada)
    const propia = await propias(url, init)
    if (propia) return propia
    if (url.includes(`/seats/itineraries/${ID}`)) return json(estados)
    if (url.includes(`/itineraries/${ID}/seatmap`)) return json(mapa)
    if (url.includes(`/itineraries/${ID}`)) return json(detalle)
    if (url.includes(`/trips/${ID}/timeline`)) return json([novedad])
    if (url.includes('/offers')) return json([])
    return json({})
  })
}

function montar(fetchMock: ReturnType<typeof servidor>, rol: Rol = 'OPERADOR') {
  sesion.iniciar({ accessToken: 'access', expiresAt: new Date(Date.now() + 60_000).toISOString(), userId: 'u-1', rol })
  vi.stubGlobal('fetch', fetchMock)
  const router = createMemoryRouter([
    { path: '/panel/viaje/:itineraryId', element: h(PanelViaje) },
    { path: '/panel', element: h('p', null, 'Panel') },
  ], { initialEntries: [`/panel/viaje/${ID}`] })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(h(QueryClientProvider, { client: queryClient }, h(RouterProvider, { router })))
}

const llamadas = (fetchMock: ReturnType<typeof servidor>, parte: string, metodo = 'POST') =>
  fetchMock.mock.calls.filter(([u, i]) => String(u).includes(parte) && (i?.method ?? 'GET') === metodo)

/** Los puestos se habilitan cuando llegan sus estados. */
async function tocarPuesto(numero: string) {
  const boton = await screen.findByRole('button', { name: new RegExp(`Puesto ${numero},`) })
  await waitFor(() => expect((boton as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(boton)
}

beforeEach(() => {
  gps.modo = 'apagado'
  gps.ultimo = null
  gps.error = null
  gps.pendientes = 0
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  sesion.cerrar()
})

describe('panel de un viaje', () => {
  it('muestra la carga mientras llega el detalle', () => {
    montar(vi.fn(() => new Promise<Response>(() => {})) as unknown as ReturnType<typeof servidor>)
    expect(screen.getByLabelText('Cargando')).toBeTruthy()
  })

  it('muestra el error si no puede abrir el viaje', async () => {
    montar(servidor((url) => (url.endsWith(`/itineraries/${ID}`) ? errorApi('No existe', 404) : undefined)))
    expect(await screen.findByText('No pudimos abrir el viaje')).toBeTruthy()
  })

  it('muestra el viaje, sus novedades y las secciones del operador', async () => {
    montar(servidor())
    expect(await screen.findByRole('heading', { name: 'Bogotá → Tunja' })).toBeTruthy()
    expect(screen.getByText('ABC123')).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Manifiesto del viaje' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Validar pase de abordaje/ })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Drops' })).toBeTruthy()
    expect(await screen.findByText(': Trancón en la salida')).toBeTruthy()
    expect(screen.getByText(/Aún no hay drops/)).toBeTruthy()
  })

  it('avisa si el viaje está cancelado y bloquea crear drops', async () => {
    montar(servidor((url) => (url.endsWith(`/itineraries/${ID}`) ? json({ ...detalle, estado: 'CANCELADO' }) : undefined)))
    expect(await screen.findByText('Este viaje está cancelado.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Crear drop' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('un pasajero no ve manifiesto, validación ni drops', async () => {
    montar(servidor(), 'PASAJERO')
    await screen.findByRole('heading', { name: 'Bogotá → Tunja' })
    expect(screen.queryByRole('region', { name: 'Manifiesto del viaje' })).toBeNull()
    expect(screen.queryByRole('link', { name: /Validar pase de abordaje/ })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Drops' })).toBeNull()
  })

  it('reporta un retraso con sus minutos y avisa el éxito', async () => {
    const fetchMock = servidor((url, init) => (url.includes('/events') && init?.method === 'POST' ? json(novedad, 201) : undefined))
    montar(fetchMock)
    await screen.findByRole('heading', { name: 'Bogotá → Tunja' })
    fireEvent.change(screen.getByLabelText('Minutos de retraso'), { target: { value: '25' } })
    fireEvent.change(screen.getByLabelText('Mensaje para los pasajeros (opcional)'), { target: { value: 'Cierre de vía' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar a los pasajeros' }))

    await waitFor(() => expect(toast).toHaveBeenCalledWith('Novedad enviada a los pasajeros.'))
    expect(JSON.parse(String(llamadas(fetchMock, '/events')[0][1]?.body))).toEqual({
      tipo: 'RETRASO',
      descripcion: 'Cierre de vía',
      detalle: { minutos: 25 },
    })
    expect((screen.getByLabelText('Mensaje para los pasajeros (opcional)') as HTMLTextAreaElement).value).toBe('')
  })

  it('pide los minutos antes de reportar un retraso', async () => {
    const fetchMock = servidor()
    montar(fetchMock)
    await screen.findByRole('heading', { name: 'Bogotá → Tunja' })
    fireEvent.change(screen.getByLabelText('Minutos de retraso'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar a los pasajeros' }))
    expect(toast).toHaveBeenCalledWith('Escribe cuántos minutos de retraso.')
    expect(llamadas(fetchMock, '/events')).toHaveLength(0)
  })

  it('arma el texto según el tipo de novedad y muestra el error del servidor', async () => {
    const fetchMock = servidor((url, init) => (url.includes('/events') && init?.method === 'POST' ? errorApi('Viaje cerrado') : undefined))
    montar(fetchMock)
    await screen.findByRole('heading', { name: 'Bogotá → Tunja' })

    fireEvent.click(screen.getByRole('radio', { name: 'Llegamos a parada' }))
    fireEvent.change(screen.getByLabelText('Parada'), { target: { value: 'Chocontá' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar a los pasajeros' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Viaje cerrado'))
    expect(JSON.parse(String(llamadas(fetchMock, '/events')[0][1]?.body))).toEqual({
      tipo: 'LLEGADA_PARADA',
      descripcion: 'Llegamos a Chocontá',
      detalle: { parada: 'Chocontá' },
    })

    for (const [radio, texto] of [['Salimos', 'Salimos de Bogotá'], ['Llegamos', 'Llegamos a Tunja']] as const) {
      fireEvent.click(screen.getByRole('radio', { name: radio }))
      fireEvent.click(screen.getByRole('button', { name: 'Enviar a los pasajeros' }))
      await waitFor(() => expect(llamadas(fetchMock, '/events').some(([, i]) => JSON.parse(String(i?.body)).descripcion === texto)).toBe(true))
    }
  })

  it('muestra el estado del GPS y cambia de modo', async () => {
    gps.modo = 'real'
    gps.error = 'Sin permiso de ubicación'
    gps.pendientes = 2
    gps.ultimo = { lat: 4.61234, lng: -74.07891, en: Date.now() }
    montar(servidor())
    await screen.findByRole('heading', { name: 'Bogotá → Tunja' })

    expect(screen.getByText('Sin permiso de ubicación')).toBeTruthy()
    expect(screen.getByText(/posiciones pendientes/)).toBeTruthy()
    expect(screen.getByText('4.6123, -74.0789')).toBeTruthy()
    expect(screen.getByText(/Mantén esta pantalla abierta/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Detener' }))
    expect(gps.setModo).toHaveBeenCalledWith('apagado')
    fireEvent.click(screen.getByRole('button', { name: 'Simular recorrido' }))
    expect(gps.setModo).toHaveBeenCalledWith('simulado')
  })

  it('activa y cierra drops existentes', async () => {
    const lista = [oferta({}), oferta({ offerId: 'of-2', estado: 'ACTIVA' })]
    const fetchMock = servidor((url, init) => {
      if (init?.method === 'POST' && url.includes('/activate')) return json(oferta({ estado: 'ACTIVA' }))
      if (init?.method === 'POST' && url.includes('/close')) return errorApi('Ya estaba cerrado')
      if (url.includes('/offers')) return json(lista)
      return undefined
    })
    montar(fetchMock)
    const drops = await screen.findByRole('region', { name: 'Drops' })
    expect(await within(drops).findByText('Programada')).toBeTruthy()
    expect(within(drops).getByText('Activa')).toBeTruthy()

    fireEvent.click(within(drops).getByRole('button', { name: 'Activar ya' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Drop activado.'))
    expect(llamadas(fetchMock, '/offers/of-1/activate')).toHaveLength(1)

    await waitFor(() => expect((within(drops).getAllByRole('button', { name: 'Cerrar' })[1] as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(within(drops).getAllByRole('button', { name: 'Cerrar' })[1])
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Ya estaba cerrado'))
    expect(llamadas(fetchMock, '/offers/of-2/close')).toHaveLength(1)
  })

  it('crea un drop con los puestos elegidos', async () => {
    const fetchMock = servidor((url, init) => (init?.method === 'POST' && url.endsWith('/offers') ? json(oferta({}), 201) : undefined))
    montar(fetchMock)
    fireEvent.click(await screen.findByRole('button', { name: 'Crear drop' }))

    expect(await screen.findByText('Toca los puestos que entran al drop.')).toBeTruthy()
    await tocarPuesto('1')
    await tocarPuesto('2')

    fireEvent.change(screen.getByLabelText('Precio del drop'), { target: { value: '200000' } })
    expect(screen.getByText(/El precio debe ser menor que/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Precio del drop'), { target: { value: '50000' } })
    fireEvent.change(screen.getByLabelText('Cupo'), { target: { value: '5' } })
    expect(screen.getByText('El cupo no puede ser mayor que los puestos elegidos.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Cupo'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('radio', { name: '15 min' }))

    fireEvent.click(screen.getByRole('button', { name: 'Lanzar drop de 2 puestos' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Drop creado. Los pasajeros ya lo ven en el inicio.'))
    const cuerpo = JSON.parse(String(llamadas(fetchMock, '/offers')[0][1]?.body))
    expect(cuerpo).toMatchObject({ itineraryId: ID, seatNumbers: ['1', '2'], precioOferta: 50_000, cupo: 2 })
    expect(new Date(cuerpo.fin).getTime() - new Date(cuerpo.inicio).getTime()).toBe(15 * 60_000)
  })

  it('muestra el error al crear un drop', async () => {
    montar(servidor((url, init) => (init?.method === 'POST' && url.endsWith('/offers') ? errorApi('Puestos ocupados') : undefined)))
    fireEvent.click(await screen.findByRole('button', { name: 'Crear drop' }))
    await tocarPuesto('1')
    fireEvent.click(screen.getByRole('button', { name: 'Lanzar drop de 1 puesto' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Puestos ocupados'))
  })
})
