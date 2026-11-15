import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BellRing } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { activarPush, desactivarPush, estadoPush, type EstadoPush } from '@/features/push'
import { textoError } from '@/lib/api'

const TEXTO: Record<EstadoPush, string> = {
  'no-soportado': 'Este navegador no permite avisos con la app cerrada.',
  bloqueado: 'Bloqueaste los avisos para TripBus. Actívalos en la configuración del navegador.',
  activo: 'Te avisamos aunque tengas la app cerrada.',
  inactivo: 'Recibe los cambios de tus viajes aunque tengas la app cerrada.',
}

/** T-06: el permiso de notificaciones se pide solo al tocar el botón. */
export function ActivarAvisos() {
  const queryClient = useQueryClient()
  const estado = useQuery({ queryKey: ['push'], queryFn: estadoPush, staleTime: Infinity })
  const cambiar = useMutation({
    mutationFn: (activar: boolean) => (activar ? activarPush() : desactivarPush()),
    onSuccess: (nuevo) => {
      queryClient.setQueryData(['push'], nuevo)
      if (nuevo === 'activo') toast('Listo: te avisaremos aunque tengas la app cerrada.')
    },
    onError: (e) => toast(textoError(e, 'No pudimos activar los avisos.')),
  })
  const e = estado.data
  if (!e) return null
  return (
    <section aria-label="Avisos con la app cerrada" className="flex items-center gap-3 rounded-tarjeta bg-superficie p-4">
      <BellRing className="size-6 shrink-0" aria-hidden="true" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold">Avisos en el teléfono</span>
        <span className="text-[13px] text-texto-2">{TEXTO[e]}</span>
      </span>
      {(e === 'activo' || e === 'inactivo') && (
        <Button variante={e === 'activo' ? 'contorno' : 'tinta'} tamano="md" disabled={cambiar.isPending} onClick={() => cambiar.mutate(e === 'inactivo')}>
          {e === 'activo' ? 'Desactivar' : 'Activar'}
        </Button>
      )}
    </section>
  )
}
