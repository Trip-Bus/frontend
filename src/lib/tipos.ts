/**
 * Tipos de la API de TripBus, copiados de los DTO reales de cada microservicio.
 * Convenciones de Jackson en el backend: UUID → string, Instant → string ISO-8601 (UTC),
 * BigDecimal → number.
 */

export type Uuid = string
export type FechaIso = string

/** Error estándar de todos los servicios: { "error": { code, message, details } } */
export type ErrorApi = {
  error: { code: string; message: string; details?: Record<string, unknown> }
}

/* ------------------------------------------------------------------ identity */
export type Rol = 'PASAJERO' | 'OPERADOR' | 'CONDUCTOR' | 'ADMIN'

export type AuthResponse = {
  accessToken: string
  expiresAt: FechaIso
  userId: Uuid
  rol: Rol
  refreshToken?: string | null
  refreshExpiresAt?: FechaIso | null
}

export type RenovacionTokensResponse = {
  accessToken: string
  expiresAt: FechaIso
  refreshToken?: string | null
  refreshExpiresAt?: FechaIso | null
}

/** US-106: la cuenta tiene verificación en dos pasos: el login no trae tokens, solo el desafío (5 min, un uso). */
export type MfaRequerido = { mfaRequired: true; mfaToken: string }

export type RespuestaLogin = AuthResponse | MfaRequerido

/** Segundo paso del login: el código de 6 dígitos de la app o un código de recuperación. */
export type SegundoPasoRequest = { mfaToken: string; code?: string; recoveryCode?: string }

/** GET /users/me (US-128). */
export type Perfil = {
  id: Uuid
  email: string
  emailVerificado: boolean
  nombre: string
  telefono: string | null
  documentoIdentidad: string | null
  rol: Rol
  companyId: Uuid | null
  fechaCreacion: FechaIso
}

export type PerfilRequest = { nombre: string; telefono: string | null }

export type CambiarPasswordRequest = { passwordActual: string; passwordNueva: string }

/** GET /users/me/data (US-131, Ley 1581): lo que TripBus guarda de la persona. */
export type MisDatos = {
  perfil: Record<string, unknown>
  rol: Rol
  companyId: Uuid | null
  emailVerificado: boolean
  emailVerificadoEn: FechaIso | null
  consentimientos: Record<string, unknown>[]
  sesionesActivas: Record<string, unknown>[]
  verificacionDosPasos: boolean
  generadoEn: FechaIso
}

/** POST /users/me/2fa/setup: secreto TOTP y el enlace otpauth:// que se muestra como QR. */
export type ConfiguracionMfa = { secret: string; otpauthUri: string }

/** POST /users/me/2fa/enable: 10 códigos de un solo uso, se muestran una sola vez. */
export type CodigosRecuperacion = { recoveryCodes: string[] }

export type LoginRequest = { email: string; password: string }

export type RegistroRequest = {
  email: string
  password: string
  documentoIdentidad: string
  nombre: string
  aceptaPoliticaDatos: boolean
}

export type Usuario = {
  id: Uuid
  email: string
  nombre: string
  rol: Rol
  companyId: Uuid | null
  activo: boolean
}

/* ------------------------------------------------------------------ catalog */
export type OfertaResumen = { offerId: Uuid; precioOferta: number; fin: FechaIso }

export type ResultadoViaje = {
  itineraryId: Uuid
  routeId: Uuid
  busId: Uuid
  empresa: string
  origen: string
  destino: string
  fechaSalida: FechaIso
  fechaLlegadaEstimada: FechaIso
  duracionMinutos: number
  precioBase: number
  moneda: string
  tipoBus: 'UN_PISO' | 'DOS_PISOS' | string
  capacidad: number
  /** null si Seat Inventory no respondió a tiempo (la búsqueda nunca falla por eso) */
  asientosDisponibles: number | null
  agotado: boolean | null
  ofertaActiva: OfertaResumen | null
  disponibilidadConocida?: boolean
  companyId?: Uuid
  /** WIFI, BANO, USB, AIRE_ACONDICIONADO, TV, SILLA_RECLINABLE */
  servicios?: string[]
  /** US-142: con tramos=true el resultado puede ser un tramo intermedio de la ruta. */
  fromOrden?: number
  toOrden?: number
  salida?: FechaIso
  llegada?: FechaIso
  precio?: number
  /** Precio por adulto sin recargo de asiento, con la oferta vigente y la temporada (el mismo del calendario). */
  precioDesde?: number
}

export type Parada = {
  id: Uuid
  orden: number
  nombre: string
  lat: number
  lng: number
  minutosDesdeSalida: number
  horaProgramada: FechaIso
}

export type DetalleItinerario = {
  itineraryId: Uuid
  routeId: Uuid
  busId: Uuid
  companyId: Uuid
  empresa: string
  placa: string
  tipoBus: string
  capacidad: number
  origen: string
  destino: string
  fechaSalida: FechaIso
  fechaLlegadaEstimada: FechaIso
  estado: string
  precioBase: number
  moneda: string
  ofertaActiva: OfertaResumen | null
  paradas: Parada[]
  servicios?: string[]
}

/** GET /driver/trips: viaje asignado al conductor autenticado. */
export type ViajeConductor = {
  itineraryId: Uuid
  busId: Uuid
  origen: string
  destino: string
  fechaSalida: FechaIso
  fechaLlegada: FechaIso
  rol: 'PRINCIPAL' | 'RELEVO' | string
  estado: string
  ventanaInicio: FechaIso
  ventanaFin: FechaIso
  puedeCompartirUbicacion: boolean
  iniciado: boolean
  finalizado: boolean
}

export type ChecklistInicioViaje = {
  manifiestoRevisado: boolean
  documentosBus: boolean
  lucesYLlantas: boolean
  botiquinYExtintor: boolean
}

export type ProgresoViaje = {
  itineraryId: Uuid
  iniciadoEn: FechaIso | null
  finalizadoEn: FechaIso | null
  estadoRastreo: string
}

export type AlertaConductor = {
  alertId: Uuid
  itineraryId: Uuid
  companyId: Uuid
  busId: Uuid
  tipo: string
  gravedad: string
  lat: number | null
  lng: number | null
  mensaje: string
  puedeContinuar: boolean | null
  estado: string
  creadoEn: FechaIso
}

export type TipoCelda = 'ASIENTO' | 'PASILLO' | 'BANO' | 'CONDUCTOR' | 'ESCALERA' | 'PUERTA' | 'VACIO'
export type Celda = { fila: number; columna: number; tipo: TipoCelda; asiento?: string }
export type Piso = { piso: number; filas: number; columnas: number; celdas: Celda[] }

export type MapaAsientos = {
  itineraryId: Uuid
  busId: Uuid
  placa: string
  tipoBus: string
  capacidad: number
  asientos: string[]
  distribucion: { tipo: string; capacidad: number; pisos: Piso[] }
}

/* ------------------------------------------------------------------ seat inventory */
export type EstadoAsiento = 'DISPONIBLE' | 'RETENIDO' | 'VENDIDO' | 'EN_OFERTA'

export type VistaAsiento = {
  seatNumber: string
  estado: EstadoAsiento
  offerId: Uuid | null
  /** true si la retención o la venta es del usuario autenticado */
  propio: boolean
}

export type EstadosAsientos = {
  itineraryId: Uuid
  capacidad: number
  resumen: { disponibles: number; retenidos: number; vendidos: number; enOferta: number }
  asientos: VistaAsiento[]
}

export type Retencion = {
  holdId: Uuid
  itineraryId: Uuid
  seatNumbers: string[]
  userId: Uuid
  offerId: Uuid | null
  bookingId: Uuid | null
  estado: string
  creadoEn: FechaIso
  expiraEn: FechaIso
  extendido: boolean
  segundosRestantes: number
  /** US-142: tramo retenido (sin ellos = el viaje completo). */
  fromOrden?: number | null
  toOrden?: number | null
}

/* ------------------------------------------------------------------ booking + payment */
export type TipoDocumento = 'CC' | 'CE' | 'TI' | 'PA' | 'PEP' | 'NIT'

export type TipoPasajero = 'ADULTO' | 'NINO' | 'ADULTO_MAYOR'

export type PasajeroRequest = { nombre: string; tipoDocumento: TipoDocumento; numeroDocumento: string; tipoPasajero?: TipoPasajero }
export type Pasajero = PasajeroRequest & {
  asiento: string | null
  passengerId?: Uuid
  categoriaAsiento?: string | null
  precio?: number | null
}

/** US-142: tramo comprado (null = el recorrido completo). */
export type Tramo = { fromOrden: number | null; paradaAbordaje: string | null; toOrden: number | null; paradaBajada: string | null }

export type ResumenPago = {
  paymentId: Uuid
  estado: string
  monto: number
  metodo: string
  tarjetaUltimos4: string | null
  motivoRechazo: string | null
  actualizadoEn: FechaIso
}

export type EstadoReserva =
  | 'PENDIENTE_PAGO'
  | 'PAGO_EN_PROCESO'
  | 'PAGO_APROBADO'
  | 'CONFIRMADA'
  | 'PAGO_RECHAZADO'
  | 'EXPIRADA'
  | 'REEMBOLSADA'
  | 'REPROGRAMADA'

export type Reserva = {
  bookingId: Uuid
  estado: EstadoReserva
  holdId: Uuid
  itineraryId: Uuid
  offerId: Uuid | null
  seatNumbers: string[]
  pasajeros: Pasajero[]
  precioUnitario: number
  total: number
  moneda: string
  holdExpiraEn: FechaIso
  pago: ResumenPago | null
  ticketId: Uuid | null
  creadoEn: FechaIso
  actualizadoEn: FechaIso
  origenBookingId?: Uuid | null
  subtotal?: number
  descuentoCupon?: number
  cuponCodigo?: string | null
  tramo?: Tramo | null
}

export type MetodoPago = 'TARJETA' | 'PSE' | 'NEQUI'
export type TipoPersonaPse = 'NATURAL' | 'JURIDICA'
export type DatosPse = { bancoCodigo: string; tipoPersona: TipoPersonaPse; tipoDocumento: TipoDocumento; numeroDocumento: string }

/** POST /bookings/{id}/pay (US-143): tarjeta (cuerpo histórico), PSE o Nequi. */
export type PagoRequest =
  | { metodo?: 'TARJETA'; cardToken: string; cardLast4?: string; cardBrand?: string }
  | { metodo: 'PSE'; pse: DatosPse }
  | { metodo: 'NEQUI'; nequi: { telefono: string } }

export type BancoPse = { codigo: string; nombre: string }

export type Pago = {
  paymentId: Uuid
  bookingId: Uuid
  estado: string
  monto: number
  moneda: string
  mensaje: string | null
  /** PSE: página del banco a la que se lleva al pasajero. */
  redirectUrl?: string | null
}

export type Tiquete = {
  ticketId: Uuid
  bookingId: Uuid
  estado: string
  emitidoEn: FechaIso
  itineraryId: Uuid
  origen: string
  destino: string
  fechaSalida: FechaIso
  empresa: string
  placa: string
  seatNumbers: string[]
  pasajeros: Pasajero[]
  total: number
  moneda: string
  qrCode: string
  /** data:image/png;base64,... */
  qrImage: string
  usadoEn?: FechaIso | null
  tramo?: Tramo | null
}

/* ------------------------------------------------------------------ flash offers */
/** BORRADOR: la oferta existe pero Seat Inventory aún no reserva sus asientos (rama develop, US-054). */
export type EstadoOferta = 'BORRADOR' | 'PROGRAMADA' | 'ACTIVA' | 'AGOTADA' | 'CERRADA'

export type Oferta = {
  offerId: Uuid
  itineraryId: Uuid
  precioOferta: number
  cupoMax: number
  cupoRestante: number
  inicio: FechaIso
  fin: FechaIso
  estado: EstadoOferta
  segundosRestantes: number
  asientos: string[]
  motivoCierre: string | null
  maxPorUsuario?: number
  permiteReprogramar?: boolean
  salaEsperaHabilitada?: boolean
  origenCreacion?: string
}

export type CrearOfertaRequest = {
  itineraryId: Uuid
  seatNumbers: string[]
  precioOferta: number
  cupo: number
  inicio: FechaIso
  fin: FechaIso
}

export type CupoOferta = {
  offerId: Uuid
  estado: EstadoOferta
  cupoMax: number
  cupoRestante: number
  fin: FechaIso
  segundosRestantes: number
}

export type ReservaOferta = {
  reservationId: Uuid
  offerId: Uuid
  itineraryId: Uuid
  holdId: Uuid
  userId: Uuid
  seatNumber: string
  precioOferta: number
  estado: string
}

/* ------------------------------------------------------------------ fleet + trip events */
export type Posicion = {
  busId: Uuid
  itineraryId: Uuid | null
  lat: number
  lng: number
  velocidad: number | null
  rumbo: number | null
  timestamp: FechaIso
}

export type ParadaSeguimiento = { orden: number; nombre: string; lat: number; lng: number; horaProgramada: FechaIso }

export type Seguimiento = {
  itineraryId: Uuid
  busId: Uuid
  origen: string
  destino: string
  fechaSalida: FechaIso
  llegadaProgramada: FechaIso
  estado: string
  posicion: Posicion | null
  paradas: ParadaSeguimiento[]
  /** US-174: null si el rastreo nunca se encendió. */
  estadoRastreo?: EstadoRastreo | null
  ultimaPosicionEn?: FechaIso | null
  eta?: Eta | null
}

export type TipoNovedad =
  | 'INICIO'
  | 'LLEGADA_PARADA'
  | 'RETRASO'
  | 'DESVIO'
  | 'FIN'
  | 'AVERIA'
  | 'ACCIDENTE'
  | 'VIA_CERRADA'
  | 'REPROGRAMACION'

export type NovedadRequest = { tipo: TipoNovedad; descripcion?: string; detalle?: Record<string, unknown> }


export type UbicacionConductorRequest = {
  lat: number
  lng: number
  precision: number
  velocidad: number | null
  rumbo: number | null
  timestamp: FechaIso
}

export type RespuestaUbicacionConductor = {
  aceptada: boolean
  motivo?: string
}

export type RespuestaLoteUbicaciones = {
  aceptadas: number
  descartadas: number
  lecturas: RespuestaUbicacionConductor[]
}

export type Novedad = {
  tripEventId: Uuid
  itineraryId: Uuid
  tipo: TipoNovedad
  descripcion: string | null
  detalle: Record<string, unknown> | null
  origen: string
  timestamp: FechaIso
}

export type ValidacionTiquete =
  | { valido: true; ticketId: Uuid; bookingId: Uuid; itineraryId: Uuid; asientos: string; estado: string }
  | { valido: false; motivo: 'FORMATO_INVALIDO' | 'FIRMA_INVALIDA' | 'TIQUETE_INEXISTENTE' | string }

/* ------------------------------------------------------------------ paginación (T-05) */
/** Catalog, identity y flash-offers responden `content`; booking responde `items`. */
export type Pagina<T> = {
  content?: T[]
  items?: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

/* ------------------------------------------------------------------ identity: Google y administración */
export type Proveedores = { google: { enabled: boolean; clientId: string | null } }

export type GoogleLoginRequest = { idToken: string; aceptaPoliticaDatos?: boolean; documentoIdentidad?: string; nombre?: string }

export type UsuarioAdmin = Usuario & { fechaCreacion?: FechaIso }

export type CrearUsuarioRequest = {
  nombre: string
  email: string
  documentoIdentidad: string
  rol: 'OPERADOR' | 'CONDUCTOR'
  companyId: Uuid
}

export type FiltroUsuarios = { rol?: Rol; companyId?: Uuid; activo?: boolean; q?: string; page?: number; size?: number }

export type AccionAuditoria = 'CAMBIAR_ROL' | 'CREAR_USUARIO' | 'SUSPENDER' | 'REACTIVAR' | 'DESBLOQUEAR' | 'ELIMINAR_CUENTA'

export type RegistroAuditoria = {
  id: Uuid
  actorId: Uuid
  accion: AccionAuditoria
  targetUserId: Uuid | null
  antes: Record<string, unknown> | null
  despues: Record<string, unknown> | null
  motivo: string | null
  creadoEn: FechaIso
}

export type FiltroAuditoria = {
  actorId?: Uuid
  targetUserId?: Uuid
  accion?: AccionAuditoria
  desde?: FechaIso
  hasta?: FechaIso
  page?: number
  size?: number
}

/* ------------------------------------------------------------------ catalog: búsqueda (P-01) */
export type Franja = 'MANANA' | 'TARDE' | 'NOCHE'

export type FiltrosBusqueda = {
  companyId?: Uuid
  franja?: Franja
  precioMin?: number
  precioMax?: number
  tipoBus?: string
  sort?: 'salida' | 'precio' | 'duracion'
  order?: 'asc' | 'desc'
  page?: number
  size?: number
  tramos?: boolean
}

export type ResultadoBusqueda = { viajes: ResultadoViaje[]; total: number }

export type Lugar = { tipo: 'CIUDAD' | 'TERMINAL'; nombre: string; ciudad: string; terminalId?: Uuid }

/** GET /trips/calendar: mismos viajes que /trips/search ese día; precioMinimo = menor precioDesde con cupo. */
export type DiaCalendario = { fecha: string; precioMinimo: number | null; viajes?: number; hayCupo: boolean | null }

/** Filtros que comparten el calendario y las facetas con /trips/search (sin precio, orden ni página). */
export type FiltrosCalendario = Pick<FiltrosBusqueda, 'tramos' | 'companyId' | 'franja' | 'tipoBus'>

export type EmpresaBusqueda = { id: Uuid; nombre: string }

/** Empresa de las facetas: terminal de salida en el origen (null si no tiene) y salidas de esa fecha. */
export type EmpresaFaceta = { id: Uuid; nombre: string; terminal: string | null; viajes: number }

/**
 * GET /trips/search/facets: precioMin y precioMax ignoran el filtro de precio (null sin viajes); empresas = todas
 * las que cubren la ruta en 14 días, ordenadas por nombre; tiposBus = los del día.
 */
export type FacetasBusqueda = {
  precioMin: number | null
  precioMax: number | null
  empresas: EmpresaFaceta[]
  tiposBus: string[]
}

export type IdaYVuelta = { ida: ResultadoViaje[]; vuelta: ResultadoViaje[] }

export type PrecioPasajero = {
  tipo: TipoPasajero
  seatCategoria?: string | null
  precioTramo: number
  descuentoPorcentaje: number
  recargoCategoria?: number | null
  precio: number
}

/** GET /itineraries/{id}/price (US-138): con from/to o tipos trae el desglose. */
export type PrecioItinerario = {
  itineraryId: Uuid
  precioBase: number
  moneda: string
  ofertaActiva: OfertaResumen | null
  estado: string
  desglose?: {
    itineraryId: Uuid
    origen: string
    destino: string
    salida: FechaIso
    llegada: FechaIso
    moneda: string
    precioBase: number
    precioTramo: number
    temporada: { id: Uuid; nombre: string; multiplicador: number } | null
    pasajeros: PrecioPasajero[]
    total: number
  }
}

/* ------------------------------------------------------------------ catalog: operador (O-01, O-04) */
export type OcupacionViaje = { vendidos: number; disponibles: number; bloqueados: number; porcentaje: number; tasaAbandono: number }

export type ViajeOperador = {
  itineraryId: Uuid
  origen: string
  destino: string
  fechaSalida: FechaIso
  fechaLlegadaEstimada: FechaIso
  placa: string
  tipoBus: string
  estado: string
  precioBase: number
  ofertaActiva: OfertaResumen | null
  ocupacion: OcupacionViaje | null
  ocupacionConocida: boolean
}

export type PaginaViajesOperador = Pagina<ViajeOperador> & {
  resumen: { viajes: number; ocupacionPromedio: number | null; candidatosOferta: number }
}

export type ResumenItinerario = {
  itineraryId: Uuid
  routeId: Uuid
  busId: Uuid
  companyId: Uuid
  empresa: string
  origen: string
  destino: string
  placa: string
  fechaSalida: FechaIso
  fechaLlegadaEstimada: FechaIso
  estado: string
  precioBase: number
  moneda: string
}

/** US-121: conductor activo de la empresa que se puede asignar a un viaje (GET /users/drivers). */
export type ConductorAsignable = { id: Uuid; nombre: string; email: string }

/** US-121: conductor asignado a un viaje (GET/PUT /trips/{id}/driver). */
export type AsignacionConductor = {
  itineraryId: Uuid
  conductorId: Uuid
  rol: 'PRINCIPAL' | 'RELEVO'
  asignadoPor: Uuid
  asignadoEn: FechaIso
}

export type CrearItinerarioRequest = { routeId: Uuid; busId: Uuid; fechaSalida: FechaIso; precioBase: number }

export type DiaSemana = 'LUNES' | 'MARTES' | 'MIERCOLES' | 'JUEVES' | 'VIERNES' | 'SABADO' | 'DOMINGO'

export type ProgramacionRequest = {
  routeId: Uuid
  busId: Uuid
  /** HH:mm en hora de Colombia */
  horaSalida: string
  diasSemana: DiaSemana[]
  desde: string
  hasta: string
  precioBase: number
}

export type ResultadoProgramacion = {
  creados: ResumenItinerario[]
  omitidos: { fecha: string; fechaSalida: FechaIso; codigo: string; motivo: string; conflictoCon?: Uuid }[]
}

export type FiltroItinerarios = {
  desde?: string
  hasta?: string
  routeId?: Uuid
  busId?: Uuid
  estado?: string
  companyId?: Uuid
  page?: number
  size?: number
}

export type CambioItinerario = {
  id: Uuid
  tipo: string
  salidaAnterior: FechaIso | null
  salidaNueva: FechaIso | null
  busAnterior: Uuid | null
  busNuevo: Uuid | null
  motivo: string | null
  hechoPor: Uuid | null
  creadoEn: FechaIso
}

/* ------------------------------------------------------------------ catalog: buses, rutas, empresas, terminales, tarifas */
export type EstadoBus = 'ACTIVO' | 'INACTIVO' | 'MANTENIMIENTO'
export type TipoBus = 'UN_PISO' | 'DOS_PISOS'
export type CategoriaAsiento = 'ESTANDAR' | 'PREFERENCIAL' | 'PREMIUM'
export type CeldaEditable = Celda & { categoria?: CategoriaAsiento }
export type PisoEditable = { piso: number; filas: number; columnas: number; celdas: CeldaEditable[] }
export type Distribucion = { tipo: string; capacidad: number; pisos: PisoEditable[] }

export type Bus = {
  id: Uuid
  companyId: Uuid
  placa: string
  tipo: TipoBus
  estado: EstadoBus
  servicios: string[]
  creadoEn: FechaIso
  actualizadoEn: FechaIso
}

export type BusRequest = { placa: string; tipo: TipoBus; companyId?: Uuid; servicios?: string[] }

export type ParadaRuta = {
  id?: Uuid
  orden: number
  nombre: string
  lat: number
  lng: number
  minutosDesdeSalida: number
  terminalId?: Uuid | null
}

export type Ruta = {
  id: Uuid
  companyId: Uuid
  empresa: string
  origen: string
  destino: string
  duracionMinutos: number
  estado: 'ACTIVA' | 'INACTIVA'
  paradas?: ParadaRuta[]
}

export type RutaRequest = { companyId?: Uuid; origen: string; destino: string; paradas: ParadaRuta[] }

export type PrecioTramo = { desdeOrden: number; hastaOrden: number; precio: number }

export type Empresa = { id: Uuid; nombre: string; nit: string; estado: 'ACTIVA' | 'INACTIVA'; creadoEn: FechaIso; actualizadoEn: FechaIso }

export type CondicionesEmpresa = {
  id: Uuid
  companyId: Uuid
  cuotaMensual: number
  comisionPorcentaje: number
  vigenteDesde: string
  creadoPor: Uuid | null
  creadoEn: FechaIso
}

export type Terminal = { id: Uuid; ciudad: string; nombre: string; direccion: string; lat: number; lng: number }
export type TerminalRequest = Omit<Terminal, 'id'>

export type Temporada = { id: Uuid; companyId: Uuid; routeId: Uuid | null; nombre: string; desde: string; hasta: string; multiplicador: number }
export type TemporadaRequest = Omit<Temporada, 'id' | 'companyId'> & { companyId?: Uuid }
export type DescuentoPasajero = { tipo: TipoPasajero; descuentoPorcentaje: number }
export type RecargoAsiento = { categoria: CategoriaAsiento; recargo: number }

/* ------------------------------------------------------------------ booking: mis viajes, afectados, taquilla, cupones, reportes */
export type EstadoTiquete = 'EMITIDO' | 'USADO' | 'REPROGRAMADO' | 'ANULADO' | 'NO_SHOW'

/** GET /bookings?scope=proximos|pasados (US-145). */
export type ViajeMio = {
  bookingId: Uuid
  estado: EstadoReserva
  canal: string
  itineraryId: Uuid
  origen: string
  destino: string
  fechaSalida: FechaIso
  empresa: string
  seatNumbers: string[]
  ticketId: Uuid | null
  estadoTiquete: EstadoTiquete | null
  total: number
  moneda: string
  puedeReprogramar: boolean
  puedeCambiarAsiento: boolean
  tramo?: Tramo | null
}

export type CausaAfectacion = 'CANCELACION' | 'REPROGRAMACION' | 'RETRASO'

/** US-154: reserva afectada por un cambio de la empresa. */
export type ReservaAfectada = {
  bookingId: Uuid
  ticketId: Uuid | null
  itineraryId: Uuid
  causa: CausaAfectacion
  estado: string
  plazoDecision: FechaIso
  opciones: string[]
  decididoEn: FechaIso | null
  decididoPor: string | null
  bookingNuevoId: Uuid | null
}

export type VentaTaquillaRequest = {
  itineraryId: Uuid
  seatNumbers: string[]
  pasajeros: PasajeroRequest[]
  comprador: { nombre: string; email?: string; telefono?: string }
}

export type VentaTaquilla = {
  bookingId: Uuid
  estado: string
  ticketId: Uuid | null
  compradorRegistrado: boolean
  itineraryId: Uuid
  origen: string
  destino: string
  fechaSalida: FechaIso
  seatNumbers: string[]
  total: number
  moneda: string
  metodoPago: string
  vendidoEn: FechaIso
}

export type VentaCierre = {
  bookingId: Uuid
  estado: string
  ticketId: Uuid | null
  estadoTiquete: string | null
  vendidoEn: FechaIso
  origen: string
  destino: string
  fechaSalida: FechaIso
  seatNumbers: string[]
  compradorNombre: string | null
  total: number
}

export type CierreCaja = {
  fecha: string
  vendedor: Uuid | null
  cantidadVentas: number
  cantidadTiquetes: number
  cantidadAsientos: number
  totalEfectivo: number
  totalReembolsado: number
  ventas: VentaCierre[]
}

export type TipoCupon = 'PORCENTAJE' | 'VALOR'

export type Cupon = {
  couponId: Uuid
  codigo: string
  tipo: TipoCupon
  valor: number
  companyId: Uuid | null
  vigenteDesde: FechaIso | null
  vigenteHasta: FechaIso | null
  usosMaximos: number | null
  usos: number
  usosPorUsuario: number | null
  compraMinima: number | null
  routeIds: Uuid[]
  activo: boolean
}

export type CuponRequest = Omit<Cupon, 'couponId' | 'usos'>

export type AgrupacionVentas = 'dia' | 'ruta' | 'metodo' | 'canal'

export type FilaVentas = {
  grupo: string
  tiquetesVendidos: number
  ingresosBrutos: number
  descuentoCupones: number
  reembolsos: number
  ingresosNetos: number
  comisionTripBus: number
  netoEmpresa: number
  ocupacionPromedio: number | null
}

export type ReporteVentas = {
  desde: string
  hasta: string
  agrupar: AgrupacionVentas
  companyId: Uuid | null
  grupos: FilaVentas[]
  totales: FilaVentas
  ventasSinComision: number
}

export type FilaPlataforma = { companyId: Uuid; empresa: string; cuotaMensual: number | null; comision: number; totalACobrar: number | null; tiquetes: number }

export type ReportePlataforma = {
  mes: string
  empresas: FilaPlataforma[]
  cuotas: number
  comisiones: number
  total: number
  tiquetes: number
  incompleto: boolean
}

/* ------------------------------------------------------------------ seat inventory: ocupación, bloqueos, lista de espera */
export type OcupacionAsientos = {
  itineraryId: Uuid
  capacidad: number
  disponibles: number
  retenidos: number
  vendidos: number
  enOferta: number
  bloqueados: number
  enTramos: number
  porcentajeOcupacion: number
  tasaAbandono: number
}

export type ResultadoBloqueo = { itineraryId: Uuid; cambiados: string[]; sinCambio: string[] }

/** US-140: turno en la lista de espera. */
export type TurnoEspera = {
  id: Uuid
  itineraryId: Uuid
  cantidad: number
  estado: string
  posicion: number | null
  holdId: Uuid | null
  creadoEn: FechaIso
  actualizadoEn: FechaIso
}

/* ------------------------------------------------------------------ fleet: rastreo, ETA, flota, alertas, recorrido, compartir */
export type EstadoRastreo = 'ACTIVO' | 'EN_PAUSA' | 'SIN_SENAL' | 'FINALIZADO'

export type ParadaEta = { orden: number; nombre: string; programada: FechaIso; estimada: FechaIso; alcanzada: boolean }

export type Eta = { itineraryId: Uuid; retrasoMinutos: number; calculadaEn: FechaIso; paradas: ParadaEta[] }

export type ParadaFlota = { orden: number; nombre: string; programada: FechaIso; estimada: FechaIso | null }

export type PosicionFlota = { lat: number; lng: number; velocidad: number | null; rumbo: number | null; timestamp: FechaIso }

export type ViajeFlota = {
  itineraryId: Uuid
  busId: Uuid
  origen: string
  destino: string
  fechaSalida: FechaIso
  fechaLlegada: FechaIso
  iniciado: boolean
  finalizado: boolean
  estadoRastreo: EstadoRastreo | null
  posicion: PosicionFlota | null
  retrasoMinutos: number | null
  siguienteParada: ParadaFlota | null
  ultimaParadaAlcanzada: ParadaFlota | null
  alertas: { abiertas: number; mayorGravedad: string | null } | null
  conductor: { conductorId: Uuid; nombre: string | null } | null
}

export type FlotaEnVivo = {
  generadoEn: FechaIso
  resumen: { total: number; enRuta: number; activos: number; enPausa: number; sinSenal: number; retrasados: number; conAlerta: number }
  viajes: ViajeFlota[]
}

export type AlertaViaje = AlertaConductor & { resueltoEn?: FechaIso | null; notaResolucion?: string | null }

export type RecorridoViaje = {
  itineraryId: Uuid
  origen: string
  destino: string
  recorrido: { lat: number; lng: number; timestamp: FechaIso }[]
  paradas: { orden: number; nombre: string; lat: number; lng: number; programada: FechaIso; real: FechaIso | null; aTiempo: boolean }[]
  puntualidad: {
    salidaProgramada: FechaIso
    salidaReal: FechaIso | null
    llegadaProgramada: FechaIso
    llegadaReal: FechaIso | null
    minutosRetrasoSalida: number | null
    minutosRetrasoLlegada: number | null
    paradasATiempo: number
    paradasTotal: number
  }
}

export type EnlaceCompartido = { codigo: string; itineraryId: Uuid; venceEn: FechaIso }
export type ViajeCompartido = { itineraryId: Uuid; origen: string; destino: string; fechaSalida: FechaIso; venceEn: FechaIso }

export type ReportePuntualidad = {
  desde: string
  hasta: string
  agrupar: 'ruta' | 'conductor'
  companyId: Uuid | null
  grupos: {
    routeId: Uuid | null
    conductorId: Uuid | null
    nombre: string
    viajes: number
    retrasoPromedioSalidaMin: number | null
    retrasoPromedioLlegadaMin: number | null
    porcentajeViajesATiempo: number
    porcentajeParadasATiempo: number | null
  }[]
}

/* ------------------------------------------------------------------ flash offers: vitrina, sala de espera, gestión */
export type OfertaVitrina = {
  offerId: Uuid
  itineraryId: Uuid
  empresa: string
  origen: string
  destino: string
  fechaSalida: FechaIso
  precioBase: number
  precioOferta: number
  descuentoPorcentaje: number
  cupoRestante: number
  inicio: FechaIso
  fin: FechaIso
  segundosRestantes: number
  estado: EstadoOferta
}

export type EstadoSalaEspera = 'NO_INSCRITO' | 'EN_SALA' | 'EN_FILA' | 'ADMITIDO' | 'TURNO_VENCIDO' | 'CERRADA'

export type SalaEspera = { offerId: Uuid; estado: EstadoSalaEspera; posicion: number | null; enFila: number; admisionExpiraEn: FechaIso | null }

export type OfertaOperador = { oferta: Oferta; cupoVendido: number; cupoRestante: number }

export type FiltroOfertasOperador = { estado?: EstadoOferta; desde?: string; hasta?: string; page?: number; size?: number }

export type EditarOfertaRequest = {
  precioOferta?: number
  cupo?: number
  maxPorUsuario?: number
  inicio?: FechaIso
  fin?: FechaIso
  seatNumbers?: string[]
  permiteReprogramar?: boolean
  salaEsperaHabilitada?: boolean
}

export type DuplicarOfertaRequest = { itineraryId: Uuid; inicio: FechaIso; fin: FechaIso; seatNumbers?: string[] }

export type MetricasOferta = {
  cupo: number
  reservasCreadas: number
  ventas: number
  liberadasOVencidas: number
  conversion: number
  tiempoEnAgotarseSegundos: number | null
  ingresos: number
  descuentoTotalOtorgado: number
  seguidoresAlertados: number
}

export type MetricasOperador = {
  ofertas: number
  ventas: number
  ingresos: number
  descuentoOtorgado: number
  conversionPromedio: number
  ofertaAgotadaMasRapido: Uuid | null
}

export type RutaSeguida = { id: Uuid; origen: string; destino: string; creadoEn: FechaIso }

export type ReglaOfertaAutomatica = {
  id: Uuid
  companyId: Uuid
  routeId: Uuid | null
  horasAntes: number
  ocupacionMaxima: number
  descuento: number
  cupoMaximo: number
  activa: boolean
  actualizadoEn: FechaIso
}

export type PlantillaOferta = {
  id: Uuid
  companyId: Uuid
  routeId: Uuid | null
  diasSemana: number[]
  horaInicio: string
  duracionMinutos: number
  descuento: number
  cupo: number
  maxPorUsuario: number
  permiteReprogramar: boolean
  salaEspera: boolean
  horasAntesSalida: number
  activa: boolean
  actualizadoEn: FechaIso
}

/* ------------------------------------------------------------------ realtime: Web Push (T-06) */
export type SuscripcionPush = { endpoint: string; keys: { p256dh: string; auth: string } }
