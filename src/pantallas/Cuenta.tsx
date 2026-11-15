import { useMutation, useQuery } from '@tanstack/react-query'
import { ChevronRight, LayoutGrid, LogOut, QrCode, ShieldCheck, Ticket, UserRound } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { BarraInferior } from '@/components/marca/BarraInferior'
import { Aviso, Esqueleto } from '@/components/marca/Estados'
import { Pantalla } from '@/components/marca/Pantalla'
import { Button } from '@/components/ui/button'
import { Hoja } from '@/components/ui/hoja'
import { toast } from 'sonner'
import { useAcento } from '@/hooks/useAcento'
import { textoError } from '@/lib/api'
import { api } from '@/lib/endpoints'
import { iniciales, plural } from '@/lib/formato'
import { sesion, useSesion } from '@/lib/sesion'
import type { Rol } from '@/lib/tipos'

const ROL_TEXTO: Record<Rol, string> = {
  PASAJERO: 'Pasajero',
  CONDUCTOR: 'Conductor',
  OPERADOR: 'Operador',
  ADMIN: 'Administrador',
}

/**
 * Tu cuenta: tu perfil (Identity, GET /users/me), si el correo está verificado (US-130), atajos a tus datos
 * (US-128, US-131) y a la seguridad (US-129, US-106), y cerrar sesión.
 */
export function Cuenta() {
  useAcento(null)
  const s = useSesion()
  const navigate = useNavigate()
  const [confirmar, setConfirmar] = useState(false)

  const usuario = useQuery({
    queryKey: ['perfil', s?.userId],
    queryFn: api.cuenta.perfil,
    enabled: !!s,
    staleTime: 5 * 60_000,
  })
  const reenviar = useMutation({
    mutationFn: api.auth.reenviarVerificacion,
    onSuccess: () => toast('Te enviamos el enlace. Revisa tu correo (vence en 24 horas).'),
    onError: (e) => toast(textoError(e)),
  })
  // Misma consulta (y caché) que "Mis tiquetes".
  const reservas = useQuery({ queryKey: ['reservas'], queryFn: api.reservas.mias, enabled: !!s, staleTime: 30_000 })
  const confirmadas = (reservas.data ?? []).filter((r) => r.estado === 'CONFIRMADA').length

  const salir = useMutation({
    mutationFn: api.auth.logout,
    // Aunque el servidor falle, la sesión local se cierra.
    onSettled: () => {
      sesion.cerrar()
      setConfirmar(false)
      navigate('/', { replace: true })
    },
  })

  if (!s) return null
  const u = usuario.data
  const rol = u?.rol ?? s.rol
  const equipo = rol !== 'PASAJERO'

  return (
    <Pantalla className="pb-0">
      <header className="px-5">
        <h1 className="font-display text-[28px] font-bold tracking-[-0.02em]">Tu cuenta</h1>
      </header>

      <div className="flex flex-col gap-4 px-5 pt-4">
        {usuario.isPending ? (
          <Esqueleto className="px-0 pt-0" bloques={[132]} />
        ) : usuario.isError ? (
          <Aviso tono="alerta">{textoError(usuario.error, 'No pudimos cargar tus datos.')}</Aviso>
        ) : (
          <section aria-label="Tus datos" className="flex flex-col gap-4 rounded-tarjeta bg-tinta p-5 text-white">
            <div className="flex items-center gap-4">
              <span aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center rounded-full bg-acento text-[22px] font-bold text-tinta">
                {iniciales(u?.nombre)}
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-[20px] font-semibold" title={u?.nombre}>
                  {u?.nombre}
                </span>
                <span className="truncate text-[14px] text-tinta-texto-2" title={u?.email}>
                  {u?.email}
                </span>
                <span className="mt-1 w-fit rounded-full border border-white/25 px-2.5 py-0.5 text-[12px] font-semibold">{ROL_TEXTO[rol]}</span>
              </div>
            </div>
            {u && !u.emailVerificado && (
              <div className="flex items-center justify-between gap-3 rounded-[16px] bg-white/10 px-3.5 py-2.5">
                <span className="text-[14px] leading-snug">Tu correo aún no está verificado.</span>
                <button
                  type="button"
                  disabled={reenviar.isPending || reenviar.isSuccess}
                  onClick={() => reenviar.mutate()}
                  className="tap shrink-0 rounded-xl bg-acento px-3 py-2 text-[14px] font-semibold text-tinta disabled:opacity-60"
                >
                  {reenviar.isSuccess ? 'Enviado' : reenviar.isPending ? 'Enviando…' : 'Reenviar enlace'}
                </button>
              </div>
            )}
          </section>
        )}

        <nav aria-label="Atajos" className="flex flex-col overflow-hidden rounded-tarjeta bg-superficie">
          <Fila
            a="/mis-tiquetes"
            icono={<Ticket className="size-5" aria-hidden="true" />}
            titulo="Mis tiquetes"
            detalle={reservas.isSuccess ? (confirmadas ? plural(confirmadas, 'tiquete comprado', 'tiquetes comprados') : 'Aún no has comprado') : undefined}
          />
          <Fila a="/cuenta/datos" icono={<UserRound className="size-5" aria-hidden="true" />} titulo="Tus datos" detalle="Nombre, teléfono, descargar o eliminar" />
          <Fila
            a="/cuenta/seguridad"
            icono={<ShieldCheck className="size-5" aria-hidden="true" />}
            titulo="Seguridad"
            detalle={rol === 'ADMIN' || rol === 'OPERADOR' ? 'Contraseña y verificación en dos pasos' : 'Cambiar tu contraseña'}
          />
          {equipo && (
            <>
              <Fila a="/panel" icono={<LayoutGrid className="size-5" aria-hidden="true" />} titulo="Panel de la empresa" detalle="Viajes, novedades y drops" />
              <Fila a="/panel/validar" icono={<QrCode className="size-5" aria-hidden="true" />} titulo="Validar pase" detalle="Al subir al bus" />
            </>
          )}
        </nav>


        <Button variante="contorno" ancho="completo" onClick={() => setConfirmar(true)}>
          <LogOut className="size-5" aria-hidden="true" />
          Cerrar sesión
        </Button>
      </div>

      <div className="flex-1" />
      <BarraInferior activa="cuenta" />

      <Hoja abierta={confirmar} alCambiar={setConfirmar} titulo="¿Cerrar sesión?" descripcion="Al salir, tu sesión se cierra también en el servidor. Tus pases guardados siguen en este teléfono.">
        <div className="flex flex-col gap-2.5 pb-2">
          <Button ancho="completo" disabled={salir.isPending} onClick={() => salir.mutate()}>
            {salir.isPending ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </Button>
          <Button variante="contorno" ancho="completo" onClick={() => setConfirmar(false)}>
            Seguir conectado
          </Button>
        </div>
      </Hoja>
    </Pantalla>
  )
}

function Fila({ a, icono, titulo, detalle }: { a: string; icono: ReactNode; titulo: string; detalle?: string }) {
  return (
    <Link to={a} className="tap flex min-h-16 items-center gap-3 border-b border-linea px-4 py-3 last:border-b-0">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#eef1e8] text-tinta">{icono}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[16px] font-semibold">{titulo}</span>
        {detalle && <span className="truncate text-[13px] text-texto-2">{detalle}</span>}
      </span>
      <ChevronRight className="size-5 shrink-0 text-texto-2" aria-hidden="true" />
    </Link>
  )
}
