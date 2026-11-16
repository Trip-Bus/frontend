import { useSyncExternalStore } from 'react'

/**
 * Avisos privados del pasajero (P-13): lo que llega por `usuario:{id}:avisos` y `usuario:{id}:tiquetes`.
 * Se guardan en el teléfono (máximo 50) para la campana y para recordar datos que no vuelven por REST,
 * como el `refundId` del comprobante de reembolso. Si el navegador no deja guardar, viven en memoria.
 */
export type Aviso = {
  id: string
  evento: string
  data: Record<string, unknown>
  recibidoEn: string
  leido: boolean
}

const CLAVE = 'tripbus.avisos'
const MAXIMO = 50
const oyentes = new Set<() => void>()
let actuales: Aviso[] = leer()

function leer(): Aviso[] {
  try {
    const crudo = globalThis.localStorage?.getItem(CLAVE)
    const lista = crudo ? (JSON.parse(crudo) as Aviso[]) : []
    return Array.isArray(lista) ? lista : []
  } catch {
    return []
  }
}

function guardar(lista: Aviso[]) {
  actuales = lista
  try {
    globalThis.localStorage?.setItem(CLAVE, JSON.stringify(lista))
  } catch {
    /* sin almacenamiento: quedan en memoria */
  }
  oyentes.forEach((o) => o())
}

export const avisos = {
  lista: () => actuales,
  agregar(evento: string, data: unknown, id = `${evento}-${Date.now()}`) {
    if (actuales.some((a) => a.id === id)) return
    const datos = data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
    guardar([{ id, evento, data: datos, recibidoEn: new Date().toISOString(), leido: false }, ...actuales].slice(0, MAXIMO))
  },
  marcarLeidos() {
    if (actuales.some((a) => !a.leido)) guardar(actuales.map((a) => ({ ...a, leido: true })))
  },
  limpiar() {
    guardar([])
  },
  suscribir(oyente: () => void) {
    oyentes.add(oyente)
    return () => oyentes.delete(oyente)
  },
  /** Para recargar desde el almacenamiento (pruebas o cambio de pestaña). */
  recargar() {
    actuales = leer()
    oyentes.forEach((o) => o())
  },
}

export function useAvisos(): Aviso[] {
  return useSyncExternalStore(avisos.suscribir, avisos.lista, avisos.lista)
}

/** `refundId` del reembolso de una reserva, si llegó su aviso RefundProcessed. */
export function reembolsoDe(bookingId: string): string | null {
  const aviso = actuales.find((a) => a.evento === 'RefundProcessed' && a.data.bookingId === bookingId)
  const id = aviso?.data.refundId
  return typeof id === 'string' ? id : null
}

const texto = (v: unknown) => (typeof v === 'string' ? v : '')

/** Título en español y la pantalla que abre cada aviso. */
export function describirAviso(a: Pick<Aviso, 'evento' | 'data'>): { titulo: string; detalle: string; a: string } {
  const d = a.data
  const ruta = d.origen && d.destino ? `${texto(d.origen)} → ${texto(d.destino)}` : ''
  switch (a.evento) {
    case 'BookingAffected':
      return {
        titulo: 'Tu viaje tuvo un cambio',
        detalle:
          d.causa === 'CANCELACION'
            ? 'La empresa canceló el viaje. Elige reprogramar gratis o el reembolso.'
            : 'La empresa cambió la hora del viaje. Elige qué hacer.',
        a: '/afectados',
      }
    case 'BookingRelocated':
      return { titulo: 'Te reubicamos en otro viaje', detalle: 'Tu tiquete nuevo ya está en Mis viajes.', a: '/mis-tiquetes' }
    case 'RefundProcessed':
      return { titulo: 'Te devolvimos el dinero', detalle: 'El comprobante del reembolso está en Mis viajes.', a: '/mis-tiquetes?pestana=pasados' }
    case 'TicketRescheduled':
      return { titulo: 'Reprogramamos tu tiquete', detalle: 'Ya tienes el pase del viaje nuevo.', a: d.ticketIdNuevo ? `/pase/${texto(d.ticketIdNuevo)}` : '/mis-tiquetes' }
    case 'TicketUpdated':
      return {
        titulo: d.cambio === 'ASIENTO' ? 'Cambiamos tu puesto' : 'Corregimos los datos del pasajero',
        detalle: 'Tu pase está actualizado.',
        a: d.ticketId ? `/pase/${texto(d.ticketId)}` : '/mis-tiquetes',
      }
    case 'TicketIssued':
      return { titulo: 'Tu pase de abordar está listo', detalle: 'Ábrelo aunque no tengas señal.', a: d.ticketId ? `/pase/${texto(d.ticketId)}` : '/mis-tiquetes' }
    case 'TicketNoShow':
      return {
        titulo: 'No alcanzaste a abordar',
        detalle: 'Puedes reprogramar en las próximas 24 horas con un cargo del 20 %.',
        a: '/mis-tiquetes?pestana=pasados',
      }
    case 'WaitlistSeatOffered':
      return { titulo: '¡Te guardamos tu silla!', detalle: 'Tienes 10 minutos para comprarla.', a: '/mis-turnos' }
    case 'WaitlistClosed':
      return { titulo: 'La lista de espera cerró', detalle: 'Ya no se liberarán puestos para ese viaje.', a: '/mis-turnos' }
    case 'OfferAlert':
      return { titulo: 'Nueva oferta en tu ruta', detalle: ruta || 'Mira la oferta antes de que se agote.', a: d.offerId ? `/drop/${texto(d.offerId)}` : '/ofertas' }
    case 'OfferQueueAdmitted':
      return { titulo: '¡Es tu turno!', detalle: 'Tienes 5 minutos para comprar en la oferta.', a: d.offerId ? `/drop/${texto(d.offerId)}` : '/ofertas' }
    default:
      return { titulo: 'Tienes un aviso nuevo', detalle: '', a: '/mis-tiquetes' }
  }
}
