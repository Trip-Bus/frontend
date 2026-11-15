import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * "Mantén para pagar": hay que sostener 2 s (dedo, mouse o barra espaciadora) para confirmar.
 * Evita pagos por un toque accidental en el bolsillo. Al soltar antes, el relleno vuelve rápido
 * (skill "animate": la vuelta es más corta que la ida y sale de donde quedó).
 */
export function BotonMantener({
  alCompletar,
  duracionMs = 2000,
  deshabilitado = false,
  etiqueta,
  children,
  textoSosteniendo = 'Sigue presionando…',
}: {
  alCompletar: () => void
  duracionMs?: number
  deshabilitado?: boolean
  etiqueta: string
  children: ReactNode
  textoSosteniendo?: string
}) {
  const [sosteniendo, setSosteniendo] = useState(false)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)

  const soltar = () => {
    if (temporizador.current) clearTimeout(temporizador.current)
    temporizador.current = null
    setSosteniendo(false)
  }
  const empezar = () => {
    if (deshabilitado || temporizador.current) return
    setSosteniendo(true)
    temporizador.current = setTimeout(() => {
      temporizador.current = null
      setSosteniendo(false)
      alCompletar()
    }, duracionMs)
  }
  useEffect(() => soltar, [])

  return (
    <button
      type="button"
      aria-label={etiqueta}
      disabled={deshabilitado}
      onPointerDown={(e) => {
        if (e.button !== 0) return
        e.currentTarget.setPointerCapture?.(e.pointerId)
        empezar()
      }}
      onPointerUp={soltar}
      onPointerCancel={soltar}
      onLostPointerCapture={soltar}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
          e.preventDefault()
          empezar()
        }
      }}
      onKeyUp={(e) => {
        if (e.key === ' ' || e.key === 'Enter') soltar()
      }}
      className={cn(
        'relative h-16 w-full touch-none overflow-hidden rounded-boton bg-tinta text-[17px] font-semibold text-white select-none',
        'disabled:cursor-not-allowed disabled:bg-[#e3e6de] disabled:text-texto-2',
      )}
    >
      <span className="relative flex items-center justify-center gap-2.5">{sosteniendo ? textoSosteniendo : children}</span>
      {/* Capa del acento con el mismo texto en tinta, revelada de izquierda a derecha: el texto nunca queda tinta sobre tinta. */}
      <span
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center gap-2.5 bg-acento text-tinta"
        style={{
          clipPath: `inset(0 ${sosteniendo ? 0 : 100}% 0 0)`,
          transition: sosteniendo ? `clip-path ${duracionMs}ms linear` : 'clip-path 220ms var(--ease-out)',
        }}
      >
        {sosteniendo ? textoSosteniendo : children}
      </span>
    </button>
  )
}
