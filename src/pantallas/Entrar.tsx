import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { BotonVolver } from '@/components/marca/BotonVolver'
import { Pantalla } from '@/components/marca/Pantalla'
import { Button } from '@/components/ui/button'
import { Campo } from '@/components/ui/input'
import { useAcento } from '@/hooks/useAcento'
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
    <Pantalla className="px-5">
      <header className="flex items-center">
        <BotonVolver a="/" />
      </header>
      <h1 className="mt-6 font-display text-[32px] leading-[1.05] font-extrabold tracking-[-0.02em]">
        {modo === 'entrar' ? 'Hola de nuevo.' : 'Crea tu cuenta.'}
      </h1>
      <p className="mt-2 text-[15px] text-texto-2">
        {modo === 'entrar'
          ? 'Entra para apartar puestos y ver tus tiquetes.'
          : 'Toma un minuto. Tu documento va en el tiquete.'}
      </p>

      <div role="tablist" aria-label="Acceso" className="relative mt-6 grid h-12 grid-cols-2 rounded-2xl bg-[#e6e9e1] p-1">
        <span
          aria-hidden="true"
          className="absolute top-1 left-1 h-10 w-[calc((100%-8px)/2)] rounded-xl bg-superficie shadow-[0_1px_3px_rgba(13,20,17,.12)] transition-transform duration-200 ease-in-out"
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
    </Pantalla>
  )
}

function FormEntrar({ alEntrar }: { alEntrar: (a: AuthResponse) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const login = useMutation({ mutationFn: api.auth.login, onSuccess: alEntrar })

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    login.mutate({ email: email.trim(), password })
  }

  return (
    <form onSubmit={enviar} className="mt-6 flex flex-1 flex-col gap-4" noValidate>
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
      <Campo
        etiqueta="Contraseña"
        type="password"
        autoComplete="current-password"
        enterKeyHint="go"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {login.error && <ErrorFormulario error={login.error} />}
      {import.meta.env.DEV && (
        <p className="rounded-control bg-[#eef1e8] p-3 text-[13px] text-texto-2">
          Desarrollo: <span className="num">pasajero@tripbus.co</span> · <span className="num">TripBus2026</span>
        </p>
      )}
      <div className="flex-1" />
      <Button type="submit" ancho="completo" disabled={login.isPending || !email || !password}>
        {login.isPending ? 'Entrando…' : 'Entrar'}
      </Button>
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
  const passwordValida = datos.password.length >= 8 && /[A-Z]/.test(datos.password) && /\d/.test(datos.password)
  const completo = datos.nombre.trim() && datos.documentoIdentidad.trim() && datos.email.trim() && passwordValida && acepta

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    if (!completo) return
    registro.mutate({ ...datos, nombre: datos.nombre.trim(), email: datos.email.trim(), aceptaPoliticaDatos: true })
  }

  return (
    <form onSubmit={enviar} className="mt-6 flex flex-1 flex-col gap-4" noValidate>
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
      <Campo
        etiqueta="Contraseña"
        type="password"
        autoComplete="new-password"
        enterKeyHint="done"
        value={datos.password}
        onChange={cambiar('password')}
        ayuda="Mínimo 8 caracteres, una mayúscula y un número."
        error={datos.password && !passwordValida ? 'Mínimo 8 caracteres, una mayúscula y un número.' : undefined}
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
      <Button type="submit" ancho="completo" disabled={registro.isPending || !completo}>
        {registro.isPending ? 'Creando cuenta…' : 'Crear cuenta'}
      </Button>
    </form>
  )
}

function ErrorFormulario({ error }: { error: Error }) {
  const texto = error instanceof ApiError ? error.paraUsuario : 'Algo salió mal. Intenta de nuevo.'
  return (
    <p role="alert" className="rounded-control bg-presencia p-3 text-[14px] font-medium text-alerta">
      {texto}
    </p>
  )
}
