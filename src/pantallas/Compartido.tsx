import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'
import { Esqueleto, PantallaError } from '@/components/marca/Estados'
import { Pantalla } from '@/components/marca/Pantalla'
import { api } from '@/lib/endpoints'
import { VistaEnVivo } from './EnVivo'

/**
 * US-181: el familiar abre /compartido/{codigo} sin iniciar sesión y ve el bus en vivo. El enlace vence y nunca
 * muestra datos de los pasajeros.
 */
export function Compartido() {
  const { codigo = '' } = useParams()
  const enlace = useQuery({ queryKey: ['compartido', codigo], queryFn: () => api.viaje.compartido(codigo), retry: false })
  if (enlace.isError) {
    return <PantallaError titulo="Este enlace ya no sirve" error={enlace.error} volverA="/" />
  }
  if (!enlace.data) {
    return (
      <Pantalla>
        <Esqueleto bloques={[300, 200]} />
      </Pantalla>
    )
  }
  return <VistaEnVivo itineraryId={enlace.data.itineraryId} compartido />
}

