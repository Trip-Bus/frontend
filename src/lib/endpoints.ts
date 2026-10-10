import { solicitar } from './api'
import type {
  AuthResponse,
  CupoOferta,
  DetalleItinerario,
  EstadosAsientos,
  LoginRequest,
  MapaAsientos,
  Novedad,
  Oferta,
  Pago,
  PagoRequest,
  PasajeroRequest,
  RegistroRequest,
  Reserva,
  ReservaOferta,
  ResultadoViaje,
  Retencion,
  Seguimiento,
  Tiquete,
  Usuario,
  Uuid,
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
  },

  /* ------------------------------------------------ Flash Offers */
  ofertas: {
    listar: (itineraryId?: Uuid) => solicitar<Oferta[]>('GET', '/offers', { query: { itineraryId } }),
    obtener: (id: Uuid) => solicitar<Oferta>('GET', `/offers/${id}`),
    cupo: (id: Uuid) => solicitar<CupoOferta>('GET', `/offers/${id}/quota`),
    apartar: (id: Uuid, docId: string) =>
      solicitar<ReservaOferta>('POST', `/offers/${id}/reservations`, { auth: 'requerido', body: { docId } }),
  },

  /* ------------------------------------------------ Fleet + Trip Events */
  viaje: {
    seguimiento: (itineraryId: Uuid) => solicitar<Seguimiento>('GET', `/itineraries/${itineraryId}/bus-position`),
    novedades: (itineraryId: Uuid) => solicitar<Novedad[]>('GET', `/trips/${itineraryId}/timeline`),
  },
}
