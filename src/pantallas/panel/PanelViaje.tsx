import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigation, Radio, Send, Zap } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { BotonVolver } from '@/components/marca/BotonVolver'
import { Aviso, Esqueleto, PantallaError } from '@/components/marca/Estados'
import { LiveDot } from '@/components/marca/LiveDot'
import { PisoBus } from '@/components/marca/MapaBus'
import { Pantalla } from '@/components/marca/Pantalla'
import { buttonVariants } from '@/components/ui/button-variants'
import { Button } from '@/components/ui/button'
import { Hoja } from '@/components/ui/hoja'
import { Campo } from '@/components/ui/input'
import { useEnvioGps, type ModoGps } from '@/features/gps'
import { construirPisos } from '@/features/mapaAsientos'
import { haceCuanto } from '@/features/seguimiento'
import { useAhora } from '@/hooks/useAhora'
import { textoError } from '@/lib/api'
import { api } from '@/lib/endpoints'
import { dinero, fechaCorta, horaCorta, plural } from '@/lib/formato'
import { useSesion } from '@/lib/sesion'
import { topicos, useTopico } from '@/lib/tiempoReal'
import type { DetalleItinerario, EstadoOferta, Novedad, Oferta, TipoNovedad } from '@/lib/tipos'
import { cn } from '@/lib/utils'

const TIPOS: { tipo: TipoNovedad; texto: string }[] = [
  { tipo: 'INICIO', texto: 'Salimos' },
  { tipo: 'LLEGADA_PARADA', texto: 'Llegamos a parada' },
  { tipo: 'RETRASO', texto: 'Retraso' },
  { tipo: 'DESVIO', texto: 'Desvío' },
  { tipo: 'FIN', texto: 'Llegamos' },
]

const ARRANQUE_MS = 15_000

const ESTADO_OFERTA: Record<EstadoOferta, string> = {
  BORRADOR: 'Preparando',
  PROGRAMADA: 'Programada',
  ACTIVA: 'Activa',
  AGOTADA: 'Agotada',
  CERRADA: 'Cerrada',
}

/** Un viaje visto desde la empresa: novedades (US-046), GPS (US-038) y drops (US-054). */
export function PanelViaje() {
  const { itineraryId = '' } = useParams()
  const s = useSesion()!
  const detalle = useQuery({ queryKey: ['itinerario', itineraryId], queryFn: () => api.catalogo.itinerario(itineraryId) })
  const puedeOfertar = s.rol === 'OPERADOR' || s.rol === 'ADMIN'

  if (detalle.isError) return <PantallaError titulo="No pudimos abrir el viaje" error={detalle.error} reintentar={() => detalle.refetch()} volverA="/panel" />
  const d = detalle.data
  if (!d) {
    return (
      <Pantalla>
        <Esqueleto bloques={[70, 260, 160, 200]} />
      </Pantalla>
    )
  }

  return (
    <Pantalla>
      <header className="flex items-center gap-3 px-5">
        <BotonVolver a="/panel" />
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="truncate font-display text-[20px] font-bold tracking-[-0.01em]">
            {d.origen} → {d.destino}
          </h1>
          <span className="truncate text-[13px] text-texto-2">
            {fechaCorta(d.fechaSalida)} · <span className="num">{horaCorta(d.fechaSalida)}</span> · bus <span className="num">{d.placa}</span>
          </span>
        </div>
        <Link to={`/viaje/${d.itineraryId}/en-vivo`} className={buttonVariants({ variante: 'contorno', tamano: 'md' })}>
          Ver mapa
        </Link>
      </header>

      {d.estado === 'CANCELADO' && (
        <Aviso tono="alerta" className="mx-5 mt-3">
          Este viaje está cancelado.
        </Aviso>
      )}

      <div className="flex flex-col gap-3.5 px-5 pt-4 pb-6">
        <ReportarNovedad d={d} />
        <EnviarGps d={d} />
        {puedeOfertar && <Drops d={d} />}
      </div>
    </Pantalla>
  )
}

/* ------------------------------------------------------------------ novedades (US-046) */
function ReportarNovedad({ d }: { d: DetalleItinerario }) {
  const queryClient = useQueryClient()
  const [tipo, setTipo] = useState<TipoNovedad>('RETRASO')
  const [minutos, setMinutos] = useState('15')
  const [parada, setParada] = useState(d.paradas[1]?.nombre ?? d.paradas[0]?.nombre ?? '')
  const [descripcion, setDescripcion] = useState('')

  const novedades = useQuery({ queryKey: ['novedades', d.itineraryId], queryFn: () => api.viaje.novedades(d.itineraryId) })
  useTopico(topicos.novedades(d.itineraryId), (m) => {
    if (m.type === 'snapshot' && Array.isArray(m.data)) queryClient.setQueryData<Novedad[]>(['novedades', d.itineraryId], m.data as Novedad[])
    else void novedades.refetch()
  })

  const enviar = useMutation({
    mutationFn: () => {
      const detalle: Record<string, unknown> = {}
      if (tipo === 'RETRASO') detalle.minutos = Number(minutos)
      if (tipo === 'LLEGADA_PARADA') detalle.parada = parada
      const texto =
        descripcion.trim() ||
        (tipo === 'LLEGADA_PARADA' ? `Llegamos a ${parada}` : tipo === 'INICIO' ? `Salimos de ${d.origen}` : tipo === 'FIN' ? `Llegamos a ${d.destino}` : undefined)
      return api.viaje.reportar(d.itineraryId, { tipo, descripcion: texto, detalle })
    },
    onSuccess: () => {
      toast('Novedad enviada a los pasajeros.')
      setDescripcion('')
      void novedades.refetch()
    },
    onError: (e) => toast(textoError(e)),
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (tipo === 'RETRASO' && !(Number(minutos) > 0)) {
      toast('Escribe cuántos minutos de retraso.')
      return
    }
    enviar.mutate()
  }

  const lista = [...(novedades.data ?? [])].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 4)

  return (
    <section aria-label="Reportar novedad" className="flex flex-col gap-3 rounded-tarjeta bg-superficie p-4">
      <h2 className="flex items-center gap-2 text-[16px] font-semibold">
        <Send className="size-5" aria-hidden="true" />
        Reportar novedad
      </h2>
      <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
        <div role="radiogroup" aria-label="Tipo de novedad" className="flex flex-wrap gap-2">
          {TIPOS.map((t) => (
            <button
              key={t.tipo}
              type="button"
              role="radio"
              aria-checked={tipo === t.tipo}
              onClick={() => setTipo(t.tipo)}
              className={cn(
                'tap h-10 rounded-full border-[1.5px] px-3.5 text-[14px] font-semibold',
                tipo === t.tipo ? 'border-tinta bg-tinta text-white' : 'border-linea bg-superficie',
              )}
            >
              {t.texto}
            </button>
          ))}
        </div>
        {tipo === 'RETRASO' && (
          <Campo etiqueta="Minutos de retraso" inputMode="numeric" value={minutos} onChange={(e) => setMinutos(e.target.value.replace(/\D/g, '').slice(0, 3))} />
        )}
        {tipo === 'LLEGADA_PARADA' && (
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
            Parada
            <select value={parada} onChange={(e) => setParada(e.target.value)} className="h-12 rounded-control border-[1.5px] border-control bg-superficie px-3 text-base font-normal">
              {d.paradas.map((p) => (
                <option key={p.id}>{p.nombre}</option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
          Mensaje para los pasajeros (opcional)
          <textarea
            value={descripcion}
            maxLength={300}
            rows={2}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder={tipo === 'RETRASO' ? 'Cierre parcial en la vía. Avanzamos con normalidad.' : ''}
            className="rounded-control border-[1.5px] border-control bg-superficie px-3.5 py-3 text-base font-normal"
          />
        </label>
        <Button type="submit" ancho="completo" disabled={enviar.isPending}>
          {enviar.isPending ? 'Enviando…' : 'Enviar a los pasajeros'}
        </Button>
      </form>
      {lista.length > 0 && (
        <ul className="flex flex-col gap-1.5 border-t border-linea pt-3 text-[13px]">
          {lista.map((n) => (
            <li key={n.tripEventId} className="flex gap-2">
              <span className="num shrink-0 text-texto-2">{horaCorta(n.timestamp)}</span>
              <span className="min-w-0">
                <span className="font-semibold">{TIPOS.find((t) => t.tipo === n.tipo)?.texto ?? n.tipo}</span>
                {n.descripcion ? `: ${n.descripcion}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ GPS (US-038) */
function EnviarGps({ d }: { d: DetalleItinerario }) {
  const ahora = useAhora()
  const { modo, setModo, ultimo, error } = useEnvioGps(d)
  const opciones: { modo: ModoGps; texto: string; icono: typeof Radio }[] = [
    { modo: 'real', texto: 'GPS del teléfono', icono: Navigation },
    { modo: 'simulado', texto: 'Simular recorrido', icono: Radio },
  ]
  return (
    <section aria-label="Ubicación del bus" className="flex flex-col gap-3 rounded-tarjeta bg-superficie p-4">
      <h2 className="flex items-center gap-2 text-[16px] font-semibold">
        {modo !== 'apagado' ? <LiveDot /> : <Navigation className="size-5" aria-hidden="true" />}
        Ubicación del bus
      </h2>
      <p className="-mt-1 text-[13px] text-texto-2">
        Los pasajeros ven el bus en el mapa desde 30 min antes de la salida hasta 30 min después de la llegada.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {opciones.map((o) => {
          const on = modo === o.modo
          return (
            <button
              key={o.modo}
              type="button"
              aria-pressed={on}
              onClick={() => setModo(on ? 'apagado' : o.modo)}
              className={cn(
                'tap flex h-14 items-center justify-center gap-2 rounded-control border-[1.5px] text-[14px] font-semibold',
                on ? 'border-tinta bg-lima text-tinta' : 'border-linea bg-superficie',
              )}
            >
              <o.icono className="size-5" aria-hidden="true" />
              {on ? 'Detener' : o.texto}
            </button>
          )
        })}
      </div>
      {error && <Aviso tono="alerta">{error}</Aviso>}
      {ultimo && (
        <span role="status" className="text-[13px] text-texto-2">
          Última posición enviada hace {haceCuanto(Math.round((ahora - ultimo.en) / 1000))} ·{' '}
          <span className="num">
            {ultimo.lat.toFixed(4)}, {ultimo.lng.toFixed(4)}
          </span>
        </span>
      )}
      {modo === 'real' && <span className="text-[12px] text-texto-2">Mantén esta pantalla abierta: el navegador pausa el GPS en segundo plano.</span>}
    </section>
  )
}

/* ------------------------------------------------------------------ drops (US-054) */
function Drops({ d }: { d: DetalleItinerario }) {
  const queryClient = useQueryClient()
  const [creando, setCreando] = useState(false)
  const ofertas = useQuery({
    queryKey: ['ofertas', d.itineraryId],
    queryFn: () => api.ofertas.listar(d.itineraryId),
    refetchInterval: 5_000,
  })
  const accion = useMutation({
    mutationFn: ({ id, que }: { id: string; que: 'activar' | 'cerrar' }) => (que === 'activar' ? api.ofertas.activar(id) : api.ofertas.cerrar(id)),
    onSuccess: (_o, v) => {
      toast(v.que === 'activar' ? 'Drop activado.' : 'Drop cerrado. Los puestos sin vender vuelven a la venta normal.')
      void queryClient.invalidateQueries({ queryKey: ['ofertas', d.itineraryId] })
      void queryClient.invalidateQueries({ queryKey: ['asientos', d.itineraryId] })
    },
    onError: (e) => toast(textoError(e)),
  })
  const lista = ofertas.data ?? []

  return (
    <section aria-label="Drops" className="flex flex-col gap-3 rounded-tarjeta bg-superficie p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[16px] font-semibold">
          <Zap className="size-5" aria-hidden="true" />
          Drops de este viaje
        </h2>
        <Button variante="naranja" tamano="md" disabled={d.estado === 'CANCELADO'} onClick={() => setCreando(true)}>
          Crear drop
        </Button>
      </div>
      {lista.length === 0 ? (
        <p className="text-[14px] text-texto-2">Aún no hay drops. Un drop vende algunos puestos con descuento durante pocos minutos.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {lista.map((o) => (
            <FilaOferta key={o.offerId} o={o} ocupado={accion.isPending} alActivar={() => accion.mutate({ id: o.offerId, que: 'activar' })} alCerrar={() => accion.mutate({ id: o.offerId, que: 'cerrar' })} />
          ))}
        </ul>
      )}
      <CrearDrop d={d} abierto={creando} alCerrar={() => setCreando(false)} />
    </section>
  )
}

function FilaOferta({ o, ocupado, alActivar, alCerrar }: { o: Oferta; ocupado: boolean; alActivar: () => void; alCerrar: () => void }) {
  const viva = o.estado === 'ACTIVA' || o.estado === 'PROGRAMADA' || o.estado === 'AGOTADA'
  return (
    <li className={cn('flex flex-col gap-2 rounded-[18px] p-3', o.estado === 'ACTIVA' ? 'bg-presencia' : 'bg-fondo')}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span className={cn('rounded-md px-1.5 text-[12px] font-bold', o.estado === 'ACTIVA' ? 'bg-naranja text-tinta' : 'bg-linea text-tinta')}>
            {ESTADO_OFERTA[o.estado] ?? o.estado}
          </span>
          <span className="num text-[16px] font-bold">{dinero(o.precioOferta)}</span>
        </span>
        <span className="num text-[13px] text-texto-2">
          {o.cupoRestante}/{o.cupoMax} · hasta {horaCorta(o.fin)}
        </span>
      </div>
      <span className="text-[12px] text-texto-2">
        {plural(o.asientos.length, 'puesto', 'puestos')}: <span className="num">{o.asientos.join(', ')}</span>
      </span>
      <div className="flex gap-2">
        <Link to={`/drop/${o.offerId}`} className={buttonVariants({ variante: 'contorno', tamano: 'md', className: 'flex-1' })}>
          Ver como pasajero
        </Link>
        {o.estado === 'PROGRAMADA' && (
          <Button tamano="md" disabled={ocupado} onClick={alActivar}>
            Activar ya
          </Button>
        )}
        {viva && (
          <Button variante="fantasma" tamano="md" disabled={ocupado} onClick={alCerrar}>
            Cerrar
          </Button>
        )}
      </div>
    </li>
  )
}

function CrearDrop({ d, abierto, alCerrar }: { d: DetalleItinerario; abierto: boolean; alCerrar: () => void }) {
  const queryClient = useQueryClient()
  const [elegidos, setElegidos] = useState<string[]>([])
  const [precio, setPrecio] = useState(() => String(Math.max(100, Math.round((d.precioBase * 0.7) / 100) * 100)))
  const [cupo, setCupo] = useState('')
  const [minutos, setMinutos] = useState(30)
  const [pisoActivo, setPisoActivo] = useState(0)
  const ahora = useAhora(10_000)

  const mapa = useQuery({ queryKey: ['mapa', d.itineraryId], queryFn: () => api.catalogo.mapa(d.itineraryId), enabled: abierto, staleTime: Infinity })
  const estados = useQuery({ queryKey: ['asientos', d.itineraryId, 'panel'], queryFn: () => api.asientos.estados(d.itineraryId), enabled: abierto, refetchInterval: abierto ? 5_000 : false })
  const pisos = useMemo(() => (mapa.data ? construirPisos(mapa.data, estados.data) : []), [mapa.data, estados.data])
  const piso = pisos[Math.min(pisoActivo, Math.max(0, pisos.length - 1))]

  const crear = useMutation({
    mutationFn: () => {
      // Empieza en 15 s y no "ya": en main el scheduler podía activar la oferta antes de que Seat
      // Inventory reservara sus asientos y el cupo quedaba en 0 (develop lo corrige con BORRADOR, US-054).
      const inicio = new Date(Date.now() + ARRANQUE_MS)
      const fin = new Date(inicio.getTime() + minutos * 60_000)
      return api.ofertas.crear({
        itineraryId: d.itineraryId,
        seatNumbers: elegidos,
        precioOferta: Number(precio),
        cupo: Number(cupo || elegidos.length),
        inicio: inicio.toISOString(),
        fin: fin.toISOString(),
      })
    },
    onSuccess: () => {
      toast('Drop creado. Los pasajeros ya lo ven en el inicio.')
      setElegidos([])
      setCupo('')
      void queryClient.invalidateQueries({ queryKey: ['ofertas'] })
      alCerrar()
    },
    onError: (e) => toast(textoError(e)),
  })

  const cupoN = Number(cupo || elegidos.length)
  const precioN = Number(precio)
  const finDrop = ahora + ARRANQUE_MS + minutos * 60_000
  const problema =
    elegidos.length === 0
      ? 'Toca los puestos que entran al drop.'
      : !(precioN > 0) || precioN >= d.precioBase
        ? `El precio debe ser menor que ${dinero(d.precioBase)}.`
        : !(cupoN > 0) || cupoN > elegidos.length
          ? 'El cupo no puede ser mayor que los puestos elegidos.'
          : finDrop >= new Date(d.fechaSalida).getTime()
            ? 'El drop debe terminar antes de la salida del bus.'
            : null

  return (
    <Hoja abierta={abierto} alCambiar={(a) => !a && alCerrar()} titulo="Crear drop" descripcion={`Precio normal ${dinero(d.precioBase)}. Arranca 15 segundos después de crearlo.`}>
      <div className="flex flex-col gap-3 pb-2">
        {pisos.length > 1 && (
          <div role="tablist" aria-label="Piso" className="grid grid-cols-2 gap-1.5 rounded-control bg-[#e7eae2] p-1">
            {pisos.map((p, i) => (
              <button
                key={p.piso}
                role="tab"
                aria-selected={i === pisoActivo}
                onClick={() => setPisoActivo(i)}
                className={cn('h-10 rounded-[11px] text-[14px] font-semibold', i === pisoActivo ? 'bg-superficie' : 'text-texto-2')}
              >
                Piso {p.piso}
              </button>
            ))}
          </div>
        )}
        {piso ? (
          <PisoBus
            piso={piso}
            marcados={new Set(elegidos)}
            alTocar={(p) => setElegidos((e) => (e.includes(p.numero) ? e.filter((n) => n !== p.numero) : [...e, p.numero]))}
          />
        ) : (
          <Esqueleto className="px-0 pt-0" bloques={[300]} />
        )}
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Precio del drop" inputMode="numeric" value={precio} onChange={(e) => setPrecio(e.target.value.replace(/\D/g, '').slice(0, 7))} className="num" />
          <Campo
            etiqueta="Cupo"
            inputMode="numeric"
            placeholder={String(elegidos.length || 1)}
            value={cupo}
            onChange={(e) => setCupo(e.target.value.replace(/\D/g, '').slice(0, 3))}
            className="num"
            ayuda={plural(elegidos.length, 'puesto elegido', 'puestos elegidos')}
          />
        </div>
        <div role="radiogroup" aria-label="Duración" className="grid grid-cols-3 gap-2">
          {[15, 30, 60].map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={minutos === m}
              onClick={() => setMinutos(m)}
              className={cn('tap h-11 rounded-xl border-[1.5px] text-[14px] font-semibold', minutos === m ? 'border-tinta bg-tinta text-white' : 'border-linea')}
            >
              {m} min
            </button>
          ))}
        </div>
        {problema && <p className="text-[13px] text-texto-2">{problema}</p>}
        <Button variante="naranja" ancho="completo" disabled={!!problema || crear.isPending} onClick={() => crear.mutate()}>
          {crear.isPending ? 'Creando…' : `Lanzar drop de ${plural(cupoN || 0, 'puesto', 'puestos')}`}
        </Button>
      </div>
    </Hoja>
  )
}
