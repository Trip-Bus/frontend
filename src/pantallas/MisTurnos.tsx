import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Resultado } from '@/components/marca/Consulta'
import { Encabezado } from '@/components/marca/Encabezado'
import { Pantalla } from '@/components/marca/Pantalla'
import { buttonVariants } from '@/components/ui/button-variants'
import { Button } from '@/components/ui/button'
import { useAcento } from '@/hooks/useAcento'
import { useSegundosRestantes } from '@/hooks/useAhora'
import { textoError } from '@/lib/api'
import { api } from '@/lib/endpoints'
import { fechaHora, plural, reloj } from '@/lib/formato'
import type { DetalleItinerario, TurnoEspera } from '@/lib/tipos'

const ESTADO: Record<string, string> = {
  CONVERTIDO: 'Compraste el puesto que te guardamos.',
  CANCELADO: 'Saliste de la lista o la lista cerró.',
  VENCIDO: 'Te guardamos un puesto pero no alcanzaste a comprarlo.',
}

/**
 * P-09 Mis turnos (US-140): la lista de espera de los buses llenos. Si alguien suelta un puesto, se aparta para el
 * siguiente turno 10 minutos (WaitlistSeatOffered): "Te guardamos tu silla" y el botón para comprarla.
 */
export function MisTurnos() {
  useAcento(null)
  const turnos = useQuery({ queryKey: ['turnos'], queryFn: api.asientos.misTurnos, refetchInterval: 30_000 })
  const lista = turnos.data ?? []
  const ids = [...new Set(lista.map((t) => t.itineraryId))]
  const detalles = useQueries({ queries: ids.map((id) => ({ queryKey: ['itinerario', id], queryFn: () => api.catalogo.itinerario(id), staleTime: 60_000 })) })
  const porId = new Map(ids.map((id, i) => [id, detalles[i]?.data]))
  return (
    <Pantalla>
      <Encabezado titulo="Mis turnos" volverA="/cuenta">
        Buses llenos en los que esperas un puesto.
      </Encabezado>
      <div className="flex flex-col gap-3 px-5 pt-4 pb-8">
        <Resultado consulta={turnos} hayDatos={lista.length > 0} vacio="No estás en ninguna lista de espera. Si un bus está lleno, anótate desde sus puestos.">
          {lista.map((t) => (
            <Turno key={t.id} t={t} d={porId.get(t.itineraryId)} />
          ))}
        </Resultado>
      </div>
    </Pantalla>
  )
}

function Turno({ t, d }: { t: TurnoEspera; d: DetalleItinerario | undefined }) {
  const queryClient = useQueryClient()
  const ofrecido = t.estado === 'OFRECIDO' && !!t.holdId
  const retencion = useQuery({ queryKey: ['retencion', t.holdId], queryFn: () => api.asientos.retencion(t.holdId!), enabled: ofrecido })
  const restante = useSegundosRestantes(retencion.data?.expiraEn)
  const salir = useMutation({
    mutationFn: () => api.asientos.salirDeEspera(t.itineraryId),
    onSuccess: () => {
      toast('Saliste de la lista de espera.')
      void queryClient.invalidateQueries({ queryKey: ['turnos'] })
    },
    onError: (e) => toast(textoError(e)),
  })
  const titulo = d ? `${d.origen} → ${d.destino}` : 'Viaje'
  return (
    <article aria-label={titulo} className="flex flex-col gap-2 rounded-tarjeta bg-superficie p-4">
      <h2 className="font-semibold">{titulo}</h2>
      <p className="text-[14px] text-texto-2">
        {d ? `Sale ${fechaHora(d.fechaSalida)} · ` : ''}
        {plural(t.cantidad, 'puesto', 'puestos')}
      </p>
      {ofrecido ? (
        <>
          <p role="timer" className="rounded-[14px] bg-acento p-3 text-[15px] font-semibold text-tinta">
            ¡Te guardamos tu silla! Tienes <span className="num">{reloj(restante ?? 600)}</span> para comprarla.
          </p>
          <Link to={`/reserva/${t.holdId}`} className={buttonVariants({ ancho: 'completo' })}>
            Comprar ahora
          </Link>
        </>
      ) : t.estado === 'ESPERANDO' ? (
        <p className="text-[14px]">
          Tu lugar en la fila: <span className="num font-bold">{t.posicion ?? '—'}</span>
        </p>
      ) : (
        <p className="text-[14px] text-texto-2">{ESTADO[t.estado] ?? t.estado}</p>
      )}
      {(t.estado === 'ESPERANDO' || ofrecido) && (
        <Button variante="fantasma" tamano="md" className="self-start" disabled={salir.isPending} onClick={() => salir.mutate()}>
          {salir.isPending ? 'Saliendo…' : 'Salir de la lista'}
        </Button>
      )}
    </article>
  )
}
