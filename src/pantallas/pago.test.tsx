// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { sesion } from '@/lib/sesion'
import type { Reserva } from '@/lib/tipos'
import { Pago } from './Pago'

const { toast, descargarBlob } = vi.hoisted(() => ({ toast: vi.fn(), descargarBlob: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
vi.mock('@/features/descarga', () => ({ descargarBlob }))
vi.mock('@/lib/tiempoReal', () => ({ useIntervaloRespaldo: () => 5000, useTopico: vi.fn(), topicos: {} }))

const reserva: Reserva = {
  bookingId: 'b-1',
  estado: 'PENDIENTE_PAGO',
  holdId: 'h-1',
  itineraryId: 'i-1',
  offerId: null,
  seatNumbers: ['7'],
  pasajeros: [{ nombre: 'Ana Pérez', tipoDocumento: 'CC', numeroDocumento: '1234', asiento: '7' }],
  precioUnitario: 80_000,
  total: 80_000,
  moneda: 'COP',
  holdExpiraEn: new Date(Date.now() + 9 * 60_000).toISOString(),
  pago: null,
  ticketId: null,
  creadoEn: '2026-11-15T10:00:00Z',
  actualizadoEn: '2026-11-15T10:00:00Z',
}

const detalle = { itineraryId: 'i-1', origen: 'Bogotá', destino: 'Tunja', fechaSalida: '2099-01-01T12:00:00Z', fechaLlegadaEstimada: '2099-01-01T15:00:00Z', empresa: 'E', paradas: [] }

function servidor(reservaActual: () => Reserva, alPagar: (body: unknown) => Response = () => Response.json({ paymentId: 'p', bookingId: 'b-1', estado: 'PENDIENTE', monto: 1, moneda: 'COP', mensaje: null }, { status: 202 })) {
  return vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = String(entrada)
    if (url.endsWith('/bookings/b-1/pay')) return alPagar(JSON.parse(String(init?.body)))
    if (url.endsWith('/bookings/b-1')) return Response.json(reservaActual())
    if (url.endsWith('/payments/pse/banks')) return Response.json([{ codigo: '1', nombre: 'Banco que aprueba' }])
    if (url.includes('/receipt.pdf')) return new Response(new Blob(['%PDF']), { status: 200 })
    if (url.includes('/itineraries/')) return Response.json(detalle)
    return Response.json({})
  })
}

function montar(fetchMock: ReturnType<typeof servidor>) {
  vi.stubGlobal('fetch', fetchMock)
  const router = createMemoryRouter([{ path: '/pago/:bookingId', element: h(Pago) }, { path: '*', element: h('p', null, 'Otra') }], { initialEntries: ['/pago/b-1'] })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(h(QueryClientProvider, { client: queryClient }, h(RouterProvider, { router })))
}

async function sostenerPagar() {
  const boton = await screen.findByRole('button', { name: /Mantén presionado/ })
  fireEvent.keyDown(boton, { key: 'Enter' })
  await act(() => vi.advanceTimersByTimeAsync(2_100))
}

const pagoDe = (fetchMock: ReturnType<typeof servidor>) => fetchMock.mock.calls.find(([u]) => String(u).endsWith('/pay'))

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  sesion.iniciar({ accessToken: 'a', expiresAt: new Date(Date.now() + 3_600_000).toISOString(), userId: 'u', rol: 'PASAJERO' })
  sessionStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  sesion.cerrar()
})

describe('pago', () => {
  it('muestra la carga y luego el error si la reserva no existe', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})))
    const router = createMemoryRouter([{ path: '/pago/:bookingId', element: h(Pago) }], { initialEntries: ['/pago/b-1'] })
    render(h(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }, h(RouterProvider, { router })))
    expect(screen.getByLabelText('Cargando')).toBeTruthy()
    cleanup()
    montar(vi.fn(async () => Response.json({ error: { code: 'BOOKING_NOT_FOUND', message: 'x' } }, { status: 404 })) as unknown as ReturnType<typeof servidor>)
    expect(await screen.findByText('No encontramos tu reserva')).toBeTruthy()
  })

  it('valida la tarjeta antes de pagar y paga con el token sandbox', async () => {
    let actual = reserva
    const fetchMock = servidor(() => actual)
    montar(fetchMock)
    await sostenerPagar()
    expect(toast).toHaveBeenCalledWith('Revisa los datos de la tarjeta.')
    expect(pagoDe(fetchMock)).toBeUndefined()

    fireEvent.change(screen.getByLabelText('Número de tarjeta'), { target: { value: '4242424242424242' } })
    fireEvent.change(screen.getByLabelText('Vence'), { target: { value: '1230' } })
    fireEvent.change(screen.getByLabelText('CVC'), { target: { value: '123' } })
    actual = { ...reserva, estado: 'PAGO_EN_PROCESO', pago: { paymentId: 'p', estado: 'PENDIENTE', monto: 1, metodo: 'TARJETA', tarjetaUltimos4: '4242', motivoRechazo: null, actualizadoEn: '' } }
    await sostenerPagar()
    await waitFor(() => expect(pagoDe(fetchMock)).toBeTruthy())
    expect(JSON.parse(String(pagoDe(fetchMock)![1]?.body))).toMatchObject({ metodo: 'TARJETA', cardToken: 'tok_visa_approved', cardLast4: '4242' })
    expect(await screen.findByText('Confirmando con tu banco…')).toBeTruthy()
  })

  it('PSE pide banco y documento y lleva a la página del banco', async () => {
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign, origin: 'http://localhost' })
    const fetchMock = servidor(
      () => reserva,
      () => Response.json({ paymentId: 'p', bookingId: 'b-1', estado: 'PENDIENTE', monto: 1, moneda: 'COP', mensaje: null, redirectUrl: 'https://banco.test/pse/1' }, { status: 202 }),
    )
    montar(fetchMock)
    fireEvent.click(await screen.findByRole('radio', { name: 'PSE' }))
    await sostenerPagar()
    expect(await screen.findByText('Elige tu banco.')).toBeTruthy()

    await screen.findByRole('option', { name: 'Banco que aprueba' })
    fireEvent.change(screen.getByLabelText('Banco'), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('radio', { name: 'Empresa' }))
    fireEvent.change(screen.getByLabelText('Número'), { target: { value: '900123456' } })
    await sostenerPagar()
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://banco.test/pse/1'))
    expect(JSON.parse(String(pagoDe(fetchMock)![1]?.body))).toEqual({
      metodo: 'PSE',
      pse: { bancoCodigo: '1', tipoPersona: 'JURIDICA', tipoDocumento: 'CC', numeroDocumento: '900123456' },
    })
    const headers = pagoDe(fetchMock)![1]?.headers as Record<string, string>
    expect(headers['Idempotency-Key']).toBeTruthy()
  })

  it('Nequi valida el celular y espera la aprobación en la app', async () => {
    let actual = reserva
    const fetchMock = servidor(
      () => actual,
      () => {
        actual = { ...reserva, estado: 'PAGO_EN_PROCESO', pago: { paymentId: 'p', estado: 'PENDIENTE', monto: 1, metodo: 'NEQUI', tarjetaUltimos4: null, motivoRechazo: null, actualizadoEn: '' } }
        return Response.json({ paymentId: 'p', bookingId: 'b-1', estado: 'PENDIENTE', monto: 1, moneda: 'COP', mensaje: null }, { status: 202 })
      },
    )
    montar(fetchMock)
    fireEvent.click(await screen.findByRole('radio', { name: 'Nequi' }))
    fireEvent.change(screen.getByLabelText('Celular de tu cuenta Nequi'), { target: { value: '12345' } })
    await sostenerPagar()
    expect(await screen.findByText('Escribe un celular de 10 dígitos que empiece por 3.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Celular de tu cuenta Nequi'), { target: { value: '399-111-1111' } })
    await sostenerPagar()
    expect(await screen.findByText('Acepta el pago en tu app Nequi')).toBeTruthy()
    expect(JSON.parse(String(pagoDe(fetchMock)![1]?.body))).toEqual({ metodo: 'NEQUI', nequi: { telefono: '3991111111' } })
  })

  it('confirmada: muestra el pase y descarga el comprobante', async () => {
    const confirmada: Reserva = { ...reserva, estado: 'CONFIRMADA', ticketId: 't-1', pago: { paymentId: 'pay-1', estado: 'APROBADO', monto: 1, metodo: 'NEQUI', tarjetaUltimos4: null, motivoRechazo: null, actualizadoEn: '' } }
    montar(servidor(() => confirmada))
    expect(await screen.findByText('Pago aprobado')).toBeTruthy()
    expect(screen.getByText(/con Nequi/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Descargar comprobante de pago' }))
    await waitFor(() => expect(descargarBlob).toHaveBeenCalledWith(expect.any(Blob), 'comprobante-b-1.pdf'))
    expect(screen.getByRole('link', { name: 'Ver mi pase de abordar' }).getAttribute('href')).toBe('/pase/t-1')
  })

  it('avisa el rechazo con el motivo del medio de pago', async () => {
    montar(servidor(() => ({ ...reserva, estado: 'PAGO_RECHAZADO', pago: { paymentId: 'p', estado: 'RECHAZADO', monto: 1, metodo: 'NEQUI', tarjetaUltimos4: null, motivoRechazo: 'NEQUI_RECHAZADO', actualizadoEn: '' } })))
    expect(await screen.findByText('Tu banco no aprobó el pago')).toBeTruthy()
    expect(screen.getByText(/Nequi no aprobó el pago/)).toBeTruthy()
  })

  it('muestra el error del servidor al pagar', async () => {
    const fetchMock = servidor(() => reserva, () => Response.json({ error: { code: 'BOOKING_NOT_PAYABLE', message: 'x' } }, { status: 409 }))
    montar(fetchMock)
    fireEvent.click(await screen.findByRole('radio', { name: 'Nequi' }))
    fireEvent.change(screen.getByLabelText('Celular de tu cuenta Nequi'), { target: { value: '3992222222' } })
    await sostenerPagar()
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Esta reserva ya no se puede pagar.'))
  })
})
