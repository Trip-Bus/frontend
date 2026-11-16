import { Search } from 'lucide-react'
import { useId, useState } from 'react'
import { agruparEmpresas, OTRAS_TERMINALES } from '@/features/precios'
import { Campo } from '@/components/ui/input'
import { plural } from '@/lib/formato'
import type { EmpresaFaceta, Uuid } from '@/lib/tipos'
import { cn } from '@/lib/utils'

/**
 * Empresas de /trips/search/facets con buscador. Desde Bogotá van agrupadas por terminal de salida (Salitre, del
 * Norte, "Otras"). Cada una dice cuántas salidas tiene ese día; las que no tienen quedan deshabilitadas.
 */
export function ListaEmpresas({
  empresas,
  origen,
  valor,
  alCambiar,
  cargando = false,
}: {
  empresas: EmpresaFaceta[]
  origen: string
  valor: Uuid | undefined
  alCambiar: (id: Uuid | undefined) => void
  cargando?: boolean
}) {
  const [texto, setTexto] = useState('')
  const nombre = useId()
  const grupos = agruparEmpresas(empresas, origen, texto)

  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-1.5 text-[13px] font-semibold">Empresa</legend>
      {empresas.length > 0 && (
        <Campo
          etiqueta={<span className="sr-only">Buscar empresa</span>}
          type="search"
          placeholder="Buscar empresa"
          autoComplete="off"
          enterKeyHint="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          accion={<Search aria-hidden="true" className="mr-3 size-4 text-texto-2" />}
        />
      )}
      <div className="scroll-hoja flex max-h-[min(44dvh,340px)] flex-col gap-1 rounded-control border-[1.5px] border-linea p-1.5">
        <Opcion nombre={nombre} marcada={valor == null} alElegir={() => alCambiar(undefined)} titulo="Todas las empresas" />
        {cargando && empresas.length === 0 ? (
          <div aria-busy="true" aria-label="Cargando empresas" className="flex flex-col gap-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 rounded-[11px] bg-muted" />
            ))}
          </div>
        ) : grupos.length === 0 ? (
          <p className="px-2.5 py-3 text-[14px] text-texto-2">
            {texto.trim() ? `Ninguna empresa coincide con “${texto.trim()}”.` : 'No hay empresas en esta ruta.'}
          </p>
        ) : (
          grupos.map((g) => (
            <div key={g.terminal ?? 'todas'} role={g.terminal ? 'group' : undefined} aria-label={g.terminal ?? undefined} className="flex flex-col gap-1">
              {g.terminal && (
                <p aria-hidden="true" className="px-2.5 pt-2 pb-0.5 text-[12px] font-semibold tracking-[0.04em] text-texto-2 uppercase">
                  {g.terminal === OTRAS_TERMINALES ? 'Otras' : g.terminal}
                </p>
              )}
              {g.empresas.map((e) => (
                <Opcion
                  key={e.id}
                  nombre={nombre}
                  marcada={valor === e.id}
                  deshabilitada={e.viajes === 0}
                  alElegir={() => alCambiar(e.id)}
                  titulo={e.nombre}
                  detalle={e.viajes === 0 ? 'sin salidas este día' : plural(e.viajes, 'salida', 'salidas')}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </fieldset>
  )
}

function Opcion({
  nombre,
  titulo,
  detalle,
  marcada,
  deshabilitada = false,
  alElegir,
}: {
  nombre: string
  titulo: string
  detalle?: string
  marcada: boolean
  deshabilitada?: boolean
  alElegir: () => void
}) {
  return (
    <label
      className={cn(
        'flex min-h-12 items-center gap-3 rounded-[11px] px-2.5 py-2 text-[15px]',
        marcada && 'bg-muted',
        deshabilitada ? 'text-texto-2' : 'cursor-pointer',
      )}
    >
      <input type="radio" name={nombre} checked={marcada} disabled={deshabilitada} onChange={alElegir} className="size-5 shrink-0 accent-tinta" />
      <span className="min-w-0 flex-1 truncate font-semibold" title={titulo}>
        {titulo}
      </span>
      {detalle && <span className="shrink-0 text-[13px] text-texto-2">{detalle}</span>}
    </label>
  )
}
