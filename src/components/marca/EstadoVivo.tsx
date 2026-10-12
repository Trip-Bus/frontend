import { useEstadoTiempoReal } from '@/lib/tiempoReal'
import { cn } from '@/lib/utils'
import { LiveDot } from './LiveDot'

/**
 * Píldora "En vivo" del canal WebSocket (US-020 / US-094). Si el canal cae, lo dice:
 * la pantalla sigue actualizándose por REST cada pocos segundos.
 */
export function EstadoVivo({ className, oscuro = false }: { className?: string; oscuro?: boolean }) {
  const estado = useEstadoTiempoReal()
  const vivo = estado === 'en-vivo'
  const texto = vivo ? 'En vivo' : estado === 'conectando' ? 'Conectando…' : estado === 'reconectando' ? 'Reconectando…' : 'Actualiza cada 5 s'
  return (
    <span
      role="status"
      className={cn(
        'flex h-8 shrink-0 items-center gap-2 rounded-full px-3 text-[12px] font-semibold whitespace-nowrap',
        oscuro || vivo ? 'bg-tinta text-white' : 'bg-superficie text-texto-2',
        className,
      )}
    >
      {vivo ? <LiveDot /> : <span aria-hidden="true" className="size-2 rounded-full bg-control" />}
      {texto}
    </span>
  )
}
