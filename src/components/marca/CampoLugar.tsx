import { useQuery } from '@tanstack/react-query'
import { useEffect, useId, useState } from 'react'
import { Campo } from '@/components/ui/input'
import { api } from '@/lib/endpoints'

/** Espera a que la persona deje de escribir antes de consultar (menos llamadas al servidor). */
function useDemorado(valor: string, ms = 250): string {
  const [demorado, setDemorado] = useState(valor)
  useEffect(() => {
    const id = setTimeout(() => setDemorado(valor), ms)
    return () => clearTimeout(id)
  }, [valor, ms])
  return demorado
}

/**
 * Campo de ciudad o terminal con autocompletado (US-115, GET /places?q=): ciudades primero, máximo 10, sin
 * distinguir tildes. Usa un <datalist> nativo: funciona con teclado y lector de pantalla en el celular.
 */
export function CampoLugar({ etiqueta, valor, alCambiar }: { etiqueta: string; valor: string; alCambiar: (v: string) => void }) {
  const lista = useId()
  const q = useDemorado(valor.trim())
  const lugares = useQuery({
    queryKey: ['lugares', q.toLowerCase()],
    queryFn: ({ signal }) => api.catalogo.lugares(q, signal),
    enabled: q.length >= 2,
    staleTime: 5 * 60_000,
  })
  const nombres = [...new Set((lugares.data ?? []).map((l) => (l.tipo === 'CIUDAD' ? l.nombre : l.ciudad)))]
  return (
    <>
      <Campo etiqueta={etiqueta} list={lista} autoComplete="off" value={valor} onChange={(e) => alCambiar(e.target.value)} />
      <datalist id={lista}>
        {nombres.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
    </>
  )
}
