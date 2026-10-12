import { useAcento } from '@/hooks/useAcento'
import { ArrowRight, Check, X } from 'lucide-react'
import { Link } from 'react-router'
import { LiveDot } from '@/components/marca/LiveDot'
import { Logo } from '@/components/marca/Logo'
import { Pantalla } from '@/components/marca/Pantalla'
import { buttonVariants } from '@/components/ui/button-variants'

/** Pantalla 01. Explica en un vistazo la promesa: nadie más se sienta en tu puesto. */
export function Bienvenida() {
  useAcento(null)
  return (
    <Pantalla oscura className="px-6">
      <div className="flex h-8 items-center justify-between">
        <Logo claro />
        <span className="text-[13px] text-tinta-texto-2">Colombia</span>
      </div>

      <BusIlustracion />

      <div aria-hidden="true" className="relative mt-5 h-7">
        <span className="absolute inset-x-0 top-[13px] h-0.5 bg-[#2f3a35]" />
        <span className="absolute top-[9px] left-0 size-2.5 rounded-full border-2 border-tinta-texto-2 bg-tinta" />
        <span className="absolute top-[9px] right-0 size-2.5 rounded-full bg-tinta-texto-2" />
        <span className="tb-viaje absolute top-[7px] left-0 block w-[calc(100%-14px)]">
          <span className="block size-3.5 rounded-full bg-acento shadow-[0_0_0_5px_color-mix(in_srgb,var(--acento)_18%,transparent)]" />
        </span>
      </div>

      <h1
        className="entra mt-6 font-display text-[clamp(34px,10vw,42px)] leading-[1.02] font-extrabold tracking-[-0.03em]"
        style={{ animationDelay: '80ms' }}
      >
        Nadie más se sienta en <span className="text-acento">tu puesto.</span>
      </h1>
      <p className="entra mt-3.5 text-[17px] leading-[1.45] text-[#b9c2bd]" style={{ animationDelay: '130ms' }}>
        Ves los puestos en vivo, lo apartas 10 minutos mientras pagas y sigues tu bus hasta que llegues.
      </p>

      <ul className="entra mt-4 flex flex-wrap gap-2" style={{ animationDelay: '180ms' }}>
        <li className="flex h-[30px] items-center gap-1.5 rounded-full border border-[#2f3a35] px-3 text-[13px] text-[#dde3df]">
          <LiveDot /> En vivo
        </li>
        <li className="flex h-[30px] items-center rounded-full border border-[#2f3a35] px-3 text-[13px] text-[#dde3df]">
          Cero cobros dobles
        </li>
        <li className="flex h-[30px] items-center rounded-full border border-[#2f3a35] px-3 text-[13px] text-[#dde3df]">
          Tiquete sin señal
        </li>
      </ul>

      <div className="flex-1" />

      <div className="entra mt-8 flex flex-col gap-1.5" style={{ animationDelay: '230ms' }}>
        <Link
          to="/inicio"
          className={buttonVariants({
            variante: 'acento',
            ancho: 'completo',
            className: 'justify-between font-display text-[19px] font-extrabold',
          })}
        >
          Empezar
          <ArrowRight className="size-[22px]" strokeWidth={2.5} aria-hidden="true" />
        </Link>
        <Link to="/entrar" className="tap flex h-12 items-center justify-center text-[15px] font-semibold text-[#dde3df]">
          Ya tengo cuenta
        </Link>
      </div>
    </Pantalla>
  )
}

const VENDIDOS = new Set(['0-0', '0-1', '1-3', '2-0', '3-2', '3-3', '4-1', '4-0'])

function BusIlustracion() {
  const filas = Array.from({ length: 5 }, (_, r) => r)
  return (
    <div aria-hidden="true" className="mt-5 flex justify-center">
      <div className="grid grid-cols-[34px_34px_20px_34px_34px] gap-[7px] rounded-[64px_64px_26px_26px] border-[1.5px] border-[#2f3a35] bg-[#121a16] px-[18px] pt-[26px] pb-[18px]">
        {filas.flatMap((r) =>
          [0, 1, null, 2, 3].map((c, i) => {
            if (c === null) return <span key={`${r}-p`} />
            const k = `${r}-${c}`
            const mio = k === '2-3'
            const alguien = k === '1-1'
            const vendido = VENDIDOS.has(k)
            return (
              <span
                key={`${r}-${i}`}
                className={
                  'flex h-8 items-center justify-center rounded-[10px_10px_7px_7px] border-[1.5px] ' +
                  (mio
                    ? 'border-acento bg-acento text-tinta'
                    : vendido
                      ? 'border-[#2a332f] bg-[#2a332f] text-[#7e8983]'
                      : 'border-[#4a5650] bg-[#121a16]')
                }
              >
                {mio && (
                  <span className="tb-respira flex">
                    <Check className="size-[18px]" strokeWidth={3} />
                  </span>
                )}
                {vendido && <X className="size-3" strokeWidth={2.5} />}
                {alguien && <LiveDot color="naranja" />}
              </span>
            )
          }),
        )}
      </div>
    </div>
  )
}
