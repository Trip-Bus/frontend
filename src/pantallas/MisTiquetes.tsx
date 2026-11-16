import { useMutation, useQueries, useQuery } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { BannerAfectados } from '@/components/marca/BannerAfectados'
import { BarraInferior } from '@/components/marca/BarraInferior'
import { CampanaAvisos } from '@/components/marca/CampanaAvisos'
import { CargarMas, Resultado } from '@/components/marca/Consulta'
import { Aviso } from '@/components/marca/Estados'
import { Pantalla } from '@/components/marca/Pantalla'
import { buttonVariants } from '@/components/ui/button-variants'
import { Button } from '@/components/ui/button'
import { Segmentos } from '@/components/ui/campos'
import { Hoja } from '@/components/ui/hoja'
import { reembolsoDe } from '@/features/avisos'
import { descargarBlob } from '@/features/descarga'
import { usePaginado } from '@/features/paginacion'
import { pasesGuardados } from '@/features/pases'
import { useAcento } from '@/hooks/useAcento'
import { useAhora } from '@/hooks/useAhora'
import { useCompartirViaje } from '@/hooks/useCompartirViaje'
import { useDescargar } from '@/hooks/useDescargar'
import { ApiError, textoError } from '@/lib/api'
import { codigoCiudad } from '@/lib/ciudades'
import { api } from '@/lib/endpoints'
import { dinero, fechaCorta, horaCorta, reloj } from '@/lib/formato'
import type { DetalleItinerario, EstadoTiquete, Reserva, ViajeMio } from '@/lib/tipos'
import { cn } from '@/lib/utils'

type Pestana = 'proximos' | 'pasados'

const ESTADO_TIQUETE: Record<EstadoTiquete, { texto: string; tono: 'vigente' | 'neutro' | 'alerta' }> = {
  EMITIDO: { texto: 'Vigente', tono: 'vigente' },
  USADO: { texto: 'Abordaste', tono: 'neutro' },
  REPROGRAMADO: { texto: 'Reprogramado', tono: 'neutro' },
  ANULADO: { texto: 'Anulado', tono: 'alerta' },
  NO_SHOW: { texto: 'No abordaste', tono: 'alerta' },
}

const ESTADO_RESERVA: Record<string, string> = {
  CONFIRMADA: 'Confirmada',
  REPROGRAMADA: 'Reprogramada',
  REEMBOLSADA: 'Reembolsada',
}

/**
 * Mis viajes (US-033, US-145): próximos y pasados paginados, con los estados del tiquete y de la reserva y las
 * acciones de cada viaje. Arriba, lo que falta pagar y el aviso de viajes afectados por la empresa (P-08).
 */
export function MisTiquetes() {
  useAcento(null)
  const [params, setParams] = useSearchParams()
  const pestana: Pestana = params.get('pestana') === 'pasados' ? 'pasados' : 'proximos'
  const [abierto, setAbierto] = useState<ViajeMio | null>(null)

  const { consulta, elementos, total } = usePaginado<ViajeMio>(['mis-viajes', pestana], (page) => api.reservas.misViajes(pestana, page, 10))

  return (
    <Pantalla className="pb-0">
      <header className="flex items-center justify-between gap-3 px-5">
        <h1 className="font-display text-[28px] font-bold tracking-[-0.02em]">Mis viajes</h1>
        <CampanaAvisos />
      </header>

      <div className="flex flex-1 flex-col gap-4 px-5 pt-4">
        <BannerAfectados />
        <PorPagar />
        <Segmentos
          etiqueta="Viajes"
          rol="tablist"
          valor={pestana}
          alCambiar={(p) => setParams(p === 'pasados' ? { pestana: p } : {}, { replace: true })}
          opciones={[
            { valor: 'proximos', texto: 'Próximos' },
            { valor: 'pasados', texto: 'Pasados' },
          ]}
        />
        {consulta.isError && !consulta.data ? (
          <SinConexion error={consulta.error} />
        ) : (
          <Resultado
            consulta={consulta}
            hayDatos={elementos.length > 0}
            bloques={[132, 132]}
            vacio={
              pestana === 'proximos' ? (
                <span className="flex flex-col gap-3">
                  No tienes viajes próximos. Cuando compres un tiquete, tu pase de abordar queda aquí y abre sin señal.
                  <Link to="/inicio" className={buttonVariants({ tamano: 'md', className: 'self-start' })}>
                    Buscar un viaje
                  </Link>
                </span>
              ) : (
                'Aún no tienes viajes pasados.'
              )
            }
          >
            <ul className="flex flex-col gap-2.5">
              {elementos.map((v) => (
                <li key={v.bookingId}>
                  <TarjetaViaje v={v} proximo={pestana === 'proximos'} alAbrir={() => setAbierto(v)} />
                </li>
              ))}
            </ul>
            <CargarMas
              hay={!!consulta.hasNextPage}
              cargando={consulta.isFetchingNextPage}
              alCargar={() => consulta.fetchNextPage()}
              mostrados={elementos.length}
              total={total}
            />
          </Resultado>
        )}
      </div>

      <AccionesViaje viaje={abierto} alCerrar={() => setAbierto(null)} />
      <BarraInferior activa="tiquetes" />
    </Pantalla>
  )
}

function TarjetaViaje({ v, proximo, alAbrir }: { v: ViajeMio; proximo: boolean; alAbrir: () => void }) {
  const tiquete = v.estadoTiquete ? ESTADO_TIQUETE[v.estadoTiquete] : null
  const vigente = proximo && v.estadoTiquete === 'EMITIDO'
  const tramo = v.tramo?.paradaAbordaje && v.tramo?.paradaBajada ? `${v.tramo.paradaAbordaje} → ${v.tramo.paradaBajada}` : null
  return (
    <button
      type="button"
      onClick={alAbrir}
      className={cn('tap flex w-full items-center gap-3 rounded-tarjeta p-4 text-left', vigente ? 'bg-tinta text-white' : 'bg-superficie')}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex items-center gap-2">
          <span className="num text-[22px] leading-none font-bold">{codigoCiudad(v.origen)}</span>
          <span aria-hidden="true" className={cn('h-0.5 w-6', vigente ? 'bg-acento' : 'bg-current')} />
          <span className="num text-[22px] leading-none font-bold">{codigoCiudad(v.destino)}</span>
          <span className="sr-only">
            {v.origen} a {v.destino}
          </span>
        </span>
        <span className={cn('text-[13px]', vigente ? 'text-tinta-texto-2' : 'text-texto-2')}>
          {fechaCorta(v.fechaSalida)} · <span className="num">{horaCorta(v.fechaSalida)}</span> · puesto <span className="num">{v.seatNumbers.join(', ')}</span> · {v.empresa}
        </span>
        {tramo && <span className={cn('text-[13px] font-semibold', vigente ? 'text-acento' : '')}>Tramo {tramo}</span>}
        <span className="flex flex-wrap gap-1.5">
          {tiquete && <Chip tono={tiquete.tono} oscuro={vigente}>{tiquete.texto}</Chip>}
          {v.estado !== 'CONFIRMADA' && <Chip tono="neutro" oscuro={vigente}>{ESTADO_RESERVA[v.estado] ?? v.estado}</Chip>}
          {v.canal === 'TAQUILLA' && <Chip tono="neutro" oscuro={vigente}>Taquilla</Chip>}
        </span>
      </span>
      <ChevronRight className={cn('size-5 shrink-0', vigente && 'text-acento')} aria-hidden="true" />
    </button>
  )
}

function Chip({ tono, oscuro, children }: { tono: 'vigente' | 'neutro' | 'alerta'; oscuro: boolean; children: ReactNode }) {
  return (
    <span
      className={cn(
        'rounded-md px-1.5 text-[12px] font-bold',
        tono === 'vigente' && 'bg-acento text-tinta',
        tono === 'neutro' && (oscuro ? 'bg-tinta-2 text-white' : 'bg-linea text-tinta'),
        tono === 'alerta' && 'bg-presencia text-alerta',
      )}
    >
      {children}
    </span>
  )
}

/** Hoja con todo lo que se puede hacer con un viaje. Cada acción aparece solo si aplica. */
export function AccionesViaje({ viaje: v, alCerrar }: { viaje: ViajeMio | null; alCerrar: () => void }) {
  const descargar = useDescargar()
  const compartir = useCompartirViaje()
  const reenviar = useMutation({
    mutationFn: (ticketId: string) => api.reservas.reenviarTiquete(ticketId),
    onSuccess: () => toast('Te reenviamos el tiquete al correo.'),
    onError: (e) => toast(textoError(e)),
  })
  const comprobante = useMutation({
    mutationFn: async (bookingId: string) => {
      const reserva = await api.reservas.obtener(bookingId)
      const paymentId = reserva.pago?.paymentId
      if (!paymentId) throw new ApiError(409, 'RECEIPT_NOT_AVAILABLE', 'Sin pago aprobado')
      descargarBlob(await api.reservas.comprobantePago(paymentId), `comprobante-${bookingId}.pdf`)
    },
    onError: (e) => toast(textoError(e)),
  })

  const refundId = v ? reembolsoDe(v.bookingId) : null
  const emitido = v?.estadoTiquete === 'EMITIDO'
  const reprogramable = !!v && (v.puedeReprogramar || v.estadoTiquete === 'NO_SHOW')
  const ocupado = descargar.isPending || comprobante.isPending

  return (
    <Hoja
      abierta={!!v}
      alCambiar={(a) => !a && alCerrar()}
      titulo={v ? `${v.origen} → ${v.destino}` : ''}
      descripcion={v ? `${fechaCorta(v.fechaSalida)} · ${horaCorta(v.fechaSalida)} · ${dinero(v.total)}` : undefined}
    >
      {v && (
        <div className="flex flex-col gap-2 pb-2">
          {v.ticketId && (emitido || v.estadoTiquete === 'USADO') && (
            <Link to={`/pase/${v.ticketId}`} className={buttonVariants({ ancho: 'completo' })}>
              Ver mi pase de abordar
            </Link>
          )}
          {v.ticketId && emitido && (
            <Button variante="contorno" ancho="completo" disabled={reenviar.isPending} onClick={() => reenviar.mutate(v.ticketId!)}>
              {reenviar.isPending ? 'Reenviando…' : 'Reenviar al correo'}
            </Button>
          )}
          {v.ticketId && (
            <Button
              variante="contorno"
              ancho="completo"
              disabled={ocupado}
              onClick={() => descargar.mutate({ pedir: () => api.reservas.pdfTiquete(v.ticketId!), nombre: `tiquete-${v.ticketId}.pdf` })}
            >
              Descargar el tiquete (PDF)
            </Button>
          )}
          <Button variante="contorno" ancho="completo" disabled={ocupado} onClick={() => comprobante.mutate(v.bookingId)}>
            Comprobante de pago
          </Button>
          {v.estado === 'REEMBOLSADA' && refundId && (
            <Button
              variante="contorno"
              ancho="completo"
              disabled={ocupado}
              onClick={() => descargar.mutate({ pedir: () => api.reservas.comprobanteReembolso(refundId), nombre: `reembolso-${v.bookingId}.pdf` })}
            >
              Comprobante de reembolso
            </Button>
          )}
          {reprogramable && (
            <Link to={`/reprogramar/${v.bookingId}`} className={buttonVariants({ variante: 'contorno', ancho: 'completo' })}>
              {v.estadoTiquete === 'NO_SHOW' ? 'Reprogramar (cargo del 20 %)' : 'Reprogramar'}
            </Link>
          )}
          {v.ticketId && v.puedeCambiarAsiento && (
            <Link to={`/tiquete/${v.ticketId}/cambios?que=asiento`} className={buttonVariants({ variante: 'contorno', ancho: 'completo' })}>
              Cambiar de puesto
            </Link>
          )}
          {v.ticketId && emitido && (
            <Link to={`/tiquete/${v.ticketId}/cambios?que=datos`} className={buttonVariants({ variante: 'contorno', ancho: 'completo' })}>
              Corregir datos del pasajero
            </Link>
          )}
          {emitido && (
            <>
              <Link to={`/viaje/${v.itineraryId}/en-vivo`} className={buttonVariants({ variante: 'fantasma', ancho: 'completo' })}>
                Ver el bus en vivo
              </Link>
              <Button variante="fantasma" ancho="completo" disabled={compartir.isPending} onClick={() => compartir.mutate(v.itineraryId)}>
                {compartir.isPending ? 'Creando el enlace…' : 'Compartir mi viaje'}
              </Button>
            </>
          )}
        </div>
      )}
    </Hoja>
  )
}

/** Reservas que todavía no son viaje: apartadas sin pagar o con el pago en camino. */
function PorPagar() {
  const ahora = useAhora(15_000)
  const reservas = useQuery({ queryKey: ['reservas'], queryFn: api.reservas.mias, refetchInterval: 30_000 })
  const lista = (reservas.data ?? []).filter(
    (r) => (r.estado === 'PENDIENTE_PAGO' && new Date(r.holdExpiraEn).getTime() > ahora) || r.estado === 'PAGO_EN_PROCESO' || r.estado === 'PAGO_APROBADO',
  )
  const ids = [...new Set(lista.map((r) => r.itineraryId))]
  const detalles = useQueries({
    queries: ids.map((id) => ({ queryKey: ['itinerario', id], queryFn: () => api.catalogo.itinerario(id), staleTime: 5 * 60_000 })),
  })
  const porId = new Map(ids.map((id, i) => [id, detalles[i]?.data]))
  if (lista.length === 0) return null
  return (
    <section aria-label="Por pagar" className="flex flex-col gap-2.5">
      <h2 className="text-[15px] font-semibold text-texto-2">Termina de pagar</h2>
      {lista.map((r) => (
        <TarjetaPendiente key={r.bookingId} r={r} d={porId.get(r.itineraryId)} ahora={ahora} />
      ))}
    </section>
  )
}

function TarjetaPendiente({ r, d, ahora }: { r: Reserva; d: DetalleItinerario | undefined; ahora: number }) {
  const restante = Math.max(0, Math.floor((new Date(r.holdExpiraEn).getTime() - ahora) / 1000))
  const pagando = r.estado !== 'PENDIENTE_PAGO'
  return (
    <Link to={`/pago/${r.bookingId}`} className={cn('tap flex items-center gap-3 rounded-tarjeta p-4', pagando ? 'bg-superficie' : 'border-2 border-tinta bg-superficie')}>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="num text-[20px] leading-none font-bold">
          {codigoCiudad(d?.origen)} → {codigoCiudad(d?.destino)}
        </span>
        <span className="text-[13px] text-texto-2">{d ? `${fechaCorta(d.fechaSalida)} · ${horaCorta(d.fechaSalida)} · puesto ${r.seatNumbers.join(', ')}` : ' '}</span>
        {pagando ? (
          <span className="text-[13px] font-semibold">Esperando la respuesta del banco…</span>
        ) : (
          <span className="text-[13px] font-semibold text-presencia-borde">
            Apartado por <span className="num">{reloj(restante)}</span> más · {dinero(r.total)}
          </span>
        )}
      </span>
      <ChevronRight className="size-5 shrink-0" aria-hidden="true" />
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
