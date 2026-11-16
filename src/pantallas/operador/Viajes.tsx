import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { CargarMas, Resultado } from '@/components/marca/Consulta'
import { Aviso } from '@/components/marca/Estados'
import { PantallaGestion } from '@/components/marca/PantallaGestion'
import { Button } from '@/components/ui/button'
import { Casilla, Segmentos, Selector } from '@/components/ui/campos'
import { Campo } from '@/components/ui/input'
import { hoy } from '@/features/busqueda'
import { useEmpresaActiva } from '@/features/empresa'
import { useOpcionesBuses, useOpcionesRutas } from '@/features/opcionesGestion'
import { usePaginado } from '@/features/paginacion'
import { textoError } from '@/lib/api'
import { api } from '@/lib/endpoints'
import { dinero, fechaHora, instanteDesdeCampo, plural, sumarDias } from '@/lib/formato'
import type { DiaSemana, ResultadoProgramacion, ResumenItinerario } from '@/lib/tipos'
import { GestionViaje } from './GestionViaje'

const DIAS: { valor: DiaSemana; texto: string }[] = [
  { valor: 'LUNES', texto: 'Lun' },
  { valor: 'MARTES', texto: 'Mar' },
  { valor: 'MIERCOLES', texto: 'Mié' },
  { valor: 'JUEVES', texto: 'Jue' },
  { valor: 'VIERNES', texto: 'Vie' },
  { valor: 'SABADO', texto: 'Sáb' },
  { valor: 'DOMINGO', texto: 'Dom' },
]

/**
 * O-04 Viajes: programar un viaje suelto (POST /itineraries) o recurrente (POST /itineraries/schedule, con los
 * creados y los omitidos y su motivo) y el listado de la empresa, desde el que se gestiona cada viaje.
 */
export function Viajes() {
  const { companyId } = useEmpresaActiva()
  const [filtro, setFiltro] = useState({ desde: hoy(), hasta: sumarDias(hoy(), 14), routeId: '', busId: '', estado: '' })
  const [gestionando, setGestionando] = useState<ResumenItinerario | null>(null)
  const rutas = useOpcionesRutas(companyId, false)
  const buses = useOpcionesBuses(companyId, false)
  const { consulta, elementos, total } = usePaginado<ResumenItinerario>(['itinerarios', companyId ?? null, filtro], (page) =>
    api.operador.itinerarios({
      ...filtro,
      routeId: filtro.routeId || undefined,
      busId: filtro.busId || undefined,
      estado: filtro.estado || undefined,
      companyId,
      page,
      size: 20,
    }),
  )
  const cambiar = (parcial: Partial<typeof filtro>) => setFiltro((f) => ({ ...f, ...parcial }))

  return (
    <PantallaGestion titulo="Viajes" descripcion="Programa salidas y gestiona los cambios de cada viaje." requiereEmpresa>
      <Programar companyId={companyId} />

      <section aria-label="Listado de viajes" className="flex flex-col gap-3">
        <h2 className="text-[18px] font-semibold">Viajes programados</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Campo etiqueta="Desde" type="date" value={filtro.desde} onChange={(e) => cambiar({ desde: e.target.value })} />
          <Campo etiqueta="Hasta" type="date" value={filtro.hasta} onChange={(e) => cambiar({ hasta: e.target.value })} />
          <Selector etiqueta="Ruta" vacia="Todas" value={filtro.routeId} onChange={(e) => cambiar({ routeId: e.target.value })} opciones={rutas.opciones} />
          <Selector etiqueta="Bus" vacia="Todos" value={filtro.busId} onChange={(e) => cambiar({ busId: e.target.value })} opciones={buses.opciones} />
          <Selector
            etiqueta="Estado"
            vacia="Todos"
            value={filtro.estado}
            onChange={(e) => cambiar({ estado: e.target.value })}
            opciones={[
              { valor: 'PROGRAMADO', texto: 'Programado' },
              { valor: 'CANCELADO', texto: 'Cancelado' },
            ]}
          />
        </div>
        <Resultado consulta={consulta} hayDatos={elementos.length > 0} vacio="No hay viajes con esos filtros.">
          <ul className="grid gap-2 md:grid-cols-2">
            {elementos.map((v) => (
              <li key={v.itineraryId} className="flex items-center justify-between gap-3 rounded-tarjeta bg-superficie p-4">
                <span className="flex min-w-0 flex-col">
                  <span className="font-semibold">
                    {v.origen} → {v.destino}
                  </span>
                  <span className="text-[13px] text-texto-2">
                    {fechaHora(v.fechaSalida)} · <span className="num">{v.placa}</span> · {dinero(v.precioBase)}
                    {v.estado === 'CANCELADO' ? ' · cancelado' : ''}
                  </span>
                </span>
                <Button variante="contorno" tamano="md" onClick={() => setGestionando(v)}>
                  Gestionar
                </Button>
              </li>
            ))}
          </ul>
          <CargarMas hay={!!consulta.hasNextPage} cargando={consulta.isFetchingNextPage} alCargar={() => consulta.fetchNextPage()} mostrados={elementos.length} total={total} />
        </Resultado>
      </section>

      <GestionViaje viaje={gestionando} companyId={companyId} alCerrar={() => setGestionando(null)} />
    </PantallaGestion>
  )
}

type Modo = 'suelto' | 'recurrente'

function Programar({ companyId }: { companyId: string | undefined }) {
  const queryClient = useQueryClient()
  const rutas = useOpcionesRutas(companyId)
  const buses = useOpcionesBuses(companyId)
  const [modo, setModo] = useState<Modo>('suelto')
  const [datos, setDatos] = useState({ routeId: '', busId: '', fechaSalida: '', precioBase: '', horaSalida: '06:00', desde: hoy(), hasta: sumarDias(hoy(), 30) })
  const [dias, setDias] = useState<DiaSemana[]>(['LUNES', 'MIERCOLES', 'VIERNES'])
  const [resultado, setResultado] = useState<ResultadoProgramacion | null>(null)
  const cambiar = (parcial: Partial<typeof datos>) => setDatos((d) => ({ ...d, ...parcial }))
  const precio = Number(datos.precioBase)
  const listo = !!datos.routeId && !!datos.busId && precio > 0 && (modo === 'suelto' ? !!datos.fechaSalida : dias.length > 0 && datos.desde <= datos.hasta)

  const programar = useMutation({
    mutationFn: async () => {
      if (modo === 'suelto') {
        await api.operador.programar({ routeId: datos.routeId, busId: datos.busId, fechaSalida: instanteDesdeCampo(datos.fechaSalida), precioBase: precio })
        return null
      }
      return api.operador.programarRecurrente({ routeId: datos.routeId, busId: datos.busId, horaSalida: datos.horaSalida, diasSemana: dias, desde: datos.desde, hasta: datos.hasta, precioBase: precio })
    },
    onSuccess: (r) => {
      setResultado(r)
      toast(r ? `Programamos ${plural(r.creados.length, 'viaje', 'viajes')}.` : 'Viaje programado.')
      void queryClient.invalidateQueries({ queryKey: ['itinerarios'] })
      void queryClient.invalidateQueries({ queryKey: ['operador-viajes'] })
    },
    onError: (e) => toast(textoError(e)),
  })

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    if (listo) programar.mutate()
  }

  return (
    <section aria-label="Programar viajes" className="flex flex-col gap-3 rounded-tarjeta bg-superficie p-4">
      <h2 className="text-[18px] font-semibold">Programar</h2>
      <Segmentos
        etiqueta="Tipo de programación"
        valor={modo}
        alCambiar={(m) => {
          setModo(m)
          setResultado(null)
        }}
        opciones={[
          { valor: 'suelto', texto: 'Un viaje' },
          { valor: 'recurrente', texto: 'Recurrente' },
        ]}
      />
      <form onSubmit={enviar} className="flex flex-col gap-3" noValidate>
        <div className="grid gap-3 md:grid-cols-3">
          <Selector etiqueta="Ruta" vacia={rutas.cargando ? 'Cargando…' : 'Elige la ruta'} value={datos.routeId} onChange={(e) => cambiar({ routeId: e.target.value })} opciones={rutas.opciones} />
          <Selector etiqueta="Bus" vacia={buses.cargando ? 'Cargando…' : 'Elige el bus'} value={datos.busId} onChange={(e) => cambiar({ busId: e.target.value })} opciones={buses.opciones} />
          <Campo etiqueta="Precio base (COP)" inputMode="numeric" value={datos.precioBase} onChange={(e) => cambiar({ precioBase: e.target.value.replace(/\D/g, '').slice(0, 8) })} />
        </div>
        {modo === 'suelto' ? (
          <Campo etiqueta="Salida (hora de Colombia)" type="datetime-local" value={datos.fechaSalida} onChange={(e) => cambiar({ fechaSalida: e.target.value })} />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Campo etiqueta="Hora de salida" type="time" value={datos.horaSalida} onChange={(e) => cambiar({ horaSalida: e.target.value })} />
              <Campo etiqueta="Desde" type="date" value={datos.desde} onChange={(e) => cambiar({ desde: e.target.value })} />
              <Campo etiqueta="Hasta" type="date" value={datos.hasta} onChange={(e) => cambiar({ hasta: e.target.value })} />
            </div>
            <fieldset className="flex flex-wrap gap-x-4 gap-y-2">
              <legend className="mb-1.5 text-[13px] font-semibold">Días de la semana</legend>
              {DIAS.map((d) => (
                <Casilla key={d.valor} etiqueta={d.texto} marcada={dias.includes(d.valor)} alCambiar={(v) => setDias((x) => (v ? [...x, d.valor] : x.filter((y) => y !== d.valor)))} />
              ))}
            </fieldset>
            <p className="text-[13px] text-texto-2">Máximo 90 días y 200 viajes. Las fechas pasadas o con cruce del bus se omiten sin afectar las demás.</p>
          </>
        )}
        <Button type="submit" className="self-start" disabled={!listo || programar.isPending}>
          {programar.isPending ? 'Programando…' : modo === 'suelto' ? 'Programar viaje' : 'Programar viajes'}
        </Button>
      </form>
      {resultado && <ResultadoRecurrente r={resultado} />}
    </section>
  )
}

function ResultadoRecurrente({ r }: { r: ResultadoProgramacion }) {
  return (
    <div className="flex flex-col gap-2">
      <Aviso tono="exito">Creamos {plural(r.creados.length, 'viaje', 'viajes')}.</Aviso>
      {r.omitidos.length > 0 && (
        <>
          <h3 className="text-[14px] font-semibold">Se omitieron {plural(r.omitidos.length, 'fecha', 'fechas')}</h3>
          <ul className="flex flex-col gap-1 text-[14px]">
            {r.omitidos.map((o) => (
              <li key={o.fecha} className="rounded-[12px] bg-fondo px-3 py-2">
                <span className="num font-semibold">{o.fecha}</span>: {o.motivo}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
