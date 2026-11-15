import type { Tiquete, Uuid } from '@/lib/tipos'

/**
 * Pases guardados en el teléfono: en la vía no siempre hay señal y el QR tiene que abrir igual.
 * Se guardan los últimos 10 (el QR es un PNG pequeño en base64).
 */
const CLAVE = 'tripbus.pases'

function leerTodos(): Tiquete[] {
  try {
    const v = globalThis.localStorage?.getItem(CLAVE)
    return v ? (JSON.parse(v) as Tiquete[]) : []
  } catch {
    return []
  }
}

/** Todos los pases guardados (para ver los tiquetes sin señal). */
export function pasesGuardados(): Tiquete[] {
  return leerTodos()
}

export function paseGuardado(ticketId: Uuid): Tiquete | undefined {
  return leerTodos().find((t) => t.ticketId === ticketId)
}

export function guardarPase(t: Tiquete) {
  try {
    const resto = leerTodos().filter((x) => x.ticketId !== t.ticketId)
    globalThis.localStorage?.setItem(CLAVE, JSON.stringify([t, ...resto].slice(0, 10)))
  } catch {
    /* sin espacio o sin almacenamiento: el pase sigue en pantalla */
  }
}

/** Código corto y legible para decirlo en voz alta en la taquilla: "TB-4F7K2A". */
export function codigoReserva(bookingId: Uuid): string {
  return `TB-${bookingId.replace(/-/g, '').slice(0, 6).toUpperCase()}`
}
