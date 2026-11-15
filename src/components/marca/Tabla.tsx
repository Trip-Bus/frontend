import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type Columna<T> = { titulo: string; valor: (fila: T) => ReactNode; numerico?: boolean }

/** Tabla de reportes: en el celular se desplaza de lado dentro de su caja (nunca la página completa). */
export function Tabla<T>({ titulo, columnas, filas, clave, pie }: { titulo: string; columnas: Columna<T>[]; filas: T[]; clave: (fila: T, i: number) => string; pie?: T }) {
  const celda = (c: Columna<T>, f: T) => <td key={c.titulo} className={cn('px-3 py-2 whitespace-nowrap', c.numerico && 'num text-right')}>{c.valor(f)}</td>
  return (
    <div className="overflow-x-auto rounded-tarjeta bg-superficie">
      <table className="w-full text-[14px]">
        <caption className="sr-only">{titulo}</caption>
        <thead>
          <tr className="border-b border-linea text-left text-[12px] text-texto-2">
            {columnas.map((c) => (
              <th key={c.titulo} scope="col" className={cn('px-3 py-2 font-semibold whitespace-nowrap', c.numerico && 'text-right')}>
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={clave(f, i)} className="border-b border-linea last:border-0">
              {columnas.map((c) => celda(c, f))}
            </tr>
          ))}
        </tbody>
        {pie && (
          <tfoot>
            <tr className="bg-fondo font-bold">
              {columnas.map((c) => celda(c, pie))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
