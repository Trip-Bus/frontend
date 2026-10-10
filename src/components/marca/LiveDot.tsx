import { cn } from '@/lib/utils'

type Props = {
  /** lima = tú / en vivo; naranja = otras personas */
  color?: 'lima' | 'naranja'
  className?: string
}

/**
 * Punto "en vivo" con un eco que late. Es CSS puro (corre fuera del hilo principal,
 * no se traba mientras la app carga datos) y respeta prefers-reduced-motion.
 */
export function LiveDot({ color = 'lima', className }: Props) {
  const bg = color === 'lima' ? 'bg-lima' : 'bg-naranja'
  return (
    <span aria-hidden="true" className={cn('relative inline-block size-2 shrink-0', className)}>
      <span
        className={cn('tb-latido absolute inset-0 rounded-full', bg)}
        style={{ animation: 'tb-latido 1.6s var(--ease-out) infinite' }}
      />
      <span className={cn('absolute inset-0 rounded-full', bg)} />
    </span>
  )
}
