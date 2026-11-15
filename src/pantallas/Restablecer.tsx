import { useMutation } from '@tanstack/react-query'
import { CircleCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Encabezado } from '@/components/marca/Encabezado'
import { Aviso } from '@/components/marca/Estados'
import { Pantalla } from '@/components/marca/Pantalla'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import { CampoContrasena, ErrorFormulario } from '@/components/ui/formulario'
import { passwordValida } from '@/features/cuenta'
import { useAcento } from '@/hooks/useAcento'
import { ApiError } from '@/lib/api'
import { api } from '@/lib/endpoints'

/**
 * Enlace del correo de recuperación (US-125) y del alta de OPERADOR o CONDUCTOR por el ADMIN (US-103):
 * {FRONTEND_URL}/restablecer?token=… → contraseña nueva. Restablecer también verifica el correo y cierra las
 * demás sesiones.
 */
export function Restablecer() {
  useAcento(null)
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [nueva, setNueva] = useState('')
  const [repetida, setRepetida] = useState('')
  const restablecer = useMutation({ mutationFn: () => api.auth.restablecer(token, nueva) })

  const valida = passwordValida(nueva)
  const coinciden = nueva === repetida
  const enlaceVencido = restablecer.error instanceof ApiError && restablecer.error.code === 'TOKEN_INVALID_OR_EXPIRED'

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    if (valida && coinciden) restablecer.mutate()
  }

  if (!token || enlaceVencido) {
    return (
      <Pantalla>
        <Encabezado titulo="Este enlace ya no sirve" volverA="/entrar">
          Los enlaces para cambiar la contraseña vencen a los 15 minutos y se usan una sola vez.
        </Encabezado>
        <div className="flex flex-1 flex-col px-5 pt-6">
          <div className="flex-1" />
          <Link to="/recuperar" className={buttonVariants({ variante: 'acento', ancho: 'completo' })}>
            Pedir un enlace nuevo
          </Link>
        </div>
      </Pantalla>
    )
  }

  if (restablecer.isSuccess) {
    return (
      <Pantalla>
        <Encabezado titulo="Listo, ya puedes entrar" volverA="/entrar" />
        <section role="status" className="entra flex flex-1 flex-col gap-4 px-5 pt-6">
          <div className="flex items-center gap-3 rounded-tarjeta bg-superficie p-5">
            <CircleCheck className="size-7 shrink-0 text-tinta" aria-hidden="true" />
            <p className="text-[16px] leading-snug">Guardamos tu contraseña nueva y cerramos las sesiones abiertas en otros equipos.</p>
          </div>
          <div className="flex-1" />
          <Link to="/entrar" className={buttonVariants({ variante: 'acento', ancho: 'completo' })}>
            Entrar
          </Link>
        </section>
      </Pantalla>
    )
  }

  return (
    <Pantalla>
      <Encabezado titulo="Crea tu contraseña nueva" volverA="/entrar" />
      <form onSubmit={enviar} noValidate className="flex flex-1 flex-col gap-4 px-5 pt-6">
        <CampoContrasena
          etiqueta="Contraseña nueva"
          autoComplete="new-password"
          enterKeyHint="next"
          autoFocus
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          ayuda="Mínimo 8 caracteres, una mayúscula y un número."
          error={nueva && !valida ? 'Mínimo 8 caracteres, una mayúscula y un número.' : undefined}
        />
        <CampoContrasena
          etiqueta="Repítela"
          autoComplete="new-password"
          enterKeyHint="done"
          value={repetida}
          onChange={(e) => setRepetida(e.target.value)}
          error={repetida && !coinciden ? 'Las dos contraseñas no coinciden.' : undefined}
        />
        {restablecer.error && <ErrorFormulario error={restablecer.error} />}
        <Aviso>Al guardarla se cierran las sesiones abiertas en otros equipos.</Aviso>
        <div className="flex-1" />
        <Button type="submit" variante="acento" ancho="completo" disabled={restablecer.isPending || !valida || !coinciden}>
          {restablecer.isPending ? 'Guardando…' : 'Guardar contraseña'}
        </Button>
      </form>
    </Pantalla>
  )
}
