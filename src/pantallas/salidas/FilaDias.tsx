import { estadoDia, type EstadoDia } from '@/features/precios'
import { dinero, fechaCorta, fechaDesdeApi } from '@/lib/formato'
import type { DiaCalendario } from '@/lib/tipos'
import { cn } from '@/lib/utils'

const TEXTOS: Record<EstadoDia['tipo'], string> = { cargando: '···', lleno: 'lleno', 'sin-salidas': 'sin salidas', precio: '—' }

function textoDia(estado: EstadoDia): string {
  return TEXTOS[estado.tipo]
}

/**
 * Fila de 7 días de /trips/calendar, con los mismos tramos y filtros que la lista: el precio de cada día es el
 * menor "desde" de esa búsqueda (exacto, no redondeado). "lleno" sin cupo; "sin salidas" deshabilita el día.
 */
export function FilaDias({
  fechas,
  dias,
  elegida,
  alElegir,
}: {
  fechas: string[]
  dias: DiaCalendario[] | undefined
  elegida: string
  alElegir: (fecha: string) => void
}) {
  return (
    <div role="tablist" aria-label="Día del viaje" className="carril gap-2 px-5">
      {fechas.map((fecha) => {
        const on = fecha === elegida
        const estado = estadoDia(dias?.find((d) => d.fecha === fecha) ?? (dias ? { fecha, precioMinimo: null, viajes: 0, hayCupo: null } : undefined))
        const sinSalidas = estado.tipo === 'sin-salidas'
        const [dia, num] = fechaCorta(fechaDesdeApi(fecha)).split(' ')
        return (
          <button
            key={fecha}
            type="button"
            role="tab"
            aria-selected={on}
            disabled={sinSalidas && !on}
            onClick={() => alElegir(fecha)}
            className={cn(
              'tap flex h-[72px] w-[84px] shrink-0 flex-col items-center justify-center rounded-2xl border-[1.5px] transition-[transform,background-color]',
              on ? 'border-tinta bg-tinta text-white' : 'border-linea bg-superficie text-tinta',
              !on && (estado.tipo === 'lleno' || sinSalidas) && 'opacity-60',
            )}
          >
            <span className="text-[12px] font-semibold">
              {dia} {num}
            </span>
            {estado.tipo === 'precio' && estado.precio != null ? (
              <>
                <span className={cn('text-[10px] leading-none', on ? 'text-tinta-texto-2' : 'text-texto-2')}>desde</span>
                <span className="num text-[13px] font-bold">{dinero(estado.precio)}</span>
              </>
            ) : (
              <span className={cn('num mt-0.5 text-[12px] font-bold', sinSalidas && 'font-semibold')}>
                {textoDia(estado)}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
