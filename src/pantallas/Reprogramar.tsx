import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Resultado } from '@/components/marca/Consulta'
import { Encabezado } from '@/components/marca/Encabezado'
import { Aviso, Esqueleto, PantallaError } from '@/components/marca/Estados'
import { Pantalla } from '@/components/marca/Pantalla'
import { SelectorPuestos } from '@/components/marca/SelectorPuestos'
import { Button } from '@/components/ui/button'
import { Campo } from '@/components/ui/input'
import { hoy } from '@/features/busqueda'
import { useAcento } from '@/hooks/useAcento'
import { textoError } from '@/lib/api'
import { api } from '@/lib/endpoints'
import { dinero, duracion, fechaCorta, fechaParaApi, horaCorta, plural } from '@/lib/formato'
import type { ResultadoViaje } from '@/lib/tipos'
import { cn } from '@/lib/utils'

/**
 * P-06 Reprogramar (US-150) y "reprogramar gratis" de un viaje afectado (US-154, `?afectado=1`):
 * otro viaje de la misma ruta → los puestos → POST /seats/holds → POST /bookings/{id}/reschedule {holdId}.
 * Si hay diferencia a favor de la empresa se va a pagar; nunca se devuelve la diferencia.
 */
export function Reprogramar() {
  const { bookingId = '' } = useParams()
  const [params] = useSearchParams()
  const afectado = params.get('afectado') === '1'
  const navigate = useNavigate()
  const [elegido, setElegido] = useState<ResultadoViaje | null>(null)
  const [asientos, setAsientos] = useState<string[]>([])

  const reserva = useQuery({ queryKey: ['reserva', bookingId], queryFn: () => api.reservas.obtener(bookingId) })
  const r = reserva.data
  const original = useQuery({
    queryKey: ['itinerario', r?.itineraryId],
    queryFn: () => api.catalogo.itinerario(r!.itineraryId),
    enabled: !!r,
  })
  const o = original.data
  useAcento(o?.destino)
  const [fecha, setFecha] = useState<string | null>(null)
  const dia = fecha ?? (o ? maxFecha(fechaParaApi(new Date(o.fechaSalida)), hoy()) : hoy())

  const viajes = useQuery({
    queryKey: ['viajes', o?.origen, o?.destino, dia],
    queryFn: ({ signal }) => api.catalogo.buscar(o!.origen, o!.destino, dia, signal),
    enabled: !!o,
  })
  const opciones = (viajes.data ?? []).filter((v) => v.itineraryId !== r?.itineraryId && !v.agotado)
  const cantidad = r?.seatNumbers.length ?? 1

  const confirmar = useMutation({
    mutationFn: async () => {
      const retencion = await api.asientos.retener(elegido!.itineraryId, asientos)
      try {
        if (afectado) {
          await api.afectados.reprogramar(bookingId, retencion.holdId)
          return null
        }
        return await api.reservas.reprogramar(bookingId, retencion.holdId)
      } catch (e) {
        // La retención no sirvió para la reprogramación: se suelta para no bloquear el puesto.
        api.asientos.liberar(retencion.holdId).catch(() => undefined)
        throw e
      }
    },
    onSuccess: (nueva) => {
      if (nueva && nueva.estado === 'PENDIENTE_PAGO') {
        toast(`Paga la diferencia de ${dinero(nueva.total)} para confirmar el cambio.`)
        void navigate(`/pago/${nueva.bookingId}`, { replace: true })
        return
      }
      toast('Listo: tu tiquete quedó en el viaje nuevo.')
      void navigate('/mis-tiquetes', { replace: true })
    },
    onError: (e) => toast(textoError(e)),
  })

  if (reserva.isError) return <PantallaError titulo="No encontramos tu reserva" error={reserva.error} reintentar={() => reserva.refetch()} volverA="/mis-tiquetes" />
  if (!r || !o) {
    return (
      <Pantalla>
        <Esqueleto bloques={[80, 160, 200]} />
      </Pantalla>
    )
  }

  return (
    <Pantalla className="pb-0">
      <Encabezado titulo={afectado ? 'Reprogramar gratis' : 'Reprogramar tu viaje'} volverA={afectado ? '/afectados' : '/mis-tiquetes'}>
        {o.origen} → {o.destino}. Hoy viajas el {fechaCorta(o.fechaSalida)} a las {horaCorta(o.fechaSalida)}.
      </Encabezado>

      <div className="flex flex-1 flex-col gap-4 px-5 pt-4 pb-6">
        <Aviso>
          {afectado ? (
            'La empresa cambió tu viaje: el cambio no tiene costo, aunque el viaje nuevo sea más caro, y puedes elegir cualquier empresa de la misma ruta.'
          ) : (
            <>
              Puedes reprogramar hasta 3 horas antes de la salida y máximo 2 veces. Si el viaje nuevo es más caro pagas la diferencia; si es más barato,
              la diferencia no se devuelve. Si no alcanzaste a abordar, tienes 24 horas para reprogramar con un cargo del 20 %.
            </>
          )}
        </Aviso>

        <section aria-label="Viaje nuevo" className="flex flex-col gap-3">
          <h2 className="text-[16px] font-semibold">1. Elige el viaje nuevo</h2>
          <Campo
            etiqueta="Fecha"
            type="date"
            min={hoy()}
            value={dia}
            onChange={(e) => {
              setFecha(e.target.value || null)
              setElegido(null)
              setAsientos([])
            }}
          />
          <Resultado consulta={viajes} hayDatos={opciones.length > 0} vacio="No hay otros viajes con puestos ese día. Prueba otra fecha.">
            <ul role="radiogroup" aria-label="Viajes disponibles" className="flex flex-col gap-2">
              {opciones.map((v) => {
                const on = elegido?.itineraryId === v.itineraryId
                return (
                  <li key={v.itineraryId}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => {
                        setElegido(v)
                        setAsientos([])
                      }}
                      className={cn('tap flex w-full items-center justify-between gap-3 rounded-tarjeta border-2 bg-superficie p-3.5 text-left', on ? 'border-tinta' : 'border-transparent')}
                    >
                      <span className="flex flex-col">
                        <span className="num text-[18px] font-bold">
                          {horaCorta(v.fechaSalida)} → {horaCorta(v.fechaLlegadaEstimada)}
                        </span>
                        <span className="text-[13px] text-texto-2">
                          {v.empresa} · {duracion(v.duracionMinutos)}
                          {v.asientosDisponibles != null ? ` · ${plural(v.asientosDisponibles, 'libre', 'libres')}` : ''}
                        </span>
                      </span>
                      <span className="num text-[16px] font-bold">{dinero(v.ofertaActiva?.precioOferta ?? v.precioBase)}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </Resultado>
        </section>

        {elegido && (
          <section aria-label="Puestos del viaje nuevo" className="flex flex-col gap-3">
            <h2 className="text-[16px] font-semibold">2. Elige {plural(cantidad, 'puesto', 'puestos')}</h2>
            <SelectorPuestos itineraryId={elegido.itineraryId} maximo={cantidad} elegidos={asientos} alCambiar={setAsientos} />
          </section>
        )}
      </div>

      <footer className="sticky bottom-0 flex flex-col gap-2 rounded-t-[28px] bg-superficie px-5 pt-3.5 pb-[calc(18px+env(safe-area-inset-bottom,0px))] shadow-[0_-8px_28px_rgba(13,20,17,.08)]">
        <Button ancho="completo" disabled={!elegido || asientos.length !== cantidad || confirmar.isPending} onClick={() => confirmar.mutate()}>
          {confirmar.isPending ? 'Reprogramando…' : afectado ? 'Confirmar el cambio gratis' : 'Reprogramar'}
        </Button>
      </footer>
    </Pantalla>
  )
}

function maxFecha(a: string, b: string) {
  return a > b ? a : b
}
