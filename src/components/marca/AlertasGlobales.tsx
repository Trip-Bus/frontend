import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  EVENTO_CUENTA_BLOQUEADA,
  EVENTO_CUENTA_SUSPENDIDA,
  EVENTO_SESION_EXPIRADA,
} from '@/lib/api'
import { EVENTO_WS_DUPLICADO } from '@/lib/tiempoReal'
import { router } from '@/router'

type AlertaGlobal =
  | { tipo: 'suspendida' }
  | { tipo: 'bloqueada'; reintentarEn: number | null }
  | { tipo: 'pestanas' }
  | null

export function AlertasGlobales() {
  const [alerta, setAlerta] = useState<AlertaGlobal>(null)

  useEffect(() => {
    const sesionExpirada = () => void router.navigate('/entrar', { replace: true })
    const suspendida = () => {
      void router.navigate('/entrar', { replace: true })
      setAlerta({ tipo: 'suspendida' })
    }
    const bloqueada = (evento: Event) => {
      const { reintentarEn } = (evento as CustomEvent<{ reintentarEn: number | null }>).detail
      setAlerta({ tipo: 'bloqueada', reintentarEn })
    }
    const pestanasDuplicadas = () => setAlerta({ tipo: 'pestanas' })
    globalThis.addEventListener(EVENTO_SESION_EXPIRADA, sesionExpirada)
    globalThis.addEventListener(EVENTO_CUENTA_SUSPENDIDA, suspendida)
    globalThis.addEventListener(EVENTO_CUENTA_BLOQUEADA, bloqueada)
    globalThis.addEventListener(EVENTO_WS_DUPLICADO, pestanasDuplicadas)
    return () => {
      globalThis.removeEventListener(EVENTO_SESION_EXPIRADA, sesionExpirada)
      globalThis.removeEventListener(EVENTO_CUENTA_SUSPENDIDA, suspendida)
      globalThis.removeEventListener(EVENTO_CUENTA_BLOQUEADA, bloqueada)
      globalThis.removeEventListener(EVENTO_WS_DUPLICADO, pestanasDuplicadas)
    }
  }, [])

  if (!alerta) return null
  const contenido = {
    suspendida: {
      titulo: 'Cuenta suspendida',
      mensaje: 'No puedes continuar porque tu cuenta está suspendida. Contacta al equipo de TripBus para recibir ayuda.',
      boton: 'Entendido',
    },
    bloqueada: {
      titulo: 'Cuenta bloqueada temporalmente',
      mensaje:
        alerta.tipo === 'bloqueada' && alerta.reintentarEn !== null
          ? `Espera ${alerta.reintentarEn} segundos antes de volver a intentarlo.`
          : 'Espera unos minutos antes de volver a intentarlo.',
      boton: 'Entendido',
    },
    pestanas: {
      titulo: 'Demasiadas pestañas abiertas',
      mensaje: 'TripBus limita las conexiones en vivo por usuario. Cierra las otras pestañas y vuelve a cargar esta página.',
      boton: 'Entendido',
    },
  }[alerta.tipo]

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-tinta/60 p-5">
      <section role="alertdialog" aria-modal="true" aria-labelledby="alerta-global-titulo" className="w-full max-w-[420px] rounded-tarjeta bg-superficie p-5 shadow-xl">
        <h2 id="alerta-global-titulo" className="font-display text-[22px] font-bold">{contenido.titulo}</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-texto-2">{contenido.mensaje}</p>
        <Button className="mt-5" ancho="completo" onClick={() => setAlerta(null)}>{contenido.boton}</Button>
      </section>
    </div>
  )
}
