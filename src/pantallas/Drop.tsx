import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Zap } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { useAcento } from '@/hooks/useAcento'
import { BotonVolver } from '@/components/marca/BotonVolver'
import { Aviso, Esqueleto, PantallaError } from '@/components/marca/Estados'
import { EstadoVivo } from '@/components/marca/EstadoVivo'
import { Pantalla } from '@/components/marca/Pantalla'
import { buttonVariants } from '@/components/ui/button-variants'
import { Button } from '@/components/ui/button'
import { Hoja } from '@/components/ui/hoja'
import { Campo } from '@/components/ui/input'
import { ultimoViajero } from '@/features/retenciones'
import { useSegundosRestantes } from '@/hooks/useAhora'
import { ApiError, textoError } from '@/lib/api'
import { api } from '@/lib/endpoints'
import { dinero, fechaCorta, horaCorta, reloj } from '@/lib/formato'
import { useSesion } from '@/lib/sesion'
import { topicos, useIntervaloRespaldo, useTopico } from '@/lib/tiempoReal'
import type { CupoOferta, Oferta } from '@/lib/tipos'
import { cn } from '@/lib/utils'

/**
 * Pantalla 08. Drop: oferta relámpago (US-056 / US-058). Cupo y tiempo en vivo; "Apartar uno"
 * pasa por el contador atómico del backend: nunca se vende más que el cupo.
 */
export function Drop() {
  const { offerId = '' } = useParams()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const s = useSesion()
  const queryClient = useQueryClient()
  const respaldo = useIntervaloRespaldo(4_000, 30_000)
  const [pidiendoDoc, setPidiendoDoc] = useState(false)
  const [doc, setDoc] = useState(() => ultimoViajero()?.numeroDocumento ?? '')
  const [errorDoc, setErrorDoc] = useState<string>()
  const [agotadoEnVivo, setAgotadoEnVivo] = useState(false)

  const oferta = useQuery({ queryKey: ['oferta', offerId], queryFn: () => api.ofertas.obtener(offerId), refetchInterval: respaldo })
  const o = oferta.data
  const detalle = useQuery({
    queryKey: ['itinerario', o?.itineraryId],
    queryFn: () => api.catalogo.itinerario(o!.itineraryId),
    enabled: !!o,
  })
  useAcento(detalle.data?.destino)

  useTopico(topicos.cupoOferta(offerId), (m) => {
    const c = m.data as Partial<CupoOferta> | null
    if (c && typeof c.cupoRestante === 'number') {
      queryClient.setQueryData<Oferta>(['oferta', offerId], (prev) =>
        prev ? { ...prev, cupoRestante: c.cupoRestante!, ...(c.estado ? { estado: c.estado } : {}) } : prev,
      )
    }
    if (m.type === 'event' && m.event !== 'OfferQuotaUpdated') void oferta.refetch()
  })

  const segundos = useSegundosRestantes(o ? (o.estado === 'PROGRAMADA' || o.estado === 'BORRADOR' ? o.inicio : o.fin) : null)

  const apartar = useMutation({
    mutationFn: (docId: string) => api.ofertas.apartar(offerId, docId),
    onSuccess: (r) => {
      setPidiendoDoc(false)
      navigate(`/reserva/${r.holdId}`)
    },
    onError: (e) => {
      setPidiendoDoc(false)
      if (e instanceof ApiError && e.code === 'OUT_OF_STOCK') {
        setAgotadoEnVivo(true)
        void oferta.refetch()
        return
      }
      if (e instanceof ApiError && e.status === 401) {
        navigate(`/entrar?siguiente=${encodeURIComponent(pathname)}`)
        return
      }
      toast(textoError(e))
      void oferta.refetch()
    },
  })

  if (oferta.isError) return <PantallaError titulo="No encontramos este drop" error={oferta.error} reintentar={() => oferta.refetch()} />
  if (!o) {
    return (
      <Pantalla>
        <Esqueleto bloques={[160, 120, 200]} />
      </Pantalla>
    )
  }

  const d = detalle.data
  const terminada = o.estado === 'CERRADA' || (o.estado === 'ACTIVA' && segundos === 0)
  const agotada = o.estado === 'AGOTADA' || o.cupoRestante <= 0 || agotadoEnVivo
  const porEmpezar = o.estado === 'PROGRAMADA' || o.estado === 'BORRADOR'
  const activa = o.estado === 'ACTIVA' && !terminada && !agotada
  const descuento = d ? Math.round((1 - o.precioOferta / d.precioBase) * 100) : null
  const vendidos = Math.max(0, o.cupoMax - o.cupoRestante)

  const pedir = () => {
    if (!s) {
      navigate(`/entrar?siguiente=${encodeURIComponent(pathname)}`)
      return
    }
    setPidiendoDoc(true)
  }
  const enviarDoc = (e: FormEvent) => {
    e.preventDefault()
    const v = doc.trim()
    if (!/^[A-Za-z0-9-]{4,20}$/.test(v)) {
      setErrorDoc('Entre 4 y 20 letras o números, sin espacios.')
      return
    }
    apartar.mutate(v)
  }

  return (
    <Pantalla>
      <header className="flex items-center gap-3 px-5">
        <BotonVolver />
        <span className="flex h-8 items-center gap-1.5 rounded-lg bg-naranja px-2.5 text-[13px] font-extrabold text-tinta">
          <Zap className="size-4" aria-hidden="true" />
          Drop
        </span>
        <span className="flex-1" />
        <EstadoVivo />
      </header>

      <div className="px-5 pt-4">
        <h1 className="font-display text-[28px] leading-tight font-bold tracking-[-0.02em] [overflow-wrap:anywhere]">
          {d ? `${d.origen} → ${d.destino}` : ' '}
        </h1>
        <p className="mt-1 text-[14px] text-texto-2" title={d?.empresa}>
          {d ? (
            <>
              {fechaCorta(d.fechaSalida)} · <span className="num">{horaCorta(d.fechaSalida)}</span> · {d.empresa}
            </>
          ) : (
            ' '
          )}
        </p>
      </div>

      <section className="mx-5 mt-4 flex items-end justify-between gap-3 rounded-tarjeta bg-tinta p-5 text-white">
        <div className="flex flex-col">
          <span className="text-[13px] text-tinta-texto-2">
            {porEmpezar ? 'Empieza en' : activa ? 'Termina en' : agotada ? 'Se agotó' : 'Terminó'}
          </span>
          <span role="timer" className={cn('num text-[44px] leading-none font-bold', activa && (segundos ?? 999) <= 60 ? 'text-naranja' : 'text-white')}>
            {(porEmpezar || activa) && segundos != null ? reloj(segundos) : '0:00'}
          </span>
        </div>
        <div className="flex flex-col items-end">
          {d && <span className="num text-[15px] text-tinta-texto-2 line-through">{dinero(d.precioBase)}</span>}
          <span className="num text-[30px] leading-none font-bold text-acento">{dinero(o.precioOferta)}</span>
          {descuento != null && descuento > 0 && <span className="mt-1 text-[12px] font-bold text-naranja">−{descuento}%</span>}
        </div>
      </section>

      <section aria-label="Cupo del drop" className="mx-5 mt-3 rounded-tarjeta bg-superficie p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <span role="status" aria-live="polite" className="text-[16px] font-semibold">
            {agotada ? 'No quedan puestos' : o.cupoRestante === 1 ? 'Queda 1 puesto' : `Quedan ${o.cupoRestante} de ${o.cupoMax}`}
          </span>
          <span className="text-[13px] text-texto-2">{vendidos === 1 ? '1 apartado' : `${vendidos} apartados`}</span>
        </div>
        <div aria-hidden="true" className="grid grid-cols-10 gap-1.5">
          {Array.from({ length: Math.min(o.cupoMax, 40) }, (_, i) => (
            <span
              key={i}
              className={cn(
                'aspect-square rounded-[5px] transition-colors duration-200',
                i < vendidos ? 'bg-vendido' : 'border-2 border-naranja bg-presencia',
              )}
            />
          ))}
        </div>
      </section>

      <div className="flex-1" />

      <div className="flex flex-col gap-2.5 px-5 pt-4">
        {activa ? (
          <>
            <Button variante="naranja" ancho="completo" disabled={apartar.isPending} onClick={pedir}>
              {apartar.isPending ? 'Apartando…' : s ? 'Apartar uno' : 'Entra para apartar uno'}
            </Button>
            <span className="text-center text-[13px] text-texto-2">Uno por persona y documento. Si se agota mientras pagas, no te cobramos.</span>
          </>
        ) : agotada ? (
          <Aviso tono="alerta">
            <span className="font-semibold">Se agotó en vivo.</span> Hubo más personas que puestos. Puedes comprar este viaje a precio normal.
          </Aviso>
        ) : porEmpezar ? (
          <Aviso>Este drop empieza a las {horaCorta(o.inicio)}. Quédate en esta pantalla: se abre solo.</Aviso>
        ) : (
          <Aviso>Este drop ya terminó.</Aviso>
        )}
        {!activa && d && (
          <Link to={`/viaje/${o.itineraryId}/asientos`} className={buttonVariants({ variante: 'contorno', ancho: 'completo' })}>
            Ver puestos a precio normal
          </Link>
        )}
      </div>

      <Hoja
        abierta={pidiendoDoc}
        alCambiar={setPidiendoDoc}
        titulo="¿Con qué documento viajas?"
        descripcion="El drop es uno por persona: lo verificamos con tu documento."
      >
        <form onSubmit={enviarDoc} className="flex flex-col gap-3 pb-2" noValidate>
          <Campo
            etiqueta="Número de documento"
            inputMode="numeric"
            autoComplete="off"
            enterKeyHint="go"
            autoFocus
            value={doc}
            maxLength={20}
            onChange={(e) => {
              setDoc(e.target.value.replace(/\s/g, ''))
              setErrorDoc(undefined)
            }}
            error={errorDoc}
          />
          <Button type="submit" variante="naranja" ancho="completo" disabled={apartar.isPending}>
            {apartar.isPending ? (
              'Apartando…'
            ) : (
              <>
                <Check className="size-5" aria-hidden="true" />
                Apartar a {dinero(o.precioOferta)}
              </>
            )}
          </Button>
        </form>
      </Hoja>
    </Pantalla>
  )
}
