// @vitest-environment jsdom
import type { RouteObject } from 'react-router'
import { describe, expect, it } from 'vitest'
import { router } from './router'

function rutas(lista: RouteObject[]): RouteObject[] {
  return lista.flatMap((r) => [r, ...rutas(r.children ?? [])])
}

describe('mapa de rutas', () => {
  it('cada pantalla perezosa carga su componente', async () => {
    const perezosas = rutas(router.routes as RouteObject[]).filter((r) => typeof r.lazy === 'function')
    expect(perezosas.length).toBeGreaterThan(40)
    for (const r of perezosas) {
      const modulo = await (r.lazy as () => Promise<{ Component?: unknown }>)()
      expect(typeof modulo.Component, r.path).toBe('function')
    }
  }, 60_000)

  it('incluye las pantallas nuevas del pasajero, del operador y del admin', () => {
    const caminos = new Set(rutas(router.routes as RouteObject[]).map((r) => r.path))
    for (const p of ['/ofertas', '/compartido/:codigo', '/afectados', '/reprogramar/:bookingId', '/mis-turnos', '/avisos', '/tiquete/:ticketId/cambios', '/cuenta/alertas', '/operador', '/operador/viajes', '/operador/flota', '/operador/buses', '/operador/rutas', '/operador/ofertas', '/operador/taquilla', '/operador/reportes', '/operador/tarifas', '/operador/cupones', '/operador/automaticas', '/admin', '/admin/usuarios', '/admin/empresas', '/admin/facturacion', '/admin/auditoria', '/admin/terminales']) {
      expect(caminos.has(p), p).toBe(true)
    }
  })
})
