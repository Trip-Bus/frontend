import { useInfiniteQuery } from '@tanstack/react-query'
import type { Pagina } from '@/lib/tipos'

/** Elementos de una página: catalog, identity y flash-offers usan `content`; booking usa `items`. */
export function elementosDe<T>(pagina: Pagina<T> | null | undefined): T[] {
  return pagina?.content ?? pagina?.items ?? []
}

/** ¿Hay otra página después de las `cargadas`? */
export function siguientePagina<T>(ultima: Pagina<T> | null | undefined, cargadas: number): number | undefined {
  return ultima && cargadas < (ultima.totalPages ?? 0) ? cargadas : undefined
}

/**
 * Listado paginado con "Cargar más" (T-05): acumula las páginas que ya se pidieron.
 * `cargar(page)` recibe el número de página desde 0.
 */
export function usePaginado<T, P extends Pagina<T> = Pagina<T>>(
  clave: readonly unknown[],
  cargar: (page: number) => Promise<P>,
  opciones: { enabled?: boolean; refetchInterval?: number | false } = {},
) {
  const consulta = useInfiniteQuery({
    queryKey: clave,
    queryFn: ({ pageParam }) => cargar(pageParam),
    initialPageParam: 0,
    getNextPageParam: (ultima, todas) => siguientePagina(ultima, todas.length),
    ...opciones,
  })
  const paginas = consulta.data?.pages ?? []
  return {
    consulta,
    elementos: paginas.flatMap((p) => elementosDe<T>(p)),
    primera: paginas[0] as P | undefined,
    total: paginas[0]?.totalElements ?? 0,
  }
}
