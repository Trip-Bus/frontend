import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { textoError } from '@/lib/api'
import { api } from '@/lib/endpoints'
import { fechaHora } from '@/lib/formato'
import type { Uuid } from '@/lib/tipos'

/** Comparte un enlace con el menú del sistema o, si no existe, lo copia. */
export async function compartirEnlace(url: string, titulo: string, texto: string) {
  try {
    if (navigator.share) {
      await navigator.share({ title: titulo, text: texto, url })
      return
    }
    await navigator.clipboard.writeText(`${texto} ${url}`)
    toast('Enlace copiado.')
  } catch {
    /* la persona cerró el menú */
  }
}

/**
 * US-181 "Compartir mi viaje": crea un enlace /compartido/{codigo} que un familiar abre sin cuenta.
 * El enlace vence (venceEn) y nunca muestra datos de los pasajeros.
 */
export function useCompartirViaje() {
  return useMutation({
    mutationFn: (itineraryId: Uuid) => api.viaje.compartir(itineraryId),
    onSuccess: (enlace) =>
      compartirEnlace(
        `${globalThis.location.origin}/compartido/${enlace.codigo}`,
        'Sigue mi viaje en TripBus',
        `Sigue mi bus en vivo (el enlace vale hasta ${fechaHora(enlace.venceEn)}):`,
      ),
    onError: (e) => toast(textoError(e, 'No pudimos crear el enlace para compartir.')),
  })
}
