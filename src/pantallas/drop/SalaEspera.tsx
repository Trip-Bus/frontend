import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Users } from 'lucide-react'
import { toast } from 'sonner'
import { Aviso } from '@/components/marca/Estados'
import { Button } from '@/components/ui/button'
import { useSegundosRestantes } from '@/hooks/useAhora'
import { textoError } from '@/lib/api'
import { api } from '@/lib/endpoints'
import { horaCorta, reloj } from '@/lib/formato'
import type { Oferta, SalaEspera as Sala } from '@/lib/tipos'
import { APERTURA_FILA_MS } from './useSala'

/**
 * Estado de la sala de espera: antes de abrir avisa la hora; luego "Entrar a la fila", la posición y, al ser
 * admitido (OfferQueueAdmitted), la cuenta regresiva de los 5 minutos para comprar.
 */
export function SalaEspera({ o, abierta, sala, conSesion, alPedirSesion }: { o: Oferta; abierta: boolean; sala?: Sala; conSesion: boolean; alPedirSesion: () => void }) {
  const queryClient = useQueryClient()
  const restanteTurno = useSegundosRestantes(sala?.estado === 'ADMITIDO' ? sala.admisionExpiraEn : null)
  const entrar = useMutation({
    mutationFn: () => api.ofertas.entrarFila(o.offerId),
    onSuccess: (s) => {
      queryClient.setQueryData(['sala', o.offerId], s)
      toast('Entraste a la fila. No cierres esta pantalla.')
    },
    onError: (e) => toast(textoError(e)),
  })

  if (!abierta) {
    return <Aviso>Esta oferta tiene sala de espera: la fila abre a las {horaCorta(new Date(new Date(o.inicio).getTime() - APERTURA_FILA_MS).toISOString())}.</Aviso>
  }
  if (!conSesion) {
    return (
      <Button variante="naranja" ancho="completo" onClick={alPedirSesion}>
        Entra para hacer la fila
      </Button>
    )
  }
  if (!sala || sala.estado === 'NO_INSCRITO') {
    return (
      <Button variante="naranja" ancho="completo" disabled={entrar.isPending || !sala} onClick={() => entrar.mutate()}>
        <Users className="size-5" aria-hidden="true" />
        {entrar.isPending ? 'Entrando…' : 'Entrar a la fila'}
      </Button>
    )
  }
  const textos: Record<string, string> = {
    EN_SALA: 'Estás en la sala. Cuando empiece la oferta sorteamos el orden de la fila.',
    EN_FILA: `Tu lugar en la fila: ${sala.posicion ?? '—'} de ${sala.enFila}. Te avisamos cuando sea tu turno.`,
    TURNO_VENCIDO: 'Se venció tu turno para comprar.',
    CERRADA: 'La fila de esta oferta ya cerró.',
  }
  if (sala.estado === 'ADMITIDO') {
    return (
      <Aviso tono="exito">
        ¡Es tu turno! Tienes <span className="num">{reloj(restanteTurno ?? 0)}</span> para apartar tu puesto.
      </Aviso>
    )
  }
  return <Aviso tono={sala.estado === 'TURNO_VENCIDO' || sala.estado === 'CERRADA' ? 'alerta' : 'neutro'}>{textos[sala.estado]}</Aviso>
}
