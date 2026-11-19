/**
 * Configuración que llega en tiempo de ejecución (no en el build): el NGINX del frontend sirve /config.js con
 * los valores de las variables del contenedor. Así la misma imagen sirve en local, QA y Azure.
 *  - googleMapsKey: clave de Maps JavaScript API (GOOGLE_MAPS_KEY). Vacía = mapa propio en SVG.
 */
type ConfigRuntime = { googleMapsKey?: string }

declare global {
  interface Window {
    __TRIPBUS_CONFIG__?: ConfigRuntime
  }
}

export function claveGoogleMaps(): string | null {
  const enRuntime = globalThis.window?.__TRIPBUS_CONFIG__?.googleMapsKey?.trim()
  const enBuild = (import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined)?.trim()
  const clave = enRuntime || enBuild || ''
  // "${GOOGLE_MAPS_KEY}" sin reemplazar (variable no definida en el contenedor) = sin clave.
  return clave && !clave.startsWith('$') ? clave : null
}
