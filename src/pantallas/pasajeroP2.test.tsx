// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { avisos } from '@/features/avisos'
import { sesion } from '@/lib/sesion'
import { Avisos } from './Avisos'
import { CambiosTiquete } from './CambiosTiquete'
import { Cuenta } from './Cuenta'
import { MisTurnos } from './MisTurnos'
import { RutasSeguidas } from './RutasSeguidas'

const { toast, push } = vi.hoisted(() => ({ toast: vi.fn(), push: { estado: vi.fn(), activar: vi.fn(), desactivar: vi.fn() } }))
vi.mock('sonner', () => ({ toast }))
vi.mock('@/features/push', () => ({ estadoPush: push.estado, activarPush: push.activar, desactivarPush: push.desactivar }))

type Rutas = Record<string, (url: string, init?: RequestInit) => Response>
function servidor(rutas: Rutas) {
  return vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = String(entrada)
    const k = Object.keys(rutas).find((x) => url.includes(x))
    if (k) return rutas[k](url, init)
    if (url.includes('/itineraries/')) return Response.json({ itineraryId: 'i-1', origen: 'Bogotá', destino: 'Tunja', fechaSalida: '2099-01-10T11:00:00Z', paradas: [] })
    return Response.json([])
  })
}

function montar(fetchMock: ReturnType<typeof servidor>, path: string, componente: () => ReturnType<typeof h>, ruta = path) {
  vi.stubGlobal('fetch', fetchMock)
  const router = createMemoryRouter([{ path, element: componente() }, { path: '*', element: h('p', null, 'Otra') }], { initialEntries: [ruta] })
  render(h(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }) }, h(RouterProvider, { router })))
  return router
}
const llamada = (f: ReturnType<typeof servidor>, parte: string, metodo: string) => f.mock.calls.find(([u, i]) => String(u).includes(parte) && i?.method === metodo)

beforeEach(() => {
  avisos.limpiar()
  sesion.iniciar({ accessToken: 'a', expiresAt: new Date(Date.now() + 3_600_000).toISOString(), userId: 'u', rol: 'PASAJERO' })
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  sesion.cerrar()
})

describe('mis turnos', () => {
  it('muestra la posición, la silla guardada con su cuenta regresiva y permite salir', async () => {
    const fetchMock = servidor({
      '/seats/waitlist/me': () =>
        Response.json([
          { id: 'w-1', itineraryId: 'i-1', cantidad: 2, estado: 'ESPERANDO', posicion: 3, holdId: null, creadoEn: '', actualizadoEn: '' },
          { id: 'w-2', itineraryId: 'i-1', cantidad: 1, estado: 'OFRECIDO', posicion: null, holdId: 'h-1', creadoEn: '', actualizadoEn: '' },
          { id: 'w-3', itineraryId: 'i-1', cantidad: 1, estado: 'VENCIDO', posicion: null, holdId: null, creadoEn: '', actualizadoEn: '' },
        ]),
      '/seats/holds/h-1': () => Response.json({ holdId: 'h-1', expiraEn: new Date(Date.now() + 9 * 60_000).toISOString() }),
      '/waitlist': () => new Response(null, { status: 204 }),
    })
    montar(fetchMock, '/mis-turnos', () => h(MisTurnos))
    expect(await screen.findByText('3')).toBeTruthy()
    expect(await screen.findByText(/¡Te guardamos tu silla!/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Comprar ahora' }).getAttribute('href')).toBe('/reserva/h-1')
    expect(screen.getByText('Te guardamos un puesto pero no alcanzaste a comprarlo.')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: 'Salir de la lista' })[0])
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Saliste de la lista de espera.'))
    expect(llamada(fetchMock, '/seats/itineraries/i-1/waitlist', 'DELETE')).toBeTruthy()
  })

  it('sin turnos lo dice', async () => {
    montar(servidor({ '/seats/waitlist/me': () => Response.json([]) }), '/mis-turnos', () => h(MisTurnos))
    expect(await screen.findByText(/No estás en ninguna lista de espera/)).toBeTruthy()
  })
})

describe('centro de avisos', () => {
  it('lista los avisos, los marca leídos, abre su pantalla y los borra', async () => {
    avisos.agregar('BookingAffected', { causa: 'CANCELACION' }, 'a-1')
    avisos.agregar('WaitlistSeatOffered', {}, 'a-2')
    montar(servidor({}), '/avisos', () => h(Avisos))
    expect(screen.getByRole('link', { name: /Tu viaje tuvo un cambio/ }).getAttribute('href')).toBe('/afectados')
    await waitFor(() => expect(avisos.lista().every((a) => a.leido)).toBe(true))
    fireEvent.click(screen.getByRole('button', { name: 'Borrar todos' }))
    expect(await screen.findByText(/No tienes avisos/)).toBeTruthy()
  })
})

describe('cambiar el tiquete', () => {
  const tiquete = {
    ticketId: 't-1',
    bookingId: 'b-1',
    estado: 'EMITIDO',
    emitidoEn: '',
    itineraryId: 'i-1',
    origen: 'Bogotá',
    destino: 'Tunja',
    fechaSalida: '2099-01-10T11:00:00Z',
    empresa: 'E',
    placa: 'X',
    seatNumbers: ['1'],
    pasajeros: [{ passengerId: 'p-1', nombre: 'Ana', tipoDocumento: 'CC', numeroDocumento: '1234', asiento: '1' }],
    total: 1,
    moneda: 'COP',
    qrCode: '',
    qrImage: '',
  }
  const mapa = { itineraryId: 'i-1', busId: 'b', placa: 'X', tipoBus: 'UN_PISO', capacidad: 2, asientos: ['1', '2'], distribucion: { tipo: 'UN_PISO', capacidad: 2, pisos: [{ piso: 1, filas: 1, columnas: 2, celdas: [{ fila: 1, columna: 1, tipo: 'ASIENTO', asiento: '1' }, { fila: 1, columna: 2, tipo: 'ASIENTO', asiento: '2' }] }] } }
  const estados = { itineraryId: 'i-1', capacidad: 2, resumen: { disponibles: 1, retenidos: 0, vendidos: 1, enOferta: 0 }, asientos: [{ seatNumber: '1', estado: 'VENDIDO', offerId: null, propio: true }, { seatNumber: '2', estado: 'DISPONIBLE', offerId: null, propio: false }] }
  const rutas: Rutas = {
    '/tickets/t-1/seat': () => Response.json(tiquete),
    '/tickets/t-1/passengers/p-1': () => Response.json({ error: { code: 'PASSENGER_ALREADY_CORRECTED', message: 'x' } }, { status: 409 }),
    '/tickets/t-1': () => Response.json(tiquete),
    '/seatmap': () => Response.json(mapa),
    '/seats/itineraries/i-1': () => Response.json(estados),
  }

  it('cambia de puesto y lleva al pase con QR nuevo', async () => {
    const fetchMock = servidor(rutas)
    const router = montar(fetchMock, '/tiquete/:ticketId/cambios', () => h(CambiosTiquete), '/tiquete/t-1/cambios?que=asiento')
    const puesto = await screen.findByRole('button', { name: /Puesto 2,/ })
    await waitFor(() => expect((puesto as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(puesto)
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar el 1 por el 2' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/pase/t-1'))
    expect(JSON.parse(String(llamada(fetchMock, '/seat', 'POST')![1]?.body))).toEqual({ fromSeat: '1', toSeat: '2' })
  })

  it('corrige los datos de un pasajero y muestra el error de una segunda corrección', async () => {
    const fetchMock = servidor(rutas)
    montar(fetchMock, '/tiquete/:ticketId/cambios', () => h(CambiosTiquete), '/tiquete/t-1/cambios?que=datos')
    const form = await screen.findByRole('form', { name: 'Pasajero del puesto 1' })
    const guardar = within(form).getByRole('button', { name: 'Guardar la corrección' }) as HTMLButtonElement
    expect(guardar.disabled).toBe(true)
    fireEvent.change(within(form).getByLabelText('Nombre completo'), { target: { value: 'Ana María' } })
    fireEvent.click(guardar)
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Los datos de este pasajero ya se corrigieron una vez.'))
    expect(JSON.parse(String(llamada(fetchMock, '/passengers/p-1', 'PATCH')![1]?.body))).toEqual({ nombre: 'Ana María', tipoDocumento: 'CC', numeroDocumento: '1234' })
  })

  it('si el tiquete no existe lo dice', async () => {
    montar(servidor({ '/tickets/': () => Response.json({ error: { code: 'TICKET_NOT_FOUND', message: 'x' } }, { status: 404 }) }), '/tiquete/:ticketId/cambios', () => h(CambiosTiquete), '/tiquete/x/cambios')
    expect(await screen.findByText('No encontramos tu tiquete')).toBeTruthy()
  })
})

describe('rutas que sigo', () => {
  it('sigue una ruta y deja de seguirla', async () => {
    const fetchMock = servidor({
      '/offers/follows/f-1': () => new Response(null, { status: 204 }),
      '/offers/follows': (_u, init) => (init?.method === 'POST' ? Response.json({ id: 'f-2' }, { status: 201 }) : Response.json([{ id: 'f-1', origen: 'Bogotá', destino: 'Cali', creadoEn: '' }])),
    })
    montar(fetchMock, '/cuenta/alertas', () => h(RutasSeguidas))
    fireEvent.click(await screen.findByRole('button', { name: 'Dejar de seguir Bogotá a Cali' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Dejaste de seguir la ruta.'))
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: 'Bogotá' } })
    fireEvent.change(screen.getByLabelText('Hacia'), { target: { value: 'Medellín' } })
    fireEvent.click(screen.getByRole('button', { name: 'Seguir esta ruta' }))
    await waitFor(() => expect(llamada(fetchMock, '/offers/follows', 'POST')).toBeTruthy())
    expect(JSON.parse(String(llamada(fetchMock, '/offers/follows', 'POST')![1]?.body))).toEqual({ origen: 'Bogotá', destino: 'Medellín' })
  })

  it('con 10 rutas no deja seguir más', async () => {
    montar(servidor({ '/offers/follows': () => Response.json(Array.from({ length: 10 }, (_, i) => ({ id: `f${i}`, origen: 'A', destino: `B${i}`, creadoEn: '' }))) }), '/cuenta/alertas', () => h(RutasSeguidas))
    expect(await screen.findByRole('button', { name: 'Ya sigues 10 rutas' })).toBeTruthy()
  })
})

describe('cuenta', () => {
  it('muestra los atajos del pasajero y activa los avisos push al tocar', async () => {
    push.estado.mockResolvedValue('inactivo')
    push.activar.mockResolvedValue('activo')
    montar(servidor({ '/users/': () => Response.json({ id: 'u', nombre: 'Ana', email: 'a@x.co', rol: 'PASAJERO', emailVerificado: true }) }), '/cuenta', () => h(Cuenta))
    expect(await screen.findByRole('link', { name: /Mis turnos/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Rutas que sigues/ }).getAttribute('href')).toBe('/cuenta/alertas')
    expect(push.activar).not.toHaveBeenCalled()
    fireEvent.click(await screen.findByRole('button', { name: 'Activar' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Listo: te avisaremos aunque tengas la app cerrada.'))
    push.desactivar.mockResolvedValue('inactivo')
    fireEvent.click(await screen.findByRole('button', { name: 'Desactivar' }))
    await waitFor(() => expect(push.desactivar).toHaveBeenCalled())
  })

  it('el operador ve el acceso a la gestión y el aviso de push bloqueado', async () => {
    sesion.iniciar({ accessToken: 'a', expiresAt: new Date(Date.now() + 3_600_000).toISOString(), userId: 'op', rol: 'OPERADOR' })
    push.estado.mockResolvedValue('bloqueado')
    montar(servidor({ '/users/': () => Response.json({ id: 'op', nombre: 'Op', email: 'o@x.co', rol: 'OPERADOR', emailVerificado: true }) }), '/cuenta', () => h(Cuenta))
    expect((await screen.findByRole('link', { name: /Gestión de la empresa/ })).getAttribute('href')).toBe('/operador')
    expect(await screen.findByText(/Bloqueaste los avisos/)).toBeTruthy()
  })
})
