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
  refreshToken: string | null
  refreshExpiraEn: number | null
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
    const s = JSON.parse(crudo) as Partial<Sesion>
    if (typeof s.token !== 'string' || typeof s.expiraEn !== 'number' || typeof s.userId !== 'string' || !s.rol) return null
    return s.expiraEn > Date.now()
      ? {
          token: s.token,
          expiraEn: s.expiraEn,
          refreshToken: typeof s.refreshToken === 'string' ? s.refreshToken : null,
          refreshExpiraEn: typeof s.refreshExpiraEn === 'number' ? s.refreshExpiraEn : null,
          userId: s.userId,
          rol: s.rol,
        }
      : null
  } catch {
    return null
  }
}

function emitir() {
  oyentes.forEach((o) => o())
}

export const sesion = {
  obtener(): Sesion | null {
    if (
      actual &&
      actual.expiraEn <= Date.now() &&
      (!actual.refreshToken || (actual.refreshExpiraEn !== null && actual.refreshExpiraEn <= Date.now()))
    ) {
      sesion.cerrar()
    }
    return actual
  },

  token(): string | null {
    return sesion.obtener()?.token ?? null
  },

  refreshToken(): string | null {
    return sesion.obtener()?.refreshToken ?? null
  },

  actualizarTokens(tokens: { accessToken: string; expiresAt: string; refreshToken?: string | null; refreshExpiresAt?: string | null }) {
    const existente = sesion.obtener()
    if (!existente) return
    actual = {
      ...existente,
      token: tokens.accessToken,
      expiraEn: new Date(tokens.expiresAt).getTime(),
      refreshToken: tokens.refreshToken === undefined ? existente.refreshToken : tokens.refreshToken,
      refreshExpiraEn:
        tokens.refreshExpiresAt === undefined
          ? existente.refreshExpiraEn
          : tokens.refreshExpiresAt === null
            ? null
            : new Date(tokens.refreshExpiresAt).getTime(),
    }
    try {
      globalThis.localStorage?.setItem(CLAVE, JSON.stringify(actual))
    } catch {
      /* sin almacenamiento: la sesión vive solo en memoria */
    }
    emitir()
  },

  iniciar(auth: AuthResponse) {
    actual = {
      token: auth.accessToken,
      expiraEn: new Date(auth.expiresAt).getTime(),
      refreshToken: auth.refreshToken ?? null,
      refreshExpiraEn: auth.refreshExpiresAt ? new Date(auth.refreshExpiresAt).getTime() : null,
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
