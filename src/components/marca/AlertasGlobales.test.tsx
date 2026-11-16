// @vitest-environment jsdom
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CampoContrasena, ErrorFormulario } from '@/components/ui/formulario'
import { useAcento } from '@/hooks/useAcento'
import { useAhora, useSegundosRestantes } from '@/hooks/useAhora'
import { ACENTO_POR_DEFECTO } from '@/features/ciudadVisual'
import {
  ApiError,
  EVENTO_CUENTA_BLOQUEADA,
  EVENTO_CUENTA_SUSPENDIDA,
  EVENTO_SESION_EXPIRADA,
} from '@/lib/api'
import { EVENTO_WS_DUPLICADO } from '@/lib/tiempoReal'
import { AlertasGlobales } from './AlertasGlobales'

const { navegar } = vi.hoisted(() => ({ navegar: vi.fn() }))
vi.mock('@/router', () => ({ router: { navigate: (...args: unknown[]) => navegar(...args) } }))

afterEach(() => {
  vi.clearAllMocks()
})

describe('alertas globales', () => {
  it('notifica y permite cerrar los eventos de cuenta, sesión y pestañas', () => {
    render(<AlertasGlobales />)
    expect(screen.queryByRole('alertdialog')).toBeNull()

    act(() => globalThis.dispatchEvent(new Event(EVENTO_SESION_EXPIRADA)))
    expect(navegar).toHaveBeenCalledWith('/entrar', { replace: true })

    act(() => globalThis.dispatchEvent(new Event(EVENTO_CUENTA_SUSPENDIDA)))
    expect(screen.getByText('Cuenta suspendida')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Entendido' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()

    act(() => globalThis.dispatchEvent(new CustomEvent(EVENTO_CUENTA_BLOQUEADA, { detail: { reintentarEn: 30 } })))
    expect(screen.getByText('Espera 30 segundos antes de volver a intentarlo.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Entendido' }))
    act(() => globalThis.dispatchEvent(new CustomEvent(EVENTO_CUENTA_BLOQUEADA, { detail: { reintentarEn: null } })))
    expect(screen.getByText('Espera unos minutos antes de volver a intentarlo.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Entendido' }))
    act(() => globalThis.dispatchEvent(new Event(EVENTO_WS_DUPLICADO)))
    expect(screen.getByText('Demasiadas pestañas abiertas')).toBeTruthy()
  })
})

describe('controles accesibles y hooks de interfaz', () => {
  it('cambia la visibilidad de contraseña y presenta errores amigables', () => {
    render(
      <>
        <CampoContrasena etiqueta="Contraseña" name="password" />
        <ErrorFormulario error={new ApiError(401, 'INVALID_CREDENTIALS', 'invalid')} />
        <ErrorFormulario error={new Error('unexpected')} />
      </>,
    )
    expect(screen.getByLabelText('Contraseña').getAttribute('type')).toBe('password')
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }))
    expect(screen.getByLabelText('Contraseña').getAttribute('type')).toBe('text')
    expect(screen.getByText('El correo o la contraseña no coinciden.')).toBeTruthy()
    expect(screen.getByText('Algo salió mal. Intenta de nuevo.')).toBeTruthy()
  })

  it('actualiza el reloj y aplica el acento al documento sin reemplazar datos pendientes', () => {
    const acentoOriginal = document.documentElement.style.getPropertyValue('--acento')
    document.documentElement.style.setProperty('--acento', '#123456')
    const { unmount: desmontarAcento } = renderHook(() => useAcento('Bogotá'))
    const acentoCiudad = document.documentElement.style.getPropertyValue('--acento')
    expect(acentoCiudad).not.toBe('')

    renderHook(() => useAcento(undefined))
    expect(document.documentElement.style.getPropertyValue('--acento')).toBe(acentoCiudad)
    const { unmount: desmontarPorDefecto } = renderHook(() => useAcento(null))
    expect(document.documentElement.style.getPropertyValue('--acento')).toBe(ACENTO_POR_DEFECTO)
    desmontarAcento()
    desmontarPorDefecto()
    document.documentElement.style.setProperty('--acento', acentoOriginal)

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const { result, unmount } = renderHook(() => useAhora(500))
    const ahoraInicial = result.current
    act(() => vi.advanceTimersByTime(500))
    expect(result.current).toBe(ahoraInicial + 500)
    const restante = renderHook(() => useSegundosRestantes('2026-01-01T00:00:10Z'))
    expect(restante.result.current).toBe(9)
    restante.unmount()
    unmount()
    vi.useRealTimers()
  })
})
