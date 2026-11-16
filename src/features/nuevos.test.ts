// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { campoDesdeInstante, fechaHora, instanteDesdeCampo, mesActual, porcentaje } from '@/lib/formato'
import { avisos, describirAviso, reembolsoDe } from './avisos'
import { conEmpresa } from './empresa'
import { cargarGoogle, reiniciarGoogle, SCRIPT_GOOGLE } from './google'
import { celularValido, claveDePago, MOTIVOS_RECHAZO } from './pagos'
import { elementosDe, siguientePagina } from './paginacion'
import { esAlertaMaxima, sonarAlerta } from './sonido'

afterEach(() => {
  avisos.limpiar()
  vi.unstubAllGlobals()
  reiniciarGoogle()
  delete window.google
  document.head.innerHTML = ''
})

describe('paginación', () => {
  it('lee content o items y calcula la siguiente página', () => {
    expect(elementosDe({ content: [1, 2], page: 0, size: 2, totalElements: 4, totalPages: 2 })).toEqual([1, 2])
    expect(elementosDe({ items: ['a'], page: 0, size: 1, totalElements: 1, totalPages: 1 })).toEqual(['a'])
    expect(elementosDe(undefined)).toEqual([])
    expect(siguientePagina({ page: 0, size: 2, totalElements: 4, totalPages: 2 }, 1)).toBe(1)
    expect(siguientePagina({ page: 1, size: 2, totalElements: 4, totalPages: 2 }, 2)).toBeUndefined()
    expect(siguientePagina(null, 0)).toBeUndefined()
  })
})

describe('avisos del pasajero', () => {
  it('guarda avisos sin repetir, cuenta los leídos y recuerda el reembolso', () => {
    const oyente = vi.fn()
    const soltar = avisos.suscribir(oyente)
    avisos.agregar('RefundProcessed', { bookingId: 'b1', refundId: 'r1' }, 'e1')
    avisos.agregar('RefundProcessed', { bookingId: 'b1', refundId: 'r1' }, 'e1')
    avisos.agregar('TicketIssued', null, 'e2')
    expect(avisos.lista()).toHaveLength(2)
    expect(avisos.lista().every((a) => !a.leido)).toBe(true)
    expect(reembolsoDe('b1')).toBe('r1')
    expect(reembolsoDe('otra')).toBeNull()
    avisos.marcarLeidos()
    expect(avisos.lista().every((a) => a.leido)).toBe(true)
    avisos.recargar()
    expect(avisos.lista()).toHaveLength(2)
    expect(oyente).toHaveBeenCalled()
    soltar()
  })

  it('sigue en memoria si el almacenamiento falla', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('bloqueado')
      },
      setItem: () => {
        throw new Error('bloqueado')
      },
    })
    avisos.agregar('OfferAlert', { offerId: 'o' }, 'x')
    expect(avisos.lista()).toHaveLength(1)
    avisos.recargar()
    expect(avisos.lista()).toEqual([])
  })

  it.each([
    ['BookingAffected', { causa: 'CANCELACION' }, '/afectados'],
    ['BookingAffected', { causa: 'RETRASO' }, '/afectados'],
    ['BookingRelocated', {}, '/mis-tiquetes'],
    ['RefundProcessed', {}, '/mis-tiquetes?pestana=pasados'],
    ['TicketRescheduled', { ticketIdNuevo: 't2' }, '/pase/t2'],
    ['TicketRescheduled', {}, '/mis-tiquetes'],
    ['TicketUpdated', { ticketId: 't', cambio: 'ASIENTO' }, '/pase/t'],
    ['TicketUpdated', { cambio: 'PASAJERO' }, '/mis-tiquetes'],
    ['TicketIssued', { ticketId: 't' }, '/pase/t'],
    ['TicketIssued', {}, '/mis-tiquetes'],
    ['TicketNoShow', {}, '/mis-tiquetes?pestana=pasados'],
    ['WaitlistSeatOffered', {}, '/mis-turnos'],
    ['WaitlistClosed', {}, '/mis-turnos'],
    ['OfferAlert', { offerId: 'o', origen: 'A', destino: 'B' }, '/drop/o'],
    ['OfferAlert', {}, '/ofertas'],
    ['OfferQueueAdmitted', { offerId: 'o' }, '/drop/o'],
    ['OfferQueueAdmitted', {}, '/ofertas'],
    ['Otro', {}, '/mis-tiquetes'],
  ])('%s abre %s', (evento, data, destino) => {
    const d = describirAviso({ evento, data: data as Record<string, unknown> })
    expect(d.a).toBe(destino)
    expect(d.titulo.length).toBeGreaterThan(0)
  })
})

describe('pagos', () => {
  it('reutiliza la misma clave por reserva y método', () => {
    const tarjeta = claveDePago('b-1')
    expect(claveDePago('b-1')).toBe(tarjeta)
    expect(claveDePago('b-1', 'TARJETA')).toBe(tarjeta)
    const nequi = claveDePago('b-1', 'NEQUI')
    expect(nequi).not.toBe(tarjeta)
    expect(claveDePago('b-1', 'NEQUI')).toBe(nequi)
  })

  it('usa memoria si sessionStorage falla', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new Error('x')
      },
    })
    const k = claveDePago('b-2', 'PSE')
    expect(claveDePago('b-2', 'PSE')).toBe(k)
  })

  it('valida el celular de Nequi', () => {
    expect(celularValido('3991111111')).toBe(true)
    expect(celularValido('399111111')).toBe(false)
    expect(celularValido('6011234567')).toBe(false)
    expect(MOTIVOS_RECHAZO.NEQUI_RECHAZADO).toBeTruthy()
  })
})

describe('empresa activa', () => {
  it('agrega companyId a la ruta', () => {
    expect(conEmpresa('/operador', undefined)).toBe('/operador')
    expect(conEmpresa('/operador', 'c 1')).toBe('/operador?companyId=c%201')
    expect(conEmpresa('/operador?x=1', 'c')).toBe('/operador?x=1&companyId=c')
  })
})

describe('Google Identity Services', () => {
  it('carga el script una sola vez', async () => {
    const promesa = cargarGoogle()
    expect(cargarGoogle()).toBe(promesa)
    const script = document.head.querySelector<HTMLScriptElement>('script')!
    expect(script.src).toBe(SCRIPT_GOOGLE)
    window.google = { accounts: { id: { initialize: vi.fn(), renderButton: vi.fn() } } }
    script.onload?.(new Event('load'))
    await expect(promesa).resolves.toBe(window.google.accounts!.id)
    await expect(cargarGoogle()).resolves.toBe(window.google.accounts!.id)
  })

  it('falla si el script no carga o no expone la API', async () => {
    const promesa = cargarGoogle()
    document.head.querySelector<HTMLScriptElement>('script')!.onerror?.(new Event('error'))
    await expect(promesa).rejects.toThrow('No se pudo cargar')
    const otra = cargarGoogle()
    document.head.querySelectorAll<HTMLScriptElement>('script')[1].onload?.(new Event('load'))
    await expect(otra).rejects.toThrow('no quedó disponible')
  })
})

describe('sonido de alerta', () => {
  it('prioriza SOS, accidentes y gravedad crítica', () => {
    expect(esAlertaMaxima({ tipo: 'SOS' })).toBe(true)
    expect(esAlertaMaxima({ tipo: 'ACCIDENTE' })).toBe(true)
    expect(esAlertaMaxima({ tipo: 'AVERIA', gravedad: 'CRITICA' })).toBe(true)
    expect(esAlertaMaxima({ tipo: 'AVERIA', gravedad: 'MEDIA' })).toBe(false)
  })

  it('suena con Web Audio y no falla sin audio', () => {
    const start = vi.fn()
    const osc = { type: '', frequency: { value: 0 }, connect: vi.fn(), start, stop: vi.fn(), onended: null as null | (() => void) }
    const close = vi.fn(async () => undefined)
    class Contexto {
      currentTime = 0
      destination = {}
      createOscillator = () => osc
      createGain = () => ({ gain: { value: 0 }, connect: vi.fn() })
      close = close
    }
    vi.stubGlobal('AudioContext', Contexto)
    sonarAlerta()
    expect(start).toHaveBeenCalled()
    osc.onended?.()
    expect(close).toHaveBeenCalled()
    vi.stubGlobal('AudioContext', undefined)
    expect(() => sonarAlerta()).not.toThrow()
    vi.stubGlobal('AudioContext', class {
      constructor() {
        throw new Error('bloqueado')
      }
    })
    expect(() => sonarAlerta()).not.toThrow()
  })
})

describe('formato de gestión', () => {
  it('convierte la hora de Colombia de los campos y formatea porcentajes', () => {
    expect(instanteDesdeCampo('2026-11-20T06:30')).toBe('2026-11-20T11:30:00.000Z')
    expect(campoDesdeInstante('2026-11-20T11:30:00Z')).toBe('2026-11-20T06:30')
    expect(fechaHora(null)).toBe('—')
    expect(fechaHora('2026-11-20T11:30:00Z')).toContain('06:30')
    expect(porcentaje(45.67)).toBe('45,7 %')
    expect(porcentaje(null)).toBe('sin dato')
    expect(mesActual()).toMatch(/^\d{4}-\d{2}$/)
  })
})
