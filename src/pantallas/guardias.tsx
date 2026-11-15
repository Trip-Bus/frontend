import { Navigate, Outlet, useLocation } from 'react-router'
import { useSesion } from '@/lib/sesion'
import { Bienvenida } from './Bienvenida'

/** Rutas que exigen sesión: sin token, manda a /entrar y vuelve aquí después. */
export function RequiereSesion() {
  const s = useSesion()
  const { pathname, search } = useLocation()
  if (!s) return <Navigate to={`/entrar?siguiente=${encodeURIComponent(pathname + search)}`} replace />
  return <Outlet />
}

/** La bienvenida solo se ve la primera vez: con sesión se va directo al inicio. */
export function Raiz() {
  const s = useSesion()
  return s ? <Navigate to="/inicio" replace /> : <Bienvenida />
}

/** US-005: solo personal de las empresas (conductor, operador) y admin entran al panel. */
export function RequiereEquipo() {
  const s = useSesion()
  const { pathname } = useLocation()
  if (!s) return <Navigate to={`/entrar?siguiente=${encodeURIComponent(pathname)}`} replace />
  if (s.rol === 'PASAJERO') return <Navigate to="/inicio" replace />
  return <Outlet />
}
