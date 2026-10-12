import { useLayoutEffect } from 'react'
import { ACENTO_POR_DEFECTO, visualDe } from '@/features/ciudadVisual'

/**
 * Pinta la app con el acento de la ciudad de destino (diseño "ciudad de fondo"). Va en el elemento
 * raíz para que también lo tomen las hojas inferiores y los avisos, que salen en un portal.
 *  - `ciudad` string: acento de esa ciudad (hueso si no tiene foto).
 *  - `null`: pantalla sin viaje (mis tiquetes, panel, entrar): ámbar por defecto.
 *  - `undefined`: el dato aún carga; se deja el acento que ya estaba para no parpadear.
 */
export function useAcento(ciudad: string | null | undefined) {
  const acento = ciudad === undefined ? undefined : ciudad === null ? ACENTO_POR_DEFECTO : visualDe(ciudad).acento
  useLayoutEffect(() => {
    if (acento) document.documentElement.style.setProperty('--acento', acento)
  }, [acento])
}
