import { useMutation, useQueries, useQuery } from '@tanstack/react-query'
import { ChevronRight, Database, ScanLine } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { BarraInferior } from '@/components/marca/BarraInferior'
import { Aviso, Esqueleto } from '@/components/marca/Estados'
import { Pantalla } from '@/components/marca/Pantalla'
import { Button } from '@/components/ui/button'
import { busquedaInicial, hoy } from '@/features/busqueda'
import { useAcento } from '@/hooks/useAcento'
import { textoError } from '@/lib/api'
import { api } from '@/lib/endpoints'
import { fechaCorta, fechaDesdeApi, horaCorta, plural, sumarDias } from '@/lib/formato'
import { useSesion } from '@/lib/sesion'
import type { Rol } from '@/lib/tipos'
import { cn } from '@/lib/utils'

const ROL: Record<Rol, string> = { PASAJERO: 'Pasajero', CONDUCTOR: 'Conductor', OPERADOR: 'Operador', ADMIN: 'Administrador' }

/**
 * Panel de la empresa transportadora (US-005). El conductor y el operador ven solo los viajes de
 * su empresa; el admin ve todos. Desde cada viaje: novedades (US-046), GPS (US-038) y drops (US-054).
 */
export function Panel() {
  const s = useSesion()!
  useAcento(null)
  const inicial = busquedaInicial()
  const [origen, setOrigen] = useState(inicial.origen)
  const [destino, setDestino] = useState(inicial.destino)
  const [fecha, setFecha] = useState(hoy())

  const usuario = useQuery({ queryKey: ['usuario', s.userId], queryFn: () => api.auth.usuario(s.userId), staleTime: Infinity })
  const ciudades = useQuery({ queryKey: ['ciudades'], queryFn: api.catalogo.ciudades, staleTime: Infinity })
  const viajes = useQuery({
    queryKey: ['viajes', origen, destino, fecha],
    queryFn: ({ signal }) => api.catalogo.buscar(origen, destino, fecha, signal),
    enabled: origen !== destino,
  })
  // La búsqueda no trae la empresa como id: se consulta el detalle para filtrar por companyId.
  const detalles = useQueries({
    queries: (viajes.data ?? []).map((v) => ({
      queryKey: ['itinerario', v.itineraryId],
      queryFn: () => api.catalogo.itinerario(v.itineraryId),
      staleTime: 5 * 60_000,
    })),
  })
  const companyId = usuario.data?.companyId ?? null
  const esAdmin = s.rol === 'ADMIN'
  const propios = (viajes.data ?? []).filter((_v, i) => {
    if (esAdmin || !companyId) return true
    const d = detalles[i]?.data
    return d ? d.companyId === companyId : false
  })

  const seed = useMutation({
    mutationFn: api.admin.seed,
    onSuccess: () => {
      toast('Datos de demostración cargados.')
      void viajes.refetch()
    },
    onError: (e) => toast(textoError(e)),
  })

  const dias = [0, 1, 2, 3].map((i) => sumarDias(hoy(), i))
  const select = 'h-12 w-full rounded-control border-[1.5px] border-control bg-superficie px-3 text-base'

  return (
    <Pantalla className="pb-0">
      <header className="flex items-center gap-3 px-5">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[13px] text-texto-2">{ROL[s.rol]}</span>
          <h1 className="truncate font-display text-[24px] font-bold tracking-[-0.01em]">{usuario.data?.nombre ?? 'Panel'}</h1>
        </div>
        <Link to="/panel/validar" className="tap flex h-11 items-center gap-2 rounded-control bg-tinta px-3.5 text-[14px] font-semibold text-white">
          <ScanLine className="size-5 text-acento" aria-hidden="true" />
          Validar pase
        </Link>
      </header>

      {!esAdmin && usuario.data && !companyId && (
        <Aviso tono="alerta" className="mx-5 mt-3">
          Tu usuario no tiene empresa asignada: el backend rechazará novedades y drops.
        </Aviso>
      )}

      <section aria-label="Buscar viajes de la empresa" className="mx-5 mt-4 flex flex-col gap-3 rounded-tarjeta bg-superficie p-4">
        <div className="grid grid-cols-2 gap-2.5">
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
            Desde
            <select className={select} value={origen} onChange={(e) => setOrigen(e.target.value)}>
              {(ciudades.data ?? [origen]).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
            Hacia
            <select className={select} value={destino} onChange={(e) => setDestino(e.target.value)}>
              {(ciudades.data ?? [destino]).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <div role="tablist" aria-label="Día" className="grid grid-cols-4 gap-1.5">
          {dias.map((d, i) => (
            <button
              key={d}
              role="tab"
              aria-selected={d === fecha}
              onClick={() => setFecha(d)}
              className={cn(
                'tap h-11 rounded-xl border-[1.5px] text-[13px] font-semibold',
                d === fecha ? 'border-tinta bg-tinta text-white' : 'border-linea bg-superficie',
              )}
            >
              {i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : fechaCorta(fechaDesdeApi(d)).split(' ').slice(0, 2).join(' ')}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-1 flex-col gap-2.5 px-5 pt-4">
        <h2 className="text-[15px] font-semibold text-texto-2">
          {viajes.isSuccess ? plural(propios.length, 'viaje', 'viajes') : 'Viajes'}
          {!esAdmin && companyId ? ' de tu empresa' : ''}
        </h2>
        {origen === destino ? (
          <Aviso>Elige ciudades distintas.</Aviso>
        ) : viajes.isPending ? (
          <Esqueleto className="px-0 pt-0" bloques={[76, 76]} />
        ) : viajes.isError ? (
          <Aviso tono="alerta">{textoError(viajes.error)}</Aviso>
        ) : propios.length === 0 ? (
          <Aviso>No hay salidas de tu empresa ese día en esta ruta.</Aviso>
        ) : (
          propios.map((v) => (
            <Link key={v.itineraryId} to={`/panel/viaje/${v.itineraryId}`} className="tap flex items-center gap-3 rounded-tarjeta bg-superficie p-4">
              <span className="num text-[22px] font-bold">{horaCorta(v.fechaSalida)}</span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[14px] font-semibold" title={v.empresa}>
                  {v.empresa}
                </span>
                <span className="text-[13px] text-texto-2">
                  {v.asientosDisponibles == null ? 'Puestos sin dato' : plural(v.asientosDisponibles, 'puesto libre', 'puestos libres')}
                  {v.ofertaActiva ? ' · con drop' : ''}
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0" aria-hidden="true" />
            </Link>
          ))
        )}

        {esAdmin && (
          <Button variante="contorno" ancho="completo" className="mt-3" disabled={seed.isPending} onClick={() => seed.mutate()}>
            <Database className="size-5" aria-hidden="true" />
            {seed.isPending ? 'Cargando datos…' : 'Cargar datos de demostración'}
          </Button>
        )}
      </section>

      <BarraInferior activa="panel" />
    </Pantalla>
  )
}
