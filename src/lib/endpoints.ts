import { solicitar, solicitarBlob, solicitarConTotal } from './api'
import { sesion } from './sesion'
import type {
  AgrupacionVentas,
  AlertaConductor,
  AlertaViaje,
  AsignacionConductor,
  AuthResponse,
  BancoPse,
  Bus,
  BusRequest,
  CambiarPasswordRequest,
  CambioItinerario,
  ChecklistInicioViaje,
  CierreCaja,
  CodigosRecuperacion,
  CondicionesEmpresa,
  ConductorAsignable,
  ConfiguracionMfa,
  CrearItinerarioRequest,
  CrearOfertaRequest,
  CrearUsuarioRequest,
  Cupon,
  CuponRequest,
  CupoOferta,
  DescuentoPasajero,
  DetalleItinerario,
  DiaCalendario,
  Distribucion,
  DuplicarOfertaRequest,
  EditarOfertaRequest,
  Empresa,
  EmpresaBusqueda,
  EnlaceCompartido,
  EstadoBus,
  EstadosAsientos,
  Eta,
  FacetasBusqueda,
  FiltroAuditoria,
  FiltroItinerarios,
  FiltroOfertasOperador,
  FiltrosBusqueda,
  FiltrosCalendario,
  FiltroUsuarios,
  FlotaEnVivo,
  GoogleLoginRequest,
  IdaYVuelta,
  LoginRequest,
  Lugar,
  MapaAsientos,
  MetricasOferta,
  MetricasOperador,
  MisDatos,
  Novedad,
  NovedadRequest,
  OcupacionAsientos,
  Oferta,
  OfertaOperador,
  OfertaVitrina,
  Pagina,
  PaginaViajesOperador,
  Pago,
  PagoRequest,
  PasajeroRequest,
  Perfil,
  PerfilRequest,
  PlantillaOferta,
  PrecioItinerario,
  PrecioTramo,
  ProgramacionRequest,
  ProgresoViaje,
  Proveedores,
  RecargoAsiento,
  RecorridoViaje,
  RegistroAuditoria,
  RegistroRequest,
  ReglaOfertaAutomatica,
  ReportePlataforma,
  ReportePuntualidad,
  ReporteVentas,
  RespuestaLogin,
  RespuestaLoteUbicaciones,
  RespuestaUbicacionConductor,
  Reserva,
  ReservaAfectada,
  ReservaOferta,
  ResultadoBloqueo,
  ResultadoBusqueda,
  ResultadoProgramacion,
  ResultadoViaje,
  ResumenItinerario,
  Retencion,
  Rol,
  Ruta,
  RutaRequest,
  RutaSeguida,
  SalaEspera,
  SegundoPasoRequest,
  Seguimiento,
  SuscripcionPush,
  Temporada,
  TemporadaRequest,
  Terminal,
  TerminalRequest,
  Tiquete,
  TipoPasajero,
  TurnoEspera,
  UbicacionConductorRequest,
  Usuario,
  UsuarioAdmin,
  Uuid,
  ValidacionTiquete,
  VentaTaquilla,
  VentaTaquillaRequest,
  ViajeCompartido,
  ViajeConductor,
  ViajeMio,
} from './tipos'

const PDF = 'application/pdf'
const CSV = 'text/csv'
const conToken = { auth: 'requerido' } as const

/**
 * Todas las llamadas del frontend al API Gateway, agrupadas por microservicio.
 * Las rutas son las mismas que documenta el README de cada servicio (rama develop).
 */
export const api = {
  /* ------------------------------------------------ Identity */
  auth: {
    /** Con 2FA activa responde { mfaRequired, mfaToken } sin tokens (US-106). */
    login: (datos: LoginRequest) => solicitar<RespuestaLogin>('POST', '/auth/login', { auth: 'ninguno', body: datos }),
    segundoPaso: (datos: SegundoPasoRequest) =>
      solicitar<AuthResponse>('POST', '/auth/2fa', { auth: 'ninguno', body: datos }),
    registro: (datos: RegistroRequest) =>
      solicitar<AuthResponse>('POST', '/auth/register', { auth: 'ninguno', body: datos }),
    logout: () => solicitar<void>('POST', '/auth/logout', { auth: 'requerido', body: { refreshToken: sesion.refreshToken() } }),
    usuario: (id: Uuid) => solicitar<Usuario>('GET', `/users/${id}`, conToken),
    /** US-125: siempre 202 (exista o no el correo). */
    pedirRecuperacion: (email: string) =>
      solicitar<void>('POST', '/auth/password-reset/request', { auth: 'ninguno', body: { email } }),
    restablecer: (token: string, nuevaPassword: string) =>
      solicitar<void>('POST', '/auth/password-reset/confirm', { auth: 'ninguno', body: { token, nuevaPassword } }),
    /** US-130: el token del enlace del correo. */
    verificarCorreo: (token: string) =>
      solicitar<void>('POST', '/auth/verify-email', { auth: 'ninguno', body: { token } }),
    reenviarVerificacion: () => solicitar<void>('POST', '/auth/verify-email/resend', conToken),
    /** Qué proveedores externos están encendidos (el clientId de Google nunca va fijo en el código). */
    proveedores: () => solicitar<Proveedores>('GET', '/auth/providers', { auth: 'ninguno' }),
    /** ID token de Google Identity Services; 422 GOOGLE_REGISTRO_INCOMPLETO pide documento y política. */
    google: (datos: GoogleLoginRequest) => solicitar<RespuestaLogin>('POST', '/auth/google', { auth: 'ninguno', body: datos }),
  },

  /* ------------------------------------------------ Identity: mi cuenta */
  cuenta: {
    perfil: () => solicitar<Perfil>('GET', '/users/me', conToken),
    editar: (datos: PerfilRequest) => solicitar<Perfil>('PUT', '/users/me', { auth: 'requerido', body: datos }),
    /** US-129: responde un token nuevo (los anteriores dejan de valer). */
    cambiarPassword: (datos: CambiarPasswordRequest) =>
      solicitar<AuthResponse>('POST', '/users/me/password', { auth: 'requerido', body: datos }),
    /** US-131 (Ley 1581). */
    misDatos: () => solicitar<MisDatos>('GET', '/users/me/data', conToken),
    eliminar: (password: string) =>
      solicitar<void>('POST', '/users/me/delete', { auth: 'requerido', body: { password, confirmacion: 'ELIMINAR' } }),
    /** US-106 (ADMIN y OPERADOR). */
    configurarMfa: () => solicitar<ConfiguracionMfa>('POST', '/users/me/2fa/setup', conToken),
    activarMfa: (code: string) =>
      solicitar<CodigosRecuperacion>('POST', '/users/me/2fa/enable', { auth: 'requerido', body: { code } }),
    desactivarMfa: (password: string, code: string) =>
      solicitar<void>('POST', '/users/me/2fa/disable', { auth: 'requerido', body: { password, code } }),
  },

  /* ------------------------------------------------ Identity: administración (A-02, A-03) */
  usuarios: {
    listar: (filtro: FiltroUsuarios = {}) => solicitar<Pagina<UsuarioAdmin>>('GET', '/users', { auth: 'requerido', query: filtro }),
    crear: (datos: CrearUsuarioRequest) => solicitar<UsuarioAdmin>('POST', '/users', { auth: 'requerido', body: datos }),
    cambiarRol: (id: Uuid, datos: { rol: Rol; companyId?: Uuid | null }) =>
      solicitar<UsuarioAdmin>('PUT', `/users/${id}/role`, { auth: 'requerido', body: datos }),
    cambiarEstado: (id: Uuid, activo: boolean, motivo: string) =>
      solicitar<UsuarioAdmin>('PATCH', `/users/${id}/estado`, { auth: 'requerido', body: { activo, motivo } }),
    desbloquear: (id: Uuid) => solicitar<void>('DELETE', `/users/${id}/lock`, conToken),
    auditoria: (filtro: FiltroAuditoria = {}) =>
      solicitar<Pagina<RegistroAuditoria>>('GET', '/admin/audit', { auth: 'requerido', query: filtro }),
  },

  /* ------------------------------------------------ Catalog: búsqueda */
  catalogo: {
    /** fecha en formato YYYY-MM-DD (hora de Colombia) */
    buscar: (origen: string, destino: string, fecha: string, signal?: AbortSignal) =>
      solicitar<ResultadoViaje[]>('GET', '/trips/search', {
        query: { origin: origen, destination: destino, date: fecha },
        signal,
      }),
    /** T-05 / P-01: con filtros y paginado; el total llega en X-Total-Count. */
    buscarFiltrado: async (origen: string, destino: string, fecha: string, filtros: FiltrosBusqueda, signal?: AbortSignal): Promise<ResultadoBusqueda> => {
      const { datos, total } = await solicitarConTotal<ResultadoViaje[]>('GET', '/trips/search', {
        query: { origin: origen, destination: destino, date: fecha, ...filtros },
        signal,
      })
      const viajes = datos ?? []
      return { viajes, total: total ?? viajes.length }
    },
    empresasDeBusqueda: (origen: string, destino: string, fecha: string) =>
      solicitar<EmpresaBusqueda[]>('GET', '/trips/search/companies', { query: { origin: origen, destination: destino, date: fecha } }),
    /** US-136: con los mismos tramos, companyId, franja y tipoBus que la búsqueda de la lista. */
    calendario: (origen: string, destino: string, desde: string, dias = 7, filtros: FiltrosCalendario = {}) =>
      solicitar<DiaCalendario[]>('GET', '/trips/calendar', {
        query: { origin: origen, destination: destino, from: desde, days: dias, ...filtros },
      }),
    /** Límites de precio, empresas y tipos de bus para armar los filtros de ese día y esa ruta. */
    facetas: (origen: string, destino: string, fecha: string, filtros: FiltrosCalendario = {}) =>
      solicitar<FacetasBusqueda>('GET', '/trips/search/facets', {
        query: { origin: origen, destination: destino, date: fecha, ...filtros },
      }),
    idaYVuelta: (origen: string, destino: string, fecha: string, regreso: string, filtros: FiltrosBusqueda = {}) =>
      solicitar<IdaYVuelta>('GET', '/trips/round-trip', {
        query: { origin: origen, destination: destino, date: fecha, returnDate: regreso, ...filtros },
      }),
    lugares: (q: string, signal?: AbortSignal) => solicitar<Lugar[]>('GET', '/places', { query: { q }, signal }),
    ciudades: () => solicitar<string[]>('GET', '/trips/cities'),
    itinerario: (id: Uuid) => solicitar<DetalleItinerario>('GET', `/itineraries/${id}`),
    mapa: (id: Uuid) => solicitar<MapaAsientos>('GET', `/itineraries/${id}/seatmap`),
    /** US-138: desglose por tramo y tipo de pasajero. */
    precio: (id: Uuid, tramo: { from?: number | null; to?: number | null }, tipos: TipoPasajero[]) =>
      solicitar<PrecioItinerario>('GET', `/itineraries/${id}/price`, {
        query: { from: tramo.from ?? undefined, to: tramo.to ?? undefined, tipos: tipos.join(',') },
      }),
    terminales: (ciudad?: string) => solicitar<Terminal[]>('GET', '/terminals', { query: { ciudad } }),
  },

  /* ------------------------------------------------ Catalog: operador (O-01, O-04) */
  operador: {
    viajes: (filtro: { desde?: string; hasta?: string; companyId?: Uuid; page?: number; size?: number }) =>
      solicitar<PaginaViajesOperador>('GET', '/operator/trips', { auth: 'requerido', query: filtro }),
    itinerarios: (filtro: FiltroItinerarios) =>
      solicitar<Pagina<ResumenItinerario>>('GET', '/itineraries', { auth: 'requerido', query: filtro }),
    /** US-121: conductores activos de la empresa (el ADMIN filtra con companyId). */
    conductores: (companyId?: Uuid) =>
      solicitar<ConductorAsignable[]>('GET', '/users/drivers', { auth: 'requerido', query: { companyId } }),
    conductorAsignado: (itineraryId: Uuid) => solicitar<AsignacionConductor[]>('GET', `/trips/${itineraryId}/driver`, conToken),
    asignarConductor: (itineraryId: Uuid, conductorId: Uuid) =>
      solicitar<AsignacionConductor>('PUT', `/trips/${itineraryId}/driver`, { auth: 'requerido', body: { conductorId, rol: 'PRINCIPAL' } }),
    quitarConductor: (itineraryId: Uuid) => solicitar<void>('DELETE', `/trips/${itineraryId}/driver/PRINCIPAL`, conToken),
    programar: (datos: CrearItinerarioRequest) => solicitar<ResumenItinerario>('POST', '/itineraries', { auth: 'requerido', body: datos }),
    programarRecurrente: (datos: ProgramacionRequest) =>
      solicitar<ResultadoProgramacion>('POST', '/itineraries/schedule', { auth: 'requerido', body: datos }),
    cambiarSalida: (id: Uuid, nuevaFechaSalida: string, motivo: string) =>
      solicitar<ResumenItinerario>('PATCH', `/itineraries/${id}/departure`, { auth: 'requerido', body: { nuevaFechaSalida, motivo } }),
    cambiarBus: (id: Uuid, busId: Uuid, motivo: string) =>
      solicitar<ResumenItinerario>('PATCH', `/itineraries/${id}/bus`, { auth: 'requerido', body: { busId, motivo } }),
    cancelar: (id: Uuid, motivo: string) =>
      solicitar<unknown>('POST', `/admin/itineraries/${id}/cancel`, { auth: 'requerido', body: { motivo } }),
    historial: (id: Uuid) => solicitar<CambioItinerario[]>('GET', `/itineraries/${id}/changes`, conToken),
  },

  /* ------------------------------------------------ Catalog: buses, rutas, empresas, terminales y tarifas */
  buses: {
    listar: (filtro: { estado?: EstadoBus; companyId?: Uuid; page?: number; size?: number } = {}) =>
      solicitar<Pagina<Bus>>('GET', '/buses', { auth: 'requerido', query: filtro }),
    obtener: (id: Uuid) => solicitar<Bus>('GET', `/buses/${id}`, conToken),
    crear: (datos: BusRequest) => solicitar<Bus>('POST', '/buses', { auth: 'requerido', body: datos }),
    editar: (id: Uuid, datos: BusRequest) => solicitar<Bus>('PUT', `/buses/${id}`, { auth: 'requerido', body: datos }),
    cambiarEstado: (id: Uuid, estado: EstadoBus) => solicitar<Bus>('PATCH', `/buses/${id}/estado`, { auth: 'requerido', body: { estado } }),
    mapa: (id: Uuid) => solicitar<Distribucion>('GET', `/buses/${id}/seatmap`, conToken),
    guardarMapa: (id: Uuid, mapa: Distribucion) => solicitar<Distribucion>('PUT', `/buses/${id}/seatmap`, { auth: 'requerido', body: mapa }),
  },
  rutas: {
    listar: (filtro: { estado?: string; origen?: string; destino?: string; companyId?: Uuid; page?: number; size?: number } = {}) =>
      solicitar<Pagina<Ruta>>('GET', '/routes', { auth: 'requerido', query: filtro }),
    obtener: (id: Uuid) => solicitar<Ruta>('GET', `/routes/${id}`, conToken),
    crear: (datos: RutaRequest) => solicitar<Ruta>('POST', '/routes', { auth: 'requerido', body: datos }),
    editar: (id: Uuid, datos: RutaRequest) => solicitar<Ruta>('PUT', `/routes/${id}`, { auth: 'requerido', body: datos }),
    cambiarEstado: (id: Uuid, estado: 'ACTIVA' | 'INACTIVA') =>
      solicitar<Ruta>('PATCH', `/routes/${id}/estado`, { auth: 'requerido', body: { estado } }),
    guardarParadas: (id: Uuid, paradas: RutaRequest['paradas']) =>
      solicitar<Ruta>('PUT', `/routes/${id}/stops`, { auth: 'requerido', body: paradas }),
    preciosTramo: (id: Uuid) => solicitar<PrecioTramo[]>('GET', `/routes/${id}/segment-prices`, conToken),
    guardarPreciosTramo: (id: Uuid, precios: PrecioTramo[]) =>
      solicitar<PrecioTramo[]>('PUT', `/routes/${id}/segment-prices`, { auth: 'requerido', body: precios }),
  },
  empresas: {
    listar: (filtro: { estado?: string; page?: number; size?: number } = {}) =>
      solicitar<Pagina<Empresa>>('GET', '/companies', { auth: 'requerido', query: filtro }),
    obtener: (id: Uuid) => solicitar<Empresa>('GET', `/companies/${id}`, conToken),
    crear: (datos: { nombre: string; nit: string }) => solicitar<Empresa>('POST', '/companies', { auth: 'requerido', body: datos }),
    editar: (id: Uuid, datos: { nombre: string; nit: string }) =>
      solicitar<Empresa>('PUT', `/companies/${id}`, { auth: 'requerido', body: datos }),
    cambiarEstado: (id: Uuid, estado: 'ACTIVA' | 'INACTIVA') =>
      solicitar<Empresa>('PATCH', `/companies/${id}/estado`, { auth: 'requerido', body: { estado } }),
    condiciones: (id: Uuid) => solicitar<CondicionesEmpresa[]>('GET', `/companies/${id}/terms`, conToken),
    agregarCondiciones: (id: Uuid, datos: { cuotaMensual: number; comisionPorcentaje: number; vigenteDesde: string }) =>
      solicitar<CondicionesEmpresa>('POST', `/companies/${id}/terms`, { auth: 'requerido', body: datos }),
  },
  terminales: {
    crear: (datos: TerminalRequest) => solicitar<Terminal>('POST', '/terminals', { auth: 'requerido', body: datos }),
    editar: (id: Uuid, datos: TerminalRequest) => solicitar<Terminal>('PUT', `/terminals/${id}`, { auth: 'requerido', body: datos }),
    borrar: (id: Uuid) => solicitar<void>('DELETE', `/terminals/${id}`, conToken),
  },
  tarifas: {
    temporadas: (companyId?: Uuid) => solicitar<Temporada[]>('GET', '/fares/seasons', { auth: 'requerido', query: { companyId } }),
    crearTemporada: (datos: TemporadaRequest) => solicitar<Temporada>('POST', '/fares/seasons', { auth: 'requerido', body: datos }),
    editarTemporada: (id: Uuid, datos: TemporadaRequest) =>
      solicitar<Temporada>('PUT', `/fares/seasons/${id}`, { auth: 'requerido', body: datos }),
    borrarTemporada: (id: Uuid) => solicitar<void>('DELETE', `/fares/seasons/${id}`, conToken),
    tiposPasajero: (companyId?: Uuid) =>
      solicitar<DescuentoPasajero[]>('GET', '/fares/passenger-types', { auth: 'requerido', query: { companyId } }),
    guardarTipoPasajero: (tipo: TipoPasajero, descuentoPorcentaje: number, companyId?: Uuid) =>
      solicitar<DescuentoPasajero>('PUT', `/fares/passenger-types/${tipo}`, { auth: 'requerido', body: { companyId, descuentoPorcentaje } }),
    borrarTipoPasajero: (tipo: TipoPasajero, companyId?: Uuid) =>
      solicitar<void>('DELETE', `/fares/passenger-types/${tipo}`, { auth: 'requerido', query: { companyId } }),
    recargos: (companyId?: Uuid) => solicitar<RecargoAsiento[]>('GET', '/fares/seat-surcharges', { auth: 'requerido', query: { companyId } }),
    guardarRecargo: (categoria: string, recargo: number, companyId?: Uuid) =>
      solicitar<RecargoAsiento>('PUT', `/fares/seat-surcharges/${categoria}`, { auth: 'requerido', body: { companyId, recargo } }),
    borrarRecargo: (categoria: string, companyId?: Uuid) =>
      solicitar<void>('DELETE', `/fares/seat-surcharges/${categoria}`, { auth: 'requerido', query: { companyId } }),
  },

  /* ------------------------------------------------ Seat Inventory */
  asientos: {
    /** US-142: con from/to, el estado de cada asiento en ese tramo. */
    estados: (itineraryId: Uuid, tramo: { from?: number; to?: number } = {}) =>
      solicitar<EstadosAsientos>('GET', `/seats/itineraries/${itineraryId}`, { query: tramo }),
    /** US-142: con fromOrden/toOrden la retención es de un tramo. */
    retener: (itineraryId: Uuid, seatNumbers: string[], tramo: { fromOrden?: number; toOrden?: number } = {}) =>
      solicitar<Retencion>('POST', '/seats/holds', { auth: 'requerido', body: { itineraryId, seatNumbers, ...tramo } }),
    retencion: (holdId: Uuid) => solicitar<Retencion>('GET', `/seats/holds/${holdId}`, conToken),
    extender: (holdId: Uuid) => solicitar<Retencion>('POST', `/seats/holds/${holdId}/extend`, conToken),
    liberar: (holdId: Uuid) => solicitar<void>('DELETE', `/seats/holds/${holdId}`, conToken),
    bloquear: (itineraryId: Uuid, seatNumbers: string[], motivo: string) =>
      solicitar<ResultadoBloqueo>('POST', `/seats/itineraries/${itineraryId}/blocks`, { auth: 'requerido', body: { seatNumbers, motivo } }),
    desbloquear: (itineraryId: Uuid, seatNumbers: string[]) =>
      solicitar<ResultadoBloqueo>('DELETE', `/seats/itineraries/${itineraryId}/blocks`, { auth: 'requerido', body: { seatNumbers } }),
    ocupacion: (itineraryId: Uuid) => solicitar<OcupacionAsientos>('GET', `/seats/itineraries/${itineraryId}/occupancy`, conToken),
    anotarseEnEspera: (itineraryId: Uuid, cantidad: number) =>
      solicitar<TurnoEspera>('POST', `/seats/itineraries/${itineraryId}/waitlist`, { auth: 'requerido', body: { cantidad } }),
    salirDeEspera: (itineraryId: Uuid) => solicitar<void>('DELETE', `/seats/itineraries/${itineraryId}/waitlist`, conToken),
    misTurnos: () => solicitar<TurnoEspera[]>('GET', '/seats/waitlist/me', conToken),
  },

  /* ------------------------------------------------ Booking + Payment */
  reservas: {
    crear: (holdId: Uuid, pasajeros: PasajeroRequest[], cupon?: string) =>
      solicitar<Reserva>('POST', '/bookings', { auth: 'requerido', body: { holdId, pasajeros, cupon: cupon || undefined } }),
    mias: () => solicitar<Reserva[]>('GET', '/bookings', conToken),
    /** US-145: próximos o pasados, paginado (la página trae `items`). */
    misViajes: (scope: 'proximos' | 'pasados', page = 0, size = 10) =>
      solicitar<Pagina<ViajeMio>>('GET', '/bookings', { auth: 'requerido', query: { scope, page, size } }),
    obtener: (id: Uuid) => solicitar<Reserva>('GET', `/bookings/${id}`, conToken),
    /** Requiere Idempotency-Key: reintentar con la MISMA clave nunca cobra dos veces. */
    pagar: (id: Uuid, pago: PagoRequest, idempotencyKey: string) =>
      solicitar<Pago>('POST', `/bookings/${id}/pay`, { auth: 'requerido', body: pago, idempotencyKey }),
    bancosPse: () => solicitar<BancoPse[]>('GET', '/payments/pse/banks', { auth: 'ninguno' }),
    comprobantePago: (paymentId: Uuid) => solicitarBlob('GET', `/payments/${paymentId}/receipt.pdf`, { auth: 'requerido', formato: PDF }),
    comprobanteReembolso: (refundId: Uuid) => solicitarBlob('GET', `/refunds/${refundId}/receipt.pdf`, { auth: 'requerido', formato: PDF }),
    reprogramar: (id: Uuid, holdId: Uuid) => solicitar<Reserva>('POST', `/bookings/${id}/reschedule`, { auth: 'requerido', body: { holdId } }),
    tiquete: (id: Uuid) => solicitar<Tiquete>('GET', `/tickets/${id}`, conToken),
    reenviarTiquete: (id: Uuid) => solicitar<unknown>('POST', `/tickets/${id}/resend`, conToken),
    pdfTiquete: (id: Uuid) => solicitarBlob('GET', `/tickets/${id}/pdf`, { auth: 'requerido', formato: PDF }),
    cambiarAsiento: (id: Uuid, fromSeat: string, toSeat: string) =>
      solicitar<Tiquete>('POST', `/tickets/${id}/seat`, { auth: 'requerido', body: { fromSeat, toSeat } }),
    corregirPasajero: (id: Uuid, passengerId: Uuid, datos: Omit<PasajeroRequest, 'tipoPasajero'>) =>
      solicitar<Tiquete>('PATCH', `/tickets/${id}/passengers/${passengerId}`, { auth: 'requerido', body: datos }),
    manifiestoCsv: (itineraryId: Uuid) =>
      solicitarBlob('GET', `/itineraries/${itineraryId}/manifest`, { auth: 'requerido', query: { format: 'csv' } }),
    /** Abordaje: conductor, operador o admin leen el QR del pasajero. */
    validarTiquete: (qrCode: string) =>
      solicitar<ValidacionTiquete>('POST', '/tickets/validate', { auth: 'requerido', body: { qrCode } }),
  },

  /* ------------------------------------------------ Booking: viajes afectados por la empresa (US-154) */
  afectados: {
    listar: () => solicitar<ReservaAfectada[]>('GET', '/bookings/affected', conToken),
    obtener: (bookingId: Uuid) => solicitar<ReservaAfectada>('GET', `/bookings/${bookingId}/affected`, conToken),
    reprogramar: (bookingId: Uuid, holdId: Uuid) =>
      solicitar<ReservaAfectada>('POST', `/bookings/${bookingId}/affected/reschedule`, { auth: 'requerido', body: { holdId } }),
    reembolsar: (bookingId: Uuid) => solicitar<ReservaAfectada>('POST', `/bookings/${bookingId}/affected/refund`, conToken),
    aceptar: (bookingId: Uuid) => solicitar<ReservaAfectada>('POST', `/bookings/${bookingId}/affected/accept`, conToken),
  },

  /* ------------------------------------------------ Booking: taquilla, cupones y reportes */
  taquilla: {
    vender: (datos: VentaTaquillaRequest, idempotencyKey: string) =>
      solicitar<VentaTaquilla>('POST', '/box-office/sales', { auth: 'requerido', body: datos, idempotencyKey }),
    cierre: (fecha: string) => solicitar<CierreCaja>('GET', '/box-office/sales', { auth: 'requerido', query: { fecha } }),
  },
  cupones: {
    listar: (companyId?: Uuid) => solicitar<Cupon[]>('GET', '/coupons', { auth: 'requerido', query: { companyId } }),
    crear: (datos: CuponRequest) => solicitar<Cupon>('POST', '/coupons', { auth: 'requerido', body: datos }),
    editar: (id: Uuid, datos: CuponRequest) => solicitar<Cupon>('PUT', `/coupons/${id}`, { auth: 'requerido', body: datos }),
    desactivar: (id: Uuid) => solicitar<void>('DELETE', `/coupons/${id}`, conToken),
  },
  reportes: {
    ventas: (desde: string, hasta: string, agrupar: AgrupacionVentas, companyId?: Uuid) =>
      solicitar<ReporteVentas>('GET', '/reports/sales', { auth: 'requerido', query: { desde, hasta, agrupar, companyId } }),
    ventasCsv: (desde: string, hasta: string, agrupar: AgrupacionVentas, companyId?: Uuid) =>
      solicitarBlob('GET', '/reports/sales.csv', { auth: 'requerido', formato: CSV, query: { desde, hasta, agrupar, companyId } }),
    puntualidad: (desde: string, hasta: string, agrupar: 'ruta' | 'conductor', companyId?: Uuid) =>
      solicitar<ReportePuntualidad>('GET', '/reports/punctuality', { auth: 'requerido', query: { desde, hasta, agrupar, companyId } }),
    plataforma: (mes: string) => solicitar<ReportePlataforma>('GET', '/reports/platform', { auth: 'requerido', query: { mes } }),
    plataformaCsv: (mes: string) => solicitarBlob('GET', '/reports/platform.csv', { auth: 'requerido', formato: CSV, query: { mes } }),
  },

  /* ------------------------------------------------ Flash Offers */
  ofertas: {
    listar: (itineraryId?: Uuid) => solicitar<Oferta[]>('GET', '/offers', { query: { itineraryId } }),
    obtener: (id: Uuid) => solicitar<Oferta>('GET', `/offers/${id}`),
    cupo: (id: Uuid) => solicitar<CupoOferta>('GET', `/offers/${id}/quota`),
    apartar: (id: Uuid, docId: string) =>
      solicitar<ReservaOferta>('POST', `/offers/${id}/reservations`, { auth: 'requerido', body: { docId } }),
    /** P-10: activas y próximas 48 h. */
    vitrina: (filtro: { origin?: string; destination?: string; page?: number; size?: number }) =>
      solicitar<Pagina<OfertaVitrina>>('GET', '/offers/showcase', { query: filtro }),
    /** US-162: sala de espera virtual. */
    entrarFila: (id: Uuid) => solicitar<SalaEspera>('POST', `/offers/${id}/queue`, conToken),
    miTurno: (id: Uuid) => solicitar<SalaEspera>('GET', `/offers/${id}/queue/me`, conToken),
    /** US-054 (operador o admin de la empresa del viaje). */
    crear: (datos: CrearOfertaRequest) => solicitar<Oferta>('POST', '/offers', { auth: 'requerido', body: datos }),
    activar: (id: Uuid) => solicitar<Oferta>('POST', `/offers/${id}/activate`, conToken),
    cerrar: (id: Uuid) => solicitar<Oferta>('POST', `/offers/${id}/close`, conToken),
    editar: (id: Uuid, datos: EditarOfertaRequest) => solicitar<Oferta>('PUT', `/offers/${id}`, { auth: 'requerido', body: datos }),
    cancelar: (id: Uuid) => solicitar<void>('DELETE', `/offers/${id}`, conToken),
    duplicar: (id: Uuid, datos: DuplicarOfertaRequest) =>
      solicitar<Oferta>('POST', `/offers/${id}/duplicate`, { auth: 'requerido', body: datos }),
    metricas: (id: Uuid) => solicitar<MetricasOferta>('GET', `/offers/${id}/metrics`, conToken),
    delOperador: (filtro: FiltroOfertasOperador) =>
      solicitar<Pagina<OfertaOperador>>('GET', '/operator/offers', { auth: 'requerido', query: filtro }),
    metricasOperador: (desde: string, hasta: string) =>
      solicitar<MetricasOperador>('GET', '/operator/offers/metrics', { auth: 'requerido', query: { desde, hasta } }),
    /** P-11: hasta 10 rutas seguidas. */
    rutasSeguidas: () => solicitar<RutaSeguida[]>('GET', '/offers/follows', conToken),
    seguirRuta: (origen: string, destino: string) =>
      solicitar<RutaSeguida>('POST', '/offers/follows', { auth: 'requerido', body: { origen, destino } }),
    dejarDeSeguir: (id: Uuid) => solicitar<void>('DELETE', `/offers/follows/${id}`, conToken),
    /** O-09: reglas automáticas y plantillas recurrentes. */
    reglas: () => solicitar<ReglaOfertaAutomatica[]>('GET', '/operator/auto-offer-rules', conToken),
    crearRegla: (datos: Partial<ReglaOfertaAutomatica>) =>
      solicitar<ReglaOfertaAutomatica>('POST', '/operator/auto-offer-rules', { auth: 'requerido', body: datos }),
    editarRegla: (id: Uuid, datos: Partial<ReglaOfertaAutomatica>) =>
      solicitar<ReglaOfertaAutomatica>('PUT', `/operator/auto-offer-rules/${id}`, { auth: 'requerido', body: datos }),
    borrarRegla: (id: Uuid) => solicitar<void>('DELETE', `/operator/auto-offer-rules/${id}`, conToken),
    plantillas: () => solicitar<PlantillaOferta[]>('GET', '/operator/offer-templates', conToken),
    crearPlantilla: (datos: Partial<PlantillaOferta>) =>
      solicitar<PlantillaOferta>('POST', '/operator/offer-templates', { auth: 'requerido', body: datos }),
    editarPlantilla: (id: Uuid, datos: Partial<PlantillaOferta>) =>
      solicitar<PlantillaOferta>('PUT', `/operator/offer-templates/${id}`, { auth: 'requerido', body: datos }),
    borrarPlantilla: (id: Uuid) => solicitar<void>('DELETE', `/operator/offer-templates/${id}`, conToken),
  },

  /* ------------------------------------------------ Fleet + Trip Events */
  viaje: {
    seguimiento: (itineraryId: Uuid) => solicitar<Seguimiento>('GET', `/itineraries/${itineraryId}/bus-position`),
    eta: (itineraryId: Uuid) => solicitar<Eta>('GET', `/itineraries/${itineraryId}/eta`),
    recorrido: (itineraryId: Uuid) => solicitar<RecorridoViaje>('GET', `/itineraries/${itineraryId}/track`),
    novedades: (itineraryId: Uuid) => solicitar<Novedad[]>('GET', `/trips/${itineraryId}/timeline`),
    /** US-046 (conductor u operador de la empresa, o admin). */
    reportar: (itineraryId: Uuid, novedad: NovedadRequest) =>
      solicitar<Novedad>('POST', `/trips/${itineraryId}/events`, { auth: 'requerido', body: novedad }),
    /** US-181: enlace para un familiar (vence). */
    compartir: (itineraryId: Uuid) => solicitar<EnlaceCompartido>('POST', '/share-links', { auth: 'requerido', body: { itineraryId } }),
    compartido: (codigo: string) => solicitar<ViajeCompartido>('GET', `/share/${encodeURIComponent(codigo)}`, { auth: 'ninguno' }),
  },

  /* ------------------------------------------------ Fleet: operador (O-06) */
  flota: {
    enVivo: (companyId?: Uuid) => solicitar<FlotaEnVivo>('GET', '/fleet/live', { auth: 'requerido', query: { companyId } }),
    alertas: (estado: 'ABIERTA' | 'RESUELTA' = 'ABIERTA') => solicitar<AlertaViaje[]>('GET', '/alerts', { auth: 'requerido', query: { estado } }),
    resolverAlerta: (itineraryId: Uuid, alertId: Uuid, nota: string) =>
      solicitar<AlertaViaje>('POST', `/trips/${itineraryId}/alerts/${alertId}/resolve`, { auth: 'requerido', body: { nota } }),
    forzarFin: (itineraryId: Uuid) => solicitar<ProgresoViaje>('POST', `/trips/${itineraryId}/finish`, conToken),
  },

  /* ------------------------------------------------ Driver tracking */
  conductor: {
    misViajes: (fecha?: string) =>
      solicitar<ViajeConductor[]>('GET', '/driver/trips', { auth: 'requerido', query: { fecha } }),
    viajeActivo: () => solicitar<ViajeConductor>('GET', '/driver/trips/active', conToken),
    iniciarViaje: (itineraryId: Uuid, checklist: ChecklistInicioViaje, observacion?: string) =>
      solicitar<ProgresoViaje>('POST', `/driver/trips/${itineraryId}/start`, {
        auth: 'requerido',
        body: { checklist, observacion },
      }),
    finalizarViaje: (itineraryId: Uuid) =>
      solicitar<ProgresoViaje>('POST', `/driver/trips/${itineraryId}/finish`, conToken),
    enviarSos: (mensaje?: string) =>
      solicitar<AlertaConductor>('POST', '/driver/sos', { auth: 'requerido', body: { mensaje } }),
    iniciarRastreo: () => solicitar<void>('POST', '/driver/tracking/start', conToken),
    detenerRastreo: () => solicitar<void>('POST', '/driver/tracking/stop', conToken),
    enviarUbicacion: (ubicacion: UbicacionConductorRequest) =>
      solicitar<RespuestaUbicacionConductor | null>('POST', '/driver/location', { auth: 'requerido', body: ubicacion }),
    enviarUbicaciones: (ubicaciones: UbicacionConductorRequest[]) =>
      solicitar<RespuestaLoteUbicaciones>('POST', '/driver/location/batch', { auth: 'requerido', body: ubicaciones }),
  },

  /* ------------------------------------------------ Realtime: Web Push (T-06) */
  push: {
    llavePublica: () => solicitar<{ publicKey: string }>('GET', '/push/public-key', { auth: 'ninguno' }),
    suscribir: (suscripcion: SuscripcionPush) => solicitar<void>('POST', '/push/subscriptions', { auth: 'requerido', body: suscripcion }),
    anular: (endpoint: string) => solicitar<void>('DELETE', '/push/subscriptions', { auth: 'requerido', body: { endpoint } }),
  },

  /* ------------------------------------------------ Administración */
  admin: {
    /** HT-01: datos de demostración (solo ADMIN). Idempotente. */
    seed: () => solicitar<unknown>('POST', '/admin/seed', conToken),
  },
}
