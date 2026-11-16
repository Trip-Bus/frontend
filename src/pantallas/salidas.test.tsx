// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { sesion } from '@/lib/sesion'
import type { ResultadoViaje } from '@/lib/tipos'
import { Asientos } from './Asientos'
import { Salidas } from './Salidas'

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
vi.mock('@/lib/tiempoReal', () => ({
  topicos: { asientos: (id: string) => `itinerario:${id}:asientos` },
  useTopico: vi.fn(),
  useIntervaloRespaldo: () => 60_000,
  useEstadoTiempoReal: () => 'en-vivo',
}))

const viaje = (v: Partial<ResultadoViaje>): ResultadoViaje => ({
  itineraryId: 'i-1',
  routeId: 'r',
  busId: 'b',
  empresa: 'Expreso',
  origen: 'Bogotá',
  destino: 'Tunja',
  fechaSalida: '2099-01-10T11:00:00Z',
  fechaLlegadaEstimada: '2099-01-10T14:00:00Z',
  duracionMinutos: 180,
  precioBase: 50_000,
  moneda: 'COP',
  tipoBus: 'UN_PISO',
  capacidad: 40,
  asientosDisponibles: 12,
  agotado: false,
  ofertaActiva: null,
  servicios: ['WIFI', 'BANO', 'DESCONOCIDO'],
  ...v,
})

const FACETAS = {
  precioMin: 30_000,
  precioMax: 50_000,
  empresas: [
    { id: 'c-2', nombre: 'Andino', terminal: null, viajes: 0 },
    { id: 'c-1', nombre: 'Expreso', terminal: 'Terminal Salitre', viajes: 2 },
  ],
  tiposBus: ['UN_PISO', 'DOS_PISOS'],
}

function servidor(extra: Record<string, (url: string) => Response> = {}) {
  return vi.fn(async (entrada: RequestInfo | URL) => {
    const url = String(entrada)
    const k = Object.keys(extra).find((x) => url.includes(x))
    if (k) return extra[k](url)
    if (url.includes('/trips/calendar'))
      return Response.json([
        { fecha: '2099-01-10', precioMinimo: 30_000, viajes: 3, hayCupo: true },
        { fecha: '2099-01-11', precioMinimo: null, viajes: 1, hayCupo: false },
        { fecha: '2099-01-12', precioMinimo: null, viajes: 0, hayCupo: null },
      ])
    if (url.includes('/trips/search/facets')) return Response.json(FACETAS)
    if (url.includes('/trips/search')) {
      const page = Number(new URL(url, 'http://x').searchParams.get('page'))
      return Response.json(page === 0 ? [viaje({}), viaje({ itineraryId: 'i-2', fromOrden: 2, toOrden: 3, salida: '2099-01-10T12:00:00Z', llegada: '2099-01-10T13:30:00Z', precio: 30_000, origen: 'Chocontá' })] : [viaje({ itineraryId: 'i-3', agotado: true })], {
        headers: { 'X-Total-Count': '3' },
      })
    }
    if (url.includes('/places')) return Response.json([{ tipo: 'CIUDAD', nombre: 'Medellín', ciudad: 'Medellín' }, { tipo: 'TERMINAL', nombre: 'Terminal Norte', ciudad: 'Medellín' }])
    if (url.includes('/trips/round-trip')) return Response.json({ ida: [viaje({})], vuelta: [viaje({ itineraryId: 'v-1', origen: 'Tunja', destino: 'Bogotá', empresa: 'Vuelta SA' })] })
    return Response.json([])
  })
}

function montar(fetchMock: ReturnType<typeof servidor>, ruta = '/salidas?origen=Bogot%C3%A1&destino=Tunja&fecha=2099-01-10&pasajeros=2') {
  vi.stubGlobal('fetch', fetchMock)
  const router = createMemoryRouter(
    [
      { path: '/salidas', element: h(Salidas) },
      { path: '/viaje/:itineraryId/asientos', element: h(Asientos) },
      { path: '*', element: h('p', null, 'Otra') },
    ],
    { initialEntries: [ruta] },
  )
  render(h(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }) }, h(RouterProvider, { router })))
  return router
}

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  sesion.cerrar()
})

describe('búsqueda de salidas', () => {
  it('muestra el calendario, los servicios, el tramo y carga más resultados', async () => {
    const fetchMock = servidor()
    const router = montar(fetchMock)
    expect(await screen.findByText('Tramo Chocontá → Tunja')).toBeTruthy()
    expect(screen.getAllByRole('list', { name: 'Servicios del bus' })[0].textContent).toContain('Wi-Fi')
    expect(screen.getByText('lleno')).toBeTruthy()
    expect(screen.getByText('2 de 3')).toBeTruthy()
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('tramos=true'))).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }))
    expect(await screen.findByText('Agotado')).toBeTruthy()
    fireEvent.click(screen.getByText('Tramo Chocontá → Tunja'))
    await waitFor(() => expect(router.state.location.pathname).toBe('/viaje/i-2/asientos'))
    expect(router.state.location.search).toBe('?pasajeros=2&desde=2&hasta=3')
  })

  it('aplica filtros (empresa, franja, precio, tipo de bus y orden) y los quita', async () => {
    const fetchMock = servidor()
    const router = montar(fetchMock)
    fireEvent.click(await screen.findByRole('button', { name: 'Filtros' }))
    const hoja = await screen.findByRole('dialog')
    expect(within(hoja).getByRole('group', { name: 'Terminal Salitre' })).toBeTruthy()
    expect((within(hoja).getByRole('radio', { name: /Andino/ }) as HTMLInputElement).disabled).toBe(true)
    fireEvent.click(within(hoja).getByRole('radio', { name: /Expreso/ }))
    fireEvent.click(within(hoja).getByRole('radio', { name: 'Noche' }))
    const maximo = await within(hoja).findByRole('slider', { name: 'Precio máximo' })
    expect(maximo.getAttribute('aria-valuemax')).toBe('50000')
    fireEvent.keyDown(maximo, { key: 'PageDown' })
    expect(within(hoja).getByRole('status').textContent).toBe('$30.000 – $40.000')
    fireEvent.change(within(hoja).getByLabelText('Tipo de bus'), { target: { value: 'DOS_PISOS' } })
    fireEvent.change(within(hoja).getByLabelText('Ordenar por'), { target: { value: 'precio-asc' } })
    fireEvent.click(within(hoja).getByRole('button', { name: 'Ver salidas' }))
    await waitFor(() => expect(router.state.location.search).toContain('empresa=c-1'))
    expect(router.state.location.search).toContain('max=40000')
    expect(router.state.location.search).not.toContain('min=')
    expect(await screen.findByRole('button', { name: 'Filtros · 4' })).toBeTruthy()
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => /companyId=c-1&franja=NOCHE&precioMax=40000&tipoBus=DOS_PISOS&sort=precio&order=asc/.test(String(u)))).toBe(true))
    // El calendario y las facetas usan los mismos tramos y filtros que la lista (sin precio ni orden).
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => /\/trips\/calendar\?.*tramos=true&companyId=c-1&franja=NOCHE&tipoBus=DOS_PISOS$/.test(String(u)))).toBe(true))
    expect(fetchMock.mock.calls.some(([u]) => /\/trips\/search\/facets\?.*tramos=true&companyId=c-1&franja=NOCHE&tipoBus=DOS_PISOS$/.test(String(u)))).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Filtros · 4' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Quitar filtros' }))
    await waitFor(() => expect(router.state.location.search).not.toContain('empresa'))
  })

  it('el precio del día elegido es el menor precio de la lista y esa tarjeta dice "Más barato"', async () => {
    const lista = [viaje({ itineraryId: 'a', precioDesde: 52_000 }), viaje({ itineraryId: 'b', fechaSalida: '2099-01-10T13:00:00Z', precioDesde: 45_500 }), viaje({ itineraryId: 'c', fechaSalida: '2099-01-10T15:00:00Z', precioBase: 61_000 })]
    montar(
      servidor({
        '/trips/calendar': () => Response.json([{ fecha: '2099-01-10', precioMinimo: 45_500, viajes: 3, hayCupo: true }]),
        '/trips/search?': () => Response.json(lista, { headers: { 'X-Total-Count': '3' } }),
      }),
    )
    const dia = await screen.findByRole('tab', { selected: true })
    await waitFor(() => expect(within(dia).getByText('desde')).toBeTruthy())
    const precioDia = within(dia).getByText(/^\$/).textContent
    await screen.findByText('Más barato')
    const tarjetas = screen.getAllByRole('button').filter((b) => b.textContent?.includes('Expreso'))
    const precios = tarjetas.map((t) => Number(within(t).getByText(/^\$[\d.]+$/).textContent!.replace(/\D/g, '')))
    expect(precios).toEqual([52_000, 45_500, 61_000])
    expect(precioDia).toBe('$45.500')
    expect(Number(precioDia!.replace(/\D/g, ''))).toBe(Math.min(...precios))
    const etiqueta = screen.getByText('Más barato')
    expect(etiqueta.closest('button')!.textContent).toContain('$45.500')
    expect(screen.getAllByText('Más barato')).toHaveLength(1)
    expect(screen.getAllByRole('tab').find((t) => t.textContent?.includes('sin salidas'))?.hasAttribute('disabled')).toBe(true)
  })

  it('recorta el precio elegido a los límites del día: en los extremos no lo envía', async () => {
    const fetchMock = servidor()
    montar(fetchMock, '/salidas?origen=Bogot%C3%A1&destino=Tunja&fecha=2099-01-10&pasajeros=1&min=10000&max=90000')
    expect(await screen.findByRole('button', { name: 'Filtros' })).toBeTruthy()
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/trips/search?'))).toBe(true))
    expect(fetchMock.mock.calls.filter(([u]) => String(u).includes('/trips/search?')).every(([u]) => !String(u).includes('precio'))).toBe(true)
  })

  it('mientras llegan las facetas muestra el esqueleto y conserva un tipo de bus que ya no está', async () => {
    const esperando: (() => void)[] = []
    const pendiente = () => new Promise<Response>((r) => esperando.push(() => r(Response.json(FACETAS))))
    montar(servidor({ '/trips/search/facets': () => pendiente() as unknown as Response }), '/salidas?origen=Tunja&destino=Bogot%C3%A1&fecha=2099-01-10&pasajeros=1&bus=MINI_VAN')
    fireEvent.click(await screen.findByRole('button', { name: 'Filtros · 1' }))
    const hoja = await screen.findByRole('dialog')
    expect(within(hoja).getByLabelText('Cargando precios')).toBeTruthy()
    expect(within(hoja).getByLabelText('Cargando empresas')).toBeTruthy()
    for (const listo of esperando) listo()
    expect(await within(hoja).findByRole('option', { name: 'Mini van' })).toBeTruthy()
    expect(await within(hoja).findByRole('option', { name: 'Dos pisos' })).toBeTruthy()
    // Desde otra ciudad, sin grupos por terminal.
    expect(within(hoja).queryByRole('group', { name: 'Terminal Salitre' })).toBeNull()
    fireEvent.keyDown(hoja, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('con un solo precio lo muestra sin barra y sin viajes oculta el control', async () => {
    montar(servidor({ '/trips/search/facets': () => Response.json({ ...FACETAS, precioMin: 50_000, precioMax: 50_000 }) }))
    fireEvent.click(await screen.findByRole('button', { name: 'Filtros' }))
    const hoja = await screen.findByRole('dialog')
    expect(await within(hoja).findByText('$50.000')).toBeTruthy()
    expect(within(hoja).queryByRole('slider')).toBeNull()
    cleanup()
    montar(servidor({ '/trips/search/facets': () => Response.json({ precioMin: null, precioMax: null, empresas: [], tiposBus: [] }) }))
    fireEvent.click(await screen.findByRole('button', { name: 'Filtros' }))
    const otra = await screen.findByRole('dialog')
    expect(await within(otra).findByText('No hay empresas en esta ruta.')).toBeTruthy()
    expect(within(otra).queryByText('Precio')).toBeNull()
  })

  it('cambia la ruta con autocompletado y busca ida y vuelta', async () => {
    const fetchMock = servidor()
    const router = montar(fetchMock)
    fireEvent.click(await screen.findByRole('button', { name: 'Cambiar ruta' }))
    const hoja = await screen.findByRole('dialog')
    fireEvent.change(within(hoja).getByLabelText('Hacia'), { target: { value: 'Med' } })
    await waitFor(() => expect(hoja.querySelectorAll('datalist option').length).toBe(1))
    fireEvent.change(within(hoja).getByLabelText('Hacia'), { target: { value: 'Tunja' } })
    fireEvent.click(within(hoja).getByRole('checkbox', { name: 'Ida y vuelta' }))
    fireEvent.change(within(hoja).getByLabelText('Fecha de vuelta'), { target: { value: '2099-01-12' } })
    fireEvent.click(within(hoja).getByRole('button', { name: 'Buscar salidas' }))
    await waitFor(() => expect(router.state.location.search).toContain('regreso=2099-01-12'))
    expect(await screen.findByRole('tab', { name: /Vuelta/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: /Vuelta/ }))
    expect(await screen.findByText('Vuelta SA')).toBeTruthy()
  })

  it('sin resultados ofrece el día siguiente y muestra el error de la búsqueda', async () => {
    const router = montar(servidor({ '/trips/search?': () => Response.json([], { headers: { 'X-Total-Count': '0' } }) }))
    fireEvent.click(await screen.findByRole('button', { name: 'Ver el día siguiente' }))
    await waitFor(() => expect(router.state.location.search).toContain('fecha=2099-01-11'))
    cleanup()
    montar(servidor({ '/trips/search?': () => Response.json({ error: { code: 'INVALID_SEARCH', message: 'x' } }, { status: 400 }) }))
    expect(await screen.findByText('Revisa el origen, el destino y la fecha.')).toBeTruthy()
  })

  it('sin búsqueda válida vuelve al inicio', async () => {
    const router = montar(servidor(), '/salidas')
    await waitFor(() => expect(router.state.location.pathname).toBe('/inicio'))
  })
})

describe('puestos con tramo y lista de espera', () => {
  const mapa = { itineraryId: 'i-2', busId: 'b', placa: 'X', tipoBus: 'UN_PISO', capacidad: 1, asientos: ['1'], distribucion: { tipo: 'UN_PISO', capacidad: 1, pisos: [{ piso: 1, filas: 1, columnas: 1, celdas: [{ fila: 1, columna: 1, tipo: 'ASIENTO', asiento: '1' }] }] } }
  const asientosServidor = (disponible: boolean) =>
    vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
      const url = String(entrada)
      if (url.includes('/seatmap')) return Response.json(mapa)
      if (url.includes('/seats/itineraries/i-2/waitlist')) return Response.json({ id: 'w' }, { status: 201 })
      if (url.includes('/seats/itineraries/i-2'))
        return Response.json({ itineraryId: 'i-2', capacidad: 1, resumen: { disponibles: disponible ? 1 : 0, retenidos: 0, vendidos: disponible ? 0 : 1, enOferta: 0 }, asientos: [{ seatNumber: '1', estado: disponible ? 'DISPONIBLE' : 'VENDIDO', offerId: null, propio: false }] })
      if (url.endsWith('/seats/holds') && init?.method === 'POST') return Response.json({ holdId: 'h', itineraryId: 'i-2', seatNumbers: ['1'], expiraEn: '2099-01-01T00:00:00Z', offerId: null }, { status: 201 })
      return Response.json({ itineraryId: 'i-2', origen: 'Bogotá', destino: 'Tunja', fechaSalida: '2099-01-10T11:00:00Z', fechaLlegadaEstimada: '2099-01-10T14:00:00Z', empresa: 'E', precioBase: 50_000, estado: 'PROGRAMADO', paradas: [] })
    })

  it('consulta y aparta el puesto del tramo', async () => {
    sesion.iniciar({ accessToken: 'a', expiresAt: new Date(Date.now() + 3_600_000).toISOString(), userId: 'u', rol: 'PASAJERO' })
    const fetchMock = asientosServidor(true)
    const router = montar(fetchMock as unknown as ReturnType<typeof servidor>, '/viaje/i-2/asientos?pasajeros=1&desde=2&hasta=3')
    const puesto = await screen.findByRole('button', { name: /Puesto 1,/ })
    await waitFor(() => expect((puesto as HTMLButtonElement).disabled).toBe(false))
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/seats/itineraries/i-2?from=2&to=3'))).toBe(true)
    fireEvent.click(puesto)
    fireEvent.click(screen.getByRole('button', { name: /Apartar y seguir/ }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/reserva/h'))
    const hold = fetchMock.mock.calls.find(([u, i]) => String(u).endsWith('/seats/holds') && i?.method === 'POST')!
    expect(JSON.parse(String(hold[1]?.body))).toEqual({ itineraryId: 'i-2', seatNumbers: ['1'], fromOrden: 2, toOrden: 3 })
  })

  it('con el bus lleno ofrece la lista de espera', async () => {
    sesion.iniciar({ accessToken: 'a', expiresAt: new Date(Date.now() + 3_600_000).toISOString(), userId: 'u', rol: 'PASAJERO' })
    const fetchMock = asientosServidor(false)
    const router = montar(fetchMock as unknown as ReturnType<typeof servidor>, '/viaje/i-2/asientos?pasajeros=2')
    fireEvent.click(await screen.findByRole('button', { name: 'Anotarme por 2 puestos' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/mis-turnos'))
    expect(toast).toHaveBeenCalledWith('Te anotamos. Si se libera un puesto te lo guardamos 10 minutos.')
  })
})
