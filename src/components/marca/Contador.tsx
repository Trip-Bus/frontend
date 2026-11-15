import { useSegundosRestantes } from '@/hooks/useAhora'
import { reloj } from '@/lib/formato'
import { cn } from '@/lib/utils'

/**
 * Cuenta regresiva de la retención (US-022): anillo + mm:ss. Los dígitos cambian cada segundo,
 * así que no se animan (solo el anillo avanza, con transición lineal de 1 s).
 */
export function ContadorRetencion({
  hasta,
  totalSegundos = 600,
  className,
}: {
  hasta: string | null | undefined
  totalSegundos?: number
  className?: string
}) {
  const s = useSegundosRestantes(hasta)
  if (s == null) return null
  const urgente = s <= 120
  const r = 14
  const circ = 2 * Math.PI * r
  const fraccion = Math.max(0, Math.min(1, s / totalSegundos))
  return (
    <div
      role="timer"
      aria-label={`Te guardamos el puesto ${reloj(s)} minutos más`}
      className={cn(
        'flex h-10 shrink-0 items-center gap-2 rounded-full pr-3.5 pl-1.5',
        urgente ? 'bg-naranja text-tinta' : 'bg-superficie text-tinta',
        className,
      )}
    >
      <svg viewBox="0 0 36 36" className="size-8 -rotate-90" aria-hidden="true">
        <circle cx="18" cy="18" r={r} fill="none" stroke={urgente ? '#0d1411' : '#d9ddd5'} strokeOpacity={urgente ? 0.25 : 1} strokeWidth="4" />
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          stroke="#0d1411"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - fraccion)}
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <span className="num text-[16px] font-bold">{reloj(s)}</span>
    </div>
  )
}
