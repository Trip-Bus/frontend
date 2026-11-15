import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { buttonVariants } from '@/components/ui/button-variants'
import { Button } from '@/components/ui/button'
import { textoError } from '@/lib/api'
import { cn } from '@/lib/utils'
import { BotonVolver } from './BotonVolver'
import { Pantalla } from './Pantalla'

/** Bloques grises con la forma de lo que va a cargar (nunca un spinner a pantalla completa). */
export function Esqueleto({ bloques = [86, 112, 112], className }: { bloques?: number[]; className?: string }) {
  return (
    <div aria-busy="true" aria-label="Cargando" className={cn('flex flex-col gap-2.5 px-5 pt-4', className)}>
      {bloques.map((h, i) => (
        <div key={i} className="rounded-tarjeta bg-superficie" style={{ height: h }} />
      ))}
    </div>
  )
}

/** Pantalla completa de "no se pudo": explica qué pasó y ofrece una salida. */
export function PantallaError({
  titulo = 'No pudimos cargar esto',
  error,
  reintentar,
  volverA = '/inicio',
  children,
}: {
  titulo?: string
  error?: unknown
  reintentar?: () => void
  volverA?: string
  children?: ReactNode
}) {
  return (
    <Pantalla>
      <header className="px-5">
        <BotonVolver a={volverA} />
      </header>
      <section role="alert" className="flex flex-1 flex-col items-center gap-3.5 px-7 pt-14 text-center">
        <h1 className="font-display text-[24px] font-bold tracking-[-0.01em]">{titulo}</h1>
        <p className="text-[15px] leading-relaxed text-texto-2">{textoError(error)}</p>
        {children}
        <div className="mt-2 flex w-full flex-col gap-2.5">
          {reintentar && (
            <Button ancho="completo" onClick={reintentar}>
              Intentar de nuevo
            </Button>
          )}
          <Link to={volverA} className={buttonVariants({ variante: 'contorno', ancho: 'completo' })}>
            Volver
          </Link>
        </div>
      </section>
    </Pantalla>
  )
}

/** Mensaje en línea (dentro de una pantalla) para un estado vacío o un aviso. */
export function Aviso({
  tono = 'neutro',
  children,
  className,
}: {
  tono?: 'neutro' | 'alerta' | 'exito'
  children: ReactNode
  className?: string
}) {
  return (
    <div
      role={tono === 'alerta' ? 'alert' : 'status'}
      className={cn(
        'rounded-[18px] px-4 py-3 text-[14px] leading-snug',
        tono === 'alerta' && 'border-[1.5px] border-presencia-borde bg-presencia text-alerta',
        tono === 'exito' && 'bg-acento font-semibold text-tinta',
        tono === 'neutro' && 'bg-superficie text-texto-2',
        className,
      )}
    >
      {children}
    </div>
  )
}
