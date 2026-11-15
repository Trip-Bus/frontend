import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Segmentos, Selector } from '@/components/ui/campos'
import { Hoja } from '@/components/ui/hoja'
import { Campo } from '@/components/ui/input'
import { api } from '@/lib/endpoints'
import type { Filtros } from '@/features/busqueda'
import type { Franja } from '@/lib/tipos'

const ORDENES = [
  { valor: 'salida-asc', texto: 'Salida más temprana' },
  { valor: 'salida-desc', texto: 'Salida más tarde' },
  { valor: 'precio-asc', texto: 'Más barato' },
  { valor: 'precio-desc', texto: 'Más caro' },
  { valor: 'duracion-asc', texto: 'Más rápido' },
]

/** P-01: empresa, franja del día, rango de precio, tipo de bus y orden. */
export function HojaFiltros({
  abierta,
  alCerrar,
  filtros,
  alAplicar,
  busqueda,
}: {
  abierta: boolean
  alCerrar: () => void
  filtros: Filtros
  alAplicar: (f: Filtros) => void
  busqueda: { origen: string; destino: string; fecha: string }
}) {
  const [borrador, setBorrador] = useState<Filtros>(filtros)
  const empresas = useQuery({
    queryKey: ['empresas-busqueda', busqueda.origen, busqueda.destino, busqueda.fecha],
    queryFn: () => api.catalogo.empresasDeBusqueda(busqueda.origen, busqueda.destino, busqueda.fecha),
    enabled: abierta,
    staleTime: 60_000,
  })
  const cambiar = (parcial: Partial<Filtros>) => setBorrador((b) => ({ ...b, ...parcial }))
  const numero = (v: string) => (v.replace(/\D/g, '') ? Number(v.replace(/\D/g, '')) : undefined)

  return (
    <Hoja abierta={abierta} alCambiar={(a) => !a && alCerrar()} titulo="Filtrar salidas">
      <div className="flex flex-col gap-3 pb-3">
        <Selector
          etiqueta="Empresa"
          vacia="Todas las empresas"
          value={borrador.companyId ?? ''}
          onChange={(e) => cambiar({ companyId: e.target.value || undefined })}
          opciones={(empresas.data ?? []).map((e) => ({ valor: e.id, texto: e.nombre }))}
        />
        <Segmentos<'' | Franja>
          etiqueta="Hora del día"
          valor={borrador.franja ?? ''}
          alCambiar={(v) => cambiar({ franja: v || undefined })}
          opciones={[
            { valor: '', texto: 'Todo el día' },
            { valor: 'MANANA', texto: 'Mañana' },
            { valor: 'TARDE', texto: 'Tarde' },
            { valor: 'NOCHE', texto: 'Noche' },
          ]}
        />
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Precio mínimo" inputMode="numeric" value={borrador.precioMin ?? ''} onChange={(e) => cambiar({ precioMin: numero(e.target.value) })} />
          <Campo etiqueta="Precio máximo" inputMode="numeric" value={borrador.precioMax ?? ''} onChange={(e) => cambiar({ precioMax: numero(e.target.value) })} />
        </div>
        <Selector
          etiqueta="Tipo de bus"
          vacia="Cualquiera"
          value={borrador.tipoBus ?? ''}
          onChange={(e) => cambiar({ tipoBus: e.target.value || undefined })}
          opciones={[
            { valor: 'UN_PISO', texto: 'Un piso' },
            { valor: 'DOS_PISOS', texto: 'Dos pisos' },
          ]}
        />
        <Selector
          etiqueta="Ordenar por"
          value={`${borrador.sort ?? 'salida'}-${borrador.order ?? 'asc'}`}
          onChange={(e) => {
            const [sort, order] = e.target.value.split('-') as [Filtros['sort'], Filtros['order']]
            cambiar({ sort, order })
          }}
          opciones={ORDENES}
        />
        <Button
          ancho="completo"
          onClick={() => {
            alAplicar(borrador)
            alCerrar()
          }}
        >
          Ver salidas
        </Button>
        <Button
          variante="fantasma"
          ancho="completo"
          onClick={() => {
            const limpio: Filtros = { sort: borrador.sort, order: borrador.order }
            setBorrador(limpio)
            alAplicar(limpio)
            alCerrar()
          }}
        >
          Quitar filtros
        </Button>
      </div>
    </Hoja>
  )
}
