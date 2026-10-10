import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

type CampoProps = InputHTMLAttributes<HTMLInputElement> & {
  etiqueta: ReactNode
  error?: string
  ayuda?: ReactNode
}

/**
 * Campo con etiqueta real (accesible) y mensaje de error asociado.
 * Siempre 16 px: en iOS un campo más pequeño hace zoom a la página y no vuelve.
 * Usa `inputMode`, `autoComplete` y `enterKeyHint` para que salga el teclado correcto.
 */
export function Campo({ etiqueta, error, ayuda, className, id, ...props }: CampoProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const errorId = `${inputId}-error`
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-[13px] font-semibold">
        {etiqueta}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          'h-13 w-full rounded-control border-[1.5px] border-control bg-superficie px-3.5 text-base text-tinta',
          'placeholder:text-libre-borde focus-visible:outline-2 focus-visible:outline-tinta',
          error && 'border-presencia-borde',
          className,
        )}
        {...props}
      />
      {error ? (
        <span id={errorId} role="alert" className="text-[13px] font-medium text-presencia-borde">
          {error}
        </span>
      ) : ayuda ? (
        <span className="text-[13px] text-texto-2">{ayuda}</span>
      ) : null}
    </div>
  )
}
