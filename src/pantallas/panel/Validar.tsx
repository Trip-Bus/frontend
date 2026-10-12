import { useMutation } from '@tanstack/react-query'
import { Camera, CameraOff, Check, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { BotonVolver } from '@/components/marca/BotonVolver'
import { Aviso } from '@/components/marca/Estados'
import { Pantalla } from '@/components/marca/Pantalla'
import { Button } from '@/components/ui/button'
import { textoError } from '@/lib/api'
import { api } from '@/lib/endpoints'
import type { ValidacionTiquete } from '@/lib/tipos'
import { cn } from '@/lib/utils'

const MOTIVOS: Record<string, string> = {
  FORMATO_INVALIDO: 'Ese código no es un pase de TripBus.',
  FIRMA_INVALIDA: 'El código fue alterado: la firma no coincide.',
  TIQUETE_INEXISTENTE: 'Ese tiquete no existe.',
}

type Detector = { detect: (fuente: CanvasImageSource) => Promise<{ rawValue: string }[]> }
type DetectorCtor = new (opciones: { formats: string[] }) => Detector

/**
 * Validar el pase al abordar (conductor u operador). Lee el QR con la cámara si el navegador
 * tiene BarcodeDetector (Chrome en Android); si no, se pega el texto del código.
 */
export function Validar() {
  const [codigo, setCodigo] = useState('')
  const [camara, setCamara] = useState(false)
  const [errorCamara, setErrorCamara] = useState<string | null>(null)
  const video = useRef<HTMLVideoElement>(null)
  const ctor = (globalThis as { BarcodeDetector?: DetectorCtor }).BarcodeDetector

  const validar = useMutation({ mutationFn: (qr: string) => api.reservas.validarTiquete(qr) })

  useEffect(() => {
    if (!camara || !ctor) return
    let activo = true
    let stream: MediaStream | null = null
    const detector = new ctor({ formats: ['qr_code'] })
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then(async (s) => {
        stream = s
        if (!video.current) return
        video.current.srcObject = s
        await video.current.play()
        while (activo && video.current) {
          const encontrados = await detector.detect(video.current).catch(() => [])
          if (encontrados[0]?.rawValue) {
            setCodigo(encontrados[0].rawValue)
            validar.mutate(encontrados[0].rawValue)
            setCamara(false)
            break
          }
          await new Promise((r) => setTimeout(r, 250))
        }
      })
      .catch(() => {
        setErrorCamara('No pudimos abrir la cámara. Revisa el permiso o pega el código.')
        setCamara(false)
      })
    return () => {
      activo = false
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [camara]) // eslint-disable-line react-hooks/exhaustive-deps

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    if (codigo.trim()) validar.mutate(codigo.trim())
  }

  const r: ValidacionTiquete | undefined = validar.data

  return (
    <Pantalla>
      <header className="flex items-center gap-3 px-5">
        <BotonVolver a="/panel" />
        <h1 className="font-display text-[22px] font-bold tracking-[-0.01em]">Validar pase</h1>
      </header>

      <div className="flex flex-col gap-3.5 px-5 pt-4">
        {ctor ? (
          camara ? (
            <div className="relative overflow-hidden rounded-tarjeta bg-tinta">
              <video ref={video} muted playsInline className="aspect-square w-full object-cover" />
              <span aria-hidden="true" className="absolute inset-[18%] rounded-3xl border-4 border-lima" />
              <Button variante="lima" tamano="md" className="absolute right-3 bottom-3" onClick={() => setCamara(false)}>
                <CameraOff className="size-5" aria-hidden="true" />
                Cerrar cámara
              </Button>
            </div>
          ) : (
            <Button ancho="completo" onClick={() => setCamara(true)}>
              <Camera className="size-5 text-lima" aria-hidden="true" />
              Escanear con la cámara
            </Button>
          )
        ) : (
          <Aviso>Este navegador no lee QR con la cámara. Pega aquí el texto del código.</Aviso>
        )}
        {errorCamara && <Aviso tono="alerta">{errorCamara}</Aviso>}

        <form onSubmit={enviar} className="flex flex-col gap-2.5">
          <label htmlFor="qr" className="text-[13px] font-semibold">
            Código del pase
          </label>
          <textarea
            id="qr"
            rows={3}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="TRIPBUS1|…"
            className="num rounded-control border-[1.5px] border-control bg-superficie px-3.5 py-3 text-[14px]"
          />
          <Button type="submit" variante="contorno" ancho="completo" disabled={!codigo.trim() || validar.isPending}>
            {validar.isPending ? 'Validando…' : 'Validar'}
          </Button>
        </form>

        {validar.isError && <Aviso tono="alerta">{textoError(validar.error)}</Aviso>}
        {r && (
          <section
            role="status"
            className={cn('entra flex items-start gap-3 rounded-tarjeta p-4', r.valido ? 'bg-lima text-tinta' : 'border-2 border-presencia-borde bg-presencia text-alerta')}
          >
            <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-full', r.valido ? 'bg-tinta text-lima' : 'bg-presencia-borde text-white')}>
              {r.valido ? <Check className="size-6" strokeWidth={3} aria-hidden="true" /> : <X className="size-6" strokeWidth={3} aria-hidden="true" />}
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="font-display text-[20px] font-bold">{r.valido ? 'Puede subir' : 'No puede subir'}</span>
              {r.valido ? (
                <span className="text-[14px]">
                  Puesto <span className="num font-bold">{r.asientos.replace(/-/g, ', ')}</span>
                  {r.estado !== 'EMITIDO' ? ` · estado ${r.estado.toLowerCase()}` : ''}
                </span>
              ) : (
                <span className="text-[14px]">{MOTIVOS[r.motivo] ?? r.motivo}</span>
              )}
            </span>
          </section>
        )}
      </div>
    </Pantalla>
  )
}
