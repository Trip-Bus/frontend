import { cn } from '@/lib/utils'

/** Marca de texto: "tripbus." — el punto lima es el pasajero en su ruta. */
export function Logo({ className, claro = false }: { className?: string; claro?: boolean }) {
  return (
    <span
      className={cn(
        'font-display text-[22px] font-extrabold tracking-[-0.02em]',
        claro ? 'text-white' : 'text-tinta',
        className,
      )}
    >
      tripbus<span className={claro ? 'text-lima' : 'text-[#8ab51f]'}>.</span>
    </span>
  )
}
