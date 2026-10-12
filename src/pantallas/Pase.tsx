import { useQuery } from '@tanstack/react-query'
import { MapPin, Share2, X } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { Esqueleto, PantallaError } from '@/components/marca/Estados'
import { LiveDot } from '@/components/marca/LiveDot'
import { Pantalla } from '@/components/marca/Pantalla'
import { buttonVariants } from '@/components/ui/button-variants'
import { Button } from '@/components/ui/button'
import { codigoReserva, guardarPase, paseGuardado } from '@/features/pases'
import { codigoCiudad } from '@/lib/ciudades'
import { api } from '@/lib/endpoints'
import { fechaCorta, horaCorta } from '@/lib/formato'
import { cn } from '@/lib/utils'

/** Pantalla 06. Pase de abordar con QR (US-033). Se guarda en el teléfono: abre sin señal. */
export function Pase() {
  const { ticketId = '' } = useParams()
  const guardado = paseGuardado(ticketId)
  const tiquete = useQuery({
    queryKey: ['tiquete', ticketId],
    queryFn: () => api.reservas.tiquete(ticketId),
    initialData: guardado,
    staleTime: 60_000,
  })
  const t = tiquete.data
  useEffect(() => {
    if (t) guardarPase(t)
  }, [t])

  const detalle = useQuery({
    queryKey: ['itinerario', t?.itineraryId],
    queryFn: () => api.catalogo.itinerario(t!.itineraryId),
    enabled: !!t,
  })
  const seguimiento = useQuery({
    queryKey: ['seguimiento', t?.itineraryId],
    queryFn: () => api.viaje.seguimiento(t!.itineraryId),
    enabled: !!t,
    refetchInterval: 60_000,
  })

  if (!t) {
    if (tiquete.isError) return <PantallaError titulo="No pudimos abrir tu pase" error={tiquete.error} reintentar={() => tiquete.refetch()} volverA="/mis-tiquetes" />
    return (
      <Pantalla oscura>
        <Esqueleto bloques={[90, 520]} />
      </Pantalla>
    )
  }

  const llegada = detalle.data?.fechaLlegadaEstimada ?? seguimiento.data?.llegadaProgramada
  const estado = seguimiento.data?.estado
  const enRuta = estado === 'EN_RUTA' || estado === 'SIN_SENAL'
  const cancelado = estado === 'CANCELADO' || detalle.data?.estado === 'CANCELADO'
  const embarque = new Date(new Date(t.fechaSalida).getTime() - 30 * 60_000).toISOString()
  const primerNombre = t.pasajeros[0]?.nombre.split(' ')[0]
  const enlaceViaje = `${globalThis.location?.origin ?? ''}/viaje/${t.itineraryId}/en-vivo`

  const compartir = async () => {
    const texto = `Voy de ${t.origen} a ${t.destino} el ${fechaCorta(t.fechaSalida)}, salgo a las ${horaCorta(t.fechaSalida)}. Sigue el bus en vivo:`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Mi viaje en TripBus', text: texto, url: enlaceViaje })
        return
      }
      await navigator.clipboard.writeText(`${texto} ${enlaceViaje}`)
      toast('Copiamos el enlace para que lo pegues donde quieras.')
    } catch {
      /* el usuario cerró el menú de compartir */
    }
  }

  return (
    <Pantalla oscura className="pb-0">
      <div className="flex items-start gap-3 px-5">
        <div className="flex min-w-0 flex-1 flex-col pt-1">
          <h1 className="font-display text-[26px] leading-tight font-bold tracking-[-0.01em] text-white">
            {cancelado ? 'Este viaje fue cancelado' : primerNombre ? `Listo, ${primerNombre}. Buen viaje.` : 'Buen viaje.'}
          </h1>
          <p className="mt-1 text-[14px] text-tinta-texto-2">
            {cancelado ? 'La empresa canceló la salida. Te contactarán para el reembolso.' : 'Muestra este código al subir al bus.'}
          </p>
        </div>
        <Link to="/mis-tiquetes" aria-label="Cerrar" className="tap flex size-11 shrink-0 items-center justify-center rounded-control bg-tinta-2 text-white">
          <X className="size-[22px]" aria-hidden="true" />
        </Link>
      </div>

      <article aria-label="Pase de abordar" className={cn('mx-5 mt-4 overflow-hidden rounded-[26px] bg-superficie text-tinta', cancelado && 'opacity-60')}>
        {enRuta ? (
          <Link to={`/viaje/${t.itineraryId}/en-vivo`} className="flex items-center justify-between gap-3 bg-lima px-4 py-3">
            <span className="flex items-center gap-2 text-[14px] font-semibold">
              <LiveDot className="[&>span]:bg-tinta" />
              Tu bus va en camino
            </span>
            {llegada && (
              <span className="text-[13px]">
                llega <span className="num font-bold">{horaCorta(llegada)}</span>
              </span>
            )}
          </Link>
        ) : (
          <div className="flex items-center justify-between gap-3 bg-[#eef1e8] px-4 py-3 text-[13px]">
            <span>
              Embarque desde <span className="num font-bold">{horaCorta(embarque)}</span>
            </span>
            <span className="truncate font-semibold" title={t.empresa}>
              {t.empresa}
            </span>
          </div>
        )}

        <div className="flex items-end justify-between gap-3 px-4 pt-4">
          <span className="flex flex-col">
            <span className="num text-[40px] leading-none font-bold">{codigoCiudad(t.origen)}</span>
            <span className="mt-1 text-[13px] text-texto-2">
              {t.origen} · <span className="num">{horaCorta(t.fechaSalida)}</span>
            </span>
          </span>
          <span className="flex flex-col items-end text-right">
            <span className="num text-[40px] leading-none font-bold">{codigoCiudad(t.destino)}</span>
            <span className="mt-1 text-[13px] text-texto-2">
              {t.destino}
              {llegada && (
                <>
                  {' '}
                  · <span className="num">{horaCorta(llegada)}</span>
                </>
              )}
            </span>
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 px-4 pt-4 pb-4 text-[13px]">
          <span className="flex flex-col">
            <span className="text-texto-2">Fecha</span>
            <span className="font-semibold">{fechaCorta(t.fechaSalida)}</span>
          </span>
          <span className="flex flex-col">
            <span className="text-texto-2">{t.seatNumbers.length > 1 ? 'Puestos' : 'Puesto'}</span>
            <span className="num text-[22px] leading-tight font-bold">{t.seatNumbers.join(', ')}</span>
          </span>
          <span className="flex flex-col">
            <span className="text-texto-2">Bus</span>
            <span className="num font-semibold">{t.placa}</span>
          </span>
        </div>

        <div aria-hidden="true" className="relative h-5">
          <span className="absolute top-1/2 -left-2.5 size-5 -translate-y-1/2 rounded-full bg-tinta" />
          <span className="absolute inset-x-4 top-1/2 border-t-2 border-dashed border-linea" />
          <span className="absolute top-1/2 -right-2.5 size-5 -translate-y-1/2 rounded-full bg-tinta" />
        </div>

        <div className="flex items-center gap-4 p-4">
          <img
            src={t.qrImage}
            alt={`Código QR del tiquete de ${t.pasajeros.map((p) => p.nombre).join(', ')}`}
            className="size-[150px] shrink-0 rounded-xl bg-white [image-rendering:pixelated]"
          />
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[15px] font-semibold">Muéstralo al subir</span>
            <span className="text-[13px] leading-snug text-texto-2">Funciona sin señal. Sube el brillo si hay mucho sol.</span>
            <span className="num text-[13px] font-semibold">Reserva {codigoReserva(t.bookingId)}</span>
            {t.pasajeros.map((p) => (
              <span key={p.numeroDocumento} className="truncate text-[12px] text-texto-2" title={p.nombre}>
                {p.nombre} · {p.tipoDocumento} {p.numeroDocumento}
              </span>
            ))}
          </div>
        </div>
      </article>

      <div className="flex-1" />
      <div className="flex gap-2.5 px-5 pt-4 pb-[calc(18px+env(safe-area-inset-bottom,0px))]">
        <Link to={`/viaje/${t.itineraryId}/en-vivo`} className={buttonVariants({ variante: 'lima', ancho: 'completo' })}>
          <MapPin className="size-5" aria-hidden="true" />
          {enRuta ? 'Ver dónde va el bus' : 'Ver el recorrido'}
        </Link>
        <Button variante="contorno" className="size-14 shrink-0 border-tinta-2 bg-tinta-2 px-0 text-white hover:bg-tinta-2" aria-label="Compartir el viaje" onClick={compartir}>
          <Share2 className="size-[22px]" aria-hidden="true" />
        </Button>
      </div>
    </Pantalla>
  )
}
