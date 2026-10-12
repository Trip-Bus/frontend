import { Check, X } from 'lucide-react'
import { NOMBRE_ESTADO, type CeldaVista, type EstadoPuesto, type PisoVista, type Puesto } from '@/features/mapaAsientos'
import { cn } from '@/lib/utils'

/**
 * Mapa del bus con la distribución real (filas × columnas del seatmap de Catalog).
 * Ningún estado se distingue solo por color (US-017): libre = número, tuyo = ✓,
 * alguien lo está apartando = punto naranja con borde punteado, vendido = ✕, oferta = número sobre naranja.
 */

const ESTILO: Record<EstadoPuesto, string> = {
  libre: 'bg-superficie border-libre-borde text-tinta',
  tuyo: 'bg-lima border-tinta text-tinta',
  ocupandose: 'bg-presencia border-presencia-borde border-dashed text-alerta',
  vendido: 'bg-vendido border-vendido text-[#a8b2ac]',
  oferta: 'bg-naranja border-tinta text-tinta',
  'sin-dato': 'bg-[#eceee7] border-linea text-texto-2',
}

export function PuestoBoton({
  puesto,
  seleccionable,
  marcado,
  alTocar,
}: {
  puesto: Puesto
  seleccionable: boolean
  marcado: boolean
  alTocar: (p: Puesto) => void
}) {
  const estado: EstadoPuesto = marcado ? 'tuyo' : puesto.estado
  return (
    <button
      type="button"
      disabled={!seleccionable}
      aria-pressed={marcado}
      aria-label={`Puesto ${puesto.numero}, ${puesto.ubicacion}, ${marcado ? 'elegido' : NOMBRE_ESTADO[puesto.estado]}`}
      onClick={() => alTocar(puesto)}
      className={cn(
        'num flex h-9 w-11 items-center justify-center rounded-[11px_11px_7px_7px] border-2 text-[14px] font-bold',
        'transition-[scale,background-color,border-color,color] duration-200 ease-out active:enabled:scale-[0.94]',
        'disabled:cursor-not-allowed',
        ESTILO[estado],
      )}
    >
      {estado === 'tuyo' ? (
        <Check className="size-[18px]" strokeWidth={3} aria-hidden="true" />
      ) : estado === 'vendido' ? (
        <X className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
      ) : estado === 'ocupandose' ? (
        <span aria-hidden="true" className="relative size-2">
          <span className="tb-latido absolute inset-0 rounded-full bg-naranja" style={{ animation: 'tb-latido 1.6s var(--ease-out) infinite' }} />
          <span className="absolute inset-0 rounded-full bg-naranja" />
        </span>
      ) : (
        puesto.numero
      )}
    </button>
  )
}

function CeldaFija({ celda }: { celda: CeldaVista }) {
  switch (celda.tipo) {
    case 'CONDUCTOR':
      return <span aria-label="Conductor" role="img" className="mx-auto size-[26px] rounded-full border-[2.5px] border-libre-borde" />
    case 'PUERTA':
      return <span className="text-center text-[10px] font-semibold text-texto-2">Puerta</span>
    case 'BANO':
      return <span className="text-center text-[10px] font-semibold text-texto-2">Baño</span>
    case 'ESCALERA':
      return (
        <span aria-label="Escalera" role="img" className="mx-auto flex h-7 w-9 flex-col justify-between py-0.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-[3px] rounded-full bg-control" />
          ))}
        </span>
      )
    default:
      return <span aria-hidden="true" />
  }
}

/** Un piso del bus. `seleccionables` decide qué estados se pueden tocar (pasajero: solo libres). */
export function PisoBus({
  piso,
  marcados,
  seleccionables = ['libre'],
  alTocar,
}: {
  piso: PisoVista
  marcados: ReadonlySet<string>
  seleccionables?: EstadoPuesto[]
  alTocar: (p: Puesto) => void
}) {
  return (
    <section
      aria-label={`Piso ${piso.piso} del bus`}
      className="mx-auto rounded-[56px_56px_24px_24px] border-[1.5px] border-linea bg-superficie px-4 pt-4 pb-3.5"
    >
      <div
        className="grid items-center justify-center gap-x-1.5 gap-y-1.5"
        style={{ gridTemplateColumns: `repeat(${piso.columnas}, 44px)`, gridTemplateRows: `repeat(${piso.filas}, 36px)` }}
      >
        {piso.celdas.map((c) => (
          <div key={c.clave} className="flex items-center justify-center" style={{ gridRow: c.fila, gridColumn: c.columna }}>
            {c.puesto ? (
              <PuestoBoton
                puesto={c.puesto}
                marcado={marcados.has(c.puesto.numero)}
                seleccionable={marcados.has(c.puesto.numero) || seleccionables.includes(c.puesto.estado)}
                alTocar={alTocar}
              />
            ) : (
              <CeldaFija celda={c} />
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

export function LeyendaPuestos({ conOferta = false }: { conOferta?: boolean }) {
  const items: [string, string][] = [
    ['Libre', 'bg-superficie border-2 border-libre-borde'],
    ['Tuyo', 'bg-lima border-2 border-tinta'],
    ['Apartándose', 'bg-presencia border-2 border-dashed border-presencia-borde'],
    ['Vendido', 'bg-vendido'],
  ]
  if (conOferta) items.push(['Oferta', 'bg-naranja border-2 border-tinta'])
  return (
    <ul aria-label="Convenciones" className="flex flex-wrap justify-between gap-x-3 gap-y-1.5 text-[12px] font-semibold text-[#2e3632]">
      {items.map(([t, c]) => (
        <li key={t} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={cn('size-4 rounded-[5px]', c)} />
          {t}
        </li>
      ))}
    </ul>
  )
}
