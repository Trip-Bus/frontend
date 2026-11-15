import type { Celda, EstadosAsientos, MapaAsientos, TipoCelda, Uuid } from '@/lib/tipos'

/**
 * Une la distribución real del bus (Catalog: GET /itineraries/{id}/seatmap) con el estado de
 * cada puesto (Seat Inventory: GET /seats/itineraries/{id} + WebSocket) en algo fácil de pintar.
 */

export type EstadoPuesto = 'libre' | 'tuyo' | 'ocupandose' | 'vendido' | 'oferta' | 'sin-dato'
export type Ubicacion = 'ventana' | 'pasillo' | 'centro'

export type Puesto = {
  numero: string
  estado: EstadoPuesto
  ubicacion: Ubicacion
  offerId: Uuid | null
}

export type CeldaVista = {
  clave: string
  fila: number
  columna: number
  tipo: TipoCelda
  puesto: Puesto | null
}

export type PisoVista = {
  piso: number
  columnas: number
  filas: number
  celdas: CeldaVista[]
  libres: number
}

export const NOMBRE_ESTADO: Record<EstadoPuesto, string> = {
  libre: 'libre',
  tuyo: 'apartado para ti',
  ocupandose: 'alguien lo está apartando',
  vendido: 'vendido',
  oferta: 'en oferta relámpago',
  'sin-dato': 'sin información',
}

function ubicacionDe(c: Celda, celdasFila: Celda[], minCol: number, maxCol: number): Ubicacion {
  if (c.columna === minCol || c.columna === maxCol) return 'ventana'
  const vecinas = celdasFila.filter((x) => Math.abs(x.columna - c.columna) === 1)
  return vecinas.some((x) => x.tipo === 'PASILLO') ? 'pasillo' : 'centro'
}

export function construirPisos(
  mapa: MapaAsientos,
  estados: EstadosAsientos | undefined,
  mios: ReadonlySet<string> = new Set(),
): PisoVista[] {
  const porNumero = new Map((estados?.asientos ?? []).map((a) => [a.seatNumber, a]))

  return [...mapa.distribucion.pisos]
    .sort((a, b) => a.piso - b.piso)
    .map((p) => {
      const cols = p.celdas.map((c) => c.columna)
      const filasN = p.celdas.map((c) => c.fila)
      const minCol = Math.min(...cols)
      const maxCol = Math.max(...cols)
      const minFila = Math.min(...filasN)
      const maxFila = Math.max(...filasN)
      let libres = 0

      const celdas = p.celdas
        .slice()
        .sort((a, b) => a.fila - b.fila || a.columna - b.columna)
        .map((c): CeldaVista => {
          let puesto: Puesto | null = null
          if (c.tipo === 'ASIENTO' && c.asiento) {
            const v = porNumero.get(c.asiento)
            let estado: EstadoPuesto = 'sin-dato'
            if (mios.has(c.asiento)) estado = 'tuyo'
            else if (v) {
              estado =
                v.estado === 'DISPONIBLE'
                  ? 'libre'
                  : v.estado === 'RETENIDO'
                    ? v.propio
                      ? 'tuyo'
                      : 'ocupandose'
                    : v.estado === 'EN_OFERTA'
                      ? 'oferta'
                      : 'vendido'
            }
            if (estado === 'libre') libres++
            puesto = {
              numero: c.asiento,
              estado,
              ubicacion: ubicacionDe(c, p.celdas.filter((x) => x.fila === c.fila), minCol, maxCol),
              offerId: v?.offerId ?? null,
            }
          }
          return {
            clave: `${p.piso}-${c.fila}-${c.columna}`,
            fila: c.fila - minFila + 1,
            columna: c.columna - minCol + 1,
            tipo: c.tipo,
            puesto,
          }
        })

      return { piso: p.piso, columnas: maxCol - minCol + 1, filas: maxFila - minFila + 1, celdas, libres }
    })
}

/** El puesto libre más cercano a `numero` (misma fila primero, luego filas vecinas). */
export function libreMasCercano(pisos: PisoVista[], numero: string): Puesto | null {
  for (const piso of pisos) {
    const origen = piso.celdas.find((c) => c.puesto?.numero === numero)
    if (!origen) continue
    const candidatas = piso.celdas
      .filter((c) => c.puesto?.estado === 'libre' && c.puesto.numero !== numero)
      .map((c) => ({
        c,
        d: Math.abs(c.fila - origen.fila) * 10 + Math.abs(c.columna - origen.columna) + (c.puesto?.ubicacion === origen.puesto?.ubicacion ? 0 : 0.5),
      }))
      .sort((a, b) => a.d - b.d)
    return candidatas[0]?.c.puesto ?? null
  }
  return null
}

/** Aplica al vuelo un evento del tópico de asientos si trae lo necesario; si no, devuelve null. */
export function aplicarEvento(
  estados: EstadosAsientos,
  evento: string,
  data: unknown,
): EstadosAsientos | null {
  const d = data as { seatNumbers?: unknown; seatNumber?: unknown; estado?: unknown } | null
  const numeros = Array.isArray(d?.seatNumbers)
    ? (d.seatNumbers as unknown[]).map(String)
    : typeof d?.seatNumber === 'string'
      ? [d.seatNumber]
      : null
  const nuevo =
    evento === 'SeatHeld'
      ? 'RETENIDO'
      : evento === 'SeatSold'
        ? 'VENDIDO'
        : evento === 'SeatReleased' || evento === 'HoldExpired'
          ? 'DISPONIBLE'
          : null
  if (!numeros || !nuevo) return null
  const set = new Set(numeros)
  return {
    ...estados,
    asientos: estados.asientos.map((a) => (set.has(a.seatNumber) ? { ...a, estado: nuevo, propio: false } : a)),
  }
}
