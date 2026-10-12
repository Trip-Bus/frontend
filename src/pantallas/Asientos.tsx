import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { BotonVolver } from '@/components/marca/BotonVolver'
import { ContadorRetencion } from '@/components/marca/Contador'
import { EstadoVivo } from '@/components/marca/EstadoVivo'
import { Esqueleto, PantallaError } from '@/components/marca/Estados'
import { LeyendaPuestos, PisoBus } from '@/components/marca/MapaBus'
import { Pantalla } from '@/components/marca/Pantalla'
import { Button } from '@/components/ui/button'
import { Hoja } from '@/components/ui/hoja'
import { aplicarEvento, construirPisos, libreMasCercano, type Puesto } from '@/features/mapaAsientos'
import { olvidarRetencion, recordarRetencion, retencionDeViaje } from '@/features/retenciones'
import { ApiError, textoError } from '@/lib/api'
import { api } from '@/lib/endpoints'
import { dinero, horaCorta, plural } from '@/lib/formato'
import { useSesion } from '@/lib/sesion'
import { topicos, useIntervaloRespaldo, useTopico } from '@/lib/tiempoReal'
import type { EstadosAsientos } from '@/lib/tipos'
import { cn } from '@/lib/utils'

const CONFLICTOS = new Set(['SEAT_UNAVAILABLE', 'SEAT_LOCKED', 'NO_SEATS_AVAILABLE'])

/**
 * Pantalla 04. Puestos en vivo (US-016 a US-022, US-026).
 * Distribución real del bus + estado de cada puesto por WebSocket; al apartar, el puesto es tuyo
 * 10 minutos y nadie más puede tomarlo (el backend lo garantiza con lock distribuido + BD).
 */
export function Asientos() {
  const { itineraryId = '' } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const s = useSesion()
  const queryClient = useQueryClient()
  const maximo = Math.min(6, Math.max(1, Number(params.get('pasajeros')) || 1))

  const [elegidos, setElegidos] = useState<string[]>([])
  const [pisoActivo, setPisoActivo] = useState(0)
  const [conflicto, setConflicto] = useState<{ perdido: string; sugerido: Puesto | null } | null>(null)
  const [previa, setPrevia] = useState(() => retencionDeViaje(itineraryId))

  const detalle = useQuery({ queryKey: ['itinerario', itineraryId], queryFn: () => api.catalogo.itinerario(itineraryId) })
  const mapa = useQuery({ queryKey: ['mapa', itineraryId], queryFn: () => api.catalogo.mapa(itineraryId), staleTime: Infinity })
  const respaldo = useIntervaloRespaldo()
  const claveEstados = ['asientos', itineraryId, s?.userId ?? 'anonimo']
  const estados = useQuery({
    queryKey: claveEstados,
    queryFn: () => api.asientos.estados(itineraryId),
    refetchInterval: respaldo,
  })

  // Tiempo real: el snapshot reemplaza todo; cada evento se aplica al instante y luego se reconcilia.
  const reconciliar = useRef<ReturnType<typeof setTimeout> | null>(null)
  useTopico(topicos.asientos(itineraryId), (m) => {
    if (m.type === 'snapshot') {
      if (m.data && typeof m.data === 'object') {
        queryClient.setQueryData<EstadosAsientos>(claveEstados, (previo) => {
          const nuevo = m.data as EstadosAsientos
          // El snapshot viene sin usuario: conserva "propio" de la respuesta autenticada.
          const propios = new Set(previo?.asientos.filter((a) => a.propio).map((a) => a.seatNumber))
          return { ...nuevo, asientos: nuevo.asientos.map((a) => ({ ...a, propio: propios.has(a.seatNumber) && a.estado !== 'DISPONIBLE' })) }
        })
      }
      return
    }
    queryClient.setQueryData<EstadosAsientos>(claveEstados, (previo) => (previo ? (aplicarEvento(previo, m.event, m.data) ?? previo) : previo))
    if (reconciliar.current) clearTimeout(reconciliar.current)
    reconciliar.current = setTimeout(() => void queryClient.invalidateQueries({ queryKey: claveEstados }), 250)
  })
  useEffect(() => () => {
    if (reconciliar.current) clearTimeout(reconciliar.current)
  }, [])

  const mios = useMemo(() => new Set(previa?.seatNumbers ?? []), [previa])
  const pisos = useMemo(() => (mapa.data ? construirPisos(mapa.data, estados.data, mios) : []), [mapa.data, estados.data, mios])

  const apartar = useMutation({
    mutationFn: (asientos: string[]) => api.asientos.retener(itineraryId, asientos),
    onSuccess: (r) => {
      recordarRetencion(r)
      void queryClient.invalidateQueries({ queryKey: claveEstados })
      navigate(`/reserva/${r.holdId}`)
    },
    onError: (e, asientos) => {
      void queryClient.invalidateQueries({ queryKey: claveEstados })
      if (e instanceof ApiError && CONFLICTOS.has(e.code)) {
        setElegidos([])
        setConflicto({ perdido: asientos[0], sugerido: libreMasCercano(pisos, asientos[0]) })
        return
      }
      if (e instanceof ApiError && e.status === 401) {
        navigate(`/entrar?siguiente=${encodeURIComponent(pathname + search)}`)
        return
      }
      toast(textoError(e))
    },
  })

  const soltar = useMutation({
    mutationFn: (holdId: string) => api.asientos.liberar(holdId),
    onSettled: (_r, _e, holdId) => {
      olvidarRetencion(holdId)
      setPrevia(null)
      void queryClient.invalidateQueries({ queryKey: claveEstados })
    },
  })

  // Si alguien más toma un puesto que yo tenía elegido (sin apartar), deja de contar y se avisa.
  const libresAhora = new Set(pisos.flatMap((p) => p.celdas).filter((c) => c.puesto?.estado === 'libre').map((c) => c.puesto!.numero))
  const vigentes = pisos.length && !apartar.isPending && !apartar.isSuccess ? elegidos.filter((n) => libresAhora.has(n)) : elegidos
  const perdidos = elegidos.filter((n) => !vigentes.includes(n)).join(', ')
  useEffect(() => {
    if (perdidos) toast(`Alguien acaba de apartar el ${perdidos}. Elige otro.`)
  }, [perdidos])

  if (detalle.isError || mapa.isError) {
    return (
      <PantallaError
        titulo="No pudimos abrir el bus"
        error={detalle.error ?? mapa.error}
        reintentar={() => {
          void detalle.refetch()
          void mapa.refetch()
        }}
        volverA="/salidas"
      />
    )
  }

  const d = detalle.data
  const cancelado = d?.estado === 'CANCELADO'
  const piso = pisos[Math.min(pisoActivo, Math.max(0, pisos.length - 1))]
  const precio = d?.precioBase ?? 0

  const tocar = (p: Puesto) => {
    if (p.estado === 'oferta' && p.offerId) {
      navigate(`/drop/${p.offerId}`)
      return
    }
    setElegidos(() => {
      const e = vigentes
      if (e.includes(p.numero)) return e.filter((n) => n !== p.numero)
      if (e.length >= maximo) return maximo === 1 ? [p.numero] : e
      return [...e, p.numero]
    })
  }

  const continuar = () => {
    if (!s) {
      navigate(`/entrar?siguiente=${encodeURIComponent(pathname + search)}`)
      return
    }
    apartar.mutate(vigentes)
  }

  const resumen = vigentes.length
    ? vigentes
        .map((n) => {
          const u = pisos.flatMap((x) => x.celdas).find((c) => c.puesto?.numero === n)?.puesto?.ubicacion
          return `Puesto ${n}${u ? ` · ${u}` : ''}`
        })
        .join(', ')
    : maximo === 1
      ? 'Elige 1 puesto'
      : `Elige hasta ${maximo} puestos`

  return (
    <Pantalla className="pb-0">
      <header className="flex items-center gap-3 px-5">
        <BotonVolver />
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="font-display text-[20px] font-bold tracking-[-0.01em]">Elige tu puesto</h1>
          <span className="truncate text-[12px] text-texto-2" title={d?.empresa}>
            {d ? (
              <>
                <span className="num">
                  {horaCorta(d.fechaSalida)} → {horaCorta(d.fechaLlegadaEstimada)}
                </span>{' '}
                · {d.empresa}
              </>
            ) : (
              ' '
            )}
          </span>
        </div>
        <EstadoVivo />
      </header>

      {cancelado && (
        <div role="alert" className="mx-5 mt-3 rounded-[18px] border-[1.5px] border-presencia-borde bg-presencia px-4 py-3 text-[14px] text-alerta">
          La empresa canceló este viaje. Busca otra salida.
        </div>
      )}

      {previa && (
        <section className="mx-5 mt-3 flex items-center gap-3 rounded-[18px] bg-tinta p-3 pl-4 text-white">
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-[14px] font-semibold">Ya apartaste el {previa.seatNumbers.join(', ')}</span>
            <button
              type="button"
              disabled={soltar.isPending}
              onClick={() => soltar.mutate(previa.holdId)}
              className="self-start text-[13px] text-tinta-texto-2 underline underline-offset-2"
            >
              {soltar.isPending ? 'Soltándolo…' : 'Soltarlo y elegir otro'}
            </button>
          </div>
          <ContadorRetencion hasta={previa.expiraEn} className="bg-tinta-2 text-white" />
          <Button variante="lima" tamano="md" onClick={() => navigate(`/reserva/${previa.holdId}`)}>
            Seguir
          </Button>
        </section>
      )}

      <div className="mx-5 mt-3">
        <LeyendaPuestos conOferta={pisos.some((p) => p.celdas.some((c) => c.puesto?.estado === 'oferta'))} />
      </div>

      {pisos.length > 1 && (
        <div role="tablist" aria-label="Piso" className="mx-5 mt-3 grid grid-cols-2 gap-1.5 rounded-control bg-[#e7eae2] p-1">
          {pisos.map((p, i) => (
            <button
              key={p.piso}
              role="tab"
              aria-selected={i === pisoActivo}
              onClick={() => setPisoActivo(i)}
              className={cn(
                'tap h-10 rounded-[11px] text-[14px] font-semibold',
                i === pisoActivo ? 'bg-superficie text-tinta' : 'text-texto-2',
              )}
            >
              Piso {p.piso} <span className="font-normal">· {plural(p.libres, 'libre', 'libres')}</span>
            </button>
          ))}
        </div>
      )}

      <div className="scroll-hoja min-h-0 flex-1 px-5 pt-3 pb-6">
        {!piso ? (
          <Esqueleto bloques={[520]} className="px-0 pt-0" />
        ) : (
          <PisoBus
            piso={piso}
            marcados={new Set(vigentes)}
            seleccionables={cancelado || previa ? [] : ['libre', 'oferta']}
            alTocar={tocar}
          />
        )}
      </div>

      <footer className="sticky bottom-0 flex flex-col gap-3 rounded-t-[28px] bg-superficie px-5 pt-3.5 pb-[calc(18px+env(safe-area-inset-bottom,0px))] shadow-[0_-8px_28px_rgba(13,20,17,.08)]">
        <div className="flex items-center gap-3">
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[13px] text-texto-2">{resumen}</span>
            <span className="num text-[26px] font-bold">{dinero(precio * Math.max(1, vigentes.length))}</span>
          </div>
          <span className="max-w-[150px] text-right text-[12px] leading-snug text-texto-2">
            Lo apartamos 10 min. Nadie más puede tomarlo.
          </span>
        </div>
        <Button
          ancho="completo"
          className="justify-between"
          disabled={vigentes.length === 0 || apartar.isPending || cancelado}
          onClick={continuar}
        >
          {apartar.isPending ? 'Apartando…' : vigentes.length === 0 ? 'Toca un puesto libre' : s ? 'Apartar y seguir' : 'Entra para apartarlo'}
          {vigentes.length > 0 && !apartar.isPending && <ArrowRight className="size-[22px] text-lima" strokeWidth={2.5} aria-hidden="true" />}
        </Button>
      </footer>

      <Hoja
        abierta={!!conflicto}
        alCambiar={(a) => !a && setConflicto(null)}
        titulo={conflicto ? `Alguien tomó el ${conflicto.perdido} un instante antes que tú` : ''}
        descripcion={
          conflicto?.sugerido
            ? `El ${conflicto.sugerido.numero} está libre (${conflicto.sugerido.ubicacion}), mismo precio.`
            : 'Elige otro puesto libre.'
        }
      >
        <div className="flex flex-col gap-2.5 pb-2">
          {conflicto?.sugerido && (
            <Button
              ancho="completo"
              disabled={apartar.isPending}
              onClick={() => {
                const n = conflicto.sugerido!.numero
                setConflicto(null)
                apartar.mutate([n])
              }}
            >
              Quedarme con el {conflicto.sugerido.numero}
            </Button>
          )}
          <Button variante="contorno" ancho="completo" onClick={() => setConflicto(null)}>
            Elegir otro
          </Button>
        </div>
      </Hoja>
    </Pantalla>
  )
}
