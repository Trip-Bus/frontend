import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Resultado } from '@/components/marca/Consulta'
import { Aviso } from '@/components/marca/Estados'
import { PantallaGestion } from '@/components/marca/PantallaGestion'
import { SelectorPuestos } from '@/components/marca/SelectorPuestos'
import { Button } from '@/components/ui/button'
import { Segmentos, Selector } from '@/components/ui/campos'
import { Campo } from '@/components/ui/input'
import { hoy } from '@/features/busqueda'
import { useEmpresaActiva } from '@/features/empresa'
import { elementosDe } from '@/features/paginacion'
import { useAccion } from '@/hooks/useAccion'
import { useDescargar } from '@/hooks/useDescargar'
import { nuevaClaveIdempotencia } from '@/lib/api'
import { api } from '@/lib/endpoints'
import { dinero, fechaHora, horaCorta, sumarDias } from '@/lib/formato'
import type { PasajeroRequest, TipoDocumento, VentaTaquilla } from '@/lib/tipos'
import { Dato } from './InicioOperador'

const DOCUMENTOS: { valor: TipoDocumento; texto: string }[] = [
  { valor: 'CC', texto: 'CC' },
  { valor: 'CE', texto: 'CE' },
  { valor: 'TI', texto: 'TI' },
  { valor: 'PA', texto: 'Pasaporte' },
  { valor: 'PEP', texto: 'PEP' },
]
const pasajeroVacio = (): PasajeroRequest => ({ nombre: '', tipoDocumento: 'CC', numeroDocumento: '' })

/** O-10 Taquilla (US-144): venta en efectivo en la terminal, tiquete para imprimir y cierre de caja del día. */
export function Taquilla() {
  const [vista, setVista] = useState<'vender' | 'cierre'>('vender')
  return (
    <PantallaGestion titulo="Taquilla" descripcion="Venta en efectivo en la terminal." requiereEmpresa>
      <Segmentos etiqueta="Sección" rol="tablist" valor={vista} alCambiar={setVista} opciones={[{ valor: 'vender', texto: 'Vender' }, { valor: 'cierre', texto: 'Cierre de caja' }]} />
      {vista === 'vender' ? <Vender /> : <Cierre />}
    </PantallaGestion>
  )
}

function Vender() {
  const { companyId } = useEmpresaActiva()
  const descargar = useDescargar()
  const [itineraryId, setItineraryId] = useState('')
  const [asientos, setAsientos] = useState<string[]>([])
  const [pasajeros, setPasajeros] = useState<PasajeroRequest[]>([])
  const [comprador, setComprador] = useState({ nombre: '', email: '', telefono: '' })
  // Una clave por venta: si la red falla y se reintenta, el backend no vende dos veces.
  const [clave, setClave] = useState(nuevaClaveIdempotencia)
  const [vendida, setVendida] = useState<VentaTaquilla | null>(null)
  const viajes = useQuery({
    queryKey: ['itinerarios', 'taquilla', companyId ?? null],
    queryFn: () => api.operador.itinerarios({ desde: hoy(), hasta: sumarDias(hoy(), 2), estado: 'PROGRAMADO', companyId, size: 100 }),
  })
  const lista = asientos.map((_, i) => pasajeros[i] ?? pasajeroVacio())
  const vender = useAccion(
    () =>
      api.taquilla.vender(
        {
          itineraryId,
          seatNumbers: asientos,
          pasajeros: lista.map((p) => ({ ...p, nombre: p.nombre.trim(), numeroDocumento: p.numeroDocumento.trim() })),
          comprador: { nombre: comprador.nombre.trim(), email: comprador.email.trim() || undefined, telefono: comprador.telefono.trim() || undefined },
        },
        clave,
      ),
    {
      exito: 'Venta registrada.',
      invalidar: [['cierre'], ['asientos', itineraryId]],
      alTerminar: (v) => {
        setVendida(v)
        setAsientos([])
        setPasajeros([])
        setClave(nuevaClaveIdempotencia())
      },
    },
  )
  const cambiar = (i: number, parcial: Partial<PasajeroRequest>) => setPasajeros(lista.map((p, k) => (k === i ? { ...p, ...parcial } : p)))
  const valida = !!itineraryId && asientos.length > 0 && comprador.nombre.trim().length >= 3 && lista.every((p) => p.nombre.trim().length >= 3 && /^[A-Za-z0-9-]{4,20}$/.test(p.numeroDocumento.trim()))

  return (
    <div className="flex flex-col gap-4">
      {vendida && (
        <Aviso tono="exito">
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span>
              Vendiste {vendida.seatNumbers.join(', ')} por {dinero(vendida.total)} en efectivo.
              {vendida.compradorRegistrado ? ' El tiquete quedó en la cuenta del comprador.' : ''}
            </span>
            {vendida.ticketId && (
              <Button tamano="md" onClick={() => descargar.mutate({ pedir: () => api.reservas.pdfTiquete(vendida.ticketId!), nombre: `tiquete-${vendida.ticketId}.pdf` })}>
                Imprimir tiquete
              </Button>
            )}
          </span>
        </Aviso>
      )}
      <Selector
        etiqueta="Viaje"
        vacia={viajes.isPending ? 'Cargando viajes…' : 'Elige el viaje'}
        value={itineraryId}
        onChange={(e) => {
          setItineraryId(e.target.value)
          setAsientos([])
        }}
        opciones={elementosDe(viajes.data).map((v) => ({ valor: v.itineraryId, texto: `${horaCorta(v.fechaSalida)} · ${v.origen} → ${v.destino} · ${v.placa}` }))}
      />
      {itineraryId && <SelectorPuestos itineraryId={itineraryId} maximo={6} elegidos={asientos} alCambiar={setAsientos} />}
      {lista.map((p, i) => (
        <fieldset key={asientos[i]} className="grid gap-2 rounded-tarjeta bg-superficie p-4 md:grid-cols-[2fr_1fr_1.5fr]">
          <legend className="text-[14px] font-semibold">Puesto {asientos[i]}</legend>
          <Campo etiqueta="Nombre del pasajero" value={p.nombre} onChange={(e) => cambiar(i, { nombre: e.target.value })} />
          <Selector etiqueta="Documento" value={p.tipoDocumento} onChange={(e) => cambiar(i, { tipoDocumento: e.target.value as TipoDocumento })} opciones={DOCUMENTOS} />
          <Campo etiqueta="Número" value={p.numeroDocumento} onChange={(e) => cambiar(i, { numeroDocumento: e.target.value.replace(/\s/g, '') })} />
        </fieldset>
      ))}
      {asientos.length > 0 && (
        <fieldset className="grid gap-2 rounded-tarjeta bg-superficie p-4 md:grid-cols-3">
          <legend className="text-[14px] font-semibold">Comprador</legend>
          <Campo etiqueta="Nombre del comprador" value={comprador.nombre} onChange={(e) => setComprador((c) => ({ ...c, nombre: e.target.value }))} />
          <Campo etiqueta="Correo (opcional)" type="email" value={comprador.email} onChange={(e) => setComprador((c) => ({ ...c, email: e.target.value }))} ayuda="Le enviamos el tiquete." />
          <Campo etiqueta="Celular (opcional)" type="tel" value={comprador.telefono} onChange={(e) => setComprador((c) => ({ ...c, telefono: e.target.value.replace(/\D/g, '').slice(0, 10) }))} />
        </fieldset>
      )}
      <Button disabled={!valida || vender.isPending} onClick={() => vender.mutate(undefined)}>
        {vender.isPending ? 'Registrando…' : 'Cobrar en efectivo'}
      </Button>
    </div>
  )
}

function Cierre() {
  const [fecha, setFecha] = useState(hoy())
  const q = useQuery({ queryKey: ['cierre', fecha], queryFn: () => api.taquilla.cierre(fecha) })
  const c = q.data
  return (
    <div className="flex flex-col gap-3">
      <div className="max-w-xs">
        <Campo etiqueta="Día" type="date" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} />
      </div>
      <Resultado consulta={q} hayDatos={!!c && c.cantidadVentas > 0} vacio="No hubo ventas en taquilla ese día.">
        {c && (
          <>
            <section aria-label="Totales del día" className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Dato titulo="Ventas" valor={String(c.cantidadVentas)} />
              <Dato titulo="Asientos" valor={String(c.cantidadAsientos)} />
              <Dato titulo="Efectivo" valor={dinero(c.totalEfectivo)} />
              <Dato titulo="Devuelto" valor={dinero(c.totalReembolsado)} alerta={c.totalReembolsado > 0} />
            </section>
            <ul className="flex flex-col gap-2">
              {c.ventas.map((v) => (
                <li key={v.bookingId} className="flex justify-between gap-3 rounded-[14px] bg-superficie p-3 text-[14px]">
                  <span>
                    {fechaHora(v.vendidoEn)} · {v.origen} → {v.destino} · puesto {v.seatNumbers.join(', ')}
                    {v.compradorNombre ? ` · ${v.compradorNombre}` : ''}
                  </span>
                  <span className="num font-semibold">{dinero(v.total)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Resultado>
    </div>
  )
}
