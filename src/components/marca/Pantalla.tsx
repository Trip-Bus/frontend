import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Contenedor de pantalla móvil: alto dinámico (100dvh, sigue a la barra del navegador),
 * márgenes seguros para notch / indicador de inicio y ancho máximo de teléfono.
 * En escritorio la app se ve centrada a ancho de celular (útil para la demo en proyector).
 */
export function Pantalla({
  children,
  className,
  oscura = false,
  aSangre = false,
}: {
  children: ReactNode
  className?: string
  oscura?: boolean
  /** Foto o franja hasta el borde superior e inferior: la pantalla pone sus propios márgenes seguros. */
  aSangre?: boolean
}) {
  return (
    <div className={cn('min-h-dvh w-full', oscura ? 'bg-tinta' : 'bg-fondo')}>
      <main
        className={cn(
          !aSangre && 'pt-seguro pb-seguro',
          'mx-auto flex min-h-dvh w-full max-w-[480px] flex-col',
          oscura ? 'bg-tinta text-white' : 'bg-fondo text-tinta',
          className,
        )}
      >
        {children}
      </main>
    </div>
  )
}
