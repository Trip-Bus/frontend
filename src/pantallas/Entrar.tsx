import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import fotoBus from '@/assets/entrar-bus.jpg'
import { BotonVolver } from '@/components/marca/BotonVolver'
import { Pantalla } from '@/components/marca/Pantalla'
import { Button } from '@/components/ui/button'
import { CampoContrasena, ErrorFormulario } from '@/components/ui/formulario'
import { Campo } from '@/components/ui/input'
import { useAcento } from '@/hooks/useAcento'
import { esMfaRequerido, normalizarCodigo, passwordValida } from '@/features/cuenta'
import { ApiError } from '@/lib/api'
import { api } from '@/lib/endpoints'
import { sesion } from '@/lib/sesion'
import type { AuthResponse } from '@/lib/tipos'
import { cn } from '@/lib/utils'

type Modo = 'entrar' | 'registro'

/** Solo rutas internas: evita redirecciones abiertas (?siguiente=https://otro-sitio). */
function destinoSeguro(valor: string | null): string {
  return valor && valor.startsWith('/') && !valor.startsWith('//') ? valor : '/inicio'
}

export function Entrar() {
  useAcento(null)
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [modo, setModo] = useState<Modo>('entrar')

  const alEntrar = (auth: AuthResponse) => {
    sesion.iniciar(auth)
    navigate(destinoSeguro(params.get('siguiente')), { replace: true })
  }

  return (
    <Pantalla aSangre>
      {/* Bus en ruta junto al mar (Momo Kim, Unsplash, licencia libre). Al crear cuenta se encoge. */}
      <div
        className={cn(
          'relative shrink-0 overflow-hidden bg-[#6f93c4] transition-[height] duration-300 ease-out motion-reduce:transition-none',
          modo === 'entrar' ? 'h-[clamp(260px,40dvh,340px)]' : 'h-[clamp(150px,22dvh,190px)]',
        )}
      >
        <img
          src={fotoBus}
          alt=""
          decoding="async"
          className="absolute inset-0 size-full object-cover"
          style={{ objectPosition: '100% 100%' }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{ background: 'linear-gradient(180deg, rgba(13,20,17,.38) 0%, rgba(13,20,17,0) 34%)' }}
        />
        <div className="pt-seguro absolute inset-x-0 top-0 flex items-center justify-between px-5">
          <BotonVolver a="/" className="border border-white/25 bg-tinta/40 text-white backdrop-blur-md" />
          <span className="font-display text-[22px] font-extrabold tracking-[-0.02em] text-white [text-shadow:0_1px_12px_rgba(13,20,17,.45)]">
            tripbus
          </span>
        </div>
      </div>

      <div className="relative -mt-5 flex flex-1 flex-col rounded-t-[28px] bg-fondo px-5 pt-6 pb-[calc(18px+env(safe-area-inset-bottom,0px))]">
        <h1 key={modo} className="entra font-display text-[32px] leading-[1.05] font-extrabold tracking-[-0.02em]">
          {modo === 'entrar' ? 'Hola de nuevo.' : 'Crea tu cuenta.'}
        </h1>
        <p className="mt-2 text-[15px] text-texto-2">
          {modo === 'entrar'
            ? 'Entra para apartar puestos y ver tus tiquetes.'
            : 'Toma un minuto. Tu documento va en el tiquete.'}
        </p>

        <div role="tablist" aria-label="Acceso" className="relative mt-5 grid h-12 grid-cols-2 rounded-2xl bg-[#e6e9e1] p-1">
          <span
            aria-hidden="true"
            className="absolute top-1 left-1 h-10 w-[calc((100%-8px)/2)] rounded-xl bg-superficie shadow-[0_1px_3px_rgba(13,20,17,.12)] transition-transform duration-200 ease-out"
            style={{ transform: modo === 'registro' ? 'translateX(100%)' : 'translateX(0)' }}
          />
          {(['entrar', 'registro'] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={modo === m}
              onClick={() => setModo(m)}
              className={cn('relative text-[15px]', modo === m ? 'font-semibold' : 'font-medium text-texto-2')}
            >
              {m === 'entrar' ? 'Entrar' : 'Crear cuenta'}
            </button>
          ))}
        </div>

        {modo === 'entrar' ? <FormEntrar alEntrar={alEntrar} /> : <FormRegistro alEntrar={alEntrar} />}
      </div>
    </Pantalla>
  )
}

function FormEntrar({ alEntrar }: { alEntrar: (a: AuthResponse) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // US-106: con la verificación en dos pasos activa, el login devuelve un desafío y se pide el código.
  const [desafio, setDesafio] = useState<string | null>(null)
  const login = useMutation({
    mutationFn: api.auth.login,
    onSuccess: (r) => (esMfaRequerido(r) ? setDesafio(r.mfaToken) : alEntrar(r)),
  })

  if (desafio) {
    return (
      <FormDosPasos
        mfaToken={desafio}
        alEntrar={alEntrar}
        volver={() => {
          setDesafio(null)
          setPassword('')
          login.reset()
        }}
      />
    )
  }

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    login.mutate({ email: email.trim(), password })
  }

  return (
    <form onSubmit={enviar} className="mt-5 flex flex-1 flex-col gap-4" noValidate>
      <Campo
        etiqueta="Correo"
        type="email"
        autoComplete="email"
        inputMode="email"
        autoCapitalize="none"
        autoCorrect="off"
        enterKeyHint="next"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="tu@correo.com"
      />
      <CampoContrasena
        etiqueta="Contraseña"
        autoComplete="current-password"
        enterKeyHint="go"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Link to="/recuperar" className="tap -mt-1 self-start rounded-lg py-1 text-[14px] font-semibold underline underline-offset-4">
        ¿Olvidaste tu contraseña?
      </Link>
      {login.error && <ErrorFormulario error={login.error} />}
      <div className="flex-1" />
      <Button type="submit" variante="acento" ancho="completo" disabled={login.isPending || !email || !password}>
        {login.isPending ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  )
}

/**
 * Segundo paso del login (US-106): el código de 6 dígitos de la app de autenticación o, si no se tiene el
 * teléfono, un código de recuperación. El desafío vence en 5 minutos y sirve una sola vez.
 */
function FormDosPasos({
  mfaToken,
  alEntrar,
  volver,
}: {
  mfaToken: string
  alEntrar: (a: AuthResponse) => void
  volver: () => void
}) {
  const [conRecuperacion, setConRecuperacion] = useState(false)
  const [codigo, setCodigo] = useState('')
  const paso = useMutation({
    mutationFn: api.auth.segundoPaso,
    onSuccess: alEntrar,
    // El desafío venció o se usó: hay que empezar de nuevo con correo y contraseña.
    onError: (e) => e instanceof ApiError && e.code === 'MFA_TOKEN_INVALID' && volver(),
  })
  const limpio = conRecuperacion ? codigo.trim() : normalizarCodigo(codigo)
  const listo = conRecuperacion ? limpio.length >= 6 : /^\d{6}$/.test(limpio)

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    if (!listo) return
    paso.mutate(conRecuperacion ? { mfaToken, recoveryCode: limpio } : { mfaToken, code: limpio })
  }

  return (
    <form onSubmit={enviar} className="entra mt-5 flex flex-1 flex-col gap-4" noValidate>
      <p className="text-[15px] leading-snug">
        {conRecuperacion
          ? 'Escribe uno de los códigos de recuperación que guardaste al activar la verificación. Cada uno sirve una vez.'
          : 'Tu cuenta tiene verificación en dos pasos. Abre tu app de autenticación y escribe el código de 6 dígitos.'}
      </p>
      {conRecuperacion ? (
        <Campo
          key="recuperacion"
          etiqueta="Código de recuperación"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          autoFocus
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          className="font-mono"
        />
      ) : (
        <Campo
          key="totp"
          etiqueta="Código de la app"
          inputMode="numeric"
          autoComplete="one-time-code"
          enterKeyHint="go"
          maxLength={7}
          autoFocus
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          placeholder="123456"
          className="font-mono text-[20px] tracking-[0.3em]"
        />
      )}
      <button
        type="button"
        onClick={() => {
          setConRecuperacion((v) => !v)
          setCodigo('')
          paso.reset()
        }}
        className="tap -mt-1 self-start rounded-lg py-1 text-left text-[14px] font-semibold underline underline-offset-4"
      >
        {conRecuperacion ? 'Usar el código de la app' : 'No tengo el teléfono: usar un código de recuperación'}
      </button>
      {paso.error && <ErrorFormulario error={paso.error} />}
      <div className="flex-1" />
      <div className="flex flex-col gap-2.5">
        <Button type="submit" variante="acento" ancho="completo" disabled={paso.isPending || !listo}>
          {paso.isPending ? 'Verificando…' : 'Verificar y entrar'}
        </Button>
        <Button type="button" variante="fantasma" ancho="completo" onClick={volver}>
          Volver
        </Button>
      </div>
    </form>
  )
}

function FormRegistro({ alEntrar }: { alEntrar: (a: AuthResponse) => void }) {
  const [datos, setDatos] = useState({ nombre: '', documentoIdentidad: '', email: '', password: '' })
  const [acepta, setAcepta] = useState(false)
  const registro = useMutation({ mutationFn: api.auth.registro, onSuccess: alEntrar })
  const cambiar = (k: keyof typeof datos) => (e: { target: { value: string } }) =>
    setDatos((d) => ({ ...d, [k]: e.target.value }))

  // Mismas reglas que Identity (RegistroRequest.java), para avisar antes de enviar.
  const valida = passwordValida(datos.password)
  const completo = datos.nombre.trim() && datos.documentoIdentidad.trim() && datos.email.trim() && valida && acepta

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    if (!completo) return
    registro.mutate({ ...datos, nombre: datos.nombre.trim(), email: datos.email.trim(), aceptaPoliticaDatos: true })
  }

  return (
    <form onSubmit={enviar} className="mt-5 flex flex-1 flex-col gap-4" noValidate>
      <Campo etiqueta="Nombre completo" autoComplete="name" enterKeyHint="next" value={datos.nombre} onChange={cambiar('nombre')} />
      <Campo
        etiqueta="Documento de identidad"
        inputMode="numeric"
        autoComplete="off"
        enterKeyHint="next"
        value={datos.documentoIdentidad}
        onChange={cambiar('documentoIdentidad')}
      />
      <Campo
        etiqueta="Correo"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect="off"
        enterKeyHint="next"
        value={datos.email}
        onChange={cambiar('email')}
      />
      <CampoContrasena
        etiqueta="Contraseña"
        autoComplete="new-password"
        enterKeyHint="done"
        value={datos.password}
        onChange={cambiar('password')}
        ayuda="Mínimo 8 caracteres, una mayúscula y un número."
        error={datos.password && !valida ? 'Mínimo 8 caracteres, una mayúscula y un número.' : undefined}
      />
      <label className="flex items-start gap-3 text-[14px] leading-snug">
        <input
          type="checkbox"
          checked={acepta}
          onChange={(e) => setAcepta(e.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-tinta"
        />
        <span>Acepto la política de tratamiento de datos personales (Ley 1581 de 2012).</span>
      </label>
      {registro.error && <ErrorFormulario error={registro.error} />}
      <div className="flex-1" />
      <Button type="submit" variante="acento" ancho="completo" disabled={registro.isPending || !completo}>
        {registro.isPending ? 'Creando cuenta…' : 'Crear cuenta'}
      </Button>
    </form>
  )
}
