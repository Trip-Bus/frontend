import { useQuery } from '@tanstack/react-query'
import { ArrowLeftRight, ArrowRight, Minus, Plus, Search } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { aParametros, busquedaInicial, hoy, recordarBusqueda, rutasRecientes, type Busqueda } from '@/features/busqueda'
import { useAhora } from '@/hooks/useAhora'
import { BarraInferior } from '@/components/marca/BarraInferior'
import { Pantalla } from '@/components/marca/Pantalla'
import { Button } from '@/components/ui/button'
import { Hoja } from '@/components/ui/hoja'
import { api } from '@/lib/endpoints'
import { dinero, fechaCorta, fechaDesdeApi, iniciales, nombreCiudad, reloj, sumarDias } from '@/lib/formato'
import { useSesion } from '@/lib/sesion'
import { cn } from '@/lib/utils'

type Selector = 'origen' | 'destino' | 'fecha' | 'pasajeros' | null

/** Pantalla 02. Buscar completando una frase: "Voy de [Bogotá] a [Medellín] el [vie 9], [1 persona]." */
export function Inicio() {
  const navigate = useNavigate()
  const s = useSesion()
  const [busqueda, setBusqueda] = useState<Busqueda>(busquedaInicial)
  const [abierto, setAbierto] = useState<Selector>(null)
  const [recientes] = useState(rutasRecientes)

  const ciudades = useQuery({ queryKey: ['ciudades'], queryFn: api.catalogo.ciudades, staleTime: Infinity })
  const usuario = useQuery({
    queryKey: ['usuario', s?.userId],
    queryFn: () => api.auth.usuario(s!.userId),
    enabled: !!s,
    staleTime: Infinity,
  })

  const cambiar = (parcial: Partial<Busqueda>) => setBusqueda((b) => ({ ...b, ...parcial }))
  const mismaCiudad = busqueda.origen.trim().toLowerCase() === busqueda.destino.trim().toLowerCase()

  const buscar = (b: Busqueda = busqueda) => {
    recordarBusqueda(b)
    navigate(`/salidas?${aParametros(b)}`)
  }

  return (
    <Pantalla>
      <header className="flex items-center gap-3 px-5">
        {s ? (
          <>
            <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-tinta text-[14px] font-bold text-white">
              {iniciales(usuario.data?.nombre)}
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-[13px] text-texto-2">{saludo()}</span>
              <span className="truncate text-[16px] font-semibold">{usuario.data?.nombre ?? ' '}</span>
            </div>
          </>
        ) : (
          <>
            <span className="flex-1 font-display text-[22px] font-extrabold tracking-[-0.02em]">
              tripbus<span className="text-[#8ab51f]">.</span>
            </span>
            <Link to="/entrar?siguiente=/inicio" className="tap flex h-11 items-center rounded-control border-[1.5px] border-control bg-superficie px-4 text-[15px] font-semibold">
              Entrar
            </Link>
          </>
        )}
      </header>

      <section aria-label="Buscar viaje" className="mx-5 mt-4 flex flex-col gap-[18px] rounded-[28px] bg-superficie p-5">
        <p className="font-display text-[clamp(23px,7vw,27px)] leading-[1.55] font-bold tracking-[-0.02em]">
          Voy de <Ficha onClick={() => setAbierto('origen')}>{busqueda.origen}</Ficha> a{' '}
          <Ficha onClick={() => setAbierto('destino')}>{busqueda.destino}</Ficha> el{' '}
          <Ficha onClick={() => setAbierto('fecha')}>{fechaCorta(fechaDesdeApi(busqueda.fecha)).split(' ').slice(0, 2).join(' ')}</Ficha>,{' '}
          <Ficha onClick={() => setAbierto('pasajeros')}>
            {busqueda.pasajeros === 1 ? '1 persona' : `${busqueda.pasajeros} personas`}
          </Ficha>
          .
        </p>
        {mismaCiudad && (
          <p role="alert" className="-mt-2 text-[14px] font-medium text-presencia-borde">
            El origen y el destino son la misma ciudad.
          </p>
        )}
        <div className="flex gap-2.5">
          <Button ancho="completo" className="justify-between" disabled={mismaCiudad} onClick={() => buscar()}>
            Ver salidas
            <ArrowRight className="size-[22px] text-lima" strokeWidth={2.5} aria-hidden="true" />
          </Button>
          <Button
            variante="contorno"
            className="size-14 px-0"
            aria-label="Invertir origen y destino"
            onClick={() => cambiar({ origen: busqueda.destino, destino: busqueda.origen })}
          >
            <ArrowLeftRight className="size-[22px]" aria-hidden="true" />
          </Button>
        </div>
      </section>

      {recientes.length > 0 && (
        <section className="mt-6">
          <h2 className="mx-5 mb-2.5 font-display text-[19px] font-bold tracking-[-0.01em]">Tus rutas</h2>
          <div className="carril gap-2.5 px-5">
            {recientes.map((r) => (
              <button
                key={`${r.origen}-${r.destino}`}
                onClick={() => buscar({ ...busqueda, origen: r.origen, destino: r.destino })}
                className="tap flex w-[150px] flex-col gap-1.5 rounded-[20px] bg-superficie p-3.5 text-left"
              >
                <span className="truncate text-[15px] font-semibold">{r.origen}</span>
                <span className="truncate text-[13px] text-texto-2">→ {r.destino}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <DropActivo />

      <div className="flex-1" />
      <BarraInferior activa="viajar" />

      <SelectorCiudad
        abierto={abierto === 'origen' || abierto === 'destino'}
        titulo={abierto === 'destino' ? '¿A dónde vas?' : '¿Desde dónde sales?'}
        ciudades={ciudades.data ?? []}
        cargando={ciudades.isPending}
        alCerrar={() => setAbierto(null)}
        alElegir={(c) => {
          cambiar(abierto === 'destino' ? { destino: c } : { origen: c })
          setAbierto(null)
        }}
      />
      <SelectorFecha
        abierto={abierto === 'fecha'}
        valor={busqueda.fecha}
        alCerrar={() => setAbierto(null)}
        alElegir={(f) => {
          cambiar({ fecha: f })
          setAbierto(null)
        }}
      />
      <SelectorPasajeros
        abierto={abierto === 'pasajeros'}
        valor={busqueda.pasajeros}
        alCerrar={() => setAbierto(null)}
        alCambiar={(n) => cambiar({ pasajeros: n })}
      />
    </Pantalla>
  )
}

function saludo() {
  const h = Number(new Intl.DateTimeFormat('es-CO', { hour: 'numeric', hourCycle: 'h23', timeZone: 'America/Bogota' }).format(new Date()))
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'
}

function Ficha({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="tap inline-block max-w-full truncate rounded-xl bg-[#eef1e8] px-2.5 align-baseline leading-[40px] transition-[transform,background-color] hover:bg-[#e3e7db]"
    >
      {children}
    </button>
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
    <Link to={`/drop/${activa.offerId}`} className="tap mx-5 mt-4 flex items-center gap-3.5 rounded-tarjeta bg-naranja p-4 text-tinta">
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex h-[22px] items-center self-start rounded-md bg-tinta px-2 text-[11px] font-extrabold tracking-[0.08em] text-naranja">
          DROP
        </span>
        <span className="text-[16px] font-bold">{dinero(activa.precioOferta)} por puesto</span>
        <span className="text-[13px] font-semibold">
          {activa.cupoRestante === 1 ? 'Queda 1' : `Quedan ${activa.cupoRestante}`} de {activa.cupoMax} · termina en
        </span>
      </span>
      <span className="num shrink-0 text-[26px] font-bold">{reloj(restante)}</span>
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

function SelectorFecha({
  abierto,
  valor,
  alCerrar,
  alElegir,
}: {
  abierto: boolean
  valor: string
  alCerrar: () => void
  alElegir: (fecha: string) => void
}) {
  const inicio = hoy()
  const dias = Array.from({ length: 21 }, (_, i) => sumarDias(inicio, i))
  return (
    <Hoja abierta={abierto} alCambiar={(a) => !a && alCerrar()} titulo="¿Qué día viajas?">
      <div className="grid grid-cols-3 gap-2 pb-2">
        {dias.map((d, i) => {
          const [dia, num, mes] = fechaCorta(fechaDesdeApi(d)).split(' ')
          const on = d === valor
          return (
            <button
              key={d}
              aria-pressed={on}
              onClick={() => alElegir(d)}
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
    </Hoja>
  )
}

function SelectorPasajeros({
  abierto,
  valor,
  alCerrar,
  alCambiar,
}: {
  abierto: boolean
  valor: number
  alCerrar: () => void
  alCambiar: (n: number) => void
}) {
  return (
    <Hoja
      abierta={abierto}
      alCambiar={(a) => !a && alCerrar()}
      titulo="¿Cuántas personas?"
      descripcion="Puedes apartar hasta 6 puestos en una compra."
    >
      <div className="flex items-center justify-between py-4">
        <Button variante="contorno" tamano="icono" className="size-14" aria-label="Una persona menos" disabled={valor <= 1} onClick={() => alCambiar(valor - 1)}>
          <Minus aria-hidden="true" />
        </Button>
        <span className="num text-[44px] font-bold" aria-live="polite">
          {valor}
        </span>
        <Button variante="contorno" tamano="icono" className="size-14" aria-label="Una persona más" disabled={valor >= 6} onClick={() => alCambiar(valor + 1)}>
          <Plus aria-hidden="true" />
        </Button>
      </div>
      <Button ancho="completo" className="mb-2" onClick={alCerrar}>
        Listo
      </Button>
    </Hoja>
  )
}

