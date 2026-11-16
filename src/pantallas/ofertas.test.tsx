// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { sesion } from '@/lib/sesion'
import type { MensajeTopico } from '@/lib/tiempoReal'
import type { Oferta, OfertaVitrina } from '@/lib/tipos'
import { Drop } from './Drop'
import { Ofertas } from './Ofertas'

const { toast, manejadores } = vi.hoisted(() => ({ toast: vi.fn(), manejadores: new Map<string, (m: MensajeTopico) => void>() }))
vi.mock('sonner', () => ({ toast }))
vi.mock('@/lib/tiempoReal', () => ({
  topicos: { cupoOferta: (id: string) => `oferta:${id}:cupo`, ofertasActivas: () => 'ofertas:activas' },
  useTopico: (topico: string | null, alRecibir: (m: MensajeTopico) => void) => {
    if (topico) manejadores.set(topico, alRecibir)
  },
  useIntervaloRespaldo: () => 60_000,
  useEstadoTiempoReal: () => 'en-vivo',
}))

const evento = (topico: string, nombre: string, data: unknown) =>
  act(() => manejadores.get(topico)?.({ type: 'event', topic: topico, event: nombre, eventId: nombre, occurredAt: '', data }))

const vitrina = (o: Partial<OfertaVitrina>): OfertaVitrina => ({
  offerId: 'o-1',
  itineraryId: 'i-1',
  empresa: 'Expreso',
  origen: 'Bogotá',
  destino: 'Tunja',
  fechaSalida: '2099-01-01T12:00:00Z',
  precioBase: 80_000,
  precioOferta: 48_000,
  descuentoPorcentaje: 40,
  cupoRestante: 3,
  inicio: new Date(Date.now() - 60_000).toISOString(),
  fin: new Date(Date.now() + 10 * 60_000).toISOString(),
  segundosRestantes: 600,
  estado: 'ACTIVA',
  ...o,
})

const oferta = (o: Partial<Oferta>): Oferta => ({
  offerId: 'o-1',
  itineraryId: 'i-1',
  precioOferta: 48_000,
  cupoMax: 10,
  cupoRestante: 4,
  inicio: new Date(Date.now() - 60_000).toISOString(),
  fin: new Date(Date.now() + 10 * 60_000).toISOString(),
  estado: 'ACTIVA',
  segundosRestantes: 600,
  asientos: [],
  motivoCierre: null,
  salaEsperaHabilitada: true,
  ...o,
})

function montar(fetchMock: ReturnType<typeof vi.fn>, ruta: string) {
  vi.stubGlobal('fetch', fetchMock)
  const router = createMemoryRouter(
    [
      { path: '/ofertas', element: h(Ofertas) },
      { path: '/drop/:offerId', element: h(Drop) },
      { path: '*', element: h('p', null, 'Otra') },
    ],
    { initialEntries: [ruta] },
  )
  render(h(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }) }, h(RouterProvider, { router })))
  return router
}

/** El botón se habilita cuando llega el turno actual (GET /queue/me). */
async function entrarFila() {
  const boton = await screen.findByRole('button', { name: 'Entrar a la fila' })
  await waitFor(() => expect((boton as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(boton)
}

beforeEach(() => manejadores.clear())
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  sesion.cerrar()
})

describe('vitrina de ofertas', () => {
  it('lista activas y próximas, filtra por ruta y se actualiza con ofertas:activas', async () => {
    const fetchMock = vi.fn(async (entrada: RequestInfo | URL) =>
      Response.json({ content: [vitrina({}), vitrina({ offerId: 'o-2', estado: 'PROGRAMADA', cupoRestante: 1, inicio: new Date(Date.now() + 3_600_000).toISOString() })], page: 0, size: 10, totalElements: 2, totalPages: 1, url: String(entrada) }),
    )
    montar(fetchMock, '/ofertas')
    expect(await screen.findByText('Termina en')).toBeTruthy()
    expect(screen.getByText('Empieza en')).toBeTruthy()
    expect(screen.getByText('Queda 1 puesto')).toBeTruthy()
    expect(screen.getAllByText('−40%')).toHaveLength(2)

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: ' Bogotá ' } })
    fireEvent.change(screen.getByLabelText('Hacia'), { target: { value: 'Tunja' } })
    fireEvent.click(screen.getByRole('button', { name: 'Filtrar' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).includes('origin=Bogot%C3%A1&destination=Tunja'))).toBe(true))
    const antes = fetchMock.mock.calls.length
    await evento('ofertas:activas', 'OfferActivated', {})
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(antes))
  })

  it('sin ofertas lo dice', async () => {
    montar(vi.fn(async () => Response.json({ content: [], page: 0, size: 10, totalElements: 0, totalPages: 0 })), '/ofertas')
    expect(await screen.findByText('No hay ofertas para esa ruta en las próximas 48 horas.')).toBeTruthy()
  })
})

describe('sala de espera y personas viendo', () => {
  const servidor = (o: Oferta, turnos: unknown[]) => {
    let i = 0
    return vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
      const url = String(entrada)
      if (url.endsWith('/queue') && init?.method === 'POST') return Response.json({ offerId: 'o-1', estado: 'EN_FILA', posicion: 7, enFila: 30, admisionExpiraEn: null }, { status: 201 })
      if (url.endsWith('/queue/me')) return Response.json(turnos[Math.min(i++, turnos.length - 1)])
      if (url.endsWith('/offers/o-1')) return Response.json(o)
      if (url.includes('/reservations')) return Response.json({ holdId: 'h-1' }, { status: 201 })
      return Response.json({ itineraryId: 'i-1', origen: 'Bogotá', destino: 'Tunja', fechaSalida: '2099-01-01T12:00:00Z', empresa: 'Expreso', precioBase: 80_000, paradas: [] })
    })
  }

  it('entra a la fila, ve su posición y al ser admitido puede apartar', async () => {
    sesion.iniciar({ accessToken: 'a', expiresAt: new Date(Date.now() + 3_600_000).toISOString(), userId: 'u', rol: 'PASAJERO' })
    const fetchMock = servidor(oferta({}), [
      { offerId: 'o-1', estado: 'NO_INSCRITO', posicion: null, enFila: 0, admisionExpiraEn: null },
      { offerId: 'o-1', estado: 'ADMITIDO', posicion: null, enFila: 0, admisionExpiraEn: new Date(Date.now() + 5 * 60_000).toISOString() },
    ])
    const router = montar(fetchMock, '/drop/o-1')
    await entrarFila()
    expect(await screen.findByText('Tu lugar en la fila: 7 de 30. Te avisamos cuando sea tu turno.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Apartar uno' })).toBeNull()

    await evento('oferta:o-1:cupo', 'OfferViewers', { personas: 12 })
    expect(screen.getByText('12 personas viendo')).toBeTruthy()
    await evento('oferta:o-1:cupo', 'OfferQueueUpdated', { enFila: 20 })
    expect(await screen.findByText(/¡Es tu turno!/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Apartar uno' }))
    fireEvent.change(await screen.findByLabelText('Número de documento'), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: /Apartar a/ }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/reserva/h-1'))
  })

  it('antes de abrir la fila dice a qué hora abre y sin sesión pide entrar', async () => {
    const tarde = oferta({ estado: 'PROGRAMADA', inicio: new Date(Date.now() + 3_600_000).toISOString(), fin: new Date(Date.now() + 7_200_000).toISOString() })
    montar(servidor(tarde, []), '/drop/o-1')
    expect(await screen.findByText(/la fila abre a las/)).toBeTruthy()
    cleanup()

    const router = montar(servidor(oferta({}), []), '/drop/o-1')
    fireEvent.click(await screen.findByRole('button', { name: 'Entra para hacer la fila' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'))
  })

  it.each([
    ['TURNO_VENCIDO', 'Se venció tu turno para comprar.'],
    ['CERRADA', 'La fila de esta oferta ya cerró.'],
    ['EN_SALA', 'Estás en la sala. Cuando empiece la oferta sorteamos el orden de la fila.'],
  ])('muestra el estado %s', async (estado, texto) => {
    sesion.iniciar({ accessToken: 'a', expiresAt: new Date(Date.now() + 3_600_000).toISOString(), userId: 'u', rol: 'PASAJERO' })
    montar(servidor(oferta({}), [{ offerId: 'o-1', estado, posicion: null, enFila: 0, admisionExpiraEn: null }]), '/drop/o-1')
    expect(await screen.findByText(texto)).toBeTruthy()
  })

  it('avisa si no pudo entrar a la fila', async () => {
    sesion.iniciar({ accessToken: 'a', expiresAt: new Date(Date.now() + 3_600_000).toISOString(), userId: 'u', rol: 'PASAJERO' })
    const fetchMock = vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
      const url = String(entrada)
      if (url.endsWith('/queue') && init?.method === 'POST') return Response.json({ error: { code: 'QUEUE_CLOSED', message: 'x' } }, { status: 409 })
      if (url.endsWith('/queue/me')) return Response.json({ offerId: 'o-1', estado: 'NO_INSCRITO', posicion: null, enFila: 0, admisionExpiraEn: null })
      if (url.endsWith('/offers/o-1')) return Response.json(oferta({}))
      return Response.json({ itineraryId: 'i-1', origen: 'A', destino: 'B', fechaSalida: '2099-01-01T12:00:00Z', empresa: 'E', precioBase: 1, paradas: [] })
    })
    montar(fetchMock, '/drop/o-1')
    await entrarFila()
    await waitFor(() => expect(toast).toHaveBeenCalledWith('La fila de esta oferta ya cerró.'))
  })
})
