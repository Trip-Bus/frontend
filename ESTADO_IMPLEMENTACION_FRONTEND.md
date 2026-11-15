# Estado de implementación del frontend TripBus

**Actualizado:** 2026-11-13  
**Repositorio trabajado:** `Trip-Bus/frontend`  
**Rama:** `fix/frontedFixes`  
**Publicación remota:** no se hizo push desde esta sesión. Al revisar el tracking local, `HEAD` y `origin/fix/frontedFixes` aparecen alineados (0 commits por delante o detrás).

## Resumen

Las fases 2, 3 y 4 del plan tienen cambios implementados en el frontend. La fase 4 alcanzó el umbral global de cobertura configurado. La fase 5 está en curso: O-07 y los flujos principales del conductor ya están conectados, pero los cambios de esta fase siguen sin commit para que el usuario los revise.

No se modificaron repositorios backend. Se revisaron sus contratos para identificar dependencias que impiden completar algunas pantallas de la fase 5 y para confirmar la integración del GPS.

## Cambios realizados

### Fase 2 — Base transversal

Commit: `f71b805` — `feat(frontend): harden session and role boundaries`

- Se configuró el prefijo `/api/v1` para las llamadas al API Gateway y el reenvío en desarrollo/producción.
- Se implementó renovación compartida de sesión, rotación de tokens, reintento de solicitudes y envío del refresh token al cerrar sesión.
- Se añadieron alertas para expiración de sesión, cuenta suspendida o bloqueada, y MFA obligatorio.
- Se reforzaron las guardias de navegación por rol y el requisito de empresa vinculada para operadores.
- WebSocket ahora reanuda tópicos con su última secuencia, aplica reintentos exponenciales y detiene la reconexión ante el código `4429`.

### Fase 3 — GPS del conductor

Commit: `05480eb` — `feat(frontend): add resilient driver GPS tracking`

- Se implementó el ciclo de rastreo GPS, envío periódico, cola offline de hasta 50 lecturas, envío por lote y solicitud de Wake Lock.
- Se integró el estado del rastreo en la pantalla existente de detalle de viaje de la empresa.

**Contrato backend revisado nuevamente:** `fleet-trip-events-service` expone las rutas de rastreo usadas por el frontend: `/driver/tracking/start`, `/driver/tracking/stop`, `/driver/location` y `/driver/location/batch`. Se corrigió el body del lote: ahora se envía el array JSON de lecturas que espera el backend, sin wrapper `{ positions: [...] }`.

### Fase 4 — Calidad y cobertura

Commit: `b10bf2e` — `feat(frontend): complete phase 4 quality coverage`

- Se configuró Vitest con cobertura V8 y umbrales globales de 40% para líneas, sentencias, funciones y ramas.
- Se añadieron y ampliaron pruebas de lógica, API, sesión, WebSocket, componentes, acceso por rol, autenticación, recuperación de cuenta y seguridad.
- CI ejecuta `npm run test:coverage`; el análisis de SonarQube Cloud queda condicionado a la rama `develop`.
- Se documentó el comando de cobertura y se excluyeron los reportes generados mediante `.gitignore`.

**Última validación local antes de fase 5:** 22 archivos de prueba y 106 pruebas exitosas; build y lint exitosos. Cobertura: 53,46% líneas, 52,06% sentencias, 48,91% funciones y 40,38% ramas.

**Validación de fase 5:** 24 archivos y 112 pruebas exitosas; build, lint y `git diff --check` exitosos. Cobertura global: 54,79% líneas, 53,27% sentencias, 50,48% funciones y 41,93% ramas; se mantienen todos los umbrales de 40%.

## Fase 5 — Pantallas P1

Implementados en frontend, aún sin commit:

- C-01: lista de viajes asignados del día, estado del viaje y acceso al detalle.
- C-02: checklist obligatorio y operación de inicio con observación opcional.
- C-04: SOS con presión sostenida durante dos segundos; el reporte de novedades existente sigue disponible.
- C-05: descarga autenticada del manifiesto y enlace al validador de pase/abordaje existente desde el detalle de viaje.
- C-06: confirmación antes de finalizar el viaje.
- O-07: descarga autenticada del manifiesto CSV.

El checklist de inicio exige los cuatro campos del contrato de Fleet. Las acciones de inicio/fin refrescan las asignaciones del conductor; el control SOS permite cancelar una pulsación corta.

### Conductor

- C-01: implementado en frontend.
- C-02: implementado en frontend.
- C-04: SOS implementado; novedades ya estaban disponibles en el detalle del viaje.
- C-05: integración del manifiesto y acceso al validador existente implementados; queda validar el flujo completo de abordaje contra el backend.
- C-06: implementado en frontend.

**Contrato disponible:** `fleet-trip-events-service` expone `GET /driver/trips?fecha=YYYY-MM-DD` para el conductor autenticado; si se omite la fecha, usa el día actual de `America/Bogota`. Devuelve viajes asignados ordenados por salida, con rol, estado, ventana de rastreo y banderas `iniciado`/`finalizado`. También existe `GET /driver/trips/active`, `POST /driver/trips/{itineraryId}/start`, `POST /driver/trips/{itineraryId}/finish` y `POST /driver/sos`. El frontend usa esos contratos; las operaciones y el SOS cuentan con pruebas de componente.

### Operador

- O-01: Inicio y resumen de ocupación de la flota.
- O-04: Programación de viajes recurrentes y gestión de conflictos.
- O-05: Asignación de conductor principal y relevo.
- O-06: Mapa de flota en vivo y alertas SOS.
- O-07: Manifiesto de viaje descargable como CSV — implementado en frontend, pendiente de revisión/commit local.

**Contrato disponible:** `booking-payment-service` expone `GET /itineraries/{id}/manifest?format=csv`. La respuesta CSV incluye los pasajeros, asientos, estado de tiquete, parada de abordaje/bajada y totales. El acceso está limitado a ADMIN y a OPERADOR/CONDUCTOR de la empresa del viaje. El frontend muestra la descarga en el detalle del viaje para OPERADOR, ADMIN y CONDUCTOR, conserva autenticación/renovación de sesión y muestra errores con las notificaciones existentes.

La integración agrega una solicitud binaria autenticada en el cliente HTTP y descarga el CSV como `manifiesto-{itineraryId}.csv`. Las pruebas cubren el endpoint, el manejo de errores y el disparo de descarga. Los cambios permanecen sin commit para que el usuario revise y confirme.

### Pasajero

- P-02: Mapa de asientos, retenciones por tramo y lista de espera.
- P-03: Datos de pasajeros y desglose de precios/cupones.
- P-04: Pago de reserva e idempotencia.
- P-05: Mis viajes, pases y facturas.
- P-08: Gestión de viajes afectados.
- P-10: Ofertas flash y sala de espera.
- P-12: Seguimiento en vivo y enlace para compartir el viaje.

## Repositorios

| Repositorio | Estado |
|---|---|
| `Trip-Bus/frontend` | Fases 2–4 en historial; O-07, flujos de conductor, corrección GPS y este documento están modificados/sin commit en el worktree. El tracking de la rama está alineado. |
| `catalog-service` | Inspeccionado; sin cambios. Expone programación recurrente y administración de viajes para flujos de operador. |
| `fleet-trip-events-service` | Inspeccionado; sin cambios. Expone mis viajes, asignaciones, inicio/fin, SOS, rastreo y mapa de flota. |
| `booking-payment-service` | Inspeccionado; sin cambios. Expone manifiesto JSON/CSV por itinerario. |
| `API-gateway` | Inspeccionado; sin cambios. Enruta las rutas de conductor y el manifiesto a sus servicios. |

## Próximos pasos

1. Validar la suite completa, build, lint y cobertura tras los cambios de fase 5.
2. Continuar con los ítems P1 pendientes que ya tienen contrato backend: O-01, O-04, O-05, O-06 y las funciones de pasajero restantes.
3. Completar la validación del flujo de abordaje C-05 contra backend y decidir si hacen falta cambios adicionales en frontend.
4. Mantener los cambios sin commit hasta que el usuario indique lo contrario; no hacer push.
