import { useMutation } from '@tanstack/react-query'
import { MailCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Encabezado } from '@/components/marca/Encabezado'
import { Pantalla } from '@/components/marca/Pantalla'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import { ErrorFormulario } from '@/components/ui/formulario'
import { Campo } from '@/components/ui/input'
import { useAcento } from '@/hooks/useAcento'
import { api } from '@/lib/endpoints'

/**
 * Olvidé mi contraseña (US-125). Identity responde siempre lo mismo, exista o no el correo (no revela
 * quién tiene cuenta): si existe, llega un enlace a /restablecer que vence en 15 minutos.
 */
export function Recuperar() {
  useAcento(null)
  const [email, setEmail] = useState('')
  const pedir = useMutation({ mutationFn: api.auth.pedirRecuperacion })

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    if (email.trim()) pedir.mutate(email.trim())
  }

  return (
    <Pantalla>
      <Encabezado titulo="Recupera tu contraseña" volverA="/entrar">
        Te enviamos un enlace para crear una contraseña nueva.
      </Encabezado>

      {pedir.isSuccess ? (
        <section role="status" className="entra flex flex-1 flex-col gap-4 px-5 pt-6">
          <div className="flex flex-col items-start gap-3 rounded-tarjeta bg-superficie p-5">
            <span className="flex size-11 items-center justify-center rounded-xl bg-acento text-tinta">
              <MailCheck className="size-6" aria-hidden="true" />
            </span>
            <p className="text-[16px] leading-snug">
              Si <strong className="font-semibold break-all">{email.trim()}</strong> tiene una cuenta en TripBus, ya te llegó
              el enlace. Vence en 15 minutos y sirve una sola vez.
            </p>
            <p className="text-[14px] text-texto-2">¿No lo ves? Revisa la carpeta de spam o pide otro en unos minutos.</p>
          </div>
          <div className="flex-1" />
          <Link to="/entrar" className={buttonVariants({ ancho: 'completo' })}>
            Volver a entrar
          </Link>
        </section>
      ) : (
        <form onSubmit={enviar} noValidate className="flex flex-1 flex-col gap-4 px-5 pt-6">
          <Campo
            etiqueta="Correo de tu cuenta"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            enterKeyHint="send"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@correo.com"
          />
          {pedir.error && <ErrorFormulario error={pedir.error} />}
          <div className="flex-1" />
          <Button type="submit" variante="acento" ancho="completo" disabled={pedir.isPending || !email.trim()}>
            {pedir.isPending ? 'Enviando…' : 'Enviar enlace'}
          </Button>
        </form>
      )}
    </Pantalla>
  )
}
