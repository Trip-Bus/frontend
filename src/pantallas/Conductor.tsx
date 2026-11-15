import { useQuery } from '@tanstack/react-query'
import { ArrowRight, BusFront, Clock3, MapPin } from 'lucide-react'
import { Link } from 'react-router'
import { BarraInferior } from '@/components/marca/BarraInferior'
import { Aviso, Esqueleto, PantallaError } from '@/components/marca/Estados'
import { Pantalla } from '@/components/marca/Pantalla'
import { buttonVariants } from '@/components/ui/button-variants'
import { api } from '@/lib/endpoints'
import { fechaCorta, horaCorta, plural } from '@/lib/formato'
import type { ViajeConductor } from '@/lib/tipos'
import { cn } from '@/lib/utils'

const ESTADO: Record<string, string> = {
  PROGRAMADO: 'Programado',
  EN_RUTA: 'En ruta',
  SIN_SENAL: 'Sin señal',
  FINALIZADO: 'Finalizado',
  CANCELADO: 'Cancelado',
}

export function Conductor() {
  const viajes = useQuery({
    queryKey: ['conductor', 'viajes', 'hoy'],
    queryFn: () => api.conductor.misViajes(),
    staleTime: 30_000,
  })

  if (viajes.isError) {
    return <PantallaError titulo="No pudimos cargar tus viajes" error={viajes.error} reintentar={() => viajes.refetch()} volverA="/conductor" />
  }

  return (
    <Pantalla>
      <header className="flex items-center justify-between px-5">
        <div>
          <span className="text-[13px] text-texto-2">Área del conductor</span>
          <h1 className="font-display text-[24px] font-bold tracking-[-0.01em]">Mis viajes de hoy</h1>
        </div>
        <BusFront className="size-7 text-texto-2" aria-hidden="true" />
      </header>

      <section aria-label="Viajes asignados hoy" className="flex flex-1 flex-col gap-3 px-5 pt-4">
        <h2 className="text-[14px] font-medium text-texto-2">
          {viajes.isSuccess ? plural(viajes.data.length, 'viaje asignado', 'viajes asignados') : 'Cargando asignaciones'}
        </h2>
        {viajes.isPending ? (
          <Esqueleto className="px-0 pt-0" bloques={[150, 150]} />
        ) : viajes.data.length === 0 ? (
          <Aviso>Hoy no tienes viajes asignados. Si esperabas una asignación, consulta con el operador de tu empresa.</Aviso>
        ) : (
          viajes.data.map((viaje) => <TarjetaViaje key={viaje.itineraryId} viaje={viaje} />)
        )}
      </section>

      <BarraInferior activa="panel" />
    </Pantalla>
  )
}

function TarjetaViaje({ viaje }: { viaje: ViajeConductor }) {
  const activo = viaje.puedeCompartirUbicacion && !viaje.finalizado
  const estado = ESTADO[viaje.estado] ?? viaje.estado
  const accion = viaje.finalizado ? 'Ver resumen' : viaje.iniciado ? 'Continuar viaje' : 'Preparar salida'

  return (
    <article className={cn('flex flex-col gap-3 rounded-tarjeta bg-superficie p-4', activo && 'ring-2 ring-acento')}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-[12px] text-texto-2">{fechaCorta(viaje.fechaSalida)} · {viaje.rol === 'RELEVO' ? 'Relevo' : 'Principal'}</span>
          <h3 className="font-display text-[20px] font-bold">{viaje.origen} → {viaje.destino}</h3>
        </div>
        <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold', activo ? 'bg-acento text-tinta' : 'bg-fondo text-texto-2')}>
          {activo ? 'Activo ahora' : estado}
        </span>
      </div>

      <div className="flex items-center gap-4 text-[13px] text-texto-2">
        <span className="flex items-center gap-1.5">
          <Clock3 className="size-4" aria-hidden="true" />
          <span className="num">{horaCorta(viaje.fechaSalida)}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <MapPin className="size-4" aria-hidden="true" />
          Ventana hasta <span className="num">{horaCorta(viaje.ventanaFin)}</span>
        </span>
      </div>

      {viaje.finalizado && <Aviso tono="exito">Viaje finalizado.</Aviso>}
      {!viaje.finalizado && viaje.iniciado && <Aviso tono="exito">Viaje iniciado. Mantén el GPS activo durante el recorrido.</Aviso>}

      <Link
        to={`/panel/viaje/${viaje.itineraryId}`}
        className={buttonVariants({ variante: activo ? 'acento' : 'contorno', ancho: 'completo', className: 'justify-between' })}
      >
        {accion}
        <ArrowRight className="size-5" aria-hidden="true" />
      </Link>
    </article>
  )
}
