import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Flag, MapPin, Play, Route as IconoRuta, Share2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { toast } from 'sonner'
import { useAcento } from '@/hooks/useAcento'
import { BotonVolver } from '@/components/marca/BotonVolver'
import { Esqueleto, PantallaError } from '@/components/marca/Estados'
import { LiveDot } from '@/components/marca/LiveDot'
import { Pantalla } from '@/components/marca/Pantalla'
import { Button } from '@/components/ui/button'
import { calcularAvance, crearProyeccion, haceCuanto, minutosDeRetraso, segundosDesde } from '@/features/seguimiento'
import { useAhora } from '@/hooks/useAhora'
import { api } from '@/lib/endpoints'
import { fechaCorta, horaCorta } from '@/lib/formato'
import { topicos, useIntervaloRespaldo, useTopico } from '@/lib/tiempoReal'
import type { Novedad, Posicion, Seguimiento, TipoNovedad } from '@/lib/tipos'
import { cn } from '@/lib/utils'

const ANCHO = 390
const ALTO = 340

const NOVEDAD: Record<TipoNovedad, { texto: string; icono: typeof Flag }> = {
  INICIO: { texto: 'Salió', icono: Play },
  LLEGADA_PARADA: { texto: 'Llegó a una parada', icono: MapPin },
  RETRASO: { texto: 'Retraso', icono: AlertTriangle },
  DESVIO: { texto: 'Desvío', icono: IconoRuta },
  FIN: { texto: 'Llegó al destino', icono: Flag },
}

const sumarMin = (iso: string, min: number) => new Date(new Date(iso).getTime() + min * 60_000).toISOString()

/**
 * Pantalla 07. Viaje en vivo (US-039 / US-047). Pública: sirve para quien espera el bus en la vía.
 * Posición por WebSocket (bus:{id}:posicion) y novedades (viaje:{id}:eventos); si el canal no está,
 * se consulta por REST cada 5 s.
 */
export function EnVivo() {
  const { itineraryId = '' } = useParams()
  const queryClient = useQueryClient()
  const ahora = useAhora()
  const respaldo = useIntervaloRespaldo()
  const [verTodo, setVerTodo] = useState(false)

  const seguimiento = useQuery({
    queryKey: ['seguimiento', itineraryId],
    queryFn: () => api.viaje.seguimiento(itineraryId),
    refetchInterval: respaldo,
  })
  const novedades = useQuery({
    queryKey: ['novedades', itineraryId],
    queryFn: () => api.viaje.novedades(itineraryId),
    refetchInterval: respaldo * 2,
  })
  const s = seguimiento.data
  useAcento(s?.destino)

  useTopico(s ? topicos.posicionBus(s.busId) : null, (m) => {
    const p = m.data as Posicion | null
    if (!p || typeof p.lat !== 'number') return
    queryClient.setQueryData<Seguimiento>(['seguimiento', itineraryId], (prev) =>
      prev && (!p.itineraryId || p.itineraryId === itineraryId) ? { ...prev, posicion: { ...p, busId: prev.busId } } : prev,
    )
  })
  useTopico(topicos.novedades(itineraryId), (m) => {
    if (m.type === 'snapshot' && Array.isArray(m.data)) {
      queryClient.setQueryData<Novedad[]>(['novedades', itineraryId], m.data as Novedad[])
      return
    }
    if (m.type === 'event') {
      const n = m.data as Novedad
      if (n?.tipo === 'RETRASO' || n?.tipo === 'DESVIO') toast(`${NOVEDAD[n.tipo].texto}: ${n.descripcion ?? 'el conductor reportó una novedad'}`)
      void queryClient.invalidateQueries({ queryKey: ['novedades', itineraryId] })
      void queryClient.invalidateQueries({ queryKey: ['seguimiento', itineraryId] })
    }
  })

  const proyeccion = useMemo(() => (s && s.paradas.length > 0 ? crearProyeccion(s.paradas, ANCHO, ALTO, 48, 92) : null), [s])

  if (seguimiento.isError) {
    return <PantallaError titulo="No pudimos ubicar el viaje" error={seguimiento.error} reintentar={() => seguimiento.refetch()} />
  }
  if (!s || !proyeccion) {
    return (
      <Pantalla>
        <Esqueleto bloques={[300, 220]} />
      </Pantalla>
    )
  }

  const lista = [...(novedades.data ?? [])].sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  const retraso = minutosDeRetraso(lista)
  const llegada = sumarMin(s.llegadaProgramada, retraso)
  const avance = calcularAvance(s.paradas, s.posicion)
  const hace = segundosDesde(s.posicion, ahora)
  const enRuta = s.estado === 'EN_RUTA' || s.estado === 'SIN_SENAL'
  const sinSenal = s.estado === 'SIN_SENAL' || (hace != null && hace > 120)
  // El bus se muestra en ruta y también antes de salir si ya transmite (camino a la terminal).
  const conSenalReciente = hace != null && hace < 300
  const mostrarBus = s.estado !== 'CANCELADO' && s.estado !== 'FINALIZADO' && (enRuta || conSenalReciente)

  const puntos = s.paradas.map(proyeccion)
  const bus = s.posicion ? proyeccion(s.posicion) : null
  const recorrido = bus && avance ? [...puntos.slice(0, avance.ultimaParada + 1), bus] : []
  const linea = (ps: { x: number; y: number }[]) => ps.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')

  const titulo =
    s.estado === 'CANCELADO'
      ? 'Este viaje fue cancelado'
      : s.estado === 'FINALIZADO'
        ? `Llegó a ${s.destino}`
        : enRuta
          ? `Llegas a ${s.destino}`
          : `Sale de ${s.origen}`
  const horaTitulo = s.estado === 'PROGRAMADO' ? s.fechaSalida : llegada

  const compartir = async () => {
    const url = globalThis.location?.href ?? ''
    const texto = `Sigue en vivo el bus de ${s.origen} a ${s.destino}:`
    try {
      if (navigator.share) await navigator.share({ title: 'Viaje en vivo', text: texto, url })
      else {
        await navigator.clipboard.writeText(`${texto} ${url}`)
        toast('Enlace copiado.')
      }
    } catch {
      /* menú cerrado */
    }
  }

  return (
    <Pantalla aSangre>
      <div className="relative">
        <svg
          viewBox={`0 0 ${ANCHO} ${ALTO}`}
          className="block h-[min(44dvh,340px)] w-full bg-[#e8ebe3]"
          preserveAspectRatio="xMidYMid slice"
          role="img"
          aria-label={
            bus && avance
              ? `Mapa: el bus va entre ${s.paradas[avance.ultimaParada]?.nombre} y ${s.paradas[Math.min(avance.ultimaParada + 1, s.paradas.length - 1)]?.nombre}`
              : `Mapa de la ruta de ${s.origen} a ${s.destino}`
          }
        >
          <path d={linea(puntos)} fill="none" stroke="#0d1411" strokeOpacity="0.28" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2 9" />
          {recorrido.length > 1 && (
            <path d={linea(recorrido)} fill="none" stroke="#0d1411" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          )}
          {puntos.map((p, i) => {
            const extremo = i === 0 || i === puntos.length - 1
            return (
              <g key={s.paradas[i].orden}>
                <circle cx={p.x} cy={p.y} r={extremo ? 7 : 4.5} fill={i === puntos.length - 1 ? '#0d1411' : '#ffffff'} stroke="#0d1411" strokeWidth="3" />
                <text
                  x={p.x + (p.x > ANCHO / 2 ? -12 : 12)}
                  y={p.y + 4}
                  textAnchor={p.x > ANCHO / 2 ? 'end' : 'start'}
                  fontFamily="Geist Variable, sans-serif"
                  fontSize={extremo ? 14 : 12}
                  fontWeight={extremo ? 700 : 500}
                  fill={extremo ? '#0d1411' : '#2e3632'}
                  paintOrder="stroke"
                  stroke="#e8ebe3"
                  strokeWidth="4"
                >
                  {s.paradas[i].nombre}
                </text>
              </g>
            )
          })}
          {bus && mostrarBus && (
            <g transform={`translate(${bus.x} ${bus.y})`}>
              {!sinSenal && <circle r="10" className="tb-latido" style={{ fill: 'var(--acento)', animation: 'tb-latido 1.6s var(--ease-out) infinite', transformBox: 'fill-box', transformOrigin: 'center' }} />}
              <circle r="11" style={{ fill: sinSenal ? '#8c948e' : 'var(--acento)' }} stroke="#0d1411" strokeWidth="3" />
              <circle r="3.5" fill="#0d1411" />
            </g>
          )}
        </svg>

        <div className="pt-seguro absolute inset-x-0 top-0 flex items-start justify-between px-5">
          <BotonVolver />
          <span role="status" className="flex h-9 items-center gap-2 rounded-full bg-tinta px-3.5 text-[13px] font-semibold text-white">
            {mostrarBus && !sinSenal ? <LiveDot /> : <span aria-hidden="true" className="size-2 rounded-full bg-control" />}
            {mostrarBus
              ? sinSenal
                ? `Sin señal hace ${haceCuanto(hace ?? 0)}`
                : `En vivo · hace ${haceCuanto(hace ?? 0)}`
              : s.estado === 'PROGRAMADO'
                ? 'Aún no sale'
                : s.estado === 'FINALIZADO'
                  ? 'Viaje terminado'
                  : 'Cancelado'}
          </span>
        </div>
      </div>

      <section aria-label="Estado del viaje" className="relative -mt-6 flex flex-1 flex-col gap-4 rounded-t-[28px] bg-superficie px-5 pt-5 pb-[calc(18px+env(safe-area-inset-bottom,0px))]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <span className="text-[14px] text-texto-2">{titulo}</span>
            {s.estado !== 'CANCELADO' && <span className="num text-[40px] leading-none font-bold">{horaCorta(horaTitulo)}</span>}
          </div>
          {s.estado !== 'CANCELADO' && s.estado !== 'FINALIZADO' && (
            <span
              className={cn(
                'mt-1 flex h-8 shrink-0 items-center rounded-full px-3 text-[13px] font-bold',
                retraso > 0 ? 'bg-naranja text-tinta' : 'bg-acento text-tinta',
              )}
            >
              {retraso > 0 ? `+${retraso} min` : 'A tiempo'}
            </span>
          )}
        </div>

        <p className="-mt-2 text-[14px] text-texto-2">
          {s.estado === 'CANCELADO'
            ? 'La empresa canceló esta salida.'
            : enRuta && avance
              ? `Faltan ${Math.round(avance.kmRestantes).toLocaleString('es-CO')} km · salió ${horaCorta(s.fechaSalida)}`
              : s.estado === 'PROGRAMADO'
                ? `${fechaCorta(s.fechaSalida)} · llega ${horaCorta(llegada)}`
                : `Salió ${horaCorta(s.fechaSalida)}`}
        </p>

        <ol aria-label="Paradas" className="flex flex-col">
          {s.paradas.map((p, i) => {
            const pasada = avance ? i <= avance.ultimaParada : s.estado === 'FINALIZADO'
            const aqui = enRuta && avance?.ultimaParada === i
            return (
              <li key={p.orden} className="flex items-center gap-3">
                <span aria-hidden="true" className="relative flex w-4 flex-col items-center self-stretch">
                  <span className={cn('w-0.5 flex-1', i === 0 ? 'bg-transparent' : pasada ? 'bg-tinta' : 'bg-linea')} />
                  <span className={cn('size-3 shrink-0 rounded-full border-[2.5px] border-tinta', pasada ? 'bg-tinta' : 'bg-superficie', aqui && 'size-4 bg-acento')} />
                  <span className={cn('w-0.5 flex-1', i === s.paradas.length - 1 ? 'bg-transparent' : avance && i < avance.ultimaParada ? 'bg-tinta' : 'bg-linea')} />
                </span>
                <span className="flex min-w-0 flex-1 items-center gap-2 py-2">
                  <span className={cn('truncate text-[15px]', i === 0 || i === s.paradas.length - 1 ? 'font-semibold' : '')}>{p.nombre}</span>
                  {aqui && <span className="shrink-0 rounded-md bg-acento px-1.5 text-[11px] font-bold">Va por aquí</span>}
                </span>
                <span className="num shrink-0 text-[14px] text-texto-2">{horaCorta(sumarMin(p.horaProgramada, pasada ? 0 : retraso))}</span>
              </li>
            )
          })}
        </ol>

        {lista.length > 0 && (
          <section aria-label="Novedades del viaje" className="flex flex-col gap-2">
            <h2 className="text-[15px] font-semibold">Novedades</h2>
            <ul className="flex flex-col gap-2">
              {(verTodo ? lista : lista.slice(0, 3)).map((n) => {
                const { texto, icono: Icono } = NOVEDAD[n.tipo] ?? NOVEDAD.RETRASO
                const alerta = n.tipo === 'RETRASO' || n.tipo === 'DESVIO'
                return (
                  <li key={n.tripEventId} className={cn('flex gap-3 rounded-[18px] p-3', alerta ? 'bg-presencia' : 'bg-fondo')}>
                    <Icono className={cn('mt-0.5 size-5 shrink-0', alerta && 'text-alerta')} aria-hidden="true" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-[13px] text-texto-2">
                        {texto} · <span className="num">{horaCorta(n.timestamp)}</span>
                      </span>
                      {n.descripcion && <span className={cn('text-[14px] font-medium', alerta && 'text-alerta')}>{n.descripcion}</span>}
                    </span>
                  </li>
                )
              })}
            </ul>
            {lista.length > 3 && (
              <button type="button" className="self-start text-[14px] font-semibold underline underline-offset-2" onClick={() => setVerTodo((v) => !v)}>
                {verTodo ? 'Ver menos' : `Ver las ${lista.length} novedades`}
              </button>
            )}
          </section>
        )}

        <div className="flex-1" />
        <Button variante="contorno" ancho="completo" onClick={compartir}>
          <Share2 className="size-5" aria-hidden="true" />
          Compartir el viaje
        </Button>
      </section>
    </Pantalla>
  )
}
