import { Bell } from 'lucide-react'
import { Link } from 'react-router'
import { useAvisos } from '@/features/avisos'
import { useSesion } from '@/lib/sesion'
import { cn } from '@/lib/utils'

/** P-13: campana con el número de avisos sin leer; abre el centro de avisos. Solo para pasajeros. */
export function CampanaAvisos({ className }: { className?: string }) {
  const s = useSesion()
  const sinLeer = useAvisos().filter((a) => !a.leido).length
  if (s?.rol !== 'PASAJERO') return null
  return (
    <Link
      to="/avisos"
      aria-label={sinLeer > 0 ? `Avisos, ${sinLeer} sin leer` : 'Avisos'}
      className={cn('tap relative flex size-11 shrink-0 items-center justify-center rounded-control bg-superficie text-tinta', className)}
    >
      <Bell className="size-5" aria-hidden="true" />
      {sinLeer > 0 && (
        <span aria-hidden="true" className="num absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-naranja px-1 text-[11px] font-bold text-tinta">
          {sinLeer > 9 ? '9+' : sinLeer}
        </span>
      )}
    </Link>
  )
}
