// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const clave = 'tripbus.sesion'
const futuro = '2999-01-01T00:00:00.000Z'

async function cargarSesion() {
  vi.resetModules()
  return import('./sesion')
}

describe('persistencia de sesión', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('ignora datos ausentes, inválidos o expirados', async () => {
    let modulo = await cargarSesion()
    expect(modulo.sesion.obtener()).toBeNull()

    localStorage.setItem(clave, '{')
    modulo = await cargarSesion()
    expect(modulo.sesion.obtener()).toBeNull()

    localStorage.setItem(clave, JSON.stringify({ token: 2, expiraEn: Date.now() + 1000, userId: 'u', rol: 'PASAJERO' }))
    modulo = await cargarSesion()
    expect(modulo.sesion.obtener()).toBeNull()

    localStorage.setItem(clave, JSON.stringify({ token: 't', expiraEn: Date.now() - 1, userId: 'u', rol: 'PASAJERO' }))
    modulo = await cargarSesion()
    expect(modulo.sesion.obtener()).toBeNull()
  })

  it('inicia, actualiza y cierra una sesión notificando a sus suscriptores', async () => {
    const { sesion } = await cargarSesion()
    const oyente = vi.fn()
    const cancelar = sesion.suscribir(oyente)
    sesion.actualizarTokens({ accessToken: 'ignorado', expiresAt: futuro })
    expect(oyente).not.toHaveBeenCalled()

    sesion.iniciar({
      accessToken: 'access',
      expiresAt: futuro,
      refreshToken: 'refresh',
      refreshExpiresAt: futuro,
      userId: 'user-1',
      rol: 'PASAJERO',
    })
    expect(sesion.token()).toBe('access')
    expect(sesion.refreshToken()).toBe('refresh')

    sesion.actualizarTokens({ accessToken: 'updated', expiresAt: futuro })
    expect(sesion.token()).toBe('updated')
    expect(sesion.refreshToken()).toBe('refresh')

    sesion.actualizarTokens({
      accessToken: 'updated-again',
      expiresAt: futuro,
      refreshToken: null,
      refreshExpiresAt: null,
    })
    expect(sesion.refreshToken()).toBeNull()
    expect(JSON.parse(localStorage.getItem(clave)!).refreshExpiraEn).toBeNull()

    sesion.cerrar()
    expect(sesion.obtener()).toBeNull()
    expect(localStorage.getItem(clave)).toBeNull()
    expect(oyente).toHaveBeenCalledTimes(4)
    cancelar()
  })

  it('mantiene una sesión con refresh válido y la cierra cuando ambos tokens expiran', async () => {
    const { sesion } = await cargarSesion()
    vi.useFakeTimers()
    sesion.iniciar({
      accessToken: 'access',
      expiresAt: '2029-01-01T00:00:00.000Z',
      refreshToken: 'refresh',
      refreshExpiresAt: '2031-01-01T00:00:00.000Z',
      userId: 'user-1',
      rol: 'PASAJERO',
    })
    vi.setSystemTime(new Date('2030-01-01T00:00:00.000Z'))
    expect(sesion.obtener()?.token).toBe('access')
    sesion.iniciar({
      accessToken: 'expired',
      expiresAt: '2020-01-01T00:00:00.000Z',
      refreshToken: 'expired-refresh',
      refreshExpiresAt: '2020-01-01T00:00:00.000Z',
      userId: 'user-1',
      rol: 'PASAJERO',
    })
    expect(sesion.obtener()).toBeNull()
    vi.useRealTimers()
  })

  it('sigue en memoria si el almacenamiento no está disponible', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
      removeItem: () => { throw new Error('blocked') },
    })
    const { sesion } = await cargarSesion()
    expect(sesion.obtener()).toBeNull()
    sesion.iniciar({ accessToken: 'memory', expiresAt: futuro, userId: 'user-1', rol: 'PASAJERO' })
    expect(sesion.token()).toBe('memory')
    expect(sesion.refreshToken()).toBeNull()
    sesion.cerrar()
    expect(sesion.obtener()).toBeNull()
  })
})
