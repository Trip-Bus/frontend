// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { sesion } from '@/lib/sesion'
import { Seguridad } from './Seguridad'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  sesion.cerrar()
})

function mostrarSeguridad(
  respuesta: (url: string, init?: RequestInit) => Response | Promise<Response>,
  entrada = '/cuenta/seguridad',
  rol: 'ADMIN' | 'OPERADOR' | 'PASAJERO' = 'ADMIN',
) {
  sesion.iniciar({
    accessToken: 'access',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    userId: 'admin-1',
    rol,
  })
  const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => respuesta(String(url), init))
  vi.stubGlobal('fetch', fetchMock)
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const router = createMemoryRouter([
    { path: '/cuenta/seguridad', element: h(Seguridad) },
    { path: '/', element: h('p', null, 'Inicio') },
  ], { initialEntries: [entrada] })
  render(h(QueryClientProvider, { client: cliente }, h(RouterProvider, { router })))
  return { fetchMock, cliente, router }
}

describe('seguridad de la cuenta', () => {
  it('oculta MFA a pasajeros y presenta alternativa si la consulta de seguridad falla', async () => {
    const pasajero = mostrarSeguridad(() => Response.json({}), '/cuenta/seguridad', 'PASAJERO')
    expect(await screen.findAllByText('Cambiar contraseña')).toHaveLength(2)
    expect(screen.queryByText('Verificación en dos pasos')).toBeNull()
    expect(pasajero.fetchMock).not.toHaveBeenCalled()
    cleanup()
    sesion.cerrar()

    mostrarSeguridad(() => Response.json({ error: { code: 'HTTP_500', message: 'offline' } }, { status: 500 }))
    expect(await screen.findByText('Algo falló de nuestro lado. Intenta de nuevo.')).toBeTruthy()
    expect(screen.getAllByText('Cambiar contraseña')).toHaveLength(2)
  })

  it('detecta el requisito MFA enviado por API y ofrece cerrar sesión', async () => {
    const { fetchMock, router } = mostrarSeguridad((url: string) => {
      if (url.endsWith('/users/me/data')) {
        return Response.json({ error: { code: 'MFA_SETUP_REQUIRED', message: 'required' } }, { status: 403 })
      }
      return new Response(null, { status: 204 })
    })
    expect(await screen.findByText(/Tu rol exige la verificación en dos pasos/)).toBeTruthy()
    expect(screen.queryByText('Cambiar contraseña')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/auth/logout'))).toBe(true)
    expect(sesion.obtener()).toBeNull()
  })

  it('guía a activar MFA y muestra los códigos hasta que la persona confirma guardarlos', async () => {
    const fetches = (url: string, init?: RequestInit) => {
      if (url.endsWith('/users/me/data')) {
        return Response.json({ verificacionDosPasos: true, generadoEn: new Date().toISOString() })
      }
      if (url.endsWith('/users/me/2fa/setup')) {
        return Response.json({ secret: 'JBSWY3DPEHPK3PXP', otpauthUri: 'otpauth://totp/TripBus?secret=JBSWY3DPEHPK3PXP' })
      }
      if (url.endsWith('/users/me/2fa/enable')) return Response.json({ recoveryCodes: ['ABC-123', 'DEF-456'] })
      return Response.json({ error: { code: 'HTTP_404', message: String(init?.method) } }, { status: 404 })
    }
    const { fetchMock } = mostrarSeguridad(fetches, '/cuenta/seguridad?obligatoria=1')
    expect(await screen.findByText(/Tu rol exige la verificación en dos pasos/)).toBeTruthy()
    expect(screen.queryByText('Cambiar contraseña')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Activar' }))

    expect(await screen.findByText('1. Escanea el código con tu app')).toBeTruthy()
    expect(await screen.findByAltText('Código QR para tu app de autenticación')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Copiar clave' }))
    fireEvent.change(screen.getByLabelText('Código de 6 dígitos'), { target: { value: '123-456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Activar verificación' }))

    expect(await screen.findByText('Verificación activada')).toBeTruthy()
    expect(screen.getByText('ABC-123')).toBeTruthy()
    const listo = screen.getByRole('button', { name: 'Listo' }) as HTMLButtonElement
    expect(listo.disabled).toBe(true)
    const crearUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:codigos')
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Descargar' }))
    expect(listo.disabled).toBe(false)
    expect(crearUrl).toHaveBeenCalledOnce()
    fireEvent.click(listo)
    await waitFor(() => expect(screen.getByText('Activa')).toBeTruthy())
    expect(JSON.parse(String(fetchMock.mock.calls.find(([url]) => String(url).endsWith('/2fa/enable'))?.[1]?.body)))
      .toEqual({ code: '123456' })
  })

  it('desactiva MFA solo con contraseña y código válido, limpiando al cancelar', async () => {
    const fetches = (url: string, init?: RequestInit) => {
      if (url.endsWith('/users/me/data')) return Response.json({ verificacionDosPasos: true })
      if (url.endsWith('/users/me/2fa/disable') && init?.method === 'POST') return new Response(null, { status: 204 })
      return Response.json({})
    }
    const { fetchMock } = mostrarSeguridad(fetches)
    expect(await screen.findByText('Activa')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Desactivar' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog.textContent).toContain('¿Desactivar la verificación?')
    const submit = screen.getByRole('button', { name: 'Desactivar' })
    expect((submit as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Tu contraseña'), { target: { value: 'Secret123' } })
    fireEvent.change(screen.getByLabelText('Código de la app'), { target: { value: '123 456' } })
    expect((submit as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(submit)

    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/2fa/disable'))).toBe(true))
    expect(JSON.parse(String(fetchMock.mock.calls.find(([url]) => String(url).endsWith('/2fa/disable'))?.[1]?.body)))
      .toEqual({ password: 'Secret123', code: '123456' })
  })

  it('cambia la contraseña tras validar que sea distinta y cumpla el formato', async () => {
    const fetches = (url: string, init?: RequestInit) => {
      if (url.endsWith('/users/me/data')) return Response.json({ verificacionDosPasos: false })
      if (url.endsWith('/users/me/password') && init?.method === 'POST') {
        return Response.json({
          accessToken: 'access-new',
          expiresAt: new Date(Date.now() + 120_000).toISOString(),
          userId: 'admin-1',
          rol: 'ADMIN',
        })
      }
      return Response.json({})
    }
    const { fetchMock } = mostrarSeguridad(fetches)
    expect(await screen.findByText('Verificación en dos pasos')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Contraseña actual'), { target: { value: 'Oldpass1' } })
    fireEvent.change(screen.getByLabelText('Contraseña nueva'), { target: { value: 'Oldpass1' } })
    expect(screen.getByText('Debe ser distinta de la actual.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Contraseña nueva'), { target: { value: 'weak' } })
    expect(screen.getByText('Mínimo 8 caracteres, una mayúscula y un número.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Contraseña nueva'), { target: { value: 'Newpass2026' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }))
    await waitFor(() => expect(sesion.token()).toBe('access-new'))
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/users/me/password'))).toBe(true)
  })
})
