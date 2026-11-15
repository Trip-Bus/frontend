import { Eye, EyeOff } from 'lucide-react'
import { useState, type ComponentProps } from 'react'
import { ApiError } from '@/lib/api'
import { Campo } from './input'

/** Contraseña con botón para mostrarla: en el celular es fácil equivocarse sin verla. */
export function CampoContrasena(props: Omit<ComponentProps<typeof Campo>, 'type' | 'accion'>) {
  const [visible, setVisible] = useState(false)
  return (
    <Campo
      {...props}
      type={visible ? 'text' : 'password'}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      accion={
        <button
          type="button"
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
          className="tap flex size-11 items-center justify-center rounded-xl text-texto-2"
        >
          {visible ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
        </button>
      }
    />
  )
}


/** Error de un formulario, en el lenguaje de la persona (mensajes de api.ts). */
export function ErrorFormulario({ error }: { error: Error }) {
  const texto = error instanceof ApiError ? error.paraUsuario : 'Algo salió mal. Intenta de nuevo.'
  return (
    <p role="alert" className="rounded-control bg-presencia p-3 text-[14px] font-medium text-alerta">
      {texto}
    </p>
  )
}
