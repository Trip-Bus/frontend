import { createBrowserRouter } from 'react-router'
import { ErrorRuta } from './pantallas/ErrorRuta'
import { RequiereEquipo, RequiereSesion, Raiz } from './pantallas/guardias'
import { NoEncontrada } from './pantallas/NoEncontrada'

/**
 * Mapa de pantallas ↔ lienzo de diseño "TripBus — Rediseño móvil":
 *  01 Bienvenida · 02 Inicio · 03 Salidas · 04 Asientos · 05 Pago · 06 Pase
 *  07 Viaje en vivo · 08 Drop · 09 Estados de error (dentro de cada pantalla) · 10 Sistema
 * Más el panel de la empresa (conductor, operador y admin).
 *
 * Cada pantalla se carga por separado (`lazy`): el celular descarga solo lo que abre.
 */
export const router = createBrowserRouter([
  {
    // Cualquier error de una pantalla (incluida una versión vieja tras un despliegue) cae aquí.
    errorElement: <ErrorRuta />,
    children: [
      { path: '/', element: <Raiz /> },
      { path: '/entrar', lazy: () => import('./pantallas/Entrar').then((m) => ({ Component: m.Entrar })) },
      { path: '/inicio', lazy: () => import('./pantallas/Inicio').then((m) => ({ Component: m.Inicio })) },
      { path: '/salidas', lazy: () => import('./pantallas/Salidas').then((m) => ({ Component: m.Salidas })) },
      // Públicas: el mapa en vivo de puestos, el drop y el bus en vivo se ven sin cuenta.
      { path: '/viaje/:itineraryId/asientos', lazy: () => import('./pantallas/Asientos').then((m) => ({ Component: m.Asientos })) },
      { path: '/viaje/:itineraryId/en-vivo', lazy: () => import('./pantallas/EnVivo').then((m) => ({ Component: m.EnVivo })) },
      { path: '/drop/:offerId', lazy: () => import('./pantallas/Drop').then((m) => ({ Component: m.Drop })) },
      {
        element: <RequiereSesion />,
        children: [
          { path: '/reserva/:holdId', lazy: () => import('./pantallas/Reserva').then((m) => ({ Component: m.Reserva })) },
          { path: '/pago/:bookingId', lazy: () => import('./pantallas/Pago').then((m) => ({ Component: m.Pago })) },
          { path: '/pase/:ticketId', lazy: () => import('./pantallas/Pase').then((m) => ({ Component: m.Pase })) },
          { path: '/mis-tiquetes', lazy: () => import('./pantallas/MisTiquetes').then((m) => ({ Component: m.MisTiquetes })) },
          { path: '/cuenta', lazy: () => import('./pantallas/Cuenta').then((m) => ({ Component: m.Cuenta })) },
        ],
      },
      {
        element: <RequiereEquipo />,
        children: [
          { path: '/panel', lazy: () => import('./pantallas/panel/Panel').then((m) => ({ Component: m.Panel })) },
          { path: '/panel/viaje/:itineraryId', lazy: () => import('./pantallas/panel/PanelViaje').then((m) => ({ Component: m.PanelViaje })) },
          { path: '/panel/validar', lazy: () => import('./pantallas/panel/Validar').then((m) => ({ Component: m.Validar })) },
        ],
      },
      { path: '*', element: <NoEncontrada /> },
    ],
  },
])
