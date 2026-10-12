import { useMutation } from '@tanstack/react-query'
import { CircleUser, LayoutGrid, Search, Ticket } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Hoja } from '@/components/ui/hoja'
import { api } from '@/lib/endpoints'
import { sesion, useSesion } from '@/lib/sesion'
import { cn } from '@/lib/utils'

/**
 * Barra de navegación inferior. Se toca cientos de veces al día: el cambio de pestaña
 * NO se anima (skill "animate"), solo hay retroalimentación al presionar.
 */
export function BarraInferior({ activa }: { activa: 'viajar' | 'tiquetes' | 'panel' }) {
  const s = useSesion()
  const navigate = useNavigate()
  const [cuenta, setCuenta] = useState(false)
  const salir = useMutation({
    mutationFn: api.auth.logout,
    // Aunque el servidor falle, la sesión local se cierra.
    onSettled: () => {
      sesion.cerrar()
      setCuenta(false)
      navigate('/', { replace: true })
    },
  })

  const equipo = !!s && s.rol !== 'PASAJERO'
  const item = (on: boolean) =>
    cn(
      'tap flex items-center justify-center gap-2 rounded-2xl text-[14px]',
      equipo && 'flex-col gap-0.5 text-[12px]',
      on ? 'bg-lima font-semibold text-tinta' : 'font-medium text-[#dde3df]',
    )

  return (
    <>
      <nav
        aria-label="Principal"
        className={cn(
          'sticky bottom-[calc(14px+env(safe-area-inset-bottom,0px))] mx-5 mt-6 grid h-16 gap-1.5 rounded-[22px] bg-tinta p-1.5',
          equipo ? 'grid-cols-4' : 'grid-cols-3',
        )}
      >
        <Link to="/inicio" aria-current={activa === 'viajar' ? 'page' : undefined} className={item(activa === 'viajar')}>
          <Search className="size-5" aria-hidden="true" />
          Viajar
        </Link>
        <Link to="/mis-tiquetes" aria-current={activa === 'tiquetes' ? 'page' : undefined} className={item(activa === 'tiquetes')}>
          <Ticket className="size-5" aria-hidden="true" />
          Tiquetes
        </Link>
        {equipo && (
          <Link to="/panel" aria-current={activa === 'panel' ? 'page' : undefined} className={item(activa === 'panel')}>
            <LayoutGrid className="size-5" aria-hidden="true" />
            Panel
          </Link>
        )}
        {s ? (
          <button onClick={() => setCuenta(true)} className={item(false)}>
            <CircleUser className="size-5" aria-hidden="true" />
            Cuenta
          </button>
        ) : (
          <Link to="/entrar" className={item(false)}>
            <CircleUser className="size-5" aria-hidden="true" />
            Entrar
          </Link>
        )}
      </nav>

      <Hoja abierta={cuenta} alCambiar={setCuenta} titulo="Tu cuenta">
        <div className="flex flex-col gap-3 pb-2">
          <p className="text-[15px] text-texto-2">Al salir, tu sesión se cierra también en el servidor.</p>
          <Button ancho="completo" disabled={salir.isPending} onClick={() => salir.mutate()}>
            {salir.isPending ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </Button>
        </div>
      </Hoja>
    </>
  )
}
