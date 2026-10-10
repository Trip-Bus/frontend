import { ChevronLeft } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { cn } from '@/lib/utils'

/** Botón de volver de 44 px. Con `a` navega a una ruta fija; sin ella, vuelve en el historial. */
export function BotonVolver({ a, className, oscuro = false }: { a?: string; className?: string; oscuro?: boolean }) {
  const navigate = useNavigate()
  const clases = cn(
    'tap flex size-11 shrink-0 items-center justify-center rounded-control',
    oscuro ? 'bg-tinta-2 text-white' : 'bg-superficie text-tinta',
    className,
  )
  if (a) {
    return (
      <Link to={a} aria-label="Volver" className={clases}>
        <ChevronLeft className="size-[22px]" aria-hidden="true" />
      </Link>
    )
  }
  return (
    <button type="button" aria-label="Volver" className={clases} onClick={() => navigate(-1)}>
      <ChevronLeft className="size-[22px]" aria-hidden="true" />
    </button>
  )
}
