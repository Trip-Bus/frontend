import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { avisos, describirAviso } from '@/features/avisos'
import { useSesion } from '@/lib/sesion'
import { topicos, useTopico, type MensajeTopico } from '@/lib/tiempoReal'

/** Qué datos en caché cambian con cada aviso (la pantalla abierta se actualiza sola). */
const CONSULTAS: Record<string, string[][]> = {
  BookingAffected: [['afectados'], ['mis-viajes']],
  BookingRelocated: [['afectados'], ['mis-viajes'], ['reservas']],
  RefundProcessed: [['afectados'], ['mis-viajes'], ['reservas']],
  TicketRescheduled: [['mis-viajes'], ['reservas']],
  TicketUpdated: [['mis-viajes'], ['tiquete']],
  TicketIssued: [['reserva'], ['reservas'], ['mis-viajes']],
  TicketNoShow: [['mis-viajes']],
  WaitlistSeatOffered: [['turnos']],
  WaitlistClosed: [['turnos']],
  OfferQueueAdmitted: [['sala']],
}

/**
 * Escucha los tópicos privados del pasajero mientras la app está abierta: guarda el aviso para la campana,
 * lo muestra y refresca lo que cambió. Va una sola vez, junto al router.
 */
export function AvisosEnVivo() {
  const s = useSesion()
  const queryClient = useQueryClient()
  const pasajero = s?.rol === 'PASAJERO' ? s.userId : null

  const alRecibir = (m: MensajeTopico) => {
    if (m.type !== 'event') return
    avisos.agregar(m.event, m.data, m.eventId)
    ;(CONSULTAS[m.event] ?? []).forEach((queryKey) => void queryClient.invalidateQueries({ queryKey }))
    toast(describirAviso({ evento: m.event, data: (m.data ?? {}) as Record<string, unknown> }).titulo)
  }
  useTopico(pasajero ? topicos.avisosUsuario(pasajero) : null, alRecibir)
  useTopico(pasajero ? topicos.tiquetesUsuario(pasajero) : null, alRecibir)
  return null
}
