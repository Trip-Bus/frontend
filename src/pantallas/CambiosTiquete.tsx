import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Encabezado } from '@/components/marca/Encabezado'
import { Aviso, Esqueleto, PantallaError } from '@/components/marca/Estados'
import { Pantalla } from '@/components/marca/Pantalla'
import { SelectorPuestos } from '@/components/marca/SelectorPuestos'
import { Button } from '@/components/ui/button'
import { Segmentos, Selector } from '@/components/ui/campos'
import { Campo } from '@/components/ui/input'
import { useAcento } from '@/hooks/useAcento'
import { textoError } from '@/lib/api'
import { api } from '@/lib/endpoints'
import { fechaHora } from '@/lib/formato'
import type { Pasajero, Tiquete, TipoDocumento } from '@/lib/tipos'

type Que = 'asiento' | 'datos'

const DOCUMENTOS: { valor: TipoDocumento; texto: string }[] = [
  { valor: 'CC', texto: 'Cédula de ciudadanía' },
  { valor: 'CE', texto: 'Cédula de extranjería' },
  { valor: 'TI', texto: 'Tarjeta de identidad' },
  { valor: 'PA', texto: 'Pasaporte' },
  { valor: 'PEP', texto: 'Permiso especial (PEP)' },
]

/**
 * P-07: cambiar de puesto en el mismo viaje (US-139, hasta 30 min antes; el pase queda con QR nuevo) o corregir el
 * nombre o documento de un pasajero (US-152, una sola vez por pasajero y hasta 1 h antes).
 */
export function CambiosTiquete() {
  const { ticketId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const que: Que = params.get('que') === 'datos' ? 'datos' : 'asiento'
  const tiquete = useQuery({ queryKey: ['tiquete', ticketId], queryFn: () => api.reservas.tiquete(ticketId) })
  useAcento(tiquete.data?.destino)

  if (tiquete.isError) return <PantallaError titulo="No encontramos tu tiquete" error={tiquete.error} reintentar={() => tiquete.refetch()} volverA="/mis-tiquetes" />
  const t = tiquete.data
  if (!t) {
    return (
      <Pantalla>
        <Esqueleto bloques={[80, 300]} />
      </Pantalla>
    )
  }
  return (
    <Pantalla>
      <Encabezado titulo="Cambiar tu tiquete" volverA="/mis-tiquetes">
        {t.origen} → {t.destino} · {fechaHora(t.fechaSalida)}
      </Encabezado>
      <div className="flex flex-col gap-4 px-5 pt-4 pb-8">
        <Segmentos
          etiqueta="Qué quieres cambiar"
          rol="tablist"
          valor={que}
          alCambiar={(q) => setParams({ que: q }, { replace: true })}
          opciones={[
            { valor: 'asiento', texto: 'Puesto' },
            { valor: 'datos', texto: 'Datos del pasajero' },
          ]}
        />
        {que === 'asiento' ? <CambiarPuesto t={t} /> : <CorregirDatos t={t} />}
      </div>
    </Pantalla>
  )
}

function CambiarPuesto({ t }: { t: Tiquete }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [desde, setDesde] = useState(t.seatNumbers[0] ?? '')
  const [nuevo, setNuevo] = useState<string[]>([])
  const cambiar = useMutation({
    mutationFn: () => api.reservas.cambiarAsiento(t.ticketId, desde, nuevo[0]),
    onSuccess: () => {
      toast(`Te pasamos al puesto ${nuevo[0]}. Tu pase tiene un QR nuevo.`)
      void queryClient.invalidateQueries({ queryKey: ['tiquete', t.ticketId] })
      void queryClient.invalidateQueries({ queryKey: ['mis-viajes'] })
      void navigate(`/pase/${t.ticketId}`, { replace: true })
    },
    onError: (e) => toast(textoError(e)),
  })
  return (
    <section aria-label="Cambiar de puesto" className="flex flex-col gap-3">
      <Aviso>Puedes cambiar de puesto hasta 30 minutos antes de la salida. El pase anterior deja de servir y te enviamos el nuevo.</Aviso>
      {t.seatNumbers.length > 1 && (
        <Selector etiqueta="Puesto que quieres cambiar" value={desde} onChange={(e) => setDesde(e.target.value)} opciones={t.seatNumbers.map((n) => ({ valor: n, texto: `Puesto ${n}` }))} />
      )}
      <SelectorPuestos itineraryId={t.itineraryId} maximo={1} elegidos={nuevo} alCambiar={setNuevo} propios={t.seatNumbers} />
      <Button ancho="completo" disabled={nuevo.length !== 1 || !desde || cambiar.isPending} onClick={() => cambiar.mutate()}>
        {cambiar.isPending ? 'Cambiando…' : nuevo[0] ? `Cambiar el ${desde} por el ${nuevo[0]}` : 'Elige el puesto nuevo'}
      </Button>
    </section>
  )
}

function CorregirDatos({ t }: { t: Tiquete }) {
  return (
    <section aria-label="Corregir datos" className="flex flex-col gap-3">
      <Aviso>Cada pasajero se puede corregir una sola vez, hasta 1 hora antes de la salida. El pase y su QR no cambian.</Aviso>
      {t.pasajeros.map((p, i) => (
        <FormPasajero key={p.passengerId ?? i} ticketId={t.ticketId} p={p} />
      ))}
    </section>
  )
}

function FormPasajero({ ticketId, p }: { ticketId: string; p: Pasajero }) {
  const queryClient = useQueryClient()
  const [datos, setDatos] = useState({ nombre: p.nombre, tipoDocumento: p.tipoDocumento, numeroDocumento: p.numeroDocumento })
  const corregir = useMutation({
    mutationFn: () => api.reservas.corregirPasajero(ticketId, p.passengerId!, { ...datos, nombre: datos.nombre.trim(), numeroDocumento: datos.numeroDocumento.trim() }),
    onSuccess: () => {
      toast('Corregimos los datos del pasajero.')
      void queryClient.invalidateQueries({ queryKey: ['tiquete', ticketId] })
    },
    onError: (e) => toast(textoError(e)),
  })
  const cambio = datos.nombre.trim() !== p.nombre || datos.tipoDocumento !== p.tipoDocumento || datos.numeroDocumento.trim() !== p.numeroDocumento
  const valido = datos.nombre.trim().length >= 3 && /^[A-Za-z0-9-]{4,20}$/.test(datos.numeroDocumento.trim())
  const enviar = (e: FormEvent) => {
    e.preventDefault()
    if (cambio && valido && p.passengerId) corregir.mutate()
  }
  return (
    <form onSubmit={enviar} aria-label={`Pasajero del puesto ${p.asiento ?? ''}`} className="flex flex-col gap-3 rounded-tarjeta bg-superficie p-4" noValidate>
      <span className="text-[14px] font-semibold">Puesto {p.asiento}</span>
      <Campo etiqueta="Nombre completo" value={datos.nombre} maxLength={160} onChange={(e) => setDatos((d) => ({ ...d, nombre: e.target.value }))} />
      <Selector etiqueta="Documento" value={datos.tipoDocumento} onChange={(e) => setDatos((d) => ({ ...d, tipoDocumento: e.target.value as TipoDocumento }))} opciones={DOCUMENTOS} />
      <Campo etiqueta="Número de documento" value={datos.numeroDocumento} maxLength={20} onChange={(e) => setDatos((d) => ({ ...d, numeroDocumento: e.target.value.replace(/\s/g, '') }))} />
      <Button type="submit" disabled={!cambio || !valido || !p.passengerId || corregir.isPending}>
        {corregir.isPending ? 'Guardando…' : 'Guardar la corrección'}
      </Button>
    </form>
  )
}
