import { useQuery } from '@tanstack/react-query'
import { FileDown } from 'lucide-react'
import { useState } from 'react'
import { Resultado } from '@/components/marca/Consulta'
import { Aviso } from '@/components/marca/Estados'
import { PantallaGestion } from '@/components/marca/PantallaGestion'
import { Tabla, type Columna } from '@/components/marca/Tabla'
import { Button } from '@/components/ui/button'
import { Campo } from '@/components/ui/input'
import { useDescargar } from '@/hooks/useDescargar'
import { api } from '@/lib/endpoints'
import { dinero, mesActual } from '@/lib/formato'
import type { FilaPlataforma } from '@/lib/tipos'

const COLUMNAS: Columna<FilaPlataforma>[] = [
  { titulo: 'Empresa', valor: (f) => f.empresa },
  { titulo: 'Tiquetes', valor: (f) => f.tiquetes, numerico: true },
  { titulo: 'Cuota mensual', valor: (f) => (f.cuotaMensual == null ? 'sin dato' : dinero(f.cuotaMensual)), numerico: true },
  { titulo: 'Comisión', valor: (f) => dinero(f.comision), numerico: true },
  { titulo: 'Total a cobrar', valor: (f) => (f.totalACobrar == null ? 'sin dato' : dinero(f.totalACobrar)), numerico: true },
]

/** A-05 Facturación (US-190): lo que cada empresa paga a TripBus en el mes (cuota + comisión), con CSV. */
export function Facturacion() {
  const [mes, setMes] = useState(mesActual())
  const descargar = useDescargar()
  const q = useQuery({ queryKey: ['facturacion', mes], queryFn: () => api.reportes.plataforma(mes) })
  const r = q.data
  return (
    <PantallaGestion titulo="Facturación" descripcion="Cuota mensual vigente el día 1 más la comisión de las ventas del mes.">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-48">
          <Campo etiqueta="Mes" type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} />
        </div>
        <Button variante="contorno" disabled={descargar.isPending} onClick={() => descargar.mutate({ pedir: () => api.reportes.plataformaCsv(mes), nombre: `plataforma_${mes}.csv` })}>
          <FileDown className="size-5" aria-hidden="true" />
          CSV
        </Button>
      </div>
      <Resultado consulta={q} hayDatos={(r?.empresas.length ?? 0) > 0} vacio="No hay empresas con reservas en ese mes.">
        {r && (
          <>
            {r.incompleto && <Aviso tono="alerta">Faltan las condiciones de alguna empresa: su cuota y su total quedan sin dato.</Aviso>}
            <Tabla
              titulo={`Facturación de ${r.mes}`}
              columnas={COLUMNAS}
              filas={r.empresas}
              clave={(f) => f.companyId}
              pie={{ companyId: 'total', empresa: 'Total plataforma', tiquetes: r.tiquetes, cuotaMensual: r.cuotas, comision: r.comisiones, totalACobrar: r.total }}
            />
          </>
        )}
      </Resultado>
    </PantallaGestion>
  )
}
