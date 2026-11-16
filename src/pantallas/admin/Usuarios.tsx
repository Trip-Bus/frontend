import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { CargarMas, Resultado } from '@/components/marca/Consulta'
import { HojaMotivo } from '@/components/marca/HojaMotivo'
import { PantallaGestion } from '@/components/marca/PantallaGestion'
import { Button } from '@/components/ui/button'
import { Selector } from '@/components/ui/campos'
import { Hoja } from '@/components/ui/hoja'
import { Campo } from '@/components/ui/input'
import { useOpcionesEmpresas } from '@/features/opcionesGestion'
import { usePaginado } from '@/features/paginacion'
import { textoError } from '@/lib/api'
import { api } from '@/lib/endpoints'
import type { CrearUsuarioRequest, Rol, UsuarioAdmin } from '@/lib/tipos'
import { cn } from '@/lib/utils'

const NOMBRE_ROL: Record<Rol, string> = { PASAJERO: 'Pasajero', CONDUCTOR: 'Conductor', OPERADOR: 'Operador', ADMIN: 'Administrador' }
const OPCIONES_ROL = (Object.keys(NOMBRE_ROL) as Rol[]).map((r) => ({ valor: r, texto: NOMBRE_ROL[r] }))
const conEmpresa = (rol: string) => rol === 'OPERADOR' || rol === 'CONDUCTOR'

/**
 * A-02 Usuarios (US-102 a US-104): buscar por nombre, correo o documento y filtrar por rol, empresa y estado;
 * crear operadores y conductores (reciben un correo para definir su contraseña), cambiar el rol, suspender o
 * reactivar con motivo y desbloquear tras intentos fallidos.
 */
export function Usuarios() {
  const empresas = useOpcionesEmpresas()
  const [filtro, setFiltro] = useState({ q: '', rol: '', activo: '', companyId: '' })
  const [busqueda, setBusqueda] = useState('')
  const [creando, setCreando] = useState(false)
  const [elegido, setElegido] = useState<UsuarioAdmin | null>(null)
  const { consulta, elementos, total } = usePaginado<UsuarioAdmin>(['usuarios', filtro], (page) =>
    api.usuarios.listar({
      q: filtro.q || undefined,
      rol: (filtro.rol || undefined) as Rol | undefined,
      activo: filtro.activo === '' ? undefined : filtro.activo === 'true',
      companyId: filtro.companyId || undefined,
      page,
      size: 20,
    }),
  )
  const nombreEmpresa = (id: string | null) => empresas.opciones.find((e) => e.valor === id)?.texto

  return (
    <PantallaGestion
      titulo="Usuarios"
      descripcion="Cuentas de pasajeros, conductores, operadores y administradores."
      acciones={<Button onClick={() => setCreando(true)}>Crear operador o conductor</Button>}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setFiltro((f) => ({ ...f, q: busqueda.trim() }))
        }}
        className="grid grid-cols-2 items-end gap-3 md:grid-cols-5"
        noValidate
      >
        <div className="col-span-2">
          <Campo etiqueta="Buscar" type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Nombre, correo o documento" />
        </div>
        <Selector etiqueta="Rol" vacia="Todos" value={filtro.rol} onChange={(e) => setFiltro((f) => ({ ...f, rol: e.target.value }))} opciones={OPCIONES_ROL} />
        <Selector
          etiqueta="Estado"
          vacia="Todos"
          value={filtro.activo}
          onChange={(e) => setFiltro((f) => ({ ...f, activo: e.target.value }))}
          opciones={[
            { valor: 'true', texto: 'Activos' },
            { valor: 'false', texto: 'Suspendidos' },
          ]}
        />
        <Selector etiqueta="Empresa" vacia="Todas" value={filtro.companyId} onChange={(e) => setFiltro((f) => ({ ...f, companyId: e.target.value }))} opciones={empresas.opciones} />
      </form>

      <Resultado consulta={consulta} hayDatos={elementos.length > 0} vacio="No hay usuarios con esos filtros.">
        <ul className="grid gap-2 md:grid-cols-2">
          {elementos.map((u) => (
            <li key={u.id}>
              <button type="button" onClick={() => setElegido(u)} className="tap flex w-full items-center justify-between gap-3 rounded-tarjeta bg-superficie p-4 text-left">
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-semibold">{u.nombre}</span>
                  <span className="truncate text-[13px] text-texto-2">
                    {u.email}
                    {u.companyId ? ` · ${nombreEmpresa(u.companyId) ?? 'empresa'}` : ''}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="rounded-md bg-linea px-1.5 text-[12px] font-bold">{NOMBRE_ROL[u.rol]}</span>
                  {!u.activo && <span className="rounded-md bg-presencia px-1.5 text-[12px] font-bold text-alerta">Suspendida</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <CargarMas hay={!!consulta.hasNextPage} cargando={consulta.isFetchingNextPage} alCargar={() => consulta.fetchNextPage()} mostrados={elementos.length} total={total} />
      </Resultado>

      <CrearUsuario abierto={creando} alCerrar={() => setCreando(false)} empresas={empresas.opciones} />
      <AccionesUsuario usuario={elegido} alCerrar={() => setElegido(null)} empresas={empresas.opciones} />
    </PantallaGestion>
  )
}

function useRefrescarUsuarios() {
  const queryClient = useQueryClient()
  return () => void queryClient.invalidateQueries({ queryKey: ['usuarios'] })
}

function CrearUsuario({ abierto, alCerrar, empresas }: { abierto: boolean; alCerrar: () => void; empresas: { valor: string; texto: string }[] }) {
  const refrescar = useRefrescarUsuarios()
  const [datos, setDatos] = useState<CrearUsuarioRequest>({ nombre: '', email: '', documentoIdentidad: '', rol: 'OPERADOR', companyId: '' })
  const cambiar = (parcial: Partial<CrearUsuarioRequest>) => setDatos((d) => ({ ...d, ...parcial }))
  const crear = useMutation({
    mutationFn: () => api.usuarios.crear({ ...datos, nombre: datos.nombre.trim(), email: datos.email.trim() }),
    onSuccess: () => {
      toast('Creamos la cuenta. Le enviamos un correo para que defina su contraseña.')
      refrescar()
      setDatos({ nombre: '', email: '', documentoIdentidad: '', rol: 'OPERADOR', companyId: '' })
      alCerrar()
    },
    onError: (e) => toast(textoError(e)),
  })
  const listo = datos.nombre.trim().length >= 3 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email) && datos.documentoIdentidad.trim().length >= 4 && !!datos.companyId
  const enviar = (e: FormEvent) => {
    e.preventDefault()
    if (listo) crear.mutate()
  }
  return (
    <Hoja abierta={abierto} alCambiar={(a) => !a && alCerrar()} titulo="Crear operador o conductor" descripcion="La persona recibe un enlace para definir su contraseña.">
      <form onSubmit={enviar} className="flex flex-col gap-3 pb-3" noValidate>
        <Campo etiqueta="Nombre completo" value={datos.nombre} onChange={(e) => cambiar({ nombre: e.target.value })} />
        <Campo etiqueta="Correo" type="email" autoCapitalize="none" value={datos.email} onChange={(e) => cambiar({ email: e.target.value })} />
        <Campo etiqueta="Documento de identidad" inputMode="numeric" value={datos.documentoIdentidad} onChange={(e) => cambiar({ documentoIdentidad: e.target.value.replace(/\s/g, '') })} />
        <Selector
          etiqueta="Rol"
          value={datos.rol}
          onChange={(e) => cambiar({ rol: e.target.value as CrearUsuarioRequest['rol'] })}
          opciones={[
            { valor: 'OPERADOR', texto: 'Operador' },
            { valor: 'CONDUCTOR', texto: 'Conductor' },
          ]}
        />
        <Selector etiqueta="Empresa" vacia="Elige la empresa" value={datos.companyId} onChange={(e) => cambiar({ companyId: e.target.value })} opciones={empresas} />
        <Button type="submit" disabled={!listo || crear.isPending}>
          {crear.isPending ? 'Creando…' : 'Crear la cuenta'}
        </Button>
      </form>
    </Hoja>
  )
}

function AccionesUsuario({ usuario: u, alCerrar, empresas }: { usuario: UsuarioAdmin | null; alCerrar: () => void; empresas: { valor: string; texto: string }[] }) {
  const refrescar = useRefrescarUsuarios()
  const [rol, setRol] = useState<Rol | ''>('')
  const [companyId, setCompanyId] = useState('')
  const [cambiandoEstado, setCambiandoEstado] = useState(false)
  const listo = (texto: string) => {
    toast(texto)
    refrescar()
    setCambiandoEstado(false)
    alCerrar()
  }
  const rolNuevo = rol || u?.rol || 'PASAJERO'
  const empresaNueva = companyId || u?.companyId || ''
  const cambiarRol = useMutation({
    mutationFn: () => api.usuarios.cambiarRol(u!.id, { rol: rolNuevo, companyId: conEmpresa(rolNuevo) ? empresaNueva : null }),
    onSuccess: () => listo('Cambiamos el rol.'),
    onError: (e) => toast(textoError(e)),
  })
  const estado = useMutation({
    mutationFn: (motivo: string) => api.usuarios.cambiarEstado(u!.id, !u!.activo, motivo),
    onSuccess: () => listo(u?.activo ? 'Suspendimos la cuenta.' : 'Reactivamos la cuenta.'),
    onError: (e) => toast(textoError(e)),
  })
  const desbloquear = useMutation({ mutationFn: () => api.usuarios.desbloquear(u!.id), onSuccess: () => listo('Desbloqueamos la cuenta.'), onError: (e) => toast(textoError(e)) })

  return (
    <Hoja
      abierta={!!u}
      alCambiar={(a) => {
        if (!a) {
          setRol('')
          setCompanyId('')
          alCerrar()
        }
      }}
      titulo={u?.nombre ?? ''}
      descripcion={u?.email}
    >
      {u && (
        <div className="flex flex-col gap-4 pb-3">
          <section aria-label="Rol" className="flex flex-col gap-2">
            <Selector etiqueta="Rol" value={rolNuevo} onChange={(e) => setRol(e.target.value as Rol)} opciones={OPCIONES_ROL} />
            {conEmpresa(rolNuevo) && <Selector etiqueta="Empresa" vacia="Elige la empresa" value={empresaNueva} onChange={(e) => setCompanyId(e.target.value)} opciones={empresas} />}
            <Button
              variante="contorno"
              disabled={cambiarRol.isPending || (rolNuevo === u.rol && empresaNueva === (u.companyId ?? '')) || (conEmpresa(rolNuevo) && !empresaNueva)}
              onClick={() => cambiarRol.mutate()}
            >
              {cambiarRol.isPending ? 'Guardando…' : 'Guardar el rol'}
            </Button>
          </section>
          <div className="flex flex-col gap-2 border-t border-linea pt-3">
            <Button variante={u.activo ? 'contorno' : 'tinta'} className={cn(u.activo && 'text-alerta')} onClick={() => setCambiandoEstado(true)}>
              {u.activo ? 'Suspender la cuenta' : 'Reactivar la cuenta'}
            </Button>
            <Button variante="fantasma" disabled={desbloquear.isPending} onClick={() => desbloquear.mutate()}>
              {desbloquear.isPending ? 'Desbloqueando…' : 'Desbloquear (intentos fallidos)'}
            </Button>
          </div>
          <HojaMotivo
            abierta={cambiandoEstado}
            alCerrar={() => setCambiandoEstado(false)}
            titulo={u.activo ? '¿Suspender la cuenta?' : '¿Reactivar la cuenta?'}
            descripcion={u.activo ? 'La persona no podrá entrar y sus sesiones abiertas se cierran de inmediato.' : undefined}
            etiquetaMotivo="Motivo (queda en la auditoría)"
            boton={u.activo ? 'Suspender' : 'Reactivar'}
            ocupado={estado.isPending}
            alConfirmar={(motivo) => estado.mutate(motivo)}
          />
        </div>
      )}
    </Hoja>
  )
}
