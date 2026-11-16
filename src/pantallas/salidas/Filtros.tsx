import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Segmentos, Selector } from '@/components/ui/campos'
import { Hoja } from '@/components/ui/hoja'
import type { Filtros } from '@/features/busqueda'
import { consultaFacetas, filtroDeRango, limitesDe, nombreTipoBus, rangoElegido, recortarPrecio } from '@/features/precios'
import { dinero } from '@/lib/formato'
import type { FacetasBusqueda, Franja } from '@/lib/tipos'
import { ListaEmpresas } from './ListaEmpresas'
import { RangoPrecio } from './RangoPrecio'

const ORDENES = [
  { valor: 'salida-asc', texto: 'Salida más temprana' },
  { valor: 'salida-desc', texto: 'Salida más tarde' },
  { valor: 'precio-asc', texto: 'Más barato' },
  { valor: 'precio-desc', texto: 'Más caro' },
  { valor: 'duracion-asc', texto: 'Más rápido' },
]

/**
 * P-01: empresa (lista con buscador de /trips/search/facets), franja del día, rango de precio con los límites de ese
 * día y esa ruta, tipo de bus y orden. Las facetas se recalculan con la empresa, la franja y el tipo de bus elegidos.
 */
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
  const facetas = useQuery({ ...consultaFacetas(busqueda, borrador), enabled: abierta, placeholderData: keepPreviousData })
  const cambiar = (parcial: Partial<Filtros>) => setBorrador((b) => ({ ...b, ...parcial }))
  const tipos = [...(facetas.data?.tiposBus ?? [])]
  if (borrador.tipoBus && !tipos.includes(borrador.tipoBus)) tipos.push(borrador.tipoBus)

  return (
    <Hoja abierta={abierta} alCambiar={(a) => !a && alCerrar()} titulo="Filtrar salidas">
      <div className="flex flex-col gap-4 pb-3">
        <ListaEmpresas
          empresas={facetas.data?.empresas ?? []}
          origen={busqueda.origen}
          valor={borrador.companyId}
          alCambiar={(companyId) => cambiar({ companyId })}
          cargando={facetas.isPending}
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
        <ControlPrecio facetas={facetas.data} cargando={facetas.isPending} filtros={borrador} alCambiar={cambiar} />
        <Selector
          etiqueta="Tipo de bus"
          vacia="Cualquiera"
          value={borrador.tipoBus ?? ''}
          onChange={(e) => cambiar({ tipoBus: e.target.value || undefined })}
          opciones={tipos.map((t) => ({ valor: t, texto: nombreTipoBus(t) }))}
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
            alAplicar(recortarPrecio(borrador, facetas.isPlaceholderData ? undefined : facetas.data))
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

/** Barra de precio con los límites de las facetas; un solo precio sin barra; sin viajes, nada. */
function ControlPrecio({
  facetas,
  cargando,
  filtros,
  alCambiar,
}: {
  facetas: FacetasBusqueda | undefined
  cargando: boolean
  filtros: Filtros
  alCambiar: (f: Partial<Filtros>) => void
}) {
  if (cargando && !facetas) {
    return (
      <div aria-busy="true" aria-label="Cargando precios" className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold">Precio</span>
        <div className="h-11 rounded-control bg-muted" />
      </div>
    )
  }
  const limites = limitesDe(facetas)
  if (!limites) return null
  if (limites.min === limites.max) {
    return (
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-semibold">Precio</span>
        <span className="text-[14px] text-texto-2">
          Un solo precio este día: <strong className="num text-tinta">{dinero(limites.min)}</strong>
        </span>
      </div>
    )
  }
  return <RangoPrecio limites={limites} valor={rangoElegido(filtros, limites)} alCambiar={(r) => alCambiar(filtroDeRango(r, limites))} />
}
