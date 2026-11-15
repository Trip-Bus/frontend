// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { sesion } from '@/lib/sesion'
import { Automaticas } from './Automaticas'
import { Buses } from './Buses'
import { Cupones } from './Cupones'
import { OfertasOperador } from './OfertasOperador'
import { Reportes } from './Reportes'
import { Rutas } from './Rutas'
import { Taquilla } from './Taquilla'
import { Tarifas } from './Tarifas'

const { toast, descargarBlob } = vi.hoisted(() => ({ toast: vi.fn(), descargarBlob: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
vi.mock('@/features/descarga', () => ({ descargarBlob }))

type Rutas = Record<string, (url: string, init?: RequestInit) => Response>
const pagina = (content: unknown[]) => Response.json({ content, page: 0, size: 20, totalElements: content.length, totalPages: 1 })
const ruta = { id: 'r-1', companyId: 'c-1', empresa: 'E', origen: 'Bogotá', destino: 'Tunja', duracionMinutos: 180, estado: 'ACTIVA' }
const itinerario = { itineraryId: 'i-1', routeId: 'r-1', busId: 'b-1', companyId: 'c-1', empresa: 'E', origen: 'Bogotá', destino: 'Tunja', placa: 'ABC123', fechaSalida: '2099-01-10T11:00:00Z', fechaLlegadaEstimada: '', estado: 'PROGRAMADO', precioBase: 50_000, moneda: 'COP' }

function servidor(rutas: Rutas) {
  return vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = String(entrada)
    const k = Object.keys(rutas).find((x) => url.includes(x))
    if (k) return rutas[k](url, init)
    if (url.includes('/users/')) return Response.json({ id: 'op', rol: 'OPERADOR', companyId: 'c-1', activo: true })
    if (url.includes('/routes')) return pagina([ruta])
    if (url.includes('/itineraries?')) return pagina([itinerario])
    return Response.json([])
  })
}

function montar(fetchMock: ReturnType<typeof servidor>, componente: () => ReturnType<typeof h>) {
  vi.stubGlobal('fetch', fetchMock)
  const router = createMemoryRouter([{ path: '/x', element: componente() }, { path: '*', element: h('p', null, 'Otra') }], { initialEntries: ['/x'] })
  render(h(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }) }, h(RouterProvider, { router })))
}
const cuerpo = (f: ReturnType<typeof servidor>, parte: string, metodo: string) => {
  const c = f.mock.calls.filter(([u, i]) => String(u).includes(parte) && i?.method === metodo).at(-1)
  return c ? JSON.parse(String(c[1]?.body)) : undefined
}
const exito = (texto: string) => waitFor(() => expect(toast).toHaveBeenCalledWith(texto))

beforeEach(() => sesion.iniciar({ accessToken: 'a', expiresAt: new Date(Date.now() + 3_600_000).toISOString(), userId: 'op', rol: 'OPERADOR' }))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  sesion.cerrar()
})

describe('buses', () => {
  const bus = { id: 'b-1', companyId: 'c-1', placa: 'ABC123', tipo: 'UN_PISO', estado: 'ACTIVO', servicios: ['WIFI'], creadoEn: '', actualizadoEn: '' }
  const rutas: Rutas = {
    '/buses/b-1/seatmap': (_u, i) =>
      i?.method === 'PUT' ? Response.json({}) : Response.json({ tipo: 'UN_PISO', capacidad: 1, pisos: [{ piso: 1, filas: 2, columnas: 2, celdas: [{ fila: 1, columna: 1, tipo: 'ASIENTO', asiento: '1' }] }] }),
    '/buses/b-1/estado': () => Response.json(bus),
    '/buses/b-1': () => Response.json(bus),
    '/buses': (_u, i) => (i?.method === 'POST' ? Response.json(bus, { status: 201 }) : pagina([bus])),
  }

  it('agrega un bus con placa válida y servicios', async () => {
    const f = servidor(rutas)
    montar(f, () => h(Buses))
    expect(await screen.findByText('ABC123')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Agregar bus' }))
    const hoja = await screen.findByRole('dialog')
    fireEvent.change(within(hoja).getByLabelText('Placa'), { target: { value: 'xy-z12' } })
    expect(within(hoja).getByText('Tres letras y tres números, como ABC123.')).toBeTruthy()
    fireEvent.change(within(hoja).getByLabelText('Placa'), { target: { value: 'xyz123' } })
    fireEvent.change(within(hoja).getByLabelText('Tipo'), { target: { value: 'DOS_PISOS' } })
    fireEvent.click(within(hoja).getByLabelText('Baño'))
    fireEvent.click(within(hoja).getByRole('button', { name: 'Agregar bus' }))
    await exito('Agregamos el bus.')
    expect(cuerpo(f, '/buses', 'POST')).toEqual({ placa: 'XYZ123', tipo: 'DOS_PISOS', servicios: ['BANO'] })
  })

  it('edita el estado y el mapa de asientos', async () => {
    const f = servidor(rutas)
    montar(f, () => h(Buses))
    fireEvent.click(await screen.findByRole('button', { name: /ABC123/ }))
    let hoja = await screen.findByRole('dialog')
    fireEvent.change(within(hoja).getByLabelText('Estado del bus'), { target: { value: 'MANTENIMIENTO' } })
    await exito('Cambiamos el estado del bus.')
    expect(cuerpo(f, '/estado', 'PATCH')).toEqual({ estado: 'MANTENIMIENTO' })

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    fireEvent.click(await screen.findByRole('button', { name: /ABC123/ }))
    hoja = await screen.findByRole('dialog')
    fireEvent.click(within(hoja).getByRole('tab', { name: 'Mapa de asientos' }))
    fireEvent.change(await within(hoja).findByLabelText('Categoría del asiento'), { target: { value: 'PREMIUM' } })
    fireEvent.click(within(hoja).getByRole('gridcell', { name: 'Fila 1, columna 2: Vacío' }))
    fireEvent.change(within(hoja).getByLabelText('Pintar'), { target: { value: 'BANO' } })
    fireEvent.click(within(hoja).getByRole('gridcell', { name: 'Fila 2, columna 1: Vacío' }))
    fireEvent.change(within(hoja).getByLabelText('Filas'), { target: { value: '3' } })
    expect(within(hoja).getByText(/2 asientos/)).toBeTruthy()
    fireEvent.click(within(hoja).getByRole('button', { name: 'Guardar el mapa' }))
    await exito('Guardamos el mapa del bus.')
    const mapa = cuerpo(f, '/seatmap', 'PUT')
    expect(mapa.capacidad).toBe(2)
    expect(mapa.pisos[0].filas).toBe(3)
    expect(mapa.pisos[0].celdas).toContainEqual({ fila: 1, columna: 2, tipo: 'ASIENTO', asiento: '2', categoria: 'PREMIUM' })
  })
})

describe('rutas', () => {
  it('crea una ruta con una parada intermedia y valida antes de enviar', async () => {
    const f = servidor({
      '/terminals': () => Response.json([{ id: 't-1', ciudad: 'Tunja', nombre: 'Terminal Tunja', direccion: '', lat: 5.53, lng: -73.36 }]),
      '/routes': (_u, i) => (i?.method === 'POST' ? Response.json(ruta, { status: 201 }) : pagina([])),
    })
    montar(f, () => h(Rutas))
    expect(await screen.findByText('Aún no hay rutas. Crea la primera.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Crear ruta' }))
    const hoja = await screen.findByRole('dialog')
    expect(within(hoja).getByText('Escribe el origen y el destino.')).toBeTruthy()
    fireEvent.change(within(hoja).getByLabelText('Origen'), { target: { value: 'Bogotá' } })
    fireEvent.change(within(hoja).getByLabelText('Destino'), { target: { value: 'Tunja' } })
    fireEvent.click(within(hoja).getByRole('button', { name: 'Agregar parada intermedia' }))
    const paradas = within(hoja).getAllByRole('listitem')
    fireEvent.change(within(paradas[0]).getByLabelText('Parada 1'), { target: { value: 'Bogotá' } })
    fireEvent.change(within(paradas[1]).getByLabelText('Parada 2'), { target: { value: 'Chocontá' } })
    fireEvent.change(within(paradas[2]).getByLabelText('Parada 3'), { target: { value: 'Tunja' } })
    await within(paradas[2]).findByRole('option', { name: 'Tunja · Terminal Tunja' })
    fireEvent.change(within(paradas[2]).getByLabelText('Terminal (opcional)'), { target: { value: 't-1' } })
    fireEvent.change(within(paradas[2]).getByLabelText('Minutos'), { target: { value: '20' } })
    expect(within(hoja).getByText('Los minutos deben crecer: revisa la parada 3.')).toBeTruthy()
    fireEvent.change(within(paradas[2]).getByLabelText('Minutos'), { target: { value: '150' } })
    fireEvent.click(within(hoja).getByRole('button', { name: 'Crear la ruta' }))
    await exito('Creamos la ruta.')
    const datos = cuerpo(f, '/routes', 'POST')
    expect(datos.paradas.map((p: { orden: number; minutosDesdeSalida: number }) => [p.orden, p.minutosDesdeSalida])).toEqual([[1, 0], [2, 30], [3, 150]])
    expect(datos.paradas[2]).toMatchObject({ terminalId: 't-1', lat: 5.53 })
  })

  it('edita los precios por tramo y desactiva la ruta', async () => {
    const conParadas = { ...ruta, paradas: [1, 2, 3].map((o) => ({ orden: o, nombre: `P${o}`, lat: 5, lng: -74, minutosDesdeSalida: (o - 1) * 60 })) }
    const f = servidor({
      '/routes/r-1/segment-prices': (_u, i) => (i?.method === 'PUT' ? Response.json([]) : Response.json([])),
      '/routes/r-1/estado': () => Response.json(ruta),
      '/routes/r-1': () => Response.json(conParadas),
    })
    montar(f, () => h(Rutas))
    fireEvent.click(await screen.findByRole('button', { name: /Bogotá → Tunja/ }))
    const hoja = await screen.findByRole('dialog')
    fireEvent.click(await within(hoja).findByRole('tab', { name: 'Precios por tramo' }))
    expect(await within(hoja).findByText(/los tramos se cobran en proporción/)).toBeTruthy()
    fireEvent.click(within(hoja).getByRole('button', { name: 'Agregar tramo' }))
    expect(within(hoja).getByText('El precio de cada tramo debe ser mayor que 0.')).toBeTruthy()
    fireEvent.change(within(hoja).getByLabelText(/^Precio/), { target: { value: '30000' } })
    fireEvent.click(within(hoja).getByRole('button', { name: 'Guardar precios' }))
    await exito('Guardamos los precios por tramo.')
    expect(cuerpo(f, '/segment-prices', 'PUT')).toEqual([{ desdeOrden: 1, hastaOrden: 2, precio: 30_000 }])
    fireEvent.click(within(hoja).getByRole('tab', { name: 'Ruta y paradas' }))
    fireEvent.click(within(hoja).getByRole('button', { name: 'Desactivar la ruta' }))
    await exito('Cambiamos el estado de la ruta.')
  })
})

describe('ofertas del operador', () => {
  const oferta = { offerId: 'o-1', itineraryId: 'i-1', precioOferta: 30_000, cupoMax: 4, cupoRestante: 3, inicio: '2099-01-09T10:00:00Z', fin: '2099-01-09T11:00:00Z', estado: 'PROGRAMADA', segundosRestantes: 0, asientos: ['1', '2', '3', '4'], motivoCierre: null, maxPorUsuario: 1, salaEsperaHabilitada: true }
  const rutas: Rutas = {
    '/operator/offers/metrics': () => Response.json({ ofertas: 3, ventas: 10, ingresos: 300_000, descuentoOtorgado: 50_000, conversionPromedio: 40, ofertaAgotadaMasRapido: null }),
    '/offers/o-1/metrics': () => Response.json({ cupo: 4, reservasCreadas: 5, ventas: 1, liberadasOVencidas: 1, conversion: 25, tiempoEnAgotarseSegundos: null, ingresos: 30_000, descuentoTotalOtorgado: 20_000, seguidoresAlertados: 7 }),
    '/offers/o-1/duplicate': () => Response.json(oferta, { status: 201 }),
    '/offers/o-1': () => (new Response(null, { status: 204 })),
    '/operator/offers': () => pagina([{ oferta, cupoVendido: 1, cupoRestante: 3 }]),
    '/offers': () => Response.json(oferta, { status: 201 }),
  }

  it('muestra métricas, crea, edita, duplica y cancela', async () => {
    const f = servidor(rutas)
    montar(f, () => h(OfertasOperador))
    expect(await screen.findByText('$300.000')).toBeTruthy()
    expect(screen.getByText(/1 vendidos de 4, quedan 3 · con sala de espera/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Métricas' }))
    expect(await screen.findByText('no se agotó')).toBeTruthy()
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    fireEvent.click(screen.getByRole('button', { name: 'Crear oferta' }))
    let hoja = await screen.findByRole('dialog')
    await within(hoja).findByRole('option', { name: /Bogotá → Tunja/ })
    fireEvent.change(within(hoja).getByLabelText('Viaje'), { target: { value: 'i-1' } })
    fireEvent.change(within(hoja).getByLabelText('Puestos de la oferta'), { target: { value: '5, 6' } })
    fireEvent.change(within(hoja).getByLabelText('Precio'), { target: { value: '25000' } })
    fireEvent.change(within(hoja).getByLabelText('Cupo'), { target: { value: '2' } })
    fireEvent.click(within(hoja).getByLabelText(/Sala de espera/))
    fireEvent.click(within(hoja).getByRole('button', { name: 'Crear oferta' }))
    await exito('Creamos la oferta.')
    expect(cuerpo(f, '/offers', 'POST')).toMatchObject({ itineraryId: 'i-1', seatNumbers: ['5', '6'], precioOferta: 25_000, cupo: 2, salaEsperaHabilitada: true })

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    hoja = await screen.findByRole('dialog')
    fireEvent.change(within(hoja).getByLabelText('Cupo'), { target: { value: '3' } })
    fireEvent.click(within(hoja).getByRole('button', { name: 'Editar oferta' }))
    await exito('Guardamos la oferta.')
    expect(cuerpo(f, '/offers/o-1', 'PUT')).toMatchObject({ cupo: 3 })

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Duplicar' }))
    hoja = await screen.findByRole('dialog')
    await within(hoja).findByRole('option', { name: /Bogotá → Tunja/ })
    fireEvent.change(within(hoja).getByLabelText('Viaje'), { target: { value: 'i-1' } })
    fireEvent.click(within(hoja).getByRole('button', { name: 'Duplicar en otro viaje' }))
    await exito('Duplicamos la oferta.')

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, cancelar la oferta' }))
    await exito('Cancelamos la oferta y liberamos sus puestos.')
  })
})

describe('taquilla', () => {
  const mapa = { itineraryId: 'i-1', busId: 'b', placa: 'X', tipoBus: 'UN_PISO', capacidad: 1, asientos: ['1'], distribucion: { tipo: 'UN_PISO', capacidad: 1, pisos: [{ piso: 1, filas: 1, columnas: 1, celdas: [{ fila: 1, columna: 1, tipo: 'ASIENTO', asiento: '1' }] }] } }
  it('vende en efectivo con Idempotency-Key, imprime y muestra el cierre de caja', async () => {
    const f = servidor({
      '/seatmap': () => Response.json(mapa),
      '/seats/itineraries/i-1': () => Response.json({ itineraryId: 'i-1', capacidad: 1, resumen: { disponibles: 1, retenidos: 0, vendidos: 0, enOferta: 0 }, asientos: [{ seatNumber: '1', estado: 'DISPONIBLE', offerId: null, propio: false }] }),
      '/box-office/sales?': () =>
        Response.json({ fecha: '2099-01-10', vendedor: null, cantidadVentas: 1, cantidadTiquetes: 1, cantidadAsientos: 1, totalEfectivo: 50_000, totalReembolsado: 0, ventas: [{ bookingId: 'b', estado: 'CONFIRMADA', ticketId: 't', estadoTiquete: 'EMITIDO', vendidoEn: '2099-01-10T09:00:00Z', origen: 'Bogotá', destino: 'Tunja', fechaSalida: '', seatNumbers: ['1'], compradorNombre: 'Luis', total: 50_000 }] }),
      '/box-office/sales': () => Response.json({ bookingId: 'b', estado: 'CONFIRMADA', ticketId: 't-9', compradorRegistrado: true, itineraryId: 'i-1', origen: 'Bogotá', destino: 'Tunja', fechaSalida: '', seatNumbers: ['1'], total: 50_000, moneda: 'COP', metodoPago: 'EFECTIVO', vendidoEn: '' }, { status: 201 }),
      '/tickets/t-9/pdf': () => new Response('%PDF'),
    })
    montar(f, () => h(Taquilla))
    await screen.findByRole('option', { name: /Bogotá → Tunja/ })
    fireEvent.change(screen.getByLabelText('Viaje'), { target: { value: 'i-1' } })
    const puesto = await screen.findByRole('button', { name: /Puesto 1,/ })
    await waitFor(() => expect((puesto as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(puesto)
    fireEvent.change(screen.getByLabelText('Nombre del pasajero'), { target: { value: 'Luis Gómez' } })
    fireEvent.change(screen.getByLabelText('Número'), { target: { value: '1020' } })
    fireEvent.change(screen.getByLabelText('Nombre del comprador'), { target: { value: 'Luis Gómez' } })
    fireEvent.change(screen.getByLabelText('Correo (opcional)'), { target: { value: 'luis@x.co' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cobrar en efectivo' }))
    expect(await screen.findByText(/El tiquete quedó en la cuenta del comprador/)).toBeTruthy()
    const venta = f.mock.calls.find(([u, i]) => String(u).endsWith('/box-office/sales') && i?.method === 'POST')!
    expect((venta[1]!.headers as Record<string, string>)['Idempotency-Key']).toBeTruthy()
    expect(JSON.parse(String(venta[1]?.body))).toMatchObject({ itineraryId: 'i-1', seatNumbers: ['1'], comprador: { nombre: 'Luis Gómez', email: 'luis@x.co' } })
    fireEvent.click(screen.getByRole('button', { name: 'Imprimir tiquete' }))
    await waitFor(() => expect(descargarBlob).toHaveBeenCalledWith(expect.objectContaining({ size: expect.any(Number) }), 'tiquete-t-9.pdf'))

    fireEvent.click(screen.getByRole('tab', { name: 'Cierre de caja' }))
    expect(await screen.findByText(/· Luis/)).toBeTruthy()
    expect(screen.getAllByText('$50.000').length).toBeGreaterThan(0)
  })
})

describe('reportes', () => {
  it('muestra ventas con totales, descarga el CSV y la puntualidad', async () => {
    const fila = (grupo: string) => ({ grupo, tiquetesVendidos: 2, ingresosBrutos: 100_000, descuentoCupones: 0, reembolsos: 0, ingresosNetos: 100_000, comisionTripBus: 10_000, netoEmpresa: 90_000, ocupacionPromedio: 55 })
    const f = servidor({
      '/reports/sales.csv': () => new Response('grupo\n'),
      '/reports/sales': () => Response.json({ desde: '', hasta: '', agrupar: 'ruta', companyId: null, grupos: [fila('Bogotá → Tunja')], totales: fila('TOTAL'), ventasSinComision: 2 }),
      '/reports/punctuality': () => Response.json({ desde: '', hasta: '', agrupar: 'ruta', companyId: null, grupos: [{ routeId: 'r', conductorId: null, nombre: 'Bogotá → Tunja', viajes: 4, retrasoPromedioSalidaMin: 3.5, retrasoPromedioLlegadaMin: null, porcentajeViajesATiempo: 75, porcentajeParadasATiempo: null }] }),
    })
    montar(f, () => h(Reportes))
    fireEvent.change(await screen.findByLabelText('Agrupar por'), { target: { value: 'ruta' } })
    expect(await screen.findByRole('columnheader', { name: 'Ocupación' })).toBeTruthy()
    expect(screen.getByText('Total')).toBeTruthy()
    expect(screen.getByText(/2 ventas aún no tienen la comisión/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'CSV' }))
    await waitFor(() => expect(descargarBlob).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('tab', { name: 'Puntualidad' }))
    expect(await screen.findByText('3,5 min')).toBeTruthy()
    expect(screen.getAllByText('sin dato').length).toBe(2)
  })
})

describe('catálogos del operador', () => {
  it('crea y desactiva cupones', async () => {
    const cupon = { couponId: 'cu-1', codigo: 'PROMO', tipo: 'PORCENTAJE', valor: 10, companyId: null, vigenteDesde: null, vigenteHasta: '2099-02-01T05:00:00Z', usosMaximos: 100, usos: 4, usosPorUsuario: 1, compraMinima: null, routeIds: [], activo: true }
    const f = servidor({ '/coupons/cu-1': () => new Response(null, { status: 204 }), '/coupons': (_u, i) => (i?.method === 'POST' ? Response.json(cupon) : Response.json([cupon])) })
    montar(f, () => h(Cupones))
    expect(await screen.findByText(/10 % · 4 de 100 usos/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Agregar cupón' }))
    const hoja = await screen.findByRole('dialog')
    const guardar = within(hoja).getByRole('button', { name: 'Guardar' }) as HTMLButtonElement
    expect(guardar.disabled).toBe(true)
    fireEvent.change(within(hoja).getByLabelText('Código'), { target: { value: 'navidad' } })
    fireEvent.change(within(hoja).getByLabelText('Tipo'), { target: { value: 'VALOR' } })
    fireEvent.change(within(hoja).getByLabelText('Valor'), { target: { value: '5000' } })
    fireEvent.change(within(hoja).getByLabelText('Vigente hasta'), { target: { value: '2099-12-31T23:59' } })
    fireEvent.click(guardar)
    await exito('Guardamos los cambios.')
    expect(cuerpo(f, '/coupons', 'POST')).toMatchObject({ codigo: 'NAVIDAD', tipo: 'VALOR', valor: 5000, usosMaximos: null, vigenteHasta: '2100-01-01T04:59:00.000Z', activo: true })

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: /PROMO/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Quitar' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, quitar' }))
    await exito('Desactivamos el cupón.')
  })

  it('crea reglas automáticas y plantillas recurrentes', async () => {
    const regla = { id: 'rg-1', companyId: 'c-1', routeId: 'r-1', horasAntes: 24, ocupacionMaxima: 40, descuento: 30, cupoMaximo: 5, activa: true, actualizadoEn: '' }
    const plantilla = { id: 'pl-1', companyId: 'c-1', routeId: null, diasSemana: [5, 6], horaInicio: '08:00:00', duracionMinutos: 60, descuento: 20, cupo: 4, maxPorUsuario: 1, permiteReprogramar: true, salaEspera: false, horasAntesSalida: 24, activa: false, actualizadoEn: '' }
    const f = servidor({
      '/auto-offer-rules/rg-1': () => Response.json(regla),
      '/auto-offer-rules': (_u, i) => (i?.method === 'POST' ? Response.json(regla) : Response.json([regla])),
      '/offer-templates': (_u, i) => (i?.method === 'POST' ? Response.json(plantilla) : Response.json([plantilla])),
    })
    montar(f, () => h(Automaticas))
    expect(await screen.findByText(/24 h antes · ocupación < 40 %/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Bogotá → Tunja/ }))
    let hoja = await screen.findByRole('dialog')
    fireEvent.change(within(hoja).getByLabelText('Descuento (%)'), { target: { value: '35' } })
    fireEvent.click(within(hoja).getByRole('button', { name: 'Guardar' }))
    await exito('Guardamos los cambios.')
    expect(cuerpo(f, '/auto-offer-rules/rg-1', 'PUT')).toMatchObject({ routeId: 'r-1', descuento: 35, activa: true })

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    fireEvent.click(screen.getByRole('tab', { name: 'Recurrentes' }))
    expect(await screen.findByText(/vie, sáb · 08:00:00/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Agregar plantilla' }))
    hoja = await screen.findByRole('dialog')
    fireEvent.change(within(hoja).getByLabelText('Días (1 = lunes … 7 = domingo)'), { target: { value: '1, 9, 7' } })
    fireEvent.click(within(hoja).getByRole('button', { name: 'Guardar' }))
    await exito('Guardamos los cambios.')
    expect(cuerpo(f, '/offer-templates', 'POST')).toMatchObject({ diasSemana: [1, 7], horaInicio: '08:00', routeId: null })
  })

  it('administra temporadas, descuentos por pasajero y recargos de asiento', async () => {
    const f = servidor({
      '/fares/seasons': (_u, i) => (i?.method === 'POST' ? Response.json({}) : Response.json([{ id: 's-1', companyId: 'c-1', routeId: 'r-1', nombre: 'Navidad', desde: '2099-12-15', hasta: '2100-01-10', multiplicador: 1.3 }])),
      '/fares/passenger-types': (_u, i) => (i?.method === 'PUT' ? Response.json({}) : Response.json([{ tipo: 'NINO', descuentoPorcentaje: 50 }])),
      '/fares/seat-surcharges': (_u, i) => (i?.method === 'PUT' ? Response.json({}) : Response.json([{ categoria: 'PREMIUM', recargo: 15_000 }])),
    })
    montar(f, () => h(Tarifas))
    expect(await screen.findByText(/× 1,3 · Bogotá → Tunja/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Agregar temporada' }))
    const hoja = await screen.findByRole('dialog')
    fireEvent.change(within(hoja).getByLabelText('Nombre'), { target: { value: 'Semana Santa' } })
    fireEvent.change(within(hoja).getByLabelText('Desde'), { target: { value: '2099-04-01' } })
    fireEvent.change(within(hoja).getByLabelText('Hasta'), { target: { value: '2099-04-08' } })
    fireEvent.click(within(hoja).getByRole('button', { name: 'Guardar' }))
    await exito('Guardamos los cambios.')
    expect(cuerpo(f, '/fares/seasons', 'POST')).toMatchObject({ nombre: 'Semana Santa', multiplicador: 1.2, routeId: null })

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    fireEvent.click(screen.getByRole('tab', { name: 'Tipo de pasajero' }))
    const nino = await screen.findByLabelText('Descuento para niños (%)')
    await waitFor(() => expect((nino as HTMLInputElement).value).toBe('50'))
    fireEvent.change(screen.getByLabelText('Descuento para adulto mayor (%)'), { target: { value: '30' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Guardar' })[1])
    await exito('Guardamos la tarifa.')
    expect(cuerpo(f, '/passenger-types/ADULTO_MAYOR', 'PUT')).toEqual({ descuentoPorcentaje: 30 })

    fireEvent.click(screen.getByRole('tab', { name: 'Asientos' }))
    await waitFor(() => expect((screen.getByLabelText('Recargo asiento premium (COP)') as HTMLInputElement).value).toBe('15000'))
    fireEvent.change(screen.getByLabelText('Recargo asiento preferencial (COP)'), { target: { value: '8000' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Guardar' })[0])
    await waitFor(() => expect(cuerpo(f, '/seat-surcharges/PREFERENCIAL', 'PUT')).toEqual({ recargo: 8000 }))
  })
})
