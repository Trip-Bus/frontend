import * as React from "react"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-md border border-borde bg-superficie px-3 text-cuerpo text-monte transition-colors outline-offset-2 file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-pequeno file:font-medium file:text-monte placeholder:text-texto-suave hover:border-borde-fuerte focus-visible:border-verde-andino focus-visible:outline-2 focus-visible:outline-foco disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-error",
        className
      )}
      {...props}
    />
  )
}

export { Input }
