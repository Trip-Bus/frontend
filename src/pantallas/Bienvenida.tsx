import fotoBus from '@/assets/entrar-bus.jpg'
import { useAcento } from '@/hooks/useAcento'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { Logo } from '@/components/marca/Logo'
import { Pantalla } from '@/components/marca/Pantalla'
import { buttonVariants } from '@/components/ui/button-variants'

/**
 * Pantalla 01. Explica en un vistazo la promesa: nadie más se sienta en tu puesto.
 * Arriba, un bus en ruta junto al mar (misma foto que Entrar) que se funde con el fondo tinta.
 */
export function Bienvenida() {
  useAcento(null)
  return (
    <Pantalla oscura aSangre>
      <div className="relative h-[clamp(240px,calc(100dvh-380px),480px)] shrink-0 overflow-hidden bg-[#6f93c4]">
        <img
          src={fotoBus}
          alt=""
          decoding="async"
          className="absolute inset-0 size-full object-cover"
          style={{ objectPosition: '100% 100%' }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(13,20,17,.4) 0%, rgba(13,20,17,0) 30%, rgba(13,20,17,0) 76%, #0d1411 100%)',
          }}
        />
        <div className="pt-seguro absolute inset-x-0 top-0 flex h-8 items-center justify-between px-6 [text-shadow:0_1px_12px_rgba(13,20,17,.45)]">
          <Logo claro />
          <span className="text-[13px] font-medium text-white/90">Colombia</span>
        </div>
      </div>

      <div className="flex flex-1 flex-col px-6 pb-[calc(18px+env(safe-area-inset-bottom,0px))]">
        <h1
          className="entra mt-4 font-sans text-[clamp(32px,9vw,40px)] leading-[1.08] font-semibold tracking-[-0.035em]"
          style={{ animationDelay: '80ms' }}
        >
          Nadie más se sienta en tu puesto.
        </h1>
        <p className="entra mt-3 text-[17px] leading-[1.45] text-acento" style={{ animationDelay: '130ms' }}>
          Aparta tu puesto en vivo y sigue tu bus hasta llegar.
        </p>

        <div className="flex-1" />

        <div className="entra mt-6 flex flex-col gap-1.5" style={{ animationDelay: '230ms' }}>
          <Link
            to="/inicio"
            className={buttonVariants({
              variante: 'acento',
              ancho: 'completo',
              className: 'justify-between',
            })}
          >
            Empezar
            <ArrowRight className="size-[22px]" strokeWidth={2.5} aria-hidden="true" />
          </Link>
          <Link to="/entrar" className="tap flex h-12 items-center justify-center text-[15px] font-semibold text-[#dde3df]">
            Ya tengo cuenta
          </Link>
        </div>
      </div>
    </Pantalla>
  )
}
