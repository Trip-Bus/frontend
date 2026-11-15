// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { sesion } from '@/lib/sesion'
import type { MensajeTopico } from '@/lib/tiempoReal'
import type { Seguimiento } from '@/lib/tipos'
import { Compartido } from './Compartido'
import { EnVivo } from './EnVivo'

const { toast, manejadores, compartir } = vi.hoisted(() => ({ toast: vi.fn(), manejadores: new Map<string, (m: MensajeTopico) => void>(), compartir: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
vi.mock('@/lib/tiempoReal', () => ({
  topicos: { posicionViaje: (id: string) => `viaje:${id}:posicion`, novedades: (id: string) => `viaje:${id}:eventos` },
  useTopico: (topico: string | null, alRecibir: (m: MensajeTopico) => void) => {
    if (topico) manejadores.set(topico, alRecibir)
  },
  useIntervaloRespaldo: () => 60_000,
}))

const ahora = Date.now()
const seguimiento = (s: Partial<Seguimiento>): Seguimiento => ({
  itineraryId: 'i-1',
  busId: 'bus-1',
  origen: 'Bogotá',
  destino: 'Tunja',
  fechaSalida: new Date(ahora - 3_600_000).toISOString(),
  llegadaProgramada: new Date(ahora + 3_600_000).toISOString(),
  estado: 'EN_RUTA',
  posicion: { busId: 'bus-1', itineraryId: 'i-1', lat: 5.0, lng: -73.8, velocidad: 60, rumbo: 10, timestamp: new Date(ahora - 10_000).toISOString() },
  paradas: [
    { orden: 1, nombre: 'Bogotá', lat: 4.6, lng: -74.1, horaProgramada: new Date(ahora - 3_600_000).toISOString() },
    { orden: 2, nombre: 'Chocontá', lat: 5.1, lng: -73.7, horaProgramada: new Date(ahora + 600_000).toISOString() },
    { orden: 3, nombre: 'Tunja', lat: 5.5, lng: -73.4, horaProgramada: new Date(ahora + 3_600_000).toISOString() },
  ],
  estadoRastreo: 'ACTIVO',
  ultimaPosicionEn: new Date(ahora - 10_000).toISOString(),
  eta: null,
  ...s,
})

function servidor(s: Seguimiento, extra: Record<string, () => Response> = {}) {
  return vi.fn(async (entrada: RequestInfo | URL) => {
    const url = String(entrada)
    const k = Object.keys(extra).find((x) => url.includes(x))
    if (k) return extra[k]()
    if (url.includes('/bus-position')) return Response.json(s)
    if (url.includes('/timeline')) return Response.json([{ tripEventId: 'n-1', itineraryId: 'i-1', tipo: 'AVERIA', descripcion: 'Llanta pinchada', detalle: null, origen: 'CONDUCTOR', timestamp: new Date(ahora - 60_000).toISOString() }])
    if (url.includes('/eta')) return Response.json({ error: { code: 'NO_ETA', message: 'x' } }, { status: 404 })
    return Response.json({})
  })
}

function montar(fetchMock: ReturnType<typeof servidor>, ruta = '/viaje/i-1/en-vivo') {
  vi.stubGlobal('fetch', fetchMock)
  const router = createMemoryRouter(
    [
      { path: '/viaje/:itineraryId/en-vivo', element: h(EnVivo) },
      { path: '/compartido/:codigo', element: h(Compartido) },
      { path: '*', element: h('p', null, 'Otra') },
    ],
    { initialEntries: [ruta] },
  )
  render(h(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }) }, h(RouterProvider, { router })))
}

const evento = (nombre: string, data: unknown) =>
  act(() => manejadores.get('viaje:i-1:posicion')?.({ type: 'event', topic: 'viaje:i-1:posicion', event: nombre, eventId: nombre, occurredAt: '', data }))

beforeEach(() => {
  manejadores.clear()
  Object.defineProperty(navigator, 'share', { value: compartir, configurable: true })
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  sesion.cerrar()
})

describe('seguimiento en vivo', () => {
  it('sigue viaje:{id}:posicion: estado del rastreo, ETA por parada y novedades graves', async () => {
    montar(servidor(seguimiento({})))
    expect(await screen.findByText(/En vivo · hace/)).toBeTruthy()
    expect(await screen.findByText('Llanta pinchada')).toBeTruthy()
    expect(screen.getByText(/Avería ·/)).toBeTruthy()

    await evento('TrackingStatusChanged', { estado: 'EN_PAUSA' })
    expect(await screen.findByText('Rastreo en pausa')).toBeTruthy()
    const ultima = new Date(ahora - 300_000).toISOString()
    await evento('TrackingStatusChanged', { estadoRastreo: 'SIN_SENAL', ultimaPosicionEn: ultima })
    expect(await screen.findByText(/Sin señal desde las/)).toBeTruthy()

    const estimada = new Date(ahora + 1_800_000).toISOString()
    await evento('EtaUpdated', {
      itineraryId: 'i-1',
      retrasoMinutos: 20,
      calculadaEn: '',
      paradas: [
        { orden: 1, nombre: 'Bogotá', programada: '', estimada: '', alcanzada: true },
        { orden: 2, nombre: 'Chocontá', programada: '', estimada, alcanzada: false },
      ],
    })
    expect(await screen.findByText('+20 min')).toBeTruthy()

    await evento('PositionUpdated', { busId: 'bus-1', itineraryId: 'i-1', lat: 5.2, lng: -73.6, velocidad: 50, rumbo: 0, timestamp: new Date().toISOString() })
    await evento('PositionUpdated', { itineraryId: 'otro', lat: 1, lng: 1, timestamp: '' })
    await act(() =>
      manejadores.get('viaje:i-1:posicion')?.({ type: 'snapshot', topic: 'viaje:i-1:posicion', data: { ...seguimiento({ estadoRastreo: 'ACTIVO' }), itineraryId: 'i-1' } }),
    )
    await act(() =>
      manejadores.get('viaje:i-1:eventos')?.({
        type: 'event',
        topic: 'viaje:i-1:eventos',
        event: 'TripEventReported',
        eventId: 'x',
        occurredAt: '',
        data: { tipo: 'VIA_CERRADA', descripcion: 'Derrumbe' },
      }),
    )
    expect(toast).toHaveBeenCalledWith('Vía cerrada: Derrumbe')
  })

  it('con cuenta comparte un enlace /compartido; sin cuenta, la misma pantalla', async () => {
    sesion.iniciar({ accessToken: 'a', expiresAt: new Date(Date.now() + 3_600_000).toISOString(), userId: 'u', rol: 'PASAJERO' })
    montar(servidor(seguimiento({}), { '/share-links': () => Response.json({ codigo: 'XYZ23456', itineraryId: 'i-1', venceEn: new Date(ahora + 86_400_000).toISOString() }, { status: 201 }) }))
    fireEvent.click(await screen.findByRole('button', { name: 'Compartir mi viaje' }))
    await waitFor(() => expect(compartir).toHaveBeenCalledWith(expect.objectContaining({ url: `${location.origin}/compartido/XYZ23456` })))
    cleanup()
    sesion.cerrar()

    montar(servidor(seguimiento({})))
    fireEvent.click(await screen.findByRole('button', { name: 'Compartir mi viaje' }))
    await waitFor(() => expect(compartir).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Viaje en vivo' })))
  })

  it('un viaje terminado muestra el recorrido y la puntualidad', async () => {
    const recorrido = {
      itineraryId: 'i-1',
      origen: 'Bogotá',
      destino: 'Tunja',
      recorrido: [
        { lat: 4.6, lng: -74.1, timestamp: '' },
        { lat: 5.5, lng: -73.4, timestamp: '' },
      ],
      paradas: [
        { orden: 1, nombre: 'Bogotá', lat: 4.6, lng: -74.1, programada: '', real: '', aTiempo: true },
        { orden: 2, nombre: 'Tunja', lat: 5.5, lng: -73.4, programada: '', real: '', aTiempo: false },
      ],
      puntualidad: {
        salidaProgramada: '2026-11-15T11:00:00Z',
        salidaReal: '2026-11-15T11:05:00Z',
        llegadaProgramada: '2026-11-15T14:00:00Z',
        llegadaReal: null,
        minutosRetrasoSalida: 5,
        minutosRetrasoLlegada: 0,
        paradasATiempo: 1,
        paradasTotal: 2,
      },
    }
    montar(servidor(seguimiento({ estado: 'FINALIZADO', estadoRastreo: 'FINALIZADO' }), { '/track': () => Response.json(recorrido) }))
    expect(await screen.findByText('Paradas a tiempo: 1 de 2')).toBeTruthy()
    expect(screen.getByText(/5 min tarde/)).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Recorrido del bus' })).toBeTruthy()
    expect(screen.getAllByText('Viaje terminado').length).toBeGreaterThan(0)
    cleanup()

    montar(servidor(seguimiento({ estado: 'FINALIZADO', estadoRastreo: 'FINALIZADO' }), { '/track': () => Response.json({ error: { code: 'TRIP_NOT_FINISHED', message: 'x' } }, { status: 404 }) }))
    expect(await screen.findByText('El recorrido estará disponible cuando termine el viaje.')).toBeTruthy()
  })

  it('si no ubica el viaje muestra el error', async () => {
    montar(servidor(seguimiento({}), { '/bus-position': () => Response.json({ error: { code: 'ITINERARY_NOT_FOUND', message: 'x' } }, { status: 404 }) }))
    expect(await screen.findByText('No pudimos ubicar el viaje')).toBeTruthy()
  })
})

describe('viaje compartido', () => {
  it('abre el viaje sin cuenta con un código vigente', async () => {
    montar(servidor(seguimiento({}), { '/share/ABCD2345': () => Response.json({ itineraryId: 'i-1', origen: 'Bogotá', destino: 'Tunja', fechaSalida: '', venceEn: '' }) }), '/compartido/ABCD2345')
    expect(screen.getByLabelText('Cargando')).toBeTruthy()
    expect(await screen.findByText(/En vivo · hace/)).toBeTruthy()
  })

  it('un enlace vencido avisa que ya no sirve', async () => {
    montar(servidor(seguimiento({}), { '/share/': () => Response.json({ error: { code: 'SHARE_LINK_NOT_FOUND', message: 'x' } }, { status: 404 }) }), '/compartido/VIEJO123')
    expect(await screen.findByText('Este enlace ya no sirve')).toBeTruthy()
    expect(screen.getByText('Este enlace venció o no existe.')).toBeTruthy()
  })
})
