import { useQuery } from '@tanstack/react-query'
import { FileDown } from 'lucide-react'
import { useState } from 'react'
import { Resultado } from '@/components/marca/Consulta'
import { Aviso } from '@/components/marca/Estados'
import { PantallaGestion } from '@/components/marca/PantallaGestion'
import { Tabla, type Columna } from '@/components/marca/Tabla'
import { Button } from '@/components/ui/button'
import { Segmentos, Selector } from '@/components/ui/campos'
import { Campo } from '@/components/ui/input'
import { hoy } from '@/features/busqueda'
import { useEmpresaActiva } from '@/features/empresa'
import { useDescargar } from '@/hooks/useDescargar'
import { api } from '@/lib/endpoints'
import { dinero, porcentaje, sumarDias } from '@/lib/formato'
import type { AgrupacionVentas, FilaVentas, ReportePuntualidad } from '@/lib/tipos'

const COLUMNAS_VENTAS: Columna<FilaVentas>[] = [
  { titulo: 'Grupo', valor: (f) => f.grupo },
  { titulo: 'Tiquetes', valor: (f) => f.tiquetesVendidos, numerico: true },
  { titulo: 'Ingresos brutos', valor: (f) => dinero(f.ingresosBrutos), numerico: true },
  { titulo: 'Cupones', valor: (f) => dinero(f.descuentoCupones), numerico: true },
  { titulo: 'Reembolsos', valor: (f) => dinero(f.reembolsos), numerico: true },
  { titulo: 'Netos', valor: (f) => dinero(f.ingresosNetos), numerico: true },
  { titulo: 'Comisión TripBus', valor: (f) => dinero(f.comisionTripBus), numerico: true },
  { titulo: 'Neto empresa', valor: (f) => dinero(f.netoEmpresa), numerico: true },
]

type Grupo = ReportePuntualidad['grupos'][number]
const min = (v: number | null) => (v == null ? 'sin dato' : `${v.toLocaleString('es-CO', { maximumFractionDigits: 1 })} min`)
const COLUMNAS_PUNTUALIDAD: Columna<Grupo>[] = [
  { titulo: 'Nombre', valor: (g) => g.nombre },
  { titulo: 'Viajes', valor: (g) => g.viajes, numerico: true },
  { titulo: 'Retraso salida', valor: (g) => min(g.retrasoPromedioSalidaMin), numerico: true },
  { titulo: 'Retraso llegada', valor: (g) => min(g.retrasoPromedioLlegadaMin), numerico: true },
  { titulo: 'Viajes a tiempo', valor: (g) => porcentaje(g.porcentajeViajesATiempo), numerico: true },
  { titulo: 'Paradas a tiempo', valor: (g) => porcentaje(g.porcentajeParadasATiempo), numerico: true },
]

/**
 * O-12 Reportes (US-190, US-193): ventas, ingresos y comisión agrupados por día, ruta, medio de pago o canal (con
 * CSV), y puntualidad por ruta o conductor. Las fechas son días de Colombia (America/Bogota), ambas incluidas.
 */
export function Reportes() {
  const { companyId, esAdmin } = useEmpresaActiva()
  const empresa = esAdmin ? companyId : undefined
  const [vista, setVista] = useState<'ventas' | 'puntualidad'>('ventas')
  const [desde, setDesde] = useState(sumarDias(hoy(), -30))
  const [hasta, setHasta] = useState(hoy())
  const [agrupar, setAgrupar] = useState<AgrupacionVentas>('dia')
  const [porQuien, setPorQuien] = useState<'ruta' | 'conductor'>('ruta')
  const descargar = useDescargar()
  const ventas = useQuery({ queryKey: ['reporte-ventas', empresa ?? null, desde, hasta, agrupar], queryFn: () => api.reportes.ventas(desde, hasta, agrupar, empresa), enabled: vista === 'ventas' })
  const puntualidad = useQuery({ queryKey: ['reporte-puntualidad', empresa ?? null, desde, hasta, porQuien], queryFn: () => api.reportes.puntualidad(desde, hasta, porQuien, empresa), enabled: vista === 'puntualidad' })
  const columnas = agrupar === 'ruta' ? [...COLUMNAS_VENTAS, { titulo: 'Ocupación', valor: (f: FilaVentas) => porcentaje(f.ocupacionPromedio), numerico: true }] : COLUMNAS_VENTAS

  return (
    <PantallaGestion titulo="Reportes" descripcion="Fechas en hora de Colombia, ambas incluidas (máximo 366 días)." requiereEmpresa>
      <Segmentos etiqueta="Reporte" rol="tablist" valor={vista} alCambiar={setVista} opciones={[{ valor: 'ventas', texto: 'Ventas' }, { valor: 'puntualidad', texto: 'Puntualidad' }]} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Campo etiqueta="Desde" type="date" value={desde} onChange={(e) => e.target.value && setDesde(e.target.value)} />
        <Campo etiqueta="Hasta" type="date" value={hasta} onChange={(e) => e.target.value && setHasta(e.target.value)} />
        {vista === 'ventas' ? (
          <Selector
            etiqueta="Agrupar por"
            value={agrupar}
            onChange={(e) => setAgrupar(e.target.value as AgrupacionVentas)}
            opciones={[
              { valor: 'dia', texto: 'Día' },
              { valor: 'ruta', texto: 'Ruta' },
              { valor: 'metodo', texto: 'Medio de pago' },
              { valor: 'canal', texto: 'Canal' },
            ]}
          />
        ) : (
          <Selector etiqueta="Agrupar por" value={porQuien} onChange={(e) => setPorQuien(e.target.value as 'ruta' | 'conductor')} opciones={[{ valor: 'ruta', texto: 'Ruta' }, { valor: 'conductor', texto: 'Conductor' }]} />
        )}
        {vista === 'ventas' && (
          <Button
            variante="contorno"
            className="self-end"
            disabled={descargar.isPending}
            onClick={() => descargar.mutate({ pedir: () => api.reportes.ventasCsv(desde, hasta, agrupar, empresa), nombre: `ventas_${desde}_${hasta}.csv` })}
          >
            <FileDown className="size-5" aria-hidden="true" />
            CSV
          </Button>
        )}
      </div>
      {vista === 'ventas' ? (
        <Resultado consulta={ventas} hayDatos={(ventas.data?.grupos.length ?? 0) > 0} vacio="No hubo ventas en esas fechas.">
          {ventas.data && (
            <>
              {ventas.data.ventasSinComision > 0 && <Aviso>{ventas.data.ventasSinComision} ventas aún no tienen la comisión registrada: se completa en unos minutos.</Aviso>}
              <Tabla titulo="Ventas" columnas={columnas} filas={ventas.data.grupos} clave={(f) => f.grupo} pie={{ ...ventas.data.totales, grupo: 'Total' }} />
            </>
          )}
        </Resultado>
      ) : (
        <Resultado consulta={puntualidad} hayDatos={(puntualidad.data?.grupos.length ?? 0) > 0} vacio="No hay viajes terminados en esas fechas.">
          {puntualidad.data && <Tabla titulo="Puntualidad" columnas={COLUMNAS_PUNTUALIDAD} filas={puntualidad.data.grupos} clave={(g, i) => g.routeId ?? g.conductorId ?? String(i)} />}
        </Resultado>
      )}
    </PantallaGestion>
  )
}
