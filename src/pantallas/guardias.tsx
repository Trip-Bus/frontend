import { useQuery } from '@tanstack/react-query'
import { Link, Navigate, Outlet, useLocation } from 'react-router'
import { Pantalla } from '@/components/marca/Pantalla'
import { api } from '@/lib/endpoints'
import { useSesion } from '@/lib/sesion'
import type { Rol } from '@/lib/tipos'
import { Bienvenida } from './Bienvenida'

/** Rutas que exigen sesión: sin token, manda a /entrar y vuelve aquí después. */
export function RequiereSesion() {
  const s = useSesion()
  const { pathname, search } = useLocation()
  if (!s) return <Navigate to={`/entrar?siguiente=${encodeURIComponent(pathname + search)}`} replace />
  return <Outlet />
}

/** La bienvenida solo se ve la primera vez: cada rol vuelve a su área. */
export function Raiz() {
  const s = useSesion()
  if (!s) return <Bienvenida />
  const inicio = { PASAJERO: '/inicio', CONDUCTOR: '/conductor', OPERADOR: '/operador', ADMIN: '/admin' } satisfies Record<Rol, string>
  return <Navigate to={inicio[s.rol]} replace />
}

export function RequiereRol({ roles, requiereEmpresa = false }: { roles: Rol[]; requiereEmpresa?: boolean }) {
  const s = useSesion()
  const { pathname } = useLocation()
  if (!s) return <Navigate to={`/entrar?siguiente=${encodeURIComponent(pathname)}`} replace />
  if (!roles.includes(s.rol)) return <SinAcceso rol={s.rol} />

  return requiereEmpresa ? <RequiereEmpresa userId={s.userId} /> : <Outlet />
}

/** Búsqueda pública: conserva el acceso anónimo y evita que personal use pantallas de pasajero. */
export function SoloPasajero() {
  const s = useSesion()
  return s && s.rol !== 'PASAJERO' ? <SinAcceso rol={s.rol} /> : <Outlet />
}

function RequiereEmpresa({ userId }: { userId: string }) {
  const usuario = useQuery({ queryKey: ['usuario', userId], queryFn: () => api.auth.usuario(userId), staleTime: Infinity })
  if (usuario.isPending) {
    return (
      <Pantalla>
        <p role="status" className="px-5 pt-8 text-texto-2">Verificando la empresa de tu cuenta…</p>
      </Pantalla>
    )
  }
  if (usuario.isError) {
    return (
      <Pantalla>
        <section role="alert" className="flex flex-col gap-3 px-5 pt-8">
          <h1 className="font-display text-[22px] font-bold">No pudimos verificar tu empresa</h1>
          <p className="text-[15px] text-texto-2">Vuelve a intentarlo cuando tengas conexión.</p>
        </section>
      </Pantalla>
    )
  }
  if (!usuario.data?.companyId) return <SinAcceso rol="OPERADOR" sinEmpresa />
  return <Outlet />
}

function SinAcceso({ rol, sinEmpresa = false }: { rol: Rol; sinEmpresa?: boolean }) {
  const destino = rol === 'PASAJERO' ? '/inicio' : rol === 'CONDUCTOR' ? '/conductor' : rol === 'OPERADOR' ? '/operador' : '/admin'
  return (
    <Pantalla>
      <section role="alert" className="flex flex-1 flex-col items-center gap-3 px-7 pt-14 text-center">
        <h1 className="font-display text-[24px] font-bold">No tienes acceso a esta sección</h1>
        <p className="text-[15px] leading-relaxed text-texto-2">
          {sinEmpresa ? 'Tu cuenta de operador no está vinculada a una empresa. Pide ayuda al administrador.' : 'Esta ruta pertenece a otro tipo de cuenta.'}
        </p>
        <Link to={destino} className="mt-2 inline-flex h-12 items-center rounded-control bg-tinta px-5 font-semibold text-white">
          Ir a mi inicio
        </Link>
      </section>
    </Pantalla>
  )
}

/** US-005: rutas anteriores del panel, solo para conductor, operador o admin. */
export function RequiereEquipo() {
  return <RequiereRol roles={['CONDUCTOR', 'OPERADOR', 'ADMIN']} />
}
