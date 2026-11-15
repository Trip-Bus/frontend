// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { sesion } from '@/lib/sesion'
import { Auditoria } from './Auditoria'
import { Empresas } from './Empresas'
import { Facturacion } from './Facturacion'
import { Terminales } from './Terminales'

const { toast, descargarBlob } = vi.hoisted(() => ({ toast: vi.fn(), descargarBlob: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
vi.mock('@/features/descarga', () => ({ descargarBlob }))

type Rutas = Record<string, (url: string, init?: RequestInit) => Response>
const pagina = (content: unknown[]) => Response.json({ content, page: 0, size: 20, totalElements: content.length, totalPages: 1 })
function servidor(rutas: Rutas) {
  return vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = String(entrada)
    const k = Object.keys(rutas).find((x) => url.includes(x))
    return k ? rutas[k](url, init) : Response.json([])
  })
}
function montar(f: ReturnType<typeof servidor>, componente: () => ReturnType<typeof h>) {
  vi.stubGlobal('fetch', f)
  const router = createMemoryRouter([{ path: '/x', element: componente() }], { initialEntries: ['/x'] })
  render(h(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }) }, h(RouterProvider, { router })))
}
const cuerpo = (f: ReturnType<typeof servidor>, parte: string, metodo: string) => {
  const c = f.mock.calls.filter(([u, i]) => String(u).includes(parte) && i?.method === metodo).at(-1)
  return c ? JSON.parse(String(c[1]?.body)) : undefined
}
const exito = (t: string) => waitFor(() => expect(toast).toHaveBeenCalledWith(t))

beforeEach(() => sesion.iniciar({ accessToken: 'a', expiresAt: new Date(Date.now() + 3_600_000).toISOString(), userId: 'adm', rol: 'ADMIN' }))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  sesion.cerrar()
})

describe('empresas', () => {
  const empresa = { id: 'c-1', nombre: 'Expreso', nit: '900123456-7', estado: 'ACTIVA', creadoEn: '', actualizadoEn: '' }
  it('crea una empresa validando el NIT', async () => {
    const f = servidor({ '/companies': (_u, i) => (i?.method === 'POST' ? Response.json(empresa, { status: 201 }) : pagina([empresa])) })
    montar(f, () => h(Empresas))
    expect(await screen.findByText('NIT 900123456-7')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Crear empresa' }))
    const hoja = await screen.findByRole('dialog')
    fireEvent.change(within(hoja).getByLabelText('Nombre'), { target: { value: 'Rápido' } })
    fireEvent.change(within(hoja).getByLabelText('NIT'), { target: { value: '123' } })
    expect(within(hoja).getByText(/9 o 10 dígitos/)).toBeTruthy()
    fireEvent.change(within(hoja).getByLabelText('NIT'), { target: { value: '9001234561' } })
    fireEvent.click(within(hoja).getByRole('button', { name: 'Crear empresa' }))
    await exito('Creamos la empresa.')
    expect(cuerpo(f, '/companies', 'POST')).toEqual({ nombre: 'Rápido', nit: '9001234561' })
  })

  it('inactiva y agrega una vigencia de condiciones comerciales', async () => {
    const f = servidor({
      '/companies/c-1/terms': (_u, i) => (i?.method === 'POST' ? Response.json({}) : Response.json([{ id: 't', companyId: 'c-1', cuotaMensual: 500_000, comisionPorcentaje: 8, vigenteDesde: '2099-01-01', creadoPor: null, creadoEn: '' }])),
      '/companies/c-1/estado': () => Response.json(empresa),
      '/companies': () => pagina([empresa]),
    })
    montar(f, () => h(Empresas))
    fireEvent.click(await screen.findByRole('button', { name: /Expreso/ }))
    let hoja = await screen.findByRole('dialog')
    fireEvent.click(within(hoja).getByRole('button', { name: /Inactivar/ }))
    await exito('Cambiamos el estado de la empresa.')
    expect(cuerpo(f, '/estado', 'PATCH')).toEqual({ estado: 'INACTIVA' })

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: /Expreso/ }))
    hoja = await screen.findByRole('dialog')
    fireEvent.click(within(hoja).getByRole('tab', { name: 'Condiciones' }))
    expect(await within(hoja).findByText(/cuota \$500\.000 al mes · comisión 8 %/)).toBeTruthy()
    fireEvent.change(within(hoja).getByLabelText('Cuota mensual'), { target: { value: '600000' } })
    fireEvent.change(within(hoja).getByLabelText('Comisión (%)'), { target: { value: '31' } })
    expect((within(hoja).getByRole('button', { name: 'Agregar vigencia' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(within(hoja).getByLabelText('Comisión (%)'), { target: { value: '7.5' } })
    fireEvent.click(within(hoja).getByRole('button', { name: 'Agregar vigencia' }))
    await exito('Agregamos la nueva vigencia.')
    expect(cuerpo(f, '/terms', 'POST')).toMatchObject({ cuotaMensual: 600_000, comisionPorcentaje: 7.5 })
  })
})

describe('facturación', () => {
  it('muestra el total de la plataforma, avisa los incompletos y descarga el CSV', async () => {
    const f = servidor({
      '/reports/platform.csv': () => new Response('x'),
      '/reports/platform': () =>
        Response.json({ mes: '2099-01', empresas: [{ companyId: 'c', empresa: 'Expreso', cuotaMensual: null, comision: 20_000, totalACobrar: null, tiquetes: 10 }], cuotas: 0, comisiones: 20_000, total: 20_000, tiquetes: 10, incompleto: true }),
    })
    montar(f, () => h(Facturacion))
    expect(await screen.findByText('Total plataforma')).toBeTruthy()
    expect(screen.getByText(/Faltan las condiciones/)).toBeTruthy()
    expect(screen.getAllByText('sin dato')).toHaveLength(2)
    fireEvent.change(screen.getByLabelText('Mes'), { target: { value: '2099-02' } })
    await waitFor(() => expect(f.mock.calls.some(([u]) => String(u).includes('mes=2099-02'))).toBe(true))
    fireEvent.click(screen.getByRole('button', { name: 'CSV' }))
    await waitFor(() => expect(descargarBlob).toHaveBeenCalledWith(expect.objectContaining({ size: expect.any(Number) }), 'plataforma_2099-02.csv'))
  })
})

describe('auditoría', () => {
  it('filtra y muestra el antes y el después', async () => {
    const f = servidor({
      '/admin/audit': () => pagina([{ id: 'a', actorId: 'adm', accion: 'CAMBIAR_ROL', targetUserId: 'u-1', antes: { rol: 'PASAJERO' }, despues: { rol: 'OPERADOR' }, motivo: 'Contratado', creadoEn: '2099-01-01T12:00:00Z' }]),
    })
    montar(f, () => h(Auditoria))
    expect(await screen.findByText('PASAJERO')).toBeTruthy()
    expect(screen.getByText('OPERADOR')).toBeTruthy()
    expect(screen.getByText('Motivo: Contratado')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Acción'), { target: { value: 'SUSPENDER' } })
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2099-01-01' } })
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2099-01-31' } })
    await waitFor(() =>
      expect(f.mock.calls.some(([u]) => String(u).includes('accion=SUSPENDER&desde=2099-01-01T05%3A00%3A00.000Z&hasta=2099-02-01T05%3A00%3A00.000Z'))).toBe(true),
    )
  })

  it('sin registros lo dice', async () => {
    montar(servidor({ '/admin/audit': () => pagina([]) }), () => h(Auditoria))
    expect(await screen.findByText('No hay registros con esos filtros.')).toBeTruthy()
  })
})

describe('terminales', () => {
  it('crea, edita y borra terminales', async () => {
    const t = { id: 't-1', ciudad: 'Tunja', nombre: 'Terminal Tunja', direccion: 'Cra 7', lat: 5.5, lng: -73.3 }
    const f = servidor({
      '/terminals/t-1': () => Response.json({ error: { code: 'TERMINAL_IN_USE', message: 'x' } }, { status: 409 }),
      '/terminals': (_u, i) => (i?.method === 'POST' ? Response.json(t, { status: 201 }) : Response.json([t])),
    })
    montar(f, () => h(Terminales))
    fireEvent.click(await screen.findByRole('button', { name: 'Agregar terminal' }))
    let hoja = await screen.findByRole('dialog')
    for (const [campo, v] of [['Ciudad', 'Cali'], ['Nombre', 'Terminal Cali'], ['Dirección', 'Calle 30'], ['Latitud', '3.45'], ['Longitud', '-76.53']]) {
      fireEvent.change(within(hoja).getByLabelText(campo), { target: { value: v } })
    }
    fireEvent.click(within(hoja).getByRole('button', { name: 'Guardar' }))
    await exito('Guardamos los cambios.')
    expect(cuerpo(f, '/terminals', 'POST')).toEqual({ ciudad: 'Cali', nombre: 'Terminal Cali', direccion: 'Calle 30', lat: 3.45, lng: -76.53 })

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: /Terminal Tunja/ }))
    hoja = await screen.findByRole('dialog')
    fireEvent.click(within(hoja).getByRole('button', { name: 'Quitar' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, quitar' }))
    await exito('La terminal es parada de alguna ruta.')
  })
})
