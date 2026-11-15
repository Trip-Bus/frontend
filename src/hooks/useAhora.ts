import { useEffect, useState } from 'react'

/**
 * Reloj compartido para cuentas regresivas. Los números cambian cada segundo, así que
 * NO se animan (skill "animate": acciones de alta frecuencia van sin animación); se
 * muestran con dígitos tabulares (.num) para que no "bailen".
 */
export function useAhora(intervaloMs = 1000): number {
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), intervaloMs)
    return () => clearInterval(id)
  }, [intervaloMs])
  return ahora
}

/** Segundos que faltan para `hasta` (nunca negativos); null si no hay fecha. */
export function useSegundosRestantes(hasta: string | null | undefined): number | null {
  const ahora = useAhora()
  if (!hasta) return null
  return Math.max(0, Math.floor((new Date(hasta).getTime() - ahora) / 1000))
}
