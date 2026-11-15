import type { CategoriaAsiento, CeldaEditable, Distribucion, PisoEditable, TipoCelda } from '@/lib/tipos'

/** Lo que se "pinta" al tocar una celda del editor. */
export type Herramienta = { tipo: TipoCelda; categoria?: CategoriaAsiento }

export const TIPOS_CELDA: { valor: TipoCelda; texto: string }[] = [
  { valor: 'ASIENTO', texto: 'Asiento' },
  { valor: 'PASILLO', texto: 'Pasillo' },
  { valor: 'BANO', texto: 'Baño' },
  { valor: 'CONDUCTOR', texto: 'Conductor' },
  { valor: 'ESCALERA', texto: 'Escalera' },
  { valor: 'PUERTA', texto: 'Puerta' },
  { valor: 'VACIO', texto: 'Vacío' },
]

export function celdaEn(piso: PisoEditable, fila: number, columna: number): CeldaEditable | undefined {
  return piso.celdas.find((c) => c.fila === fila && c.columna === columna)
}

/** Pinta una celda; VACIO la quita. Un asiento nuevo queda sin número hasta `numerar`. */
export function pintar(d: Distribucion, indicePiso: number, fila: number, columna: number, h: Herramienta): Distribucion {
  return {
    ...d,
    pisos: d.pisos.map((p, i) => {
      if (i !== indicePiso) return p
      const resto = p.celdas.filter((c) => !(c.fila === fila && c.columna === columna))
      if (h.tipo === 'VACIO') return { ...p, celdas: resto }
      const previa = celdaEn(p, fila, columna)
      const celda: CeldaEditable =
        h.tipo === 'ASIENTO'
          ? { fila, columna, tipo: 'ASIENTO', asiento: previa?.tipo === 'ASIENTO' ? previa.asiento : undefined, categoria: h.categoria ?? 'ESTANDAR' }
          : { fila, columna, tipo: h.tipo }
      return { ...p, celdas: [...resto, celda] }
    }),
  }
}

/** Cambia filas y columnas de un piso; se descartan las celdas que quedan por fuera. */
export function redimensionar(d: Distribucion, indicePiso: number, filas: number, columnas: number): Distribucion {
  const f = Math.max(1, Math.min(30, Math.round(filas)))
  const c = Math.max(1, Math.min(8, Math.round(columnas)))
  return {
    ...d,
    pisos: d.pisos.map((p, i) => (i === indicePiso ? { ...p, filas: f, columnas: c, celdas: p.celdas.filter((x) => x.fila <= f && x.columna <= c) } : p)),
  }
}

/**
 * Numera los asientos que no tienen número (siguiendo los que ya existen) y recalcula la capacidad. Los números
 * existentes no cambian: así los tiquetes vendidos siguen apuntando al mismo puesto.
 */
export function numerar(d: Distribucion): Distribucion {
  const usados = new Set(d.pisos.flatMap((p) => p.celdas.filter((c) => c.tipo === 'ASIENTO' && c.asiento).map((c) => c.asiento!)))
  let siguiente = 1
  const nuevo = () => {
    while (usados.has(String(siguiente))) siguiente++
    usados.add(String(siguiente))
    return String(siguiente)
  }
  const pisos = d.pisos.map((p) => ({
    ...p,
    celdas: [...p.celdas]
      .sort((a, b) => a.fila - b.fila || a.columna - b.columna)
      .map((c) => (c.tipo === 'ASIENTO' && !c.asiento ? { ...c, asiento: nuevo() } : c)),
  }))
  return { ...d, pisos, capacidad: pisos.reduce((n, p) => n + p.celdas.filter((c) => c.tipo === 'ASIENTO').length, 0) }
}
