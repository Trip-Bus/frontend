// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { sesion } from '@/lib/sesion'
import { InicioAdmin } from './InicioAdmin'
import { Usuarios } from './Usuarios'

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }))
vi.mock('sonner', () => ({ toast }))

type Rutas = Record<string, (url: string, init?: RequestInit) => Response>
const pagina = (content: unknown[], totalPages = 1) => Response.json({ content, page: 0, size: 20, totalElements: content.length, totalPages })

function servidor(rutas: Rutas) {
  return vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = String(entrada)
    const clave = Object.keys(rutas).find((k) => url.includes(k))
    if (clave) return rutas[clave](url, init)
    if (url.includes('/companies')) return pagina([{ id: 'c-1', nombre: 'Expreso' }])
    return Response.json({})
  })
}

function montar(fetchMock: ReturnType<typeof servidor>, componente: () => ReturnType<typeof h>) {
  sesion.iniciar({ accessToken: 'a', expiresAt: new Date(Date.now() + 3_600_000).toISOString(), userId: 'adm', rol: 'ADMIN' })
  vi.stubGlobal('fetch', fetchMock)
  const router = createMemoryRouter([{ path: '/admin', element: componente() }, { path: '*', element: h('p', null, 'Otra') }], { initialEntries: ['/admin'] })
  render(h(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }) }, h(RouterProvider, { router })))
}

const usuario = (u: Record<string, unknown> = {}) => ({ id: 'u-1', email: 'ana@x.co', nombre: 'Ana', rol: 'PASAJERO', companyId: null, activo: true, ...u })
const con = (f: ReturnType<typeof servidor>, parte: string, metodo: string) => f.mock.calls.filter(([u, i]) => String(u).includes(parte) && i?.method === metodo)

beforeEach(() => localStorage.clear())
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  sesion.cerrar()
})

describe('administración', () => {
  it('el inicio enlaza todas las secciones y la navegación', async () => {
    montar(servidor({}), () => h(InicioAdmin))
    expect(screen.getByRole('heading', { name: 'Administración' })).toBeTruthy()
    const nav = screen.getByRole('navigation', { name: 'Secciones' })
    expect(within(nav).getByRole('link', { name: 'Usuarios' }).getAttribute('href')).toBe('/admin/usuarios')
    expect(within(nav).queryByRole('link', { name: 'Taquilla' })).toBeNull()
    expect(screen.getByRole('link', { name: /Pantallas del operador/ }).getAttribute('href')).toBe('/operador')
  })

  it('busca y filtra usuarios', async () => {
    const fetchMock = servidor({
      '/users?': (url) =>
        url.includes('page=1') ? pagina([usuario({ id: 'u-3', nombre: 'Carlos' })], 2) : pagina([usuario({}), usuario({ id: 'u-2', nombre: 'Op', rol: 'OPERADOR', companyId: 'c-1', activo: false })], 2),
    })
    montar(fetchMock, () => h(Usuarios))
    expect(await screen.findByText('Suspendida')).toBeTruthy()
    expect((await screen.findAllByText(/ana@x.co/)).length).toBeGreaterThan(0)
    expect(await screen.findByText('ana@x.co · Expreso')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }))
    expect(await screen.findByText('Carlos')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: ' ana ' } })
    fireEvent.submit(screen.getByLabelText('Buscar').closest('form')!)
    fireEvent.change(screen.getByLabelText('Rol'), { target: { value: 'OPERADOR' } })
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'false' } })
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).includes('q=ana&rol=OPERADOR&activo=false'))).toBe(true))
  })

  it('crea un operador con su empresa', async () => {
    const fetchMock = servidor({ '/users?': () => pagina([]), '/users': () => Response.json(usuario({ rol: 'OPERADOR' }), { status: 201 }) })
    montar(fetchMock, () => h(Usuarios))
    expect(await screen.findByText('No hay usuarios con esos filtros.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Crear operador o conductor' }))
    const hoja = await screen.findByRole('dialog')
    fireEvent.change(within(hoja).getByLabelText('Nombre completo'), { target: { value: 'Luis Gómez' } })
    fireEvent.change(within(hoja).getByLabelText('Correo'), { target: { value: 'luis@x.co' } })
    fireEvent.change(within(hoja).getByLabelText('Documento de identidad'), { target: { value: '10203040' } })
    fireEvent.change(within(hoja).getByLabelText('Rol'), { target: { value: 'CONDUCTOR' } })
    await within(hoja).findByRole('option', { name: 'Expreso' })
    fireEvent.change(within(hoja).getByLabelText('Empresa'), { target: { value: 'c-1' } })
    fireEvent.click(within(hoja).getByRole('button', { name: 'Crear la cuenta' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Creamos la cuenta. Le enviamos un correo para que defina su contraseña.'))
    expect(JSON.parse(String(con(fetchMock, '/users', 'POST')[0][1]?.body))).toEqual({ nombre: 'Luis Gómez', email: 'luis@x.co', documentoIdentidad: '10203040', rol: 'CONDUCTOR', companyId: 'c-1' })
  })

  it('cambia el rol, suspende con motivo, desbloquea y muestra errores', async () => {
    const fetchMock = servidor({
      '/users?': () => pagina([usuario({})]),
      '/users/u-1/role': () => Response.json(usuario({ rol: 'OPERADOR' })),
      '/users/u-1/estado': () => Response.json({ error: { code: 'CANNOT_SUSPEND_SELF', message: 'x' } }, { status: 400 }),
      '/users/u-1/lock': () => new Response(null, { status: 204 }),
    })
    montar(fetchMock, () => h(Usuarios))
    const abrir = async () => fireEvent.click(await screen.findByRole('button', { name: /Ana/ }))

    await abrir()
    let hoja = await screen.findByRole('dialog')
    fireEvent.change(within(hoja).getByRole('combobox', { name: 'Rol' }), { target: { value: 'OPERADOR' } })
    expect((within(hoja).getByRole('button', { name: 'Guardar el rol' }) as HTMLButtonElement).disabled).toBe(true)
    await within(hoja).findByRole('option', { name: 'Expreso' })
    fireEvent.change(within(hoja).getByLabelText('Empresa'), { target: { value: 'c-1' } })
    fireEvent.click(within(hoja).getByRole('button', { name: 'Guardar el rol' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Cambiamos el rol.'))
    expect(JSON.parse(String(con(fetchMock, '/role', 'PUT')[0][1]?.body))).toEqual({ rol: 'OPERADOR', companyId: 'c-1' })

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await abrir()
    hoja = await screen.findByRole('dialog')
    fireEvent.click(within(hoja).getByRole('button', { name: 'Desbloquear (intentos fallidos)' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Desbloqueamos la cuenta.'))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await abrir()
    fireEvent.click(await screen.findByRole('button', { name: 'Suspender la cuenta' }))
    fireEvent.change(await screen.findByLabelText('Motivo (queda en la auditoría)'), { target: { value: 'Uso indebido' } })
    fireEvent.click(screen.getByRole('button', { name: 'Suspender' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith('No puedes suspender tu propia cuenta.'))
    expect(JSON.parse(String(con(fetchMock, '/estado', 'PATCH')[0][1]?.body))).toEqual({ activo: false, motivo: 'Uso indebido' })
  })
})
