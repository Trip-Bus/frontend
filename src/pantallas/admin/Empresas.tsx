import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { CargarMas, Resultado } from '@/components/marca/Consulta'
import { PantallaGestion } from '@/components/marca/PantallaGestion'
import { Button } from '@/components/ui/button'
import { Segmentos, Selector } from '@/components/ui/campos'
import { Hoja } from '@/components/ui/hoja'
import { Campo } from '@/components/ui/input'
import { hoy } from '@/features/busqueda'
import { usePaginado } from '@/features/paginacion'
import { useAccion } from '@/hooks/useAccion'
import { api } from '@/lib/endpoints'
import { dinero, fechaCorta, fechaDesdeApi } from '@/lib/formato'
import type { Empresa } from '@/lib/tipos'

const NIT = /^\d{9,10}(-\d)?$/

/** A-01 Empresas (US-100): crear, editar, activar o inactivar y las condiciones comerciales con su vigencia. */
export function Empresas() {
  const [estado, setEstado] = useState('')
  const [elegida, setElegida] = useState<Empresa | 'nueva' | null>(null)
  const { consulta, elementos, total } = usePaginado<Empresa>(['empresas', estado], (page) => api.empresas.listar({ estado: estado || undefined, page, size: 20 }))
  return (
    <PantallaGestion titulo="Empresas" descripcion="Transportadoras de la plataforma." acciones={<Button onClick={() => setElegida('nueva')}>Crear empresa</Button>}>
      <div className="max-w-xs">
        <Selector etiqueta="Estado" vacia="Todas" value={estado} onChange={(e) => setEstado(e.target.value)} opciones={[{ valor: 'ACTIVA', texto: 'Activas' }, { valor: 'INACTIVA', texto: 'Inactivas' }]} />
      </div>
      <Resultado consulta={consulta} hayDatos={elementos.length > 0} vacio="Aún no hay empresas.">
        <ul className="grid gap-2 md:grid-cols-2">
          {elementos.map((e) => (
            <li key={e.id}>
              <button type="button" onClick={() => setElegida(e)} className="tap flex w-full items-center justify-between gap-3 rounded-tarjeta bg-superficie p-4 text-left">
                <span className="flex flex-col">
                  <span className="font-semibold">{e.nombre}</span>
                  <span className="num text-[13px] text-texto-2">NIT {e.nit}</span>
                </span>
                <span className="rounded-md bg-linea px-1.5 text-[12px] font-bold">{e.estado === 'ACTIVA' ? 'Activa' : 'Inactiva'}</span>
              </button>
            </li>
          ))}
        </ul>
        <CargarMas hay={!!consulta.hasNextPage} cargando={consulta.isFetchingNextPage} alCargar={() => consulta.fetchNextPage()} mostrados={elementos.length} total={total} />
      </Resultado>
      {elegida && <HojaEmpresa empresa={elegida === 'nueva' ? null : elegida} alCerrar={() => setElegida(null)} />}
    </PantallaGestion>
  )
}

function HojaEmpresa({ empresa, alCerrar }: { empresa: Empresa | null; alCerrar: () => void }) {
  const [vista, setVista] = useState<'datos' | 'condiciones'>('datos')
  return (
    <Hoja abierta alCambiar={(a) => !a && alCerrar()} titulo={empresa?.nombre ?? 'Crear empresa'}>
      <div className="flex flex-col gap-3 pb-3">
        {empresa && <Segmentos etiqueta="Sección" rol="tablist" valor={vista} alCambiar={setVista} opciones={[{ valor: 'datos', texto: 'Datos' }, { valor: 'condiciones', texto: 'Condiciones' }]} />}
        {vista === 'datos' || !empresa ? <FormEmpresa empresa={empresa} alTerminar={alCerrar} /> : <Condiciones empresa={empresa} />}
      </div>
    </Hoja>
  )
}

function FormEmpresa({ empresa, alTerminar }: { empresa: Empresa | null; alTerminar: () => void }) {
  const [nombre, setNombre] = useState(empresa?.nombre ?? '')
  const [nit, setNit] = useState(empresa?.nit ?? '')
  const datos = { nombre: nombre.trim(), nit: nit.trim() }
  const guardar = useAccion(() => (empresa ? api.empresas.editar(empresa.id, datos) : api.empresas.crear(datos)), { exito: empresa ? 'Guardamos la empresa.' : 'Creamos la empresa.', invalidar: [['empresas']], alTerminar })
  const estado = useAccion(() => api.empresas.cambiarEstado(empresa!.id, empresa!.estado === 'ACTIVA' ? 'INACTIVA' : 'ACTIVA'), { exito: 'Cambiamos el estado de la empresa.', invalidar: [['empresas']], alTerminar })
  const valido = nombre.trim().length >= 2 && NIT.test(nit.trim())
  return (
    <>
      <Campo etiqueta="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
      <Campo etiqueta="NIT" inputMode="numeric" value={nit} onChange={(e) => setNit(e.target.value.replace(/[^\d-]/g, ''))} error={nit && !NIT.test(nit) ? '9 o 10 dígitos, con dígito de verificación opcional (900123456-7).' : undefined} />
      <Button disabled={!valido || guardar.isPending} onClick={() => guardar.mutate(undefined)}>
        {guardar.isPending ? 'Guardando…' : empresa ? 'Guardar' : 'Crear empresa'}
      </Button>
      {empresa && (
        <Button variante="fantasma" disabled={estado.isPending} onClick={() => estado.mutate(undefined)}>
          {empresa.estado === 'ACTIVA' ? 'Inactivar (sus viajes dejan de venderse)' : 'Reactivar la empresa'}
        </Button>
      )}
    </>
  )
}

function Condiciones({ empresa }: { empresa: Empresa }) {
  const historial = useQuery({ queryKey: ['condiciones', empresa.id], queryFn: () => api.empresas.condiciones(empresa.id) })
  const [cuota, setCuota] = useState('')
  const [comision, setComision] = useState('')
  const [desde, setDesde] = useState(hoy())
  const agregar = useAccion(() => api.empresas.agregarCondiciones(empresa.id, { cuotaMensual: Number(cuota), comisionPorcentaje: Number(comision), vigenteDesde: desde }), {
    exito: 'Agregamos la nueva vigencia.',
    invalidar: [['condiciones', empresa.id]],
  })
  const valido = cuota !== '' && Number(comision) >= 0 && Number(comision) <= 30 && comision !== '' && desde >= hoy()
  return (
    <>
      <Resultado consulta={historial} hayDatos={(historial.data?.length ?? 0) > 0} vacio="Aún no tiene condiciones comerciales.">
        <ol className="flex flex-col gap-2 text-[14px]">
          {(historial.data ?? []).map((c) => (
            <li key={c.id} className="rounded-[14px] bg-fondo p-3">
              Desde {fechaCorta(fechaDesdeApi(c.vigenteDesde))}: cuota {dinero(c.cuotaMensual)} al mes · comisión {c.comisionPorcentaje.toLocaleString('es-CO')} %
            </li>
          ))}
        </ol>
      </Resultado>
      <h3 className="text-[15px] font-semibold">Nueva vigencia</h3>
      <div className="grid grid-cols-3 gap-2">
        <Campo etiqueta="Cuota mensual" inputMode="numeric" value={cuota} onChange={(e) => setCuota(e.target.value.replace(/\D/g, ''))} />
        <Campo etiqueta="Comisión (%)" inputMode="decimal" value={comision} onChange={(e) => setComision(e.target.value.replace(/[^\d.]/g, ''))} />
        <Campo etiqueta="Vigente desde" type="date" min={hoy()} value={desde} onChange={(e) => setDesde(e.target.value)} />
      </div>
      <p className="text-[13px] text-texto-2">Las vigencias no se editan: se agrega una nueva desde hoy o una fecha futura. La comisión va de 0 a 30 %.</p>
      <Button disabled={!valido || agregar.isPending} onClick={() => agregar.mutate(undefined)}>
        {agregar.isPending ? 'Guardando…' : 'Agregar vigencia'}
      </Button>
    </>
  )
}
