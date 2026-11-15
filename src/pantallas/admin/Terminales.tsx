import { useQuery } from '@tanstack/react-query'
import { Catalogo } from '@/components/marca/Catalogo'
import { PantallaGestion } from '@/components/marca/PantallaGestion'
import { valor } from '@/features/valores'
import { api } from '@/lib/endpoints'
import type { Terminal, TerminalRequest } from '@/lib/tipos'

/** A-04 Terminales (US-115): las terminales de transporte que pueden ser paradas de las rutas. */
export function Terminales() {
  const consulta = useQuery({ queryKey: ['terminales'], queryFn: () => api.catalogo.terminales() })
  return (
    <PantallaGestion titulo="Terminales" descripcion="Terminales que las empresas usan como paradas.">
      <Catalogo<Terminal, TerminalRequest>
        nombre="terminal"
        consulta={consulta}
        clave={(t) => t.id}
        resumen={(t) => ({ titulo: t.nombre, detalle: `${t.ciudad} · ${t.direccion}` })}
        campos={[
          { clave: 'ciudad', etiqueta: 'Ciudad', tipo: 'texto', requerido: true },
          { clave: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true },
          { clave: 'direccion', etiqueta: 'Dirección', tipo: 'texto', requerido: true },
          { clave: 'lat', etiqueta: 'Latitud', tipo: 'texto', requerido: true },
          { clave: 'lng', etiqueta: 'Longitud', tipo: 'texto', requerido: true },
        ]}
        aValores={(t) => ({ ciudad: t?.ciudad ?? '', nombre: t?.nombre ?? '', direccion: t?.direccion ?? '', lat: t ? String(t.lat) : '', lng: t ? String(t.lng) : '' })}
        aDatos={(v) => ({ ciudad: valor.texto(v, 'ciudad'), nombre: valor.texto(v, 'nombre'), direccion: valor.texto(v, 'direccion'), lat: Number(v.lat), lng: Number(v.lng) })}
        crear={api.terminales.crear}
        editar={(t, d) => api.terminales.editar(t.id, d)}
        borrar={(t) => api.terminales.borrar(t.id)}
        textoBorrar="Borramos la terminal."
        invalidar={[['terminales']]}
        vacio="Aún no hay terminales."
      />
    </PantallaGestion>
  )
}
