// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { sesion } from '@/lib/sesion'
import type { ViajeConductor } from '@/lib/tipos'
import { OperacionesConductor } from './OperacionesConductor'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  sesion.cerrar()
})

const viaje: ViajeConductor = {
  itineraryId: 'trip-1',
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
}

function iniciarSesion() {
  sesion.iniciar({
    accessToken: 'access',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    userId: 'driver-1',
    rol: 'CONDUCTOR',
  })
}

function montar(fetchMock: ReturnType<typeof vi.fn>) {
  iniciarSesion()
  vi.stubGlobal('fetch', fetchMock)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(h(QueryClientProvider, { client: queryClient }, h(OperacionesConductor, { itineraryId: viaje.itineraryId })))
}

describe('operaciones del conductor', () => {
  it('requiere el checklist completo y envía el inicio con la observación', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/v1/driver/trips') return Response.json([{ ...viaje, iniciado: false }])
      if (url.endsWith('/start')) return Response.json({ itineraryId: viaje.itineraryId, iniciadoEn: viaje.fechaSalida, finalizadoEn: null, estadoRastreo: 'ACTIVO' })
      if (init?.body) throw new Error(`Unexpected request body for ${url}`)
      return Response.json({})
    })
    montar(fetchMock)

    const iniciar = await screen.findByRole('button', { name: 'Iniciar viaje' })
    expect((iniciar as HTMLButtonElement).disabled).toBe(true)
    for (const etiqueta of [
      'Manifiesto revisado',
      'Documentos del bus vigentes',
      'Luces y llantas verificadas',
      'Botiquín y extintor disponibles',
    ]) {
      fireEvent.click(screen.getByLabelText(etiqueta))
    }
    fireEvent.change(screen.getByLabelText('Observación (opcional)'), { target: { value: 'Todo verificado' } })
    expect((screen.getByRole('button', { name: 'Iniciar viaje' }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar viaje' }))

    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/start'))).toBe(true))
    const llamada = fetchMock.mock.calls.find(([url]) => url.endsWith('/start'))
    expect(JSON.parse(String(llamada?.[1]?.body))).toEqual({
      checklist: {
        manifiestoRevisado: true,
        documentosBus: true,
        lucesYLlantas: true,
        botiquinYExtintor: true,
      },
      observacion: 'Todo verificado',
    })
  })

  it('solo envía SOS después de mantener presionado dos segundos y cancela una pulsación corta', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/v1/driver/trips') return Response.json([viaje])
      if (url === '/api/v1/driver/sos') {
        return Response.json({
          alertId: 'alert-1',
          itineraryId: 'trip-1',
          companyId: 'company-1',
          busId: 'bus-1',
          tipo: 'SOS',
          gravedad: 'CRITICA',
          lat: null,
          lng: null,
          mensaje: 'El conductor solicita asistencia.',
          puedeContinuar: null,
          estado: 'ABIERTA',
          creadoEn: viaje.fechaSalida,
        })
      }
      return Response.json({})
    })
    montar(fetchMock)
    const boton = await screen.findByRole('button', { name: 'Mantén presionado 2 segundos para enviar SOS' })
    vi.useFakeTimers()

    fireEvent.pointerDown(boton)
    fireEvent.pointerUp(boton)
    await act(async () => { vi.advanceTimersByTime(2_000) })
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/v1/driver/sos')).toBe(false)

    fireEvent.pointerDown(boton)
    await act(async () => { vi.advanceTimersByTime(1_999) })
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/v1/driver/sos')).toBe(false)
    await act(async () => { vi.advanceTimersByTime(1) })
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/v1/driver/sos')).toBe(true)
  })

  it('pide confirmación antes de finalizar el viaje', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/v1/driver/trips') return Response.json([viaje])
      if (url.endsWith('/finish')) return Response.json({ itineraryId: viaje.itineraryId, iniciadoEn: viaje.fechaSalida, finalizadoEn: viaje.fechaLlegada, estadoRastreo: 'FINALIZADO' })
      return Response.json({})
    })
    montar(fetchMock)

    fireEvent.click(await screen.findByRole('button', { name: 'Finalizar viaje' }))
    expect(screen.getByRole('alertdialog', { name: 'Confirmar finalización' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/finish'))).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Finalizar viaje' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sí, finalizar' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/finish'))).toBe(true))
  })
})
