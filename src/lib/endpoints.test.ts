import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from './endpoints'
import { sesion } from './sesion'

type Caso = [nombre: string, llamar: () => Promise<unknown>, metodo: string, url: string, cuerpo?: unknown]

const id = 'id-1'
const ubicacion = { lat: 4.65, lng: -74.1, precision: 10, velocidad: 30, rumbo: 90, timestamp: '2026-11-15T12:00:00Z' }
const pasajero = { nombre: 'Ana', tipoDocumento: 'CC' as const, numeroDocumento: '1234' }

const casos: Caso[] = [
  ['login', () => api.auth.login({ email: 'a@tripbus.co', password: 'pass' }), 'POST', '/auth/login', { email: 'a@tripbus.co', password: 'pass' }],
  ['2fa', () => api.auth.segundoPaso({ mfaToken: 'mfa', code: '123456' }), 'POST', '/auth/2fa'],
  ['registro', () => api.auth.registro({ email: 'a@x.co', password: 'P', documentoIdentidad: '1', nombre: 'Ana', aceptaPoliticaDatos: true }), 'POST', '/auth/register'],
  ['logout', () => api.auth.logout(), 'POST', '/auth/logout', { refreshToken: 'refresh' }],
  ['usuario', () => api.auth.usuario(id), 'GET', '/users/id-1'],
  ['recuperar', () => api.auth.pedirRecuperacion('a@x.co'), 'POST', '/auth/password-reset/request', { email: 'a@x.co' }],
  ['restablecer', () => api.auth.restablecer('t', 'n'), 'POST', '/auth/password-reset/confirm', { token: 't', nuevaPassword: 'n' }],
  ['verificar', () => api.auth.verificarCorreo('t'), 'POST', '/auth/verify-email', { token: 't' }],
  ['reenviar verificación', () => api.auth.reenviarVerificacion(), 'POST', '/auth/verify-email/resend'],
  ['proveedores', () => api.auth.proveedores(), 'GET', '/auth/providers'],
  ['google', () => api.auth.google({ idToken: 'tok' }), 'POST', '/auth/google', { idToken: 'tok' }],
  ['perfil', () => api.cuenta.perfil(), 'GET', '/users/me'],
  ['editar perfil', () => api.cuenta.editar({ nombre: 'Ana', telefono: null }), 'PUT', '/users/me'],
  ['cambiar contraseña', () => api.cuenta.cambiarPassword({ passwordActual: 'a', passwordNueva: 'b' }), 'POST', '/users/me/password'],
  ['mis datos', () => api.cuenta.misDatos(), 'GET', '/users/me/data'],
  ['eliminar', () => api.cuenta.eliminar('p'), 'POST', '/users/me/delete', { password: 'p', confirmacion: 'ELIMINAR' }],
  ['mfa setup', () => api.cuenta.configurarMfa(), 'POST', '/users/me/2fa/setup'],
  ['mfa enable', () => api.cuenta.activarMfa('1'), 'POST', '/users/me/2fa/enable', { code: '1' }],
  ['mfa disable', () => api.cuenta.desactivarMfa('p', '1'), 'POST', '/users/me/2fa/disable', { password: 'p', code: '1' }],
  ['usuarios', () => api.usuarios.listar({ rol: 'OPERADOR', activo: true, q: 'ana', page: 0, size: 20 }), 'GET', '/users?rol=OPERADOR&activo=true&q=ana&page=0&size=20'],
  ['crear usuario', () => api.usuarios.crear({ nombre: 'Ana', email: 'a@x.co', documentoIdentidad: '1', rol: 'CONDUCTOR', companyId: 'c' }), 'POST', '/users'],
  ['cambiar rol', () => api.usuarios.cambiarRol(id, { rol: 'OPERADOR', companyId: 'c' }), 'PUT', '/users/id-1/role', { rol: 'OPERADOR', companyId: 'c' }],
  ['estado usuario', () => api.usuarios.cambiarEstado(id, false, 'fraude'), 'PATCH', '/users/id-1/estado', { activo: false, motivo: 'fraude' }],
  ['desbloquear', () => api.usuarios.desbloquear(id), 'DELETE', '/users/id-1/lock'],
  ['auditoría', () => api.usuarios.auditoria({ accion: 'SUSPENDER', page: 1 }), 'GET', '/admin/audit?accion=SUSPENDER&page=1'],
  ['buscar', () => api.catalogo.buscar('Bogotá', 'Cali', '2026-11-15'), 'GET', '/trips/search?origin=Bogot%C3%A1&destination=Cali&date=2026-11-15'],
  ['empresas búsqueda', () => api.catalogo.empresasDeBusqueda('A', 'B', '2026-11-15'), 'GET', '/trips/search/companies?origin=A&destination=B&date=2026-11-15'],
  ['calendario', () => api.catalogo.calendario('A', 'B', '2026-11-15'), 'GET', '/trips/calendar?origin=A&destination=B&from=2026-11-15&days=7'],
  ['ida y vuelta', () => api.catalogo.idaYVuelta('A', 'B', '2026-11-15', '2026-11-20', { franja: 'NOCHE' }), 'GET', '/trips/round-trip?origin=A&destination=B&date=2026-11-15&returnDate=2026-11-20&franja=NOCHE'],
  ['lugares', () => api.catalogo.lugares('med'), 'GET', '/places?q=med'],
  ['ciudades', () => api.catalogo.ciudades(), 'GET', '/trips/cities'],
  ['itinerario', () => api.catalogo.itinerario(id), 'GET', '/itineraries/id-1'],
  ['mapa', () => api.catalogo.mapa(id), 'GET', '/itineraries/id-1/seatmap'],
  ['precio', () => api.catalogo.precio(id, { from: 2, to: 4 }, ['ADULTO', 'NINO']), 'GET', '/itineraries/id-1/price?from=2&to=4&tipos=ADULTO%2CNINO'],
  ['terminales', () => api.catalogo.terminales('Cali'), 'GET', '/terminals?ciudad=Cali'],
  ['viajes operador', () => api.operador.viajes({ desde: '2026-11-15', hasta: '2026-11-22', page: 0 }), 'GET', '/operator/trips?desde=2026-11-15&hasta=2026-11-22&page=0'],
  ['itinerarios', () => api.operador.itinerarios({ estado: 'PROGRAMADO' }), 'GET', '/itineraries?estado=PROGRAMADO'],
  ['programar', () => api.operador.programar({ routeId: 'r', busId: 'b', fechaSalida: 'f', precioBase: 1 }), 'POST', '/itineraries'],
  ['recurrente', () => api.operador.programarRecurrente({ routeId: 'r', busId: 'b', horaSalida: '06:00', diasSemana: ['LUNES'], desde: 'a', hasta: 'b', precioBase: 1 }), 'POST', '/itineraries/schedule'],
  ['cambiar salida', () => api.operador.cambiarSalida(id, 'f', 'm'), 'PATCH', '/itineraries/id-1/departure', { nuevaFechaSalida: 'f', motivo: 'm' }],
  ['cambiar bus', () => api.operador.cambiarBus(id, 'b', 'm'), 'PATCH', '/itineraries/id-1/bus', { busId: 'b', motivo: 'm' }],
  ['cancelar', () => api.operador.cancelar(id, 'm'), 'POST', '/admin/itineraries/id-1/cancel', { motivo: 'm' }],
  ['historial', () => api.operador.historial(id), 'GET', '/itineraries/id-1/changes'],
  ['buses', () => api.buses.listar({ estado: 'ACTIVO' }), 'GET', '/buses?estado=ACTIVO'],
  ['bus', () => api.buses.obtener(id), 'GET', '/buses/id-1'],
  ['crear bus', () => api.buses.crear({ placa: 'ABC123', tipo: 'UN_PISO' }), 'POST', '/buses'],
  ['editar bus', () => api.buses.editar(id, { placa: 'ABC123', tipo: 'UN_PISO' }), 'PUT', '/buses/id-1'],
  ['estado bus', () => api.buses.cambiarEstado(id, 'MANTENIMIENTO'), 'PATCH', '/buses/id-1/estado', { estado: 'MANTENIMIENTO' }],
  ['mapa bus', () => api.buses.mapa(id), 'GET', '/buses/id-1/seatmap'],
  ['guardar mapa', () => api.buses.guardarMapa(id, { tipo: 'UN_PISO', capacidad: 0, pisos: [] }), 'PUT', '/buses/id-1/seatmap'],
  ['rutas', () => api.rutas.listar({ estado: 'ACTIVA' }), 'GET', '/routes?estado=ACTIVA'],
  ['ruta', () => api.rutas.obtener(id), 'GET', '/routes/id-1'],
  ['crear ruta', () => api.rutas.crear({ origen: 'A', destino: 'B', paradas: [] }), 'POST', '/routes'],
  ['editar ruta', () => api.rutas.editar(id, { origen: 'A', destino: 'B', paradas: [] }), 'PUT', '/routes/id-1'],
  ['estado ruta', () => api.rutas.cambiarEstado(id, 'INACTIVA'), 'PATCH', '/routes/id-1/estado', { estado: 'INACTIVA' }],
  ['paradas', () => api.rutas.guardarParadas(id, []), 'PUT', '/routes/id-1/stops', []],
  ['precios tramo', () => api.rutas.preciosTramo(id), 'GET', '/routes/id-1/segment-prices'],
  ['guardar precios tramo', () => api.rutas.guardarPreciosTramo(id, [{ desdeOrden: 1, hastaOrden: 2, precio: 3 }]), 'PUT', '/routes/id-1/segment-prices'],
  ['empresas', () => api.empresas.listar({ estado: 'ACTIVA' }), 'GET', '/companies?estado=ACTIVA'],
  ['empresa', () => api.empresas.obtener(id), 'GET', '/companies/id-1'],
  ['crear empresa', () => api.empresas.crear({ nombre: 'E', nit: '900' }), 'POST', '/companies'],
  ['editar empresa', () => api.empresas.editar(id, { nombre: 'E', nit: '900' }), 'PUT', '/companies/id-1'],
  ['estado empresa', () => api.empresas.cambiarEstado(id, 'INACTIVA'), 'PATCH', '/companies/id-1/estado'],
  ['condiciones', () => api.empresas.condiciones(id), 'GET', '/companies/id-1/terms'],
  ['agregar condiciones', () => api.empresas.agregarCondiciones(id, { cuotaMensual: 1, comisionPorcentaje: 2, vigenteDesde: 'd' }), 'POST', '/companies/id-1/terms'],
  ['crear terminal', () => api.terminales.crear({ ciudad: 'C', nombre: 'N', direccion: 'D', lat: 1, lng: 2 }), 'POST', '/terminals'],
  ['editar terminal', () => api.terminales.editar(id, { ciudad: 'C', nombre: 'N', direccion: 'D', lat: 1, lng: 2 }), 'PUT', '/terminals/id-1'],
  ['borrar terminal', () => api.terminales.borrar(id), 'DELETE', '/terminals/id-1'],
  ['temporadas', () => api.tarifas.temporadas('c'), 'GET', '/fares/seasons?companyId=c'],
  ['crear temporada', () => api.tarifas.crearTemporada({ nombre: 'T', desde: 'a', hasta: 'b', multiplicador: 1, routeId: null }), 'POST', '/fares/seasons'],
  ['editar temporada', () => api.tarifas.editarTemporada(id, { nombre: 'T', desde: 'a', hasta: 'b', multiplicador: 1, routeId: null }), 'PUT', '/fares/seasons/id-1'],
  ['borrar temporada', () => api.tarifas.borrarTemporada(id), 'DELETE', '/fares/seasons/id-1'],
  ['tipos pasajero', () => api.tarifas.tiposPasajero(), 'GET', '/fares/passenger-types'],
  ['guardar tipo', () => api.tarifas.guardarTipoPasajero('NINO', 10), 'PUT', '/fares/passenger-types/NINO', { descuentoPorcentaje: 10 }],
  ['borrar tipo', () => api.tarifas.borrarTipoPasajero('NINO', 'c'), 'DELETE', '/fares/passenger-types/NINO?companyId=c'],
  ['recargos', () => api.tarifas.recargos(), 'GET', '/fares/seat-surcharges'],
  ['guardar recargo', () => api.tarifas.guardarRecargo('PREMIUM', 5000), 'PUT', '/fares/seat-surcharges/PREMIUM', { recargo: 5000 }],
  ['borrar recargo', () => api.tarifas.borrarRecargo('PREMIUM'), 'DELETE', '/fares/seat-surcharges/PREMIUM'],
  ['estados asientos', () => api.asientos.estados(id), 'GET', '/seats/itineraries/id-1'],
  ['retener', () => api.asientos.retener(id, ['1']), 'POST', '/seats/holds', { itineraryId: id, seatNumbers: ['1'] }],
  ['retener tramo', () => api.asientos.retener(id, ['1'], { fromOrden: 2, toOrden: 3 }), 'POST', '/seats/holds', { itineraryId: id, seatNumbers: ['1'], fromOrden: 2, toOrden: 3 }],
  ['retención', () => api.asientos.retencion(id), 'GET', '/seats/holds/id-1'],
  ['extender', () => api.asientos.extender(id), 'POST', '/seats/holds/id-1/extend'],
  ['liberar', () => api.asientos.liberar(id), 'DELETE', '/seats/holds/id-1'],
  ['bloquear', () => api.asientos.bloquear(id, ['1'], 'm'), 'POST', '/seats/itineraries/id-1/blocks', { seatNumbers: ['1'], motivo: 'm' }],
  ['desbloquear asientos', () => api.asientos.desbloquear(id, ['1']), 'DELETE', '/seats/itineraries/id-1/blocks', { seatNumbers: ['1'] }],
  ['ocupación', () => api.asientos.ocupacion(id), 'GET', '/seats/itineraries/id-1/occupancy'],
  ['anotarse', () => api.asientos.anotarseEnEspera(id, 2), 'POST', '/seats/itineraries/id-1/waitlist', { cantidad: 2 }],
  ['salir espera', () => api.asientos.salirDeEspera(id), 'DELETE', '/seats/itineraries/id-1/waitlist'],
  ['mis turnos', () => api.asientos.misTurnos(), 'GET', '/seats/waitlist/me'],
  ['crear reserva', () => api.reservas.crear(id, [pasajero], 'PROMO'), 'POST', '/bookings', { holdId: id, pasajeros: [pasajero], cupon: 'PROMO' }],
  ['crear reserva sin cupón', () => api.reservas.crear(id, [pasajero]), 'POST', '/bookings', { holdId: id, pasajeros: [pasajero] }],
  ['mis reservas', () => api.reservas.mias(), 'GET', '/bookings'],
  ['mis viajes', () => api.reservas.misViajes('pasados', 1, 5), 'GET', '/bookings?scope=pasados&page=1&size=5'],
  ['reserva', () => api.reservas.obtener(id), 'GET', '/bookings/id-1'],
  ['pagar', () => api.reservas.pagar(id, { metodo: 'NEQUI', nequi: { telefono: '3991111111' } }, 'k'), 'POST', '/bookings/id-1/pay', { metodo: 'NEQUI', nequi: { telefono: '3991111111' } }],
  ['bancos', () => api.reservas.bancosPse(), 'GET', '/payments/pse/banks'],
  ['comprobante pago', () => api.reservas.comprobantePago(id), 'GET', '/payments/id-1/receipt.pdf'],
  ['comprobante reembolso', () => api.reservas.comprobanteReembolso(id), 'GET', '/refunds/id-1/receipt.pdf'],
  ['reprogramar', () => api.reservas.reprogramar(id, 'h'), 'POST', '/bookings/id-1/reschedule', { holdId: 'h' }],
  ['tiquete', () => api.reservas.tiquete(id), 'GET', '/tickets/id-1'],
  ['reenviar', () => api.reservas.reenviarTiquete(id), 'POST', '/tickets/id-1/resend'],
  ['pdf', () => api.reservas.pdfTiquete(id), 'GET', '/tickets/id-1/pdf'],
  ['cambiar asiento', () => api.reservas.cambiarAsiento(id, '1', '2'), 'POST', '/tickets/id-1/seat', { fromSeat: '1', toSeat: '2' }],
  ['corregir', () => api.reservas.corregirPasajero(id, 'p', pasajero), 'PATCH', '/tickets/id-1/passengers/p', pasajero],
  ['manifiesto', () => api.reservas.manifiestoCsv(id), 'GET', '/itineraries/id-1/manifest?format=csv'],
  ['validar', () => api.reservas.validarTiquete('qr'), 'POST', '/tickets/validate', { qrCode: 'qr' }],
  ['afectados', () => api.afectados.listar(), 'GET', '/bookings/affected'],
  ['afectado', () => api.afectados.obtener(id), 'GET', '/bookings/id-1/affected'],
  ['afectado reprogramar', () => api.afectados.reprogramar(id, 'h'), 'POST', '/bookings/id-1/affected/reschedule', { holdId: 'h' }],
  ['afectado reembolso', () => api.afectados.reembolsar(id), 'POST', '/bookings/id-1/affected/refund'],
  ['afectado aceptar', () => api.afectados.aceptar(id), 'POST', '/bookings/id-1/affected/accept'],
  ['taquilla', () => api.taquilla.vender({ itineraryId: id, seatNumbers: ['1'], pasajeros: [pasajero], comprador: { nombre: 'Ana' } }, 'k'), 'POST', '/box-office/sales'],
  ['cierre', () => api.taquilla.cierre('2026-11-15'), 'GET', '/box-office/sales?fecha=2026-11-15'],
  ['cupones', () => api.cupones.listar('c'), 'GET', '/coupons?companyId=c'],
  ['crear cupón', () => api.cupones.crear({ codigo: 'X', tipo: 'VALOR', valor: 1, companyId: null, vigenteDesde: null, vigenteHasta: null, usosMaximos: null, usosPorUsuario: null, compraMinima: null, routeIds: [], activo: true }), 'POST', '/coupons'],
  ['editar cupón', () => api.cupones.editar(id, { codigo: 'X', tipo: 'VALOR', valor: 1, companyId: null, vigenteDesde: null, vigenteHasta: null, usosMaximos: null, usosPorUsuario: null, compraMinima: null, routeIds: [], activo: true }), 'PUT', '/coupons/id-1'],
  ['desactivar cupón', () => api.cupones.desactivar(id), 'DELETE', '/coupons/id-1'],
  ['ventas', () => api.reportes.ventas('a', 'b', 'ruta'), 'GET', '/reports/sales?desde=a&hasta=b&agrupar=ruta'],
  ['ventas csv', () => api.reportes.ventasCsv('a', 'b', 'dia', 'c'), 'GET', '/reports/sales.csv?desde=a&hasta=b&agrupar=dia&companyId=c'],
  ['puntualidad', () => api.reportes.puntualidad('a', 'b', 'conductor'), 'GET', '/reports/punctuality?desde=a&hasta=b&agrupar=conductor'],
  ['plataforma', () => api.reportes.plataforma('2026-11'), 'GET', '/reports/platform?mes=2026-11'],
  ['plataforma csv', () => api.reportes.plataformaCsv('2026-11'), 'GET', '/reports/platform.csv?mes=2026-11'],
  ['ofertas', () => api.ofertas.listar(id), 'GET', '/offers?itineraryId=id-1'],
  ['oferta', () => api.ofertas.obtener(id), 'GET', '/offers/id-1'],
  ['cupo', () => api.ofertas.cupo(id), 'GET', '/offers/id-1/quota'],
  ['apartar', () => api.ofertas.apartar(id, 'doc'), 'POST', '/offers/id-1/reservations', { docId: 'doc' }],
  ['vitrina', () => api.ofertas.vitrina({ origin: 'A', page: 0, size: 10 }), 'GET', '/offers/showcase?origin=A&page=0&size=10'],
  ['entrar fila', () => api.ofertas.entrarFila(id), 'POST', '/offers/id-1/queue'],
  ['mi turno', () => api.ofertas.miTurno(id), 'GET', '/offers/id-1/queue/me'],
  ['crear oferta', () => api.ofertas.crear({ itineraryId: id, seatNumbers: ['1'], precioOferta: 1, cupo: 1, inicio: 'a', fin: 'b' }), 'POST', '/offers'],
  ['activar', () => api.ofertas.activar(id), 'POST', '/offers/id-1/activate'],
  ['cerrar', () => api.ofertas.cerrar(id), 'POST', '/offers/id-1/close'],
  ['editar oferta', () => api.ofertas.editar(id, { cupo: 3 }), 'PUT', '/offers/id-1', { cupo: 3 }],
  ['cancelar oferta', () => api.ofertas.cancelar(id), 'DELETE', '/offers/id-1'],
  ['duplicar', () => api.ofertas.duplicar(id, { itineraryId: 'i', inicio: 'a', fin: 'b' }), 'POST', '/offers/id-1/duplicate'],
  ['métricas', () => api.ofertas.metricas(id), 'GET', '/offers/id-1/metrics'],
  ['ofertas operador', () => api.ofertas.delOperador({ estado: 'ACTIVA' }), 'GET', '/operator/offers?estado=ACTIVA'],
  ['métricas operador', () => api.ofertas.metricasOperador('a', 'b'), 'GET', '/operator/offers/metrics?desde=a&hasta=b'],
  ['rutas seguidas', () => api.ofertas.rutasSeguidas(), 'GET', '/offers/follows'],
  ['seguir', () => api.ofertas.seguirRuta('A', 'B'), 'POST', '/offers/follows', { origen: 'A', destino: 'B' }],
  ['dejar de seguir', () => api.ofertas.dejarDeSeguir(id), 'DELETE', '/offers/follows/id-1'],
  ['reglas', () => api.ofertas.reglas(), 'GET', '/operator/auto-offer-rules'],
  ['crear regla', () => api.ofertas.crearRegla({ horasAntes: 1 }), 'POST', '/operator/auto-offer-rules'],
  ['editar regla', () => api.ofertas.editarRegla(id, { horasAntes: 1 }), 'PUT', '/operator/auto-offer-rules/id-1'],
  ['borrar regla', () => api.ofertas.borrarRegla(id), 'DELETE', '/operator/auto-offer-rules/id-1'],
  ['plantillas', () => api.ofertas.plantillas(), 'GET', '/operator/offer-templates'],
  ['crear plantilla', () => api.ofertas.crearPlantilla({ cupo: 1 }), 'POST', '/operator/offer-templates'],
  ['editar plantilla', () => api.ofertas.editarPlantilla(id, { cupo: 1 }), 'PUT', '/operator/offer-templates/id-1'],
  ['borrar plantilla', () => api.ofertas.borrarPlantilla(id), 'DELETE', '/operator/offer-templates/id-1'],
  ['seguimiento', () => api.viaje.seguimiento(id), 'GET', '/itineraries/id-1/bus-position'],
  ['eta', () => api.viaje.eta(id), 'GET', '/itineraries/id-1/eta'],
  ['recorrido', () => api.viaje.recorrido(id), 'GET', '/itineraries/id-1/track'],
  ['novedades', () => api.viaje.novedades(id), 'GET', '/trips/id-1/timeline'],
  ['reportar', () => api.viaje.reportar(id, { tipo: 'INICIO' }), 'POST', '/trips/id-1/events', { tipo: 'INICIO' }],
  ['compartir', () => api.viaje.compartir(id), 'POST', '/share-links', { itineraryId: id }],
  ['compartido', () => api.viaje.compartido('AB12'), 'GET', '/share/AB12'],
  ['flota', () => api.flota.enVivo('c'), 'GET', '/fleet/live?companyId=c'],
  ['alertas', () => api.flota.alertas(), 'GET', '/alerts?estado=ABIERTA'],
  ['resolver', () => api.flota.resolverAlerta(id, 'a', 'listo'), 'POST', '/trips/id-1/alerts/a/resolve', { nota: 'listo' }],
  ['forzar fin', () => api.flota.forzarFin(id), 'POST', '/trips/id-1/finish'],
  ['viajes conductor', () => api.conductor.misViajes(), 'GET', '/driver/trips'],
  ['viaje activo', () => api.conductor.viajeActivo(), 'GET', '/driver/trips/active'],
  ['iniciar', () => api.conductor.iniciarViaje(id, { manifiestoRevisado: true, documentosBus: true, lucesYLlantas: true, botiquinYExtintor: true }), 'POST', '/driver/trips/id-1/start'],
  ['finalizar', () => api.conductor.finalizarViaje(id), 'POST', '/driver/trips/id-1/finish'],
  ['sos', () => api.conductor.enviarSos('Ayuda'), 'POST', '/driver/sos', { mensaje: 'Ayuda' }],
  ['rastreo on', () => api.conductor.iniciarRastreo(), 'POST', '/driver/tracking/start'],
  ['rastreo off', () => api.conductor.detenerRastreo(), 'POST', '/driver/tracking/stop'],
  ['ubicación', () => api.conductor.enviarUbicacion(ubicacion), 'POST', '/driver/location', ubicacion],
  ['ubicaciones', () => api.conductor.enviarUbicaciones([ubicacion]), 'POST', '/driver/location/batch', [ubicacion]],
  ['llave push', () => api.push.llavePublica(), 'GET', '/push/public-key'],
  ['suscribir push', () => api.push.suscribir({ endpoint: 'https://p', keys: { p256dh: 'k', auth: 'a' } }), 'POST', '/push/subscriptions'],
  ['anular push', () => api.push.anular('https://p'), 'DELETE', '/push/subscriptions', { endpoint: 'https://p' }],
  ['seed', () => api.admin.seed(), 'POST', '/admin/seed'],
]

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  sesion.iniciar({ accessToken: 'access', expiresAt: new Date(Date.now() + 60_000).toISOString(), refreshToken: 'refresh', userId: 'user', rol: 'ADMIN' })
  fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  sesion.cerrar()
})

describe('endpoints de la API TripBus', () => {
  it.each(casos)('%s', async (_nombre, llamar, metodo, url, cuerpo) => {
    await llamar()
    expect(fetchMock).toHaveBeenCalledOnce()
    const [u, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(u).toBe(`/api/v1${url}`)
    expect(init.method).toBe(metodo)
    if (cuerpo !== undefined) expect(JSON.parse(String(init.body))).toEqual(cuerpo)
  })

  it('el pago y la taquilla mandan la Idempotency-Key; los PDF piden application/pdf', async () => {
    await api.reservas.pagar(id, { cardToken: 'tok' }, 'clave-1')
    await api.taquilla.vender({ itineraryId: id, seatNumbers: ['1'], pasajeros: [pasajero], comprador: { nombre: 'Ana' } }, 'clave-2')
    await api.reservas.pdfTiquete(id)
    const headers = fetchMock.mock.calls.map(([, init]) => (init as RequestInit).headers as Record<string, string>)
    expect(headers[0]['Idempotency-Key']).toBe('clave-1')
    expect(headers[1]['Idempotency-Key']).toBe('clave-2')
    expect(headers[2].Accept).toBe('application/pdf')
  })

  it('la búsqueda filtrada lee el total de X-Total-Count', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify([{ itineraryId: 'a' }]), { status: 200, headers: { 'X-Total-Count': '37' } }))
    const r = await api.catalogo.buscarFiltrado('A', 'B', '2026-11-15', { franja: 'MANANA', page: 2, size: 10 })
    expect(r).toEqual({ viajes: [{ itineraryId: 'a' }], total: 37 })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/trips/search?origin=A&destination=B&date=2026-11-15&franja=MANANA&page=2&size=10')
  })

  it('sin X-Total-Count el total es el tamaño de la lista', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify([{ itineraryId: 'a' }, { itineraryId: 'b' }]), { status: 200 }))
    expect((await api.catalogo.buscarFiltrado('A', 'B', '2026-11-15', {})).total).toBe(2)
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    expect(await api.catalogo.buscarFiltrado('A', 'B', '2026-11-15', {})).toEqual({ viajes: [], total: 0 })
  })
})
