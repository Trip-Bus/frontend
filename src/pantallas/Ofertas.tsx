import { useQueryClient } from '@tanstack/react-query'
import { Zap } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { BarraInferior } from '@/components/marca/BarraInferior'
import { CargarMas, Resultado } from '@/components/marca/Consulta'
import { Encabezado } from '@/components/marca/Encabezado'
import { EstadoVivo } from '@/components/marca/EstadoVivo'
import { Pantalla } from '@/components/marca/Pantalla'
import { Button } from '@/components/ui/button'
import { Campo } from '@/components/ui/input'
import { usePaginado } from '@/features/paginacion'
import { useAcento } from '@/hooks/useAcento'
import { useAhora } from '@/hooks/useAhora'
import { api } from '@/lib/endpoints'
import { dinero, fechaHora, reloj } from '@/lib/formato'
import { topicos, useTopico } from '@/lib/tiempoReal'
import type { OfertaVitrina } from '@/lib/tipos'
import { cn } from '@/lib/utils'

/**
 * P-10 Vitrina de ofertas (US-160): activas y próximas 48 h, con descuento, cupo y cuenta regresiva. Se
 * actualiza sola con `ofertas:activas` (cada evento vuelve a pedir la página; el gateway limita el ritmo).
 */
export function Ofertas() {
  useAcento(null)
  const queryClient = useQueryClient()
  const ahora = useAhora()
  const [filtro, setFiltro] = useState({ origen: '', destino: '' })
  const [borrador, setBorrador] = useState(filtro)

  const { consulta, elementos, total } = usePaginado<OfertaVitrina>(['vitrina', filtro.origen, filtro.destino], (page) =>
    api.ofertas.vitrina({ origin: filtro.origen || undefined, destination: filtro.destino || undefined, page, size: 10 }),
  )
  useTopico(topicos.ofertasActivas(), (m) => {
    if (m.type === 'event') void queryClient.invalidateQueries({ queryKey: ['vitrina'] })
  })

  const buscar = (e: FormEvent) => {
    e.preventDefault()
    setFiltro({ origen: borrador.origen.trim(), destino: borrador.destino.trim() })
  }

  return (
    <Pantalla className="pb-0">
      <Encabezado titulo="Ofertas" volverA="/inicio">
        Puestos con descuento que salen en las próximas 48 horas. Duran pocos minutos.
      </Encabezado>
      <div className="flex flex-1 flex-col gap-4 px-5 pt-4">
        <div className="flex justify-end">
          <EstadoVivo />
        </div>
        <form onSubmit={buscar} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2" noValidate>
          <Campo etiqueta="Desde" value={borrador.origen} onChange={(e) => setBorrador((b) => ({ ...b, origen: e.target.value }))} placeholder="Cualquiera" />
          <Campo etiqueta="Hacia" value={borrador.destino} onChange={(e) => setBorrador((b) => ({ ...b, destino: e.target.value }))} placeholder="Cualquiera" />
          <Button type="submit" tamano="md" className="h-13">
            Filtrar
          </Button>
        </form>
        <Resultado consulta={consulta} hayDatos={elementos.length > 0} bloques={[120, 120]} vacio="No hay ofertas para esa ruta en las próximas 48 horas.">
          <ul className="flex flex-col gap-2.5">
            {elementos.map((o) => (
              <li key={o.offerId}>
                <TarjetaOferta o={o} ahora={ahora} cargadaEn={consulta.dataUpdatedAt} />
              </li>
            ))}
          </ul>
          <CargarMas hay={!!consulta.hasNextPage} cargando={consulta.isFetchingNextPage} alCargar={() => consulta.fetchNextPage()} mostrados={elementos.length} total={total} />
        </Resultado>
      </div>
      <BarraInferior activa="viajar" />
    </Pantalla>
  )
}

function TarjetaOferta({ o, ahora, cargadaEn }: { o: OfertaVitrina; ahora: number; cargadaEn: number }) {
  const activa = o.estado === 'ACTIVA'
  const hasta = new Date(activa ? o.fin : o.inicio).getTime()
  const segundos = Math.max(0, Math.floor((hasta - Math.max(ahora, cargadaEn)) / 1000))
  return (
    <Link to={`/drop/${o.offerId}`} className={cn('tap flex flex-col gap-2 rounded-tarjeta p-4', activa ? 'bg-tinta text-white' : 'bg-superficie')}>
      <span className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 flex-col">
          <span className="text-[17px] font-bold [overflow-wrap:anywhere]">
            {o.origen} → {o.destino}
          </span>
          <span className={cn('text-[13px]', activa ? 'text-tinta-texto-2' : 'text-texto-2')}>
            {o.empresa} · sale {fechaHora(o.fechaSalida)}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 rounded-lg bg-naranja px-2 py-0.5 text-[13px] font-extrabold text-tinta">
          <Zap className="size-3.5" aria-hidden="true" />−{Math.round(o.descuentoPorcentaje)}%
        </span>
      </span>
      <span className="flex items-end justify-between gap-3">
        <span className="flex flex-col">
          <span className={cn('text-[12px]', activa ? 'text-tinta-texto-2' : 'text-texto-2')}>{activa ? 'Termina en' : 'Empieza en'}</span>
          <span role="timer" className="num text-[24px] leading-none font-bold">
            {reloj(segundos)}
          </span>
        </span>
        <span className="flex flex-col items-end">
          <span className={cn('num text-[13px] line-through', activa ? 'text-tinta-texto-2' : 'text-texto-2')}>{dinero(o.precioBase)}</span>
          <span className={cn('num text-[22px] leading-none font-bold', activa && 'text-acento')}>{dinero(o.precioOferta)}</span>
          <span className="mt-1 text-[12px] font-semibold">{o.cupoRestante === 1 ? 'Queda 1 puesto' : `Quedan ${o.cupoRestante} puestos`}</span>
        </span>
      </span>
    </Link>
  )
}
