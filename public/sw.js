/* Service worker de TripBus (T-06): muestra los avisos push y, al tocarlos, abre la pantalla relacionada.
 * El gateway manda {title, body, tipo} sin datos personales (US-185). */
const DESTINOS = {
  BookingAffected: '/afectados',
  BookingRelocated: '/mis-tiquetes',
  WaitlistSeatOffered: '/mis-turnos',
  OfferAlert: '/ofertas',
  OfferQueueAdmitted: '/ofertas',
  DriverAssigned: '/conductor',
  DriverAssignmentConflict: '/conductor',
  TripAlertRaised: '/operador/flota',
}

self.addEventListener('push', (evento) => {
  let datos = {}
  try {
    datos = evento.data ? evento.data.json() : {}
  } catch {
    datos = { body: evento.data ? evento.data.text() : '' }
  }
  const titulo = datos.title || 'TripBus'
  evento.waitUntil(
    self.registration.showNotification(titulo, {
      body: datos.body || '',
      icon: '/icono-192.png',
      badge: '/icono-192.png',
      data: { url: DESTINOS[datos.tipo] || '/avisos' },
    }),
  )
})

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close()
  const url = (evento.notification.data && evento.notification.data.url) || '/'
  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      const abierta = ventanas.find((v) => 'focus' in v)
      if (abierta) {
        abierta.navigate(url)
        return abierta.focus()
      }
      return self.clients.openWindow(url)
    }),
  )
})
