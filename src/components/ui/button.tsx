import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

// Cordillera: alto mínimo 44px (área táctil), rounded-md, foco con anillo `foco` (ver :focus-visible en index.css).
const buttonVariants = cva(
  "group/button inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md border border-transparent font-sans text-cuerpo font-medium whitespace-nowrap transition-colors select-none outline-offset-2 focus-visible:outline-2 focus-visible:outline-foco active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default:
          "bg-verde-andino text-arena hover:bg-verde-andino-hover",
        // CTA: uno por pantalla. Siempre texto monte sobre maíz, nunca blanco.
        accent: "bg-maiz text-monte hover:bg-maiz-hover",
        outline:
          "border-verde-andino bg-transparent text-verde-andino hover:bg-verde-claro",
        ghost:
          "bg-transparent text-monte hover:bg-verde-claro hover:text-verde-andino",
        destructive: "bg-error text-superficie hover:bg-error/90",
      },
      size: {
        default: "h-11 px-5",
        lg: "h-12 px-6 text-lead",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
