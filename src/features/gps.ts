import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/endpoints'
import { textoError } from '@/lib/api'
import type { DetalleItinerario } from '@/lib/tipos'
import { puntoEnRuta } from './seguimiento'

/**
 * Envío de posición GPS del bus (US-038) desde el teléfono del conductor.
 *  - 'real': usa el GPS del teléfono (watchPosition) y envía como máximo cada 10 s.
 *  - 'simulado': recorre la ruta entre paradas para la demostración (cada 3 s avanza ~1 %).
 * El backend responde 202 y procesa la posición de forma asíncrona.
 */
export type ModoGps = 'apagado' | 'real' | 'simulado'

export function fraccionPorHora(d: DetalleItinerario, ahora = Date.now()): number {
  const ini = new Date(d.fechaSalida).getTime()
  const fin = new Date(d.fechaLlegadaEstimada).getTime()
  if (fin <= ini) return 0
  return Math.max(0, Math.min(1, (ahora - ini) / (fin - ini)))
}

export function useEnvioGps(detalle: DetalleItinerario | undefined) {
  const [modo, setModo] = useState<ModoGps>('apagado')
  const [ultimo, setUltimo] = useState<{ lat: number; lng: number; en: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ultimoEnvio = useRef(0)
  const fraccion = useRef(0)

  useEffect(() => {
    if (modo === 'apagado' || !detalle) return
    const base = { busId: detalle.busId, itineraryId: detalle.itineraryId }

    const enviar = (lat: number, lng: number, velocidad: number | null, rumbo: number | null) => {
      ultimoEnvio.current = Date.now()
      api.viaje
        .enviarPosicion({ ...base, lat, lng, velocidad, rumbo })
        .then(() => {
          setUltimo({ lat, lng, en: Date.now() })
          setError(null)
        })
        .catch((e) => setError(textoError(e)))
    }

    if (modo === 'real') {
      const id = navigator.geolocation.watchPosition(
        (p) => {
          if (Date.now() - ultimoEnvio.current < 10_000) return
          const kmh = p.coords.speed != null ? Math.min(200, Math.max(0, p.coords.speed * 3.6)) : null
          const rumbo = p.coords.heading != null && !Number.isNaN(p.coords.heading) ? p.coords.heading : null
          enviar(p.coords.latitude, p.coords.longitude, kmh, rumbo)
        },
        (e) => {
          setError(e.code === e.PERMISSION_DENIED ? 'Activa el permiso de ubicación para compartir el GPS.' : 'No pudimos leer el GPS del teléfono.')
          setModo('apagado')
        },
        { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
      )
      return () => navigator.geolocation.clearWatch(id)
    }

    // Simulado: arranca donde "debería" ir según la hora (o en el origen si aún no sale).
    fraccion.current = fraccionPorHora(detalle)
    const paso = () => {
      const p = puntoEnRuta(detalle.paradas, fraccion.current)
      enviar(p.lat, p.lng, 60 + Math.round(Math.random() * 25), Math.round(p.rumbo))
      fraccion.current = Math.min(1, fraccion.current + 0.01)
    }
    paso()
    const id = setInterval(paso, 3_000)
    return () => clearInterval(id)
  }, [modo, detalle])

  const cambiarModo = (nuevo: ModoGps) => {
    if (nuevo === 'real' && !('geolocation' in navigator)) {
      setError('Este teléfono no tiene GPS disponible en el navegador.')
      return
    }
    setError(null)
    setModo(nuevo)
  }

  return { modo, setModo: cambiarModo, ultimo, error }
}
