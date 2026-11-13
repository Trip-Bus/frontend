// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { sesion } from '@/lib/sesion'
import { Entrar } from './Entrar'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  sesion.cerrar()
})

function mostrarEntrar(entrada = '/entrar') {
  const router = createMemoryRouter([
    { path: '/entrar', element: h(Entrar) },
    { path: '/inicio', element: h('p', null, 'Inicio pasajero') },
    { path: '/cuenta/seguridad', element: h('p', null, 'Configurar seguridad') },
  ], { initialEntries: [entrada] })
  const cliente = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  render(h(QueryClientProvider, { client: cliente }, h(RouterProvider, { router })))
  return router
}

const auth = {
  accessToken: 'access',
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  userId: 'user-1',
  rol: 'PASAJERO',
}

describe('inicio de sesión y registro', () => {
  it('inicia sesión y solo acepta destinos internos', async () => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      Response.json(auth),
    )
    vi.stubGlobal('fetch', fetchMock)
    const router = mostrarEntrar('/entrar?siguiente=https%3A%2F%2Fexample.com')
    const submit = screen.getByRole('button', { name: 'Entrar' })
    expect((submit as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Correo'), { target: { value: ' ana@example.com ' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'pass' } })
    fireEvent.click(submit)

    await waitFor(() => expect(router.state.location.pathname).toBe('/inicio'))
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      email: 'ana@example.com',
      password: 'pass',
    })
    expect(sesion.token()).toBe('access')
  })

  it('gestiona el desafío MFA y permite usar código de recuperación', async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL, _init?: RequestInit) =>
      String(url).endsWith('/auth/login')
        ? Response.json({ mfaRequired: true, mfaToken: 'mfa-token' })
        : Response.json(auth),
    )
    vi.stubGlobal('fetch', fetchMock)
    const router = mostrarEntrar()
    fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'ana@example.com' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText('Tu cuenta tiene verificación en dos pasos. Abre tu app de autenticación y escribe el código de 6 dígitos.')).toBeTruthy()
    const verificar = screen.getByRole('button', { name: 'Verificar y entrar' }) as HTMLButtonElement
    expect(verificar.disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'No tengo el teléfono: usar un código de recuperación' }))
    fireEvent.change(screen.getByLabelText('Código de recuperación'), { target: { value: ' backup-code ' } })
    fireEvent.click(verificar)

    await waitFor(() => expect(router.state.location.pathname).toBe('/inicio'))
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
      mfaToken: 'mfa-token',
      recoveryCode: 'backup-code',
    })
  })

  it('valida campos y política antes de crear una cuenta', async () => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => Response.json({
      ...auth,
      rol: 'PASAJERO',
    }))
    vi.stubGlobal('fetch', fetchMock)
    const router = mostrarEntrar()
    fireEvent.click(screen.getByRole('tab', { name: 'Crear cuenta' }))
    const crear = screen.getByRole('button', { name: 'Crear cuenta' }) as HTMLButtonElement
    expect(crear.disabled).toBe(true)

    fireEvent.change(screen.getByLabelText('Nombre completo'), { target: { value: ' Ana Pérez ' } })
    fireEvent.change(screen.getByLabelText('Documento de identidad'), { target: { value: '123456' } })
    fireEvent.change(screen.getByLabelText('Correo'), { target: { value: ' ana@example.com ' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'weak' } })
    expect(screen.getByText('Mínimo 8 caracteres, una mayúscula y un número.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'Tripbus2026' } })
    expect(crear.disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(crear.disabled).toBe(false)
    fireEvent.click(crear)

    await waitFor(() => expect(router.state.location.pathname).toBe('/inicio'))
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      nombre: 'Ana Pérez',
      email: 'ana@example.com',
      documentoIdentidad: '123456',
      aceptaPoliticaDatos: true,
    })
  })
})
