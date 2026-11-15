import { useQuery } from '@tanstack/react-query'
import { Aviso } from '@/components/marca/Estados'
import { textoError } from '@/lib/api'
import { api } from '@/lib/endpoints'
import { dinero, horaCorta } from '@/lib/formato'
import type { TipoPasajero, Uuid } from '@/lib/tipos'

const NOMBRE_TIPO: Record<TipoPasajero, string> = { ADULTO: 'Adulto', NINO: 'Niño', ADULTO_MAYOR: 'Adulto mayor' }

type Props = { itineraryId: Uuid; tramo: { from?: number | null; to?: number | null }; tipos: TipoPasajero[]; deOferta: boolean }

/** GET /itineraries/{id}/price con el tramo y los tipos de pasajero (la oferta relámpago tiene precio fijo). */
function usePrecio({ itineraryId, tramo, tipos, deOferta }: Props) {
  return useQuery({
    queryKey: ['precio', itineraryId, tramo.from ?? null, tramo.to ?? null, tipos.join(',')],
    queryFn: () => api.catalogo.precio(itineraryId, tramo, tipos),
    enabled: !deOferta && tipos.length > 0,
    staleTime: 60_000,
  })
}

/** Desglose antes de pagar: tramo, temporada, descuento por tipo y recargo del asiento (US-138/141/142). */
export function Desglose(props: Props) {
  const precio = usePrecio(props)
  if (props.deOferta) return null
  if (precio.isPending) return <div aria-busy="true" aria-label="Calculando el precio" className="h-24 rounded-tarjeta bg-superficie" />
  if (precio.isError) return <Aviso tono="alerta">{textoError(precio.error, 'No pudimos calcular el desglose.')} El total final se confirma al pagar.</Aviso>
  const d = precio.data.desglose
  if (!d) return null
  const esTramo = props.tramo.from != null && props.tramo.to != null
  return (
    <section aria-label="Desglose del precio" className="flex flex-col gap-2 rounded-tarjeta bg-superficie p-4 text-[14px]">
      <h2 className="text-[15px] font-semibold">Así se calcula tu pasaje</h2>
      {esTramo && (
        <p className="text-texto-2">
          Tramo {d.origen} → {d.destino} · sube a las <span className="num">{horaCorta(d.salida)}</span>
        </p>
      )}
      <dl className="flex flex-col gap-1">
        <Fila nombre={esTramo ? 'Precio del tramo' : 'Precio base'} valor={dinero(d.precioTramo)} />
        {d.temporada && <Fila nombre={`Temporada ${d.temporada.nombre}`} valor={`× ${d.temporada.multiplicador.toLocaleString('es-CO')}`} />}
      </dl>
      <ul className="flex flex-col gap-1.5 border-t border-linea pt-2">
        {d.pasajeros.map((p, i) => (
          <li key={`${p.tipo}-${i}`} className="flex flex-col">
            <span className="flex justify-between gap-2 font-semibold">
              <span>
                Pasajero {i + 1} · {NOMBRE_TIPO[p.tipo] ?? p.tipo}
              </span>
              <span className="num">{dinero(p.precio)}</span>
            </span>
            {(p.descuentoPorcentaje > 0 || (p.recargoCategoria ?? 0) > 0) && (
              <span className="text-[13px] text-texto-2">
                {p.descuentoPorcentaje > 0 ? `Descuento ${p.descuentoPorcentaje.toLocaleString('es-CO')} %` : ''}
                {p.descuentoPorcentaje > 0 && (p.recargoCategoria ?? 0) > 0 ? ' · ' : ''}
                {(p.recargoCategoria ?? 0) > 0 ? `Recargo de asiento ${p.seatCategoria ?? ''} ${dinero(p.recargoCategoria)}` : ''}
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="text-[13px] text-texto-2">El cupón, si escribiste uno, se descuenta al confirmar la reserva.</p>
    </section>
  )
}

/** Total del pie de página: el del desglose si ya llegó; si no, el precio del viaje por los puestos. */
export function TotalReserva({ respaldo, ...props }: Props & { respaldo: number | null }) {
  const precio = usePrecio(props)
  const total = !props.deOferta && precio.data?.desglose ? precio.data.desglose.total : respaldo
  return <span className="num text-[26px] font-bold">{dinero(total)}</span>
}

function Fila({ nombre, valor }: { nombre: string; valor: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-texto-2">{nombre}</dt>
      <dd className="num font-semibold">{valor}</dd>
    </div>
  )
}
