import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, FileDown } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { BotonMantener } from '@/components/marca/BotonMantener'
import { useAcento } from '@/hooks/useAcento'
import { BotonVolver } from '@/components/marca/BotonVolver'
import { ContadorRetencion } from '@/components/marca/Contador'
import { Esqueleto, PantallaError } from '@/components/marca/Estados'
import { LiveDot } from '@/components/marca/LiveDot'
import { Pantalla } from '@/components/marca/Pantalla'
import { buttonVariants } from '@/components/ui/button-variants'
import { Button } from '@/components/ui/button'
import { celularValido, claveDePago, ESTADOS_EN_PROCESO, MOTIVOS_RECHAZO, validarPse, type ErroresPse } from '@/features/pagos'
import { olvidarRetencion, recordarRetencion } from '@/features/retenciones'
import { useSegundosRestantes } from '@/hooks/useAhora'
import { useDescargar } from '@/hooks/useDescargar'
import { ApiError, textoError } from '@/lib/api'
import { codigoCiudad } from '@/lib/ciudades'
import { api } from '@/lib/endpoints'
import { dinero, fechaCorta, horaCorta } from '@/lib/formato'
import { tokenSandbox, validarTarjeta, type ErroresTarjeta } from '@/lib/tarjeta'
import type { DatosPse, MetodoPago, PagoRequest, Reserva } from '@/lib/tipos'
import { FormNequi, FormPse, FormTarjeta, SelectorMetodo, type DatosTarjeta } from './pago/Metodos'

const ESPERA: Record<MetodoPago, { titulo: string; detalle: string }> = {
  TARJETA: { titulo: 'Confirmando con tu banco…', detalle: 'No cierres esta pantalla. Si el intento se repite, cobramos una sola vez.' },
  PSE: { titulo: 'Esperando la respuesta de tu banco…', detalle: 'Si ya aprobaste el pago en el banco, en unos segundos queda listo.' },
  NEQUI: { titulo: 'Acepta el pago en tu app Nequi', detalle: 'Abre Nequi y aprueba la notificación. Esta pantalla se actualiza sola.' },
}

/** El backend responde el método en mayúsculas; los históricos de tarjeta pueden venir vacíos. */
const metodoDe = (m: string | null | undefined): MetodoPago => (m === 'PSE' || m === 'NEQUI' ? m : 'TARJETA')

/**
 * Pantalla 05. Pago con tarjeta, PSE o Nequi (US-032, US-143) sin cobros duplicados (US-034).
 * El resultado llega de forma asíncrona (webhook de la pasarela, regreso del banco o la app Nequi): la pantalla
 * consulta la reserva cada segundo y escucha `usuario:{id}:tiquetes` hasta que queda CONFIRMADA o rechazada.
 */
export function Pago() {
  const { bookingId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const reserva = useQuery({
    queryKey: ['reserva', bookingId],
    queryFn: () => api.reservas.obtener(bookingId),
    refetchInterval: (q) => (q.state.data && ESTADOS_EN_PROCESO.has(q.state.data.estado) ? 1000 : false),
  })
  const r = reserva.data
  const detalle = useQuery({
    queryKey: ['itinerario', r?.itineraryId],
    queryFn: () => api.catalogo.itinerario(r!.itineraryId),
    enabled: !!r,
  })
  useAcento(detalle.data?.destino)

  const [metodo, setMetodo] = useState<MetodoPago>('TARJETA')
  const [tarjeta, setTarjeta] = useState<DatosTarjeta>({ numero: '', vence: '', cvc: '' })
  const [errores, setErrores] = useState<ErroresTarjeta>({})
  const [pse, setPse] = useState<DatosPse>({ bancoCodigo: '', tipoPersona: 'NATURAL', tipoDocumento: 'CC', numeroDocumento: '' })
  const [erroresPse, setErroresPse] = useState<ErroresPse>({})
  const [telefono, setTelefono] = useState('')
  const [errorTelefono, setErrorTelefono] = useState<string>()
  const restantes = useSegundosRestantes(r?.holdExpiraEn)
  const descargar = useDescargar()

  const solicitud = (): PagoRequest =>
    metodo === 'PSE' ? { metodo, pse: { ...pse, numeroDocumento: pse.numeroDocumento.trim() } } : metodo === 'NEQUI' ? { metodo, nequi: { telefono } } : { metodo, ...tokenSandbox(tarjeta.numero) }

  const pagar = useMutation({
    mutationFn: () => api.reservas.pagar(bookingId, solicitud(), claveDePago(bookingId, metodo)),
    onSuccess: (pago) => {
      // PSE: el pago sigue en la página del banco; al volver a /pago/{id} se consulta el resultado.
      if (metodo === 'PSE' && pago?.redirectUrl) {
        globalThis.location.assign(pago.redirectUrl)
        return
      }
      queryClient.setQueryData<Reserva>(['reserva', bookingId], (b) =>
        b ? { ...b, estado: 'PAGO_EN_PROCESO', pago: b.pago ? { ...b.pago, metodo } : b.pago } : b,
      )
      void reserva.refetch()
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'IDEMPOTENCY_IN_PROGRESS') {
        void reserva.refetch()
        return
      }
      toast(textoError(e))
      void reserva.refetch()
    },
  })

  const reapartar = useMutation({
    mutationFn: (b: Reserva) => api.asientos.retener(b.itineraryId, b.seatNumbers),
    onSuccess: (h) => {
      recordarRetencion(h)
      void navigate(`/reserva/${h.holdId}`, { replace: true })
    },
    onError: (e, b) => {
      toast(textoError(e))
      void navigate(`/viaje/${b.itineraryId}/asientos`)
    },
  })

  if (reserva.isError) {
    return <PantallaError titulo="No encontramos tu reserva" error={reserva.error} reintentar={() => reserva.refetch()} volverA="/mis-tiquetes" />
  }
  if (!r) {
    return (
      <Pantalla>
        <Esqueleto bloques={[60, 150, 230, 120]} />
      </Pantalla>
    )
  }

  const d = detalle.data
  const enProceso = pagar.isPending || ESTADOS_EN_PROCESO.has(r.estado)
  const vencida = r.estado === 'EXPIRADA' || (r.estado === 'PENDIENTE_PAGO' && restantes === 0)

  const espera = ESPERA[r.pago?.metodo ? metodoDe(r.pago.metodo) : metodo]

  const intentar = () => {
    if (metodo === 'TARJETA') {
      const e = validarTarjeta(tarjeta.numero, tarjeta.vence, tarjeta.cvc)
      setErrores(e)
      if (Object.keys(e).length) {
        toast('Revisa los datos de la tarjeta.')
        return
      }
    } else if (metodo === 'PSE') {
      const e = validarPse(pse)
      setErroresPse(e)
      if (Object.keys(e).length) {
        toast('Revisa los datos de PSE.')
        return
      }
    } else if (!celularValido(telefono)) {
      setErrorTelefono('Escribe un celular de 10 dígitos que empiece por 3.')
      return
    }
    pagar.mutate()
  }

  const resumen = (
    <section aria-label="Tu viaje" className="flex flex-col gap-3 rounded-tarjeta bg-superficie p-4">
      <div className="flex items-end justify-between gap-3">
        <span className="flex flex-col">
          <span className="num text-[28px] leading-none font-bold">{codigoCiudad(d?.origen)}</span>
          <span className="num mt-1 text-[13px] text-texto-2">{d ? horaCorta(d.fechaSalida) : ' '}</span>
        </span>
        <span aria-hidden="true" className="mb-4 h-0.5 flex-1 bg-[repeating-linear-gradient(90deg,#0d1411_0_6px,transparent_6px_11px)]" />
        <span className="flex flex-col items-end">
          <span className="num text-[28px] leading-none font-bold">{codigoCiudad(d?.destino)}</span>
          <span className="num mt-1 text-[13px] text-texto-2">{d ? horaCorta(d.fechaLlegadaEstimada) : ' '}</span>
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 border-t border-linea pt-3 text-[13px]">
        <span className="flex flex-col">
          <span className="text-texto-2">Fecha</span>
          <span className="font-semibold">{d ? fechaCorta(d.fechaSalida) : ' '}</span>
        </span>
        <span className="flex flex-col">
          <span className="text-texto-2">{r.seatNumbers.length > 1 ? 'Puestos' : 'Puesto'}</span>
          <span className="num font-semibold">{r.seatNumbers.join(', ')}</span>
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-texto-2">Viajero</span>
          <span className="truncate font-semibold" title={r.pasajeros[0]?.nombre}>
            {r.pasajeros[0]?.nombre}
            {r.pasajeros.length > 1 ? ` +${r.pasajeros.length - 1}` : ''}
          </span>
        </span>
      </div>
    </section>
  )

  /* ---------------------------------------------------------------- confirmada */
  if (r.estado === 'CONFIRMADA') {
    olvidarRetencion(r.holdId)
    return (
      <Pantalla>
        <section className="flex flex-1 flex-col gap-4 px-5 pt-6">
          <div role="status" className="entra flex items-center gap-3 rounded-tarjeta bg-acento p-4 text-tinta">
            <span className="flex size-11 items-center justify-center rounded-full bg-tinta text-acento">
              <Check className="size-6" strokeWidth={3} aria-hidden="true" />
            </span>
            <span className="flex flex-col">
              <span className="font-display text-[22px] font-bold">Pago aprobado</span>
              <span className="text-[14px]">
                {dinero(r.total)}
                {r.pago?.tarjetaUltimos4 ? ` con la tarjeta terminada en ${r.pago.tarjetaUltimos4}` : ''}
                {r.pago && !r.pago.tarjetaUltimos4 && metodoDe(r.pago.metodo) !== 'TARJETA' ? ` con ${metodoDe(r.pago.metodo) === 'PSE' ? 'PSE' : 'Nequi'}` : ''}
              </span>
            </span>
          </div>
          {resumen}
          <p className="text-[14px] text-texto-2">Tu pase de abordar ya está listo y funciona sin señal.</p>
          {r.pago?.paymentId && (
            <Button
              variante="contorno"
              ancho="completo"
              disabled={descargar.isPending}
              onClick={() => descargar.mutate({ pedir: () => api.reservas.comprobantePago(r.pago!.paymentId), nombre: `comprobante-${r.bookingId}.pdf` })}
            >
              <FileDown className="size-5" aria-hidden="true" />
              {descargar.isPending ? 'Descargando…' : 'Descargar comprobante de pago'}
            </Button>
          )}
          <div className="flex-1" />
          {r.ticketId ? (
            <Link to={`/pase/${r.ticketId}`} replace className={buttonVariants({ ancho: 'completo' })}>
              Ver mi pase de abordar
            </Link>
          ) : (
            <Button ancho="completo" disabled>
              Emitiendo tu pase…
            </Button>
          )}
        </section>
      </Pantalla>
    )
  }

  /* ---------------------------------------------------------------- rechazada / vencida / reembolsada */
  if (r.estado === 'PAGO_RECHAZADO' || r.estado === 'REEMBOLSADA' || vencida) {
    const rechazo = r.estado === 'PAGO_RECHAZADO'
    const motivo = r.pago?.motivoRechazo ? MOTIVOS_RECHAZO[r.pago.motivoRechazo] : null
    return (
      <Pantalla>
        <header className="px-5">
          <BotonVolver a="/inicio" />
        </header>
        <section role="alert" className="flex flex-1 flex-col gap-3.5 px-6 pt-8">
          <h1 className="font-display text-[26px] leading-tight font-bold tracking-[-0.01em]">
            {rechazo ? 'Tu banco no aprobó el pago' : r.estado === 'REEMBOLSADA' ? 'Te devolvimos el dinero' : 'Se acabó el tiempo para pagar'}
          </h1>
          <p className="text-[15px] leading-relaxed text-texto-2">
            {rechazo
              ? `${motivo ?? 'El banco rechazó la transacción.'} No te cobramos nada y soltamos el puesto.`
              : r.estado === 'REEMBOLSADA'
                ? 'El pago llegó después de que el puesto se liberara. El reembolso ya está en camino.'
                : 'Soltamos el puesto para que otros puedan comprarlo. Si sigue libre puedes apartarlo otra vez.'}
          </p>
          {resumen}
          <div className="mt-2 flex flex-col gap-2.5">
            {!r.offerId && (
              <Button ancho="completo" disabled={reapartar.isPending} onClick={() => reapartar.mutate(r)}>
                {reapartar.isPending ? 'Apartando…' : rechazo ? `Apartar el ${r.seatNumbers.join(', ')} y usar otra tarjeta` : `Apartar el ${r.seatNumbers.join(', ')} otra vez`}
              </Button>
            )}
            <Link to={`/viaje/${r.itineraryId}/asientos`} className={buttonVariants({ variante: 'contorno', ancho: 'completo' })}>
              Elegir otro puesto
            </Link>
          </div>
        </section>
      </Pantalla>
    )
  }

  /* ---------------------------------------------------------------- formulario / procesando */
  return (
    <Pantalla className="pb-0">
      <header className="flex items-center gap-3 px-5">
        <BotonVolver a={`/viaje/${r.itineraryId}/asientos`} />
        <h1 className="flex-1 font-display text-[24px] font-bold tracking-[-0.01em]">Pagar</h1>
        <ContadorRetencion hasta={r.holdExpiraEn} />
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3.5 px-5 pt-4 pb-6">
        {resumen}

        {enProceso ? (
          <section role="status" aria-live="polite" className="flex flex-col items-center gap-3 rounded-tarjeta bg-tinta px-5 py-8 text-center text-white">
            <LiveDot className="size-3" />
            <span className="font-display text-[20px] font-bold">{espera.titulo}</span>
            <span className="text-[14px] text-tinta-texto-2">{espera.detalle}</span>
          </section>
        ) : (
          <form
            className="flex flex-col gap-3 rounded-tarjeta bg-superficie p-4"
            onSubmit={(e) => {
              e.preventDefault()
            }}
            noValidate
          >
            <SelectorMetodo valor={metodo} alCambiar={setMetodo} />
            {metodo === 'TARJETA' && (
              <FormTarjeta
                datos={tarjeta}
                errores={errores}
                alCambiar={(parcial) => {
                  setTarjeta((t) => ({ ...t, ...parcial }))
                  setErrores((x) => ({ ...x, ...Object.fromEntries(Object.keys(parcial).map((k) => [k, undefined])) }))
                }}
              />
            )}
            {metodo === 'PSE' && (
              <FormPse
                datos={pse}
                errores={erroresPse}
                alCambiar={(parcial) => {
                  setPse((x) => ({ ...x, ...parcial }))
                  setErroresPse({})
                }}
              />
            )}
            {metodo === 'NEQUI' && (
              <FormNequi
                telefono={telefono}
                error={errorTelefono}
                alCambiar={(t) => {
                  setTelefono(t)
                  setErrorTelefono(undefined)
                }}
              />
            )}
          </form>
        )}
      </div>

      <footer className="sticky bottom-0 flex flex-col gap-2.5 rounded-t-[28px] bg-superficie px-5 pt-3.5 pb-[calc(18px+env(safe-area-inset-bottom,0px))] shadow-[0_-8px_28px_rgba(13,20,17,.08)]">
        <div className="flex items-baseline justify-between">
          <span className="text-[15px] text-texto-2">Total</span>
          <span className="num text-[26px] font-bold">{dinero(r.total)}</span>
        </div>
        <BotonMantener
          etiqueta={`Mantén presionado dos segundos para pagar ${dinero(r.total)}`}
          deshabilitado={enProceso}
          alCompletar={intentar}
        >
          {enProceso ? 'Procesando…' : 'Mantén para pagar'}
        </BotonMantener>
        <span className="text-center text-[12px] text-texto-2">Sostener 2 segundos evita pagos por error.</span>
      </footer>
    </Pantalla>
  )
}
