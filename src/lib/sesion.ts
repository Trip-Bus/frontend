import { useSyncExternalStore } from 'react'
import type { AuthResponse, Rol, Uuid } from './tipos'

/**
 * Sesión del usuario (JWT emitido por Identity).
 *
 * Se guarda en localStorage para que sobreviva a recargas. El almacenamiento puede fallar
 * (modo privado, sitio bloqueado), así que toda lectura/escritura va en try/catch y la app
 * sigue funcionando en memoria.
 *
 * Nota de seguridad para el MVP: localStorage es accesible desde JS. El token dura ≤ 60 min y
 * el logout lo revoca en el servidor. Si más adelante Identity emite cookies HttpOnly, solo
 * cambia este archivo.
 */
export type Sesion = {
  token: string
  expiraEn: number // epoch ms
  userId: Uuid
  rol: Rol
}

const CLAVE = 'tripbus.sesion'
const oyentes = new Set<() => void>()
let actual: Sesion | null = leer()

function leer(): Sesion | null {
  try {
    const crudo = globalThis.localStorage?.getItem(CLAVE)
    if (!crudo) return null
    const s = JSON.parse(crudo) as Sesion
    return s.expiraEn > Date.now() ? s : null
  } catch {
    return null
  }
}

function emitir() {
  oyentes.forEach((o) => o())
}

export const sesion = {
  obtener(): Sesion | null {
    if (actual && actual.expiraEn <= Date.now()) {
      sesion.cerrar()
    }
    return actual
  },

  token(): string | null {
    return sesion.obtener()?.token ?? null
  },

  iniciar(auth: AuthResponse) {
    actual = {
      token: auth.accessToken,
      expiraEn: new Date(auth.expiresAt).getTime(),
      userId: auth.userId,
      rol: auth.rol,
    }
    try {
      globalThis.localStorage?.setItem(CLAVE, JSON.stringify(actual))
    } catch {
      /* sin almacenamiento: la sesión vive solo en memoria */
    }
    emitir()
  },

  cerrar() {
    actual = null
    try {
      globalThis.localStorage?.removeItem(CLAVE)
    } catch {
      /* nada que limpiar */
    }
    emitir()
  },

  suscribir(oyente: () => void) {
    oyentes.add(oyente)
    return () => oyentes.delete(oyente)
  },
}

/** Hook: la sesión actual (o null), re-renderiza al iniciar o cerrar sesión. */
export function useSesion(): Sesion | null {
  return useSyncExternalStore(sesion.suscribir, sesion.obtener, () => null)
}
