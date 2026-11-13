// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { descargarJson, descargarTexto } from './descarga'

const descriptorOriginal = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')

afterEach(() => {
  vi.useRealTimers()
  if (descriptorOriginal) Object.defineProperty(URL, 'createObjectURL', descriptorOriginal)
  else Reflect.deleteProperty(URL, 'createObjectURL')
  vi.restoreAllMocks()
})

describe('descargas locales', () => {
  it('descarga JSON y texto con su tipo MIME y revoca las URLs temporales', () => {
    vi.useFakeTimers()
    const crearUrl = vi.fn((_blob: Blob) => 'blob:tripbus')
    const revocarUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: crearUrl })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    descargarJson({ nombre: 'TripBus' }, 'datos.json')
    descargarTexto('códigos', 'recuperacion.txt')

    expect(crearUrl).toHaveBeenCalledTimes(2)
    expect((crearUrl.mock.calls[0][0] as Blob).type).toBe('application/json;charset=utf-8')
    expect((crearUrl.mock.calls[1][0] as Blob).type).toBe('text/plain;charset=utf-8')
    expect(click).toHaveBeenCalledTimes(2)
    expect(document.querySelectorAll('a')).toHaveLength(0)

    vi.advanceTimersByTime(1000)
    expect(revocarUrl).toHaveBeenCalledTimes(2)
    expect(revocarUrl).toHaveBeenCalledWith('blob:tripbus')
  })
})
