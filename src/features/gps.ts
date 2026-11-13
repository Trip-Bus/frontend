import { useEffect, useRef, useState } from 'react'
import { ApiError, textoError } from '@/lib/api'
import { api } from '@/lib/endpoints'
import type { DetalleItinerario } from '@/lib/tipos'
import { puntoEnRuta } from './seguimiento'
import { ColaGps } from './gpsCola'

/**
 * Envío de posición GPS del bus (US-038) desde el teléfono del conductor.
 *  - 'real': usa el GPS del teléfono (watchPosition) y envía como máximo cada 10 s.
 *  - 'simulado': recorre la ruta entre paradas para la demostración (cada 3 s avanza ~1 %).
 * El backend responde 202 y procesa la posición de forma asíncrona.
 */
export type ModoGps = 'apagado' | 'real' | 'simulado'
type PosicionWakeLock = { release: () => Promise<void> }
type NavegadorWakeLock = Navigator & {
  wakeLock?: { request: (tipo: 'screen') => Promise<PosicionWakeLock> }
}
const colaGps = new ColaGps()

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
  const [pendientes, setPendientes] = useState(colaGps.cantidad)
  const ultimoEnvio = useRef(0)
  const fraccion = useRef(0)

  useEffect(() => {
    if (modo === 'apagado' || !detalle) return
    let activo = true
    let rastreoIniciado = false
    let iniciandoRastreo = false
    let sensoresIniciados = false
    let idGps: number | null = null
    let idSimulador: ReturnType<typeof setInterval> | null = null
    let wakeLock: PosicionWakeLock | null = null
    let enviandoLote = false

    const actualizarPendientes = () => {
      if (activo) setPendientes(colaGps.cantidad)
    }

    const enviarLotePendiente = async () => {
      if (enviandoLote || !navigator.onLine || colaGps.cantidad === 0) return
      enviandoLote = true
      const lote = colaGps.lote()
      try {
        await api.conductor.enviarUbicaciones(lote)
        colaGps.confirmar(lote.length)
        actualizarPendientes()
        if (activo) setError(null)
      } catch (e) {
        if (activo) setError(textoError(e))
      } finally {
        enviandoLote = false
      }
    }

    const alRecuperarConexion = () => {
      void (async () => {
        if (!rastreoIniciado) await asegurarRastreo()
        if (rastreoIniciado) await enviarLotePendiente()
      })()
    }
    globalThis.addEventListener('online', alRecuperarConexion)

    const encolar = (ubicacion: Parameters<typeof api.conductor.enviarUbicacion>[0]) => {
      colaGps.agregar(ubicacion)
      actualizarPendientes()
      if (activo) setError('Sin conexión: guardamos la posición para enviarla al recuperar la red.')
    }

    const enviar = (lat: number, lng: number, precision: number, velocidad: number | null, rumbo: number | null) => {
      const ahora = Date.now()
      if (ahora - ultimoEnvio.current < 8_000) return
      ultimoEnvio.current = ahora
      if (![lat, lng, precision].every(Number.isFinite) || precision < 0) {
        setError('El GPS devolvió una posición inválida. Espera la siguiente lectura.')
        return
      }
      const ubicacion = { lat, lng, precision, velocidad, rumbo, timestamp: new Date(ahora).toISOString() }
      if (!navigator.onLine) {
        encolar(ubicacion)
        return
      }
      void api.conductor.enviarUbicacion(ubicacion).then((respuesta) => {
        if (!activo) return
        if (respuesta?.aceptada === false) {
          setError(respuesta.motivo ?? 'El servidor descartó esta posición por precisión o salto de ruta.')
          return
        }
        setUltimo({ lat, lng, en: Date.now() })
        setError(null)
      }).catch((e: unknown) => {
        if ((e instanceof ApiError && e.code === 'SIN_CONEXION') || !navigator.onLine) {
          encolar(ubicacion)
          return
        }
        if (activo) setError(textoError(e))
      })
    }

    const iniciarSensores = async () => {
      if (sensoresIniciados || !activo) return
      sensoresIniciados = true
      const soporteWakeLock = (navigator as NavegadorWakeLock).wakeLock
      if (soporteWakeLock) {
        try {
          wakeLock = await soporteWakeLock.request('screen')
        } catch {
          if (activo) setError('No pudimos mantener la pantalla activa. Déjala desbloqueada durante el viaje.')
        }
      }
      if (!activo) {
        if (wakeLock) void wakeLock.release()
        return
      }

      if (modo === 'real') {
        idGps = navigator.geolocation.watchPosition(
          (p) => {
            const kmh = p.coords.speed != null ? Math.min(200, Math.max(0, p.coords.speed * 3.6)) : null
            const rumbo = p.coords.heading != null && !Number.isNaN(p.coords.heading) ? p.coords.heading : null
            enviar(p.coords.latitude, p.coords.longitude, p.coords.accuracy, kmh, rumbo)
          },
          (e) => {
            setError(e.code === e.PERMISSION_DENIED ? 'Activa el permiso de ubicación para compartir el GPS.' : 'No pudimos leer el GPS del teléfono.')
            setModo('apagado')
          },
          { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
        )
        return
      }

      fraccion.current = fraccionPorHora(detalle)
      const paso = () => {
        const p = puntoEnRuta(detalle.paradas, fraccion.current)
        enviar(p.lat, p.lng, 15, 60 + Math.round(Math.random() * 25), Math.round(p.rumbo))
        fraccion.current = Math.min(1, fraccion.current + 0.01)
      }
      paso()
      idSimulador = setInterval(paso, 8_000)
    }

    const asegurarRastreo = async () => {
      if (rastreoIniciado || iniciandoRastreo || !activo) return
      if (!navigator.onLine) {
        await iniciarSensores()
        return
      }
      iniciandoRastreo = true
      try {
        await api.conductor.iniciarRastreo()
        rastreoIniciado = true
        if (activo) {
          await iniciarSensores()
          await enviarLotePendiente()
        }
        else await api.conductor.detenerRastreo()
      } catch (e) {
        if (activo && ((e instanceof ApiError && e.code === 'SIN_CONEXION') || !navigator.onLine)) {
          setError('Sin conexión: el GPS se guardará y se enviará cuando vuelva la red.')
          await iniciarSensores()
        } else if (activo) {
          setError(textoError(e))
          setModo('apagado')
        }
      } finally {
        iniciandoRastreo = false
      }
    }

    void asegurarRastreo()

    return () => {
      activo = false
      globalThis.removeEventListener('online', alRecuperarConexion)
      if (idGps !== null) navigator.geolocation.clearWatch(idGps)
      if (idSimulador !== null) clearInterval(idSimulador)
      if (wakeLock) void wakeLock.release().catch((e: unknown) => console.error('No se pudo liberar Wake Lock:', e))
      if (rastreoIniciado) void api.conductor.detenerRastreo().catch((e: unknown) => console.error('No se pudo detener el rastreo GPS:', e))
    }
  }, [modo, detalle])

  const cambiarModo = (nuevo: ModoGps) => {
    if (nuevo === 'real' && !('geolocation' in navigator)) {
      setError('Este teléfono no tiene GPS disponible en el navegador.')
      return
    }
    setError(null)
    setModo(nuevo)
  }

  return { modo, setModo: cambiarModo, ultimo, error, pendientes }
}
