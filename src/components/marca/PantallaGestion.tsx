import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { Selector } from '@/components/ui/campos'
import { conEmpresa, useEmpresaActiva } from '@/features/empresa'
import { useOpcionesEmpresas } from '@/features/opcionesGestion'
import { useAcento } from '@/hooks/useAcento'
import { useSesion } from '@/lib/sesion'
import { cn } from '@/lib/utils'
import { Aviso } from './Estados'
import { Pantalla } from './Pantalla'

type Seccion = { a: string; texto: string; soloAdmin?: boolean; soloOperador?: boolean }

const SECCIONES_OPERADOR: Seccion[] = [
  { a: '/operador', texto: 'Inicio' },
  { a: '/operador/viajes', texto: 'Viajes' },
  { a: '/operador/flota', texto: 'Flota' },
  { a: '/operador/buses', texto: 'Buses' },
  { a: '/operador/rutas', texto: 'Rutas' },
  { a: '/operador/ofertas', texto: 'Ofertas' },
  { a: '/operador/automaticas', texto: 'Automáticas' },
  { a: '/operador/tarifas', texto: 'Tarifas' },
  { a: '/operador/cupones', texto: 'Cupones' },
  { a: '/operador/taquilla', texto: 'Taquilla', soloOperador: true },
  { a: '/operador/reportes', texto: 'Reportes' },
]

const SECCIONES_ADMIN: Seccion[] = [
  { a: '/admin', texto: 'Admin' },
  { a: '/admin/usuarios', texto: 'Usuarios' },
  { a: '/admin/empresas', texto: 'Empresas' },
  { a: '/admin/facturacion', texto: 'Facturación' },
  { a: '/admin/auditoria', texto: 'Auditoría' },
  { a: '/admin/terminales', texto: 'Terminales' },
]

/**
 * Marco de las pantallas de la empresa y de la plataforma: título, navegación entre secciones y, para el
 * ADMIN en pantallas de operador, el selector de empresa (A-06). Móvil primero; en escritorio usa más ancho.
 */
export function PantallaGestion({
  titulo,
  descripcion,
  requiereEmpresa = false,
  acciones,
  children,
}: {
  titulo: string
  descripcion?: ReactNode
  /** Pantalla de operador: el ADMIN debe elegir una empresa antes de ver datos. */
  requiereEmpresa?: boolean
  acciones?: ReactNode
  children: ReactNode
}) {
  useAcento(null)
  const s = useSesion()
  const { pathname } = useLocation()
  const { companyId, esAdmin } = useEmpresaActiva()
  const secciones = [...(esAdmin ? SECCIONES_ADMIN : []), ...SECCIONES_OPERADOR].filter(
    (x) => !(x.soloOperador && s?.rol !== 'OPERADOR'),
  )

  return (
    <Pantalla amplia>
      <header className="flex flex-col gap-3 px-5">
        <nav aria-label="Secciones" className="carril -mx-5 gap-1.5 px-5">
          {secciones.map((x) => {
            const on = pathname === x.a
            return (
              <Link
                key={x.a}
                to={x.a.startsWith('/operador') ? conEmpresa(x.a, companyId) : x.a}
                aria-current={on ? 'page' : undefined}
                className={cn(
                  'tap flex h-9 shrink-0 items-center rounded-full px-3.5 text-[14px] font-semibold',
                  on ? 'bg-tinta text-white' : 'bg-superficie text-tinta',
                )}
              >
                {x.texto}
              </Link>
            )
          })}
          <Link to="/cuenta" className="tap flex h-9 shrink-0 items-center rounded-full bg-superficie px-3.5 text-[14px] font-semibold">
            Cuenta
          </Link>
        </nav>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-[28px] leading-[1.1] font-bold tracking-[-0.02em]">{titulo}</h1>
            {descripcion && <p className="mt-1 text-[15px] leading-snug text-texto-2">{descripcion}</p>}
          </div>
          {acciones}
        </div>
        {requiereEmpresa && esAdmin && <SelectorEmpresa />}
      </header>
      <div className="flex flex-1 flex-col gap-4 px-5 pt-4 pb-8">
        {requiereEmpresa && esAdmin && !companyId ? <Aviso>Elige una empresa para ver y administrar sus datos.</Aviso> : children}
      </div>
    </Pantalla>
  )
}

/** A-06: el ADMIN trabaja sobre la empresa que elija (queda en ?companyId=). */
export function SelectorEmpresa() {
  const { companyId, cambiar } = useEmpresaActiva()
  const empresas = useOpcionesEmpresas()
  return (
    <div className="max-w-md">
      <Selector
        etiqueta="Empresa"
        vacia={empresas.cargando ? 'Cargando empresas…' : 'Elige una empresa'}
        value={companyId ?? ''}
        onChange={(e) => cambiar(e.target.value || undefined)}
        opciones={empresas.opciones}
      />
    </div>
  )
}
