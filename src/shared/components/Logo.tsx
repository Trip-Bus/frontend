import { cn } from 'cn'

type LogoProps = {
  /** `light`: para fondos claros (símbolo verde). `dark`: para fondos oscuros (símbolo crema). */
  variant?: 'light' | 'dark'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: { mark: 'size-6', text: 'text-titulo-3' },
  md: { mark: 'size-8', text: 'text-titulo-2' },
  lg: { mark: 'size-12', text: 'text-titulo-1' },
}

export function Logo({ variant = 'light', size = 'md', className }: LogoProps) {
  const src = variant === 'dark' ? '/brand/tripbus-mark-inverse.svg' : '/brand/tripbus-mark.svg'

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <img src={src} alt="" aria-hidden="true" className={sizes[size].mark} />
      <span
        className={cn(
          'font-display font-bold',
          sizes[size].text,
          variant === 'dark' ? 'text-arena' : 'text-verde-andino',
        )}
      >
        TripBus
      </span>
    </span>
  )
}
