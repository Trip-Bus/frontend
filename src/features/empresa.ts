import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { api } from '@/lib/endpoints'
import { useSesion } from '@/lib/sesion'
import type { Uuid } from '@/lib/tipos'

/**
 * Empresa con la que trabaja la pantalla de gestión.
 *  - OPERADOR: la de su cuenta (el backend la toma del token; aquí se usa para los tópicos en vivo).
 *  - ADMIN (A-06): la que elige en el selector, guardada en `?companyId=` para que el enlace se pueda compartir.
 */
export function useEmpresaActiva(): { companyId: Uuid | undefined; esAdmin: boolean; cambiar: (id: Uuid | undefined) => void } {
  const s = useSesion()
  const [params, setParams] = useSearchParams()
  const esAdmin = s?.rol === 'ADMIN'
  const usuario = useQuery({
    queryKey: ['usuario', s?.userId],
    queryFn: () => api.auth.usuario(s!.userId),
    enabled: !!s && !esAdmin,
    staleTime: Infinity,
  })
  const cambiar = (id: Uuid | undefined) => {
    const siguiente = new URLSearchParams(params)
    if (id) siguiente.set('companyId', id)
    else siguiente.delete('companyId')
    setParams(siguiente, { replace: true })
  }
  const companyId = esAdmin ? (params.get('companyId') ?? undefined) : (usuario.data?.companyId ?? undefined)
  return { companyId, esAdmin, cambiar }
}

/** Conserva `?companyId=` al navegar entre pantallas de gestión del ADMIN. */
export function conEmpresa(ruta: string, companyId: Uuid | undefined): string {
  if (!companyId) return ruta
  return `${ruta}${ruta.includes('?') ? '&' : '?'}companyId=${encodeURIComponent(companyId)}`
}
