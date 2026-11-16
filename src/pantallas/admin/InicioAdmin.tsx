import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { PantallaGestion } from '@/components/marca/PantallaGestion'

const SECCIONES = [
  { a: '/admin/usuarios', titulo: 'Usuarios', texto: 'Crea operadores y conductores, cambia roles, suspende o desbloquea cuentas.' },
  { a: '/admin/empresas', titulo: 'Empresas', texto: 'Empresas transportadoras, su estado y sus condiciones comerciales.' },
  { a: '/admin/facturacion', titulo: 'Facturación', texto: 'Lo que cada empresa paga a TripBus en el mes: cuota y comisión.' },
  { a: '/admin/auditoria', titulo: 'Auditoría', texto: 'Quién cambió qué en las cuentas, con el antes y el después.' },
  { a: '/admin/terminales', titulo: 'Terminales', texto: 'Terminales de transporte que usan las paradas de las rutas.' },
  { a: '/operador', titulo: 'Pantallas del operador', texto: 'Elige una empresa y administra sus viajes, flota, ofertas y reportes.' },
]

/** Inicio del administrador de la plataforma. */
export function InicioAdmin() {
  return (
    <PantallaGestion titulo="Administración" descripcion="Todo lo de la plataforma TripBus en un solo lugar.">
      <ul className="grid gap-2.5 md:grid-cols-2">
        {SECCIONES.map((x) => (
          <li key={x.a}>
            <Link to={x.a} className="tap flex items-center gap-3 rounded-tarjeta bg-superficie p-4">
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-semibold">{x.titulo}</span>
                <span className="text-[14px] text-texto-2">{x.texto}</span>
              </span>
              <ChevronRight className="size-5 shrink-0" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </PantallaGestion>
  )
}
