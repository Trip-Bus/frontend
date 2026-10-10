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
