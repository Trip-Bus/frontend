import { cva } from 'class-variance-authority'

/**
 * Botón de TripBus.
 * - `tap`: retroalimentación al presionar (160 ms, ease-out, scale .97) — funciona en táctil y mouse.
 * - El hover solo existe con mouse (`hover:` de Tailwind 4 ya va dentro de @media (hover: hover)).
 * - Nada tocable mide menos de 44 px.
 */
export const buttonVariants = cva(
  'tap inline-flex items-center justify-center gap-2.5 whitespace-nowrap font-semibold ' +
    'disabled:cursor-not-allowed disabled:bg-[#e3e6de] disabled:text-texto-2 ' +
    'transition-[transform,background-color] [&_svg]:shrink-0',
  {
    variants: {
      variante: {
        tinta: 'bg-tinta text-white hover:bg-[#1b2420]',
        acento: 'bg-acento text-tinta hover:brightness-95',
        naranja: 'bg-naranja text-tinta hover:bg-[#f2511a]',
        contorno: 'border-[1.5px] border-control bg-superficie text-tinta hover:bg-[#eef1e8]',
        fantasma: 'bg-transparent text-tinta hover:bg-[#eef1e8]',
      },
      tamano: {
        lg: 'h-14 rounded-boton px-5 text-[17px]',
        md: 'h-12 rounded-control px-4 text-[15px]',
        icono: 'size-11 rounded-control',
      },
      ancho: {
        completo: 'w-full',
        auto: '',
      },
    },
    defaultVariants: { variante: 'tinta', tamano: 'lg', ancho: 'auto' },
  },
)
