/**
 * Google Identity Services (flujo de ID token, sin client secret). El script se carga una sola vez y solo si
 * GET /auth/providers dice que Google está encendido; el clientId llega del backend, nunca va en el código.
 */
export const SCRIPT_GOOGLE = 'https://accounts.google.com/gsi/client'

export type RespuestaCredencial = { credential: string }

export type GoogleId = {
  initialize: (opciones: { client_id: string; callback: (r: RespuestaCredencial) => void; ux_mode?: 'popup'; cancel_on_tap_outside?: boolean }) => void
  renderButton: (contenedor: HTMLElement, opciones: Record<string, unknown>) => void
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } }
  }
}

let cargando: Promise<GoogleId> | null = null

export function cargarGoogle(): Promise<GoogleId> {
  const yaCargado = globalThis.window?.google?.accounts?.id
  if (yaCargado) return Promise.resolve(yaCargado)
  cargando ??= new Promise<GoogleId>((resolver, rechazar) => {
    const script = document.createElement('script')
    script.src = SCRIPT_GOOGLE
    script.async = true
    script.defer = true
    script.onload = () => {
      const id = globalThis.window?.google?.accounts?.id
      if (id) resolver(id)
      else rechazar(new Error('Google Identity Services no quedó disponible'))
    }
    script.onerror = () => {
      cargando = null
      rechazar(new Error('No se pudo cargar Google Identity Services'))
    }
    document.head.appendChild(script)
  })
  return cargando
}

/** Solo para pruebas: olvida el script cargado. */
export function reiniciarGoogle() {
  cargando = null
}
