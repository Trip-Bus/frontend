import { createBrowserRouter } from 'react-router'
import { EnConstruccion } from './pantallas/EnConstruccion'
import { RequiereSesion, Raiz } from './pantallas/guardias'
import { NoEncontrada } from './pantallas/NoEncontrada'

/**
 * Mapa de pantallas ↔ lienzo de diseño "TripBus — Rediseño móvil":
 *  01 Bienvenida · 02 Inicio · 03 Salidas · 04 Asientos · 05 Pago · 06 Pase
 *  07 Viaje en vivo · 08 Drop · 09 Estados de error · 10 Sistema
 *
 * Cada pantalla se carga por separado (`lazy`): el celular descarga solo lo que abre.
 */
export const router = createBrowserRouter([
  { path: '/', element: <Raiz /> },
  { path: '/entrar', lazy: () => import('./pantallas/Entrar').then((m) => ({ Component: m.Entrar })) },
  { path: '/inicio', lazy: () => import('./pantallas/Inicio').then((m) => ({ Component: m.Inicio })) },
  { path: '/salidas', lazy: () => import('./pantallas/Salidas').then((m) => ({ Component: m.Salidas })) },
  {
    path: '/viaje/:itineraryId/asientos',
    element: (
      <EnConstruccion
        numero="04"
        titulo="Puestos en vivo"
        historias="US-016 a US-022, US-026"
        endpoints={[
          'GET /itineraries/{id}/seatmap (distribución)',
          'GET /seats/itineraries/{id} (estados)',
          'WS itinerario:{id}:asientos',
          'POST /seats/holds',
        ]}
      />
    ),
  },
  {
    path: '/viaje/:itineraryId/en-vivo',
    element: (
      <EnConstruccion
        numero="07"
        titulo="Viaje en vivo"
        historias="US-038, US-039, US-046, US-047"
        endpoints={['GET /itineraries/{id}/bus-position', 'GET /trips/{id}/timeline', 'WS bus:{busId}:posicion', 'WS viaje:{id}:eventos']}
      />
    ),
  },
  {
    path: '/drop/:offerId',
    element: (
      <EnConstruccion
        numero="08"
        titulo="Drop: oferta flash"
        historias="US-054, US-056, US-058"
        endpoints={['GET /offers/{id}', 'WS oferta:{id}:cupo', 'POST /offers/{id}/reservations']}
      />
    ),
  },
  {
    element: <RequiereSesion />,
    children: [
      {
        path: '/pago/:bookingId',
        element: (
          <EnConstruccion
            numero="05"
            titulo="Pago: mantener para pagar"
            historias="US-031, US-032, US-034"
            endpoints={['POST /bookings', 'POST /bookings/{id}/pay + Idempotency-Key', 'GET /bookings/{id} (esperar CONFIRMADA)']}
          />
        ),
      },
      {
        path: '/pase/:ticketId',
        element: (
          <EnConstruccion numero="06" titulo="Pase de abordar" historias="US-033" endpoints={['GET /tickets/{id} (qrImage)']} />
        ),
      },
      {
        path: '/mis-tiquetes',
        element: (
          <EnConstruccion numero="06" titulo="Mis tiquetes" historias="US-033" endpoints={['GET /bookings']} />
        ),
      },
    ],
  },
  { path: '*', element: <NoEncontrada /> },
])
