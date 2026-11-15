import { useQuery } from '@tanstack/react-query'
import { Catalogo } from '@/components/marca/Catalogo'
import { PantallaGestion } from '@/components/marca/PantallaGestion'
import { useEmpresaActiva } from '@/features/empresa'
import { valor } from '@/features/valores'
import { api } from '@/lib/endpoints'
import { campoDesdeInstante, dinero, fechaHora, instanteDesdeCampo } from '@/lib/formato'
import type { Cupon, CuponRequest, TipoCupon } from '@/lib/tipos'

/** O-13 Cupones (US-147): código, porcentaje o valor fijo, vigencia, usos y compra mínima. */
export function Cupones() {
  const { companyId, esAdmin } = useEmpresaActiva()
  const consulta = useQuery({ queryKey: ['cupones', companyId ?? null], queryFn: () => api.cupones.listar(companyId) })
  return (
    <PantallaGestion titulo="Cupones" descripcion="Descuentos que los pasajeros escriben al reservar. No aplican a ofertas relámpago." requiereEmpresa>
      <Catalogo<Cupon, CuponRequest>
        nombre="cupón"
        consulta={consulta}
        clave={(c) => c.couponId}
        resumen={(c) => ({
          titulo: c.codigo,
          detalle: `${c.tipo === 'PORCENTAJE' ? `${c.valor} %` : dinero(c.valor)} · ${c.usos}${c.usosMaximos ? ` de ${c.usosMaximos}` : ''} usos${c.vigenteHasta ? ` · hasta ${fechaHora(c.vigenteHasta)}` : ''}`,
          etiqueta: c.activo ? 'Activo' : 'Inactivo',
        })}
        campos={[
          { clave: 'codigo', etiqueta: 'Código', tipo: 'texto', requerido: true },
          { clave: 'tipo', etiqueta: 'Tipo', tipo: 'seleccion', requerido: true, opciones: [{ valor: 'PORCENTAJE', texto: 'Porcentaje' }, { valor: 'VALOR', texto: 'Valor fijo (COP)' }] },
          { clave: 'valor', etiqueta: 'Valor', tipo: 'numero', requerido: true, ayuda: 'Porcentaje hasta 100 o pesos.' },
          { clave: 'desde', etiqueta: 'Vigente desde', tipo: 'fechaHora' },
          { clave: 'hasta', etiqueta: 'Vigente hasta', tipo: 'fechaHora' },
          { clave: 'usosMaximos', etiqueta: 'Usos máximos (vacío = sin límite)', tipo: 'numero' },
          { clave: 'usosPorUsuario', etiqueta: 'Usos por persona (vacío = sin límite)', tipo: 'numero' },
          { clave: 'compraMinima', etiqueta: 'Compra mínima (COP)', tipo: 'numero' },
          { clave: 'activo', etiqueta: 'Activo', tipo: 'casilla' },
        ]}
        aValores={(c) => ({
          codigo: c?.codigo ?? '',
          tipo: c?.tipo ?? 'PORCENTAJE',
          valor: c ? String(c.valor) : '',
          desde: c?.vigenteDesde ? campoDesdeInstante(c.vigenteDesde) : '',
          hasta: c?.vigenteHasta ? campoDesdeInstante(c.vigenteHasta) : '',
          usosMaximos: c?.usosMaximos == null ? '' : String(c.usosMaximos),
          usosPorUsuario: c?.usosPorUsuario == null ? '' : String(c.usosPorUsuario),
          compraMinima: c?.compraMinima == null ? '' : String(c.compraMinima),
          activo: c?.activo ?? true,
        })}
        aDatos={(v) => ({
          codigo: valor.texto(v, 'codigo').toUpperCase(),
          tipo: v.tipo as TipoCupon,
          valor: Number(v.valor),
          companyId: esAdmin ? (companyId ?? null) : null,
          vigenteDesde: v.desde ? instanteDesdeCampo(String(v.desde)) : null,
          vigenteHasta: v.hasta ? instanteDesdeCampo(String(v.hasta)) : null,
          usosMaximos: valor.numero(v, 'usosMaximos'),
          usosPorUsuario: valor.numero(v, 'usosPorUsuario'),
          compraMinima: valor.numero(v, 'compraMinima'),
          routeIds: [],
          activo: v.activo === true,
        })}
        crear={api.cupones.crear}
        editar={(c, d) => api.cupones.editar(c.couponId, d)}
        borrar={(c) => api.cupones.desactivar(c.couponId)}
        textoBorrar="Desactivamos el cupón."
        invalidar={[['cupones']]}
        vacio="Aún no hay cupones."
      />
    </PantallaGestion>
  )
}
