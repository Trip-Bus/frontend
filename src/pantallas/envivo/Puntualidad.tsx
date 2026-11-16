import type { UseQueryResult } from '@tanstack/react-query'
import { useMemo } from 'react'
import { Aviso } from '@/components/marca/Estados'
import { crearProyeccion } from '@/features/seguimiento'
import { textoError } from '@/lib/api'
import { horaCorta } from '@/lib/formato'
import type { RecorridoViaje } from '@/lib/tipos'

const ANCHO = 360
const ALTO = 200

function retrasoTexto(min: number | null) {
  if (min == null) return 'sin dato'
  if (min <= 0) return 'a tiempo'
  return `${min} min tarde`
}

/** US-182: viaje terminado: recorrido real (un punto por minuto), hora real por parada y puntualidad. */
export function Puntualidad({ consulta }: { consulta: UseQueryResult<RecorridoViaje> }) {
  const datos = consulta.data
  const proyeccion = useMemo(() => {
    if (!datos) return null
    const puntos = [...datos.paradas, ...datos.recorrido]
    return puntos.length > 1 ? crearProyeccion(puntos, ANCHO, ALTO, 16) : null
  }, [datos])

  if (consulta.isPending) return <div aria-busy="true" aria-label="Cargando el recorrido" className="h-40 rounded-[18px] bg-fondo" />
  if (consulta.isError || !datos) return <Aviso>{textoError(consulta.error, 'El recorrido aún no está disponible.')}</Aviso>
  const p = datos.puntualidad
  const linea = proyeccion ? datos.recorrido.map(proyeccion).map((q, i) => `${i ? 'L' : 'M'}${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(' ') : ''

  return (
    <section aria-label="Recorrido y puntualidad" className="flex flex-col gap-3">
      <h2 className="text-[15px] font-semibold">Así fue el viaje</h2>
      {proyeccion && (
        <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} role="img" aria-label="Recorrido del bus" className="w-full rounded-[18px] bg-[#e8ebe3]">
          <path d={linea} fill="none" stroke="#0d1411" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          {datos.paradas.map((s) => {
            const q = proyeccion(s)
            return <circle key={s.orden} cx={q.x} cy={q.y} r="5" fill={s.aTiempo ? '#ffffff' : '#ff6b35'} stroke="#0d1411" strokeWidth="2.5" />
          })}
        </svg>
      )}
      <dl className="grid grid-cols-2 gap-2 text-[14px]">
        <div className="rounded-[14px] bg-fondo p-3">
          <dt className="text-texto-2">Salida</dt>
          <dd className="font-semibold">
            {p.salidaReal ? horaCorta(p.salidaReal) : '—'} · {retrasoTexto(p.minutosRetrasoSalida)}
          </dd>
        </div>
        <div className="rounded-[14px] bg-fondo p-3">
          <dt className="text-texto-2">Llegada</dt>
          <dd className="font-semibold">
            {p.llegadaReal ? horaCorta(p.llegadaReal) : '—'} · {retrasoTexto(p.minutosRetrasoLlegada)}
          </dd>
        </div>
      </dl>
      <p className="text-[14px] text-texto-2">
        Paradas a tiempo: {p.paradasATiempo} de {p.paradasTotal}
      </p>
    </section>
  )
}
