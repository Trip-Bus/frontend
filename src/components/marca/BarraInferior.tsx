import { CircleUser, LayoutGrid, Search, Ticket } from 'lucide-react'
import { Link } from 'react-router'
import { useSesion } from '@/lib/sesion'
import { cn } from '@/lib/utils'

/**
 * Barra de navegación inferior. Se toca cientos de veces al día: el cambio de pestaña
 * NO se anima (skill "animate"), solo hay retroalimentación al presionar.
 */
export function BarraInferior({ activa }: { activa: 'viajar' | 'tiquetes' | 'panel' | 'cuenta' }) {
  const s = useSesion()

  const equipo = !!s && s.rol !== 'PASAJERO'
  const item = (on: boolean) =>
    cn(
      'tap flex items-center justify-center gap-2 rounded-2xl text-[14px]',
      equipo && 'flex-col gap-0.5 text-[12px]',
      on ? 'bg-acento font-semibold text-tinta' : 'font-medium text-[#dde3df]',
    )

  return (
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
        <Link to="/cuenta" aria-current={activa === 'cuenta' ? 'page' : undefined} className={item(activa === 'cuenta')}>
          <CircleUser className="size-5" aria-hidden="true" />
          Cuenta
        </Link>
      ) : (
        <Link to="/entrar" className={item(false)}>
          <CircleUser className="size-5" aria-hidden="true" />
          Entrar
        </Link>
      )}
    </nav>
  )
}
