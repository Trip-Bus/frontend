// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { ErrorRuta } from './ErrorRuta'
import { NoEncontrada } from './NoEncontrada'

afterEach(() => {
  cleanup()
  sessionStorage.clear()
})

function renderError(error: unknown) {
  const router = createMemoryRouter([{
    path: '/',
    loader: () => { throw error },
    element: h('p', null, 'No debe renderizarse'),
    errorElement: h(ErrorRuta),
  }])
  return render(h(RouterProvider, { router }))
}

describe('estados de error de navegación', () => {
  it('muestra la página no encontrada con un enlace al inicio', () => {
    const router = createMemoryRouter([
      { path: '/', element: h(NoEncontrada) },
      { path: '/inicio', element: h('p', null, 'Inicio') },
    ])
    render(h(RouterProvider, { router }))
    expect(screen.getByText('Esta ruta no lleva a ningún lado')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ir al inicio' }).getAttribute('href')).toBe('/inicio')
  })

  it('distingue un recurso inexistente y un error de pantalla común', async () => {
    renderError(new Response('Not Found', { status: 404 }))
    await waitFor(() => expect(screen.getByText('Esta pantalla no existe')).toBeTruthy())
    cleanup()

    const error = new Error('fallo de pantalla')
    const consola = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderError(error)
    await waitFor(() => expect(screen.getByText('Algo falló en esta pantalla')).toBeTruthy())
    expect(consola).toHaveBeenCalledWith(error)
    expect(screen.getByRole('link', { name: 'Ir al inicio' })).toBeTruthy()
    consola.mockRestore()
  })

  it('identifica un chunk antiguo y limita la recarga automática repetida', async () => {
    sessionStorage.setItem('tripbus.recargaPorVersion', String(Date.now()))
    renderError(new Error('Failed to fetch dynamically imported module'))
    await waitFor(() => expect(screen.getByText('Hay una versión nueva de la app')).toBeTruthy())
    expect(screen.getByText('Recarga para abrirla. Tus tiquetes y tu sesión siguen guardados.')).toBeTruthy()
  })
})
