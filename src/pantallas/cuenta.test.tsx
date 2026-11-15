// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { sesion } from '@/lib/sesion'
import type { Perfil, Reserva, Rol } from '@/lib/tipos'
import { Cuenta } from './Cuenta'
import { CuentaDatos } from './CuentaDatos'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  sesion.cerrar()
})

function iniciarSesion(rol: Rol = 'PASAJERO') {
  sesion.iniciar({
    accessToken: 'access',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    userId: 'user-1',
    rol,
  })
}

const perfil: Perfil = {
  id: 'user-1',
  email: 'ana@example.com',
  emailVerificado: false,
  nombre: 'Ana Pérez',
  telefono: null,
  documentoIdentidad: null,
  rol: 'PASAJERO',
  companyId: null,
  fechaCreacion: '2026-01-01T00:00:00Z',
}

const reserva: Reserva = {
  bookingId: 'booking-1',
  estado: 'CONFIRMADA',
  holdId: 'hold-1',
  itineraryId: 'trip-1',
  offerId: null,
  seatNumbers: ['1'],
  pasajeros: [],
  precioUnitario: 100,
  total: 100,
  moneda: 'COP',
  holdExpiraEn: '2026-01-01T00:00:00Z',
  pago: null,
  ticketId: 'ticket-1',
  creadoEn: '2026-01-01T00:00:00Z',
  actualizadoEn: '2026-01-01T00:00:00Z',
}

function renderCuenta(ruta: 'cuenta' | 'datos', respuesta: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => respuesta(String(url), init))
  vi.stubGlobal('fetch', fetchMock)
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const router = createMemoryRouter([
    { path: '/cuenta', element: h(Cuenta) },
    { path: '/cuenta/datos', element: h(CuentaDatos) },
    { path: '/', element: h('p', null, 'Inicio') },
  ], { initialEntries: [ruta === 'cuenta' ? '/cuenta' : '/cuenta/datos'] })
  render(h(QueryClientProvider, { client: cliente }, h(RouterProvider, { router })))
  return { fetchMock, cliente, router }
}

beforeEach(() => iniciarSesion())

describe('cuenta y datos personales', () => {
  it('presenta perfil sin verificar, permite reenviar verificación y cancelar logout', async () => {
    const fetches = (url: string) => {
      if (url.endsWith('/users/me')) return Response.json(perfil)
      if (url.endsWith('/bookings')) return Response.json([reserva])
      if (url.endsWith('/auth/verify-email/resend')) return new Response(null, { status: 204 })
      if (url.endsWith('/auth/logout')) return new Response(null, { status: 204 })
      return Response.json({}, { status: 404 })
    }
    const { fetchMock } = renderCuenta('cuenta', fetches)
    expect(await screen.findByText('Ana Pérez')).toBeTruthy()
    expect(screen.getByText('Tu correo aún no está verificado.')).toBeTruthy()
    expect(screen.getByText('1 tiquete comprado')).toBeTruthy()
    expect(screen.getByText('Cambiar tu contraseña')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Reenviar enlace' }))
    expect(await screen.findByRole('button', { name: 'Enviado' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Cerrar sesión/ }))
    expect(await screen.findByText('¿Cerrar sesión?')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Seguir conectado' }))
    await waitFor(() => expect(screen.queryByText('¿Cerrar sesión?')).toBeNull())
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/auth/logout'))).toBe(false)
  })

  it('muestra la alternativa de operador y cierra sesión incluso si logout falla', async () => {
    iniciarSesion('OPERADOR')
    const { router } = renderCuenta('cuenta', (url) => {
      if (url.endsWith('/users/me')) return Response.json({ ...perfil, rol: 'OPERADOR', emailVerificado: true })
      if (url.endsWith('/bookings')) return Response.json([])
      if (url.endsWith('/auth/logout')) return Response.json({ error: { code: 'HTTP_500', message: 'error' } }, { status: 500 })
      return Response.json({})
    })
    expect(await screen.findByText('Operador')).toBeTruthy()
    expect(screen.getByText('Aún no has comprado')).toBeTruthy()
    expect(screen.getByText('Contraseña y verificación en dos pasos')).toBeTruthy()
    expect(screen.getByText('Panel de la empresa')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Cerrar sesión/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar sesión' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(sesion.obtener()).toBeNull()
  })

  it('edita datos, rechaza un celular inválido y deja disponible la descarga', async () => {
    let perfilActual = perfil
    const { fetchMock } = renderCuenta('datos', (url, init) => {
      if (url.endsWith('/users/me') && init?.method === 'PUT') {
        const datos = JSON.parse(String(init.body)) as { nombre: string; telefono: string | null }
        perfilActual = { ...perfilActual, nombre: datos.nombre, telefono: datos.telefono, documentoIdentidad: '123456' }
        return Response.json(perfilActual)
      }
      if (url.endsWith('/users/me')) return Response.json(perfilActual)
      if (url.endsWith('/users/me/data')) return Response.json({ perfil: {}, generadoEn: new Date().toISOString() })
      return Response.json({})
    })
    expect(await screen.findByLabelText('Nombre completo')).toBeTruthy()
    const guardar = screen.getByRole('button', { name: 'Guardar cambios' }) as HTMLButtonElement
    expect(guardar.disabled).toBe(true)

    fireEvent.change(screen.getByLabelText('Celular'), { target: { value: '123' } })
    expect(screen.getByText('Escribe un celular de 10 dígitos que empiece por 3.')).toBeTruthy()
    expect(guardar.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Nombre completo'), { target: { value: '  Ana María  ' } })
    fireEvent.change(screen.getByLabelText('Celular'), { target: { value: '300 123 4567' } })
    expect(guardar.disabled).toBe(false)
    fireEvent.click(guardar)
    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(true))
    expect(JSON.parse(String(fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')?.[1]?.body))).toEqual({
      nombre: 'Ana María',
      telefono: '3001234567',
    })

    const crearUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:datos')
    const revocarUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    fireEvent.click(screen.getByRole('button', { name: 'Descargar mis datos' }))
    await waitFor(() => expect(crearUrl).toHaveBeenCalledOnce())
    expect(revocarUrl).not.toHaveBeenCalled()
  })

  it('solo elimina la cuenta con contraseña y confirmación exacta', async () => {
    const { fetchMock, router } = renderCuenta('datos', (url) => {
      if (url.endsWith('/users/me')) return Response.json(perfil)
      if (url.endsWith('/users/me/delete')) return new Response(null, { status: 204 })
      return Response.json({})
    })
    expect(await screen.findByLabelText('Nombre completo')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar mi cuenta' }))
    const dialog = await screen.findByRole('dialog')
    const submit = within(dialog).getByRole('button', { name: 'Eliminar mi cuenta' })
    expect((submit as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Tu contraseña'), { target: { value: 'Secret123' } })
    fireEvent.change(screen.getByLabelText(/Escribe ELIMINAR/), { target: { value: 'NO' } })
    expect((submit as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText(/Escribe ELIMINAR/), { target: { value: 'ELIMINAR' } })
    expect((submit as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(submit)

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(sesion.obtener()).toBeNull()
    const solicitud = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/users/me/delete'))
    expect(JSON.parse(String(solicitud?.[1]?.body))).toEqual({ password: 'Secret123', confirmacion: 'ELIMINAR' })
  })
})
