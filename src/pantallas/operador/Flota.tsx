import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Siren } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Resultado } from '@/components/marca/Consulta'
import { EstadoVivo } from '@/components/marca/EstadoVivo'
import { HojaMotivo } from '@/components/marca/HojaMotivo'
import { PantallaGestion } from '@/components/marca/PantallaGestion'
import { buttonVariants } from '@/components/ui/button-variants'
import { Button } from '@/components/ui/button'
import { Hoja } from '@/components/ui/hoja'
import { useEmpresaActiva } from '@/features/empresa'
import { MapaGoogle } from '@/components/marca/MapaGoogle'
import { crearProyeccion } from '@/features/seguimiento'
import { esAlertaMaxima, ordenarAlertas, sonarAlerta } from '@/features/sonido'
import { textoError } from '@/lib/api'
import { api } from '@/lib/endpoints'
import { fechaHora, horaCorta } from '@/lib/formato'
import { topicos, useIntervaloRespaldo, useTopico } from '@/lib/tiempoReal'
import type { AlertaViaje, EstadoRastreo, FlotaEnVivo, PosicionFlota, ViajeFlota } from '@/lib/tipos'
import { cn } from '@/lib/utils'
import { Dato } from './InicioOperador'

const ANCHO = 640
const ALTO = 360

const COLOR_RASTREO: Record<EstadoRastreo | 'NINGUNO', { color: string; texto: string }> = {
  ACTIVO: { color: '#3fb950', texto: 'En ruta' },
  EN_PAUSA: { color: '#8c948e', texto: 'En pausa' },
  SIN_SENAL: { color: '#ff6b35', texto: 'Sin señal' },
  FINALIZADO: { color: '#0d1411', texto: 'Terminado' },
  NINGUNO: { color: '#cdd2c9', texto: 'Sin rastreo' },
}

const colorDe = (v: ViajeFlota) => COLOR_RASTREO[v.estadoRastreo ?? 'NINGUNO']

/**
 * O-06 Flota en vivo (US-176, US-178): mapa con todos los buses de la empresa (color por estado, retraso,
 * siguiente parada y ETA), alertas abiertas con prioridad para SOS y accidentes (sonido y destacado), resolver
 * alertas, forzar el fin de un viaje y ver su línea de tiempo. Tópicos empresa:{id}:flota y empresa:{id}:alertas.
 */
export function Flota() {
  const { companyId, esAdmin } = useEmpresaActiva()
  const queryClient = useQueryClient()
  const respaldo = useIntervaloRespaldo(10_000, 30_000)
  const [linea, setLinea] = useState<ViajeFlota | null>(null)
  const [terminando, setTerminando] = useState<ViajeFlota | null>(null)
  const claveFlota = ['flota', companyId ?? null]

  const flota = useQuery({ queryKey: claveFlota, queryFn: () => api.flota.enVivo(esAdmin ? companyId : undefined), refetchInterval: respaldo })
  const alertas = useQuery({ queryKey: ['alertas', companyId ?? null], queryFn: () => api.flota.alertas('ABIERTA'), refetchInterval: respaldo })

  useTopico(companyId ? topicos.flotaEmpresa(companyId) : null, (m) => {
    if (m.type !== 'event') return
    const d = (m.data ?? {}) as Record<string, unknown>
    if (m.event === 'PositionUpdated' && typeof d.itineraryId === 'string' && typeof d.lat === 'number') {
      queryClient.setQueryData<FlotaEnVivo>(claveFlota, (prev) =>
        prev ? { ...prev, viajes: prev.viajes.map((v) => (v.itineraryId === d.itineraryId ? { ...v, posicion: d as unknown as PosicionFlota } : v)) } : prev,
      )
      return
    }
    void queryClient.invalidateQueries({ queryKey: ['flota'] })
  })
  useTopico(companyId ? topicos.alertasEmpresa(companyId) : null, (m) => {
    if (m.type !== 'event') return
    const d = (m.data ?? {}) as { tipo?: string; gravedad?: string; mensaje?: string }
    if (m.event === 'TripAlertRaised') {
      if (esAlertaMaxima(d)) sonarAlerta()
      toast(d.tipo === 'SOS' ? 'SOS de un conductor' : `Alerta nueva: ${d.mensaje ?? d.tipo ?? 'revisa la flota'}`)
    }
    void queryClient.invalidateQueries({ queryKey: ['alertas'] })
    void queryClient.invalidateQueries({ queryKey: ['flota'] })
  })

  const terminar = useMutation({
    mutationFn: (itineraryId: string) => api.flota.forzarFin(itineraryId),
    onSuccess: () => {
      toast('Finalizamos el viaje.')
      setTerminando(null)
      void queryClient.invalidateQueries({ queryKey: ['flota'] })
    },
    onError: (e) => toast(textoError(e)),
  })

  const f = flota.data
  return (
    <PantallaGestion titulo="Flota en vivo" descripcion="Dónde va cada bus y qué alertas necesitan atención." requiereEmpresa acciones={<EstadoVivo />}>
      <PanelAlertas consulta={alertas} />
      <Resultado consulta={flota} hayDatos={!!f && f.viajes.length > 0} bloques={[320, 120]} vacio="No hay buses en ruta en este momento.">
        {f && (
          <>
            <section aria-label="Resumen de la flota" className="grid grid-cols-3 gap-2 md:grid-cols-6">
              <Dato titulo="En ruta" valor={String(f.resumen.enRuta)} />
              <Dato titulo="Activos" valor={String(f.resumen.activos)} />
              <Dato titulo="En pausa" valor={String(f.resumen.enPausa)} />
              <Dato titulo="Sin señal" valor={String(f.resumen.sinSenal)} alerta={f.resumen.sinSenal > 0} />
              <Dato titulo="Retrasados" valor={String(f.resumen.retrasados)} alerta={f.resumen.retrasados > 0} />
              <Dato titulo="Con alerta" valor={String(f.resumen.conAlerta)} alerta={f.resumen.conAlerta > 0} />
            </section>
            <MapaFlota viajes={f.viajes} />
            <ul className="grid gap-2 md:grid-cols-2">
              {f.viajes.map((v) => (
                <li key={v.itineraryId}>
                  <TarjetaFlota v={v} alVerLinea={() => setLinea(v)} alTerminar={() => setTerminando(v)} />
                </li>
              ))}
            </ul>
          </>
        )}
      </Resultado>
      <LineaDeTiempo viaje={linea} alCerrar={() => setLinea(null)} />
      <HojaMotivo
        abierta={!!terminando}
        alCerrar={() => setTerminando(null)}
        titulo="¿Forzar el fin del viaje?"
        descripcion={terminando ? `${terminando.origen} → ${terminando.destino}. El rastreo pasa a terminado y se registra el FIN.` : undefined}
        boton="Sí, finalizar el viaje"
        ocupado={terminar.isPending}
        alConfirmar={() => terminando && terminar.mutate(terminando.itineraryId)}
      />
    </PantallaGestion>
  )
}

function MapaFlota({ viajes }: { viajes: ViajeFlota[] }) {
  const conPosicion = viajes.filter((v) => v.posicion)
  const proyeccion = useMemo(
    () => (conPosicion.length > 0 ? crearProyeccion(conPosicion.map((v) => v.posicion!), ANCHO, ALTO, 40) : null),
    [conPosicion],
  )
  if (!proyeccion) return <p className="rounded-tarjeta bg-superficie p-4 text-[14px] text-texto-2">Ningún bus ha enviado su ubicación todavía.</p>
  return (
    <figure className="flex flex-col gap-2">
      <MapaGoogle
        className="h-[360px] w-full overflow-hidden rounded-tarjeta bg-[#e8ebe3]"
        etiqueta={`Mapa de la flota con ${conPosicion.length} buses`}
        buses={conPosicion.map((v) => ({ id: v.itineraryId, lat: v.posicion!.lat, lng: v.posicion!.lng, color: colorDe(v).color, etiqueta: `${v.origen} → ${v.destino}` }))}
        respaldo={
          <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} role="img" aria-label={`Mapa de la flota con ${conPosicion.length} buses`} className="w-full rounded-tarjeta bg-[#e8ebe3]">
            {conPosicion.map((v) => {
              const p = proyeccion(v.posicion!)
              const alerta = (v.alertas?.abiertas ?? 0) > 0
              return (
                <g key={v.itineraryId} transform={`translate(${p.x} ${p.y})`}>
                  {alerta && <circle r="16" fill="none" stroke="#d7263d" strokeWidth="3" />}
                  <circle r="9" fill={colorDe(v).color} stroke="#0d1411" strokeWidth="2.5" />
                  <text y="-14" textAnchor="middle" fontSize="12" fontWeight="700" fill="#0d1411" paintOrder="stroke" stroke="#e8ebe3" strokeWidth="4">
                    {v.destino}
                  </text>
                </g>
              )
            })}
          </svg>
        }
      />
      <figcaption>
        <ul aria-label="Convenciones" className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] font-semibold">
          {Object.values(COLOR_RASTREO).map((c) => (
            <li key={c.texto} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-3 rounded-full border border-tinta" style={{ background: c.color }} />
              {c.texto}
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  )
}

function TarjetaFlota({ v, alVerLinea, alTerminar }: { v: ViajeFlota; alVerLinea: () => void; alTerminar: () => void }) {
  const c = colorDe(v)
  const sig = v.siguienteParada
  return (
    <article aria-label={`${v.origen} a ${v.destino}`} className={cn('flex flex-col gap-2 rounded-tarjeta bg-superficie p-4', (v.alertas?.abiertas ?? 0) > 0 && 'border-2 border-presencia-borde')}>
      <span className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 flex-col">
          <span className="font-semibold">
            {v.origen} → {v.destino}
          </span>
          <span className="text-[13px] text-texto-2">
            Salió {horaCorta(v.fechaSalida)}
            {v.conductor?.nombre ? ` · ${v.conductor.nombre}` : ''}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-[12px] font-bold">
          <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: c.color }} />
          {c.texto}
        </span>
      </span>
      <span className="text-[13px]">
        {v.retrasoMinutos && v.retrasoMinutos > 0 ? <span className="font-semibold text-presencia-borde">+{v.retrasoMinutos} min · </span> : 'A tiempo · '}
        {sig ? (
          <>
            Sigue {sig.nombre} a las <span className="num">{horaCorta(sig.estimada ?? sig.programada)}</span>
          </>
        ) : (
          'Sin paradas pendientes'
        )}
        {v.estadoRastreo === 'SIN_SENAL' && v.posicion ? ` · última señal ${horaCorta(v.posicion.timestamp)}` : ''}
      </span>
      {(v.alertas?.abiertas ?? 0) > 0 && (
        <span className="text-[13px] font-semibold text-alerta">
          {v.alertas!.abiertas === 1 ? '1 alerta abierta' : `${v.alertas!.abiertas} alertas abiertas`}
          {v.alertas!.mayorGravedad ? ` · ${v.alertas!.mayorGravedad.toLowerCase()}` : ''}
        </span>
      )}
      <span className="flex flex-wrap gap-2">
        <Button variante="contorno" tamano="md" onClick={alVerLinea}>
          Línea de tiempo
        </Button>
        <Link to={`/panel/viaje/${v.itineraryId}`} className={buttonVariants({ variante: 'contorno', tamano: 'md' })}>
          Panel del viaje
        </Link>
        {!v.finalizado && (
          <Button variante="fantasma" tamano="md" onClick={alTerminar}>
            Forzar fin
          </Button>
        )}
      </span>
    </article>
  )
}

function PanelAlertas({ consulta }: { consulta: ReturnType<typeof useQuery<AlertaViaje[]>> }) {
  const queryClient = useQueryClient()
  const [resolviendo, setResolviendo] = useState<AlertaViaje | null>(null)
  const resolver = useMutation({
    mutationFn: ({ a, nota }: { a: AlertaViaje; nota: string }) => api.flota.resolverAlerta(a.itineraryId, a.alertId, nota),
    onSuccess: () => {
      toast('Alerta resuelta.')
      setResolviendo(null)
      void queryClient.invalidateQueries({ queryKey: ['alertas'] })
      void queryClient.invalidateQueries({ queryKey: ['flota'] })
    },
    onError: (e) => toast(textoError(e)),
  })
  const lista = ordenarAlertas(consulta.data ?? [])
  return (
    <section aria-label="Alertas abiertas" className="flex flex-col gap-2">
      <h2 className="text-[18px] font-semibold">Alertas abiertas</h2>
      <Resultado consulta={consulta} hayDatos={lista.length > 0} bloques={[80]} vacio="No hay alertas abiertas.">
        <ul className="grid gap-2 md:grid-cols-2">
          {lista.map((a) => {
            const maxima = esAlertaMaxima(a)
            return (
              <li key={a.alertId} className={cn('flex items-start gap-3 rounded-tarjeta p-4', maxima ? 'bg-alerta text-white' : 'bg-presencia text-alerta')}>
                <Siren className="mt-0.5 size-6 shrink-0" aria-hidden="true" />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="font-bold">
                    {a.tipo === 'SOS' ? 'SOS' : a.tipo} · {a.gravedad}
                  </span>
                  <span className="text-[14px]">{a.mensaje}</span>
                  <span className="text-[12px] opacity-80">
                    {fechaHora(a.creadoEn)}
                    {a.puedeContinuar === false ? ' · el bus no puede continuar' : ''}
                  </span>
                </span>
                <Button variante={maxima ? 'acento' : 'contorno'} tamano="md" onClick={() => setResolviendo(a)}>
                  Resolver
                </Button>
              </li>
            )
          })}
        </ul>
      </Resultado>
      <HojaMotivo
        abierta={!!resolviendo}
        alCerrar={() => setResolviendo(null)}
        titulo="Resolver la alerta"
        descripcion={resolviendo?.mensaje}
        etiquetaMotivo="Nota de lo que se hizo"
        boton="Marcar como resuelta"
        ocupado={resolver.isPending}
        alConfirmar={(nota) => resolviendo && resolver.mutate({ a: resolviendo, nota })}
      />
    </section>
  )
}

function LineaDeTiempo({ viaje, alCerrar }: { viaje: ViajeFlota | null; alCerrar: () => void }) {
  const q = useQuery({ queryKey: ['novedades', viaje?.itineraryId], queryFn: () => api.viaje.novedades(viaje!.itineraryId), enabled: !!viaje })
  const lista = [...(q.data ?? [])].sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  return (
    <Hoja abierta={!!viaje} alCambiar={(a) => !a && alCerrar()} titulo="Línea de tiempo" descripcion={viaje ? `${viaje.origen} → ${viaje.destino}` : undefined}>
      <div className="pb-3">
        <Resultado consulta={q} hayDatos={lista.length > 0} vacio="Aún no hay novedades en este viaje.">
          <ol className="flex flex-col gap-2">
            {lista.map((n) => (
              <li key={n.tripEventId} className="rounded-[14px] bg-fondo p-3 text-[14px]">
                <span className="font-semibold">{n.tipo}</span> · <span className="num">{horaCorta(n.timestamp)}</span>
                {n.descripcion && <span className="block">{n.descripcion}</span>}
              </li>
            ))}
          </ol>
        </Resultado>
      </div>
    </Hoja>
  )
}
