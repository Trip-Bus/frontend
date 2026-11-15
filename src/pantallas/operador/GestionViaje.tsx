import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Resultado } from '@/components/marca/Consulta'
import { Aviso } from '@/components/marca/Estados'
import { Button } from '@/components/ui/button'
import { AreaTexto, Selector } from '@/components/ui/campos'
import { Hoja } from '@/components/ui/hoja'
import { Campo } from '@/components/ui/input'
import { listaAsientos, useOpcionesBuses } from '@/features/opcionesGestion'
import { ApiError, textoError } from '@/lib/api'
import { api } from '@/lib/endpoints'
import { campoDesdeInstante, fechaHora, instanteDesdeCampo, porcentaje } from '@/lib/formato'
import type { ResumenItinerario } from '@/lib/tipos'

type Accion = 'salida' | 'bus' | 'cancelar' | 'asientos' | 'historial' | 'ocupacion'

const ACCIONES: { valor: Accion; texto: string }[] = [
  { valor: 'salida', texto: 'Reprogramar o retrasar' },
  { valor: 'bus', texto: 'Cambiar bus' },
  { valor: 'asientos', texto: 'Bloquear asientos' },
  { valor: 'ocupacion', texto: 'Ocupación' },
  { valor: 'historial', texto: 'Historial' },
  { valor: 'cancelar', texto: 'Cancelar viaje' },
]

const TIPO_CAMBIO: Record<string, string> = {
  RETRASO: 'Retraso',
  REPROGRAMACION: 'Reprogramación',
  CAMBIO_BUS: 'Cambio de bus',
  CANCELACION: 'Cancelación',
}

/** O-04: todo lo que se puede hacer con un viaje programado, en una hoja. */
export function GestionViaje({ viaje, companyId, alCerrar }: { viaje: ResumenItinerario | null; companyId: string | undefined; alCerrar: () => void }) {
  const [accion, setAccion] = useState<Accion>('salida')
  return (
    <Hoja
      abierta={!!viaje}
      alCambiar={(a) => !a && alCerrar()}
      titulo={viaje ? `${viaje.origen} → ${viaje.destino}` : ''}
      descripcion={viaje ? `Sale ${fechaHora(viaje.fechaSalida)} · bus ${viaje.placa}` : undefined}
    >
      {viaje && (
        <div className="flex flex-col gap-3 pb-3">
          <Selector etiqueta="¿Qué quieres hacer?" value={accion} onChange={(e) => setAccion(e.target.value as Accion)} opciones={ACCIONES.map((a) => ({ valor: a.valor, texto: a.texto }))} />
          {accion === 'salida' && <CambiarSalida v={viaje} alTerminar={alCerrar} />}
          {accion === 'bus' && <CambiarBus v={viaje} companyId={companyId} alTerminar={alCerrar} />}
          {accion === 'cancelar' && <Cancelar v={viaje} alTerminar={alCerrar} />}
          {accion === 'asientos' && <BloquearAsientos v={viaje} />}
          {accion === 'historial' && <Historial v={viaje} />}
          {accion === 'ocupacion' && <Ocupacion v={viaje} />}
        </div>
      )}
    </Hoja>
  )
}

function useAlCambiar(texto: string, alTerminar: () => void) {
  const queryClient = useQueryClient()
  return () => {
    toast(texto)
    void queryClient.invalidateQueries({ queryKey: ['itinerarios'] })
    void queryClient.invalidateQueries({ queryKey: ['operador-viajes'] })
    alTerminar()
  }
}

function CambiarSalida({ v, alTerminar }: { v: ResumenItinerario; alTerminar: () => void }) {
  const [salida, setSalida] = useState(() => campoDesdeInstante(v.fechaSalida))
  const [motivo, setMotivo] = useState('')
  const listo = useAlCambiar('Cambiamos la salida. Avisamos a los pasajeros.', alTerminar)
  const m = useMutation({ mutationFn: () => api.operador.cambiarSalida(v.itineraryId, instanteDesdeCampo(salida), motivo.trim()), onSuccess: listo, onError: (e) => toast(textoError(e)) })
  const enviar = (e: FormEvent) => {
    e.preventDefault()
    if (salida && motivo.trim().length >= 3) m.mutate()
  }
  return (
    <form onSubmit={enviar} className="flex flex-col gap-3" noValidate>
      <Campo etiqueta="Nueva salida (hora de Colombia)" type="datetime-local" value={salida} onChange={(e) => setSalida(e.target.value)} />
      <AreaTexto etiqueta="Motivo (lo ven los pasajeros)" value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} />
      <p className="text-[13px] text-texto-2">Correrla hasta 6 h es un retraso; más, o adelantarla, es una reprogramación. Con más de 60 min los pasajeros pueden elegir reprogramar o el reembolso.</p>
      <Button type="submit" disabled={m.isPending || motivo.trim().length < 3}>
        {m.isPending ? 'Guardando…' : 'Guardar la nueva salida'}
      </Button>
    </form>
  )
}

function CambiarBus({ v, companyId, alTerminar }: { v: ResumenItinerario; companyId: string | undefined; alTerminar: () => void }) {
  const buses = useOpcionesBuses(companyId)
  const [busId, setBusId] = useState('')
  const [motivo, setMotivo] = useState('')
  const [conflicto, setConflicto] = useState<string[] | null>(null)
  const listo = useAlCambiar('Cambiamos el bus del viaje.', alTerminar)
  const m = useMutation({
    mutationFn: () => api.operador.cambiarBus(v.itineraryId, busId, motivo.trim()),
    onSuccess: listo,
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'SEATS_CONFLICT') {
        setConflicto(Array.isArray(e.details.asientos) ? (e.details.asientos as string[]) : [])
        return
      }
      toast(textoError(e))
    },
  })
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (busId && motivo.trim().length >= 3) m.mutate()
      }}
      className="flex flex-col gap-3"
      noValidate
    >
      <Selector
        etiqueta="Bus nuevo"
        vacia="Elige el bus"
        value={busId}
        onChange={(e) => {
          setBusId(e.target.value)
          setConflicto(null)
        }}
        opciones={buses.opciones.filter((b) => b.valor !== v.busId)}
      />
      <AreaTexto etiqueta="Motivo" value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} />
      {conflicto && (
        <Aviso tono="alerta">
          No se puede cambiar: estos puestos vendidos o apartados no existen en el bus nuevo: <span className="num font-semibold">{conflicto.join(', ') || 'sin detalle'}</span>.
        </Aviso>
      )}
      <Button type="submit" disabled={m.isPending || !busId || motivo.trim().length < 3}>
        {m.isPending ? 'Cambiando…' : 'Cambiar el bus'}
      </Button>
    </form>
  )
}

function Cancelar({ v, alTerminar }: { v: ResumenItinerario; alTerminar: () => void }) {
  const [motivo, setMotivo] = useState('')
  const listo = useAlCambiar('Cancelamos el viaje. Los pasajeros pueden reprogramar gratis o pedir el reembolso.', alTerminar)
  const m = useMutation({ mutationFn: () => api.operador.cancelar(v.itineraryId, motivo.trim()), onSuccess: listo, onError: (e) => toast(textoError(e)) })
  if (v.estado === 'CANCELADO') return <Aviso>Este viaje ya está cancelado.</Aviso>
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (motivo.trim().length >= 3) m.mutate()
      }}
      className="flex flex-col gap-3"
      noValidate
    >
      <Aviso tono="alerta">Cancelar no se puede deshacer: los pasajeros reciben el aviso y pueden pedir el reembolso.</Aviso>
      <AreaTexto etiqueta="Motivo de la cancelación" value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} />
      <Button type="submit" disabled={m.isPending || motivo.trim().length < 3}>
        {m.isPending ? 'Cancelando…' : 'Cancelar el viaje'}
      </Button>
    </form>
  )
}

function BloquearAsientos({ v }: { v: ResumenItinerario }) {
  const queryClient = useQueryClient()
  const [texto, setTexto] = useState('')
  const [motivo, setMotivo] = useState('')
  const asientos = listaAsientos(texto)
  const resultado = (r: { cambiados: string[]; sinCambio: string[] }, verbo: string) => {
    toast(`${verbo}: ${r.cambiados.join(', ') || 'ninguno'}${r.sinCambio.length ? `. Sin cambio: ${r.sinCambio.join(', ')}` : ''}`)
    void queryClient.invalidateQueries({ queryKey: ['ocupacion', v.itineraryId] })
  }
  const bloquear = useMutation({ mutationFn: () => api.asientos.bloquear(v.itineraryId, asientos, motivo.trim()), onSuccess: (r) => resultado(r, 'Bloqueados'), onError: (e) => toast(textoError(e)) })
  const liberar = useMutation({ mutationFn: () => api.asientos.desbloquear(v.itineraryId, asientos), onSuccess: (r) => resultado(r, 'Devueltos a la venta'), onError: (e) => toast(textoError(e)) })
  return (
    <div className="flex flex-col gap-3">
      <Campo etiqueta="Puestos (separados por coma)" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="1, 2, 15" />
      <Campo etiqueta="Motivo del bloqueo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Reservado para la tripulación" />
      <div className="grid grid-cols-2 gap-2">
        <Button disabled={asientos.length === 0 || !motivo.trim() || bloquear.isPending} onClick={() => bloquear.mutate()}>
          Bloquear
        </Button>
        <Button variante="contorno" disabled={asientos.length === 0 || liberar.isPending} onClick={() => liberar.mutate()}>
          Desbloquear
        </Button>
      </div>
      <p className="text-[13px] text-texto-2">Solo se bloquean puestos libres: si alguno está apartado, vendido o en oferta no se bloquea ninguno.</p>
    </div>
  )
}

function Historial({ v }: { v: ResumenItinerario }) {
  const q = useQuery({ queryKey: ['historial', v.itineraryId], queryFn: () => api.operador.historial(v.itineraryId) })
  const lista = q.data ?? []
  return (
    <Resultado consulta={q} hayDatos={lista.length > 0} vacio="Este viaje no ha tenido cambios.">
      <ol className="flex flex-col gap-2">
        {lista.map((c) => (
          <li key={c.id} className="rounded-[14px] bg-fondo p-3 text-[14px]">
            <span className="font-semibold">{TIPO_CAMBIO[c.tipo] ?? c.tipo}</span> · {fechaHora(c.creadoEn)}
            {c.salidaAnterior && c.salidaNueva && (
              <span className="block text-texto-2">
                {fechaHora(c.salidaAnterior)} → {fechaHora(c.salidaNueva)}
              </span>
            )}
            {c.motivo && <span className="block">{c.motivo}</span>}
          </li>
        ))}
      </ol>
    </Resultado>
  )
}

function Ocupacion({ v }: { v: ResumenItinerario }) {
  const q = useQuery({ queryKey: ['ocupacion', v.itineraryId], queryFn: () => api.asientos.ocupacion(v.itineraryId) })
  const o = q.data
  return (
    <Resultado consulta={q} hayDatos={!!o} vacio="Sin datos de ocupación.">
      {o && (
        <dl className="grid grid-cols-2 gap-2 text-[14px]">
          {(
            [
              ['Ocupación', porcentaje(o.porcentajeOcupacion)],
              ['Vendidos', o.vendidos],
              ['Disponibles', o.disponibles],
              ['Apartados', o.retenidos],
              ['En oferta', o.enOferta],
              ['Bloqueados', o.bloqueados],
              ['Por tramos', o.enTramos],
              ['Abandono de compra', porcentaje(o.tasaAbandono)],
            ] as const
          ).map(([n, valor]) => (
            <div key={n} className="rounded-[14px] bg-fondo p-3">
              <dt className="text-texto-2">{n}</dt>
              <dd className="num font-semibold">{String(valor)}</dd>
            </div>
          ))}
        </dl>
      )}
    </Resultado>
  )
}
