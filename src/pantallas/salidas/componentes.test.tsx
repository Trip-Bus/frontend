// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createElement as h, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DiaCalendario, EmpresaFaceta } from '@/lib/tipos'
import { FilaDias } from './FilaDias'
import { ListaEmpresas } from './ListaEmpresas'
import { RangoPrecio } from './RangoPrecio'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('fila de días', () => {
  const fechas = ['2099-01-10', '2099-01-11', '2099-01-12', '2099-01-13']
  const dias: DiaCalendario[] = [
    { fecha: '2099-01-10', precioMinimo: 85_500, viajes: 3, hayCupo: true },
    { fecha: '2099-01-11', precioMinimo: null, viajes: 2, hayCupo: false },
    { fecha: '2099-01-12', precioMinimo: null, viajes: 0, hayCupo: null },
  ]

  it('precio exacto con "desde", lleno y sin salidas deshabilitado', () => {
    const alElegir = vi.fn()
    render(h(FilaDias, { fechas, dias, elegida: '2099-01-10', alElegir }))
    const [d1, d2, d3, d4] = screen.getAllByRole('tab')
    expect(d1.getAttribute('aria-selected')).toBe('true')
    expect(within(d1).getByText('desde')).toBeTruthy()
    expect(within(d1).getByText('$85.500')).toBeTruthy()
    expect(within(d2).getByText('lleno')).toBeTruthy()
    expect(within(d3).getByText('sin salidas')).toBeTruthy()
    expect((d3 as HTMLButtonElement).disabled).toBe(true)
    // Un día que el calendario no trajo cuenta como sin salidas.
    expect(within(d4).getByText('sin salidas')).toBeTruthy()
    fireEvent.click(d2)
    fireEvent.click(d3)
    expect(alElegir).toHaveBeenCalledTimes(1)
    expect(alElegir).toHaveBeenCalledWith('2099-01-11')
  })

  it('mientras carga muestra puntos y el día elegido sin salidas sigue habilitado', () => {
    const { rerender } = render(h(FilaDias, { fechas, dias: undefined, elegida: '2099-01-10', alElegir: vi.fn() }))
    expect(screen.getAllByText('···')).toHaveLength(4)
    rerender(h(FilaDias, { fechas, dias: [{ fecha: '2099-01-10', precioMinimo: null, viajes: 1, hayCupo: null }], elegida: '2099-01-12', alElegir: vi.fn() }))
    const [d1, , d3] = screen.getAllByRole('tab')
    expect(within(d1).getByText('—')).toBeTruthy()
    expect((d3 as HTMLButtonElement).disabled).toBe(false)
  })
})

describe('rango de precio', () => {
  const limites = { min: 45_500, max: 85_500 }

  function Rango({ alCambiar }: { alCambiar?: (v: [number, number]) => void }) {
    const [valor, setValor] = useState<[number, number]>([limites.min, limites.max])
    return h(RangoPrecio, {
      limites,
      valor,
      alCambiar: (v: [number, number]) => {
        alCambiar?.(v)
        setValor(v)
      },
    })
  }

  const montar = (alCambiar?: (v: [number, number]) => void) => {
    const { container } = render(h(Rango, { alCambiar }))
    const pista = container.querySelector<HTMLElement>('[data-pista]')!
    vi.spyOn(pista, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 200, top: 0, height: 44, right: 200, bottom: 44, x: 0, y: 0, toJSON: () => ({}) })
    const [minimo, maximo] = screen.getAllByRole('slider')
    return { pista, minimo, maximo }
  }

  const salida = () => screen.getByRole('status').textContent

  it('accesible: dos manijas con sus valores y "Cualquier precio" en los extremos', () => {
    const { minimo, maximo } = montar()
    expect(screen.getByRole('group', { name: 'Precio' })).toBeTruthy()
    expect(minimo.getAttribute('aria-label')).toBe('Precio mínimo')
    expect(minimo.getAttribute('aria-valuemin')).toBe('45500')
    expect(minimo.getAttribute('aria-valuemax')).toBe('85500')
    expect(minimo.getAttribute('aria-valuenow')).toBe('45500')
    expect(maximo.getAttribute('aria-valuetext')).toBe('$85.500')
    expect(salida()).toBe('Cualquier precio')
  })

  it('con el teclado: flechas de 1.000, PageUp/PageDown de 10.000, Inicio y Fin', () => {
    const { minimo, maximo } = montar()
    fireEvent.keyDown(minimo, { key: 'ArrowRight' })
    expect(minimo.getAttribute('aria-valuenow')).toBe('46000')
    expect(salida()).toBe('$46.000 – $85.500')
    expect(maximo.getAttribute('aria-valuemin')).toBe('46000')
    fireEvent.keyDown(minimo, { key: 'ArrowLeft' })
    expect(minimo.getAttribute('aria-valuenow')).toBe('45500')
    fireEvent.keyDown(minimo, { key: 'PageUp' })
    expect(minimo.getAttribute('aria-valuenow')).toBe('55000')
    fireEvent.keyDown(minimo, { key: 'ArrowUp' })
    fireEvent.keyDown(minimo, { key: 'ArrowDown' })
    fireEvent.keyDown(minimo, { key: 'PageDown' })
    expect(minimo.getAttribute('aria-valuenow')).toBe('45500')
    fireEvent.keyDown(maximo, { key: 'ArrowLeft' })
    expect(maximo.getAttribute('aria-valuenow')).toBe('85000')
    fireEvent.keyDown(maximo, { key: 'Home' })
    expect(maximo.getAttribute('aria-valuenow')).toBe('45500')
    fireEvent.keyDown(minimo, { key: 'End' })
    expect(minimo.getAttribute('aria-valuenow')).toBe('45500')
    fireEvent.keyDown(maximo, { key: 'End' })
    expect(maximo.getAttribute('aria-valuenow')).toBe('85500')
    fireEvent.keyDown(minimo, { key: 'End' })
    expect(minimo.getAttribute('aria-valuenow')).toBe('85500')
    fireEvent.keyDown(minimo, { key: 'Tab' })
    expect(salida()).toBe('$85.500 – $85.500')
  })

  it('con el ratón: toca la barra, mueve la manija más cercana y arrastra hasta soltar', () => {
    const alCambiar = vi.fn()
    const { pista, minimo, maximo } = montar(alCambiar)
    fireEvent.pointerDown(pista, { button: 0, clientX: 100, pointerId: 1 })
    expect(maximo.getAttribute('aria-valuenow')).toBe('66000')
    expect(document.activeElement).toBe(maximo)
    fireEvent.pointerMove(pista, { clientX: 150, pointerId: 1 })
    expect(maximo.getAttribute('aria-valuenow')).toBe('76000')
    fireEvent.pointerMove(pista, { clientX: 10, pointerId: 1 })
    expect(maximo.getAttribute('aria-valuenow')).toBe('48000')
    fireEvent.pointerUp(pista, { pointerId: 1 })
    const llamadas = alCambiar.mock.calls.length
    fireEvent.pointerMove(pista, { clientX: 190, pointerId: 1 })
    expect(alCambiar).toHaveBeenCalledTimes(llamadas)
    // Cerca del borde vuelve al extremo real; cerca de la mínima, se mueve la mínima.
    fireEvent.pointerDown(pista, { button: 0, clientX: 199, pointerId: 2 })
    expect(maximo.getAttribute('aria-valuenow')).toBe('85500')
    fireEvent.pointerCancel(pista, { pointerId: 2 })
    fireEvent.pointerDown(pista, { button: 0, clientX: 20, pointerId: 3 })
    expect(minimo.getAttribute('aria-valuenow')).toBe('50000')
    fireEvent.pointerUp(pista, { pointerId: 3 })
    expect(salida()).toBe('$50.000 – $85.500')
  })

  it('ignora el botón derecho y una barra sin tamaño', () => {
    const alCambiar = vi.fn()
    const { pista } = montar(alCambiar)
    fireEvent.pointerDown(pista, { button: 2, clientX: 100 })
    vi.spyOn(pista, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 0, top: 0, height: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}) })
    fireEvent.pointerDown(pista, { button: 0, clientX: 100 })
    expect(alCambiar).not.toHaveBeenCalled()
  })
})

describe('lista de empresas', () => {
  const e = (id: string, nombre: string, terminal: string | null, viajes: number): EmpresaFaceta => ({ id, nombre, terminal, viajes })
  const empresas = [e('1', 'Bolivariano', 'Terminal Salitre', 3), e('2', 'Copetrán', 'Terminal del Norte', 1), e('3', 'Duitama', null, 0)]

  it('desde Bogotá agrupa por terminal, cuenta las salidas y deshabilita las que no tienen', () => {
    const alCambiar = vi.fn()
    render(h(ListaEmpresas, { empresas, origen: 'Bogotá', valor: undefined, alCambiar }))
    const lista = screen.getByRole('group', { name: 'Empresa' })
    expect(within(lista).getAllByRole('group').map((g) => g.getAttribute('aria-label'))).toEqual(['Terminal Salitre', 'Terminal del Norte', 'Otras'])
    const todas = screen.getByRole('radio', { name: 'Todas las empresas' }) as HTMLInputElement
    expect(todas.checked).toBe(true)
    expect(screen.getByRole('radio', { name: /Bolivariano/ }).closest('label')!.textContent).toContain('3 salidas')
    expect(screen.getByRole('radio', { name: /Copetrán/ }).closest('label')!.textContent).toContain('1 salida')
    const duitama = screen.getByRole('radio', { name: /Duitama/ }) as HTMLInputElement
    expect(duitama.disabled).toBe(true)
    expect(duitama.closest('label')!.textContent).toContain('sin salidas este día')
    fireEvent.click(screen.getByRole('radio', { name: /Copetrán/ }))
    expect(alCambiar).toHaveBeenCalledWith('2')
  })

  it('busca sin tildes, avisa si no hay coincidencias y vuelve a "Todas las empresas"', () => {
    const alCambiar = vi.fn()
    render(h(ListaEmpresas, { empresas, origen: 'Bogotá', valor: '1', alCambiar }))
    const buscar = screen.getByRole('searchbox', { name: 'Buscar empresa' })
    fireEvent.change(buscar, { target: { value: 'copetran' } })
    expect(screen.queryByRole('radio', { name: /Bolivariano/ })).toBeNull()
    expect(screen.getByRole('radio', { name: /Copetrán/ })).toBeTruthy()
    fireEvent.change(buscar, { target: { value: 'xyz' } })
    expect(screen.getByText('Ninguna empresa coincide con “xyz”.')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Todas las empresas' }))
    expect(alCambiar).toHaveBeenCalledWith(undefined)
  })

  it('desde otra ciudad no agrupa; sin empresas avisa y mientras carga muestra el esqueleto', () => {
    const { rerender } = render(h(ListaEmpresas, { empresas, origen: 'Tunja', valor: undefined, alCambiar: vi.fn() }))
    expect(within(screen.getByRole('group', { name: 'Empresa' })).queryAllByRole('group')).toHaveLength(0)
    expect(screen.getAllByRole('radio')).toHaveLength(4)
    rerender(h(ListaEmpresas, { empresas: [], origen: 'Tunja', valor: undefined, alCambiar: vi.fn(), cargando: true }))
    expect(screen.getByLabelText('Cargando empresas')).toBeTruthy()
    expect(screen.queryByRole('searchbox')).toBeNull()
    rerender(h(ListaEmpresas, { empresas: [], origen: 'Tunja', valor: undefined, alCambiar: vi.fn() }))
    expect(screen.getByText('No hay empresas en esta ruta.')).toBeTruthy()
  })
})
