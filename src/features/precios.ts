import type { Filtros } from '@/features/busqueda'
import { normalizar } from '@/lib/ciudades'
import { api } from '@/lib/endpoints'
import type { DiaCalendario, EmpresaFaceta, FacetasBusqueda, FiltrosCalendario, ResultadoViaje } from '@/lib/tipos'

/** Paso del control de precio (COP). Los extremos no se redondean: son el precio real más bajo y más alto. */
export const PASO_PRECIO = 1000
/** PageUp / PageDown mueven 10 pasos. */
export const PASO_LARGO = 10

/** Precio "desde" de un resultado: el de catalog y, si no viene, el del tramo, el de la oferta o el base. */
export function precioDe(v: ResultadoViaje): number {
  return v.precioDesde ?? v.precio ?? v.ofertaActiva?.precioOferta ?? v.precioBase
}

/** Los filtros que el calendario y las facetas comparten con la lista (siempre con tramos, como la lista). */
export function filtrosDelCalendario(f: Filtros): FiltrosCalendario {
  return { tramos: true, companyId: f.companyId, franja: f.franja, tipoBus: f.tipoBus }
}

/** Consulta de facetas (la hoja de filtros y la pantalla comparten la queryKey: una llamada por combinación). */
export function consultaFacetas(busqueda: { origen: string; destino: string; fecha: string }, f: Filtros) {
  const filtros = filtrosDelCalendario(f)
  return {
    queryKey: ['facetas', busqueda.origen, busqueda.destino, busqueda.fecha, filtros] as const,
    queryFn: () => api.catalogo.facetas(busqueda.origen, busqueda.destino, busqueda.fecha, filtros),
    staleTime: 60_000,
  }
}

/** Lo que muestra cada día de la fila: sin salidas (deshabilitado), lleno o el precio desde. */
export type EstadoDia = { tipo: 'cargando' } | { tipo: 'sin-salidas' } | { tipo: 'lleno' } | { tipo: 'precio'; precio: number | null }

export function estadoDia(d: DiaCalendario | undefined): EstadoDia {
  if (!d) return { tipo: 'cargando' }
  if (d.viajes === 0) return { tipo: 'sin-salidas' }
  if (d.hayCupo === false) return { tipo: 'lleno' }
  return { tipo: 'precio', precio: d.precioMinimo }
}

/** Índice de la tarjeta "Más barato": la primera con cupo cuyo precio es el del día elegido (-1 si ninguna). */
export function indiceMasBarato(viajes: ResultadoViaje[], precioDia: number | null | undefined): number {
  if (precioDia == null) return -1
  return viajes.findIndex((v) => !v.agotado && precioDe(v) === precioDia)
}

/* ------------------------------------------------------------------ rango de precio */

export type Limites = { min: number; max: number }

/** Límites del control: null si no hay viajes; si min = max hay un solo precio (sin barra). */
export function limitesDe(f: Pick<FacetasBusqueda, 'precioMin' | 'precioMax'> | undefined): Limites | null {
  if (f?.precioMin == null || f.precioMax == null) return null
  return { min: Math.min(f.precioMin, f.precioMax), max: Math.max(f.precioMin, f.precioMax) }
}

const limitar = (v: number, { min, max }: Limites) => Math.min(max, Math.max(min, v))

/** Un paso arriba: al siguiente múltiplo de 1.000 (o al máximo real). */
export function pasoArriba(v: number, l: Limites, pasos = 1): number {
  let r = v
  for (let i = 0; i < pasos && r < l.max; i++) r = Math.min(l.max, Math.floor(r / PASO_PRECIO) * PASO_PRECIO + PASO_PRECIO)
  return r
}

/** Un paso abajo: al múltiplo de 1.000 anterior (o al mínimo real). */
export function pasoAbajo(v: number, l: Limites, pasos = 1): number {
  let r = v
  for (let i = 0; i < pasos && r > l.min; i++) r = Math.max(l.min, Math.ceil(r / PASO_PRECIO) * PASO_PRECIO - PASO_PRECIO)
  return r
}

/** Valor más cercano a una posición (0 a 1) de la barra: un múltiplo de 1.000 o uno de los extremos reales. */
export function valorEnPosicion(fraccion: number, l: Limites): number {
  const bruto = l.min + Math.min(1, Math.max(0, fraccion)) * (l.max - l.min)
  const candidatos = [l.min, l.max, limitar(Math.round(bruto / PASO_PRECIO) * PASO_PRECIO, l)]
  return candidatos.reduce((mejor, c) => (Math.abs(c - bruto) < Math.abs(mejor - bruto) ? c : mejor))
}

/** Rango elegido dentro de los límites (sin filtro = los extremos). */
export function rangoElegido(f: Pick<Filtros, 'precioMin' | 'precioMax'>, l: Limites): [number, number] {
  const bajo = limitar(f.precioMin ?? l.min, l)
  const alto = limitar(f.precioMax ?? l.max, l)
  return bajo <= alto ? [bajo, alto] : [alto, bajo]
}

/** Del rango al filtro: en los extremos no se envía min ni max ("Cualquier precio"). */
export function filtroDeRango([bajo, alto]: [number, number], l: Limites): Pick<Filtros, 'precioMin' | 'precioMax'> {
  return { precioMin: bajo > l.min ? bajo : undefined, precioMax: alto < l.max ? alto : undefined }
}

/**
 * Recorta el precio elegido a los límites de ese día y esa ruta. Sin viajes o con un solo precio se quita el filtro
 * de precio; si los límites aún no llegan, los filtros quedan como están.
 */
export function recortarPrecio(f: Filtros, facetas: Pick<FacetasBusqueda, 'precioMin' | 'precioMax'> | undefined): Filtros {
  if (!facetas || (f.precioMin == null && f.precioMax == null)) return f
  const l = limitesDe(facetas)
  const precio = l && l.min < l.max ? filtroDeRango(rangoElegido(f, l), l) : { precioMin: undefined, precioMax: undefined }
  if (precio.precioMin === f.precioMin && precio.precioMax === f.precioMax) return f
  return { ...f, ...precio }
}

/* ------------------------------------------------------------------ empresas */

export const OTRAS_TERMINALES = 'Otras'
const ORDEN_TERMINALES = ['terminal salitre', 'terminal del norte']

export function esBogota(ciudad: string): boolean {
  return normalizar(ciudad).startsWith('bogota')
}

export type GrupoEmpresas = { terminal: string | null; empresas: EmpresaFaceta[] }

/**
 * Empresas que coinciden con el texto. Si el origen es Bogotá, agrupadas por terminal (Salitre, del Norte, las demás
 * por nombre y "Otras" para las que no tienen); si no, un solo grupo sin título. Dentro de cada grupo, por nombre.
 */
export function agruparEmpresas(empresas: EmpresaFaceta[], origen: string, texto = ''): GrupoEmpresas[] {
  const q = normalizar(texto)
  const visibles = empresas.filter((e) => !q || normalizar(e.nombre).includes(q))
  if (visibles.length === 0) return []
  if (!esBogota(origen)) return [{ terminal: null, empresas: visibles }]
  const grupos = new Map<string, EmpresaFaceta[]>()
  for (const e of visibles) {
    const clave = e.terminal?.trim() || OTRAS_TERMINALES
    grupos.set(clave, [...(grupos.get(clave) ?? []), e])
  }
  const rango = (t: string) => {
    if (t === OTRAS_TERMINALES) return ORDEN_TERMINALES.length + 1
    const i = ORDEN_TERMINALES.indexOf(normalizar(t))
    return i === -1 ? ORDEN_TERMINALES.length : i
  }
  return [...grupos.entries()]
    .sort(([a], [b]) => rango(a) - rango(b) || a.localeCompare(b, 'es'))
    .map(([terminal, lista]) => ({ terminal, empresas: lista }))
}

const NOMBRES_BUS: Record<string, string> = { UN_PISO: 'Un piso', DOS_PISOS: 'Dos pisos' }

/** "UN_PISO" → "Un piso"; un tipo desconocido se muestra legible ("MINI_VAN" → "Mini van"). */
export function nombreTipoBus(tipo: string): string {
  if (NOMBRES_BUS[tipo]) return NOMBRES_BUS[tipo]
  const t = tipo.replace(/_/g, ' ').toLowerCase()
  return t.charAt(0).toUpperCase() + t.slice(1)
}
