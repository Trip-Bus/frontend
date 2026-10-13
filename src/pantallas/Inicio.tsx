import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Minus, Plus, Search, Zap } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { aParametros, busquedaInicial, hoy, recordarBusqueda, type Busqueda } from '@/features/busqueda'
import { tamanoTitulo, veloFoto, visualDe } from '@/features/ciudadVisual'
import { useAcento } from '@/hooks/useAcento'
import { useAhora } from '@/hooks/useAhora'
import { BarraInferior } from '@/components/marca/BarraInferior'
import { Pantalla } from '@/components/marca/Pantalla'
import { Button } from '@/components/ui/button'
import { Hoja } from '@/components/ui/hoja'
import { api } from '@/lib/endpoints'
import { dinero, duracion, fechaCorta, fechaDesdeApi, iniciales, nombreCiudad, reloj, sumarDias } from '@/lib/formato'
import { useSesion } from '@/lib/sesion'
import { cn } from '@/lib/utils'

type Selector = 'origen' | 'cuando' | null

const vidrio = 'border border-white/20 bg-tinta/55 backdrop-blur-md'

/**
 * Pantalla 02. Inicio "ciudad de fondo": la foto del destino a pantalla completa, el nombre en grande
 * y un solo panel de búsqueda. Al cambiar de destino cambian la foto (fundido) y el color de acento.
 */
export function Inicio() {
  const navigate = useNavigate()
  const s = useSesion()
  const [busqueda, setBusqueda] = useState<Busqueda>(busquedaInicial)
  const [abierto, setAbierto] = useState<Selector>(null)
  useAcento(busqueda.destino)

  const ciudades = useQuery({ queryKey: ['ciudades'], queryFn: api.catalogo.ciudades, staleTime: Infinity })
  const usuario = useQuery({
    queryKey: ['usuario', s?.userId],
    queryFn: () => api.auth.usuario(s!.userId),
    enabled: !!s,
    staleTime: Infinity,
  })
  const mismaCiudad = busqueda.origen.trim().toLowerCase() === busqueda.destino.trim().toLowerCase()
  // Misma consulta (y caché) que la pantalla de salidas: el resumen sale de datos reales.
  const viajes = useQuery({
    queryKey: ['viajes', busqueda.origen, busqueda.destino, busqueda.fecha],
    queryFn: ({ signal }) => api.catalogo.buscar(busqueda.origen, busqueda.destino, busqueda.fecha, signal),
    enabled: !mismaCiudad,
    staleTime: 45_000,
  })

  // El destino elegido siempre queda a la vista en el carrusel (también al cambiarlo desde "Desde").
  const carril = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const chip = carril.current?.querySelector<HTMLElement>('[aria-checked="true"]')
    const reducir = matchMedia('(prefers-reduced-motion: reduce)').matches
    chip?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: reducir ? 'auto' : 'smooth' })
  }, [busqueda.destino, ciudades.data])

  const cambiar = (parcial: Partial<Busqueda>) => setBusqueda((b) => ({ ...b, ...parcial }))
  const buscar = () => {
    recordarBusqueda(busqueda)
    navigate(`/salidas?${aParametros(busqueda)}`)
  }

  const destinos = [
    ...(ciudades.data ?? []).filter((c) => c !== busqueda.origen),
  ]
  if (!destinos.includes(busqueda.destino) && !mismaCiudad) destinos.unshift(busqueda.destino)

  const disponibles = (viajes.data ?? []).filter((v) => !v.agotado)
  const resumen = mismaCiudad
    ? 'Elige un destino distinto al origen.'
    : viajes.isPending
      ? 'Buscando salidas…'
      : viajes.isError
        ? 'Toca "Ver salidas" para buscar de nuevo.'
        : disponibles.length === 0
          ? 'No hay puestos ese día. Prueba otra fecha.'
          : `${duracion(Math.min(...disponibles.map((v) => v.duracionMinutos)))} de viaje, desde ${dinero(
              Math.min(...disponibles.map((v) => v.ofertaActiva?.precioOferta ?? v.precioBase)),
            )}`
  const [dia, num] = fechaCorta(fechaDesdeApi(busqueda.fecha)).split(' ')
  const cuando = `${busqueda.fecha === hoy() ? 'hoy' : busqueda.fecha === sumarDias(hoy(), 1) ? 'mañana' : `${dia} ${num}`}, ${
    busqueda.pasajeros === 1 ? '1 persona' : `${busqueda.pasajeros} personas`
  }`

  return (
    <Pantalla oscura aSangre className="relative overflow-hidden">
      <FondoCiudad ciudad={busqueda.destino} />

      <header className="pt-seguro relative flex items-center justify-between px-5 [text-shadow:0_1px_14px_rgba(13,20,17,.45)]">
        <span className="font-display text-[22px] font-extrabold tracking-[-0.02em]">tripbus</span>
        {s ? (
          <Link to="/cuenta" aria-label={usuario.data?.nombre ? `Tu cuenta, ${usuario.data.nombre}` : 'Tu cuenta'} className={cn('tap flex size-10 items-center justify-center rounded-full text-[14px] font-bold', vidrio)}>
            {iniciales(usuario.data?.nombre)}
          </Link>
        ) : (
          <Link to="/entrar?siguiente=/inicio" className={cn('tap flex h-10 items-center rounded-full px-4 text-[15px] font-semibold', vidrio)}>
            Entrar
          </Link>
        )}
      </header>

      <section aria-live="polite" className="relative mt-14 px-5 [text-shadow:0_1px_14px_rgba(13,20,17,.45)]">
        <div key={busqueda.destino} className="entra flex flex-col gap-1.5">
          <span className="text-[17px] font-medium text-white/90">Vas a</span>
          <h1 className="font-display leading-[0.95] font-extrabold tracking-[-0.035em] break-words" style={{ fontSize: tamanoTitulo(busqueda.destino, 68) }}>
            {busqueda.destino}
          </h1>
          <span className="mt-1.5 text-[16px] text-white/90">{resumen}</span>
        </div>
      </section>

      <div className="min-h-8 flex-1" />

      <section aria-label="Buscar viaje" className="relative flex flex-col gap-3 px-4">
        <DropActivo />
        <div ref={carril} role="radiogroup" aria-label="Destino" className="carril -mx-4 gap-2 px-4">
          {destinos.map((c) => {
            const on = c === busqueda.destino
            return (
              <button
                key={c}
                role="radio"
                aria-checked={on}
                onClick={() => cambiar({ destino: c })}
                className={cn(
                  'h-10 rounded-full border-[1.5px] px-4 text-[15px] font-semibold backdrop-blur-md',
                  'transition-[scale,background-color,border-color,color] duration-300 active:scale-[0.96]',
                  on ? 'border-acento bg-acento text-tinta' : 'border-white/35 bg-tinta/50 text-white',
                )}
              >
                {c}
              </button>
            )
          })}
          {ciudades.isPending && <span className="h-10 w-40 rounded-full bg-tinta/50" />}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setAbierto('origen')} className={cn('tap flex h-14 flex-col justify-center rounded-2xl px-3.5 text-left', vidrio)}>
            <span className="text-[12px] text-white/80">Desde</span>
            <span className="truncate text-[16px] font-semibold">{busqueda.origen}</span>
          </button>
          <button onClick={() => setAbierto('cuando')} className={cn('tap flex h-14 flex-col justify-center rounded-2xl px-3.5 text-left', vidrio)}>
            <span className="text-[12px] text-white/80">Cuándo</span>
            <span className="truncate text-[16px] font-semibold">{cuando}</span>
          </button>
        </div>
        <Button variante="acento" ancho="completo" className="justify-between transition-[transform,background-color] duration-300" disabled={mismaCiudad} onClick={buscar}>
          <span className="truncate">Ver salidas a {busqueda.destino}</span>
          <ArrowRight className="size-[22px]" strokeWidth={2.5} aria-hidden="true" />
        </Button>
      </section>

      <div className="relative">
        <BarraInferior activa="viajar" />
      </div>

      <SelectorCiudad
        abierto={abierto === 'origen'}
        titulo="¿Desde dónde sales?"
        ciudades={ciudades.data ?? []}
        cargando={ciudades.isPending}
        alCerrar={() => setAbierto(null)}
        alElegir={(c) => {
          // Si el origen nuevo es el destino actual, se intercambian.
          cambiar(c === busqueda.destino ? { origen: c, destino: busqueda.origen } : { origen: c })
          setAbierto(null)
        }}
      />
      <SelectorCuando
        abierto={abierto === 'cuando'}
        fecha={busqueda.fecha}
        pasajeros={busqueda.pasajeros}
        alCambiar={cambiar}
        alCerrar={() => setAbierto(null)}
      />
    </Pantalla>
  )
}

/**
 * Foto del destino a pantalla completa. Al cambiar de ciudad la nueva entra con un fundido sobre la
 * anterior, y solo empieza cuando la foto terminó de cargar (nunca aparece a medias).
 */
function FondoCiudad({ ciudad }: { ciudad: string }) {
  const [arriba, setArriba] = useState(ciudad)
  const [abajo, setAbajo] = useState<string | null>(null)
  if (ciudad !== arriba) {
    setAbajo(arriba)
    setArriba(ciudad)
  }
  const capas = [abajo, arriba].filter((c): c is string => !!c && !!visualDe(c).foto)
  const v = visualDe(arriba)
  return (
    <div aria-hidden="true" className="absolute inset-0">
      {capas.map((c, i) => {
        const vc = visualDe(c)
        const esNueva = i === capas.length - 1 && c === arriba
        return (
          <img
            key={c}
            src={vc.foto!}
            alt=""
            decoding="async"
            className={cn('absolute inset-0 size-full object-cover', esNueva && abajo !== null && 'opacity-0')}
            style={{ objectPosition: vc.pos.portada }}
            onLoad={(e) => {
              if (esNueva) e.currentTarget.classList.add('tb-fundido')
            }}
          />
        )
      })}
      <div className="absolute inset-0" style={{ background: v.foto ? veloFoto(v) : '#0d1411' }} />
    </div>
  )
}

/** Teaser del drop activo (ofertas flash reales del backend). Si no hay, no se muestra nada. */
function DropActivo() {
  const ahora = useAhora()
  const ofertas = useQuery({ queryKey: ['ofertas'], queryFn: () => api.ofertas.listar(), refetchInterval: 30_000 })
  const [cargadoEn] = useState(() => Date.now())
  const activa = ofertas.data?.find((o) => o.estado === 'ACTIVA' && o.cupoRestante > 0)
  if (!activa) return null
  const restante = activa.segundosRestantes - Math.floor((ahora - (ofertas.dataUpdatedAt || cargadoEn)) / 1000)
  if (restante <= 0) return null
  return (
    <Link to={`/drop/${activa.offerId}`} className={cn('tap flex h-12 items-center gap-2.5 rounded-2xl px-3.5', vidrio)}>
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-naranja text-tinta">
        <Zap className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">
        Drop: {dinero(activa.precioOferta)} por puesto, {activa.cupoRestante === 1 ? 'queda 1' : `quedan ${activa.cupoRestante}`}
      </span>
      <span className="num shrink-0 text-[15px] font-bold">{reloj(restante)}</span>
    </Link>
  )
}

function SelectorCiudad({
  abierto,
  titulo,
  ciudades,
  cargando,
  alCerrar,
  alElegir,
}: {
  abierto: boolean
  titulo: string
  ciudades: string[]
  cargando: boolean
  alCerrar: () => void
  alElegir: (ciudad: string) => void
}) {
  const [texto, setTexto] = useState('')
  const norm = (v: string) => v.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  const filtradas = ciudades.filter((c) => norm(c).includes(norm(texto.trim())))
  const libre = texto.trim() && !filtradas.some((c) => norm(c) === norm(texto.trim()))

  return (
    <Hoja
      abierta={abierto}
      alCambiar={(a) => {
        if (!a) {
          setTexto('')
          alCerrar()
        }
      }}
      titulo={titulo}
    >
      <label className="relative block">
        <span className="sr-only">Buscar ciudad</span>
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-texto-2" aria-hidden="true" />
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escribe una ciudad"
          enterKeyHint="search"
          autoCapitalize="words"
          className="h-13 w-full rounded-control border-[1.5px] border-control bg-superficie pr-3.5 pl-11"
        />
      </label>
      <ul className="mt-2 flex flex-col pb-2">
        {cargando && <li className="py-4 text-[15px] text-texto-2">Cargando ciudades…</li>}
        {filtradas.map((c) => (
          <li key={c}>
            <button onClick={() => alElegir(c)} className="tap flex h-13 w-full items-center border-b border-linea text-left text-[16px]">
              {c}
            </button>
          </li>
        ))}
        {libre && (
          <li>
            <button onClick={() => alElegir(nombreCiudad(texto, ciudades))} className="tap flex h-13 w-full items-center text-left text-[16px]">
              Buscar “{texto.trim()}”
            </button>
          </li>
        )}
      </ul>
    </Hoja>
  )
}


function SelectorCuando({
  abierto,
  fecha,
  pasajeros,
  alCambiar,
  alCerrar,
}: {
  abierto: boolean
  fecha: string
  pasajeros: number
  alCambiar: (parcial: Partial<Busqueda>) => void
  alCerrar: () => void
}) {
  const inicio = hoy()
  const dias = Array.from({ length: 21 }, (_, i) => sumarDias(inicio, i))
  return (
    <Hoja abierta={abierto} alCambiar={(a) => !a && alCerrar()} titulo="¿Cuándo viajas?">
      <div className="grid grid-cols-3 gap-2">
        {dias.map((d, i) => {
          const [dia, num, mes] = fechaCorta(fechaDesdeApi(d)).split(' ')
          const on = d === fecha
          return (
            <button
              key={d}
              aria-pressed={on}
              onClick={() => alCambiar({ fecha: d })}
              className={cn(
                'tap flex h-16 flex-col items-center justify-center rounded-2xl border-[1.5px] transition-[transform,background-color]',
                on ? 'border-tinta bg-tinta text-white' : 'border-linea bg-superficie',
              )}
            >
              <span className="text-[12px] font-semibold">{i === 0 ? 'hoy' : i === 1 ? 'mañana' : dia}</span>
              <span className="num text-[15px] font-bold">
                {num} {mes}
              </span>
            </button>
          )
        })}
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-linea py-4">
        <span className="text-[16px] font-semibold">Personas</span>
        <span className="flex items-center gap-3">
          <Button variante="contorno" tamano="icono" aria-label="Una persona menos" disabled={pasajeros <= 1} onClick={() => alCambiar({ pasajeros: pasajeros - 1 })}>
            <Minus aria-hidden="true" />
          </Button>
          <span className="num w-8 text-center text-[26px] font-bold" aria-live="polite">
            {pasajeros}
          </span>
          <Button variante="contorno" tamano="icono" aria-label="Una persona más" disabled={pasajeros >= 6} onClick={() => alCambiar({ pasajeros: pasajeros + 1 })}>
            <Plus aria-hidden="true" />
          </Button>
        </span>
      </div>
      <Button ancho="completo" className="mb-2" onClick={alCerrar}>
        Listo
      </Button>
    </Hoja>
  )
}
