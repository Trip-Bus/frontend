import { useMutation } from '@tanstack/react-query'
import { FileDown } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { descargarBlob } from '@/features/descarga'
import { textoError } from '@/lib/api'
import { api } from '@/lib/endpoints'
import type { Uuid } from '@/lib/tipos'

export function DescargarManifiesto({ itineraryId }: { itineraryId: Uuid }) {
  const descargar = useMutation({
    mutationFn: () => api.reservas.manifiestoCsv(itineraryId),
    onSuccess: (archivo) => {
      descargarBlob(archivo, `manifiesto-${itineraryId}.csv`)
      toast('Manifiesto descargado.')
    },
    onError: (error) => toast(textoError(error)),
  })

  return (
    <section aria-label="Manifiesto del viaje" className="flex flex-col gap-2 rounded-tarjeta bg-superficie p-4">
      <div>
        <h2 className="text-[16px] font-semibold">Manifiesto de pasajeros</h2>
        <p className="text-[13px] text-texto-2">Descarga el listado de abordaje y los puestos asignados.</p>
      </div>
      <Button variante="contorno" ancho="completo" disabled={descargar.isPending} onClick={() => descargar.mutate()}>
        <FileDown className="size-5" aria-hidden="true" />
        {descargar.isPending ? 'Descargando…' : 'Descargar manifiesto CSV'}
      </Button>
    </section>
  )
}
