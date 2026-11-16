import { AirVent, Armchair, Bath, Tv, Usb, Wifi, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const SERVICIOS: Record<string, { icono: LucideIcon; nombre: string }> = {
  WIFI: { icono: Wifi, nombre: 'Wi-Fi' },
  BANO: { icono: Bath, nombre: 'Baño' },
  USB: { icono: Usb, nombre: 'Carga USB' },
  AIRE_ACONDICIONADO: { icono: AirVent, nombre: 'Aire acondicionado' },
  TV: { icono: Tv, nombre: 'Televisión' },
  SILLA_RECLINABLE: { icono: Armchair, nombre: 'Silla reclinable' },
}

/** Íconos de los servicios del bus (P-01), cada uno con su nombre para lectores de pantalla. */
export function IconosServicios({ servicios, className }: { servicios?: string[]; className?: string }) {
  const conocidos = (servicios ?? []).filter((s) => SERVICIOS[s])
  if (conocidos.length === 0) return null
  return (
    <ul aria-label="Servicios del bus" className={cn('flex flex-wrap gap-1.5 text-texto-2', className)}>
      {conocidos.map((s) => {
        const { icono: Icono, nombre } = SERVICIOS[s]
        return (
          <li key={s} title={nombre}>
            <Icono className="size-4" aria-hidden="true" />
            <span className="sr-only">{nombre}</span>
          </li>
        )
      })}
    </ul>
  )
}
