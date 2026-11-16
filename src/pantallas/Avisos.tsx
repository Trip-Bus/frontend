import { ChevronRight } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router'
import { Encabezado } from '@/components/marca/Encabezado'
import { Aviso as Mensaje } from '@/components/marca/Estados'
import { Pantalla } from '@/components/marca/Pantalla'
import { Button } from '@/components/ui/button'
import { avisos, describirAviso, useAvisos } from '@/features/avisos'
import { useAcento } from '@/hooks/useAcento'
import { fechaHora } from '@/lib/formato'
import { cn } from '@/lib/utils'

/** P-13 Centro de avisos: lo que llegó por usuario:{id}:avisos y :tiquetes. Cada aviso abre su pantalla. */
export function Avisos() {
  useAcento(null)
  const lista = useAvisos()
  // Al abrir el centro, los avisos quedan leídos (la campana vuelve a cero).
  useEffect(() => {
    avisos.marcarLeidos()
  }, [lista.length])
  return (
    <Pantalla>
      <Encabezado titulo="Avisos" volverA="/mis-tiquetes">
        Cambios de tus viajes, reembolsos, turnos y ofertas.
      </Encabezado>
      <div className="flex flex-col gap-2.5 px-5 pt-4 pb-8">
        {lista.length === 0 ? (
          <Mensaje>No tienes avisos. Cuando algo cambie en tus viajes te lo contamos aquí.</Mensaje>
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {lista.map((a) => {
                const d = describirAviso(a)
                return (
                  <li key={a.id}>
                    <Link to={d.a} className={cn('tap flex items-center gap-3 rounded-tarjeta p-4', a.leido ? 'bg-superficie' : 'border-2 border-tinta bg-superficie')}>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="font-semibold">{d.titulo}</span>
                        {d.detalle && <span className="text-[14px] text-texto-2">{d.detalle}</span>}
                        <span className="text-[12px] text-texto-2">{fechaHora(a.recibidoEn)}</span>
                      </span>
                      <ChevronRight className="size-5 shrink-0" aria-hidden="true" />
                    </Link>
                  </li>
                )
              })}
            </ul>
            <Button variante="fantasma" className="self-start" onClick={() => avisos.limpiar()}>
              Borrar todos
            </Button>
          </>
        )}
      </div>
    </Pantalla>
  )
}
