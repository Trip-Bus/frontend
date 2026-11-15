import type { UseQueryResult } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Casilla, Selector, type Opcion } from '@/components/ui/campos'
import { Hoja } from '@/components/ui/hoja'
import { Campo } from '@/components/ui/input'
import { useAccion } from '@/hooks/useAccion'
import type { Valores } from '@/features/valores'
import { Resultado } from './Consulta'
import { HojaMotivo } from './HojaMotivo'


export type CampoCatalogo = {
  clave: string
  etiqueta: string
  tipo: 'texto' | 'numero' | 'fecha' | 'fechaHora' | 'hora' | 'casilla' | 'seleccion'
  opciones?: Opcion[]
  ayuda?: string
  /** Si falta, el botón de guardar queda deshabilitado. */
  requerido?: boolean
}

type Props<T, D> = {
  /** Nombre en singular, en minúscula: "cupón", "terminal". */
  nombre: string
  consulta: UseQueryResult<T[]>
  clave: (t: T) => string
  resumen: (t: T) => { titulo: string; detalle?: string; etiqueta?: string }
  campos: CampoCatalogo[]
  aValores: (t: T | null) => Valores
  aDatos: (v: Valores) => D
  crear: (d: D) => Promise<unknown>
  editar?: (t: T, d: D) => Promise<unknown>
  borrar?: (t: T) => Promise<unknown>
  textoBorrar?: string
  invalidar: string[][]
  vacio: string
}

/**
 * Listado + formulario de los catálogos de gestión (terminales, cupones, temporadas, reglas y plantillas de
 * ofertas). Cada pantalla solo declara los campos y cómo convertirlos; los estados de carga, vacío y error,
 * la hoja, la confirmación de borrado y los avisos son los mismos en todas.
 */
export function Catalogo<T, D>(p: Props<T, D>) {
  const [editando, setEditando] = useState<T | 'nuevo' | null>(null)
  const lista = p.consulta.data ?? []
  return (
    <>
      <Button className="self-start" onClick={() => setEditando('nuevo')}>
        Agregar {p.nombre}
      </Button>
      <Resultado consulta={p.consulta} hayDatos={lista.length > 0} vacio={p.vacio}>
        <ul className="grid gap-2 md:grid-cols-2">
          {lista.map((t) => {
            const r = p.resumen(t)
            return (
              <li key={p.clave(t)}>
                <button type="button" onClick={() => setEditando(t)} className="tap flex w-full items-center justify-between gap-3 rounded-tarjeta bg-superficie p-4 text-left">
                  <span className="flex min-w-0 flex-col">
                    <span className="font-semibold [overflow-wrap:anywhere]">{r.titulo}</span>
                    {r.detalle && <span className="text-[13px] text-texto-2">{r.detalle}</span>}
                  </span>
                  {r.etiqueta && <span className="shrink-0 rounded-md bg-linea px-1.5 text-[12px] font-bold">{r.etiqueta}</span>}
                </button>
              </li>
            )
          })}
        </ul>
      </Resultado>
      {editando && <Formulario {...p} item={editando === 'nuevo' ? null : editando} alCerrar={() => setEditando(null)} />}
    </>
  )
}

function Formulario<T, D>({ item, alCerrar, ...p }: Props<T, D> & { item: T | null; alCerrar: () => void }) {
  const [v, setV] = useState<Valores>(() => p.aValores(item))
  const [borrando, setBorrando] = useState(false)
  const guardar = useAccion(() => (item && p.editar ? p.editar(item, p.aDatos(v)) : p.crear(p.aDatos(v))), { exito: 'Guardamos los cambios.', invalidar: p.invalidar, alTerminar: alCerrar })
  const borrar = useAccion(() => p.borrar!(item!), { exito: p.textoBorrar ?? 'Listo.', invalidar: p.invalidar, alTerminar: alCerrar })
  const completo = p.campos.every((c) => !c.requerido || (typeof v[c.clave] === 'string' ? String(v[c.clave]).trim() !== '' : true))
  const enviar = (e: FormEvent) => {
    e.preventDefault()
    if (completo) guardar.mutate(undefined)
  }
  const poner = (clave: string, valor: string | boolean) => setV((x) => ({ ...x, [clave]: valor }))
  return (
    <Hoja abierta alCambiar={(a) => !a && alCerrar()} titulo={item ? `Editar ${p.nombre}` : `Agregar ${p.nombre}`}>
      <form onSubmit={enviar} className="flex flex-col gap-3 pb-3" noValidate>
        {p.campos.map((c) => {
          if (c.tipo === 'casilla') return <Casilla key={c.clave} etiqueta={c.etiqueta} marcada={v[c.clave] === true} alCambiar={(x) => poner(c.clave, x)} />
          if (c.tipo === 'seleccion')
            return <Selector key={c.clave} etiqueta={c.etiqueta} vacia={c.requerido ? undefined : 'Ninguno'} value={String(v[c.clave] ?? '')} onChange={(e) => poner(c.clave, e.target.value)} opciones={c.opciones ?? []} />
          const tipo = { texto: 'text', numero: 'text', fecha: 'date', fechaHora: 'datetime-local', hora: 'time' }[c.tipo]
          return (
            <Campo
              key={c.clave}
              etiqueta={c.etiqueta}
              type={tipo}
              inputMode={c.tipo === 'numero' ? 'decimal' : undefined}
              ayuda={c.ayuda}
              value={String(v[c.clave] ?? '')}
              onChange={(e) => poner(c.clave, c.tipo === 'numero' ? e.target.value.replace(/[^\d.]/g, '') : e.target.value)}
            />
          )
        })}
        <Button type="submit" disabled={!completo || guardar.isPending}>
          {guardar.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
        {item && p.borrar && (
          <Button variante="fantasma" onClick={() => setBorrando(true)}>
            {p.textoBorrar ? 'Quitar' : 'Borrar'}
          </Button>
        )}
      </form>
      <HojaMotivo abierta={borrando} alCerrar={() => setBorrando(false)} titulo={`¿Quitar este ${p.nombre}?`} boton="Sí, quitar" ocupado={borrar.isPending} alConfirmar={() => borrar.mutate(undefined)} />
    </Hoja>
  )
}
