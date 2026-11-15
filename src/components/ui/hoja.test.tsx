// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Hoja } from './hoja'

afterEach(cleanup)

describe('hoja inferior', () => {
  it('muestra el contenido y la descripción opcional', () => {
    const alCambiar = vi.fn()
    render(
      <Hoja abierta alCambiar={alCambiar} titulo="Detalle" descripcion="Información del viaje">
        <p>Asientos disponibles</p>
      </Hoja>,
    )

    expect(screen.getByText('Detalle')).toBeTruthy()
    expect(screen.getByText('Información del viaje')).toBeTruthy()
    expect(screen.getByText('Asientos disponibles')).toBeTruthy()
  })

  it('usa el título como descripción accesible si no se proporciona', () => {
    render(
      <Hoja abierta alCambiar={vi.fn()} titulo="Confirmación">
        <p>Contenido</p>
      </Hoja>,
    )

    const dialog = screen.getByRole('dialog')
    const descripcionId = dialog.getAttribute('aria-describedby')
    expect(descripcionId).not.toBeNull()
    expect(document.getElementById(descripcionId!)?.textContent).toBe('Confirmación')
    expect(screen.getByText('Contenido')).toBeTruthy()
  })
})
