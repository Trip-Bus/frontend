import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/endpoints'
import type { Oferta } from '@/lib/tipos'

/** La fila abre 10 minutos antes del inicio de la oferta (tripbus.offers.queue.opens-before). */
export const APERTURA_FILA_MS = 10 * 60_000

/** Turno del pasajero en la sala de espera (US-162). `ADMITIDO` habilita la compra por 5 minutos. */
export function useSala(o: Oferta | undefined, conSesion: boolean, ahora: number) {
  const abierta = !!o?.salaEsperaHabilitada && new Date(o.inicio).getTime() - ahora <= APERTURA_FILA_MS
  const sala = useQuery({
    queryKey: ['sala', o?.offerId],
    queryFn: () => api.ofertas.miTurno(o!.offerId),
    enabled: abierta && conSesion,
    refetchInterval: 5_000,
  })
  return { abierta, sala }
}
