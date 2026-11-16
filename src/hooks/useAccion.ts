import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { textoError } from '@/lib/api'

/**
 * Acción de una pantalla de gestión: llama a la API, avisa el resultado en español y refresca las consultas que
 * cambiaron. Los errores se muestran con el mensaje del backend traducido (api.ts).
 */
export function useAccion<A, R>(
  llamar: (a: A) => Promise<R>,
  { exito, invalidar = [], alTerminar }: { exito: string | ((r: R) => string); invalidar?: string[][]; alTerminar?: (r: R) => void },
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: llamar,
    onSuccess: (r) => {
      toast(typeof exito === 'function' ? exito(r) : exito)
      invalidar.forEach((queryKey) => void queryClient.invalidateQueries({ queryKey }))
      alTerminar?.(r)
    },
    onError: (e) => toast(textoError(e)),
  })
}
