import { useParams } from 'react-router'
import { BotonVolver } from '@/components/marca/BotonVolver'
import { Pantalla } from '@/components/marca/Pantalla'

/**
 * Marcador para las pantallas que construye el equipo. Muestra qué pantalla del lienzo
 * de diseño implementa, qué historias cubre y qué endpoints usar (ya tipados en lib/endpoints.ts).
 */
export function EnConstruccion({
  numero,
  titulo,
  historias,
  endpoints,
}: {
  numero: string
  titulo: string
  historias: string
  endpoints: string[]
}) {
  const params = useParams()
  return (
    <Pantalla>
      <header className="flex items-center gap-3 px-5">
        <BotonVolver />
        <span className="num text-[12px] font-bold text-texto-2">PANTALLA {numero}</span>
      </header>
      <section className="mx-5 mt-6 flex flex-col gap-4 rounded-tarjeta bg-superficie p-5">
        <h1 className="font-display text-[28px] leading-tight font-extrabold tracking-[-0.02em]">{titulo}</h1>
        <p className="text-[15px] leading-relaxed text-texto-2">
          Esta ruta ya existe y recibe sus parámetros. Falta construir la interfaz siguiendo la pantalla {numero} del
          lienzo de diseño.
        </p>
        <dl className="flex flex-col gap-3 text-[14px]">
          <div>
            <dt className="font-semibold">Historias</dt>
            <dd className="text-texto-2">{historias}</dd>
          </div>
          <div>
            <dt className="font-semibold">Parámetros de la ruta</dt>
            <dd className="num text-[13px] break-all text-texto-2">{JSON.stringify(params)}</dd>
          </div>
          <div>
            <dt className="font-semibold">Endpoints (ver src/lib/endpoints.ts)</dt>
            <dd>
              <ul className="mt-1 flex flex-col gap-1">
                {endpoints.map((e) => (
                  <li key={e} className="num rounded-lg bg-fondo px-2.5 py-1.5 text-[12px]">
                    {e}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        </dl>
      </section>
    </Pantalla>
  )
}
