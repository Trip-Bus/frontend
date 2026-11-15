// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { sesion } from '@/lib/sesion'
import type { ViajeConductor } from '@/lib/tipos'
import { Conductor } from './Conductor'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  sesion.cerrar()
})

function iniciarSesion() {
  sesion.iniciar({
    accessToken: 'access',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    userId: 'driver-1',
    rol: 'CONDUCTOR',
  })
}

function renderConductor() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter([
    { path: '/conductor', element: h(Conductor) },
    { path: '/panel/viaje/:itineraryId', element: h('p', null, 'Detalle del viaje') },
    { path: '/panel', element: h('p', null, 'Panel') },
  ], { initialEntries: ['/conductor'] })
  render(h(QueryClientProvider, { client: queryClient }, h(RouterProvider, { router })))
}

const viajes: ViajeConductor[] = [
  {
    itineraryId: 'trip-active',
    busId: 'bus-1',
    origen: 'Bogotá',
    destino: 'Tunja',
    fechaSalida: '2026-11-13T14:00:00Z',
    fechaLlegada: '2026-11-13T17:00:00Z',
    rol: 'PRINCIPAL',
    estado: 'EN_RUTA',
    ventanaInicio: '2026-11-13T13:30:00Z',
    ventanaFin: '2026-11-13T17:30:00Z',
    puedeCompartirUbicacion: true,
    iniciado: true,
    finalizado: false,
  },
  {
    itineraryId: 'trip-later',
    busId: 'bus-2',
    origen: 'Tunja',
    destino: 'Bucaramanga',
    fechaSalida: '2026-11-13T20:00:00Z',
    fechaLlegada: '2026-11-14T01:00:00Z',
    rol: 'RELEVO',
    estado: 'PROGRAMADO',
    ventanaInicio: '2026-11-13T19:30:00Z',
    ventanaFin: '2026-11-14T01:30:00Z',
    puedeCompartirUbicacion: false,
    iniciado: false,
    finalizado: false,
  },
]

describe('viajes del conductor', () => {
  it('muestra viajes asignados, destaca el activo y abre el detalle del viaje', async () => {
    iniciarSesion()
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => Response.json(viajes))
    vi.stubGlobal('fetch', fetchMock)
    renderConductor()

    expect(await screen.findByText('Bogotá → Tunja')).toBeTruthy()
    expect(screen.getByText('Tunja → Bucaramanga')).toBeTruthy()
    expect(screen.getByText('2 viajes asignados')).toBeTruthy()
    expect(screen.getByText('Activo ahora')).toBeTruthy()
    expect(screen.getByText('Viaje iniciado. Mantén el GPS activo durante el recorrido.')).toBeTruthy()
    expect(screen.getByText(/Relevo/)).toBeTruthy()
    expect(screen.getByRole('link', { name: /Continuar viaje/ }).getAttribute('href')).toBe('/panel/viaje/trip-active')
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/driver/trips')
  })

  it('explica el estado vacío cuando no hay asignaciones hoy', async () => {
    iniciarSesion()
    vi.stubGlobal('fetch', vi.fn(async () => Response.json([])))
    renderConductor()

    expect((await screen.findByRole('status')).textContent).toContain('Hoy no tienes viajes asignados.')
    expect(screen.queryByText('Preparar salida')).toBeNull()
  })

  it('ofrece reintentar si falla la consulta de viajes', async () => {
    iniciarSesion()
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(
      { error: { code: 'SERVICE_UNAVAILABLE', message: 'down' } },
      { status: 503 },
    )))
    renderConductor()

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'No pudimos cargar tus viajes' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Intentar de nuevo' })).toBeTruthy()
    await waitFor(() => expect(screen.queryByText('Cargando asignaciones')).toBeNull())
  })
})
