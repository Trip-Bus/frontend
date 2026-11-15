import { createBrowserRouter } from 'react-router'
import { ErrorRuta } from './pantallas/ErrorRuta'
import { RequiereEquipo, RequiereRol, RequiereSesion, Raiz, SoloPasajero } from './pantallas/guardias'
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
      {
        element: <SoloPasajero />,
        children: [
          { path: '/inicio', lazy: () => import('./pantallas/Inicio').then((m) => ({ Component: m.Inicio })) },
          { path: '/salidas', lazy: () => import('./pantallas/Salidas').then((m) => ({ Component: m.Salidas })) },
          { path: '/ofertas', lazy: () => import('./pantallas/Ofertas').then((m) => ({ Component: m.Ofertas })) },
        ],
      },
      // Públicas: el mapa en vivo de puestos, el drop y el bus en vivo se ven sin cuenta.
      { path: '/viaje/:itineraryId/asientos', lazy: () => import('./pantallas/Asientos').then((m) => ({ Component: m.Asientos })) },
      { path: '/viaje/:itineraryId/en-vivo', lazy: () => import('./pantallas/EnVivo').then((m) => ({ Component: m.EnVivo })) },
      { path: '/drop/:offerId', lazy: () => import('./pantallas/Drop').then((m) => ({ Component: m.Drop })) },
      // US-181: el familiar abre el viaje compartido sin cuenta.
      { path: '/compartido/:codigo', lazy: () => import('./pantallas/Compartido').then((m) => ({ Component: m.Compartido })) },
      // Enlaces de los correos de Identity: recuperar la contraseña (US-125) y verificar el correo (US-130).
      { path: '/recuperar', lazy: () => import('./pantallas/Recuperar').then((m) => ({ Component: m.Recuperar })) },
      { path: '/restablecer', lazy: () => import('./pantallas/Restablecer').then((m) => ({ Component: m.Restablecer })) },
      { path: '/verificar-correo', lazy: () => import('./pantallas/VerificarCorreo').then((m) => ({ Component: m.VerificarCorreo })) },
      {
        element: <RequiereRol roles={['CONDUCTOR']} />,
        children: [
          { path: '/conductor', lazy: () => import('./pantallas/Conductor').then((m) => ({ Component: m.Conductor })) },
        ],
      },
      {
        element: <RequiereSesion />,
        children: [
          {
            element: <RequiereRol roles={['PASAJERO']} />,
            children: [
              { path: '/reserva/:holdId', lazy: () => import('./pantallas/Reserva').then((m) => ({ Component: m.Reserva })) },
              { path: '/pago/:bookingId', lazy: () => import('./pantallas/Pago').then((m) => ({ Component: m.Pago })) },
              { path: '/pase/:ticketId', lazy: () => import('./pantallas/Pase').then((m) => ({ Component: m.Pase })) },
              { path: '/mis-tiquetes', lazy: () => import('./pantallas/MisTiquetes').then((m) => ({ Component: m.MisTiquetes })) },
              // Viajes afectados por la empresa (P-08) y reprogramar (P-06).
              { path: '/afectados', lazy: () => import('./pantallas/Afectados').then((m) => ({ Component: m.Afectados })) },
              { path: '/reprogramar/:bookingId', lazy: () => import('./pantallas/Reprogramar').then((m) => ({ Component: m.Reprogramar })) },
              { path: '/mis-turnos', lazy: () => import('./pantallas/MisTurnos').then((m) => ({ Component: m.MisTurnos })) },
              { path: '/avisos', lazy: () => import('./pantallas/Avisos').then((m) => ({ Component: m.Avisos })) },
              { path: '/tiquete/:ticketId/cambios', lazy: () => import('./pantallas/CambiosTiquete').then((m) => ({ Component: m.CambiosTiquete })) },
              { path: '/cuenta/alertas', lazy: () => import('./pantallas/RutasSeguidas').then((m) => ({ Component: m.RutasSeguidas })) },
            ],
          },
          // La cuenta es de cualquier rol: el operador y el admin activan aquí la verificación en dos pasos.
          { path: '/cuenta', lazy: () => import('./pantallas/Cuenta').then((m) => ({ Component: m.Cuenta })) },
          // Tus datos (US-128, US-131) y seguridad (US-129, US-106).
          { path: '/cuenta/datos', lazy: () => import('./pantallas/CuentaDatos').then((m) => ({ Component: m.CuentaDatos })) },
          { path: '/cuenta/seguridad', lazy: () => import('./pantallas/Seguridad').then((m) => ({ Component: m.Seguridad })) },
        ],
      },
      {
        // Pantallas de la empresa: el OPERADOR ve la suya; el ADMIN elige la empresa con ?companyId= (A-06).
        element: <RequiereRol roles={['OPERADOR', 'ADMIN']} requiereEmpresa />,
        children: [
          { path: '/operador', lazy: () => import('./pantallas/operador/InicioOperador').then((m) => ({ Component: m.InicioOperador })) },
          { path: '/operador/viajes', lazy: () => import('./pantallas/operador/Viajes').then((m) => ({ Component: m.Viajes })) },
          { path: '/operador/flota', lazy: () => import('./pantallas/operador/Flota').then((m) => ({ Component: m.Flota })) },
          { path: '/operador/buses', lazy: () => import('./pantallas/operador/Buses').then((m) => ({ Component: m.Buses })) },
          { path: '/operador/rutas', lazy: () => import('./pantallas/operador/Rutas').then((m) => ({ Component: m.Rutas })) },
          { path: '/operador/ofertas', lazy: () => import('./pantallas/operador/OfertasOperador').then((m) => ({ Component: m.OfertasOperador })) },
          { path: '/operador/automaticas', lazy: () => import('./pantallas/operador/Automaticas').then((m) => ({ Component: m.Automaticas })) },
          { path: '/operador/tarifas', lazy: () => import('./pantallas/operador/Tarifas').then((m) => ({ Component: m.Tarifas })) },
          { path: '/operador/cupones', lazy: () => import('./pantallas/operador/Cupones').then((m) => ({ Component: m.Cupones })) },
          { path: '/operador/reportes', lazy: () => import('./pantallas/operador/Reportes').then((m) => ({ Component: m.Reportes })) },
        ],
      },
      {
        element: <RequiereRol roles={['OPERADOR']} requiereEmpresa />,
        children: [
          { path: '/operador/taquilla', lazy: () => import('./pantallas/operador/Taquilla').then((m) => ({ Component: m.Taquilla })) },
        ],
      },
      {
        element: <RequiereRol roles={['ADMIN']} />,
        children: [
          { path: '/admin', lazy: () => import('./pantallas/admin/InicioAdmin').then((m) => ({ Component: m.InicioAdmin })) },
          { path: '/admin/usuarios', lazy: () => import('./pantallas/admin/Usuarios').then((m) => ({ Component: m.Usuarios })) },
          { path: '/admin/empresas', lazy: () => import('./pantallas/admin/Empresas').then((m) => ({ Component: m.Empresas })) },
          { path: '/admin/facturacion', lazy: () => import('./pantallas/admin/Facturacion').then((m) => ({ Component: m.Facturacion })) },
          { path: '/admin/auditoria', lazy: () => import('./pantallas/admin/Auditoria').then((m) => ({ Component: m.Auditoria })) },
          { path: '/admin/terminales', lazy: () => import('./pantallas/admin/Terminales').then((m) => ({ Component: m.Terminales })) },
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
