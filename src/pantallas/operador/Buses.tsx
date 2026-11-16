import { useState, type FormEvent } from 'react'
import { CargarMas, Resultado } from '@/components/marca/Consulta'
import { IconosServicios } from '@/components/marca/IconosServicios'
import { PantallaGestion } from '@/components/marca/PantallaGestion'
import { Button } from '@/components/ui/button'
import { Casilla, Segmentos, Selector } from '@/components/ui/campos'
import { Hoja } from '@/components/ui/hoja'
import { Campo } from '@/components/ui/input'
import { useEmpresaActiva } from '@/features/empresa'
import { usePaginado } from '@/features/paginacion'
import { useAccion } from '@/hooks/useAccion'
import { api } from '@/lib/endpoints'
import type { Bus, BusRequest, EstadoBus, TipoBus } from '@/lib/tipos'
import { EditorMapa } from './EditorMapa'

const ESTADOS: { valor: EstadoBus; texto: string }[] = [
  { valor: 'ACTIVO', texto: 'Activo' },
  { valor: 'MANTENIMIENTO', texto: 'En mantenimiento' },
  { valor: 'INACTIVO', texto: 'Inactivo' },
]
const SERVICIOS = [
  { valor: 'WIFI', texto: 'Wi-Fi' },
  { valor: 'BANO', texto: 'Baño' },
  { valor: 'USB', texto: 'Carga USB' },
  { valor: 'AIRE_ACONDICIONADO', texto: 'Aire acondicionado' },
  { valor: 'TV', texto: 'Televisión' },
  { valor: 'SILLA_RECLINABLE', texto: 'Silla reclinable' },
]
const PLACA = /^[A-Z]{3}\d{3}$/

/** O-02 Buses (US-110/111): flota de la empresa, sus datos, estado, servicios y el mapa de asientos. */
export function Buses() {
  const { companyId, esAdmin } = useEmpresaActiva()
  const [estado, setEstado] = useState('')
  const [editando, setEditando] = useState<Bus | 'nuevo' | null>(null)
  const { consulta, elementos, total } = usePaginado<Bus>(['buses', companyId ?? null, estado], (page) =>
    api.buses.listar({ companyId, estado: (estado || undefined) as EstadoBus | undefined, page, size: 20 }),
  )
  return (
    <PantallaGestion titulo="Buses" descripcion="La flota de la empresa y el mapa de cada bus." requiereEmpresa acciones={<Button onClick={() => setEditando('nuevo')}>Agregar bus</Button>}>
      <div className="max-w-xs">
        <Selector etiqueta="Estado" vacia="Todos" value={estado} onChange={(e) => setEstado(e.target.value)} opciones={ESTADOS} />
      </div>
      <Resultado consulta={consulta} hayDatos={elementos.length > 0} vacio="Aún no hay buses. Agrega el primero.">
        <ul className="grid gap-2 md:grid-cols-2">
          {elementos.map((b) => (
            <li key={b.id}>
              <button type="button" onClick={() => setEditando(b)} className="tap flex w-full items-center justify-between gap-3 rounded-tarjeta bg-superficie p-4 text-left">
                <span className="flex flex-col gap-1">
                  <span className="num text-[18px] font-bold">{b.placa}</span>
                  <span className="text-[13px] text-texto-2">{b.tipo === 'DOS_PISOS' ? 'Dos pisos' : 'Un piso'}</span>
                  <IconosServicios servicios={b.servicios} />
                </span>
                <span className="rounded-md bg-linea px-1.5 text-[12px] font-bold">{ESTADOS.find((e) => e.valor === b.estado)?.texto ?? b.estado}</span>
              </button>
            </li>
          ))}
        </ul>
        <CargarMas hay={!!consulta.hasNextPage} cargando={consulta.isFetchingNextPage} alCargar={() => consulta.fetchNextPage()} mostrados={elementos.length} total={total} />
      </Resultado>
      {editando && <HojaBus bus={editando === 'nuevo' ? null : editando} companyId={esAdmin ? companyId : undefined} alCerrar={() => setEditando(null)} />}
    </PantallaGestion>
  )
}

function HojaBus({ bus, companyId, alCerrar }: { bus: Bus | null; companyId: string | undefined; alCerrar: () => void }) {
  const [vista, setVista] = useState<'datos' | 'mapa'>('datos')
  return (
    <Hoja abierta alCambiar={(a) => !a && alCerrar()} titulo={bus ? `Bus ${bus.placa}` : 'Agregar bus'}>
      <div className="flex flex-col gap-3 pb-3">
        {bus && (
          <Segmentos
            etiqueta="Sección"
            rol="tablist"
            valor={vista}
            alCambiar={setVista}
            opciones={[
              { valor: 'datos', texto: 'Datos' },
              { valor: 'mapa', texto: 'Mapa de asientos' },
            ]}
          />
        )}
        {vista === 'datos' || !bus ? <FormBus bus={bus} companyId={companyId} alTerminar={alCerrar} /> : <EditorMapa bus={bus} alTerminar={alCerrar} />}
      </div>
    </Hoja>
  )
}

function FormBus({ bus, companyId, alTerminar }: { bus: Bus | null; companyId: string | undefined; alTerminar: () => void }) {
  const [placa, setPlaca] = useState(bus?.placa ?? '')
  const [tipo, setTipo] = useState<TipoBus>(bus?.tipo ?? 'UN_PISO')
  const [servicios, setServicios] = useState<string[]>(bus?.servicios ?? [])
  const datos: BusRequest = { placa, tipo, servicios, ...(bus ? {} : { companyId }) }
  const guardar = useAccion(() => (bus ? api.buses.editar(bus.id, datos) : api.buses.crear(datos)), { exito: bus ? 'Guardamos el bus.' : 'Agregamos el bus.', invalidar: [['buses']], alTerminar })
  const estado = useAccion((e: EstadoBus) => api.buses.cambiarEstado(bus!.id, e), { exito: 'Cambiamos el estado del bus.', invalidar: [['buses']], alTerminar })
  const valido = PLACA.test(placa)
  const enviar = (e: FormEvent) => {
    e.preventDefault()
    if (valido) guardar.mutate(undefined)
  }
  return (
    <form onSubmit={enviar} className="flex flex-col gap-3" noValidate>
      <Campo
        etiqueta="Placa"
        value={placa}
        maxLength={6}
        autoCapitalize="characters"
        onChange={(e) => setPlaca(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
        error={placa && !valido ? 'Tres letras y tres números, como ABC123.' : undefined}
        className="num"
      />
      <Selector etiqueta="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoBus)} opciones={[{ valor: 'UN_PISO', texto: 'Un piso' }, { valor: 'DOS_PISOS', texto: 'Dos pisos' }]} />
      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="mb-1.5 text-[13px] font-semibold">Servicios</legend>
        {SERVICIOS.map((s) => (
          <Casilla key={s.valor} etiqueta={s.texto} marcada={servicios.includes(s.valor)} alCambiar={(v) => setServicios((x) => (v ? [...x, s.valor] : x.filter((y) => y !== s.valor)))} />
        ))}
      </fieldset>
      <Button type="submit" disabled={!valido || guardar.isPending}>
        {guardar.isPending ? 'Guardando…' : bus ? 'Guardar cambios' : 'Agregar bus'}
      </Button>
      {bus && <Selector etiqueta="Estado del bus" value={bus.estado} onChange={(e) => estado.mutate(e.target.value as EstadoBus)} opciones={ESTADOS} />}
    </form>
  )
}
