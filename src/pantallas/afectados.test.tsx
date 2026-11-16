// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { sesion } from '@/lib/sesion'
import type { ReservaAfectada } from '@/lib/tipos'
import { plazoRestante } from '@/lib/formato'
import { Afectados } from './Afectados'
import { Reprogramar } from './Reprogramar'

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }))
vi.mock('sonner', () => ({ toast }))

const afectada = (a: Partial<ReservaAfectada>): ReservaAfectada => ({
  bookingId: 'b-1',
  ticketId: 't-1',
  itineraryId: 'i-1',
  causa: 'RETRASO',
  estado: 'PENDIENTE',
  plazoDecision: new Date(Date.now() + (23 * 60 + 10) * 60_000).toISOString(),
  opciones: ['ACEPTAR', 'REUBICAR', 'REEMBOLSO'],
  decididoEn: null,
  decididoPor: null,
  bookingNuevoId: null,
  ...a,
})

const detalle = (id: string, estado = 'PROGRAMADO') => ({ itineraryId: id, origen: 'Bogotá', destino: 'Tunja', fechaSalida: '2099-01-01T14:00:00Z', fechaLlegadaEstimada: '2099-01-01T17:00:00Z', estado, empresa: 'Expreso', precioBase: 80_000, paradas: [] })

const mapa = {
  itineraryId: 'i-2',
  busId: 'bus',
  placa: 'X',
  tipoBus: 'UN_PISO',
  capacidad: 2,
  asientos: ['1', '2'],
  distribucion: { tipo: 'UN_PISO', capacidad: 2, pisos: [{ piso: 1, filas: 1, columnas: 2, celdas: [{ fila: 1, columna: 1, tipo: 'ASIENTO', asiento: '1' }, { fila: 1, columna: 2, tipo: 'ASIENTO', asiento: '2' }] }] },
}
const estados = { itineraryId: 'i-2', capacidad: 2, resumen: { disponibles: 2, retenidos: 0, vendidos: 0, enOferta: 0 }, asientos: ['1', '2'].map((n) => ({ seatNumber: n, estado: 'DISPONIBLE', offerId: null, propio: false })) }

function servidor(extra: Record<string, (init?: RequestInit) => Response> = {}) {
  return vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = String(entrada)
    const k = Object.keys(extra).find((x) => url.includes(x))
    if (k) return extra[k](init)
    if (url.includes('/seats/itineraries/i-2')) return Response.json(estados)
    if (url.includes('/itineraries/i-2/seatmap')) return Response.json(mapa)
    if (url.includes('/itineraries/i-1')) return Response.json(detalle('i-1'))
    if (url.includes('/trips/search')) return Response.json([{ ...detalle('i-1'), duracionMinutos: 180, agotado: false }, { ...detalle('i-2'), fechaSalida: '2099-01-01T18:00:00Z', duracionMinutos: 180, agotado: false, asientosDisponibles: 2, ofertaActiva: null }])
    if (url.endsWith('/bookings/b-1')) return Response.json({ bookingId: 'b-1', itineraryId: 'i-1', seatNumbers: ['5'], pasajeros: [] })
    if (url.endsWith('/seats/holds')) return Response.json({ holdId: 'h-9' }, { status: 201 })
    return Response.json({})
  })
}

function montar(fetchMock: ReturnType<typeof servidor>, ruta: string) {
  vi.stubGlobal('fetch', fetchMock)
  const router = createMemoryRouter(
    [
      { path: '/afectados', element: h(Afectados) },
      { path: '/reprogramar/:bookingId', element: h(Reprogramar) },
      { path: '*', element: h('p', null, 'Otra') },
    ],
    { initialEntries: [ruta] },
  )
  render(h(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }) }, h(RouterProvider, { router })))
  return router
}

const llamadas = (f: ReturnType<typeof servidor>, parte: string) => f.mock.calls.filter(([u, i]) => String(u).includes(parte) && i?.method === 'POST')

beforeEach(() => sesion.iniciar({ accessToken: 'a', expiresAt: new Date(Date.now() + 3_600_000).toISOString(), userId: 'u', rol: 'PASAJERO' }))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  sesion.cerrar()
})

describe('viajes afectados por la empresa', () => {
  it('cuenta el plazo', () => {
    const ahora = Date.parse('2026-11-15T10:00:00Z')
    expect(plazoRestante('2026-11-16T09:10:00Z', ahora)).toBe('Te quedan 23 h 10 min')
    expect(plazoRestante('2026-11-15T10:25:00Z', ahora)).toBe('Te quedan 25 min')
    expect(plazoRestante('2026-11-15T09:00:00Z', ahora)).toBe('El plazo terminó')
  })

  it('un retraso permite aceptar, reprogramar gratis o el reembolso', async () => {
    const fetchMock = servidor({
      '/bookings/affected': () => Response.json([afectada({}), afectada({ bookingId: 'b-2', estado: 'REEMBOLSADA', decididoPor: 'SISTEMA' })]),
      '/affected/accept': () => Response.json(afectada({ estado: 'ACEPTO_CAMBIO' })),
      '/affected/refund': () => Response.json(afectada({ estado: 'REEMBOLSADA' })),
    })
    montar(fetchMock, '/afectados')
    const tarjeta = (await screen.findAllByRole('article', { name: 'Tu viaje sale más de una hora tarde' }))[0]
    expect(within(tarjeta).getByRole('timer').textContent).toMatch(/Te quedan 23 h/)
    expect(within(tarjeta).getByText(/tu tiquete sigue válido con el nuevo horario/)).toBeTruthy()
    expect(within(tarjeta).getByRole('link', { name: 'Reprogramar gratis' }).getAttribute('href')).toBe('/reprogramar/b-1?afectado=1')
    expect(screen.getByText(/Te devolvimos el dinero. Lo aplicamos automáticamente/)).toBeTruthy()

    fireEvent.click(within(tarjeta).getByRole('button', { name: 'Aceptar el nuevo horario' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Listo: viajas con el nuevo horario.'))
    fireEvent.click(within(tarjeta).getByRole('button', { name: 'Quiero el reembolso' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, quiero el reembolso' }))
    await waitFor(() => expect(llamadas(fetchMock, '/affected/refund')).toHaveLength(1))
  })

  it('una cancelación no ofrece aceptar y muestra el error del servidor', async () => {
    montar(
      servidor({
        '/bookings/affected': () => Response.json([afectada({ causa: 'CANCELACION', opciones: [] })]),
        '/affected/refund': () => Response.json({ error: { code: 'DECISION_WINDOW_CLOSED', message: 'x' } }, { status: 409 }),
      }),
      '/afectados',
    )
    const tarjeta = await screen.findByRole('article', { name: 'La empresa canceló tu viaje' })
    expect(within(tarjeta).queryByRole('button', { name: 'Aceptar el nuevo horario' })).toBeNull()
    expect(within(tarjeta).getByText(/te ubicamos en el siguiente viaje/)).toBeTruthy()
    fireEvent.click(within(tarjeta).getByRole('button', { name: 'Quiero el reembolso' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, quiero el reembolso' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith('El plazo para elegir terminó y aplicamos la opción automática.'))
  })

  it('sin viajes afectados lo dice', async () => {
    montar(servidor({ '/bookings/affected': () => Response.json([]) }), '/afectados')
    expect(await screen.findByText('No tienes viajes afectados por la empresa.')).toBeTruthy()
  })
})

describe('reprogramar', () => {
  it('reprograma gratis un viaje afectado con un puesto del viaje nuevo', async () => {
    const fetchMock = servidor({ '/affected/reschedule': () => Response.json(afectada({ estado: 'REPROGRAMADA' })) })
    const router = montar(fetchMock, '/reprogramar/b-1?afectado=1')
    expect(await screen.findByText(/el cambio no tiene costo/)).toBeTruthy()
    const opciones = await screen.findAllByRole('radio')
    expect(opciones).toHaveLength(1)
    fireEvent.click(opciones[0])
    const puesto = await screen.findByRole('button', { name: /Puesto 2,/ })
    await waitFor(() => expect((puesto as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(puesto)
    expect(screen.getByText('Elegiste 2 (1 de 1)')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar el cambio gratis' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/mis-tiquetes'))
    expect(JSON.parse(String(llamadas(fetchMock, '/seats/holds')[0][1]?.body))).toEqual({ itineraryId: 'i-2', seatNumbers: ['2'] })
    expect(JSON.parse(String(llamadas(fetchMock, '/affected/reschedule')[0][1]?.body))).toEqual({ holdId: 'h-9' })
  })

  it('con diferencia de precio lleva a pagar; si falla suelta el puesto', async () => {
    const fetchMock = servidor({ '/bookings/b-1/reschedule': () => Response.json({ bookingId: 'b-new', estado: 'PENDIENTE_PAGO', total: 12_000 }, { status: 201 }) })
    const router = montar(fetchMock, '/reprogramar/b-1')
    expect(await screen.findByText(/máximo 2 veces/)).toBeTruthy()
    fireEvent.click((await screen.findAllByRole('radio'))[0])
    const puesto = await screen.findByRole('button', { name: /Puesto 1,/ })
    await waitFor(() => expect((puesto as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(puesto)
    fireEvent.click(screen.getByRole('button', { name: 'Reprogramar' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/pago/b-new'))
    cleanup()

    const falla = servidor({ '/bookings/b-1/reschedule': () => Response.json({ error: { code: 'RESCHEDULE_WINDOW_CLOSED', message: 'x' } }, { status: 409 }) })
    montar(falla, '/reprogramar/b-1')
    fireEvent.click((await screen.findAllByRole('radio'))[0])
    const otro = await screen.findByRole('button', { name: /Puesto 1,/ })
    await waitFor(() => expect((otro as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(otro)
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2099-01-02' } })
    fireEvent.click((await screen.findAllByRole('radio'))[0])
    const denuevo = await screen.findByRole('button', { name: /Puesto 1,/ })
    await waitFor(() => expect((denuevo as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(denuevo)
    fireEvent.click(screen.getByRole('button', { name: 'Reprogramar' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Solo puedes reprogramar hasta 3 horas antes de la salida.'))
    expect(falla.mock.calls.some(([u, i]) => String(u).endsWith('/seats/holds/h-9') && i?.method === 'DELETE')).toBe(true)
  })

  it('muestra el error si la reserva no existe', async () => {
    montar(vi.fn(async () => Response.json({ error: { code: 'BOOKING_NOT_FOUND', message: 'x' } }, { status: 404 })) as unknown as ReturnType<typeof servidor>, '/reprogramar/b-x')
    expect(await screen.findByText('No encontramos tu reserva')).toBeTruthy()
  })
})
