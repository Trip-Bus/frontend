import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { CargarMas, Resultado } from '@/components/marca/Consulta'
import { HojaMotivo } from '@/components/marca/HojaMotivo'
import { PantallaGestion } from '@/components/marca/PantallaGestion'
import { Button } from '@/components/ui/button'
import { Casilla, Selector } from '@/components/ui/campos'
import { Hoja } from '@/components/ui/hoja'
import { Campo } from '@/components/ui/input'
import { hoy } from '@/features/busqueda'
import { useEmpresaActiva } from '@/features/empresa'
import { listaAsientos } from '@/features/opcionesGestion'
import { elementosDe, usePaginado } from '@/features/paginacion'
import { useAccion } from '@/hooks/useAccion'
import { useAhora } from '@/hooks/useAhora'
import { api } from '@/lib/endpoints'
import { campoDesdeInstante, dinero, fechaHora, instanteDesdeCampo, porcentaje, sumarDias } from '@/lib/formato'
import type { EstadoOferta, Oferta, OfertaOperador } from '@/lib/tipos'
import { Dato } from './InicioOperador'

const ESTADOS: { valor: EstadoOferta; texto: string }[] = [
  { valor: 'PROGRAMADA', texto: 'Programada' },
  { valor: 'ACTIVA', texto: 'Activa' },
  { valor: 'AGOTADA', texto: 'Agotada' },
  { valor: 'CERRADA', texto: 'Cerrada' },
]

type Modo = { tipo: 'crear' } | { tipo: 'editar' | 'duplicar' | 'metricas'; o: Oferta }

/**
 * O-08 Ofertas del operador (US-164/165): las de la empresa con su cupo vendido, métricas del periodo y de cada
 * oferta, crear, editar o cancelar antes del inicio y duplicar en otro viaje.
 */
export function OfertasOperador() {
  const { companyId } = useEmpresaActiva()
  const ahora = useAhora(30_000)
  const [filtro, setFiltro] = useState({ estado: '', desde: sumarDias(hoy(), -30), hasta: sumarDias(hoy(), 7) })
  const [modo, setModo] = useState<Modo | null>(null)
  const [cancelando, setCancelando] = useState<Oferta | null>(null)
  const { consulta, elementos, total } = usePaginado<OfertaOperador>(['ofertas-operador', companyId ?? null, filtro], (page) =>
    api.ofertas.delOperador({ estado: (filtro.estado || undefined) as EstadoOferta | undefined, desde: filtro.desde, hasta: filtro.hasta, page, size: 20 }),
  )
  const resumen = useQuery({ queryKey: ['metricas-ofertas', companyId ?? null, filtro.desde, filtro.hasta], queryFn: () => api.ofertas.metricasOperador(filtro.desde, filtro.hasta) })
  const cancelar = useAccion((id: string) => api.ofertas.cancelar(id), { exito: 'Cancelamos la oferta y liberamos sus puestos.', invalidar: [['ofertas-operador']], alTerminar: () => setCancelando(null) })
  const cambiar = (parcial: Partial<typeof filtro>) => setFiltro((f) => ({ ...f, ...parcial }))

  return (
    <PantallaGestion titulo="Ofertas" descripcion="Ofertas relámpago de la empresa y cómo les fue." requiereEmpresa acciones={<Button onClick={() => setModo({ tipo: 'crear' })}>Crear oferta</Button>}>
      <div className="grid grid-cols-3 gap-3 md:max-w-2xl">
        <Selector etiqueta="Estado" vacia="Todas" value={filtro.estado} onChange={(e) => cambiar({ estado: e.target.value })} opciones={ESTADOS} />
        <Campo etiqueta="Desde" type="date" value={filtro.desde} onChange={(e) => e.target.value && cambiar({ desde: e.target.value })} />
        <Campo etiqueta="Hasta" type="date" value={filtro.hasta} onChange={(e) => e.target.value && cambiar({ hasta: e.target.value })} />
      </div>
      {resumen.data && (
        <section aria-label="Métricas del periodo" className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Dato titulo="Ofertas" valor={String(resumen.data.ofertas)} />
          <Dato titulo="Puestos vendidos" valor={String(resumen.data.ventas)} />
          <Dato titulo="Ingresos" valor={dinero(resumen.data.ingresos)} />
          <Dato titulo="Conversión promedio" valor={porcentaje(resumen.data.conversionPromedio)} />
        </section>
      )}
      <Resultado consulta={consulta} hayDatos={elementos.length > 0} vacio="No hay ofertas en ese periodo.">
        <ul className="grid gap-2 md:grid-cols-2">
          {elementos.map(({ oferta: o, cupoVendido, cupoRestante }) => {
            const editable = o.estado === 'PROGRAMADA' && new Date(o.inicio).getTime() > ahora
            return (
              <li key={o.offerId} className="flex flex-col gap-2 rounded-tarjeta bg-superficie p-4">
                <span className="flex justify-between gap-2">
                  <span className="num text-[18px] font-bold">{dinero(o.precioOferta)}</span>
                  <span className="rounded-md bg-linea px-1.5 text-[12px] font-bold">{ESTADOS.find((e) => e.valor === o.estado)?.texto ?? o.estado}</span>
                </span>
                <span className="text-[13px] text-texto-2">
                  {fechaHora(o.inicio)} → {fechaHora(o.fin)} · {cupoVendido} vendidos de {o.cupoMax}, quedan {cupoRestante}
                  {o.salaEsperaHabilitada ? ' · con sala de espera' : ''}
                </span>
                <span className="flex flex-wrap gap-2">
                  <Button variante="contorno" tamano="md" onClick={() => setModo({ tipo: 'metricas', o })}>
                    Métricas
                  </Button>
                  {editable && (
                    <Button variante="contorno" tamano="md" onClick={() => setModo({ tipo: 'editar', o })}>
                      Editar
                    </Button>
                  )}
                  <Button variante="contorno" tamano="md" onClick={() => setModo({ tipo: 'duplicar', o })}>
                    Duplicar
                  </Button>
                  {editable && (
                    <Button variante="fantasma" tamano="md" onClick={() => setCancelando(o)}>
                      Cancelar
                    </Button>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
        <CargarMas hay={!!consulta.hasNextPage} cargando={consulta.isFetchingNextPage} alCargar={() => consulta.fetchNextPage()} mostrados={elementos.length} total={total} />
      </Resultado>
      {modo && <HojaOferta modo={modo} companyId={companyId} alCerrar={() => setModo(null)} />}
      <HojaMotivo
        abierta={!!cancelando}
        alCerrar={() => setCancelando(null)}
        titulo="¿Cancelar la oferta?"
        descripcion="Sus puestos vuelven a la venta normal."
        boton="Sí, cancelar la oferta"
        ocupado={cancelar.isPending}
        alConfirmar={() => cancelando && cancelar.mutate(cancelando.offerId)}
      />
    </PantallaGestion>
  )
}

const TITULO = { crear: 'Crear oferta', editar: 'Editar oferta', duplicar: 'Duplicar en otro viaje', metricas: 'Métricas de la oferta' }

function HojaOferta({ modo, companyId, alCerrar }: { modo: Modo; companyId: string | undefined; alCerrar: () => void }) {
  return (
    <Hoja abierta alCambiar={(a) => !a && alCerrar()} titulo={TITULO[modo.tipo]}>
      <div className="flex flex-col gap-3 pb-3">{modo.tipo === 'metricas' ? <Metricas o={modo.o} /> : <FormOferta modo={modo} companyId={companyId} alTerminar={alCerrar} />}</div>
    </Hoja>
  )
}

function Metricas({ o }: { o: Oferta }) {
  const q = useQuery({ queryKey: ['metricas-oferta', o.offerId], queryFn: () => api.ofertas.metricas(o.offerId) })
  const m = q.data
  return (
    <Resultado consulta={q} hayDatos={!!m} vacio="Sin métricas.">
      {m && (
        <dl className="grid grid-cols-2 gap-2 text-[14px]">
          {(
            [
              ['Cupo', m.cupo],
              ['Reservas', m.reservasCreadas],
              ['Vendidos', m.ventas],
              ['Liberadas o vencidas', m.liberadasOVencidas],
              ['Conversión', porcentaje(m.conversion)],
              ['Se agotó en', m.tiempoEnAgotarseSegundos == null ? 'no se agotó' : `${Math.round(m.tiempoEnAgotarseSegundos / 60)} min`],
              ['Ingresos', dinero(m.ingresos)],
              ['Descuento otorgado', dinero(m.descuentoTotalOtorgado)],
              ['Seguidores avisados', m.seguidoresAlertados],
            ] as const
          ).map(([n, v]) => (
            <div key={n} className="rounded-[14px] bg-fondo p-3">
              <dt className="text-texto-2">{n}</dt>
              <dd className="num font-semibold">{String(v)}</dd>
            </div>
          ))}
        </dl>
      )}
    </Resultado>
  )
}

function FormOferta({ modo, companyId, alTerminar }: { modo: Exclude<Modo, { tipo: 'metricas' }>; companyId: string | undefined; alTerminar: () => void }) {
  const o = modo.tipo === 'crear' ? null : modo.o
  const [d, setD] = useState(() => {
    const en = (min: number) => campoDesdeInstante(new Date(Date.now() + min * 60_000).toISOString())
    return {
    itineraryId: modo.tipo === 'editar' && o ? o.itineraryId : '',
    asientos: o ? o.asientos.join(', ') : '',
    precio: o ? String(o.precioOferta) : '',
    cupo: o ? String(o.cupoMax) : '',
    max: o?.maxPorUsuario ? String(o.maxPorUsuario) : '1',
    inicio: o ? campoDesdeInstante(o.inicio) : en(30),
    fin: o ? campoDesdeInstante(o.fin) : en(90),
    reprogramar: o?.permiteReprogramar ?? true,
    sala: o?.salaEsperaHabilitada ?? false,
    }
  })
  const viajes = useQuery({
    queryKey: ['itinerarios', 'ofertas', companyId ?? null],
    queryFn: () => api.operador.itinerarios({ desde: hoy(), hasta: sumarDias(hoy(), 30), estado: 'PROGRAMADO', companyId, size: 100 }),
    enabled: modo.tipo !== 'editar',
  })
  const cambiar = (parcial: Partial<typeof d>) => setD((x) => ({ ...x, ...parcial }))
  const asientos = listaAsientos(d.asientos)
  const comun = { inicio: instanteDesdeCampo(d.inicio), fin: instanteDesdeCampo(d.fin) }
  const guardar = useAccion(
    () => {
      if (modo.tipo === 'duplicar') return api.ofertas.duplicar(modo.o.offerId, { itineraryId: d.itineraryId, ...comun, seatNumbers: asientos.length ? asientos : undefined })
      const datos = { precioOferta: Number(d.precio), cupo: Number(d.cupo), maxPorUsuario: Number(d.max), seatNumbers: asientos, permiteReprogramar: d.reprogramar, salaEsperaHabilitada: d.sala, ...comun }
      return modo.tipo === 'editar' ? api.ofertas.editar(modo.o.offerId, datos) : api.ofertas.crear({ itineraryId: d.itineraryId, ...datos })
    },
    { exito: modo.tipo === 'editar' ? 'Guardamos la oferta.' : modo.tipo === 'duplicar' ? 'Duplicamos la oferta.' : 'Creamos la oferta.', invalidar: [['ofertas-operador']], alTerminar },
  )
  const valida = d.itineraryId && d.inicio < d.fin && (modo.tipo === 'duplicar' || (Number(d.precio) > 0 && Number(d.cupo) > 0 && asientos.length >= Number(d.cupo)))
  return (
    <>
      {modo.tipo !== 'editar' && (
        <Selector
          etiqueta="Viaje"
          vacia={viajes.isPending ? 'Cargando viajes…' : 'Elige el viaje'}
          value={d.itineraryId}
          onChange={(e) => cambiar({ itineraryId: e.target.value })}
          opciones={elementosDe(viajes.data).map((v) => ({ valor: v.itineraryId, texto: `${v.origen} → ${v.destino} · ${fechaHora(v.fechaSalida)}` }))}
        />
      )}
      <Campo etiqueta={modo.tipo === 'duplicar' ? 'Puestos (vacío = los mismos)' : 'Puestos de la oferta'} value={d.asientos} onChange={(e) => cambiar({ asientos: e.target.value })} placeholder="1, 2, 3" />
      {modo.tipo !== 'duplicar' && (
        <div className="grid grid-cols-3 gap-3">
          <Campo etiqueta="Precio" inputMode="numeric" value={d.precio} onChange={(e) => cambiar({ precio: e.target.value.replace(/\D/g, '') })} />
          <Campo etiqueta="Cupo" inputMode="numeric" value={d.cupo} onChange={(e) => cambiar({ cupo: e.target.value.replace(/\D/g, '') })} />
          <Campo etiqueta="Máx. por persona" inputMode="numeric" value={d.max} onChange={(e) => cambiar({ max: e.target.value.replace(/\D/g, '') })} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Inicio" type="datetime-local" value={d.inicio} onChange={(e) => cambiar({ inicio: e.target.value })} />
        <Campo etiqueta="Fin" type="datetime-local" value={d.fin} onChange={(e) => cambiar({ fin: e.target.value })} />
      </div>
      {modo.tipo !== 'duplicar' && (
        <>
          <Casilla etiqueta="Permite reprogramar el tiquete" marcada={d.reprogramar} alCambiar={(v) => cambiar({ reprogramar: v })} />
          <Casilla etiqueta="Sala de espera (fila virtual desde 10 min antes)" marcada={d.sala} alCambiar={(v) => cambiar({ sala: v })} />
        </>
      )}
      <p className="text-[13px] text-texto-2">El descuento debe estar entre 5 % y 70 % y la oferta debe durar al menos 5 minutos y terminar antes de la salida.</p>
      <Button disabled={!valida || guardar.isPending} onClick={() => guardar.mutate(undefined)}>
        {guardar.isPending ? 'Guardando…' : TITULO[modo.tipo]}
      </Button>
    </>
  )
}
