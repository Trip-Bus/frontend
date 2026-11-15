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
}

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
}

/* ------------------------------------------------------------------ booking + payment */
export type TipoDocumento = 'CC' | 'CE' | 'TI' | 'PA' | 'PEP' | 'NIT'

export type PasajeroRequest = { nombre: string; tipoDocumento: TipoDocumento; numeroDocumento: string }
export type Pasajero = PasajeroRequest & { asiento: string | null }

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
}

export type PagoRequest = { cardToken: string; cardLast4?: string; cardBrand?: string }

export type Pago = {
  paymentId: Uuid
  bookingId: Uuid
  estado: string
  monto: number
  moneda: string
  mensaje: string | null
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
}

export type TipoNovedad = 'INICIO' | 'LLEGADA_PARADA' | 'RETRASO' | 'DESVIO' | 'FIN'

export type NovedadRequest = { tipo: TipoNovedad; descripcion?: string; detalle?: Record<string, unknown> }

export type PosicionRequest = {
  busId: Uuid
  itineraryId: Uuid
  lat: number
  lng: number
  velocidad?: number | null
  rumbo?: number | null
  timestamp?: FechaIso
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
