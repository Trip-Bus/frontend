// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { sesion } from '@/lib/sesion'
import type { PrecioItinerario, Retencion } from '@/lib/tipos'
import { Reserva } from './Reserva'

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }))
vi.mock('sonner', () => ({ toast }))

const retencion: Retencion = {
  holdId: 'h-1',
  itineraryId: 'i-1',
  seatNumbers: ['3', '4'],
  userId: 'u',
  offerId: null,
  bookingId: null,
  estado: 'ACTIVA',
  creadoEn: '2026-11-15T10:00:00Z',
  expiraEn: new Date(Date.now() + 8 * 60_000).toISOString(),
  extendido: false,
  segundosRestantes: 480,
  fromOrden: 2,
  toOrden: 4,
}

const precio: PrecioItinerario = {
  itineraryId: 'i-1',
  precioBase: 100_000,
  moneda: 'COP',
  ofertaActiva: null,
  estado: 'PROGRAMADO',
  desglose: {
    itineraryId: 'i-1',
    origen: 'Fusagasugá',
    destino: 'Ibagué',
    salida: '2099-01-01T13:00:00Z',
    llegada: '2099-01-01T16:00:00Z',
    moneda: 'COP',
    precioBase: 100_000,
    precioTramo: 60_000,
    temporada: { id: 't', nombre: 'Navidad', multiplicador: 1.2 },
    pasajeros: [
      { tipo: 'ADULTO', precioTramo: 72_000, descuentoPorcentaje: 0, recargoCategoria: 15_000, seatCategoria: 'PREMIUM', precio: 87_000 },
      { tipo: 'NINO', precioTramo: 72_000, descuentoPorcentaje: 50, precio: 36_000 },
    ],
    total: 123_000,
  },
}

function servidor(alCrear: (body: Record<string, unknown>) => Response) {
  return vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = String(entrada)
    if (url.endsWith('/seats/holds/h-1')) return Response.json(retencion)
    if (url.includes('/itineraries/i-1/price')) return Response.json(precio)
    if (url.endsWith('/itineraries/i-1')) return Response.json({ itineraryId: 'i-1', origen: 'Bogotá', destino: 'Ibagué', fechaSalida: '2099-01-01T12:00:00Z', fechaLlegadaEstimada: '2099-01-01T17:00:00Z', empresa: 'Expreso', precioBase: 100_000, paradas: [] })
    if (url.endsWith('/bookings') && init?.method === 'POST') return alCrear(JSON.parse(String(init.body)))
    if (url.includes('/users/')) return Response.json({ id: 'u', nombre: 'Ana Pérez', email: 'a@x.co', rol: 'PASAJERO', companyId: null, activo: true })
    return Response.json({})
  })
}

function montar(fetchMock: ReturnType<typeof servidor>) {
  vi.stubGlobal('fetch', fetchMock)
  const router = createMemoryRouter([{ path: '/reserva/:holdId', element: h(Reserva) }, { path: '/pago/:id', element: h('p', null, 'Pagar') }], { initialEntries: ['/reserva/h-1'] })
  render(h(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }) }, h(RouterProvider, { router })))
  return router
}

beforeEach(() => {
  localStorage.clear()
  sesion.iniciar({ accessToken: 'a', expiresAt: new Date(Date.now() + 3_600_000).toISOString(), userId: 'u', rol: 'PASAJERO' })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  sesion.cerrar()
})

describe('datos de los pasajeros', () => {
  it('muestra el desglose del tramo y crea la reserva con tipo de pasajero y cupón', async () => {
    const fetchMock = servidor(() => Response.json({ bookingId: 'b-9' }, { status: 201 }))
    const router = montar(fetchMock)

    expect(await screen.findByRole('region', { name: 'Desglose del precio' })).toBeTruthy()
    expect(screen.getByText(/Tramo Fusagasugá → Ibagué/)).toBeTruthy()
    expect(screen.getByText('Temporada Navidad')).toBeTruthy()
    expect(screen.getByText(/Recargo de asiento PREMIUM/)).toBeTruthy()
    expect(screen.getByText('Descuento 50 %')).toBeTruthy()
    await waitFor(() => expect(screen.getByText('$123.000')).toBeTruthy())

    const nombres = screen.getAllByLabelText('Nombre completo')
    const documentos = screen.getAllByLabelText('Número de documento')
    fireEvent.change(nombres[0], { target: { value: 'Ana Pérez' } })
    fireEvent.change(documentos[0], { target: { value: '1234567' } })
    fireEvent.change(nombres[1], { target: { value: 'Tomás Pérez' } })
    fireEvent.change(documentos[1], { target: { value: '7654321' } })
    fireEvent.change(screen.getAllByLabelText('Tipo de pasajero')[1], { target: { value: 'NINO' } })
    fireEvent.change(screen.getByLabelText('Cupón de descuento (opcional)'), { target: { value: 'promo 10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ir a pagar' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/pago/b-9'))
    const crear = fetchMock.mock.calls.find(([u, i]) => String(u).endsWith('/bookings') && i?.method === 'POST')!
    expect(JSON.parse(String(crear[1]?.body))).toEqual({
      holdId: 'h-1',
      cupon: 'PROMO10',
      pasajeros: [
        { nombre: 'Ana Pérez', tipoDocumento: 'CC', numeroDocumento: '1234567', tipoPasajero: 'ADULTO' },
        { nombre: 'Tomás Pérez', tipoDocumento: 'CC', numeroDocumento: '7654321', tipoPasajero: 'NINO' },
      ],
    })
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/price?from=2&to=4&tipos=ADULTO%2CNINO'))).toBe(true)
  })

  it('muestra el error del cupón junto al campo', async () => {
    montar(servidor(() => Response.json({ error: { code: 'COUPON_EXPIRED', message: 'x' } }, { status: 409 })))
    await screen.findByRole('region', { name: 'Desglose del precio' })
    screen.getAllByLabelText('Nombre completo').forEach((n, i) => fireEvent.change(n, { target: { value: `Pasajero ${i}` } }))
    screen.getAllByLabelText('Número de documento').forEach((n, i) => fireEvent.change(n, { target: { value: `12345${i}` } }))
    fireEvent.change(screen.getByLabelText('Cupón de descuento (opcional)'), { target: { value: 'VIEJO' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ir a pagar' }))
    expect(await screen.findByText('Ese cupón ya venció.')).toBeTruthy()
  })

  it('si el precio no se puede calcular lo avisa sin bloquear la compra', async () => {
    const fetchMock = vi.fn(async (entrada: RequestInfo | URL) => {
      const url = String(entrada)
      if (url.includes('/price')) return Response.json({ error: { code: 'PRICING_UNAVAILABLE', message: 'x' } }, { status: 503 })
      if (url.endsWith('/seats/holds/h-1')) return Response.json(retencion)
      return Response.json({ itineraryId: 'i-1', origen: 'A', destino: 'B', fechaSalida: '2099-01-01T12:00:00Z', fechaLlegadaEstimada: '2099-01-01T13:00:00Z', empresa: 'E', precioBase: 50_000, paradas: [] })
    })
    montar(fetchMock as unknown as ReturnType<typeof servidor>)
    expect(await screen.findByText(/No pudimos calcular el precio/)).toBeTruthy()
    expect(screen.getByText('$100.000')).toBeTruthy()
  })
})
