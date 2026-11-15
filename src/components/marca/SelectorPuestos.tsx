import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { construirPisos, type Puesto } from '@/features/mapaAsientos'
import { textoError } from '@/lib/api'
import { api } from '@/lib/endpoints'
import { plural } from '@/lib/formato'
import type { Uuid } from '@/lib/tipos'
import { cn } from '@/lib/utils'
import { Aviso, Esqueleto } from './Estados'
import { LeyendaPuestos, PisoBus } from './MapaBus'

/**
 * Mapa real del bus para elegir hasta `maximo` puestos libres (reprogramar, cambiar de puesto, taquilla).
 * Con un solo puesto, tocar otro lo reemplaza.
 */
export function SelectorPuestos({
  itineraryId,
  maximo,
  elegidos,
  alCambiar,
  propios = [],
}: {
  itineraryId: Uuid
  maximo: number
  elegidos: string[]
  alCambiar: (asientos: string[]) => void
  /** Puestos que ya son de la persona (se muestran como suyos). */
  propios?: string[]
}) {
  const [pisoActivo, setPisoActivo] = useState(0)
  const mapa = useQuery({ queryKey: ['mapa', itineraryId], queryFn: () => api.catalogo.mapa(itineraryId), staleTime: Infinity })
  const estados = useQuery({ queryKey: ['asientos', itineraryId, 'selector'], queryFn: () => api.asientos.estados(itineraryId), refetchInterval: 10_000 })
  const clavePropios = propios.join(',')
  const pisos = useMemo(
    () => (mapa.data ? construirPisos(mapa.data, estados.data, new Set(clavePropios ? clavePropios.split(',') : [])) : []),
    [mapa.data, estados.data, clavePropios],
  )

  if (mapa.isError || estados.isError) return <Aviso tono="alerta">{textoError(mapa.error ?? estados.error, 'No pudimos abrir el mapa del bus.')}</Aviso>
  const piso = pisos[Math.min(pisoActivo, Math.max(0, pisos.length - 1))]
  if (!piso || estados.isPending) return <Esqueleto className="px-0 pt-0" bloques={[360]} />

  const tocar = (p: Puesto) => {
    if (elegidos.includes(p.numero)) alCambiar(elegidos.filter((n) => n !== p.numero))
    else if (maximo === 1) alCambiar([p.numero])
    else if (elegidos.length < maximo) alCambiar([...elegidos, p.numero])
  }

  return (
    <div className="flex flex-col gap-3">
      <LeyendaPuestos />
      {pisos.length > 1 && (
        <div role="tablist" aria-label="Piso" className="grid grid-cols-2 gap-1.5 rounded-control bg-[#e7eae2] p-1">
          {pisos.map((p, i) => (
            <button
              key={p.piso}
              type="button"
              role="tab"
              aria-selected={i === pisoActivo}
              onClick={() => setPisoActivo(i)}
              className={cn('h-10 rounded-[11px] text-[14px] font-semibold', i === pisoActivo ? 'bg-superficie' : 'text-texto-2')}
            >
              Piso {p.piso} <span className="font-normal">· {plural(p.libres, 'libre', 'libres')}</span>
            </button>
          ))}
        </div>
      )}
      <PisoBus piso={piso} marcados={new Set(elegidos)} alTocar={tocar} />
      <p role="status" className="text-center text-[14px] text-texto-2">
        {elegidos.length === 0 ? `Elige ${plural(maximo, 'puesto libre', 'puestos libres')}` : `Elegiste ${elegidos.join(', ')} (${elegidos.length} de ${maximo})`}
      </p>
    </div>
  )
}
