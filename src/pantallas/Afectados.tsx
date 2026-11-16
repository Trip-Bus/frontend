import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Resultado } from '@/components/marca/Consulta'
import { Encabezado } from '@/components/marca/Encabezado'
import { HojaMotivo } from '@/components/marca/HojaMotivo'
import { Pantalla } from '@/components/marca/Pantalla'
import { buttonVariants } from '@/components/ui/button-variants'
import { Button } from '@/components/ui/button'
import { useAcento } from '@/hooks/useAcento'
import { useAhora } from '@/hooks/useAhora'
import { textoError } from '@/lib/api'
import { api } from '@/lib/endpoints'
import { fechaHora, plazoRestante } from '@/lib/formato'
import type { CausaAfectacion, DetalleItinerario, ReservaAfectada } from '@/lib/tipos'

const CAUSA: Record<CausaAfectacion, { titulo: string; siNoEliges: string }> = {
  CANCELACION: {
    titulo: 'La empresa canceló tu viaje',
    siNoEliges: 'Si no eliges, te ubicamos en el siguiente viaje de la misma ruta con cupo en los próximos 3 días o, si no hay, te devolvemos el dinero.',
  },
  REPROGRAMACION: {
    titulo: 'La empresa cambió la hora de tu viaje',
    siNoEliges: 'Si no eliges, tu tiquete sigue válido con el nuevo horario.',
  },
  RETRASO: {
    titulo: 'Tu viaje sale más de una hora tarde',
    siNoEliges: 'Si no eliges, tu tiquete sigue válido con el nuevo horario.',
  },
}

const DECISION: Record<string, string> = {
  ACEPTO_CAMBIO: 'Aceptaste el nuevo horario.',
  REPROGRAMADA: 'Reprogramaste tu viaje sin costo.',
  REUBICADA: 'Te ubicamos en otro viaje de la misma ruta.',
  REEMBOLSADA: 'Te devolvimos el dinero.',
}

/** Opciones que trae el backend (o las de la causa, si no vinieron). */
function opcionesDe(a: ReservaAfectada) {
  const lista = a.opciones.length ? a.opciones : a.causa === 'CANCELACION' ? ['REUBICAR', 'REEMBOLSO'] : ['ACEPTAR', 'REUBICAR', 'REEMBOLSO']
  return {
    aceptar: a.causa !== 'CANCELACION' && lista.some((o) => o.startsWith('ACEPT')),
    reprogramar: lista.some((o) => o === 'REUBICAR' || o.startsWith('REPROGRAM')),
    reembolso: lista.some((o) => o.startsWith('REEMBOLS') || o === 'REFUND'),
  }
}

/**
 * P-08 Viajes afectados (US-154/155): cuando la empresa cancela, reprograma o retrasa más de 60 min, el pasajero
 * elige en 24 h entre aceptar el nuevo horario, reprogramar gratis o el reembolso. El pasajero no puede pedir
 * reembolso por su cuenta: solo existe aquí, porque el cambio no fue su culpa.
 */
export function Afectados() {
  useAcento(null)
  const ahora = useAhora(30_000)
  const afectados = useQuery({ queryKey: ['afectados'], queryFn: api.afectados.listar })
  const lista = [...(afectados.data ?? [])].sort((a, b) => Number(b.estado === 'PENDIENTE') - Number(a.estado === 'PENDIENTE'))
  const ids = [...new Set(lista.map((a) => a.itineraryId))]
  const detalles = useQueries({
    queries: ids.map((id) => ({ queryKey: ['itinerario', id], queryFn: () => api.catalogo.itinerario(id), staleTime: 60_000 })),
  })
  const porId = new Map(ids.map((id, i) => [id, detalles[i]?.data]))

  return (
    <Pantalla>
      <Encabezado titulo="Viajes con cambios" volverA="/mis-tiquetes">
        La empresa cambió estos viajes. Tú decides qué hacer: sin costo y sin perder tu dinero.
      </Encabezado>
      <div className="flex flex-col gap-3 px-5 pt-4 pb-8">
        <Resultado consulta={afectados} hayDatos={lista.length > 0} bloques={[220]} vacio="No tienes viajes afectados por la empresa.">
          {lista.map((a) => (
            <TarjetaAfectado key={a.bookingId} a={a} d={porId.get(a.itineraryId)} ahora={ahora} />
          ))}
        </Resultado>
      </div>
    </Pantalla>
  )
}

function TarjetaAfectado({ a, d, ahora }: { a: ReservaAfectada; d: DetalleItinerario | undefined; ahora: number }) {
  const queryClient = useQueryClient()
  const [pidiendoReembolso, setPidiendoReembolso] = useState(false)
  const causa = CAUSA[a.causa] ?? CAUSA.REPROGRAMACION
  const pendiente = a.estado === 'PENDIENTE'
  const op = opcionesDe(a)
  const alTerminar = (texto: string) => {
    toast(texto)
    setPidiendoReembolso(false)
    void queryClient.invalidateQueries({ queryKey: ['afectados'] })
    void queryClient.invalidateQueries({ queryKey: ['mis-viajes'] })
  }
  const aceptar = useMutation({
    mutationFn: () => api.afectados.aceptar(a.bookingId),
    onSuccess: () => alTerminar('Listo: viajas con el nuevo horario.'),
    onError: (e) => toast(textoError(e)),
  })
  const reembolsar = useMutation({
    mutationFn: () => api.afectados.reembolsar(a.bookingId),
    onSuccess: () => alTerminar('Pedimos tu reembolso. Te llega el comprobante a Mis viajes.'),
    onError: (e) => toast(textoError(e)),
  })

  return (
    <article aria-label={causa.titulo} className="flex flex-col gap-3 rounded-tarjeta bg-superficie p-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-[19px] font-bold">{causa.titulo}</h2>
        <p className="text-[14px] text-texto-2">
          {d ? `${d.origen} → ${d.destino} · ${d.estado === 'CANCELADO' ? 'cancelado' : `ahora sale ${fechaHora(d.fechaSalida)}`}` : ' '}
        </p>
      </div>
      {pendiente ? (
        <>
          <p role="timer" className="num self-start rounded-full bg-naranja px-3 py-1 text-[13px] font-bold text-tinta">
            {plazoRestante(a.plazoDecision, ahora)} · hasta {fechaHora(a.plazoDecision)}
          </p>
          <p className="text-[14px] leading-snug">{causa.siNoEliges}</p>
          <div className="flex flex-col gap-2">
            {op.aceptar && (
              <Button ancho="completo" disabled={aceptar.isPending} onClick={() => aceptar.mutate()}>
                {aceptar.isPending ? 'Guardando…' : 'Aceptar el nuevo horario'}
              </Button>
            )}
            {op.reprogramar && (
              <Link to={`/reprogramar/${a.bookingId}?afectado=1`} className={buttonVariants({ variante: op.aceptar ? 'contorno' : 'tinta', ancho: 'completo' })}>
                Reprogramar gratis
              </Link>
            )}
            {op.reembolso && (
              <Button variante="contorno" ancho="completo" onClick={() => setPidiendoReembolso(true)}>
                Quiero el reembolso
              </Button>
            )}
          </div>
        </>
      ) : (
        <p role="status" className="rounded-[14px] bg-fondo p-3 text-[14px]">
          {DECISION[a.estado] ?? 'Ya decidimos este viaje.'}
          {a.decididoPor === 'SISTEMA' ? ' Lo aplicamos automáticamente al vencer el plazo.' : ''}
        </p>
      )}
      <HojaMotivo
        abierta={pidiendoReembolso}
        alCerrar={() => setPidiendoReembolso(false)}
        titulo="¿Pedir el reembolso?"
        descripcion="Te devolvemos todo lo que pagaste por este viaje y el tiquete queda anulado. No se puede deshacer."
        boton="Sí, quiero el reembolso"
        ocupado={reembolsar.isPending}
        alConfirmar={() => reembolsar.mutate()}
      />
    </article>
  )
}
