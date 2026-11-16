import { useId, useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { PASO_LARGO, pasoAbajo, pasoArriba, valorEnPosicion, type Limites } from '@/features/precios'
import { dinero } from '@/lib/formato'
import { cn } from '@/lib/utils'

type Rango = [number, number]
const NOMBRES = ['Precio mínimo', 'Precio máximo'] as const

/**
 * Rango de precio con dos manijas (patrón "multi-thumb slider" de WAI-ARIA): cada manija es un role="slider" con
 * aria-valuemin/max/now; flechas = 1.000 COP, PageUp/PageDown = 10.000, Inicio/Fin = extremos. Con el dedo o el
 * ratón, tocar la barra mueve la manija más cercana y se puede arrastrar. data-vaul-no-drag evita que arrastrar
 * la manija cierre la hoja.
 */
export function RangoPrecio({ limites, valor, alCambiar }: { limites: Limites; valor: Rango; alCambiar: (v: Rango) => void }) {
  const etiquetaId = useId()
  const pista = useRef<HTMLDivElement>(null)
  const manijas = useRef<(HTMLDivElement | null)[]>([])
  const arrastre = useRef<number | null>(null)
  const [bajo, alto] = valor
  const enExtremos = bajo <= limites.min && alto >= limites.max
  const pct = (v: number) => ((v - limites.min) / (limites.max - limites.min)) * 100

  const mover = (indice: number, v: number) => {
    const nuevo: Rango = indice === 0 ? [Math.min(v, alto), alto] : [bajo, Math.max(v, bajo)]
    if (nuevo[0] !== bajo || nuevo[1] !== alto) alCambiar(nuevo)
  }

  const valorDelPuntero = (e: PointerEvent<HTMLDivElement>) => {
    const caja = pista.current?.getBoundingClientRect()
    if (!caja || caja.width <= 0) return null
    return valorEnPosicion((e.clientX - caja.left) / caja.width, limites)
  }

  const alPresionar = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const v = valorDelPuntero(e)
    if (v == null) return
    // La manija más cercana; si están juntas, la que queda del lado hacia el que se toca.
    const indice = Math.abs(v - bajo) < Math.abs(v - alto) || (bajo === alto && v < bajo) ? 0 : 1
    arrastre.current = indice
    e.currentTarget.setPointerCapture?.(e.pointerId)
    manijas.current[indice]?.focus()
    mover(indice, v)
  }

  const alArrastrar = (e: PointerEvent<HTMLDivElement>) => {
    if (arrastre.current == null) return
    const v = valorDelPuntero(e)
    if (v != null) mover(arrastre.current, v)
  }

  const alSoltar = (e: PointerEvent<HTMLDivElement>) => {
    arrastre.current = null
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }

  const teclado = (indice: number) => (e: KeyboardEvent<HTMLDivElement>) => {
    const actual = indice === 0 ? bajo : alto
    const tramo: Limites = indice === 0 ? { min: limites.min, max: alto } : { min: bajo, max: limites.max }
    const acciones: Record<string, () => number> = {
      ArrowRight: () => pasoArriba(actual, tramo),
      ArrowUp: () => pasoArriba(actual, tramo),
      ArrowLeft: () => pasoAbajo(actual, tramo),
      ArrowDown: () => pasoAbajo(actual, tramo),
      PageUp: () => pasoArriba(actual, tramo, PASO_LARGO),
      PageDown: () => pasoAbajo(actual, tramo, PASO_LARGO),
      Home: () => tramo.min,
      End: () => tramo.max,
    }
    const accion = acciones[e.key]
    if (!accion) return
    e.preventDefault()
    mover(indice, accion())
  }

  return (
    <div role="group" aria-labelledby={etiquetaId} className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3">
        <span id={etiquetaId} className="text-[13px] font-semibold">
          Precio
        </span>
        <output aria-live="polite" className={cn('text-[14px] font-bold', !enExtremos && 'num')}>
          {enExtremos ? 'Cualquier precio' : `${dinero(bajo)} – ${dinero(alto)}`}
        </output>
      </div>
      <div
        ref={pista}
        data-pista=""
        data-vaul-no-drag=""
        onPointerDown={alPresionar}
        onPointerMove={alArrastrar}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
        className="relative mx-3.5 h-11 cursor-pointer touch-none select-none"
      >
        <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-linea" />
        <span
          aria-hidden="true"
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-tinta"
          style={{ left: `${pct(bajo)}%`, right: `${100 - pct(alto)}%` }}
        />
        {valor.map((v, i) => {
          const tramo = i === 0 ? { min: limites.min, max: alto } : { min: bajo, max: limites.max }
          return (
            <div
              key={NOMBRES[i]}
              ref={(el) => {
                manijas.current[i] = el
              }}
              role="slider"
              tabIndex={0}
              aria-label={NOMBRES[i]}
              aria-orientation="horizontal"
              aria-valuemin={tramo.min}
              aria-valuemax={tramo.max}
              aria-valuenow={v}
              aria-valuetext={dinero(v)}
              onKeyDown={teclado(i)}
              className={cn(
                'absolute top-1/2 size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-tinta bg-superficie',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta',
                // Juntas en el máximo, la mínima queda encima para poder sacarla hacia la izquierda.
                i === 0 && bajo >= limites.max ? 'z-20' : 'z-10',
              )}
              style={{ left: `${pct(v)}%` }}
            />
          )
        })}
      </div>
      <div aria-hidden="true" className="num flex justify-between text-[12px] text-texto-2">
        <span>{dinero(limites.min)}</span>
        <span>{dinero(limites.max)}</span>
      </div>
    </div>
  )
}
