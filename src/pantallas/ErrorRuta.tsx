import { useEffect } from 'react'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { Pantalla } from '@/components/marca/Pantalla'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'

const CLAVE = 'tripbus.recargaPorVersion'

/**
 * La pantalla pide un archivo de una versión anterior de la app: pasa en producción tras un
 * despliegue (los archivos tienen hash nuevo) y en desarrollo cuando Vite reoptimiza dependencias
 * con la pestaña abierta.
 */
function esVersionVieja(error: unknown): boolean {
  const texto = error instanceof Error ? error.message : String(error ?? '')
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Failed to fetch/i.test(texto)
}

/** Error de una ruta: en vez del aviso técnico de React Router, una pantalla de la app. */
export function ErrorRuta() {
  const error = useRouteError()
  const versionVieja = esVersionVieja(error)

  // Versión vieja: se recarga sola una vez (si vuelve a fallar en menos de 10 s, se muestra el aviso).
  useEffect(() => {
    if (!versionVieja) return
    try {
      const ultima = Number(globalThis.sessionStorage?.getItem(CLAVE) ?? 0)
      if (Date.now() - ultima > 10_000) {
        globalThis.sessionStorage?.setItem(CLAVE, String(Date.now()))
        globalThis.location.reload()
      }
    } catch {
      /* sin sessionStorage: se queda el aviso con el botón */
    }
  }, [versionVieja])

  if (import.meta.env.DEV && !versionVieja) console.error(error)
  const noExiste = isRouteErrorResponse(error) && error.status === 404

  return (
    <Pantalla>
      <section role="alert" className="flex flex-1 flex-col items-center gap-3.5 px-7 pt-20 text-center">
        <h1 className="font-display text-[24px] font-bold tracking-[-0.01em]">
          {versionVieja ? 'Hay una versión nueva de la app' : noExiste ? 'Esta pantalla no existe' : 'Algo falló en esta pantalla'}
        </h1>
        <p className="text-[15px] leading-relaxed text-texto-2">
          {versionVieja
            ? 'Recarga para abrirla. Tus tiquetes y tu sesión siguen guardados.'
            : 'Vuelve a intentarlo. Si sigue pasando, vuelve al inicio.'}
        </p>
        <div className="mt-2 flex w-full flex-col gap-2.5">
          <Button ancho="completo" onClick={() => globalThis.location.reload()}>
            Recargar
          </Button>
          <Link to="/inicio" reloadDocument className={buttonVariants({ variante: 'contorno', ancho: 'completo' })}>
            Ir al inicio
          </Link>
        </div>
      </section>
    </Pantalla>
  )
}
