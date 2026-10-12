import { solicitar } from './api'
import type {
  AuthResponse,
  CrearOfertaRequest,
  CupoOferta,
  DetalleItinerario,
  EstadosAsientos,
  LoginRequest,
  MapaAsientos,
  Novedad,
  NovedadRequest,
  Oferta,
  Pago,
  PagoRequest,
  PasajeroRequest,
  PosicionRequest,
  RegistroRequest,
  Reserva,
  ReservaOferta,
  ResultadoViaje,
  Retencion,
  Seguimiento,
  Tiquete,
  Usuario,
  Uuid,
  ValidacionTiquete,
} from './tipos'

/**
 * Todas las llamadas del frontend al API Gateway, agrupadas por microservicio.
 * Las rutas son las mismas que usa scripts/smoke-test.sh del repo API-gateway.
 */
export const api = {
  /* ------------------------------------------------ Identity */
  auth: {
    login: (datos: LoginRequest) => solicitar<AuthResponse>('POST', '/auth/login', { auth: 'ninguno', body: datos }),
    registro: (datos: RegistroRequest) =>
      solicitar<AuthResponse>('POST', '/auth/register', { auth: 'ninguno', body: datos }),
    logout: () => solicitar<void>('POST', '/auth/logout', { auth: 'requerido' }),
    usuario: (id: Uuid) => solicitar<Usuario>('GET', `/users/${id}`, { auth: 'requerido' }),
  },

  /* ------------------------------------------------ Catalog */
  catalogo: {
    /** fecha en formato YYYY-MM-DD (hora de Colombia) */
    buscar: (origen: string, destino: string, fecha: string, signal?: AbortSignal) =>
      solicitar<ResultadoViaje[]>('GET', '/trips/search', {
        query: { origin: origen, destination: destino, date: fecha },
        signal,
      }),
    ciudades: () => solicitar<string[]>('GET', '/trips/cities'),
    itinerario: (id: Uuid) => solicitar<DetalleItinerario>('GET', `/itineraries/${id}`),
    mapa: (id: Uuid) => solicitar<MapaAsientos>('GET', `/itineraries/${id}/seatmap`),
  },

  /* ------------------------------------------------ Seat Inventory */
  asientos: {
    estados: (itineraryId: Uuid) => solicitar<EstadosAsientos>('GET', `/seats/itineraries/${itineraryId}`),
    retener: (itineraryId: Uuid, seatNumbers: string[]) =>
      solicitar<Retencion>('POST', '/seats/holds', { auth: 'requerido', body: { itineraryId, seatNumbers } }),
    retencion: (holdId: Uuid) => solicitar<Retencion>('GET', `/seats/holds/${holdId}`, { auth: 'requerido' }),
    extender: (holdId: Uuid) =>
      solicitar<Retencion>('POST', `/seats/holds/${holdId}/extend`, { auth: 'requerido' }),
    liberar: (holdId: Uuid) => solicitar<void>('DELETE', `/seats/holds/${holdId}`, { auth: 'requerido' }),
  },

  /* ------------------------------------------------ Booking + Payment */
  reservas: {
    crear: (holdId: Uuid, pasajeros: PasajeroRequest[]) =>
      solicitar<Reserva>('POST', '/bookings', { auth: 'requerido', body: { holdId, pasajeros } }),
    mias: () => solicitar<Reserva[]>('GET', '/bookings', { auth: 'requerido' }),
    obtener: (id: Uuid) => solicitar<Reserva>('GET', `/bookings/${id}`, { auth: 'requerido' }),
    /** Requiere Idempotency-Key: reintentar con la MISMA clave nunca cobra dos veces. */
    pagar: (id: Uuid, pago: PagoRequest, idempotencyKey: string) =>
      solicitar<Pago>('POST', `/bookings/${id}/pay`, { auth: 'requerido', body: pago, idempotencyKey }),
    tiquete: (id: Uuid) => solicitar<Tiquete>('GET', `/tickets/${id}`, { auth: 'requerido' }),
    /** Abordaje: conductor, operador o admin leen el QR del pasajero. */
    validarTiquete: (qrCode: string) =>
      solicitar<ValidacionTiquete>('POST', '/tickets/validate', { auth: 'requerido', body: { qrCode } }),
  },

  /* ------------------------------------------------ Flash Offers */
  ofertas: {
    listar: (itineraryId?: Uuid) => solicitar<Oferta[]>('GET', '/offers', { query: { itineraryId } }),
    obtener: (id: Uuid) => solicitar<Oferta>('GET', `/offers/${id}`),
    cupo: (id: Uuid) => solicitar<CupoOferta>('GET', `/offers/${id}/quota`),
    apartar: (id: Uuid, docId: string) =>
      solicitar<ReservaOferta>('POST', `/offers/${id}/reservations`, { auth: 'requerido', body: { docId } }),
    /** US-054 (operador o admin de la empresa del viaje). */
    crear: (datos: CrearOfertaRequest) => solicitar<Oferta>('POST', '/offers', { auth: 'requerido', body: datos }),
    activar: (id: Uuid) => solicitar<Oferta>('POST', `/offers/${id}/activate`, { auth: 'requerido' }),
    cerrar: (id: Uuid) => solicitar<Oferta>('POST', `/offers/${id}/close`, { auth: 'requerido' }),
  },

  /* ------------------------------------------------ Fleet + Trip Events */
  viaje: {
    seguimiento: (itineraryId: Uuid) => solicitar<Seguimiento>('GET', `/itineraries/${itineraryId}/bus-position`),
    novedades: (itineraryId: Uuid) => solicitar<Novedad[]>('GET', `/trips/${itineraryId}/timeline`),
    /** US-046 (conductor u operador de la empresa, o admin). */
    reportar: (itineraryId: Uuid, novedad: NovedadRequest) =>
      solicitar<Novedad>('POST', `/trips/${itineraryId}/events`, { auth: 'requerido', body: novedad }),
    /** US-038: ingesta GPS (202, asíncrona). */
    enviarPosicion: (posicion: PosicionRequest) =>
      solicitar<void>('POST', '/telemetry/position', { auth: 'requerido', body: posicion }),
  },

  /* ------------------------------------------------ Administración */
  admin: {
    /** HT-01: datos de demostración (solo ADMIN). Idempotente. */
    seed: () => solicitar<unknown>('POST', '/admin/seed', { auth: 'requerido' }),
  },
}
