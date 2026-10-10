import type { ReactNode } from 'react'
import { Drawer } from 'vaul'
import { cn } from '@/lib/utils'

/**
 * Hoja inferior arrastrable (Vaul, la misma base del Drawer de shadcn/ui).
 * Se cierra deslizando hacia abajo; su animación usa la curva tipo iOS
 * cubic-bezier(0.32, 0.72, 0, 1) y respeta el área segura inferior.
 */
export function Hoja({
  abierta,
  alCambiar,
  titulo,
  descripcion,
  children,
  className,
}: {
  abierta: boolean
  alCambiar: (abierta: boolean) => void
  titulo: string
  descripcion?: string
  children: ReactNode
  className?: string
}) {
  return (
    <Drawer.Root open={abierta} onOpenChange={alCambiar}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-tinta/40" />
        <Drawer.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[88dvh] w-full max-w-[480px] flex-col',
            'rounded-t-hoja bg-superficie pb-[calc(16px+env(safe-area-inset-bottom,0px))] outline-none',
            className,
          )}
        >
          <div aria-hidden="true" className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-[#cdd2c9]" />
          <div className="px-5 pt-3 pb-2">
            <Drawer.Title className="font-display text-[20px] font-bold tracking-[-0.01em]">{titulo}</Drawer.Title>
            {descripcion ? (
              <Drawer.Description className="mt-0.5 text-[14px] text-texto-2">{descripcion}</Drawer.Description>
            ) : (
              <Drawer.Description className="sr-only">{titulo}</Drawer.Description>
            )}
          </div>
          <div className="scroll-hoja min-h-0 flex-1 px-5">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
