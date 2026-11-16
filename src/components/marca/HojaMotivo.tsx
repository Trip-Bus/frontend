import { useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { AreaTexto } from '@/components/ui/campos'
import { Hoja } from '@/components/ui/hoja'

/**
 * Confirmación de una acción delicada (cancelar, suspender, resolver…). Con `etiquetaMotivo` pide un texto
 * obligatorio; sin ella, solo confirma.
 */
export function HojaMotivo({
  abierta,
  alCerrar,
  titulo,
  descripcion,
  etiquetaMotivo,
  boton,
  ocupado,
  alConfirmar,
  children,
}: {
  abierta: boolean
  alCerrar: () => void
  titulo: string
  descripcion?: string
  etiquetaMotivo?: string
  boton: string
  ocupado?: boolean
  alConfirmar: (motivo: string) => void
  children?: ReactNode
}) {
  const [motivo, setMotivo] = useState('')
  const listo = !etiquetaMotivo || motivo.trim().length >= 3
  const enviar = (e: FormEvent) => {
    e.preventDefault()
    if (listo) alConfirmar(motivo.trim())
  }
  return (
    <Hoja
      abierta={abierta}
      alCambiar={(a) => {
        if (!a) {
          setMotivo('')
          alCerrar()
        }
      }}
      titulo={titulo}
      descripcion={descripcion}
    >
      <form onSubmit={enviar} className="flex flex-col gap-3 pb-2" noValidate>
        {children}
        {etiquetaMotivo && <AreaTexto etiqueta={etiquetaMotivo} value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} />}
        <Button type="submit" ancho="completo" disabled={!listo || ocupado}>
          {ocupado ? 'Un momento…' : boton}
        </Button>
        <Button variante="fantasma" ancho="completo" onClick={alCerrar}>
          Volver
        </Button>
      </form>
    </Hoja>
  )
}
