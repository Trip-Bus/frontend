// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { sesion } from '@/lib/sesion'
import { VerificarCorreo } from './VerificarCorreo'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  sesion.cerrar()
})

function renderVerificar(entrada: string) {
  const router = createMemoryRouter([
    { path: '/verificar-correo', element: h(VerificarCorreo) },
    { path: '/entrar', element: h('p', null, 'Entrar') },
    { path: '/cuenta', element: h('p', null, 'Cuenta') },
  ], { initialEntries: [entrada] })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(h(QueryClientProvider, { client: queryClient }, h(RouterProvider, { router })))
}

function respuestaError(code: string, message: string, status: number) {
  return new Response(JSON.stringify({ error: { code, message } }), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('verificación de correo', () => {
  it('muestra la carga mientras confirma el token', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})))
    renderVerificar('/verificar-correo?token=abc')
    expect(screen.getByLabelText('Cargando')).toBeTruthy()
  })

  it('confirma el token una sola vez y ofrece entrar', async () => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    renderVerificar('/verificar-correo?token=abc')

    expect(await screen.findByText('Correo verificado')).toBeTruthy()
    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Entrar' }).getAttribute('href')).toBe('/entrar')
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(String(fetchMock.mock.calls[0][0])).toContain('/auth/verify-email')
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ token: 'abc' })
  })

  it('con sesión abierta lleva a la cuenta', async () => {
    sesion.iniciar({ accessToken: 'access', expiresAt: new Date(Date.now() + 60_000).toISOString(), userId: 'u-1', rol: 'PASAJERO' })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })))
    renderVerificar('/verificar-correo?token=abc')

    expect(await screen.findByText('Correo verificado')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ir a tu cuenta' }).getAttribute('href')).toBe('/cuenta')
  })

  it('sin token avisa que el enlace ya no sirve sin llamar al servidor', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    renderVerificar('/verificar-correo')

    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText('Este enlace ya no sirve')).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('con token vencido avisa que el enlace ya no sirve', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuestaError('TOKEN_INVALID_OR_EXPIRED', 'expired', 401)))
    renderVerificar('/verificar-correo?token=viejo')

    expect(await screen.findByText('Este enlace ya no sirve')).toBeTruthy()
    expect(screen.getByText(/vencen a las 24 horas/)).toBeTruthy()
  })

  it('ante otro error muestra el mensaje para el usuario', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuestaError('ERROR_RARO', 'No se pudo confirmar', 400)))
    renderVerificar('/verificar-correo?token=abc')

    await waitFor(() => expect(screen.getByText('No pudimos verificar tu correo')).toBeTruthy())
    expect(screen.getByText('No se pudo confirmar')).toBeTruthy()
  })
})
