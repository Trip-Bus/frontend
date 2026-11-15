// @vitest-environment jsdom
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement as h, type ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { avisos } from '@/features/avisos'
import { reiniciarGoogle } from '@/features/google'
import { sesion } from '@/lib/sesion'
import type { MensajeTopico } from '@/lib/tiempoReal'
import { AvisosEnVivo } from './AvisosEnVivo'
import { BannerAfectados } from './BannerAfectados'
import { BotonGoogle } from './BotonGoogle'
import { CampanaAvisos } from './CampanaAvisos'
import { CargarMas, Resultado } from './Consulta'

const { toast, manejadores } = vi.hoisted(() => ({ toast: vi.fn(), manejadores: new Map<string, (m: MensajeTopico) => void>() }))
vi.mock('sonner', () => ({ toast }))
vi.mock('@/lib/tiempoReal', () => ({
  topicos: { avisosUsuario: (id: string) => `usuario:${id}:avisos`, tiquetesUsuario: (id: string) => `usuario:${id}:tiquetes` },
  useTopico: (topico: string | null, alRecibir: (m: MensajeTopico) => void) => {
    if (topico) manejadores.set(topico, alRecibir)
  },
}))

let queryClient: QueryClient

function montar(nodo: ReactNode) {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const router = createMemoryRouter([{ path: '*', element: nodo }])
  render(h(QueryClientProvider, { client: queryClient }, h(RouterProvider, { router })))
}

const pasajero = () => sesion.iniciar({ accessToken: 'a', expiresAt: new Date(Date.now() + 3_600_000).toISOString(), userId: 'u-1', rol: 'PASAJERO' })

/** Librería de Google falsa: guarda el callback para simular la credencial. */
function googleFalso() {
  const google = { callback: null as null | ((r: { credential: string }) => void), renderButton: vi.fn() }
  window.google = {
    accounts: {
      id: {
        initialize: (o) => {
          google.callback = o.callback
        },
        renderButton: google.renderButton,
      },
    },
  }
  return google
}

beforeEach(() => {
  manejadores.clear()
  avisos.limpiar()
  reiniciarGoogle()
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  sesion.cerrar()
  delete window.google
})

describe('ingreso con Google', () => {
  const proveedores = (enabled: boolean) => Response.json({ google: { enabled, clientId: enabled ? 'cliente.apps.googleusercontent.com' : null } })

  it('no muestra nada si Google está apagado', async () => {
    const fetchMock = vi.fn(async () => proveedores(false))
    vi.stubGlobal('fetch', fetchMock)
    montar(h(BotonGoogle, { alEntrar: vi.fn(), alDesafio: vi.fn() }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(screen.queryByLabelText('Continuar con Google')).toBeNull()
  })

  it('pinta el botón oficial con el clientId del backend y entra con tokens', async () => {
    const google = googleFalso()
    const alEntrar = vi.fn()
    const auth = { accessToken: 't', expiresAt: '2099-01-01T00:00:00Z', userId: 'u', rol: 'PASAJERO' }
    const fetchMock = vi.fn(async (entrada: RequestInfo | URL, _init?: RequestInit) => (String(entrada).endsWith('/auth/providers') ? proveedores(true) : Response.json(auth)))
    vi.stubGlobal('fetch', fetchMock)
    montar(h(BotonGoogle, { alEntrar, alDesafio: vi.fn() }))
    await waitFor(() => expect(google.renderButton).toHaveBeenCalled())
    act(() => google.callback!({ credential: 'id-token' }))
    await waitFor(() => expect(alEntrar).toHaveBeenCalledWith(auth))
    const llamada = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/auth/google'))
    expect(JSON.parse(String((llamada![1] as RequestInit).body))).toEqual({ idToken: 'id-token' })
  })

  it('con 2FA pide el código', async () => {
    const google = googleFalso()
    const alDesafio = vi.fn()
    vi.stubGlobal('fetch', vi.fn(async (e: RequestInfo | URL) => (String(e).endsWith('/auth/providers') ? proveedores(true) : Response.json({ mfaRequired: true, mfaToken: 'mfa' }))))
    montar(h(BotonGoogle, { alEntrar: vi.fn(), alDesafio }))
    await waitFor(() => expect(google.callback).toBeTruthy())
    act(() => google.callback!({ credential: 'tok' }))
    await waitFor(() => expect(alDesafio).toHaveBeenCalledWith('mfa'))
  })

  it('registro incompleto: pide documento y política y reenvía el mismo token', async () => {
    const google = googleFalso()
    const alEntrar = vi.fn()
    let intento = 0
    const fetchMock = vi.fn(async (e: RequestInfo | URL, _init?: RequestInit) => {
      if (String(e).endsWith('/auth/providers')) return proveedores(true)
      intento++
      return intento === 1
        ? Response.json({ error: { code: 'GOOGLE_REGISTRO_INCOMPLETO', message: 'x', details: { email: 'ana@gmail.com', nombre: 'Ana' } } }, { status: 422 })
        : Response.json({ accessToken: 't', expiresAt: '2099-01-01T00:00:00Z', userId: 'u', rol: 'PASAJERO' }, { status: 201 })
    })
    vi.stubGlobal('fetch', fetchMock)
    montar(h(BotonGoogle, { alEntrar, alDesafio: vi.fn() }))
    await waitFor(() => expect(google.callback).toBeTruthy())
    act(() => google.callback!({ credential: 'tok-1' }))
    expect(await screen.findByDisplayValue('ana@gmail.com')).toBeTruthy()
    const crear = screen.getByRole('button', { name: 'Crear mi cuenta con Google' }) as HTMLButtonElement
    fireEvent.change(screen.getByLabelText('Documento de identidad'), { target: { value: '1020 3040' } })
    expect(crear.disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(crear)
    await waitFor(() => expect(alEntrar).toHaveBeenCalled())
    const ultima = fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/auth/google')).at(-1)
    expect(JSON.parse(String((ultima![1] as RequestInit).body))).toEqual({ idToken: 'tok-1', aceptaPoliticaDatos: true, documentoIdentidad: '10203040', nombre: 'Ana' })
  })

  it.each([
    ['GOOGLE_TOKEN_INVALID', 401, 'Google no confirmó tu cuenta. Pulsa el botón de Google otra vez.'],
    ['ACCOUNT_LOCKED', 423, 'Demasiados intentos fallidos. Tu cuenta quedó bloqueada unos minutos; intenta más tarde.'],
  ])('%s muestra un error claro', async (code, status, texto) => {
    const google = googleFalso()
    vi.stubGlobal('fetch', vi.fn(async (e: RequestInfo | URL) => (String(e).endsWith('/auth/providers') ? proveedores(true) : Response.json({ error: { code, message: 'x' } }, { status }))))
    montar(h(BotonGoogle, { alEntrar: vi.fn(), alDesafio: vi.fn() }))
    await waitFor(() => expect(google.callback).toBeTruthy())
    act(() => google.callback!({ credential: 'tok' }))
    expect(await screen.findByText(texto)).toBeTruthy()
  })

  it('GOOGLE_LOGIN_DISABLED oculta el botón', async () => {
    const google = googleFalso()
    vi.stubGlobal('fetch', vi.fn(async (e: RequestInfo | URL) => (String(e).endsWith('/auth/providers') ? proveedores(true) : Response.json({ error: { code: 'GOOGLE_LOGIN_DISABLED', message: 'x' } }, { status: 404 }))))
    montar(h(BotonGoogle, { alEntrar: vi.fn(), alDesafio: vi.fn() }))
    await waitFor(() => expect(google.callback).toBeTruthy())
    act(() => google.callback!({ credential: 'tok' }))
    expect(await screen.findByText('El ingreso con Google no está disponible en este momento.')).toBeTruthy()
    expect(screen.queryByLabelText('Continuar con Google')).toBeNull()
  })

  it('si el script de Google no carga lo dice', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => proveedores(true)))
    montar(h(BotonGoogle, { alEntrar: vi.fn(), alDesafio: vi.fn() }))
    await waitFor(() => expect(document.head.querySelector('script')).toBeTruthy())
    act(() => document.head.querySelector<HTMLScriptElement>('script')!.onerror?.(new Event('error')))
    expect(await screen.findByText('No pudimos cargar el botón de Google. Entra con tu correo.')).toBeTruthy()
    document.head.innerHTML = ''
  })
})

describe('avisos en vivo y campana', () => {
  it('guarda los avisos del pasajero, los anuncia y refresca los datos', async () => {
    pasajero()
    vi.stubGlobal('fetch', vi.fn(async () => Response.json([])))
    montar(h('div', null, h(AvisosEnVivo), h(CampanaAvisos)))
    expect(screen.getByRole('link', { name: 'Avisos' })).toBeTruthy()
    const invalidar = vi.spyOn(queryClient, 'invalidateQueries')
    act(() => manejadores.get('usuario:u-1:avisos')!({ type: 'event', topic: 't', event: 'BookingAffected', eventId: 'e-1', occurredAt: '', data: { causa: 'CANCELACION' } }))
    act(() => manejadores.get('usuario:u-1:tiquetes')!({ type: 'event', topic: 't', event: 'TicketIssued', eventId: 'e-2', occurredAt: '', data: { ticketId: 't' } }))
    act(() => manejadores.get('usuario:u-1:avisos')!({ type: 'snapshot', topic: 't', data: null }))
    expect(toast).toHaveBeenCalledWith('Tu viaje tuvo un cambio')
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['afectados'] })
    expect(await screen.findByRole('link', { name: 'Avisos, 2 sin leer' })).toBeTruthy()
    for (let i = 0; i < 9; i++) act(() => avisos.agregar('OfferAlert', {}, `x-${i}`))
    expect(screen.getByText('9+')).toBeTruthy()
  })

  it('la campana no aparece para el personal', () => {
    sesion.iniciar({ accessToken: 'a', expiresAt: new Date(Date.now() + 3_600_000).toISOString(), userId: 'op', rol: 'OPERADOR' })
    montar(h(CampanaAvisos))
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('el banner de afectados cuenta los pendientes', async () => {
    pasajero()
    vi.stubGlobal('fetch', vi.fn(async () => Response.json([{ estado: 'PENDIENTE' }, { estado: 'PENDIENTE' }, { estado: 'REEMBOLSADA' }])))
    montar(h(BannerAfectados, { oscuro: true }))
    expect(await screen.findByText('2 viajes tuyos tuvieron cambios')).toBeTruthy()
  })
})

describe('estados de una consulta', () => {
  function Prueba({ falla }: { falla: boolean }) {
    const q = useQuery({ queryKey: ['prueba', falla], queryFn: async () => (falla ? Promise.reject(new Error('x')) : []) })
    return h(Resultado, { consulta: q, hayDatos: false, vacio: 'Nada por aquí', children: 'datos' })
  }

  it('muestra error con reintento y el vacío', async () => {
    montar(h(Prueba, { falla: true }))
    expect(await screen.findByText('Algo salió mal. Intenta de nuevo.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Intentar de nuevo' }))
    cleanup()
    montar(h(Prueba, { falla: false }))
    expect(await screen.findByText('Nada por aquí')).toBeTruthy()
  })

  it('cargar más muestra el conteo y el botón solo si hay más', () => {
    const alCargar = vi.fn()
    montar(h(CargarMas, { hay: true, cargando: false, alCargar, mostrados: 10, total: 1200 }))
    expect(screen.getByText('10 de 1.200')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }))
    expect(alCargar).toHaveBeenCalled()
  })
})
