import { useQueries, useQuery } from '@tanstack/react-query'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { useState } from 'react'
import { aParametros, desdeParametros, hoy, type Busqueda } from '@/features/busqueda'
import { BotonVolver } from '@/components/marca/BotonVolver'
import { tamanoTitulo, visualDe } from '@/features/ciudadVisual'
import { useAcento } from '@/hooks/useAcento'
import { Pantalla } from '@/components/marca/Pantalla'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api'
import { api } from '@/lib/endpoints'
import {
  diasDespues,
  dinero,
  dineroCorto,
  duracion,
  fechaCorta,
  fechaDesdeApi,
  horaCorta,
  plural,
  sumarDias,
} from '@/lib/formato'
import type { ResultadoViaje } from '@/lib/tipos'
import { cn } from '@/lib/utils'

const consultaViajes = (b: Pick<Busqueda, 'origen' | 'destino' | 'fecha'>) => ({
  queryKey: ['viajes', b.origen, b.destino, b.fecha],
  queryFn: ({ signal }: { signal: AbortSignal }) => api.catalogo.buscar(b.origen, b.destino, b.fecha, signal),
  staleTime: 45_000, // igual que el cache de búsqueda del Catalog Service
})

/** Precio que paga el pasajero: el de la oferta si hay una activa. */
const precioFinal = (v: ResultadoViaje) => v.ofertaActiva?.precioOferta ?? v.precioBase

/** Pantalla 03. Salidas del día: precio más bajo por día, regla de 24 h y tarjetas robustas al peor caso. */
export function Salidas() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const busqueda = desdeParametros(params)
  const [elegida, setElegida] = useState(0)

  useAcento(busqueda?.destino)
  const resultado = useQuery({ ...consultaViajes(busqueda ?? { origen: '', destino: '', fecha: '' }), enabled: !!busqueda })

  // Tira de días: el precio más bajo de cada día (comparten cache con la búsqueda principal).
  const inicio = busqueda ? maxFecha(hoy(), sumarDias(busqueda.fecha, -1)) : hoy()
  const dias = Array.from({ length: 5 }, (_, i) => sumarDias(inicio, i))
  const porDia = useQueries({
    queries: dias.map((fecha) => ({ ...consultaViajes({ ...(busqueda as Busqueda), fecha }), enabled: !!busqueda })),
  })

  if (!busqueda) return <Navigate to="/inicio" replace />

  const irAFecha = (fecha: string) => {
    setElegida(0)
    setParams(aParametros({ ...busqueda, fecha }), { replace: true })
  }

  const viajes = [...(resultado.data ?? [])].sort((a, b) => a.fechaSalida.localeCompare(b.fechaSalida))
  const sel = Math.min(elegida, Math.max(0, viajes.length - 1))

  return (
    <Pantalla aSangre>
      <FranjaCiudad
        destino={busqueda.destino}
        subtitulo={`Desde ${busqueda.origen}, ${fechaCorta(fechaDesdeApi(busqueda.fecha))}, ${plural(busqueda.pasajeros, 'persona', 'personas')}`}
        conteo={resultado.isSuccess && viajes.some((v) => !v.agotado) ? plural(viajes.filter((v) => !v.agotado).length, 'salida con puestos', 'salidas con puestos') : null}
      />

      <div className="relative -mt-6 flex min-h-0 flex-1 flex-col rounded-t-[28px] bg-fondo pt-4">
      <div role="tablist" aria-label="Día del viaje" className="carril gap-2 px-5">
        {dias.map((fecha, i) => {
          const on = fecha === busqueda.fecha
          const datos = porDia[i]?.data?.filter((v) => !v.agotado)
          const minimo = datos && datos.length > 0 ? Math.min(...datos.map(precioFinal)) : null
          const [dia, num] = fechaCorta(fechaDesdeApi(fecha)).split(' ')
          return (
            <button
              key={fecha}
              role="tab"
              aria-selected={on}
              onClick={() => irAFecha(fecha)}
              className={cn(
                'tap flex h-[62px] w-[68px] flex-col items-center justify-center gap-0.5 rounded-2xl border-[1.5px] transition-[transform,background-color]',
                on ? 'border-tinta bg-tinta text-white' : 'border-linea bg-superficie text-tinta',
              )}
            >
              <span className="text-[12px] font-semibold">
                {dia} {num}
              </span>
              <span className="num text-[13px] font-bold">{porDia[i]?.isPending ? '···' : dineroCorto(minimo)}</span>
            </button>
          )
        })}
      </div>

      {resultado.isPending ? (
        <Esqueleto />
      ) : resultado.isError ? (
        <ErrorBusqueda error={resultado.error} reintentar={() => resultado.refetch()} />
      ) : viajes.length === 0 ? (
        <SinViajes alSiguiente={() => irAFecha(sumarDias(busqueda.fecha, 1))} />
      ) : (
        <>
          <Regla viajes={viajes} elegida={sel} alElegir={setElegida} />
          <ul className="scroll-hoja flex min-h-0 flex-1 flex-col gap-2.5 px-5 pt-3 pb-[calc(20px+env(safe-area-inset-bottom,0px))]">
            {viajes.map((v, i) => (
              <li key={v.itineraryId} className="entra" style={{ animationDelay: `${Math.min(i, 4) * 50}ms` }}>
                <TarjetaViaje
                  viaje={v}
                  elegida={i === sel}
                  alAbrir={() => navigate(`/viaje/${v.itineraryId}/asientos?pasajeros=${busqueda.pasajeros}`)}
                />
              </li>
            ))}
          </ul>
        </>
      )}
      </div>
    </Pantalla>
  )
}

function maxFecha(a: string, b: string) {
  return a > b ? a : b
}

function horaDecimal(iso: string) {
  const [h, m] = horaCorta(iso).split(':').map(Number)
  return h + m / 60
}

/** Regla de 24 h: cada salida es un punto; tocarlo resalta su tarjeta. */
function Regla({ viajes, elegida, alElegir }: { viajes: ResultadoViaje[]; elegida: number; alElegir: (i: number) => void }) {
  return (
    <section aria-label="Salidas en el día" className="mx-5 mt-3.5 rounded-[20px] bg-superficie px-3.5 pt-3 pb-2.5">
      <div className="mb-2 flex justify-between text-[12px] text-texto-2">
        <span>{plural(viajes.length, 'salida', 'salidas')}</span>
        <span>toca un punto</span>
      </div>
      <div className="relative h-[34px]">
        <span className="absolute inset-x-0 top-4 h-0.5 bg-linea" />
        {[25, 50, 75].map((p) => (
          <span key={p} className="absolute top-3 h-2.5 w-[1.5px] bg-[#b8beb6]" style={{ left: `${p}%` }} />
        ))}
        {viajes.map((v, i) => {
          const on = i === elegida
          return (
            <button
              key={v.itineraryId}
              aria-label={`Salida de las ${horaCorta(v.fechaSalida)}`}
              aria-pressed={on}
              onClick={() => alElegir(i)}
              className="absolute top-0 -ml-[17px] flex size-[34px] items-center justify-center"
              style={{ left: `${(horaDecimal(v.fechaSalida) / 24) * 100}%` }}
            >
              <span
                className={cn(
                  'size-3.5 rounded-full border-[2.5px] transition-transform duration-200 ease-out',
                  v.agotado ? 'border-control bg-fondo' : on ? 'border-tinta bg-acento' : 'border-tinta bg-tinta',
                )}
                style={{ transform: on ? 'scale(1.35)' : 'scale(1)' }}
              />
            </button>
          )
        })}
      </div>
      <div className="num flex justify-between text-[11px] text-texto-2">
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>24</span>
      </div>
    </section>
  )
}

function TarjetaViaje({ viaje: v, elegida, alAbrir }: { viaje: ResultadoViaje; elegida: boolean; alAbrir: () => void }) {
  const masDias = diasDespues(v.fechaSalida, v.fechaLlegadaEstimada)

  if (v.agotado) {
    return (
      <div className="flex items-center gap-3 rounded-tarjeta bg-[#eceee7] px-4 py-3.5">
        <span className="num shrink-0 text-[20px] font-bold text-texto-2 line-through">{horaCorta(v.fechaSalida)}</span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[14px] font-semibold text-texto-2">Agotado</span>
          <span title={v.empresa} className="truncate text-[13px] text-texto-2">
            {v.empresa}
          </span>
        </span>
      </div>
    )
  }

  const libres = v.asientosDisponibles
  const vendidos = libres == null ? null : Math.max(0, v.capacidad - libres)
  const llenas = vendidos == null ? 0 : Math.round((vendidos / Math.max(1, v.capacidad)) * 10)
  const oferta = v.ofertaActiva
  const descuento = oferta ? Math.round((1 - oferta.precioOferta / v.precioBase) * 100) : 0

  return (
    <button
      onClick={alAbrir}
      className={cn(
        'tap flex w-full flex-col gap-2.5 rounded-tarjeta border-2 bg-superficie px-4 py-3.5 text-left transition-[transform,border-color]',
        elegida ? 'border-tinta' : 'border-transparent',
      )}
    >
      <div className="flex w-full items-center gap-3">
        <span className="num shrink-0 text-[22px] font-bold">{horaCorta(v.fechaSalida)}</span>
        <span className="flex min-w-3 flex-1 flex-col items-center gap-0.5">
          <span className="text-[11px] whitespace-nowrap text-texto-2">{duracion(v.duracionMinutos)}</span>
          <span className="h-0.5 w-full rounded-full bg-tinta" />
        </span>
        <span className="num shrink-0 text-[22px] font-bold">
          {horaCorta(v.fechaLlegadaEstimada)}
          {masDias > 0 && <sup className="ml-0.5 text-[11px] text-texto-2">+{masDias}</sup>}
        </span>
      </div>
      <div className="flex w-full items-end gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span title={v.empresa} className="truncate text-[14px] font-semibold">
            {v.empresa}
          </span>
          {libres == null ? (
            <span className="text-[13px] text-texto-2">Toca para ver los puestos</span>
          ) : (
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="grid shrink-0 grid-cols-[repeat(10,5px)] gap-0.5">
                {Array.from({ length: 10 }, (_, k) => (
                  <span key={k} className={cn('h-3 rounded-[2px]', k < llenas ? 'bg-tinta' : 'bg-linea')} />
                ))}
              </span>
              <span className={cn('text-[13px] font-semibold whitespace-nowrap', libres <= 3 ? 'text-presencia-borde' : 'text-texto-2')}>
                {libres === 1 ? 'Último puesto' : `${libres} libres`}
              </span>
            </span>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end">
          {oferta && (
            <>
              <span className="mb-1 flex h-5 items-center rounded-md bg-naranja px-1.5 text-[11px] font-extrabold text-tinta">
                DROP −{descuento}%
              </span>
              <span className="num text-[13px] text-texto-2 line-through">{dinero(v.precioBase)}</span>
            </>
          )}
          <span className="num text-[20px] font-bold">{dinero(precioFinal(v))}</span>
        </div>
      </div>
    </button>
  )
}

function Esqueleto() {
  return (
    <div aria-busy="true" aria-label="Buscando salidas" className="flex flex-col gap-2.5 px-5 pt-3.5">
      <div className="h-[86px] rounded-[20px] bg-superficie" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex h-[112px] flex-col justify-between rounded-tarjeta bg-superficie p-4">
          <div className="h-5 w-3/4 rounded-md bg-[#eceee7]" />
          <div className="h-4 w-1/2 rounded-md bg-[#eceee7]" />
        </div>
      ))}
    </div>
  )
}

function SinViajes({ alSiguiente }: { alSiguiente: () => void }) {
  return (
    <section className="flex flex-1 flex-col items-center gap-3.5 px-7 pt-10 text-center">
      <div aria-hidden="true" className="relative mb-2.5 h-6 w-[200px]">
        <span className="absolute inset-x-0 top-[11px] h-0.5 bg-[repeating-linear-gradient(90deg,#8c948e_0_8px,transparent_8px_14px)]" />
        <span className="absolute top-1.5 left-0 size-3 rounded-full border-[2.5px] border-tinta bg-fondo" />
        <span className="absolute top-1.5 right-0 size-3 rounded-full bg-tinta" />
      </div>
      <h2 className="font-display text-[24px] font-bold tracking-[-0.01em]">Ningún bus sale ese día</h2>
      <p className="text-[15px] leading-relaxed text-texto-2">Mira un día cercano: arriba ves el precio más bajo de cada uno.</p>
      <Button ancho="completo" className="mt-2" onClick={alSiguiente}>
        Ver el día siguiente
      </Button>
    </section>
  )
}

function ErrorBusqueda({ error, reintentar }: { error: Error; reintentar: () => void }) {
  const texto = error instanceof ApiError ? error.paraUsuario : 'No pudimos buscar. Intenta de nuevo.'
  return (
    <section role="alert" className="flex flex-col items-center gap-3.5 px-7 pt-12 text-center">
      <h2 className="font-display text-[22px] font-bold">No pudimos buscar</h2>
      <p className="text-[15px] text-texto-2">{texto}</p>
      <Button variante="contorno" onClick={reintentar}>
        Intentar de nuevo
      </Button>
    </section>
  )
}

/** Franja superior con la foto del destino (diseño "ciudad de fondo"). Sin foto: franja tinta. */
function FranjaCiudad({ destino, subtitulo, conteo }: { destino: string; subtitulo: string; conteo: string | null }) {
  const v = visualDe(destino)
  return (
    <div className="relative h-[clamp(240px,36dvh,312px)] shrink-0 overflow-hidden bg-tinta text-white">
      {v.foto && (
        <img src={v.foto} alt="" decoding="async" className="absolute inset-0 size-full object-cover" style={{ objectPosition: v.pos.franja }} />
      )}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, rgba(13,20,17,.5) 0%, rgba(13,20,17,0) 38%, rgba(13,20,17,.78) 100%)' }}
      />
      <div className="pt-seguro absolute inset-x-0 top-0 flex items-center justify-between px-5">
        <BotonVolver a="/inicio" className="border border-white/25 bg-tinta/40 text-white backdrop-blur-md" />
        {conteo && (
          <span className="flex h-8 items-center gap-2 rounded-full bg-tinta/55 px-3 text-[12px] font-semibold backdrop-blur-md">
            <span aria-hidden="true" className="size-2 rounded-full bg-acento" />
            {conteo}
          </span>
        )}
      </div>
      <div className="absolute inset-x-5 bottom-11 flex flex-col gap-1 [text-shadow:0_1px_14px_rgba(13,20,17,.5)]">
        <span className="text-[15px] text-white/90">{subtitulo}</span>
        <h1 className="font-display leading-[0.95] font-extrabold tracking-[-0.035em] break-words" style={{ fontSize: tamanoTitulo(destino, 52) }}>{destino}</h1>
      </div>
    </div>
  )
}
