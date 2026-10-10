import { sesion } from './sesion'
import type { ErrorApi } from './tipos'

/**
 * Cliente HTTP contra el API Gateway.
 *
 * El navegador siempre llama a `/api/...` en su mismo origen:
 *  - en desarrollo, Vite hace de proxy al gateway (vite.config.ts);
 *  - en producción, el NGINX del contenedor del frontend (nginx/default.conf.template).
 * Así no hay CORS. Para apuntar a otro lugar, define VITE_API_URL.
 */
export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api'

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: Record<string, unknown>
  /** Segundos sugeridos por el servidor antes de reintentar (429). */
  readonly reintentarEn: number | null

  constructor(status: number, code: string, message: string, details: Record<string, unknown> = {}, reintentarEn: number | null = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
    this.reintentarEn = reintentarEn
  }

  /** Mensaje listo para mostrar al pasajero (en español, sin jerga). */
  get paraUsuario(): string {
    return mensajeAmigable(this)
  }
}

type Opciones = {
  /** 'requerido': falla si no hay sesión. 'opcional': manda el token si existe. 'ninguno': nunca. */
  auth?: 'requerido' | 'opcional' | 'ninguno'
  body?: unknown
  query?: Record<string, string | number | boolean | null | undefined>
  /** Para operaciones de dinero (POST /bookings/{id}/pay): misma clave = un solo cobro. */
  idempotencyKey?: string
  signal?: AbortSignal
}

export async function solicitar<T>(metodo: string, ruta: string, opciones: Opciones = {}): Promise<T> {
  const { auth = 'opcional', body, query, idempotencyKey, signal } = opciones
  const headers: Record<string, string> = { Accept: 'application/json' }

  const token = auth === 'ninguno' ? null : sesion.token()
  if (auth === 'requerido' && !token) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Inicia sesión para continuar')
  }
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey

  let respuesta: Response
  try {
    respuesta = await fetch(API_BASE + ruta + construirQuery(query), {
      method: metodo,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    throw new ApiError(0, 'SIN_CONEXION', 'No hay conexión. Revisa tu señal e intenta de nuevo.')
  }

  if (respuesta.status === 204) return undefined as T

  const texto = await respuesta.text()
  const datos = texto ? intentarJson(texto) : null

  if (!respuesta.ok) {
    const err = (datos as ErrorApi | null)?.error
    const retry = Number(respuesta.headers.get('Retry-After'))
    const apiError = new ApiError(
      respuesta.status,
      err?.code ?? `HTTP_${respuesta.status}`,
      err?.message ?? 'Algo salió mal. Intenta de nuevo.',
      err?.details ?? {},
      Number.isFinite(retry) && retry > 0 ? retry : null,
    )
    // Token vencido o revocado: se cierra la sesión local para pedir login de nuevo.
    if (respuesta.status === 401 && token) sesion.cerrar()
    throw apiError
  }

  return datos as T
}

export function construirQuery(query?: Opciones['query']): string {
  if (!query) return ''
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v))
  }
  const s = params.toString()
  return s ? `?${s}` : ''
}

function intentarJson(texto: string): unknown {
  try {
    return JSON.parse(texto)
  } catch {
    return null
  }
}

/** Una clave por intento de pago. Reintentar el MISMO intento debe reutilizarla. */
export function nuevaClaveIdempotencia(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const MENSAJES: Record<string, string> = {
  SIN_CONEXION: 'No hay conexión. Revisa tu señal e intenta de nuevo.',
  UNAUTHENTICATED: 'Tu sesión terminó. Inicia sesión de nuevo.',
  TOKEN_INVALID_OR_EXPIRED: 'Tu sesión terminó. Inicia sesión de nuevo.',
  INVALID_CREDENTIALS: 'El correo o la contraseña no coinciden.',
  ACCOUNT_SUSPENDED: 'Tu cuenta está suspendida. Escríbenos para revisarla.',
  FORBIDDEN: 'No tienes permiso para hacer esto.',
  RATE_LIMITED: 'Vas muy rápido. Espera un momento e intenta de nuevo.',
  SERVICE_UNAVAILABLE: 'El servicio no está disponible en este momento. Intenta en unos segundos.',
  INVALID_SEARCH: 'Revisa el origen, el destino y la fecha.',
  SEAT_LOCKED: 'Alguien está tomando ese puesto en este instante. Elige otro o intenta de nuevo.',
  SEAT_UNAVAILABLE: 'Ese puesto ya no está disponible.',
  NO_SEATS_AVAILABLE: 'Ya no quedan puestos en este bus.',
  TOO_MANY_SEATS: 'Puedes apartar máximo 6 puestos a la vez.',
  HOLD_EXPIRED: 'Se acabó el tiempo para pagar y liberamos el puesto.',
  HOLD_NOT_ACTIVE: 'Ese puesto ya no está apartado para ti.',
  HOLD_ALREADY_EXTENDED: 'Ya usaste la extensión de tiempo para este puesto.',
  BOOKING_NOT_PAYABLE: 'Esta reserva ya no se puede pagar.',
  IDEMPOTENCY_IN_PROGRESS: 'Tu pago se está procesando. Espera unos segundos.',
  OUT_OF_STOCK: 'Se agotó el cupo de la oferta.',
  OFFER_NOT_ACTIVE: 'Esta oferta todavía no está activa o ya terminó.',
  OFFER_CLOSED: 'Esta oferta ya cerró.',
  ITINERARY_CANCELLED: 'Este viaje fue cancelado por la empresa.',
  ITINERARY_NOT_AVAILABLE: 'Este viaje ya no está disponible.',
  EMAIL_ALREADY_REGISTERED: 'No pudimos crear la cuenta con esos datos. ¿Ya tienes una? Inicia sesión.',
  DOCUMENTO_ALREADY_REGISTERED: 'No pudimos crear la cuenta con esos datos. ¿Ya tienes una? Inicia sesión.',
}

export function mensajeAmigable(e: ApiError): string {
  if (e.code === 'VALIDATION_ERROR') return e.message || 'Revisa los datos del formulario.'
  return MENSAJES[e.code] ?? (e.status >= 500 ? 'Algo falló de nuestro lado. Intenta de nuevo.' : e.message)
}
