import type { ReactNode } from 'react'
import { BotonVolver } from './BotonVolver'

/** Encabezado de una pantalla secundaria: volver + título (y una línea de contexto opcional). */
export function Encabezado({
  titulo,
  volverA,
  sinVolver = false,
  children,
}: {
  titulo: string
  volverA?: string
  /** Sin botón de volver (p. ej. cuando la persona debe terminar este paso para seguir). */
  sinVolver?: boolean
  children?: ReactNode
}) {
  return (
    <header className="flex flex-col gap-3 px-5">
      {!sinVolver && <BotonVolver a={volverA} />}
      <div>
        <h1 className="font-display text-[28px] leading-[1.1] font-bold tracking-[-0.02em]">{titulo}</h1>
        {children && <p className="mt-1.5 text-[15px] leading-snug text-texto-2">{children}</p>}
      </div>
    </header>
  )
}
