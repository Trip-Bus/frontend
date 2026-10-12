import { useAcento } from '@/hooks/useAcento'
import { Link } from 'react-router'
import { Pantalla } from '@/components/marca/Pantalla'
import { buttonVariants } from '@/components/ui/button-variants'

export function NoEncontrada() {
  useAcento(null)
  return (
    <Pantalla className="items-center justify-center px-7 text-center">
      <div aria-hidden="true" className="relative mb-6 h-6 w-48">
        <span className="absolute inset-x-0 top-[11px] h-0.5 bg-[repeating-linear-gradient(90deg,#8c948e_0_8px,transparent_8px_14px)]" />
        <span className="absolute top-1.5 left-0 size-3 rounded-full border-[2.5px] border-tinta bg-fondo" />
      </div>
      <h1 className="font-display text-[26px] font-bold tracking-[-0.01em]">Esta ruta no lleva a ningún lado</h1>
      <p className="mt-2 text-[15px] text-texto-2">La página que buscas no existe o cambió de lugar.</p>
      <Link to="/inicio" className={buttonVariants({ className: 'mt-6' })}>
        Ir al inicio
      </Link>
    </Pantalla>
  )
}
