import { createElement as h, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { Button } from '@/components/ui/button'
import { Campo } from '@/components/ui/input'
import { Aviso, Esqueleto, PantallaError } from './Estados'
import { BarraInferior } from './BarraInferior'
import { ContadorRetencion } from './Contador'
import { Encabezado } from './Encabezado'
import { EstadoVivo } from './EstadoVivo'
import { LeyendaPuestos, PisoBus, PuestoBoton } from './MapaBus'
import { LiveDot } from './LiveDot'
import { Logo } from './Logo'
import { Pantalla } from './Pantalla'
import type { PisoVista, Puesto } from '@/features/mapaAsientos'

const puesto = (estado: Puesto['estado'], numero = '7'): Puesto => ({ numero, estado, ubicacion: 'ventana', offerId: null })

const piso: PisoVista = {
  piso: 1,
  columnas: 6,
  filas: 1,
  libres: 1,
  celdas: [
    { clave: 'c', fila: 1, columna: 1, tipo: 'CONDUCTOR', puesto: null },
    { clave: 'p', fila: 1, columna: 2, tipo: 'PUERTA', puesto: null },
    { clave: 'b', fila: 1, columna: 3, tipo: 'BANO', puesto: null },
    { clave: 'e', fila: 1, columna: 4, tipo: 'ESCALERA', puesto: null },
    { clave: 's', fila: 1, columna: 5, tipo: 'PASILLO', puesto: null },
    { clave: 'v', fila: 1, columna: 6, tipo: 'ASIENTO', puesto: puesto('libre') },
  ],
}

const enRuta = (contenido: ReactNode) =>
  renderToStaticMarkup(h(MemoryRouter, null, contenido))

describe('componentes de marca y estados', () => {
  it('renderiza estilos accesibles para pantallas, botones, campos y mensajes', () => {
    const markup = enRuta(
      h(
        'div',
        null,
        h(Pantalla, { children: 'Contenido móvil' }),
        h(Button, { variante: 'contorno', tamano: 'md', ancho: 'completo', children: 'Continuar' }),
        h(Campo, { etiqueta: 'Correo', ayuda: 'Usamos tu correo', type: 'email' }),
        h(Campo, { etiqueta: 'Clave', error: 'Revisa la clave', accion: 'Mostrar', type: 'password' }),
        h(Aviso, { tono: 'neutro', children: 'Sin novedades' }),
        h(Aviso, { tono: 'alerta', children: 'Revisa esto' }),
        h(Aviso, { tono: 'exito', children: 'Listo' }),
        h(Esqueleto, { bloques: [20, 40] }),
      ),
    )
    expect(markup).toContain('aria-invalid="true"')
    expect(markup).toContain('role="alert"')
    expect(markup).toContain('Continuar')
    expect(markup).toContain('aria-busy="true"')
  })

  it('presenta error, navegación y encabezado con retorno dentro del router', () => {
    const markup = enRuta(
      h(
        'div',
        null,
        h(PantallaError, { titulo: 'Falló', error: new Error('red'), reintentar: () => {}, volverA: '/salidas' }),
        h(Encabezado, { titulo: 'Tus viajes', volverA: '/inicio', children: 'Próximas salidas' }),
        h(BarraInferior, { activa: 'viajar' }),
      ),
    )
    expect(markup).toContain('Falló')
    expect(markup).toContain('Intentar de nuevo')
    expect(markup).toContain('Tus viajes')
    expect(markup).toContain('Principal')
  })

  it('renderiza los estados del mapa, la leyenda y el resumen del contador', () => {
    const estados: Puesto['estado'][] = ['libre', 'tuyo', 'ocupandose', 'vendido', 'oferta', 'sin-dato']
    const markup = enRuta(
      h(
        'div',
        null,
        ...estados.map((estado, i) => h(PuestoBoton, { key: estado, puesto: puesto(estado, String(i + 1)), seleccionable: true, marcado: estado === 'tuyo', alTocar: () => {} })),
        h(PisoBus, { piso, marcados: new Set<string>(), seleccionables: ['libre'], alTocar: () => {} }),
        h(LeyendaPuestos, { conOferta: true }),
        h(ContadorRetencion, { hasta: new Date(Date.now() + 300_000).toISOString() }),
      ),
    )
    expect(markup).toContain('Puesto 1')
    expect(markup).toContain('Piso 1 del bus')
    expect(markup).toContain('Oferta')
    expect(markup).toContain('role="timer"')
  })

  it('muestra la marca, el indicador en vivo y el estado del canal', () => {
    const markup = renderToStaticMarkup(
      h('div', null, h(Logo, { claro: true }), h(LiveDot, { color: 'naranja' }), h(EstadoVivo, { oscuro: true })),
    )
    expect(markup).toContain('tripbus')
    expect(markup).toContain('Actualiza cada 5 s')
  })
})
