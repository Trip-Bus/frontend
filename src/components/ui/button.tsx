import type { VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { buttonVariants } from './button-variants'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>

export function Button({ className, variante, tamano, ancho, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonVariants({ variante, tamano, ancho }), className)} {...props} />
}
