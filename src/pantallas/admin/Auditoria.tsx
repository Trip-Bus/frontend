import { useState } from 'react'
import { CargarMas, Resultado } from '@/components/marca/Consulta'
import { PantallaGestion } from '@/components/marca/PantallaGestion'
import { Selector } from '@/components/ui/campos'
import { Campo } from '@/components/ui/input'
import { usePaginado } from '@/features/paginacion'
import { api } from '@/lib/endpoints'
import { fechaHora } from '@/lib/formato'
import type { AccionAuditoria, RegistroAuditoria } from '@/lib/tipos'

const ACCIONES: { valor: AccionAuditoria; texto: string }[] = [
  { valor: 'CREAR_USUARIO', texto: 'Crear usuario' },
  { valor: 'CAMBIAR_ROL', texto: 'Cambiar rol' },
  { valor: 'SUSPENDER', texto: 'Suspender' },
  { valor: 'REACTIVAR', texto: 'Reactivar' },
  { valor: 'DESBLOQUEAR', texto: 'Desbloquear' },
  { valor: 'ELIMINAR_CUENTA', texto: 'Eliminar cuenta' },
]

/** "2026-11-03" → inicio de ese día en Colombia, en ISO (el backend filtra por instante). */
const inicioDelDia = (ymd: string) => (ymd ? new Date(`${ymd}T00:00:00-05:00`).toISOString() : undefined)

function Cambios({ datos }: { datos: Record<string, unknown> | null }) {
  if (!datos || Object.keys(datos).length === 0) return <span className="text-texto-2">—</span>
  return (
    <dl className="flex flex-col">
      {Object.entries(datos).map(([k, v]) => (
        <div key={k} className="flex gap-1">
          <dt className="text-texto-2">{k}:</dt>
          <dd className="font-medium [overflow-wrap:anywhere]">{String(v)}</dd>
        </div>
      ))}
    </dl>
  )
}

/** A-03 Auditoría (US-105): acciones administrativas sobre cuentas, con el antes y el después. */
export function Auditoria() {
  const [filtro, setFiltro] = useState({ accion: '', actorId: '', targetUserId: '', desde: '', hasta: '' })
  const { consulta, elementos, total } = usePaginado<RegistroAuditoria>(['auditoria', filtro], (page) =>
    api.usuarios.auditoria({
      accion: (filtro.accion || undefined) as AccionAuditoria | undefined,
      actorId: filtro.actorId.trim() || undefined,
      targetUserId: filtro.targetUserId.trim() || undefined,
      desde: inicioDelDia(filtro.desde),
      hasta: filtro.hasta ? new Date(new Date(`${filtro.hasta}T00:00:00-05:00`).getTime() + 86_400_000).toISOString() : undefined,
      page,
      size: 20,
    }),
  )
  const cambiar = (parcial: Partial<typeof filtro>) => setFiltro((f) => ({ ...f, ...parcial }))
  return (
    <PantallaGestion titulo="Auditoría" descripcion="Quién hizo qué sobre las cuentas, del más reciente al más antiguo.">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Selector etiqueta="Acción" vacia="Todas" value={filtro.accion} onChange={(e) => cambiar({ accion: e.target.value })} opciones={ACCIONES} />
        <Campo etiqueta="Quién (id)" value={filtro.actorId} onChange={(e) => cambiar({ actorId: e.target.value })} />
        <Campo etiqueta="Sobre quién (id)" value={filtro.targetUserId} onChange={(e) => cambiar({ targetUserId: e.target.value })} />
        <Campo etiqueta="Desde" type="date" value={filtro.desde} onChange={(e) => cambiar({ desde: e.target.value })} />
        <Campo etiqueta="Hasta" type="date" value={filtro.hasta} onChange={(e) => cambiar({ hasta: e.target.value })} />
      </div>
      <Resultado consulta={consulta} hayDatos={elementos.length > 0} vacio="No hay registros con esos filtros.">
        <ul className="flex flex-col gap-2">
          {elementos.map((r) => (
            <li key={r.id} className="flex flex-col gap-2 rounded-tarjeta bg-superficie p-4 text-[14px]">
              <span className="flex flex-wrap justify-between gap-2">
                <span className="font-semibold">{ACCIONES.find((a) => a.valor === r.accion)?.texto ?? r.accion}</span>
                <span className="text-texto-2">{fechaHora(r.creadoEn)}</span>
              </span>
              <span className="num text-[12px] text-texto-2 [overflow-wrap:anywhere]">
                Por {r.actorId}
                {r.targetUserId ? ` sobre ${r.targetUserId}` : ''}
              </span>
              {r.motivo && <span>Motivo: {r.motivo}</span>}
              <div className="grid gap-2 md:grid-cols-2">
                <div className="rounded-[12px] bg-fondo p-2">
                  <span className="text-[12px] font-semibold">Antes</span>
                  <Cambios datos={r.antes} />
                </div>
                <div className="rounded-[12px] bg-fondo p-2">
                  <span className="text-[12px] font-semibold">Después</span>
                  <Cambios datos={r.despues} />
                </div>
              </div>
            </li>
          ))}
        </ul>
        <CargarMas hay={!!consulta.hasNextPage} cargando={consulta.isFetchingNextPage} alCargar={() => consulta.fetchNextPage()} mostrados={elementos.length} total={total} />
      </Resultado>
    </PantallaGestion>
  )
}
