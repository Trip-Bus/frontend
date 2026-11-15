import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Catalogo } from '@/components/marca/Catalogo'
import { Resultado } from '@/components/marca/Consulta'
import { PantallaGestion } from '@/components/marca/PantallaGestion'
import { Button } from '@/components/ui/button'
import { Segmentos } from '@/components/ui/campos'
import { Campo } from '@/components/ui/input'
import { useEmpresaActiva } from '@/features/empresa'
import { useOpcionesRutas } from '@/features/opcionesGestion'
import { valor } from '@/features/valores'
import { useAccion } from '@/hooks/useAccion'
import { api } from '@/lib/endpoints'
import { fechaCorta, fechaDesdeApi } from '@/lib/formato'
import type { Temporada, TemporadaRequest } from '@/lib/tipos'

type Vista = 'temporadas' | 'pasajeros' | 'asientos'

/**
 * O-11 Tarifas (US-138, US-141): temporadas que multiplican el precio, descuento por tipo de pasajero (niño y
 * adulto mayor) y recargo por categoría de asiento.
 */
export function Tarifas() {
  const { companyId, esAdmin } = useEmpresaActiva()
  const empresa = esAdmin ? companyId : undefined
  const [vista, setVista] = useState<Vista>('temporadas')
  const rutas = useOpcionesRutas(companyId)
  const temporadas = useQuery({ queryKey: ['temporadas', empresa ?? null], queryFn: () => api.tarifas.temporadas(empresa), enabled: vista === 'temporadas' })
  const tipos = useQuery({ queryKey: ['tipos-pasajero', empresa ?? null], queryFn: () => api.tarifas.tiposPasajero(empresa), enabled: vista === 'pasajeros' })
  const recargos = useQuery({ queryKey: ['recargos', empresa ?? null], queryFn: () => api.tarifas.recargos(empresa), enabled: vista === 'asientos' })
  const deTipo = (t: string) => tipos.data?.find((x) => x.tipo === t)?.descuentoPorcentaje ?? 0
  const deCategoria = (c: string) => recargos.data?.find((x) => x.categoria === c)?.recargo ?? 0

  return (
    <PantallaGestion titulo="Tarifas" descripcion="Cómo se calcula el precio de cada pasaje." requiereEmpresa>
      <Segmentos<Vista>
        etiqueta="Sección"
        rol="tablist"
        valor={vista}
        alCambiar={setVista}
        opciones={[
          { valor: 'temporadas', texto: 'Temporadas' },
          { valor: 'pasajeros', texto: 'Tipo de pasajero' },
          { valor: 'asientos', texto: 'Asientos' },
        ]}
      />
      {vista === 'temporadas' && (
        <Catalogo<Temporada, TemporadaRequest>
          nombre="temporada"
          consulta={temporadas}
          clave={(t) => t.id}
          resumen={(t) => ({
            titulo: t.nombre,
            detalle: `${fechaCorta(fechaDesdeApi(t.desde))} a ${fechaCorta(fechaDesdeApi(t.hasta))} · × ${t.multiplicador.toLocaleString('es-CO')}${t.routeId ? ` · ${rutas.opciones.find((r) => r.valor === t.routeId)?.texto ?? 'una ruta'}` : ''}`,
          })}
          campos={[
            { clave: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true },
            { clave: 'desde', etiqueta: 'Desde', tipo: 'fecha', requerido: true },
            { clave: 'hasta', etiqueta: 'Hasta', tipo: 'fecha', requerido: true },
            { clave: 'multiplicador', etiqueta: 'Multiplicador (0,5 a 3)', tipo: 'numero', requerido: true, ayuda: '1.2 sube el precio un 20 %.' },
            { clave: 'routeId', etiqueta: 'Ruta (vacío = todas)', tipo: 'seleccion', opciones: rutas.opciones },
          ]}
          aValores={(t) => ({ nombre: t?.nombre ?? '', desde: t?.desde ?? '', hasta: t?.hasta ?? '', multiplicador: t ? String(t.multiplicador) : '1.2', routeId: t?.routeId ?? '' })}
          aDatos={(v) => ({
            companyId: empresa,
            nombre: valor.texto(v, 'nombre'),
            desde: valor.texto(v, 'desde'),
            hasta: valor.texto(v, 'hasta'),
            multiplicador: Number(v.multiplicador),
            routeId: valor.opcional(v, 'routeId'),
          })}
          crear={api.tarifas.crearTemporada}
          editar={(t, d) => api.tarifas.editarTemporada(t.id, d)}
          borrar={(t) => api.tarifas.borrarTemporada(t.id)}
          textoBorrar="Borramos la temporada."
          invalidar={[['temporadas']]}
          vacio="Aún no hay temporadas: se cobra el precio normal todo el año."
        />
      )}
      {vista === 'pasajeros' && (
        <Resultado consulta={tipos} hayDatos vacio="">
          <p className="text-[14px] text-texto-2">El adulto paga siempre el precio completo.</p>
          <Valor key={`NINO-${deTipo('NINO')}`} etiqueta="Descuento para niños (%)" inicial={deTipo('NINO')} guardar={(n) => api.tarifas.guardarTipoPasajero('NINO', n, empresa)} invalidar="tipos-pasajero" />
          <Valor key={`MAYOR-${deTipo('ADULTO_MAYOR')}`} etiqueta="Descuento para adulto mayor (%)" inicial={deTipo('ADULTO_MAYOR')} guardar={(n) => api.tarifas.guardarTipoPasajero('ADULTO_MAYOR', n, empresa)} invalidar="tipos-pasajero" />
        </Resultado>
      )}
      {vista === 'asientos' && (
        <Resultado consulta={recargos} hayDatos vacio="">
          <p className="text-[14px] text-texto-2">El asiento estándar no tiene recargo.</p>
          <Valor key={`PREF-${deCategoria('PREFERENCIAL')}`} etiqueta="Recargo asiento preferencial (COP)" inicial={deCategoria('PREFERENCIAL')} guardar={(n) => api.tarifas.guardarRecargo('PREFERENCIAL', n, empresa)} invalidar="recargos" />
          <Valor key={`PREM-${deCategoria('PREMIUM')}`} etiqueta="Recargo asiento premium (COP)" inicial={deCategoria('PREMIUM')} guardar={(n) => api.tarifas.guardarRecargo('PREMIUM', n, empresa)} invalidar="recargos" />
        </Resultado>
      )}
    </PantallaGestion>
  )
}

function Valor({ etiqueta, inicial, guardar, invalidar }: { etiqueta: string; inicial: number; guardar: (n: number) => Promise<unknown>; invalidar: string }) {
  const [texto, setTexto] = useState(String(inicial))
  const accion = useAccion(() => guardar(Number(texto)), { exito: 'Guardamos la tarifa.', invalidar: [[invalidar]] })
  return (
    <div className="flex max-w-md items-end gap-2">
      <div className="flex-1">
        <Campo etiqueta={etiqueta} inputMode="decimal" value={texto} onChange={(e) => setTexto(e.target.value.replace(/[^\d.]/g, ''))} />
      </div>
      <Button tamano="md" className="h-13" disabled={texto === '' || Number(texto) === inicial || accion.isPending} onClick={() => accion.mutate(undefined)}>
        Guardar
      </Button>
    </div>
  )
}
