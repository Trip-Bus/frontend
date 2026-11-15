import { useQuery } from '@tanstack/react-query'
import type { Opcion } from '@/components/ui/campos'
import { api } from '@/lib/endpoints'
import type { Uuid } from '@/lib/tipos'
import { elementosDe } from './paginacion'

/** Opciones de las listas desplegables de gestión (rutas, buses y empresas), compartidas en caché. */
export function useOpcionesRutas(companyId: Uuid | undefined, soloActivas = true) {
  const q = useQuery({
    queryKey: ['rutas', 'opciones', companyId ?? null, soloActivas],
    queryFn: () => api.rutas.listar({ companyId, estado: soloActivas ? 'ACTIVA' : undefined, size: 100 }),
    staleTime: 60_000,
  })
  const opciones: Opcion[] = elementosDe(q.data).map((r) => ({ valor: r.id, texto: `${r.origen} → ${r.destino}` }))
  return { opciones, rutas: elementosDe(q.data), cargando: q.isPending }
}

export function useOpcionesBuses(companyId: Uuid | undefined, soloActivos = true) {
  const q = useQuery({
    queryKey: ['buses', 'opciones', companyId ?? null, soloActivos],
    queryFn: () => api.buses.listar({ companyId, estado: soloActivos ? 'ACTIVO' : undefined, size: 100 }),
    staleTime: 60_000,
  })
  const opciones: Opcion[] = elementosDe(q.data).map((b) => ({ valor: b.id, texto: `${b.placa} · ${b.tipo === 'DOS_PISOS' ? 'dos pisos' : 'un piso'}` }))
  return { opciones, buses: elementosDe(q.data), cargando: q.isPending }
}

export function useOpcionesEmpresas(habilitado = true) {
  const q = useQuery({ queryKey: ['empresas', 'todas'], queryFn: () => api.empresas.listar({ size: 100 }), staleTime: 60_000, enabled: habilitado })
  const opciones: Opcion[] = elementosDe(q.data).map((e) => ({ valor: e.id, texto: e.nombre }))
  return { opciones, cargando: q.isPending }
}

/** "1, 2,3 4" → ["1","2","3","4"] */
export function listaAsientos(texto: string): string[] {
  return [...new Set(texto.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean))]
}
