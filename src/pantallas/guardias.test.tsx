// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement as h, type ReactNode } from 'react'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { sesion } from '@/lib/sesion'
import type { Rol, Usuario } from '@/lib/tipos'
import { Raiz, RequiereRol, SoloPasajero } from './guardias'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  sesion.cerrar()
})

function iniciarSesion(rol: Rol) {
  sesion.iniciar({
    accessToken: 'access',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    userId: 'user-1',
    rol,
  })
}

function UbicacionActual() {
  const { pathname, search } = useLocation()
  return h('p', null, `${pathname}${search}`)
}

function renderRuta(
  elemento: ReactNode,
  entrada = '/privado?origen=test',
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter([
    {
      path: '/privado',
      element: elemento,
      children: [{ index: true, element: h('p', null, 'Contenido privado') }],
    },
    { path: '/entrar', element: h(UbicacionActual) },
    { path: '/inicio', element: h('p', null, 'Inicio pasajero') },
    { path: '/conductor', element: h('p', null, 'Inicio conductor') },
    { path: '/operador', element: h('p', null, 'Inicio operador') },
    { path: '/admin', element: h('p', null, 'Inicio administrador') },
  ], { initialEntries: [entrada] })
  return render(h(QueryClientProvider, { client: queryClient }, h(RouterProvider, { router })))
}

describe('guardias de rutas', () => {
  it('muestra la bienvenida a visitantes y dirige a cada rol desde la raíz', async () => {
    const crearRouterRaiz = () => createMemoryRouter([
      { path: '/', element: h(Raiz) },
      { path: '/inicio', element: h('p', null, 'Inicio pasajero') },
      { path: '/conductor', element: h('p', null, 'Inicio conductor') },
      { path: '/operador', element: h('p', null, 'Inicio operador') },
      { path: '/admin', element: h('p', null, 'Inicio administrador') },
    ], { initialEntries: ['/'] })
    const cliente = new QueryClient()
    render(h(QueryClientProvider, { client: cliente }, h(RouterProvider, { router: crearRouterRaiz() })))
    expect(screen.getByText('Nadie más se sienta en tu puesto.')).toBeTruthy()
    cleanup()

    iniciarSesion('ADMIN')
    render(h(QueryClientProvider, { client: cliente }, h(RouterProvider, { router: crearRouterRaiz() })))
    await waitFor(() => expect(screen.getByText('Inicio administrador')).toBeTruthy())
  })

  it('redirige al acceso y conserva la ruta de destino cuando falta la sesión', async () => {
    renderRuta(h(RequiereRol, { roles: ['PASAJERO'] }))
    await waitFor(() => expect(screen.getByText('/entrar?siguiente=%2Fprivado')).toBeTruthy())
  })

  it('restringe por rol y guía a la página inicial correspondiente', () => {
    iniciarSesion('CONDUCTOR')
    renderRuta(h(RequiereRol, { roles: ['OPERADOR'] }))
    expect(screen.getByRole('alert').textContent).toContain('Esta ruta pertenece a otro tipo de cuenta.')
    expect(screen.getByRole('link', { name: 'Ir a mi inicio' }).getAttribute('href')).toBe('/conductor')
  })

  it('valida la empresa del operador y permite continuar si está vinculada', async () => {
    iniciarSesion('OPERADOR')
    const usuario: Usuario = {
      id: 'user-1',
      email: 'operador@example.com',
      nombre: 'Operador',
      rol: 'OPERADOR',
      companyId: 'company-1',
      activo: true,
    }
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(usuario), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })))

    renderRuta(h(RequiereRol, { roles: ['OPERADOR'], requiereEmpresa: true }))
    await waitFor(() => expect(screen.getByText('Contenido privado')).toBeTruthy())
  })

  it('muestra el estado de error y bloquea al operador sin empresa', async () => {
    iniciarSesion('OPERADOR')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      id: 'user-1',
      email: 'operador@example.com',
      nombre: 'Operador',
      rol: 'OPERADOR',
      companyId: null,
      activo: true,
    }), { status: 200 })))
    const { unmount } = renderRuta(h(RequiereRol, { roles: ['OPERADOR'], requiereEmpresa: true }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('no está vinculada'))
    unmount()

    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })))
    renderRuta(h(RequiereRol, { roles: ['OPERADOR'], requiereEmpresa: true }))
    await waitFor(() => expect(screen.getByText('No pudimos verificar tu empresa')).toBeTruthy())
  })

  it('permite pasajeros y visitantes en rutas públicas, pero bloquea a otros roles', () => {
    renderRuta(h(SoloPasajero))
    expect(screen.getByText('Contenido privado')).toBeTruthy()
    cleanup()
    iniciarSesion('PASAJERO')
    renderRuta(h(SoloPasajero))
    expect(screen.getByText('Contenido privado')).toBeTruthy()
    cleanup()
    iniciarSesion('CONDUCTOR')
    renderRuta(h(SoloPasajero))
    expect(screen.getByRole('link', { name: 'Ir a mi inicio' }).getAttribute('href')).toBe('/conductor')
  })
})
