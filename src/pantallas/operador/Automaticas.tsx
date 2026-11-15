import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Catalogo } from '@/components/marca/Catalogo'
import { PantallaGestion } from '@/components/marca/PantallaGestion'
import { Segmentos } from '@/components/ui/campos'
import { useEmpresaActiva } from '@/features/empresa'
import { useOpcionesRutas } from '@/features/opcionesGestion'
import { valor, type Valores } from '@/features/valores'
import { api } from '@/lib/endpoints'
import type { PlantillaOferta, ReglaOfertaAutomatica } from '@/lib/tipos'

const DIAS = ['', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']

/** "1,3,5" → [1,3,5] (días ISO: 1 = lunes … 7 = domingo). */
const diasDe = (v: Valores) =>
  String(v.dias ?? '')
    .split(/[\s,]+/)
    .map(Number)
    .filter((n) => n >= 1 && n <= 7)

/**
 * O-09 Ofertas automáticas (US-167) y plantillas recurrentes (US-169): reglas que lanzan ofertas cuando un viaje
 * va con baja ocupación y plantillas que repiten una oferta ciertos días de la semana.
 */
export function Automaticas() {
  const { companyId, esAdmin } = useEmpresaActiva()
  const [vista, setVista] = useState<'reglas' | 'plantillas'>('reglas')
  const rutas = useOpcionesRutas(companyId)
  const reglas = useQuery({ queryKey: ['reglas', companyId ?? null], queryFn: api.ofertas.reglas, enabled: vista === 'reglas' })
  const plantillas = useQuery({ queryKey: ['plantillas', companyId ?? null], queryFn: api.ofertas.plantillas, enabled: vista === 'plantillas' })
  const empresa = esAdmin ? { companyId } : {}
  const ruta = (id: string | null) => rutas.opciones.find((r) => r.valor === id)?.texto ?? 'Todas las rutas'
  const campoRuta = { clave: 'routeId', etiqueta: 'Ruta', tipo: 'seleccion' as const, opciones: rutas.opciones }

  return (
    <PantallaGestion titulo="Ofertas automáticas" descripcion="Que las ofertas salgan solas cuando conviene." requiereEmpresa>
      <Segmentos etiqueta="Sección" rol="tablist" valor={vista} alCambiar={setVista} opciones={[{ valor: 'reglas', texto: 'Por baja ocupación' }, { valor: 'plantillas', texto: 'Recurrentes' }]} />
      {vista === 'reglas' ? (
        <Catalogo<ReglaOfertaAutomatica, Partial<ReglaOfertaAutomatica>>
          nombre="regla"
          consulta={reglas}
          clave={(r) => r.id}
          resumen={(r) => ({ titulo: ruta(r.routeId), detalle: `${r.horasAntes} h antes · ocupación < ${r.ocupacionMaxima} % · −${r.descuento} % · hasta ${r.cupoMaximo} puestos`, etiqueta: r.activa ? 'Activa' : 'Pausada' })}
          campos={[
            campoRuta,
            { clave: 'horasAntes', etiqueta: 'Horas antes de la salida', tipo: 'numero', requerido: true },
            { clave: 'ocupacionMaxima', etiqueta: 'Si la ocupación es menor que (%)', tipo: 'numero', requerido: true },
            { clave: 'descuento', etiqueta: 'Descuento (%)', tipo: 'numero', requerido: true },
            { clave: 'cupoMaximo', etiqueta: 'Máximo de puestos', tipo: 'numero', requerido: true },
            { clave: 'activa', etiqueta: 'Activa', tipo: 'casilla' },
          ]}
          aValores={(r) => ({
            routeId: r?.routeId ?? '',
            horasAntes: r ? String(r.horasAntes) : '24',
            ocupacionMaxima: r ? String(r.ocupacionMaxima) : '40',
            descuento: r ? String(r.descuento) : '30',
            cupoMaximo: r ? String(r.cupoMaximo) : '5',
            activa: r?.activa ?? true,
          })}
          aDatos={(v) => ({
            ...empresa,
            routeId: valor.opcional(v, 'routeId'),
            horasAntes: Number(v.horasAntes),
            ocupacionMaxima: Number(v.ocupacionMaxima),
            descuento: Number(v.descuento),
            cupoMaximo: Number(v.cupoMaximo),
            activa: v.activa === true,
          })}
          crear={api.ofertas.crearRegla}
          editar={(r, d) => api.ofertas.editarRegla(r.id, d)}
          borrar={(r) => api.ofertas.borrarRegla(r.id)}
          textoBorrar="Borramos la regla."
          invalidar={[['reglas']]}
          vacio="Aún no hay reglas automáticas."
        />
      ) : (
        <Catalogo<PlantillaOferta, Partial<PlantillaOferta>>
          nombre="plantilla"
          consulta={plantillas}
          clave={(t) => t.id}
          resumen={(t) => ({
            titulo: ruta(t.routeId),
            detalle: `${t.diasSemana.map((d) => DIAS[d]).join(', ')} · ${t.horaInicio} · ${t.duracionMinutos} min · −${t.descuento} % · ${t.cupo} puestos`,
            etiqueta: t.activa ? 'Activa' : 'Pausada',
          })}
          campos={[
            campoRuta,
            { clave: 'dias', etiqueta: 'Días (1 = lunes … 7 = domingo)', tipo: 'texto', requerido: true, ayuda: 'Separados por coma, por ejemplo 5, 6, 7.' },
            { clave: 'horaInicio', etiqueta: 'Hora de inicio', tipo: 'hora', requerido: true },
            { clave: 'duracionMinutos', etiqueta: 'Duración (minutos)', tipo: 'numero', requerido: true },
            { clave: 'descuento', etiqueta: 'Descuento (%)', tipo: 'numero', requerido: true },
            { clave: 'cupo', etiqueta: 'Puestos', tipo: 'numero', requerido: true },
            { clave: 'maxPorUsuario', etiqueta: 'Máximo por persona', tipo: 'numero' },
            { clave: 'horasAntesSalida', etiqueta: 'Horas antes de la salida', tipo: 'numero' },
            { clave: 'permiteReprogramar', etiqueta: 'Permite reprogramar', tipo: 'casilla' },
            { clave: 'salaEspera', etiqueta: 'Sala de espera', tipo: 'casilla' },
            { clave: 'activa', etiqueta: 'Activa', tipo: 'casilla' },
          ]}
          aValores={(t) => ({
            routeId: t?.routeId ?? '',
            dias: t ? t.diasSemana.join(', ') : '5, 6, 7',
            horaInicio: t?.horaInicio?.slice(0, 5) ?? '08:00',
            duracionMinutos: t ? String(t.duracionMinutos) : '60',
            descuento: t ? String(t.descuento) : '30',
            cupo: t ? String(t.cupo) : '5',
            maxPorUsuario: t ? String(t.maxPorUsuario) : '1',
            horasAntesSalida: t ? String(t.horasAntesSalida) : '24',
            permiteReprogramar: t?.permiteReprogramar ?? true,
            salaEspera: t?.salaEspera ?? false,
            activa: t?.activa ?? true,
          })}
          aDatos={(v) => ({
            ...empresa,
            routeId: valor.opcional(v, 'routeId'),
            diasSemana: diasDe(v),
            horaInicio: valor.texto(v, 'horaInicio'),
            duracionMinutos: Number(v.duracionMinutos),
            descuento: Number(v.descuento),
            cupo: Number(v.cupo),
            maxPorUsuario: valor.numero(v, 'maxPorUsuario') ?? 1,
            horasAntesSalida: valor.numero(v, 'horasAntesSalida') ?? 24,
            permiteReprogramar: v.permiteReprogramar === true,
            salaEspera: v.salaEspera === true,
            activa: v.activa === true,
          })}
          crear={api.ofertas.crearPlantilla}
          editar={(t, d) => api.ofertas.editarPlantilla(t.id, d)}
          borrar={(t) => api.ofertas.borrarPlantilla(t.id)}
          textoBorrar="Borramos la plantilla."
          invalidar={[['plantillas']]}
          vacio="Aún no hay ofertas recurrentes."
        />
      )}
    </PantallaGestion>
  )
}
