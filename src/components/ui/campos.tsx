import { useId, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export type Opcion = { valor: string; texto: string }

/** Lista desplegable con etiqueta real (accesible). */
export function Selector({
  etiqueta,
  opciones,
  vacia,
  className,
  id,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { etiqueta: ReactNode; opciones: Opcion[]; vacia?: string }) {
  const autoId = useId()
  const selectId = id ?? autoId
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={selectId} className="text-[13px] font-semibold">
        {etiqueta}
      </label>
      <select
        id={selectId}
        className={cn('h-13 w-full rounded-control border-[1.5px] border-control bg-superficie px-3 text-base', className)}
        {...props}
      >
        {vacia !== undefined && <option value="">{vacia}</option>}
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
    </div>
  )
}

/** Casilla de verificación de 20 px con el texto al lado (área tocable completa). */
export function Casilla({
  etiqueta,
  marcada,
  alCambiar,
  disabled,
}: {
  etiqueta: ReactNode
  marcada: boolean
  alCambiar: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <label className="flex items-start gap-3 text-[14px] leading-snug">
      <input
        type="checkbox"
        checked={marcada}
        disabled={disabled}
        onChange={(e) => alCambiar(e.target.checked)}
        className="mt-0.5 size-5 shrink-0 accent-tinta"
      />
      <span>{etiqueta}</span>
    </label>
  )
}

/** Texto de varias líneas con etiqueta. */
export function AreaTexto({ etiqueta, className, id, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { etiqueta: ReactNode }) {
  const autoId = useId()
  const areaId = id ?? autoId
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={areaId} className="text-[13px] font-semibold">
        {etiqueta}
      </label>
      <textarea
        id={areaId}
        rows={2}
        className={cn('rounded-control border-[1.5px] border-control bg-superficie px-3.5 py-3 text-base', className)}
        {...props}
      />
    </div>
  )
}

/** Grupo de botones excluyentes (pestañas o filtros cortos). */
export function Segmentos<T extends string>({
  etiqueta,
  opciones,
  valor,
  alCambiar,
  rol = 'radiogroup',
}: {
  etiqueta: string
  opciones: { valor: T; texto: ReactNode }[]
  valor: T
  alCambiar: (v: T) => void
  rol?: 'radiogroup' | 'tablist'
}) {
  return (
    <div role={rol} aria-label={etiqueta} className="flex flex-wrap gap-1.5 rounded-control bg-[#e7eae2] p-1">
      {opciones.map((o) => {
        const on = o.valor === valor
        return (
          <button
            key={o.valor}
            type="button"
            role={rol === 'tablist' ? 'tab' : 'radio'}
            aria-selected={rol === 'tablist' ? on : undefined}
            aria-checked={rol === 'radiogroup' ? on : undefined}
            onClick={() => alCambiar(o.valor)}
            className={cn('tap h-10 flex-1 rounded-[11px] px-3 text-[14px] font-semibold whitespace-nowrap', on ? 'bg-superficie text-tinta' : 'text-texto-2')}
          >
            {o.texto}
          </button>
        )
      })}
    </div>
  )
}
