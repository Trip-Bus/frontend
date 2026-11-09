import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CircleCheck, MailX } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Esqueleto } from '@/components/marca/Estados'
import { Pantalla } from '@/components/marca/Pantalla'
import { buttonVariants } from '@/components/ui/button-variants'
import { useAcento } from '@/hooks/useAcento'
import { ApiError, textoError } from '@/lib/api'
import { api } from '@/lib/endpoints'
import { useSesion } from '@/lib/sesion'

/**
 * Enlace del correo de verificación (US-130): {FRONTEND_URL}/verificar-correo?token=… Se confirma solo al
 * abrir la página (una sola vez, también en StrictMode). El enlace vence en 24 h y sirve una vez.
 */
export function VerificarCorreo() {
  useAcento(null)
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const s = useSesion()
  const queryClient = useQueryClient()
  const enviado = useRef(false)
  const verificar = useMutation({
    mutationFn: api.auth.verificarCorreo,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['perfil'] }),
  })

  useEffect(() => {
    if (token && !enviado.current) {
      enviado.current = true
      verificar.mutate(token)
    }
  }, [token, verificar])

  const destino = s ? '/cuenta' : '/entrar'
  const vencido = !token || (verificar.error instanceof ApiError && verificar.error.code === 'TOKEN_INVALID_OR_EXPIRED')

  if (token && (verificar.isPending || verificar.isIdle)) {
    return (
      <Pantalla>
        <Esqueleto bloques={[48, 120]} />
      </Pantalla>
    )
  }

  return (
    <Pantalla className="items-center justify-center px-7 text-center">
      {verificar.isSuccess ? (
        <section role="status" className="entra flex flex-col items-center gap-3">
          <span className="flex size-16 items-center justify-center rounded-full bg-acento text-tinta">
            <CircleCheck className="size-8" aria-hidden="true" />
          </span>
          <h1 className="font-display text-[26px] font-bold tracking-[-0.01em]">Correo verificado</h1>
          <p className="text-[15px] text-texto-2">Gracias. Ahí te llegarán tus tiquetes y los avisos de tus viajes.</p>
          <Link to={destino} className={buttonVariants({ className: 'mt-4' })}>
            {s ? 'Ir a tu cuenta' : 'Entrar'}
          </Link>
        </section>
      ) : (
        <section role="alert" className="entra flex flex-col items-center gap-3">
          <span className="flex size-16 items-center justify-center rounded-full bg-presencia text-alerta">
            <MailX className="size-8" aria-hidden="true" />
          </span>
          <h1 className="font-display text-[26px] font-bold tracking-[-0.01em]">
            {vencido ? 'Este enlace ya no sirve' : 'No pudimos verificar tu correo'}
          </h1>
          <p className="text-[15px] text-texto-2">
            {vencido
              ? 'Los enlaces de verificación vencen a las 24 horas y se usan una sola vez. Pide uno nuevo desde tu cuenta.'
              : textoError(verificar.error)}
          </p>
          <Link to={destino} className={buttonVariants({ className: 'mt-4' })}>
            {s ? 'Ir a tu cuenta' : 'Entrar'}
          </Link>
        </section>
      )}
    </Pantalla>
  )
}
