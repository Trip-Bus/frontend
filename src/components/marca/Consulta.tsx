import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { textoError } from '@/lib/api'
import { Aviso, Esqueleto } from './Estados'

type EstadoConsulta = {
  isPending: boolean
  isError: boolean
  error: unknown
  refetch: () => unknown
}

/**
 * Los tres estados de siempre dentro de una pantalla: carga (bloques grises), error (con "Intentar de nuevo")
 * y vacío (un aviso que dice qué hacer). Si hay datos, pinta `children`.
 */
export function Resultado({
  consulta,
  vacio,
  hayDatos,
  bloques = [96, 96],
  children,
}: {
  consulta: EstadoConsulta
  /** Texto del estado vacío. */
  vacio: ReactNode
  hayDatos: boolean
  bloques?: number[]
  children: ReactNode
}) {
  if (consulta.isPending) return <Esqueleto className="px-0 pt-0" bloques={bloques} />
  if (consulta.isError) {
    return (
      <div className="flex flex-col gap-2">
        <Aviso tono="alerta">{textoError(consulta.error)}</Aviso>
        <Button variante="contorno" tamano="md" className="self-start" onClick={() => void consulta.refetch()}>
          Intentar de nuevo
        </Button>
      </div>
    )
  }
  if (!hayDatos) return <Aviso>{vacio}</Aviso>
  return <>{children}</>
}

/** Botón "Cargar más" de los listados paginados (T-05). */
export function CargarMas({
  hay,
  cargando,
  alCargar,
  mostrados,
  total,
}: {
  hay: boolean
  cargando: boolean
  alCargar: () => unknown
  mostrados: number
  total: number
}) {
  return (
    <div className="flex flex-col items-center gap-2 pt-1">
      <span className="text-[13px] text-texto-2">
        {mostrados.toLocaleString('es-CO')} de {total.toLocaleString('es-CO')}
      </span>
      {hay && (
        <Button variante="contorno" tamano="md" disabled={cargando} onClick={() => void alCargar()}>
          {cargando ? 'Cargando…' : 'Cargar más'}
        </Button>
      )}
    </div>
  )
}
