import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from './endpoints'
import { sesion } from './sesion'

afterEach(() => {
  vi.unstubAllGlobals()
  sesion.cerrar()
})

describe('endpoints de la API TripBus', () => {
  it('construye solicitudes para los módulos expuestos', async () => {
    sesion.iniciar({
      accessToken: 'access',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      refreshToken: 'refresh',
      userId: 'user',
      rol: 'ADMIN',
    })
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    const id = 'id-1'
    const ubicacion = { lat: 4.65, lng: -74.1, precision: 10, velocidad: 30, rumbo: 90, timestamp: new Date().toISOString() }

    await Promise.all([
      api.auth.login({ email: 'a@tripbus.co', password: 'pass' }),
      api.auth.segundoPaso({ mfaToken: 'mfa', code: '123456' }),
      api.auth.registro({ email: 'a@tripbus.co', password: 'pass', documentoIdentidad: '1', nombre: 'Ana', aceptaPoliticaDatos: true }),
      api.auth.logout(),
      api.auth.usuario(id),
      api.auth.pedirRecuperacion('a@tripbus.co'),
      api.auth.restablecer('token', 'new-pass'),
      api.auth.verificarCorreo('token'),
      api.auth.reenviarVerificacion(),
      api.cuenta.perfil(),
      api.cuenta.editar({ nombre: 'Ana', telefono: null }),
      api.cuenta.cambiarPassword({ passwordActual: 'old', passwordNueva: 'new' }),
      api.cuenta.misDatos(),
      api.cuenta.eliminar('pass'),
      api.cuenta.configurarMfa(),
      api.cuenta.activarMfa('123456'),
      api.cuenta.desactivarMfa('pass', '123456'),
      api.catalogo.buscar('Bogotá', 'Cali', '2026-11-15'),
      api.catalogo.ciudades(),
      api.catalogo.itinerario(id),
      api.catalogo.mapa(id),
      api.asientos.estados(id),
      api.asientos.retener(id, ['1']),
      api.asientos.retencion(id),
      api.asientos.extender(id),
      api.asientos.liberar(id),
      api.reservas.crear(id, []),
      api.reservas.mias(),
      api.reservas.obtener(id),
      api.reservas.pagar(id, { cardToken: 'tok' }, 'key'),
      api.reservas.tiquete(id),
      api.reservas.validarTiquete('qr'),
      api.ofertas.listar(id),
      api.ofertas.obtener(id),
      api.ofertas.cupo(id),
      api.ofertas.apartar(id, 'doc'),
      api.ofertas.crear({ itineraryId: id, seatNumbers: ['1'], precioOferta: 1, cupo: 1, inicio: 'now', fin: 'later' }),
      api.ofertas.activar(id),
      api.ofertas.cerrar(id),
      api.viaje.seguimiento(id),
      api.viaje.novedades(id),
      api.viaje.reportar(id, { tipo: 'INICIO' }),
      api.viaje.enviarPosicion({ busId: id, itineraryId: id, lat: 4, lng: -74 }),
      api.conductor.iniciarRastreo(),
      api.conductor.detenerRastreo(),
      api.conductor.enviarUbicacion(ubicacion),
      api.conductor.enviarUbicaciones([ubicacion]),
      api.admin.seed(),
    ])

    expect(fetchMock).toHaveBeenCalledTimes(48)
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/v1/driver/location')).toBe(true)
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/v1/driver/location/batch')).toBe(true)
  })
})
