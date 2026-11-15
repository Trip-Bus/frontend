import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { useAcento } from '@/hooks/useAcento'
import { BotonVolver } from '@/components/marca/BotonVolver'
import { ContadorRetencion } from '@/components/marca/Contador'
import { Esqueleto, PantallaError } from '@/components/marca/Estados'
import { Pantalla } from '@/components/marca/Pantalla'
import { Button } from '@/components/ui/button'
import { Campo } from '@/components/ui/input'
import { olvidarRetencion, recordarRetencion, recordarViajero, ultimoViajero } from '@/features/retenciones'
import { useSegundosRestantes } from '@/hooks/useAhora'
import { textoError } from '@/lib/api'
import { codigoCiudad } from '@/lib/ciudades'
import { api } from '@/lib/endpoints'
import { dinero, fechaCorta, horaCorta } from '@/lib/formato'
import { useSesion } from '@/lib/sesion'
import type { PasajeroRequest, TipoDocumento } from '@/lib/tipos'

const TIPOS: { valor: TipoDocumento; nombre: string }[] = [
  { valor: 'CC', nombre: 'Cédula de ciudadanía' },
  { valor: 'CE', nombre: 'Cédula de extranjería' },
  { valor: 'TI', nombre: 'Tarjeta de identidad' },
  { valor: 'PA', nombre: 'Pasaporte' },
  { valor: 'PEP', nombre: 'Permiso especial (PEP)' },
]

type Errores = Record<number, Partial<Record<keyof PasajeroRequest, string>>>

function validarPasajero(p: PasajeroRequest): Partial<Record<keyof PasajeroRequest, string>> {
  const e: Partial<Record<keyof PasajeroRequest, string>> = {}
  if (p.nombre.trim().length < 3) e.nombre = 'Escribe el nombre como aparece en el documento.'
  if (!/^[A-Za-z0-9-]{4,20}$/.test(p.numeroDocumento.trim())) e.numeroDocumento = 'Entre 4 y 20 letras o números, sin espacios.'
  return e
}

/**
 * Datos del viajero y total (US-031). El puesto ya está apartado: aquí se crea la reserva
 * (POST /bookings) y se pasa al pago.
 */
export function Reserva() {
  const { holdId = '' } = useParams()
  const navigate = useNavigate()
  const s = useSesion()

  const retencion = useQuery({
    queryKey: ['retencion', holdId],
    queryFn: () => api.asientos.retencion(holdId),
    refetchInterval: 30_000,
  })
  const r = retencion.data
  const detalle = useQuery({
    queryKey: ['itinerario', r?.itineraryId],
    queryFn: () => api.catalogo.itinerario(r!.itineraryId),
    enabled: !!r,
  })
  useAcento(detalle.data?.destino)
  const oferta = useQuery({
    queryKey: ['oferta', r?.offerId],
    queryFn: () => api.ofertas.obtener(r!.offerId!),
    enabled: !!r?.offerId,
  })
  const usuario = useQuery({
    queryKey: ['usuario', s?.userId],
    queryFn: () => api.auth.usuario(s!.userId),
    enabled: !!s,
    staleTime: Infinity,
  })

  const [pasajeros, setPasajeros] = useState<PasajeroRequest[] | null>(null)
  const [errores, setErrores] = useState<Errores>({})
  const restantes = useSegundosRestantes(r?.expiraEn)

  const crear = useMutation({
    mutationFn: (lista: PasajeroRequest[]) => api.reservas.crear(holdId, lista),
    onSuccess: (reserva, lista) => {
      recordarViajero(lista[0])
      navigate(`/pago/${reserva.bookingId}`, { replace: true })
    },
    onError: (e) => toast(textoError(e)),
  })

  const extender = useMutation({
    mutationFn: () => api.asientos.extender(holdId),
    onSuccess: (nueva) => {
      recordarRetencion(nueva)
      void retencion.refetch()
      toast('Listo: te damos unos minutos más.')
    },
    onError: (e) => toast(textoError(e)),
  })

  const soltar = useMutation({
    mutationFn: () => api.asientos.liberar(holdId),
    onSettled: () => {
      olvidarRetencion(holdId)
      navigate(r ? `/viaje/${r.itineraryId}/asientos` : '/inicio', { replace: true })
    },
  })

  const reapartar = useMutation({
    mutationFn: () => api.asientos.retener(r!.itineraryId, r!.seatNumbers),
    onSuccess: (nueva) => {
      recordarRetencion(nueva)
      navigate(`/reserva/${nueva.holdId}`, { replace: true })
    },
    onError: (e) => {
      toast(textoError(e))
      navigate(`/viaje/${r!.itineraryId}/asientos`)
    },
  })

  if (retencion.isError) {
    return <PantallaError titulo="No encontramos tu puesto apartado" error={retencion.error} reintentar={() => retencion.refetch()} />
  }
  if (!r) {
    return (
      <Pantalla>
        <Esqueleto bloques={[60, 150, 220]} />
      </Pantalla>
    )
  }
  // Ya hay reserva para esta retención (volvió atrás desde el pago): se sigue donde iba.
  if (r.bookingId) return <Navigate to={`/pago/${r.bookingId}`} replace />

  const vencida = r.estado !== 'ACTIVA' || restantes === 0
  if (vencida) {
    return (
      <Pantalla>
        <header className="px-5">
          <BotonVolver a={`/viaje/${r.itineraryId}/asientos`} />
        </header>
        <section role="alert" className="flex flex-1 flex-col gap-3.5 px-6 pt-10">
          <span className="num self-start rounded-2xl bg-presencia px-4 py-2 text-[32px] font-bold text-alerta">0:00</span>
          <h1 className="font-display text-[24px] leading-tight font-bold tracking-[-0.01em]">
            Soltamos el {r.seatNumbers.join(', ')} para que otros puedan comprarlo.
          </h1>
          <p className="text-[15px] leading-relaxed text-texto-2">
            Pasaron los 10 minutos. Si sigue libre y lo apartas otra vez, vuelves a tener 10 minutos.
          </p>
          <div className="mt-2 flex flex-col gap-2.5">
            {!r.offerId && (
              <Button ancho="completo" disabled={reapartar.isPending} onClick={() => reapartar.mutate()}>
                {reapartar.isPending ? 'Apartando…' : `Apartar el ${r.seatNumbers.join(', ')} otra vez`}
              </Button>
            )}
            <Button variante="contorno" ancho="completo" onClick={() => navigate(`/viaje/${r.itineraryId}/asientos`)}>
              Elegir otro puesto
            </Button>
          </div>
        </section>
      </Pantalla>
    )
  }

  const base: PasajeroRequest = ultimoViajero() ?? { nombre: usuario.data?.nombre ?? '', tipoDocumento: 'CC', numeroDocumento: '' }
  const lista =
    pasajeros ??
    r.seatNumbers.map((_, i) => (i === 0 ? base : { nombre: '', tipoDocumento: 'CC' as TipoDocumento, numeroDocumento: '' }))
  const cambiar = (i: number, parcial: Partial<PasajeroRequest>) => {
    setPasajeros(lista.map((p, k) => (k === i ? { ...p, ...parcial } : p)))
    setErrores((e) => ({ ...e, [i]: {} }))
  }

  const d = detalle.data
  const precio = oferta.data?.precioOferta ?? d?.precioBase ?? null
  const total = precio == null ? null : precio * r.seatNumbers.length

  const enviar = (ev: FormEvent) => {
    ev.preventDefault()
    const limpios = lista.map((p) => ({ ...p, nombre: p.nombre.trim(), numeroDocumento: p.numeroDocumento.trim() }))
    const errs: Errores = {}
    limpios.forEach((p, i) => {
      const e = validarPasajero(p)
      if (Object.keys(e).length) errs[i] = e
    })
    setErrores(errs)
    if (Object.keys(errs).length) return
    crear.mutate(limpios)
  }

  return (
    <Pantalla className="pb-0">
      <header className="flex items-center gap-3 px-5">
        <BotonVolver a={`/viaje/${r.itineraryId}/asientos`} />
        <h1 className="flex-1 font-display text-[22px] font-bold tracking-[-0.01em]">¿Quién viaja?</h1>
        <ContadorRetencion hasta={r.expiraEn} totalSegundos={r.extendido ? 900 : 600} />
      </header>

      <form id="form-viajeros" onSubmit={enviar} noValidate className="scroll-hoja flex min-h-0 flex-1 flex-col gap-3.5 px-5 pt-4 pb-6">
        <section aria-label="Tu viaje" className="flex flex-col gap-3 rounded-tarjeta bg-tinta p-4 text-white">
          {d ? (
            <>
              <div className="flex items-end justify-between gap-3">
                <span className="flex flex-col">
                  <span className="num text-[30px] leading-none font-bold">{codigoCiudad(d.origen)}</span>
                  <span className="num mt-1 text-[13px] text-tinta-texto-2">{horaCorta(d.fechaSalida)}</span>
                </span>
                <span aria-hidden="true" className="mb-4 h-0.5 flex-1 bg-[repeating-linear-gradient(90deg,var(--acento)_0_6px,transparent_6px_11px)]" />
                <span className="flex flex-col items-end">
                  <span className="num text-[30px] leading-none font-bold">{codigoCiudad(d.destino)}</span>
                  <span className="num mt-1 text-[13px] text-tinta-texto-2">{horaCorta(d.fechaLlegadaEstimada)}</span>
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 border-t border-tinta-2 pt-3 text-[13px]">
                <span className="flex flex-col">
                  <span className="text-tinta-texto-2">Fecha</span>
                  <span className="font-semibold">{fechaCorta(d.fechaSalida)}</span>
                </span>
                <span className="flex flex-col">
                  <span className="text-tinta-texto-2">{r.seatNumbers.length > 1 ? 'Puestos' : 'Puesto'}</span>
                  <span className="num font-semibold">{r.seatNumbers.join(', ')}</span>
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-tinta-texto-2">Empresa</span>
                  <span className="truncate font-semibold" title={d.empresa}>
                    {d.empresa}
                  </span>
                </span>
              </div>
            </>
          ) : (
            <div className="h-[118px]" />
          )}
        </section>

        {r.offerId && (
          <div className="rounded-[18px] bg-naranja px-4 py-3 text-[14px] font-semibold text-tinta">
            Precio de oferta relámpago: {dinero(oferta.data?.precioOferta)} por puesto.
          </div>
        )}

        {lista.map((p, i) => (
          <fieldset key={i} className="flex flex-col gap-3 rounded-tarjeta bg-superficie p-4">
            <legend className="sr-only">Viajero del puesto {r.seatNumbers[i]}</legend>
            <span className="text-[14px] font-semibold">
              Puesto <span className="num">{r.seatNumbers[i]}</span>
            </span>
            <Campo
              etiqueta="Nombre completo"
              autoComplete={i === 0 ? 'name' : 'off'}
              enterKeyHint="next"
              value={p.nombre}
              maxLength={160}
              onChange={(e) => cambiar(i, { nombre: e.target.value })}
              error={errores[i]?.nombre}
            />
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`tipo-${i}`} className="text-[13px] font-semibold">
                Documento
              </label>
              <select
                id={`tipo-${i}`}
                value={p.tipoDocumento}
                onChange={(e) => cambiar(i, { tipoDocumento: e.target.value as TipoDocumento })}
                className="h-13 w-full rounded-control border-[1.5px] border-control bg-superficie px-3 text-base"
              >
                {TIPOS.map((t) => (
                  <option key={t.valor} value={t.valor}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </div>
            <Campo
              etiqueta="Número de documento"
              inputMode={p.tipoDocumento === 'PA' ? 'text' : 'numeric'}
              autoComplete="off"
              enterKeyHint={i === lista.length - 1 ? 'done' : 'next'}
              value={p.numeroDocumento}
              maxLength={20}
              onChange={(e) => cambiar(i, { numeroDocumento: e.target.value.replace(/\s/g, '') })}
              error={errores[i]?.numeroDocumento}
              ayuda="Se lo muestras al conductor al subir."
            />
          </fieldset>
        ))}

        <div className="flex flex-wrap gap-x-4 gap-y-2 text-[14px]">
          {!r.extendido && (restantes ?? 600) <= 300 && (
            <button type="button" className="font-semibold underline underline-offset-2" disabled={extender.isPending} onClick={() => extender.mutate()}>
              {extender.isPending ? 'Pidiendo más tiempo…' : 'Necesito más tiempo'}
            </button>
          )}
          <button type="button" className="text-texto-2 underline underline-offset-2" disabled={soltar.isPending} onClick={() => soltar.mutate()}>
            {soltar.isPending ? 'Soltando…' : 'Soltar el puesto'}
          </button>
        </div>
      </form>

      <footer className="sticky bottom-0 flex flex-col gap-3 rounded-t-[28px] bg-superficie px-5 pt-3.5 pb-[calc(18px+env(safe-area-inset-bottom,0px))] shadow-[0_-8px_28px_rgba(13,20,17,.08)]">
        <div className="flex items-baseline justify-between">
          <span className="text-[15px] text-texto-2">Total</span>
          <span className="num text-[26px] font-bold">{dinero(total)}</span>
        </div>
        <Button type="submit" form="form-viajeros" ancho="completo" className="justify-between" disabled={crear.isPending}>
          {crear.isPending ? 'Preparando el pago…' : 'Ir a pagar'}
          {!crear.isPending && <ArrowRight className="size-[22px] text-acento" strokeWidth={2.5} aria-hidden="true" />}
        </Button>
      </footer>
    </Pantalla>
  )
}
