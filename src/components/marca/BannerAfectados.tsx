import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { api } from '@/lib/endpoints'
import { useSesion } from '@/lib/sesion'
import { cn } from '@/lib/utils'

/** P-08: aviso de viajes que la empresa canceló, reprogramó o retrasó y que esperan una decisión. */
export function BannerAfectados({ oscuro = false }: { oscuro?: boolean }) {
  const s = useSesion()
  const afectados = useQuery({ queryKey: ['afectados'], queryFn: api.afectados.listar, enabled: s?.rol === 'PASAJERO', staleTime: 30_000 })
  const cantidad = (afectados.data ?? []).filter((a) => a.estado === 'PENDIENTE').length
  if (cantidad === 0) return null
  return (
    <Link
      to="/afectados"
      className={cn(
        'tap flex items-center gap-3 rounded-tarjeta border-2 border-presencia-borde p-4',
        oscuro ? 'bg-tinta/70 text-white backdrop-blur-md' : 'bg-presencia text-alerta',
      )}
    >
      <AlertTriangle className="size-6 shrink-0" aria-hidden="true" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold">{cantidad === 1 ? 'Un viaje tuyo tuvo un cambio' : `${cantidad} viajes tuyos tuvieron cambios`}</span>
        <span className="text-[13px]">La empresa canceló o movió el horario. Elige qué hacer antes de que venza el plazo.</span>
      </span>
      <ChevronRight className="size-5 shrink-0" aria-hidden="true" />
    </Link>
  )
}
