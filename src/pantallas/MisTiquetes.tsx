import { useQueries, useQuery } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { BarraInferior } from '@/components/marca/BarraInferior'
import { Aviso, Esqueleto } from '@/components/marca/Estados'
import { Pantalla } from '@/components/marca/Pantalla'
import { buttonVariants } from '@/components/ui/button-variants'
import { pasesGuardados } from '@/features/pases'
import { useAcento } from '@/hooks/useAcento'
import { useAhora } from '@/hooks/useAhora'
import { textoError } from '@/lib/api'
import { codigoCiudad } from '@/lib/ciudades'
import { api } from '@/lib/endpoints'
import { dinero, fechaCorta, horaCorta, reloj } from '@/lib/formato'
import type { DetalleItinerario, Reserva } from '@/lib/tipos'
import { cn } from '@/lib/utils'

type Grupo = 'pagar' | 'proceso' | 'proximos' | 'anteriores'

function grupoDe(r: Reserva, d: DetalleItinerario | undefined, ahora: number): Grupo {
  if (r.estado === 'PENDIENTE_PAGO') return new Date(r.holdExpiraEn).getTime() > ahora ? 'pagar' : 'anteriores'
  if (r.estado === 'PAGO_EN_PROCESO' || r.estado === 'PAGO_APROBADO') return 'proceso'
  if (r.estado === 'CONFIRMADA') {
    const fin = d ? new Date(d.fechaLlegadaEstimada).getTime() : Infinity
    return fin > ahora && d?.estado !== 'CANCELADO' ? 'proximos' : 'anteriores'
  }
  return 'anteriores'
}

const ESTADO_TEXTO: Record<string, string> = {
  PAGO_RECHAZADO: 'Pago rechazado',
  EXPIRADA: 'Venció sin pagar',
  REEMBOLSADA: 'Reembolsada',
  PENDIENTE_PAGO: 'Venció sin pagar',
  CONFIRMADA: 'Viajaste',
}

/** Mis tiquetes (US-033): próximos viajes con su pase, pagos pendientes y el historial. */
export function MisTiquetes() {
  useAcento(null)
  const ahora = useAhora(15_000)
  const reservas = useQuery({ queryKey: ['reservas'], queryFn: api.reservas.mias, refetchInterval: 30_000 })
  const lista = [...(reservas.data ?? [])].sort((a, b) => b.creadoEn.localeCompare(a.creadoEn))
  const ids = [...new Set(lista.map((r) => r.itineraryId))]
  const detalles = useQueries({
    queries: ids.map((id) => ({ queryKey: ['itinerario', id], queryFn: () => api.catalogo.itinerario(id), staleTime: 5 * 60_000 })),
  })
  const porId = new Map(ids.map((id, i) => [id, detalles[i]?.data]))

  const grupos: Record<Grupo, Reserva[]> = { pagar: [], proceso: [], proximos: [], anteriores: [] }
  lista.forEach((r) => grupos[grupoDe(r, porId.get(r.itineraryId), ahora)].push(r))
  grupos.proximos.sort((a, b) => (porId.get(a.itineraryId)?.fechaSalida ?? '').localeCompare(porId.get(b.itineraryId)?.fechaSalida ?? ''))

  return (
    <Pantalla className="pb-0">
      <header className="px-5">
        <h1 className="font-display text-[28px] font-bold tracking-[-0.02em]">Tus tiquetes</h1>
      </header>

      <div className="flex flex-1 flex-col gap-5 px-5 pt-4">
        {reservas.isPending ? (
          <Esqueleto className="px-0 pt-0" bloques={[132, 132]} />
        ) : reservas.isError ? (
          <SinConexion error={reservas.error} />
        ) : lista.length === 0 ? (
          <section className="flex flex-col items-center gap-3.5 px-2 pt-10 text-center">
            <h2 className="font-display text-[22px] font-bold">Aún no tienes viajes</h2>
            <p className="text-[15px] text-texto-2">Cuando compres un tiquete, tu pase de abordar queda aquí y abre sin señal.</p>
            <Link to="/inicio" className={buttonVariants({ ancho: 'completo', className: 'mt-2' })}>
              Buscar un viaje
            </Link>
          </section>
        ) : (
          <>
            {grupos.pagar.length > 0 && (
              <Seccion titulo="Termina de pagar">
                {grupos.pagar.map((r) => (
                  <TarjetaReserva key={r.bookingId} r={r} d={porId.get(r.itineraryId)} a={`/pago/${r.bookingId}`} ahora={ahora} tono="pagar" />
                ))}
              </Seccion>
            )}
            {grupos.proceso.length > 0 && (
              <Seccion titulo="Confirmando el pago">
                {grupos.proceso.map((r) => (
                  <TarjetaReserva key={r.bookingId} r={r} d={porId.get(r.itineraryId)} a={`/pago/${r.bookingId}`} ahora={ahora} tono="proceso" />
                ))}
              </Seccion>
            )}
            <Seccion titulo="Próximos viajes">
              {grupos.proximos.length === 0 ? (
                <Aviso>No tienes viajes próximos.</Aviso>
              ) : (
                grupos.proximos.map((r) => (
                  <TarjetaReserva key={r.bookingId} r={r} d={porId.get(r.itineraryId)} a={r.ticketId ? `/pase/${r.ticketId}` : `/pago/${r.bookingId}`} ahora={ahora} tono="proximo" />
                ))
              )}
            </Seccion>
            {grupos.anteriores.length > 0 && (
              <Seccion titulo="Anteriores">
                {grupos.anteriores.map((r) => (
                  <TarjetaReserva
                    key={r.bookingId}
                    r={r}
                    d={porId.get(r.itineraryId)}
                    a={r.ticketId ? `/pase/${r.ticketId}` : `/pago/${r.bookingId}`}
                    ahora={ahora}
                    tono="anterior"
                  />
                ))}
              </Seccion>
            )}
          </>
        )}
      </div>

      <BarraInferior activa="tiquetes" />
    </Pantalla>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="text-[15px] font-semibold text-texto-2">{titulo}</h2>
      {children}
    </section>
  )
}

function TarjetaReserva({
  r,
  d,
  a,
  ahora,
  tono,
}: {
  r: Reserva
  d: DetalleItinerario | undefined
  a: string
  ahora: number
  tono: 'pagar' | 'proceso' | 'proximo' | 'anterior'
}) {
  const restante = Math.max(0, Math.floor((new Date(r.holdExpiraEn).getTime() - ahora) / 1000))
  return (
    <Link
      to={a}
      className={cn(
        'tap flex items-center gap-3 rounded-tarjeta p-4',
        tono === 'proximo' && 'bg-tinta text-white',
        tono === 'pagar' && 'border-2 border-tinta bg-superficie',
        tono === 'proceso' && 'bg-superficie',
        tono === 'anterior' && 'bg-[#eceee7] text-texto-2',
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex items-center gap-2">
          <span className="num text-[22px] leading-none font-bold">{codigoCiudad(d?.origen)}</span>
          <span aria-hidden="true" className={cn('h-0.5 w-6', tono === 'proximo' ? 'bg-acento' : 'bg-current')} />
          <span className="num text-[22px] leading-none font-bold">{codigoCiudad(d?.destino)}</span>
        </span>
        <span className={cn('text-[13px]', tono === 'proximo' ? 'text-tinta-texto-2' : 'text-texto-2')}>
          {d ? (
            <>
              {fechaCorta(d.fechaSalida)} · <span className="num">{horaCorta(d.fechaSalida)}</span> · puesto{' '}
              <span className="num">{r.seatNumbers.join(', ')}</span>
            </>
          ) : (
            ' '
          )}
        </span>
        {tono === 'pagar' && (
          <span className="text-[13px] font-semibold text-presencia-borde">
            Apartado por <span className="num">{reloj(restante)}</span> más · {dinero(r.total)}
          </span>
        )}
        {tono === 'proceso' && <span className="text-[13px] font-semibold">Esperando la respuesta del banco…</span>}
        {tono === 'anterior' && <span className="text-[13px]">{d?.estado === 'CANCELADO' ? 'Viaje cancelado' : (ESTADO_TEXTO[r.estado] ?? r.estado)}</span>}
      </div>
      <ChevronRight className={cn('size-5 shrink-0', tono === 'proximo' && 'text-acento')} aria-hidden="true" />
    </Link>
  )
}

function SinConexion({ error }: { error: unknown }) {
  const pases = pasesGuardados()
  return (
    <div className="flex flex-col gap-3">
      <Aviso tono="alerta">{textoError(error, 'No pudimos traer tus tiquetes.')} Estos son los pases guardados en tu teléfono:</Aviso>
      {pases.length === 0 && <Aviso>No hay pases guardados todavía.</Aviso>}
      {pases.map((t) => (
        <Link key={t.ticketId} to={`/pase/${t.ticketId}`} className="tap flex items-center gap-3 rounded-tarjeta bg-tinta p-4 text-white">
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="num text-[20px] font-bold">
              {codigoCiudad(t.origen)} → {codigoCiudad(t.destino)}
            </span>
            <span className="text-[13px] text-tinta-texto-2">
              {fechaCorta(t.fechaSalida)} · {horaCorta(t.fechaSalida)} · puesto {t.seatNumbers.join(', ')}
            </span>
          </span>
          <ChevronRight className="size-5 text-acento" aria-hidden="true" />
        </Link>
      ))}
    </div>
  )
}
