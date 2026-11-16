import { useQuery } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { CampoLugar } from '@/components/marca/CampoLugar'
import { Resultado } from '@/components/marca/Consulta'
import { Encabezado } from '@/components/marca/Encabezado'
import { Pantalla } from '@/components/marca/Pantalla'
import { Button } from '@/components/ui/button'
import { useAcento } from '@/hooks/useAcento'
import { useAccion } from '@/hooks/useAccion'
import { api } from '@/lib/endpoints'

const MAXIMO = 10

/** P-11 (US-161): rutas que sigue el pasajero; cuando sale una oferta en una de ellas llega un aviso. */
export function RutasSeguidas() {
  useAcento(null)
  const rutas = useQuery({ queryKey: ['rutas-seguidas'], queryFn: api.ofertas.rutasSeguidas })
  const [origen, setOrigen] = useState('')
  const [destino, setDestino] = useState('')
  const seguir = useAccion(() => api.ofertas.seguirRuta(origen.trim(), destino.trim()), {
    exito: 'Listo: te avisamos cuando salga una oferta en esa ruta.',
    invalidar: [['rutas-seguidas']],
    alTerminar: () => {
      setOrigen('')
      setDestino('')
    },
  })
  const dejar = useAccion((id: string) => api.ofertas.dejarDeSeguir(id), { exito: 'Dejaste de seguir la ruta.', invalidar: [['rutas-seguidas']] })
  const lista = rutas.data ?? []
  const lleno = lista.length >= MAXIMO
  const valida = origen.trim() && destino.trim() && origen.trim().toLowerCase() !== destino.trim().toLowerCase() && !lleno
  const enviar = (e: FormEvent) => {
    e.preventDefault()
    if (valida) seguir.mutate(undefined)
  }
  return (
    <Pantalla>
      <Encabezado titulo="Rutas que sigues" volverA="/cuenta">
        Te avisamos cuando salga una oferta en estas rutas. Puedes seguir hasta {MAXIMO}.
      </Encabezado>
      <div className="flex flex-col gap-4 px-5 pt-4 pb-8">
        <form onSubmit={enviar} className="flex flex-col gap-3 rounded-tarjeta bg-superficie p-4" noValidate>
          <CampoLugar etiqueta="Desde" valor={origen} alCambiar={setOrigen} />
          <CampoLugar etiqueta="Hacia" valor={destino} alCambiar={setDestino} />
          <Button type="submit" disabled={!valida || seguir.isPending}>
            {lleno ? 'Ya sigues 10 rutas' : seguir.isPending ? 'Guardando…' : 'Seguir esta ruta'}
          </Button>
        </form>
        <Resultado consulta={rutas} hayDatos={lista.length > 0} vacio="Aún no sigues ninguna ruta.">
          <ul className="flex flex-col gap-2">
            {lista.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 rounded-tarjeta bg-superficie p-4">
                <span className="font-semibold">
                  {r.origen} → {r.destino}
                </span>
                <Button variante="fantasma" tamano="icono" aria-label={`Dejar de seguir ${r.origen} a ${r.destino}`} disabled={dejar.isPending} onClick={() => dejar.mutate(r.id)}>
                  <Trash2 className="size-5" aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        </Resultado>
      </div>
    </Pantalla>
  )
}
