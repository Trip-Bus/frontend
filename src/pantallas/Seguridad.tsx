import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Download, KeyRound, LogOut, ShieldCheck, Smartphone } from 'lucide-react'
import QRCode from 'qrcode'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Encabezado } from '@/components/marca/Encabezado'
import { Aviso, Esqueleto } from '@/components/marca/Estados'
import { Pantalla } from '@/components/marca/Pantalla'
import { Button } from '@/components/ui/button'
import { CampoContrasena, ErrorFormulario } from '@/components/ui/formulario'
import { Hoja } from '@/components/ui/hoja'
import { Campo } from '@/components/ui/input'
import { codigoTotpValido, normalizarCodigo, passwordValida, secretoLegible, textoCodigosRecuperacion } from '@/features/cuenta'
import { descargarTexto } from '@/features/descarga'
import { useAcento } from '@/hooks/useAcento'
import { ApiError, textoError } from '@/lib/api'
import { api } from '@/lib/endpoints'
import { sesion, useSesion } from '@/lib/sesion'
import type { ConfiguracionMfa } from '@/lib/tipos'

/**
 * Seguridad: cambiar la contraseña (US-129) y la verificación en dos pasos (US-106, solo ADMIN y OPERADOR).
 * Si el rol la exige y aún no está activa (MFA_REQUIRED_ROLES en identity), la API responde 403
 * MFA_SETUP_REQUIRED en todo menos /users/me/2fa/* y el cierre de sesión: la app trae aquí a la persona
 * (?obligatoria=1) y esta pantalla solo usa esas rutas.
 */
export function Seguridad() {
  useAcento(null)
  const s = useSesion()
  const [params] = useSearchParams()
  const puedeMfa = s?.rol === 'ADMIN' || s?.rol === 'OPERADOR'

  // verificacionDosPasos sale de "mis datos"; si la API responde MFA_SETUP_REQUIRED, es que no está activa.
  const estado = useQuery({ queryKey: ['mis-datos'], queryFn: api.cuenta.misDatos, enabled: !!s && puedeMfa })
  const obligatoria =
    params.get('obligatoria') === '1' || (estado.error instanceof ApiError && estado.error.code === 'MFA_SETUP_REQUIRED')
  const activa = estado.data?.verificacionDosPasos === true

  if (!s) return null

  return (
    <Pantalla>
      <Encabezado titulo="Seguridad" volverA="/cuenta" sinVolver={obligatoria && !activa} />

      <div className="flex flex-col gap-4 px-5 pt-5 pb-4">
        {obligatoria && !activa && (
          <Aviso tono="alerta">
            Tu rol exige la verificación en dos pasos. Actívala para seguir usando TripBus; mientras tanto solo puedes hacer
            esto o cerrar sesión.
          </Aviso>
        )}

        {puedeMfa &&
          (estado.isPending && !obligatoria ? (
            <Esqueleto className="px-0 pt-0" bloques={[180]} />
          ) : estado.isError && !obligatoria ? (
            <Aviso tono="alerta">{textoError(estado.error, 'No pudimos saber si tienes la verificación activa.')}</Aviso>
          ) : (
            <DosPasos activa={activa} />
          ))}

        {!obligatoria && <CambiarContrasena />}

        {obligatoria && !activa && <SalirBoton />}
      </div>
    </Pantalla>
  )
}

/* ------------------------------------------------------------- contraseña (US-129) */

function CambiarContrasena() {
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const cambiar = useMutation({
    mutationFn: api.cuenta.cambiarPassword,
    onSuccess: (auth) => {
      // Identity invalida los tokens anteriores y entrega uno nuevo: la sesión sigue abierta aquí.
      sesion.iniciar(auth)
      setActual('')
      setNueva('')
      toast('Cambiamos tu contraseña. Cerramos las sesiones de otros equipos.')
    },
  })
  const valida = passwordValida(nueva)
  const listo = actual.length > 0 && valida && nueva !== actual

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    if (listo) cambiar.mutate({ passwordActual: actual, passwordNueva: nueva })
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-4 rounded-tarjeta bg-superficie p-5">
      <h2 className="flex items-center gap-2 text-[17px] font-semibold">
        <KeyRound className="size-5" aria-hidden="true" />
        Cambiar contraseña
      </h2>
      <CampoContrasena etiqueta="Contraseña actual" autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} />
      <CampoContrasena
        etiqueta="Contraseña nueva"
        autoComplete="new-password"
        value={nueva}
        onChange={(e) => setNueva(e.target.value)}
        ayuda="Mínimo 8 caracteres, una mayúscula y un número."
        error={nueva && !valida ? 'Mínimo 8 caracteres, una mayúscula y un número.' : nueva && nueva === actual ? 'Debe ser distinta de la actual.' : undefined}
      />
      {cambiar.error && <ErrorFormulario error={cambiar.error} />}
      <Button type="submit" ancho="completo" disabled={cambiar.isPending || !listo}>
        {cambiar.isPending ? 'Guardando…' : 'Cambiar contraseña'}
      </Button>
    </form>
  )
}

/* ------------------------------------------------------------- verificación en dos pasos (US-106) */

type Paso = { tipo: 'inicio' } | { tipo: 'escanear'; config: ConfiguracionMfa } | { tipo: 'codigos'; codigos: string[] }

function DosPasos({ activa }: { activa: boolean }) {
  const queryClient = useQueryClient()
  const [paso, setPaso] = useState<Paso>({ tipo: 'inicio' })
  const [desactivar, setDesactivar] = useState(false)
  const configurar = useMutation({
    mutationFn: api.cuenta.configurarMfa,
    onSuccess: (config) => setPaso({ tipo: 'escanear', config }),
    onError: (e) => {
      // Ya estaba activa (p. ej. desde otro equipo): se refresca el estado.
      if (e instanceof ApiError && e.code === 'MFA_ALREADY_ENABLED') queryClient.invalidateQueries({ queryKey: ['mis-datos'] })
    },
  })

  if (paso.tipo === 'escanear') {
    return <Escanear config={paso.config} alActivar={(codigos) => setPaso({ tipo: 'codigos', codigos })} cancelar={() => setPaso({ tipo: 'inicio' })} />
  }
  if (paso.tipo === 'codigos') {
    return (
      <CodigosRecuperacion
        codigos={paso.codigos}
        listo={() => {
          setPaso({ tipo: 'inicio' })
          queryClient.invalidateQueries({ queryKey: ['mis-datos'] })
          // Con la 2FA activa la API vuelve a responder: se recargan los datos que hubieran fallado.
          queryClient.invalidateQueries()
        }}
      />
    )
  }

  return (
    <section aria-labelledby="dos-pasos" className="flex flex-col gap-3 rounded-tarjeta bg-superficie p-5">
      <h2 id="dos-pasos" className="flex items-center gap-2 text-[17px] font-semibold">
        <ShieldCheck className="size-5" aria-hidden="true" />
        Verificación en dos pasos
        <span className={activa ? 'ml-auto rounded-full bg-acento px-2.5 py-0.5 text-[12px] font-semibold text-tinta' : 'ml-auto rounded-full bg-[#eef1e8] px-2.5 py-0.5 text-[12px] font-semibold text-texto-2'}>
          {activa ? 'Activa' : 'Inactiva'}
        </span>
      </h2>
      <p className="text-[14px] leading-snug text-texto-2">
        {activa
          ? 'Al entrar te pedimos el código de 6 dígitos de tu app de autenticación, además de la contraseña.'
          : 'Además de la contraseña, al entrar te pediremos un código de 6 dígitos de una app como Google Authenticator, Microsoft Authenticator o Authy.'}
      </p>
      {configurar.error && <ErrorFormulario error={configurar.error} />}
      {activa ? (
        <Button variante="contorno" ancho="completo" onClick={() => setDesactivar(true)}>
          Desactivar
        </Button>
      ) : (
        <Button variante="acento" ancho="completo" disabled={configurar.isPending} onClick={() => configurar.mutate()}>
          <Smartphone className="size-5" aria-hidden="true" />
          {configurar.isPending ? 'Preparando…' : 'Activar'}
        </Button>
      )}
      <HojaDesactivar abierta={desactivar} alCambiar={setDesactivar} />
    </section>
  )
}

/** Paso 1 y 2: escanear el QR (o escribir el secreto) y confirmar con el primer código. */
function Escanear({
  config,
  alActivar,
  cancelar,
}: {
  config: ConfiguracionMfa
  alActivar: (codigos: string[]) => void
  cancelar: () => void
}) {
  const [qr, setQr] = useState<string | null>(null)
  const [codigo, setCodigo] = useState('')
  const activar = useMutation({ mutationFn: api.cuenta.activarMfa, onSuccess: (r) => alActivar(r.recoveryCodes) })

  useEffect(() => {
    let vigente = true
    QRCode.toDataURL(config.otpauthUri, { margin: 1, width: 240, errorCorrectionLevel: 'M' })
      .then((url) => vigente && setQr(url))
      .catch(() => vigente && setQr(null))
    return () => {
      vigente = false
    }
  }, [config.otpauthUri])

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(config.secret)
      toast('Copiamos la clave.')
    } catch {
      toast('No pudimos copiar en este navegador. Escríbela a mano.')
    }
  }

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    if (codigoTotpValido(codigo)) activar.mutate(normalizarCodigo(codigo))
  }

  return (
    <section aria-labelledby="escanear" className="entra flex flex-col gap-4 rounded-tarjeta bg-superficie p-5">
      <h2 id="escanear" className="text-[17px] font-semibold">
        1. Escanea el código con tu app
      </h2>
      <div className="mx-auto flex size-[248px] items-center justify-center rounded-[18px] border-[1.5px] border-linea bg-white p-1">
        {qr ? <img src={qr} alt="Código QR para tu app de autenticación" className="size-60" /> : <div aria-busy="true" className="size-60 rounded-xl bg-fondo" />}
      </div>
      <a href={config.otpauthUri} className="tap self-center rounded-lg py-1 text-[14px] font-semibold underline underline-offset-4">
        Estoy en el celular: abrir en la app
      </a>
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold">¿No puedes escanear? Escribe esta clave</span>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 rounded-control bg-fondo px-3.5 py-3 font-mono text-[15px] break-all">{secretoLegible(config.secret)}</code>
          <Button variante="contorno" tamano="icono" aria-label="Copiar clave" onClick={copiar}>
            <Copy className="size-5" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
        <h2 className="text-[17px] font-semibold">2. Escribe el código que muestra la app</h2>
        <Campo
          etiqueta="Código de 6 dígitos"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          placeholder="123456"
          className="font-mono text-[20px] tracking-[0.3em]"
        />
        {activar.error && <ErrorFormulario error={activar.error} />}
        <Button type="submit" variante="acento" ancho="completo" disabled={activar.isPending || !codigoTotpValido(codigo)}>
          {activar.isPending ? 'Activando…' : 'Activar verificación'}
        </Button>
        <Button type="button" variante="fantasma" ancho="completo" onClick={cancelar}>
          Cancelar
        </Button>
      </form>
    </section>
  )
}

/** Paso 3: los 10 códigos de recuperación (Identity solo los muestra esta vez). */
function CodigosRecuperacion({ codigos, listo }: { codigos: string[]; listo: () => void }) {
  const texto = textoCodigosRecuperacion(codigos)
  const [guardados, setGuardados] = useState(false)

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto)
      setGuardados(true)
      toast('Copiamos los códigos.')
    } catch {
      toast('No pudimos copiar en este navegador. Descárgalos.')
    }
  }

  return (
    <section aria-labelledby="codigos" className="entra flex flex-col gap-4 rounded-tarjeta bg-superficie p-5">
      <h2 id="codigos" className="flex items-center gap-2 text-[17px] font-semibold">
        <ShieldCheck className="size-5" aria-hidden="true" />
        Verificación activada
      </h2>
      <p className="text-[14px] leading-snug">
        Guarda estos códigos en un lugar seguro. Si pierdes el teléfono, cada uno te deja entrar <strong>una vez</strong>. No
        los volveremos a mostrar.
      </p>
      <ul aria-label="Códigos de recuperación" className="grid grid-cols-2 gap-2 rounded-control bg-fondo p-3 font-mono text-[15px]">
        {codigos.map((c) => (
          <li key={c} className="text-center">
            {c}
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-2 gap-2.5">
        <Button variante="contorno" tamano="md" onClick={copiar}>
          <Copy className="size-5" aria-hidden="true" />
          Copiar
        </Button>
        <Button
          variante="contorno"
          tamano="md"
          onClick={() => {
            descargarTexto(texto, 'tripbus-codigos-de-recuperacion.txt')
            setGuardados(true)
          }}
        >
          <Download className="size-5" aria-hidden="true" />
          Descargar
        </Button>
      </div>
      <label className="flex items-start gap-3 text-[14px] leading-snug">
        <input type="checkbox" checked={guardados} onChange={(e) => setGuardados(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-tinta" />
        <span>Ya guardé mis códigos de recuperación.</span>
      </label>
      <Button ancho="completo" disabled={!guardados} onClick={listo}>
        Listo
      </Button>
    </section>
  )
}

/** Desactivar: contraseña y un código vigente de la app. */
function HojaDesactivar({ abierta, alCambiar }: { abierta: boolean; alCambiar: (v: boolean) => void }) {
  const queryClient = useQueryClient()
  const [password, setPassword] = useState('')
  const [codigo, setCodigo] = useState('')
  const quitar = useMutation({
    mutationFn: () => api.cuenta.desactivarMfa(password, normalizarCodigo(codigo)),
    onSuccess: () => {
      toast('Desactivamos la verificación en dos pasos.')
      queryClient.invalidateQueries({ queryKey: ['mis-datos'] })
      cerrar(false)
    },
  })
  const cerrar = (v: boolean) => {
    alCambiar(v)
    if (!v) {
      setPassword('')
      setCodigo('')
      quitar.reset()
    }
  }
  const listo = password.length > 0 && codigoTotpValido(codigo)

  return (
    <Hoja
      abierta={abierta}
      alCambiar={cerrar}
      titulo="¿Desactivar la verificación?"
      descripcion="Tu cuenta quedará protegida solo con la contraseña. Si tu rol la exige, tendrás que activarla de nuevo para seguir."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (listo) quitar.mutate()
        }}
        noValidate
        className="flex flex-col gap-4 pb-2"
      >
        <CampoContrasena etiqueta="Tu contraseña" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Campo
          etiqueta="Código de la app"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          placeholder="123456"
          className="font-mono tracking-[0.3em]"
        />
        {quitar.error && <ErrorFormulario error={quitar.error} />}
        <Button type="submit" ancho="completo" disabled={quitar.isPending || !listo}>
          {quitar.isPending ? 'Desactivando…' : 'Desactivar'}
        </Button>
        <Button type="button" variante="contorno" ancho="completo" onClick={() => cerrar(false)}>
          Cancelar
        </Button>
      </form>
    </Hoja>
  )
}

/** Con la 2FA obligatoria pendiente, la única otra salida es cerrar sesión (identity lo permite). */
function SalirBoton() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const salir = useMutation({
    mutationFn: api.auth.logout,
    onSettled: () => {
      sesion.cerrar()
      queryClient.clear()
      navigate('/', { replace: true })
    },
  })
  return (
    <Button variante="contorno" ancho="completo" disabled={salir.isPending} onClick={() => salir.mutate()}>
      <LogOut className="size-5" aria-hidden="true" />
      {salir.isPending ? 'Cerrando sesión…' : 'Cerrar sesión'}
    </Button>
  )
}
