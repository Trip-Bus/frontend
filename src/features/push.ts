import { api } from '@/lib/endpoints'

/**
 * Web Push (T-06, US-185): avisos con la app cerrada. El permiso se pide SOLO cuando la persona toca
 * "Activar avisos" (nunca al cargar la página). El service worker (public/sw.js) muestra el aviso y, al tocarlo,
 * abre la pantalla relacionada.
 */
export type EstadoPush = 'no-soportado' | 'bloqueado' | 'activo' | 'inactivo'

export function pushSoportado(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/** La llave VAPID llega en base64url; el navegador la necesita en bytes. */
export function llaveABytes(base64url: string): Uint8Array<ArrayBuffer> {
  const relleno = '='.repeat((4 - (base64url.length % 4)) % 4)
  const base64 = (base64url + relleno).replace(/-/g, '+').replace(/_/g, '/')
  const crudo = atob(base64)
  const bytes = new Uint8Array(new ArrayBuffer(crudo.length))
  for (let i = 0; i < crudo.length; i++) bytes[i] = crudo.charCodeAt(i)
  return bytes
}

async function registro() {
  return navigator.serviceWorker.register('/sw.js')
}

export async function estadoPush(): Promise<EstadoPush> {
  if (!pushSoportado()) return 'no-soportado'
  if (Notification.permission === 'denied') return 'bloqueado'
  const reg = await navigator.serviceWorker.getRegistration('/sw.js')
  const sub = await reg?.pushManager.getSubscription()
  return sub ? 'activo' : 'inactivo'
}

/** Pide permiso, se suscribe con la llave pública y registra la suscripción en el gateway. */
export async function activarPush(): Promise<EstadoPush> {
  if (!pushSoportado()) return 'no-soportado'
  const permiso = await Notification.requestPermission()
  if (permiso !== 'granted') return 'bloqueado'
  const { publicKey } = await api.push.llavePublica()
  const reg = await registro()
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: llaveABytes(publicKey) }))
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
  await api.push.suscribir({ endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } })
  return 'activo'
}

/** Anula la suscripción en el gateway y en el navegador. */
export async function desactivarPush(): Promise<EstadoPush> {
  const reg = await navigator.serviceWorker.getRegistration('/sw.js')
  const sub = await reg?.pushManager.getSubscription()
  if (sub) {
    await api.push.anular(sub.endpoint)
    await sub.unsubscribe()
  }
  return 'inactivo'
}
