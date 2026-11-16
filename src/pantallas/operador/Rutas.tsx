import { useQuery } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { CargarMas, Resultado } from '@/components/marca/Consulta'
import { Aviso } from '@/components/marca/Estados'
import { PantallaGestion } from '@/components/marca/PantallaGestion'
import { Button } from '@/components/ui/button'
import { Segmentos, Selector } from '@/components/ui/campos'
import { Hoja } from '@/components/ui/hoja'
import { Campo } from '@/components/ui/input'
import { useEmpresaActiva } from '@/features/empresa'
import { usePaginado } from '@/features/paginacion'
import { renumerar, validarParadas, validarPreciosTramo } from '@/features/rutas'
import { useAccion } from '@/hooks/useAccion'
import { api } from '@/lib/endpoints'
import { dinero, duracion } from '@/lib/formato'
import type { ParadaRuta, PrecioTramo, Ruta } from '@/lib/tipos'

const parada = (orden: number, minutos: number): ParadaRuta => ({ orden, nombre: '', lat: 4.6, lng: -74.08, minutosDesdeSalida: minutos, terminalId: null })
const num = (v: string) => (v.trim() === '' || Number.isNaN(Number(v)) ? 0 : Number(v))

/** O-03 Rutas (US-114/115/138): origen, destino y paradas en orden, terminal opcional y precios por tramo. */
export function Rutas() {
  const { companyId, esAdmin } = useEmpresaActiva()
  const [estado, setEstado] = useState('')
  const [editando, setEditando] = useState<Ruta | 'nueva' | null>(null)
  const { consulta, elementos, total } = usePaginado<Ruta>(['rutas', companyId ?? null, estado], (page) => api.rutas.listar({ companyId, estado: estado || undefined, page, size: 20 }))
  return (
    <PantallaGestion titulo="Rutas" descripcion="Recorridos, paradas y precios por tramo." requiereEmpresa acciones={<Button onClick={() => setEditando('nueva')}>Crear ruta</Button>}>
      <div className="max-w-xs">
        <Selector etiqueta="Estado" vacia="Todas" value={estado} onChange={(e) => setEstado(e.target.value)} opciones={[{ valor: 'ACTIVA', texto: 'Activas' }, { valor: 'INACTIVA', texto: 'Inactivas' }]} />
      </div>
      <Resultado consulta={consulta} hayDatos={elementos.length > 0} vacio="Aún no hay rutas. Crea la primera.">
        <ul className="grid gap-2 md:grid-cols-2">
          {elementos.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => setEditando(r)} className="tap flex w-full items-center justify-between gap-3 rounded-tarjeta bg-superficie p-4 text-left">
                <span className="flex flex-col">
                  <span className="font-semibold">
                    {r.origen} → {r.destino}
                  </span>
                  <span className="text-[13px] text-texto-2">{duracion(r.duracionMinutos)}</span>
                </span>
                <span className="rounded-md bg-linea px-1.5 text-[12px] font-bold">{r.estado === 'ACTIVA' ? 'Activa' : 'Inactiva'}</span>
              </button>
            </li>
          ))}
        </ul>
        <CargarMas hay={!!consulta.hasNextPage} cargando={consulta.isFetchingNextPage} alCargar={() => consulta.fetchNextPage()} mostrados={elementos.length} total={total} />
      </Resultado>
      {editando && <HojaRuta id={editando === 'nueva' ? null : editando.id} companyId={esAdmin ? companyId : undefined} alCerrar={() => setEditando(null)} />}
    </PantallaGestion>
  )
}

function HojaRuta({ id, companyId, alCerrar }: { id: string | null; companyId: string | undefined; alCerrar: () => void }) {
  const [vista, setVista] = useState<'ruta' | 'precios'>('ruta')
  const ruta = useQuery({ queryKey: ['ruta', id], queryFn: () => api.rutas.obtener(id!), enabled: !!id })
  return (
    <Hoja abierta alCambiar={(a) => !a && alCerrar()} titulo={id ? 'Editar ruta' : 'Crear ruta'}>
      <div className="flex flex-col gap-3 pb-3">
        {id && (
          <Segmentos etiqueta="Sección" rol="tablist" valor={vista} alCambiar={setVista} opciones={[{ valor: 'ruta', texto: 'Ruta y paradas' }, { valor: 'precios', texto: 'Precios por tramo' }]} />
        )}
        {id && !ruta.data ? (
          <Resultado consulta={ruta} hayDatos={false} vacio="No encontramos la ruta.">
            {null}
          </Resultado>
        ) : vista === 'ruta' || !ruta.data ? (
          <FormRuta ruta={ruta.data ?? null} companyId={companyId} alTerminar={alCerrar} />
        ) : (
          <PreciosTramo ruta={ruta.data} />
        )}
      </div>
    </Hoja>
  )
}

function FormRuta({ ruta, companyId, alTerminar }: { ruta: Ruta | null; companyId: string | undefined; alTerminar: () => void }) {
  const [origen, setOrigen] = useState(ruta?.origen ?? '')
  const [destino, setDestino] = useState(ruta?.destino ?? '')
  const [paradas, setParadas] = useState<ParadaRuta[]>(ruta?.paradas?.length ? ruta.paradas : [parada(1, 0), parada(2, 60)])
  const terminales = useQuery({ queryKey: ['terminales'], queryFn: () => api.catalogo.terminales(), staleTime: 5 * 60_000 })
  const problema = validarParadas(origen, destino, paradas)
  const datos = { origen: origen.trim(), destino: destino.trim(), paradas: renumerar(paradas).map((p) => ({ ...p, nombre: p.nombre.trim(), terminalId: p.terminalId || null })) }
  const guardar = useAccion(() => (ruta ? api.rutas.editar(ruta.id, datos) : api.rutas.crear({ ...datos, companyId })), {
    exito: ruta ? 'Guardamos la ruta.' : 'Creamos la ruta.',
    invalidar: [['rutas'], ['ruta']],
    alTerminar,
  })
  const estado = useAccion(() => api.rutas.cambiarEstado(ruta!.id, ruta!.estado === 'ACTIVA' ? 'INACTIVA' : 'ACTIVA'), { exito: 'Cambiamos el estado de la ruta.', invalidar: [['rutas']], alTerminar })
  const cambiar = (i: number, parcial: Partial<ParadaRuta>) => setParadas((ps) => ps.map((p, k) => (k === i ? { ...p, ...parcial } : p)))

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Origen" value={origen} onChange={(e) => setOrigen(e.target.value)} />
        <Campo etiqueta="Destino" value={destino} onChange={(e) => setDestino(e.target.value)} />
      </div>
      <h3 className="text-[15px] font-semibold">Paradas (la primera es el origen y la última el destino)</h3>
      <ol className="flex flex-col gap-2">
        {paradas.map((p, i) => (
          <li key={i} aria-label={`Parada ${i + 1}`} className="flex flex-col gap-2 rounded-[16px] bg-fondo p-3">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Campo etiqueta={`Parada ${i + 1}`} value={p.nombre} onChange={(e) => cambiar(i, { nombre: e.target.value })} />
              </div>
              <Button variante="fantasma" tamano="icono" aria-label={`Quitar la parada ${i + 1}`} disabled={paradas.length <= 2} onClick={() => setParadas((ps) => ps.filter((_, k) => k !== i))}>
                <Trash2 className="size-5" aria-hidden="true" />
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Campo etiqueta="Latitud" inputMode="decimal" value={p.lat} onChange={(e) => cambiar(i, { lat: num(e.target.value) })} />
              <Campo etiqueta="Longitud" inputMode="decimal" value={p.lng} onChange={(e) => cambiar(i, { lng: num(e.target.value) })} />
              <Campo etiqueta="Minutos" inputMode="numeric" value={p.minutosDesdeSalida} onChange={(e) => cambiar(i, { minutosDesdeSalida: num(e.target.value) })} />
            </div>
            <Selector
              etiqueta="Terminal (opcional)"
              vacia="Sin terminal"
              value={p.terminalId ?? ''}
              onChange={(e) => {
                const t = terminales.data?.find((x) => x.id === e.target.value)
                cambiar(i, t ? { terminalId: t.id, lat: t.lat, lng: t.lng } : { terminalId: null })
              }}
              opciones={(terminales.data ?? []).map((t) => ({ valor: t.id, texto: `${t.ciudad} · ${t.nombre}` }))}
            />
          </li>
        ))}
      </ol>
      <Button
        variante="contorno"
        className="self-start"
        onClick={() => setParadas((ps) => [...ps.slice(0, -1), parada(ps.length, ps.at(-2)!.minutosDesdeSalida + 30), { ...ps.at(-1)!, orden: ps.length + 1 }])}
      >
        <Plus className="size-5" aria-hidden="true" />
        Agregar parada intermedia
      </Button>
      {problema && <Aviso tono="alerta">{problema}</Aviso>}
      <Button disabled={!!problema || guardar.isPending} onClick={() => guardar.mutate(undefined)}>
        {guardar.isPending ? 'Guardando…' : ruta ? 'Guardar la ruta' : 'Crear la ruta'}
      </Button>
      {ruta && (
        <Button variante="fantasma" disabled={estado.isPending} onClick={() => estado.mutate(undefined)}>
          {ruta.estado === 'ACTIVA' ? 'Desactivar la ruta' : 'Activar la ruta'}
        </Button>
      )}
    </div>
  )
}

function PreciosTramo({ ruta }: { ruta: Ruta }) {
  const paradas = ruta.paradas ?? []
  const actuales = useQuery({ queryKey: ['precios-tramo', ruta.id], queryFn: () => api.rutas.preciosTramo(ruta.id) })
  return (
    <Resultado consulta={actuales} hayDatos vacio="">
      {actuales.data && <EditorPrecios ruta={ruta} paradas={paradas.length} inicial={actuales.data} nombres={paradas.map((p) => p.nombre)} />}
    </Resultado>
  )
}

function EditorPrecios({ ruta, paradas, inicial, nombres }: { ruta: Ruta; paradas: number; inicial: PrecioTramo[]; nombres: string[] }) {
  const [precios, setPrecios] = useState<PrecioTramo[]>(inicial)
  const problema = validarPreciosTramo(precios, paradas)
  const guardar = useAccion(() => api.rutas.guardarPreciosTramo(ruta.id, precios), { exito: 'Guardamos los precios por tramo.', invalidar: [['precios-tramo', ruta.id]] })
  const opciones = nombres.map((n, i) => ({ valor: String(i + 1), texto: `${i + 1}. ${n}` }))
  const cambiar = (i: number, parcial: Partial<PrecioTramo>) => setPrecios((ps) => ps.map((p, k) => (k === i ? { ...p, ...parcial } : p)))
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[14px] text-texto-2">El recorrido completo usa el precio base de cada viaje. Aquí van los precios exactos de los tramos intermedios.</p>
      {precios.length === 0 && <Aviso>No hay precios por tramo: los tramos se cobran en proporción al recorrido.</Aviso>}
      <ul className="flex flex-col gap-2">
        {precios.map((p, i) => (
          <li key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
            <Selector etiqueta="Desde" value={String(p.desdeOrden)} onChange={(e) => cambiar(i, { desdeOrden: Number(e.target.value) })} opciones={opciones} />
            <Selector etiqueta="Hasta" value={String(p.hastaOrden)} onChange={(e) => cambiar(i, { hastaOrden: Number(e.target.value) })} opciones={opciones} />
            <Campo etiqueta={`Precio ${dinero(p.precio)}`} inputMode="numeric" value={p.precio} onChange={(e) => cambiar(i, { precio: num(e.target.value.replace(/\D/g, '')) })} />
            <Button variante="fantasma" tamano="icono" aria-label={`Quitar el tramo ${i + 1}`} onClick={() => setPrecios((ps) => ps.filter((_, k) => k !== i))}>
              <Trash2 className="size-5" aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ul>
      <Button variante="contorno" className="self-start" disabled={paradas < 3} onClick={() => setPrecios((ps) => [...ps, { desdeOrden: 1, hastaOrden: 2, precio: 0 }])}>
        <Plus className="size-5" aria-hidden="true" />
        Agregar tramo
      </Button>
      {problema && <Aviso tono="alerta">{problema}</Aviso>}
      <Button disabled={!!problema || guardar.isPending} onClick={() => guardar.mutate(undefined)}>
        {guardar.isPending ? 'Guardando…' : 'Guardar precios'}
      </Button>
    </div>
  )
}
