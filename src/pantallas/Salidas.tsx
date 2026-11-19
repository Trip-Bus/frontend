import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { ArrowLeftRight, SlidersHorizontal } from 'lucide-react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { useState, type FormEvent } from 'react'
import { aParametros, cuantosFiltros, desdeParametros, hoy, rutaAsientos, type Busqueda, type Filtros } from '@/features/busqueda'
import { BotonVolver } from '@/components/marca/BotonVolver'
import { CampoLugar } from '@/components/marca/CampoLugar'
import { CargarMas } from '@/components/marca/Consulta'
import { IconosServicios } from '@/components/marca/IconosServicios'
import { tamanoTitulo, visualDe } from '@/features/ciudadVisual'
import { useAcento } from '@/hooks/useAcento'
import { Pantalla } from '@/components/marca/Pantalla'
import { Button } from '@/components/ui/button'
import { Casilla, Segmentos } from '@/components/ui/campos'
import { Hoja } from '@/components/ui/hoja'
import { Campo } from '@/components/ui/input'
import { ApiError } from '@/lib/api'
import { api } from '@/lib/endpoints'
import {
  diasDespues,
  dinero,
  duracion,
  fechaCorta,
  fechaDesdeApi,
  horaCorta,
  plural,
  sumarDias,
} from '@/lib/formato'
import type { ResultadoViaje } from '@/lib/tipos'
import { cn } from '@/lib/utils'
import { consultaFacetas, filtrosDelCalendario, indiceMasBarato, precioDe, recortarPrecio } from '@/features/precios'
import { FilaDias } from './salidas/FilaDias'
import { HojaFiltros } from './salidas/Filtros'

const POR_PAGINA = 20

const salidaDe = (v: ResultadoViaje) => v.salida ?? v.fechaSalida
const llegadaDe = (v: ResultadoViaje) => v.llegada ?? v.fechaLlegadaEstimada

/** Lee los filtros de la URL (así se pueden compartir y sobreviven a recargar). */
function filtrosDe(p: URLSearchParams): Filtros {
  const n = (k: string) => (p.get(k) ? Number(p.get(k)) : undefined)
  return {
    companyId: p.get('empresa') ?? undefined,
    franja: (p.get('franja') ?? undefined) as Filtros['franja'],
    precioMin: n('min'),
    precioMax: n('max'),
    tipoBus: p.get('bus') ?? undefined,
    sort: (p.get('orden') ?? undefined) as Filtros['sort'],
    order: (p.get('dir') ?? undefined) as Filtros['order'],
  }
}

function conFiltros(base: string, f: Filtros, regreso: string | null): string {
  const p = new URLSearchParams(base)
  const poner = (k: string, v: unknown) => (v != null && v !== '' ? p.set(k, String(v)) : p.delete(k))
  poner('empresa', f.companyId)
  poner('franja', f.franja)
  poner('min', f.precioMin)
  poner('max', f.precioMax)
  poner('bus', f.tipoBus)
  poner('orden', f.sort)
  poner('dir', f.order)
  poner('regreso', regreso)
  return p.toString()
}

/**
 * Pantalla 03. Salidas (P-01): fila de 7 días con el precio "desde" más bajo (/trips/calendar con los mismos tramos y
 * filtros que la lista), filtros (empresa, franja, precio con los límites de /trips/search/facets, tipo de bus,
 * orden), paginado con "Cargar más" (X-Total-Count), ida y vuelta (/trips/round-trip),
 * tramos intermedios (fromOrden/toOrden pasan a los puestos) e íconos de servicios del bus.
 */
export function Salidas() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const busqueda = desdeParametros(params)
  const filtrosUrl = filtrosDe(params)
  const regreso = params.get('regreso')
  const [elegida, setElegida] = useState(0)
  const [verFiltros, setVerFiltros] = useState(false)
  const [editando, setEditando] = useState(false)
  const [sentido, setSentido] = useState<'ida' | 'vuelta'>('ida')
  useAcento(busqueda?.destino)

  const b = busqueda ?? { origen: '', destino: '', fecha: hoy(), pasajeros: 1 }
  // Límites de precio de ese día y esa ruta: el rango elegido se recorta si quedó por fuera (cambio de día o de ruta).
  const facetas = useQuery({ ...consultaFacetas(b, filtrosUrl), enabled: !!busqueda })
  const filtros = recortarPrecio(filtrosUrl, facetas.data)
  // Con un precio en la URL se esperan los límites para no buscar dos veces (con y sin recorte).
  const esperaLimites = (filtrosUrl.precioMin != null || filtrosUrl.precioMax != null) && facetas.isPending
  const resultado = useInfiniteQuery({
    queryKey: ['viajes-filtrados', b.origen, b.destino, b.fecha, filtros],
    queryFn: ({ pageParam, signal }) => api.catalogo.buscarFiltrado(b.origen, b.destino, b.fecha, { ...filtros, page: pageParam, size: POR_PAGINA, tramos: true }, signal),
    initialPageParam: 0,
    getNextPageParam: (ultima, todas) => (ultima.viajes.length > 0 && todas.reduce((n, p) => n + p.viajes.length, 0) < ultima.total ? todas.length : undefined),
    enabled: !!busqueda && !regreso && !esperaLimites,
    staleTime: 45_000,
  })
  const idaVuelta = useQuery({
    queryKey: ['ida-y-vuelta', b.origen, b.destino, b.fecha, regreso, filtros],
    queryFn: () => api.catalogo.idaYVuelta(b.origen, b.destino, b.fecha, regreso!, { ...filtros, tramos: true }),
    enabled: !!busqueda && !!regreso && !esperaLimites,
    staleTime: 45_000,
  })

  // Fila de 7 días: el mismo conjunto de viajes que la lista (tramos y filtros activos), en una sola llamada.
  const inicio = busqueda ? maxFecha(hoy(), sumarDias(busqueda.fecha, -2)) : hoy()
  const filtrosCalendario = filtrosDelCalendario(filtros)
  const calendario = useQuery({
    queryKey: ['calendario', b.origen, b.destino, inicio, filtrosCalendario],
    queryFn: () => api.catalogo.calendario(b.origen, b.destino, inicio, 7, filtrosCalendario),
    enabled: !!busqueda,
    staleTime: 60_000,
  })

  if (!busqueda) return <Navigate to="/inicio" replace />

  const irA = (cambios: Partial<Busqueda>, nuevoRegreso = regreso) => {
    setElegida(0)
    setParams(conFiltros(aParametros({ ...busqueda, ...cambios }), filtros, nuevoRegreso), { replace: true })
  }

  const consulta = regreso ? idaVuelta : resultado
  const lista = regreso
    ? (sentido === 'ida' ? idaVuelta.data?.ida : idaVuelta.data?.vuelta) ?? []
    : (resultado.data?.pages.flatMap((p) => p.viajes) ?? [])
  const viajes = [...lista].sort((x, y) => (filtros.sort ? 0 : salidaDe(x).localeCompare(salidaDe(y))))
  const total = resultado.data?.pages[0]?.total ?? viajes.length
  const sel = Math.min(elegida, Math.max(0, viajes.length - 1))
  const n = cuantosFiltros(filtros)
  const fechas = Array.from({ length: 7 }, (_, i) => sumarDias(inicio, i))
  const precioDelDia = calendario.data?.find((d) => d.fecha === busqueda.fecha)?.precioMinimo
  const masBarato = regreso ? -1 : indiceMasBarato(viajes, precioDelDia)

  return (
    <Pantalla aSangre>
      <FranjaCiudad
        destino={sentido === 'vuelta' ? busqueda.origen : busqueda.destino}
        subtitulo={`Desde ${sentido === 'vuelta' ? busqueda.destino : busqueda.origen}, ${fechaCorta(fechaDesdeApi(sentido === 'vuelta' && regreso ? regreso : busqueda.fecha))}, ${plural(busqueda.pasajeros, 'persona', 'personas')}`}
        conteo={consulta.isSuccess && viajes.some((v) => !v.agotado) ? plural(regreso ? viajes.filter((v) => !v.agotado).length : total, 'salida', 'salidas') : null}
      />

      <div className="relative -mt-6 flex min-h-0 flex-1 flex-col rounded-t-[28px] bg-fondo pt-4">
        <div className="flex gap-2 px-5 pb-3">
          <Button variante="contorno" tamano="md" onClick={() => setEditando(true)}>
            <ArrowLeftRight className="size-4" aria-hidden="true" />
            Cambiar ruta
          </Button>
          <Button variante={n > 0 ? 'tinta' : 'contorno'} tamano="md" onClick={() => setVerFiltros(true)}>
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            {n > 0 ? `Filtros · ${n}` : 'Filtros'}
          </Button>
        </div>

        {regreso ? (
          <div className="px-5 pb-3">
            <Segmentos
              etiqueta="Sentido"
              rol="tablist"
              valor={sentido}
              alCambiar={(s) => {
                setSentido(s)
                setElegida(0)
              }}
              opciones={[
                { valor: 'ida', texto: `Ida · ${fechaCorta(fechaDesdeApi(busqueda.fecha))}` },
                { valor: 'vuelta', texto: `Vuelta · ${fechaCorta(fechaDesdeApi(regreso))}` },
              ]}
            />
          </div>
        ) : (
          <FilaDias fechas={fechas} dias={calendario.isPending ? undefined : (calendario.data ?? [])} elegida={busqueda.fecha} alElegir={(fecha) => irA({ fecha })} />
        )}

        {consulta.isPending ? (
          <Esqueleto />
        ) : consulta.isError ? (
          <ErrorBusqueda error={consulta.error} reintentar={() => void consulta.refetch()} />
        ) : viajes.length === 0 ? (
          <SinViajes alSiguiente={() => irA({ fecha: sumarDias(busqueda.fecha, 1) })} />
        ) : (
          <>
            <Regla viajes={viajes} elegida={sel} alElegir={setElegida} />
            <ul className="flex min-h-0 flex-1 flex-col gap-2.5 px-5 pt-3 pb-[calc(20px+env(safe-area-inset-bottom,0px))]">
              {viajes.map((v, i) => (
                <li key={`${v.itineraryId}-${v.fromOrden ?? 0}`} className="entra" style={{ animationDelay: `${Math.min(i, 4) * 50}ms` }}>
                  <TarjetaViaje viaje={v} elegida={i === sel} masBarato={i === masBarato} alAbrir={() => void navigate(rutaAsientos(v, busqueda.pasajeros))} />
                </li>
              ))}
              {!regreso && (
                <li>
                  <CargarMas hay={!!resultado.hasNextPage} cargando={resultado.isFetchingNextPage} alCargar={() => void resultado.fetchNextPage()} mostrados={viajes.length} total={total} />
                </li>
              )}
            </ul>
          </>
        )}
      </div>

      {verFiltros && (
        <HojaFiltros
          abierta
          alCerrar={() => setVerFiltros(false)}
          filtros={filtros}
          busqueda={busqueda}
          alAplicar={(f) => setParams(conFiltros(aParametros(busqueda), f, regreso), { replace: true })}
        />
      )}
      {editando && (
        <EditarRuta
          busqueda={busqueda}
          regreso={regreso}
          alCerrar={() => setEditando(false)}
          alBuscar={(nueva, vuelta) => {
            setEditando(false)
            setSentido('ida')
            irA(nueva, vuelta)
          }}
        />
      )}
    </Pantalla>
  )
}

/** Cambiar origen, destino, fecha y la vuelta, con autocompletado de ciudades y terminales. */
function EditarRuta({
  busqueda,
  regreso,
  alCerrar,
  alBuscar,
}: {
  busqueda: Busqueda
  regreso: string | null
  alCerrar: () => void
  alBuscar: (b: Partial<Busqueda>, regreso: string | null) => void
}) {
  const [origen, setOrigen] = useState(busqueda.origen)
  const [destino, setDestino] = useState(busqueda.destino)
  const [fecha, setFecha] = useState(busqueda.fecha)
  const [conVuelta, setConVuelta] = useState(!!regreso)
  const [vuelta, setVuelta] = useState(regreso ?? sumarDias(busqueda.fecha, 2))
  const valida = origen.trim() && destino.trim() && origen.trim().toLowerCase() !== destino.trim().toLowerCase() && (!conVuelta || vuelta >= fecha)
  const enviar = (e: FormEvent) => {
    e.preventDefault()
    if (valida) alBuscar({ origen: origen.trim(), destino: destino.trim(), fecha }, conVuelta ? vuelta : null)
  }
  return (
    <Hoja abierta alCambiar={(a) => !a && alCerrar()} titulo="¿A dónde viajas?">
      <form onSubmit={enviar} className="flex flex-col gap-3 pb-3" noValidate>
        <CampoLugar etiqueta="Desde" valor={origen} alCambiar={setOrigen} />
        <CampoLugar etiqueta="Hacia" valor={destino} alCambiar={setDestino} />
        <Campo etiqueta="Fecha de ida" type="date" min={hoy()} value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} />
        <Casilla etiqueta="Ida y vuelta" marcada={conVuelta} alCambiar={setConVuelta} />
        {conVuelta && <Campo etiqueta="Fecha de vuelta" type="date" min={fecha} value={vuelta} onChange={(e) => e.target.value && setVuelta(e.target.value)} />}
        <Button type="submit" ancho="completo" disabled={!valida}>
          Buscar salidas
        </Button>
      </form>
    </Hoja>
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

function TarjetaViaje({ viaje: v, elegida, masBarato, alAbrir }: { viaje: ResultadoViaje; elegida: boolean; masBarato: boolean; alAbrir: () => void }) {
  const masDias = diasDespues(salidaDe(v), llegadaDe(v))
  const tramo = v.fromOrden != null

  if (v.agotado) {
    return (
      <div className="flex items-center gap-3 rounded-tarjeta bg-[#eceee7] px-4 py-3.5">
        <span className="num shrink-0 text-[20px] font-bold text-texto-2 line-through">{horaCorta(salidaDe(v))}</span>
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
        <span className="num shrink-0 text-[22px] font-bold">{horaCorta(salidaDe(v))}</span>
        <span className="flex min-w-3 flex-1 flex-col items-center gap-0.5">
          <span className="text-[11px] whitespace-nowrap text-texto-2">{duracion(tramo ? (new Date(llegadaDe(v)).getTime() - new Date(salidaDe(v)).getTime()) / 60_000 : v.duracionMinutos)}</span>
          <span className="h-0.5 w-full rounded-full bg-tinta" />
        </span>
        <span className="num shrink-0 text-[22px] font-bold">
          {horaCorta(llegadaDe(v))}
          {masDias > 0 && <sup className="ml-0.5 text-[11px] text-texto-2">+{masDias}</sup>}
        </span>
      </div>
      <div className="flex w-full items-end gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span title={v.empresa} className="truncate text-[14px] font-semibold">
            {v.empresa}
          </span>
          {tramo && (
            <span className="text-[12px] font-semibold text-texto-2">
              Tramo {v.origen} → {v.destino}
            </span>
          )}
          <IconosServicios servicios={v.servicios} />
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
          {masBarato && <span className="mb-1 flex h-5 items-center rounded-md bg-tinta px-1.5 text-[11px] font-bold text-white">Más barato</span>}
          {oferta && (
            <>
              <span className="mb-1 flex h-5 items-center rounded-md bg-naranja px-1.5 text-[11px] font-extrabold text-tinta">
                DROP −{descuento}%
              </span>
              <span className="num text-[13px] text-texto-2 line-through">{dinero(v.precioBase)}</span>
            </>
          )}
          <span className="num text-[20px] font-bold">{dinero(precioDe(v))}</span>
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
