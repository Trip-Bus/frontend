/**
 * Formatos para Colombia. Todo pasa por Intl (nunca separadores ni plurales hechos a mano):
 * así "1 salida" / "2 salidas" y "$85.000" salen bien siempre (skill "break-ui").
 */

export const ZONA = 'America/Bogota'
const LOCALE = 'es-CO'

const pesos = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
})

/** 85000 → "$ 85.000" normalizado a "$85.000" (más compacto en pantallas pequeñas). */
export function dinero(valor: number | null | undefined): string {
  if (valor == null || !Number.isFinite(valor)) return '—'
  return pesos.format(valor).replace(/\s/g, '')
}

/** 85000 → "$85k" para chips pequeños (nunca para totales ni pagos). */
export function dineroCorto(valor: number | null | undefined): string {
  if (valor == null || !Number.isFinite(valor)) return '—'
  if (valor >= 1_000_000) return `$${(valor / 1_000_000).toLocaleString(LOCALE, { maximumFractionDigits: 1 })}M`
  return `$${Math.round(valor / 1000)}k`
}

const hora = new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: ZONA })

/** ISO (UTC) → "05:30" en hora de Colombia. */
export function horaCorta(iso: string): string {
  return hora.format(new Date(iso))
}

const diaCorto = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', day: 'numeric', month: 'short', timeZone: ZONA })

/** ISO o Date → "vie 9 oct" */
export function fechaCorta(fecha: string | Date): string {
  return diaCorto
    .format(typeof fecha === 'string' ? new Date(fecha) : fecha)
    .replace(/\./g, '')
    .replace(/,/g, '')
    .replace(/ de /g, ' ')
}

/** Date → "2026-10-09" en hora de Colombia (lo que espera GET /trips/search?date=). */
export function fechaParaApi(fecha: Date): string {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(fecha)
  const v = (t: string) => partes.find((p) => p.type === t)?.value ?? ''
  return `${v('year')}-${v('month')}-${v('day')}`
}

/** "2026-10-09" (día de Colombia) → Date al mediodía de ese día, seguro para formatear. */
export function fechaDesdeApi(ymd: string): Date {
  return new Date(`${ymd}T12:00:00-05:00`)
}

/** Suma días a una fecha YYYY-MM-DD. */
export function sumarDias(ymd: string, dias: number): string {
  const d = fechaDesdeApi(ymd)
  d.setUTCDate(d.getUTCDate() + dias)
  return fechaParaApi(d)
}

/** 520 → "8 h 40"; 45 → "45 min" */
export function duracion(minutos: number): string {
  if (!Number.isFinite(minutos) || minutos < 0) return '—'
  const h = Math.floor(minutos / 60)
  const m = Math.round(minutos % 60)
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`
}

/** ¿La llegada cae en un día distinto (hora de Colombia) a la salida? → "+1" */
export function diasDespues(salidaIso: string, llegadaIso: string): number {
  const a = fechaDesdeApi(fechaParaApi(new Date(salidaIso)))
  const b = fechaDesdeApi(fechaParaApi(new Date(llegadaIso)))
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

/** 125 → "2:05" (cuenta regresiva de la retención) */
export function reloj(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const reglas = new Intl.PluralRules(LOCALE)

/** plural(1, "salida", "salidas") → "1 salida" */
export function plural(n: number, uno: string, varios: string): string {
  return `${n.toLocaleString(LOCALE)} ${reglas.select(n) === 'one' ? uno : varios}`
}

/** Iniciales por grafemas (emoji, tildes y nombres de una palabra incluidos). */
export function iniciales(nombre: string | null | undefined): string {
  const palabras = (nombre ?? '').trim().split(/\s+/).filter(Boolean)
  if (palabras.length === 0) return '?'
  const primera = (p: string) => {
    const seg = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(LOCALE, { granularity: 'grapheme' }) : null
    const g = seg ? seg.segment(p)[Symbol.iterator]().next().value?.segment : Array.from(p)[0]
    return (g ?? '').toLocaleUpperCase(LOCALE)
  }
  const ultima = palabras.length > 1 ? palabras[palabras.length - 1] : ''
  return primera(palabras[0]) + (ultima ? primera(ultima) : '')
}

/** "bogota" → "Bogotá" si está en la lista de ciudades; si no, capitaliza. */
export function nombreCiudad(entrada: string, ciudades: string[] = []): string {
  const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
  const hit = ciudades.find((c) => norm(c) === norm(entrada))
  if (hit) return hit
  const t = entrada.trim()
  return t ? t[0].toLocaleUpperCase(LOCALE) + t.slice(1) : t
}
