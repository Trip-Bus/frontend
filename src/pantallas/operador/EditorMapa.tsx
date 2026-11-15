import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Resultado } from '@/components/marca/Consulta'
import { Button } from '@/components/ui/button'
import { Selector } from '@/components/ui/campos'
import { Campo } from '@/components/ui/input'
import { celdaEn, numerar, pintar, redimensionar, TIPOS_CELDA, type Herramienta } from '@/features/editorMapa'
import { useAccion } from '@/hooks/useAccion'
import { api } from '@/lib/endpoints'
import type { Bus, CategoriaAsiento, Distribucion, TipoCelda } from '@/lib/tipos'
import { cn } from '@/lib/utils'

const ESTILO: Record<TipoCelda, string> = {
  ASIENTO: 'bg-superficie border-2 border-libre-borde',
  PASILLO: 'bg-transparent',
  BANO: 'bg-[#cfe3f5]',
  CONDUCTOR: 'bg-tinta text-white',
  ESCALERA: 'bg-[#e7d9b8]',
  PUERTA: 'bg-[#d6e8d0]',
  VACIO: 'bg-transparent border border-dashed border-linea',
}
const CATEGORIA: Record<CategoriaAsiento, string> = { ESTANDAR: '', PREFERENCIAL: 'ring-2 ring-naranja', PREMIUM: 'ring-2 ring-tinta' }

/**
 * Editor visual del mapa del bus (US-111/US-141): elegir qué pintar (tipo de celda y categoría del asiento) y
 * tocar las celdas. Al guardar se numeran los asientos nuevos; los existentes conservan su número.
 */
export function EditorMapa({ bus, alTerminar }: { bus: Bus; alTerminar: () => void }) {
  const mapa = useQuery({ queryKey: ['mapa-bus', bus.id], queryFn: () => api.buses.mapa(bus.id) })
  return (
    <Resultado consulta={mapa} hayDatos={!!mapa.data} vacio="Este bus no tiene mapa." bloques={[300]}>
      {mapa.data && <Lienzo bus={bus} inicial={mapa.data} alTerminar={alTerminar} />}
    </Resultado>
  )
}

function Lienzo({ bus, inicial, alTerminar }: { bus: Bus; inicial: Distribucion; alTerminar: () => void }) {
  const [d, setD] = useState(inicial)
  const [pisoActivo, setPisoActivo] = useState(0)
  const [h, setH] = useState<Herramienta>({ tipo: 'ASIENTO', categoria: 'ESTANDAR' })
  const guardar = useAccion(() => api.buses.guardarMapa(bus.id, numerar(d)), { exito: 'Guardamos el mapa del bus.', invalidar: [['mapa-bus', bus.id], ['buses']], alTerminar })
  const piso = d.pisos[pisoActivo]
  const asientos = numerar(d).capacidad

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Selector etiqueta="Pintar" value={h.tipo} onChange={(e) => setH((x) => ({ ...x, tipo: e.target.value as TipoCelda }))} opciones={TIPOS_CELDA} />
        <Selector
          etiqueta="Categoría del asiento"
          value={h.categoria ?? 'ESTANDAR'}
          disabled={h.tipo !== 'ASIENTO'}
          onChange={(e) => setH((x) => ({ ...x, categoria: e.target.value as CategoriaAsiento }))}
          opciones={[
            { valor: 'ESTANDAR', texto: 'Estándar' },
            { valor: 'PREFERENCIAL', texto: 'Preferencial' },
            { valor: 'PREMIUM', texto: 'Premium' },
          ]}
        />
      </div>
      {d.pisos.length > 1 && (
        <Selector etiqueta="Piso" value={String(pisoActivo)} onChange={(e) => setPisoActivo(Number(e.target.value))} opciones={d.pisos.map((p, i) => ({ valor: String(i), texto: `Piso ${p.piso}` }))} />
      )}
      {piso && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Filas" type="number" min={1} max={30} value={piso.filas} onChange={(e) => setD((x) => redimensionar(x, pisoActivo, Number(e.target.value), piso.columnas))} />
            <Campo etiqueta="Columnas" type="number" min={1} max={8} value={piso.columnas} onChange={(e) => setD((x) => redimensionar(x, pisoActivo, piso.filas, Number(e.target.value)))} />
          </div>
          <div role="grid" aria-label={`Piso ${piso.piso}`} className="mx-auto grid gap-1.5" style={{ gridTemplateColumns: `repeat(${piso.columnas}, 40px)` }}>
            {Array.from({ length: piso.filas * piso.columnas }, (_, k) => {
              const fila = Math.floor(k / piso.columnas) + 1
              const columna = (k % piso.columnas) + 1
              const c = celdaEn(piso, fila, columna)
              const tipo = c?.tipo ?? 'VACIO'
              return (
                <button
                  key={`${fila}-${columna}`}
                  type="button"
                  role="gridcell"
                  aria-label={`Fila ${fila}, columna ${columna}: ${TIPOS_CELDA.find((t) => t.valor === tipo)?.texto}${c?.asiento ? ` ${c.asiento}` : ''}`}
                  onClick={() => setD((x) => pintar(x, pisoActivo, fila, columna, h))}
                  className={cn('num flex size-10 items-center justify-center rounded-[8px] text-[12px] font-bold', ESTILO[tipo], c?.categoria && CATEGORIA[c.categoria])}
                >
                  {c?.asiento ?? ''}
                </button>
              )
            })}
          </div>
        </>
      )}
      <p className="text-[13px] text-texto-2">
        {asientos} asientos. {bus.tipo === 'DOS_PISOS' ? 'Bus de dos pisos.' : 'Bus de un piso.'} Si el bus tiene viajes programados no se puede cambiar el mapa.
      </p>
      <Button disabled={guardar.isPending || asientos === 0} onClick={() => guardar.mutate(undefined)}>
        {guardar.isPending ? 'Guardando…' : 'Guardar el mapa'}
      </Button>
    </div>
  )
}
