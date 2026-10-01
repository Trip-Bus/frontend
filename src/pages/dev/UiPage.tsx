import { ArrowRight, Search, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Logo } from '@/shared/components/Logo'

// Las clases van escritas completas (no `bg-${name}`) para que Tailwind las detecte al escanear.
const palette = [
  { name: 'verde-andino', hex: '#1F5C43', swatch: 'bg-verde-andino', use: 'Marca, botón primario, enlaces' },
  { name: 'verde-andino-hover', hex: '#174A36', swatch: 'bg-verde-andino-hover', use: 'Hover del primario' },
  { name: 'verde-claro', hex: '#DCEBE1', swatch: 'bg-verde-claro', use: 'Fondos suaves, hover ghost' },
  { name: 'maiz', hex: '#E3A62F', swatch: 'bg-maiz', use: 'Acento / CTA (texto monte)' },
  { name: 'maiz-hover', hex: '#CF9320', swatch: 'bg-maiz-hover', use: 'Hover del acento' },
  { name: 'maiz-claro', hex: '#FBEBC4', swatch: 'bg-maiz-claro', use: 'Ofertas, aviso de temporizador' },
  { name: 'arena', hex: '#F5F0E6', swatch: 'bg-arena', use: 'Fondo de página' },
  { name: 'superficie', hex: '#FFFDF8', swatch: 'bg-superficie', use: 'Tarjetas, inputs, modales' },
  { name: 'borde', hex: '#E2D9C6', swatch: 'bg-borde', use: 'Bordes' },
  { name: 'borde-fuerte', hex: '#8C8470', swatch: 'bg-borde-fuerte', use: 'Bordes enfatizados' },
  { name: 'monte', hex: '#1C2B22', swatch: 'bg-monte', use: 'Texto principal' },
  { name: 'texto-suave', hex: '#5C6B61', swatch: 'bg-texto-suave', use: 'Texto secundario' },
  { name: 'alerta', hex: '#A14A12', swatch: 'bg-alerta', use: 'Urgencia, timer < 2 min' },
  { name: 'error', hex: '#B3261E', swatch: 'bg-error', use: 'Errores, acciones destructivas' },
  { name: 'error-claro', hex: '#F9DEDC', swatch: 'bg-error-claro', use: 'Fondo de error' },
  { name: 'silla-ocupada', hex: '#B9B1A0', swatch: 'bg-silla-ocupada', use: 'Silla no disponible' },
  { name: 'foco', hex: '#E3A62F', swatch: 'bg-foco', use: 'Anillo de foco' },
]

const typeScale = [
  { name: 'display', spec: 'Fraunces 56/60 500', className: 'font-display text-display', sample: 'Viaja por Colombia' },
  { name: 'titulo-1', spec: 'Fraunces 40/46 500', className: 'font-display text-titulo-1', sample: 'Bogotá → Medellín' },
  { name: 'titulo-2', spec: 'Fraunces 26/32 500', className: 'font-display text-titulo-2', sample: 'Elige tu silla' },
  { name: 'precio', spec: 'Fraunces 32/36 700', className: 'font-display text-precio', sample: '$ 85.000' },
  { name: 'titulo-3', spec: 'DM Sans 20/28 700', className: 'text-titulo-3', sample: 'Expreso Cordillera' },
  { name: 'lead', spec: 'DM Sans 18/27 400', className: 'text-lead', sample: 'Compra tu tiquete en minutos.' },
  { name: 'cuerpo', spec: 'DM Sans 16/24 400', className: 'text-cuerpo', sample: 'Salida desde la Terminal del Norte.' },
  { name: 'pequeno', spec: 'DM Sans 14/20 400', className: 'text-pequeno text-texto-suave', sample: 'Duración aproximada: 9 h 30 min' },
  { name: 'etiqueta', spec: 'DM Sans 12/16 700', className: 'text-etiqueta uppercase tracking-wide', sample: 'Últimas sillas' },
  { name: 'hora', spec: 'DM Sans 26/30 700', className: 'text-hora', sample: '06:45' },
]

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-titulo-2">{title}</h2>
      {children}
    </section>
  )
}

export function UiPage() {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-2">
        <Logo size="lg" />
        <h1 className="font-display text-titulo-1">Cordillera · revisión de UI</h1>
        <p className="text-lead text-texto-suave">
          Página solo de desarrollo para comparar los componentes con el sistema de diseño.
        </p>
      </header>

      <Section title="Logo">
        <div className="flex flex-wrap items-center gap-6">
          <div className="rounded-lg border border-borde bg-superficie p-4">
            <Logo variant="light" size="sm" />
          </div>
          <div className="rounded-lg border border-borde bg-superficie p-4">
            <Logo variant="light" size="md" />
          </div>
          <div className="rounded-lg bg-verde-andino p-4">
            <Logo variant="dark" size="md" />
          </div>
          <div className="rounded-lg bg-monte p-4">
            <Logo variant="dark" size="lg" />
          </div>
        </div>
      </Section>

      <Section title="Paleta">
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {palette.map((color) => (
            <li
              key={color.name}
              className="flex items-center gap-3 rounded-lg border border-borde bg-superficie p-3"
            >
              <span className={`size-12 shrink-0 rounded-sm border border-borde ${color.swatch}`} />
              <span className="flex flex-col">
                <span className="text-pequeno font-bold">{color.name}</span>
                <span className="text-pequeno text-texto-suave">
                  {color.hex} · {color.use}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Tipografía">
        <div className="flex flex-col divide-y divide-borde rounded-lg border border-borde bg-superficie">
          {typeScale.map((style) => (
            <div key={style.name} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-baseline sm:gap-6">
              <span className="w-44 shrink-0 text-pequeno text-texto-suave">
                <strong className="text-monte">{style.name}</strong> · {style.spec}
              </span>
              <span className={style.className}>{style.sample}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Botones">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Continuar</Button>
          <Button variant="accent">
            <Search /> Buscar viajes
          </Button>
          <Button variant="outline">Ver detalles</Button>
          <Button variant="ghost">Cancelar</Button>
          <Button variant="destructive">
            <Trash2 /> Eliminar ruta
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg">
            Pagar <ArrowRight />
          </Button>
          <Button size="icon" variant="outline" aria-label="Buscar">
            <Search />
          </Button>
          <Button className="rounded-pill" variant="outline">
            Ingresar
          </Button>
          <Button disabled>Deshabilitado</Button>
        </div>
        <p className="text-pequeno text-texto-suave">
          Usa Tab para revisar el anillo de foco (maíz, 2px, separado 2px).
        </p>
      </Section>

      <Section title="Formulario">
        <div className="flex max-w-sm flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="dev-origen">Origen</Label>
            <Input id="dev-origen" placeholder="¿Desde dónde viajas?" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="dev-correo">Correo (inválido)</Label>
            <Input id="dev-correo" type="email" defaultValue="pasajero@" aria-invalid="true" />
            <p className="text-pequeno text-error">Ingresa un correo válido.</p>
          </div>
        </div>
      </Section>

      <Section title="Tarjeta y badges">
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Bogotá → Medellín</CardTitle>
              <CardDescription>Expreso Cordillera · Directo</CardDescription>
            </CardHeader>
            <CardContent className="flex items-end justify-between gap-4">
              <div className="flex flex-col">
                <span className="text-hora">06:45</span>
                <span className="text-pequeno text-texto-suave">Terminal del Norte</span>
              </div>
              <span className="font-display text-precio">$ 85.000</span>
            </CardContent>
            <CardFooter className="justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <Badge>Directo</Badge>
                <Badge variant="alerta">Últimas sillas</Badge>
              </div>
              <Button>Elegir silla</Button>
            </CardFooter>
          </Card>

          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <Badge>default</Badge>
              <Badge variant="secondary">secondary</Badge>
              <Badge variant="oferta">oferta</Badge>
              <Badge variant="alerta">alerta</Badge>
              <Badge variant="destructive">destructive</Badge>
              <Badge variant="outline">outline</Badge>
            </div>
            <Separator />
            <div className="flex flex-wrap gap-3">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">Abrir modal</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Confirmar compra</DialogTitle>
                    <DialogDescription>
                      Revisa los datos de tu viaje antes de pagar.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter showCloseButton>
                    <Button>Confirmar</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button variant="ghost" onClick={() => toast.success('Reserva confirmada')}>
                Mostrar toast
              </Button>
            </div>
            <Separator />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </div>
      </Section>
    </main>
  )
}
