import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { descargarBlob } from '@/features/descarga'
import { textoError } from '@/lib/api'

/** Descarga un archivo del servidor (PDF o CSV) y avisa si no se pudo. */
export function useDescargar() {
  return useMutation({
    mutationFn: async ({ pedir, nombre }: { pedir: () => Promise<Blob>; nombre: string }) => {
      descargarBlob(await pedir(), nombre)
      return nombre
    },
    onError: (e) => toast(textoError(e, 'No pudimos descargar el archivo.')),
  })
}
