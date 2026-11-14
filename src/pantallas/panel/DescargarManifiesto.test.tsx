// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { sesion } from '@/lib/sesion'
import { DescargarManifiesto } from './DescargarManifiesto'

const descriptorCreateUrl = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  sesion.cerrar()
  if (descriptorCreateUrl) Object.defineProperty(URL, 'createObjectURL', descriptorCreateUrl)
  else Reflect.deleteProperty(URL, 'createObjectURL')
})

describe('descarga del manifiesto', () => {
  it('solicita el CSV autenticado y descarga el archivo del itinerario', async () => {
    sesion.iniciar({
      accessToken: 'access',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      userId: 'operator-1',
      rol: 'OPERADOR',
    })
    const fetchMock = vi.fn(async () => new Response('nombre,asiento\nAna,1A', {
      status: 200,
      headers: { 'Content-Type': 'text/csv; charset=UTF-8' },
    }))
    vi.stubGlobal('fetch', fetchMock)
    const blobs: Blob[] = []
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn((blob: Blob) => {
        blobs.push(blob)
        return 'blob:manifest'
      }),
    })
    const nombres: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      nombres.push(this.download)
    })
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })

    render(
      <QueryClientProvider client={queryClient}>
        <DescargarManifiesto itineraryId="trip-1" />
      </QueryClientProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Descargar manifiesto CSV' }))

    await waitFor(() => expect(nombres).toEqual(['manifiesto-trip-1.csv']))
    expect(fetchMock).toHaveBeenCalledOnce()
    expect((await blobs[0].text()).startsWith('nombre,asiento')).toBe(true)
    expect(screen.getByRole('region', { name: 'Manifiesto del viaje' })).toBeTruthy()
  })
})
