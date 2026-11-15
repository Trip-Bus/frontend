import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Encabezado } from '@/components/marca/Encabezado'
import { Aviso, Esqueleto } from '@/components/marca/Estados'
import { Pantalla } from '@/components/marca/Pantalla'
import { Button } from '@/components/ui/button'
import { CampoContrasena, ErrorFormulario } from '@/components/ui/formulario'
import { Hoja } from '@/components/ui/hoja'
import { Campo } from '@/components/ui/input'
import { confirmaEliminar, nombreArchivoMisDatos, telefonoParaApi, telefonoValido } from '@/features/cuenta'
import { descargarJson } from '@/features/descarga'
import { useAcento } from '@/hooks/useAcento'
import { textoError } from '@/lib/api'
import { api } from '@/lib/endpoints'
import { sesion, useSesion } from '@/lib/sesion'

/**
 * Tus datos: editar nombre y teléfono (US-128), descargar todo lo que TripBus guarda de ti y eliminar tu
 * cuenta (US-131, Ley 1581 de 2012).
 */
export function CuentaDatos() {
  useAcento(null)
  const s = useSesion()
  const queryClient = useQueryClient()
  const perfil = useQuery({ queryKey: ['perfil', s?.userId], queryFn: api.cuenta.perfil, enabled: !!s, staleTime: 5 * 60_000 })
  const [eliminar, setEliminar] = useState(false)

  const descargar = useMutation({
    mutationFn: api.cuenta.misDatos,
    onSuccess: (datos) => {
      descargarJson(datos, nombreArchivoMisDatos())
      toast('Descargamos tus datos en un archivo JSON.')
    },
    onError: (e) => toast(textoError(e)),
  })

  return (
    <Pantalla>
      <Encabezado titulo="Tus datos" volverA="/cuenta" />

      <div className="flex flex-col gap-4 px-5 pt-5">
        {perfil.isPending ? (
          <Esqueleto className="px-0 pt-0" bloques={[260]} />
        ) : perfil.isError ? (
          <Aviso tono="alerta">{textoError(perfil.error, 'No pudimos cargar tus datos.')}</Aviso>
        ) : (
          // Al guardar llega el perfil nuevo: la key reinicia el formulario con esos valores.
          <FormPerfil
            key={`${perfil.data.nombre}|${perfil.data.telefono ?? ''}`}
            nombreInicial={perfil.data.nombre}
            telefonoInicial={perfil.data.telefono ?? ''}
            email={perfil.data.email}
            documento={perfil.data.documentoIdentidad}
            alGuardar={() => queryClient.invalidateQueries({ queryKey: ['perfil'] })}
          />
        )}

        <section aria-labelledby="ley1581" className="flex flex-col gap-3 rounded-tarjeta bg-superficie p-5">
          <h2 id="ley1581" className="text-[17px] font-semibold">Tus datos personales</h2>
          <p className="text-[14px] leading-snug text-texto-2">
            Por la Ley 1581 de 2012 puedes descargar lo que guardamos de ti (perfil, consentimientos y sesiones abiertas) o
            eliminar tu cuenta.
          </p>
          <Button variante="contorno" ancho="completo" disabled={descargar.isPending} onClick={() => descargar.mutate()}>
            <Download className="size-5" aria-hidden="true" />
            {descargar.isPending ? 'Preparando archivo…' : 'Descargar mis datos'}
          </Button>
          <Button variante="fantasma" ancho="completo" className="text-alerta" onClick={() => setEliminar(true)}>
            <Trash2 className="size-5" aria-hidden="true" />
            Eliminar mi cuenta
          </Button>
        </section>
      </div>

      <HojaEliminar abierta={eliminar} alCambiar={setEliminar} />
    </Pantalla>
  )
}

function FormPerfil({
  nombreInicial,
  telefonoInicial,
  email,
  documento,
  alGuardar,
}: {
  nombreInicial: string
  telefonoInicial: string
  email: string
  documento: string | null
  alGuardar: () => void
}) {
  const [nombre, setNombre] = useState(nombreInicial)
  const [telefono, setTelefono] = useState(telefonoInicial)

  const guardar = useMutation({
    mutationFn: api.cuenta.editar,
    onSuccess: () => {
      toast('Guardamos tus cambios.')
      alGuardar()
    },
  })
  const telOk = telefonoValido(telefono)
  const cambio = nombre.trim() !== nombreInicial || (telefonoParaApi(telefono) ?? '') !== telefonoInicial
  const listo = nombre.trim().length > 0 && telOk && cambio

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    if (listo) guardar.mutate({ nombre: nombre.trim(), telefono: telefonoParaApi(telefono) })
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-4 rounded-tarjeta bg-superficie p-5">
      <Campo etiqueta="Nombre completo" autoComplete="name" value={nombre} onChange={(e) => setNombre(e.target.value)} />
      <Campo
        etiqueta="Celular"
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        value={telefono}
        onChange={(e) => setTelefono(e.target.value)}
        placeholder="3001234567"
        ayuda="Opcional. Para avisarte si cambia tu viaje."
        error={!telOk ? 'Escribe un celular de 10 dígitos que empiece por 3.' : undefined}
      />
      <dl className="grid gap-3 text-[14px]">
        <div>
          <dt className="font-semibold">Correo</dt>
          <dd className="break-all text-texto-2">{email}</dd>
        </div>
        <div>
          <dt className="font-semibold">Documento</dt>
          <dd className="text-texto-2">{documento ?? '—'}</dd>
        </div>
      </dl>
      <p className="text-[13px] text-texto-2">El correo y el documento no se pueden cambiar desde la app.</p>
      {guardar.error && <ErrorFormulario error={guardar.error} />}
      <Button type="submit" ancho="completo" disabled={guardar.isPending || !listo}>
        {guardar.isPending ? 'Guardando…' : 'Guardar cambios'}
      </Button>
    </form>
  )
}

/** Eliminar la cuenta: contraseña + escribir ELIMINAR. Identity anonimiza los datos y cierra todas las sesiones. */
function HojaEliminar({ abierta, alCambiar }: { abierta: boolean; alCambiar: (v: boolean) => void }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [password, setPassword] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const borrar = useMutation({
    mutationFn: () => api.cuenta.eliminar(password),
    onSuccess: () => {
      sesion.cerrar()
      queryClient.clear()
      toast('Eliminamos tu cuenta. Gracias por viajar con TripBus.')
      navigate('/', { replace: true })
    },
  })
  const listo = password.length > 0 && confirmaEliminar(confirmacion)

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    if (listo) borrar.mutate()
  }

  return (
    <Hoja
      abierta={abierta}
      alCambiar={(v) => {
        alCambiar(v)
        if (!v) {
          setPassword('')
          setConfirmacion('')
          borrar.reset()
        }
      }}
      titulo="¿Eliminar tu cuenta?"
      descripcion="No se puede deshacer. Borramos tu nombre, correo, documento y teléfono, cerramos todas tus sesiones y retiramos tu consentimiento. Las compras quedan sin tus datos personales."
    >
      <form onSubmit={enviar} noValidate className="flex flex-col gap-4 pb-2">
        <CampoContrasena
          etiqueta="Tu contraseña"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Campo
          etiqueta={
            <>
              Escribe <span className="font-mono">ELIMINAR</span> para confirmar
            </>
          }
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value={confirmacion}
          onChange={(e) => setConfirmacion(e.target.value)}
        />
        {borrar.error && <ErrorFormulario error={borrar.error} />}
        <Button type="submit" ancho="completo" className="bg-alerta hover:bg-alerta" disabled={borrar.isPending || !listo}>
          {borrar.isPending ? 'Eliminando…' : 'Eliminar mi cuenta'}
        </Button>
        <Button type="button" variante="contorno" ancho="completo" onClick={() => alCambiar(false)}>
          Cancelar
        </Button>
      </form>
    </Hoja>
  )
}
