import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Check, CircleCheck, Siren } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Aviso } from '@/components/marca/Estados'
import { Button } from '@/components/ui/button'
import { Campo } from '@/components/ui/input'
import { textoError } from '@/lib/api'
import { api } from '@/lib/endpoints'
import type { ChecklistInicioViaje } from '@/lib/tipos'
import { cn } from '@/lib/utils'

const LISTA_CHECKLIST = [
  { clave: 'manifiestoRevisado', texto: 'Manifiesto revisado' },
  { clave: 'documentosBus', texto: 'Documentos del bus vigentes' },
  { clave: 'lucesYLlantas', texto: 'Luces y llantas verificadas' },
  { clave: 'botiquinYExtintor', texto: 'Botiquín y extintor disponibles' },
] as const

const TIEMPO_SOS_MS = 2_000

export function OperacionesConductor({ itineraryId }: { itineraryId: string }) {
  const queryClient = useQueryClient()
  const [checklist, setChecklist] = useState<ChecklistInicioViaje>({
    manifiestoRevisado: false,
    documentosBus: false,
    lucesYLlantas: false,
    botiquinYExtintor: false,
  })
  const [observacion, setObservacion] = useState('')
  const [confirmarFin, setConfirmarFin] = useState(false)
  const [manteniendoSos, setManteniendoSos] = useState(false)
  const sosTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const viajes = useQuery({
    queryKey: ['conductor', 'viajes', 'hoy'],
    queryFn: () => api.conductor.misViajes(),
    staleTime: 30_000,
  })
  const viaje = viajes.data?.find((item) => item.itineraryId === itineraryId)

  const actualizarViaje = () => {
    void queryClient.invalidateQueries({ queryKey: ['conductor', 'viajes', 'hoy'] })
  }
  const iniciar = useMutation({
    mutationFn: () => api.conductor.iniciarViaje(itineraryId, checklist, observacion.trim() || undefined),
    onSuccess: () => {
      toast('Viaje iniciado. El rastreo ya está activo.')
      setConfirmarFin(false)
      actualizarViaje()
    },
    onError: (error) => toast(textoError(error)),
  })
  const finalizar = useMutation({
    mutationFn: () => api.conductor.finalizarViaje(itineraryId),
    onSuccess: () => {
      toast('Viaje finalizado.')
      setConfirmarFin(false)
      actualizarViaje()
    },
    onError: (error) => toast(textoError(error)),
  })
  const sos = useMutation({
    mutationFn: () => api.conductor.enviarSos('El conductor solicita asistencia.'),
    onSuccess: () => toast('Alerta SOS enviada al operador de tu empresa.'),
    onError: (error) => toast(textoError(error)),
  })

  useEffect(() => () => {
    if (sosTimer.current) clearTimeout(sosTimer.current)
  }, [])

  const empezarPulsacionSos = () => {
    if (!viaje?.puedeCompartirUbicacion || sos.isPending || sosTimer.current) return
    setManteniendoSos(true)
    sosTimer.current = setTimeout(() => {
      sosTimer.current = null
      setManteniendoSos(false)
      sos.mutate()
    }, TIEMPO_SOS_MS)
  }
  const cancelarPulsacionSos = () => {
    if (sosTimer.current) clearTimeout(sosTimer.current)
    sosTimer.current = null
    setManteniendoSos(false)
  }

  const checklistCompleto = LISTA_CHECKLIST.every(({ clave }) => checklist[clave])
  const puedeIniciar = !!viaje && viaje.puedeCompartirUbicacion && !viaje.iniciado && !viaje.finalizado

  return (
    <section aria-label="Operaciones del conductor" className="flex flex-col gap-3 rounded-tarjeta bg-superficie p-4">
      <h2 className="text-[16px] font-semibold">Operación del viaje</h2>
      {viajes.isPending ? (
        <p role="status" className="text-[14px] text-texto-2">Verificando tu asignación…</p>
      ) : viajes.isError ? (
        <Aviso tono="alerta">No pudimos verificar tu asignación. Intenta de nuevo antes de operar el viaje.</Aviso>
      ) : !viaje ? (
        <Aviso tono="alerta">Este viaje no aparece entre tus asignaciones de hoy; no puedes iniciar acciones de conductor.</Aviso>
      ) : viaje.finalizado ? (
        <Aviso tono="exito">Este viaje ya fue finalizado.</Aviso>
      ) : viaje.iniciado ? (
        <>
          <Aviso tono="exito">El viaje está iniciado. El rastreo queda sujeto a la ventana activa.</Aviso>
          <Button
            variante="tinta"
            className="bg-alerta text-white hover:brightness-95"
            ancho="completo"
            disabled={finalizar.isPending}
            onClick={() => setConfirmarFin(true)}
          >
            <CircleCheck className="size-5" aria-hidden="true" />
            Finalizar viaje
          </Button>
          {confirmarFin && (
            <div role="alertdialog" aria-label="Confirmar finalización" className="flex flex-col gap-2 rounded-control border border-linea p-3">
              <p className="text-[14px]">Al finalizar se detiene el rastreo y no podrás reabrir el viaje.</p>
              <div className="grid grid-cols-2 gap-2">
                <Button variante="contorno" onClick={() => setConfirmarFin(false)}>Cancelar</Button>
                <Button variante="tinta" className="bg-alerta text-white hover:brightness-95" disabled={finalizar.isPending} onClick={() => finalizar.mutate()}>
                  {finalizar.isPending ? 'Finalizando…' : 'Sí, finalizar'}
                </Button>
              </div>
            </div>
          )}
          {viaje.puedeCompartirUbicacion && (
            <div className="flex flex-col gap-2 rounded-control border border-presencia-borde bg-presencia p-3">
              <div className="flex items-center gap-2 text-[14px] font-semibold text-alerta">
                <AlertTriangle className="size-5" aria-hidden="true" />
                Emergencia
              </div>
              <Button
                variante="tinta"
                className="bg-alerta text-white hover:brightness-95"
                ancho="completo"
                disabled={sos.isPending}
                aria-label="Mantén presionado 2 segundos para enviar SOS"
                onPointerDown={(event) => {
                  event.preventDefault()
                  empezarPulsacionSos()
                }}
                onPointerUp={cancelarPulsacionSos}
                onPointerLeave={cancelarPulsacionSos}
                onPointerCancel={cancelarPulsacionSos}
                onKeyDown={(event) => {
                  if (event.key === ' ' || event.key === 'Enter') {
                    event.preventDefault()
                    empezarPulsacionSos()
                  }
                }}
                onKeyUp={cancelarPulsacionSos}
                onBlur={cancelarPulsacionSos}
                onContextMenu={(event) => event.preventDefault()}
              >
                <Siren className={cn('size-5', manteniendoSos && 'animate-pulse')} aria-hidden="true" />
                {sos.isPending ? 'Enviando SOS…' : manteniendoSos ? 'Sigue presionando…' : 'Mantén presionado para SOS'}
              </Button>
              <p className="text-[12px] text-alerta">El operador recibirá una alerta de emergencia.</p>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="text-[14px] text-texto-2">Confirma estos cuatro puntos antes de iniciar el recorrido.</p>
          <div className="flex flex-col gap-2">
            {LISTA_CHECKLIST.map(({ clave, texto }) => (
              <label key={clave} className="flex min-h-11 items-center gap-3 rounded-control border border-linea px-3 py-2 text-[14px]">
                <input
                  type="checkbox"
                  checked={checklist[clave]}
                  disabled={!puedeIniciar || iniciar.isPending}
                  onChange={(event) => setChecklist((actual) => ({ ...actual, [clave]: event.target.checked }))}
                  className="size-5 accent-current"
                />
                <span className="flex-1">{texto}</span>
                {checklist[clave] && <Check className="size-4" aria-hidden="true" />}
              </label>
            ))}
          </div>
          <Campo
            etiqueta="Observación (opcional)"
            value={observacion}
            maxLength={300}
            onChange={(event) => setObservacion(event.target.value)}
          />
          {!viaje.puedeCompartirUbicacion && (
            <Aviso>El inicio estará disponible dentro de la ventana programada del viaje.</Aviso>
          )}
          <Button
            ancho="completo"
            disabled={!puedeIniciar || !checklistCompleto || iniciar.isPending}
            onClick={() => iniciar.mutate()}
          >
            {iniciar.isPending ? 'Iniciando viaje…' : 'Iniciar viaje'}
          </Button>
        </>
      )}
    </section>
  )
}
