// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement as h, type ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { Recuperar } from './Recuperar'
import { Restablecer } from './Restablecer'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function renderPantalla(componente: ReactNode, entrada: string) {
  const router = createMemoryRouter([
    { path: '/recuperar', element: componente },
    { path: '/restablecer', element: componente },
    { path: '/entrar', element: h('p', null, 'Entrar') },
  ], { initialEntries: [entrada] })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(h(QueryClientProvider, { client: queryClient }, h(RouterProvider, { router })))
}

describe('recuperación de acceso', () => {
  it('exige un correo antes de pedir el enlace y muestra respuesta neutra al enviar', async () => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(null, { status: 202 }))
    vi.stubGlobal('fetch', fetchMock)
    renderPantalla(h(Recuperar), '/recuperar')
    const boton = screen.getByRole('button', { name: 'Enviar enlace' }) as HTMLButtonElement
    expect(boton.disabled).toBe(true)

    fireEvent.change(screen.getByLabelText('Correo de tu cuenta'), { target: { value: '  ana@example.com  ' } })
    expect(boton.disabled).toBe(false)
    fireEvent.click(boton)

    expect(await screen.findByRole('status')).toBeTruthy()
    expect(screen.getByText('ana@example.com')).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ email: 'ana@example.com' })
  })

  it('valida contraseña y confirmación antes de guardar, y muestra éxito', async () => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    renderPantalla(h(Restablecer), '/restablecer?token=reset-token')
    const guardar = screen.getByRole('button', { name: 'Guardar contraseña' }) as HTMLButtonElement
    expect(guardar.disabled).toBe(true)

    fireEvent.change(screen.getByLabelText('Contraseña nueva'), { target: { value: 'weak' } })
    expect(screen.getByText('Mínimo 8 caracteres, una mayúscula y un número.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Contraseña nueva'), { target: { value: 'Tripbus2026' } })
    fireEvent.change(screen.getByLabelText('Repítela'), { target: { value: 'diferente' } })
    expect(screen.getByText('Las dos contraseñas no coinciden.')).toBeTruthy()
    expect(guardar.disabled).toBe(true)

    fireEvent.change(screen.getByLabelText('Repítela'), { target: { value: 'Tripbus2026' } })
    expect(guardar.disabled).toBe(false)
    fireEvent.click(guardar)

    expect(await screen.findByText('Guardamos tu contraseña nueva y cerramos las sesiones abiertas en otros equipos.')).toBeTruthy()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      token: 'reset-token',
      nuevaPassword: 'Tripbus2026',
    })
  })

  it('ofrece pedir un nuevo enlace si falta el token o el backend lo venció', async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    const router = createMemoryRouter([
      { path: '/restablecer', element: h(Restablecer) },
      { path: '/recuperar', element: h('p', null, 'Pedir otro enlace') },
    ], { initialEntries: ['/restablecer'] })
    const vista = render(h(QueryClientProvider, { client }, h(RouterProvider, { router })))
    expect(screen.getByText('Este enlace ya no sirve')).toBeTruthy()
    cleanup()
    vista.unmount()

    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      error: { code: 'TOKEN_INVALID_OR_EXPIRED', message: 'expired' },
    }), { status: 401 })))
    renderPantalla(h(Restablecer), '/restablecer?token=expired')
    fireEvent.change(screen.getByLabelText('Contraseña nueva'), { target: { value: 'Tripbus2026' } })
    fireEvent.change(screen.getByLabelText('Repítela'), { target: { value: 'Tripbus2026' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }))
    await waitFor(() => expect(screen.getByText('Este enlace ya no sirve')).toBeTruthy())
    expect(screen.getByRole('link', { name: 'Pedir un enlace nuevo' })).toBeTruthy()
  })
})
