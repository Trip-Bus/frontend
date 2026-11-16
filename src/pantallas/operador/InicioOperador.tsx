import { useState } from 'react'
import { Link } from 'react-router'
import { CargarMas, Resultado } from '@/components/marca/Consulta'
import { PantallaGestion } from '@/components/marca/PantallaGestion'
import { Campo } from '@/components/ui/input'
import { hoy } from '@/features/busqueda'
import { useEmpresaActiva } from '@/features/empresa'
import { usePaginado } from '@/features/paginacion'
import { api } from '@/lib/endpoints'
import { dinero, fechaHora, porcentaje, sumarDias } from '@/lib/formato'
import type { PaginaViajesOperador, ViajeOperador } from '@/lib/tipos'
import { cn } from '@/lib/utils'

/**
 * O-01 Inicio del operador (US-191): viajes de hoy a 7 días con ocupación (vendidos, disponibles, bloqueados,
 * % y abandono de compra) y un resumen con la ocupación promedio y los viajes que van por debajo del 40 % a
 * 24 h de salir (candidatos a oferta). Si Seat Inventory no respondió, la ocupación dice "sin dato".
 */
export function InicioOperador() {
  const { companyId, esAdmin } = useEmpresaActiva()
  const [desde, setDesde] = useState(hoy())
  const [hasta, setHasta] = useState(sumarDias(hoy(), 7))
  const { consulta, elementos, total, primera } = usePaginado<ViajeOperador, PaginaViajesOperador>(
    ['operador-viajes', companyId ?? null, desde, hasta],
    (page) => api.operador.viajes({ desde, hasta, companyId: esAdmin ? companyId : undefined, page, size: 20 }),
    { refetchInterval: 60_000 },
  )
  const resumen = primera?.resumen

  return (
    <PantallaGestion titulo="Viajes de la semana" descripcion="Ocupación en vivo de tus próximas salidas." requiereEmpresa>
      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <Campo etiqueta="Desde" type="date" value={desde} onChange={(e) => e.target.value && setDesde(e.target.value)} />
        <Campo etiqueta="Hasta" type="date" value={hasta} min={desde} onChange={(e) => e.target.value && setHasta(e.target.value)} />
      </div>
      {resumen && (
        <section aria-label="Resumen" className="grid grid-cols-3 gap-2">
          <Dato titulo="Viajes" valor={resumen.viajes.toLocaleString('es-CO')} />
          <Dato titulo="Ocupación promedio" valor={porcentaje(resumen.ocupacionPromedio)} />
          <Dato titulo="Bajo 40 % a 24 h" valor={resumen.candidatosOferta.toLocaleString('es-CO')} alerta={resumen.candidatosOferta > 0} />
        </section>
      )}
      <Resultado consulta={consulta} hayDatos={elementos.length > 0} bloques={[110, 110, 110]} vacio="No hay viajes programados en esas fechas.">
        <ul className="grid gap-2.5 md:grid-cols-2">
          {elementos.map((v) => (
            <li key={v.itineraryId}>
              <TarjetaViajeOperador v={v} />
            </li>
          ))}
        </ul>
        <CargarMas hay={!!consulta.hasNextPage} cargando={consulta.isFetchingNextPage} alCargar={() => consulta.fetchNextPage()} mostrados={elementos.length} total={total} />
      </Resultado>
    </PantallaGestion>
  )
}

export function Dato({ titulo, valor, alerta = false }: { titulo: string; valor: string; alerta?: boolean }) {
  return (
    <div className={cn('flex flex-col gap-0.5 rounded-[18px] p-3', alerta ? 'bg-presencia text-alerta' : 'bg-superficie')}>
      <span className="text-[12px] leading-tight text-texto-2">{titulo}</span>
      <span className="num text-[20px] font-bold">{valor}</span>
    </div>
  )
}

function TarjetaViajeOperador({ v }: { v: ViajeOperador }) {
  const o = v.ocupacionConocida ? v.ocupacion : null
  return (
    <Link to={`/panel/viaje/${v.itineraryId}`} className="tap flex flex-col gap-2 rounded-tarjeta bg-superficie p-4">
      <span className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 flex-col">
          <span className="font-semibold [overflow-wrap:anywhere]">
            {v.origen} → {v.destino}
          </span>
          <span className="text-[13px] text-texto-2">
            {fechaHora(v.fechaSalida)} · bus <span className="num">{v.placa}</span> · {v.tipoBus === 'DOS_PISOS' ? 'dos pisos' : 'un piso'}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className={cn('rounded-md px-1.5 text-[12px] font-bold', v.estado === 'CANCELADO' ? 'bg-presencia text-alerta' : 'bg-linea')}>{v.estado === 'CANCELADO' ? 'Cancelado' : 'Programado'}</span>
          {v.ofertaActiva && <span className="rounded-md bg-naranja px-1.5 text-[12px] font-bold text-tinta">Oferta {dinero(v.ofertaActiva.precioOferta)}</span>}
        </span>
      </span>
      {o ? (
        <>
          <span aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-linea">
            <span className="block h-full rounded-full bg-tinta" style={{ width: `${Math.min(100, Math.max(0, o.porcentaje))}%` }} />
          </span>
          <span className="text-[13px] text-texto-2">
            {porcentaje(o.porcentaje)} · {o.vendidos} vendidos · {o.disponibles} disponibles · {o.bloqueados} bloqueados · abandono {porcentaje(o.tasaAbandono)}
          </span>
        </>
      ) : (
        <span className="text-[13px] text-texto-2">Ocupación: sin dato</span>
      )}
    </Link>
  )
}
