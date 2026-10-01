import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

// Solo tema claro por ahora (sin next-themes).
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-5 text-verde-andino" />
        ),
        info: (
          <InfoIcon className="size-5 text-verde-andino" />
        ),
        warning: (
          <TriangleAlertIcon className="size-5 text-alerta" />
        ),
        error: (
          <OctagonXIcon className="size-5 text-error" />
        ),
        loading: (
          <Loader2Icon className="size-5 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--color-superficie)",
          "--normal-text": "var(--color-monte)",
          "--normal-border": "var(--color-borde)",
          "--border-radius": "var(--radius-md)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast font-sans shadow-card",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
