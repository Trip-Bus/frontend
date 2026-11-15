import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Casilla } from '@/components/ui/campos'
import { Campo } from '@/components/ui/input'
import { esMfaRequerido } from '@/features/cuenta'
import { cargarGoogle } from '@/features/google'
import { ApiError, textoError } from '@/lib/api'
import { api } from '@/lib/endpoints'
import type { AuthResponse } from '@/lib/tipos'

type RegistroGoogle = { idToken: string; email: string; nombre: string }

/**
 * Ingreso con Google (US de identity): el botón oficial de Google Identity Services con el clientId de
 * GET /auth/providers. Con el ID token llama POST /auth/google: entra, pide el código de 2FA o, si la cuenta no
 * existe, un formulario corto (documento y política de datos) con el mismo token.
 */
export function BotonGoogle({ alEntrar, alDesafio }: { alEntrar: (a: AuthResponse) => void; alDesafio: (mfaToken: string) => void }) {
  const proveedores = useQuery({ queryKey: ['proveedores'], queryFn: api.auth.proveedores, staleTime: 10 * 60_000, retry: false })
  const contenedor = useRef<HTMLDivElement>(null)
  const [apagado, setApagado] = useState(false)
  const [errorCarga, setErrorCarga] = useState(false)
  const [registro, setRegistro] = useState<RegistroGoogle | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const google = useMutation({
    mutationFn: api.auth.google,
    onSuccess: (r) => {
      setAviso(null)
      setRegistro(null)
      if (esMfaRequerido(r)) alDesafio(r.mfaToken)
      else alEntrar(r)
    },
    onError: (e, datos) => {
      if (!(e instanceof ApiError)) {
        setAviso(textoError(e))
        return
      }
      if (e.code === 'GOOGLE_REGISTRO_INCOMPLETO') {
        setRegistro({ idToken: datos.idToken, email: String(e.details.email ?? ''), nombre: String(e.details.nombre ?? '') })
        return
      }
      if (e.code === 'GOOGLE_LOGIN_DISABLED') setApagado(true)
      setAviso(e.paraUsuario)
    },
  })
  // El callback de Google se registra una vez: siempre llama a la mutación más reciente.
  const enviarToken = useRef(google.mutate)
  useEffect(() => {
    enviarToken.current = google.mutate
  })

  const clientId = proveedores.data?.google?.enabled ? (proveedores.data.google.clientId ?? null) : null
  useEffect(() => {
    if (!clientId || !contenedor.current) return
    let vigente = true
    cargarGoogle()
      .then((id) => {
        if (!vigente || !contenedor.current) return
        id.initialize({ client_id: clientId, callback: (r) => enviarToken.current({ idToken: r.credential }), ux_mode: 'popup', cancel_on_tap_outside: true })
        id.renderButton(contenedor.current, { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', locale: 'es', width: 320 })
      })
      .catch(() => vigente && setErrorCarga(true))
    return () => {
      vigente = false
    }
  }, [clientId])

  if (!clientId || apagado) return aviso ? <p role="alert" className="text-[14px] text-alerta">{aviso}</p> : null

  if (registro) {
    return <CompletarRegistro datos={registro} ocupado={google.isPending} error={aviso} alEnviar={(extra) => google.mutate({ idToken: registro.idToken, aceptaPoliticaDatos: true, ...extra })} alCancelar={() => setRegistro(null)} />
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex w-full items-center gap-3 text-[13px] text-texto-2">
        <span aria-hidden="true" className="h-px flex-1 bg-linea" />o<span aria-hidden="true" className="h-px flex-1 bg-linea" />
      </div>
      <div ref={contenedor} aria-label="Continuar con Google" className="flex min-h-11 justify-center" />
      {google.isPending && <p role="status" className="text-[14px] text-texto-2">Entrando con Google…</p>}
      {errorCarga && <p role="alert" className="text-[14px] text-texto-2">No pudimos cargar el botón de Google. Entra con tu correo.</p>}
      {aviso && (
        <p role="alert" className="rounded-control bg-presencia p-3 text-center text-[14px] font-medium text-alerta">
          {aviso}
        </p>
      )}
    </div>
  )
}

function CompletarRegistro({
  datos,
  ocupado,
  error,
  alEnviar,
  alCancelar,
}: {
  datos: RegistroGoogle
  ocupado: boolean
  error: string | null
  alEnviar: (extra: { documentoIdentidad: string; nombre: string }) => void
  alCancelar: () => void
}) {
  const [nombre, setNombre] = useState(datos.nombre)
  const [documento, setDocumento] = useState('')
  const [acepta, setAcepta] = useState(false)
  const listo = nombre.trim().length >= 3 && /^[A-Za-z0-9-]{4,20}$/.test(documento) && acepta
  const enviar = (e: FormEvent) => {
    e.preventDefault()
    if (listo) alEnviar({ documentoIdentidad: documento, nombre: nombre.trim() })
  }
  return (
    <form onSubmit={enviar} aria-label="Completar el registro con Google" className="entra flex flex-col gap-3" noValidate>
      <p className="text-[15px] leading-snug">Es tu primera vez con Google. Completa estos datos para crear tu cuenta.</p>
      <Campo etiqueta="Correo" value={datos.email} readOnly />
      <Campo etiqueta="Nombre completo" autoComplete="name" value={nombre} onChange={(e) => setNombre(e.target.value)} />
      <Campo etiqueta="Documento de identidad" inputMode="numeric" value={documento} maxLength={20} onChange={(e) => setDocumento(e.target.value.replace(/\s/g, ''))} />
      <Casilla etiqueta="Acepto la política de tratamiento de datos personales (Ley 1581 de 2012)." marcada={acepta} alCambiar={setAcepta} />
      {error && (
        <p role="alert" className="rounded-control bg-presencia p-3 text-[14px] font-medium text-alerta">
          {error}
        </p>
      )}
      <Button type="submit" variante="acento" ancho="completo" disabled={!listo || ocupado}>
        {ocupado ? 'Creando la cuenta…' : 'Crear mi cuenta con Google'}
      </Button>
      <Button variante="fantasma" ancho="completo" onClick={alCancelar}>
        Volver
      </Button>
    </form>
  )
}
