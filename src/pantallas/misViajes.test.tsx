// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { avisos } from '@/features/avisos'
import { sesion } from '@/lib/sesion'
import type { ViajeMio } from '@/lib/tipos'
import { MisTiquetes } from './MisTiquetes'

const { toast, descargarBlob, compartir } = vi.hoisted(() => ({ toast: vi.fn(), descargarBlob: vi.fn(), compartir: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
vi.mock('@/features/descarga', () => ({ descargarBlob }))

const viaje = (v: Partial<ViajeMio>): ViajeMio => ({
  bookingId: 'b-1',
  estado: 'CONFIRMADA',
  canal: 'APP',
  itineraryId: 'i-1',
  origen: 'Bogotá',
  destino: 'Tunja',
  fechaSalida: '2099-01-01T12:00:00Z',
  empresa: 'Expreso',
  seatNumbers: ['7'],
  ticketId: 't-1',
  estadoTiquete: 'EMITIDO',
  total: 80_000,
  moneda: 'COP',
  puedeReprogramar: true,
  puedeCambiarAsiento: true,
  ...v,
})

type Rutas = Record<string, (url: string, init?: RequestInit) => Response>

function servidor(rutas: Rutas) {
  return vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = String(entrada)
    const clave = Object.keys(rutas).find((k) => url.includes(k))
    if (clave) return rutas[clave](url, init)
    if (url.endsWith('/bookings/affected')) return Response.json([])
    if (url.endsWith('/bookings')) return Response.json([])
    return Response.json({})
  })
}

function montar(fetchMock: ReturnType<typeof servidor>, ruta = '/mis-tiquetes') {
  vi.stubGlobal('fetch', fetchMock)
  const router = createMemoryRouter([{ path: '/mis-tiquetes', element: h(MisTiquetes) }, { path: '*', element: h('p', null, 'Otra pantalla') }], { initialEntries: [ruta] })
  render(h(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }) }, h(RouterProvider, { router })))
  return router
}

const pagina = (items: ViajeMio[], page = 0, totalPages = 1, totalElements = items.length) => Response.json({ items, page, size: 10, totalElements, totalPages })

beforeEach(() => {
  localStorage.clear()
  avisos.limpiar()
  sesion.iniciar({ accessToken: 'a', expiresAt: new Date(Date.now() + 3_600_000).toISOString(), userId: 'u', rol: 'PASAJERO' })
  Object.defineProperty(navigator, 'share', { value: compartir, configurable: true })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  sesion.cerrar()
})

describe('mis viajes', () => {
  it('lista los próximos con estados, carga más y abre las acciones', async () => {
    const fetchMock = servidor({
      'scope=proximos&page=0': () => pagina([viaje({}), viaje({ bookingId: 'b-2', canal: 'TAQUILLA', tramo: { fromOrden: 2, paradaAbordaje: 'Chocontá', toOrden: 3, paradaBajada: 'Tunja' } })], 0, 2, 3),
      'scope=proximos&page=1': () => pagina([viaje({ bookingId: 'b-3', estado: 'REPROGRAMADA', estadoTiquete: 'REPROGRAMADO' })], 1, 2, 3),
      '/tickets/t-1/resend': () => new Response(null, { status: 202 }),
      '/tickets/t-1/pdf': () => new Response('%PDF'),
      '/bookings/b-1': () => Response.json({ bookingId: 'b-1', pago: { paymentId: 'pay-1' } }),
      '/payments/pay-1/receipt.pdf': () => new Response('%PDF'),
      '/share-links': () => Response.json({ codigo: 'ABCD2345', itineraryId: 'i-1', venceEn: '2099-01-02T00:00:00Z' }, { status: 201 }),
    })
    montar(fetchMock)

    expect(await screen.findAllByText('Vigente')).toHaveLength(2)
    expect(screen.getByText('Tramo Chocontá → Tunja')).toBeTruthy()
    expect(screen.getByText('Taquilla')).toBeTruthy()
    expect(screen.getByText('2 de 3')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }))
    expect(await screen.findByText('Reprogramado')).toBeTruthy()

    fireEvent.click(screen.getAllByRole('button', { name: /Bogotá a Tunja/ })[0])
    const hoja = await screen.findByRole('dialog')
    expect(within(hoja).getByRole('link', { name: 'Ver mi pase de abordar' }).getAttribute('href')).toBe('/pase/t-1')
    expect(within(hoja).getByRole('link', { name: 'Reprogramar' }).getAttribute('href')).toBe('/reprogramar/b-1')
    expect(within(hoja).getByRole('link', { name: 'Cambiar de puesto' }).getAttribute('href')).toBe('/tiquete/t-1/cambios?que=asiento')
    expect(within(hoja).getByRole('link', { name: 'Corregir datos del pasajero' }).getAttribute('href')).toBe('/tiquete/t-1/cambios?que=datos')

    fireEvent.click(within(hoja).getByRole('button', { name: 'Reenviar al correo' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Te reenviamos el tiquete al correo.'))
    fireEvent.click(within(hoja).getByRole('button', { name: 'Descargar el tiquete (PDF)' }))
    await waitFor(() => expect(descargarBlob).toHaveBeenCalledWith(expect.objectContaining({ size: expect.any(Number) }), 'tiquete-t-1.pdf'))
    fireEvent.click(within(hoja).getByRole('button', { name: 'Comprobante de pago' }))
    await waitFor(() => expect(descargarBlob).toHaveBeenCalledWith(expect.objectContaining({ size: expect.any(Number) }), 'comprobante-b-1.pdf'))
    fireEvent.click(within(hoja).getByRole('button', { name: 'Compartir mi viaje' }))
    await waitFor(() => expect(compartir).toHaveBeenCalledWith(expect.objectContaining({ url: `${location.origin}/compartido/ABCD2345` })))
  })

  it('en pasados ofrece el comprobante de reembolso y reprogramar un no-show', async () => {
    avisos.agregar('RefundProcessed', { bookingId: 'b-r', refundId: 'ref-1' }, 'e-1')
    const fetchMock = servidor({
      'scope=pasados': () =>
        pagina([
          viaje({ bookingId: 'b-r', estado: 'REEMBOLSADA', estadoTiquete: 'ANULADO', ticketId: 't-r', puedeReprogramar: false, puedeCambiarAsiento: false }),
          viaje({ bookingId: 'b-n', estadoTiquete: 'NO_SHOW', ticketId: 't-n', puedeReprogramar: false, puedeCambiarAsiento: false }),
        ]),
      '/refunds/ref-1/receipt.pdf': () => new Response('%PDF'),
      '/bookings/b-r': () => Response.json({ bookingId: 'b-r', pago: null }),
    })
    montar(fetchMock, '/mis-tiquetes?pestana=pasados')
    expect(await screen.findByText('Anulado')).toBeTruthy()
    expect(screen.getByText('Reembolsada')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: /Bogotá a Tunja/ })[0])
    const hoja = await screen.findByRole('dialog')
    fireEvent.click(within(hoja).getByRole('button', { name: 'Comprobante de reembolso' }))
    await waitFor(() => expect(descargarBlob).toHaveBeenCalledWith(expect.objectContaining({ size: expect.any(Number) }), 'reembolso-b-r.pdf'))
    fireEvent.click(within(hoja).getByRole('button', { name: 'Comprobante de pago' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith('El comprobante estará listo cuando se apruebe el pago.'))
    cleanup()

    montar(fetchMock, '/mis-tiquetes?pestana=pasados')
    fireEvent.click((await screen.findAllByRole('button', { name: /Bogotá a Tunja/ }))[1])
    expect((await screen.findByRole('link', { name: 'Reprogramar (cargo del 20 %)' })).getAttribute('href')).toBe('/reprogramar/b-n')
  })

  it('cambia de pestaña, muestra el vacío y lo que falta pagar', async () => {
    const fetchMock = servidor({
      'scope=': () => pagina([]),
      '/itineraries/i-1': () => Response.json({ itineraryId: 'i-1', origen: 'Bogotá', destino: 'Tunja', fechaSalida: '2099-01-01T12:00:00Z' }),
      '/bookings/affected': () => Response.json([{ bookingId: 'b-a', estado: 'PENDIENTE', causa: 'CANCELACION', plazoDecision: '2099-01-01T00:00:00Z', opciones: [], itineraryId: 'i', ticketId: null, decididoEn: null, decididoPor: null, bookingNuevoId: null }]),
      'bookings': (url) =>
        url.endsWith('/bookings')
          ? Response.json([{ bookingId: 'b-p', estado: 'PENDIENTE_PAGO', holdExpiraEn: new Date(Date.now() + 300_000).toISOString(), itineraryId: 'i-1', seatNumbers: ['2'], total: 50_000 }])
          : Response.json({}),
    })
    const router = montar(fetchMock)
    expect(await screen.findByText(/No tienes viajes próximos/)).toBeTruthy()
    expect(await screen.findByText('Un viaje tuyo tuvo un cambio')).toBeTruthy()
    expect(await screen.findByText(/Apartado por/)).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Pasados' }))
    await waitFor(() => expect(router.state.location.search).toBe('?pestana=pasados'))
    expect(await screen.findByText('Aún no tienes viajes pasados.')).toBeTruthy()
  })

  it('sin conexión muestra los pases guardados en el teléfono', async () => {
    localStorage.setItem('tripbus.pases', JSON.stringify([{ ticketId: 't-g', origen: 'Bogotá', destino: 'Tunja', fechaSalida: '2099-01-01T12:00:00Z', seatNumbers: ['1'] }]))
    montar(servidor({ 'scope=': () => Response.json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'x' } }, { status: 503 }) }))
    expect(await screen.findByText(/Estos son los pases guardados/)).toBeTruthy()
  })
})
