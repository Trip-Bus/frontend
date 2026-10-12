# TripBus — Frontend

App móvil (web instalable) para comprar tiquetes de bus con el **puesto en vivo** y seguir el viaje.
React 19 + TypeScript + Vite + Tailwind 4, sobre el backend de microservicios de TripBus.

> Diseño de referencia: lienzo **"TripBus — Rediseño móvil"** (pantallas 01–10). Cada ruta de esta
> app dice qué pantalla del lienzo implementa.

---

## Arrancar en 3 pasos

**Requisitos:** Node.js 22 LTS (o 20.19+) y el backend corriendo con `docker compose` en el repo
`API-gateway` (gateway en `:8080`, realtime en `:16007`).

```bash
npm install
npm run dev
```

Abre `http://localhost:5173`. Para probar en tu **celular**, conéctalo a la misma red Wi-Fi y abre
`http://<IP-de-tu-PC>:5173` (Vite la muestra al arrancar). Las animaciones y los gestos se juzgan en
un teléfono real, no en el emulador del navegador.

Usuario de prueba (con `DEMO_USERS_ENABLED=true` en el backend): `pasajero@tripbus.co` / `TripBus2026`.

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga en caliente |
| `npm run build` | Revisa tipos y genera `dist/` |
| `npm run lint` | Lint con oxlint |
| `npm test` | Pruebas (Vitest) |
| `npm run preview` | Sirve el build para revisarlo |

### ¿Cómo llega la app al backend?

El navegador **solo habla con su propio origen**, así no hay problemas de CORS:

| La app llama a | En desarrollo (Vite) | En producción (NGINX de este repo) |
|---|---|---|
| `/api/trips/search` | → `http://localhost:8080/trips/search` | → `http://api-gateway:8080/trips/search` |
| `/ws` (WebSocket) | → `ws://localhost:16007/ws` | → `${REALTIME_URL}/ws` |

En la rama `develop` del backend el API Gateway ya enruta `/ws` (puerto 18000) y el 18007 no se publica
en PROD: ahí basta con `REALTIME_URL` igual a `API_GATEWAY_URL` (en desarrollo,
`DEV_WS_TARGET=ws://localhost:18000`).

Para cambiar destinos en desarrollo copia `.env.example` como `.env.local`.

---

## Estructura

```
src/
  main.tsx                 Fuentes, estilos, React Query, router y avisos (Sonner)
  router.tsx               Rutas ↔ pantallas del lienzo (cada una se carga por separado)
  styles/globals.css       Sistema visual: colores, tipos, curvas, reglas móviles
  lib/
    tipos.ts               Tipos de la API, copiados de los DTO reales del backend
    api.ts                 fetch + errores ({ error: { code, message } }) + mensajes en español
    endpoints.ts           TODAS las llamadas al backend, agrupadas por microservicio
    sesion.ts              JWT de Identity (useSesion)
    tiempoReal.ts          WebSocket: useTopico, connect por mensaje, respaldo REST, backoff, heartbeat
    formato.ts             Pesos, horas de Colombia, plurales, iniciales (con pruebas)
    tarjeta.ts             Luhn, marca, formato y token sandbox (el número nunca sale del teléfono)
    ciudades.ts            Códigos cortos de ciudad (BOG, MDE…)
  components/
    ui/                    Botón, Campo, Hoja inferior (base shadcn/ui)
    marca/                 Pantalla, BarraInferior, LiveDot, Logo, BotonVolver, MapaBus, Contador,
                           BotonMantener, EstadoVivo, Estados (esqueleto, error, aviso)
  features/
    busqueda.ts            Estado de la búsqueda (URL + última búsqueda)
    mapaAsientos.ts        Distribución real del bus + estados → puestos (ventana/pasillo, sugerido)
    retenciones.ts         Puesto apartado y último viajero (por dispositivo)
    pagos.ts               Idempotency-Key por reserva
    pases.ts               Pases guardados para abrir sin señal
    seguimiento.ts         Proyección del mapa, avance sobre la ruta, retraso, simulador
    gps.ts                 Envío de GPS del conductor (real o simulado)
  pantallas/               Una pantalla por archivo (panel/ para la empresa)
```

### Pantallas (todas contra la API real)

| Ruta | Pantalla | Historias |
|---|---|---|
| `/` | 01 Bienvenida (solo la primera vez) | — |
| `/entrar` | Entrar y crear cuenta (política de datos, Ley 1581) | US-001, US-096 |
| `/inicio` | 02 Búsqueda en una frase + drop activo | US-007, US-014 |
| `/salidas` | 03 Salidas del día: precio por día, regla de 24 h, ocupación | US-007, US-008, US-014 |
| `/viaje/:id/asientos` | 04 Puestos en vivo: mapa real (1 o 2 pisos), estados por WebSocket, apartar 10 min, conflicto 409 con puesto sugerido | US-016 a 022, US-026 |
| `/reserva/:holdId` | Datos del viajero y total, cuenta regresiva, pedir más tiempo, soltar | US-022, US-031 |
| `/pago/:bookingId` | 05 Pago con tarjeta "mantén para pagar", Idempotency-Key, aprobado / rechazado / vencido | US-032, US-034 |
| `/pase/:ticketId` | 06 Pase de abordar con QR (se guarda en el teléfono: abre sin señal), compartir el viaje | US-033 |
| `/mis-tiquetes` | Próximos, por pagar, en proceso e historial | US-033 |
| `/viaje/:id/en-vivo` | 07 Viaje en vivo (público): mapa de la ruta, bus, retraso, paradas, novedades | US-039, US-047 |
| `/drop/:offerId` | 08 Drop: tiempo y cupo en vivo, "Apartar uno" con documento | US-056, US-058 |
| `/panel` | Panel de la empresa (conductor, operador, admin): viajes de su empresa, datos demo (admin) | US-005, HT-01 |
| `/panel/viaje/:id` | Reportar novedad, enviar GPS (del teléfono o simulado), crear / activar / cerrar drops | US-038, US-046, US-054 |
| `/panel/validar` | Validar el pase al abordar (cámara con BarcodeDetector o texto del QR) | US-033 |

Las rutas de compra exigen sesión; el panel exige rol CONDUCTOR, OPERADOR o ADMIN (US-005).

### Probar la demo completa

Con `DEMO_USERS_ENABLED=true` en el backend (contraseña `TripBus2026`):

1. **Pasajero** (`pasajero@tripbus.co`): busca Bogotá → Medellín, elige puesto, llena datos y paga con
   `4242 4242 4242 4242` (cualquier fecha futura, CVC 123). Con `4000 0000 0000 0002` el banco rechaza.
2. **Concurrencia en vivo**: abre el mismo viaje en dos navegadores; cuando uno aparta, el otro lo ve
   al instante. Si dos tocan el mismo puesto, uno recibe "Alguien tomó el 14…" con un puesto sugerido.
3. **Operador** (`operador@tripbus.co`): Panel → un viaje → *Crear drop* (elige puestos, precio, cupo).
   Arranca 15 s después; los pasajeros lo ven en el inicio y el cupo baja en vivo.
4. **Conductor** (`conductor@tripbus.co`): Panel → un viaje → *Reportar novedad* (p. ej. retraso de 20 min)
   y *Simular recorrido*. En `/viaje/:id/en-vivo` se ve el bus moverse y el "+20 min".
5. **Abordaje**: Panel → *Validar pase* → pega el `qrCode` del tiquete o escanéalo con la cámara.

---

## Cómo se usa la API

```tsx
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/endpoints'
import { ApiError, nuevaClaveIdempotencia } from '@/lib/api'

const estados = useQuery({ queryKey: ['asientos', id], queryFn: () => api.asientos.estados(id) })

// Pagos: una clave por intento. Reintentar el MISMO intento reutiliza la clave → un solo cobro.
const [clave] = useState(nuevaClaveIdempotencia)
const pagar = useMutation({ mutationFn: () => api.reservas.pagar(bookingId, datos, clave) })

// Errores: ApiError trae status, code del backend y un mensaje listo para el usuario.
if (pagar.error instanceof ApiError) toast(pagar.error.paraUsuario)
```

### Tiempo real

```tsx
import { topicos, useTopico, useEstadoTiempoReal } from '@/lib/tiempoReal'

useTopico(topicos.asientos(itineraryId), (m) => {
  if (m.type === 'snapshot') {/* estado completo al suscribirse */}
  if (m.type === 'event' && m.event === 'SeatStateChanged') {/* un puesto cambió */}
})
const estado = useEstadoTiempoReal() // 'en-vivo' | 'reconectando' | ... → mostrar "Sin conexión en vivo"
```

Una sola conexión para toda la app. Se abre `/ws` **sin token en la URL** y el JWT va en el primer
mensaje (`{"type":"connect","token":…}`), que es lo único que acepta PROD (US-030). Sin sesión se manda
`{"type":"connect"}`: en `develop` abre una sesión anónima para los tópicos públicos (US-039); en `main`
responde `TOKEN_REQUIRED` y la pantalla sigue por REST. Si el canal no está "en vivo", cada pantalla
consulta por REST cada 4–5 s (`useIntervaloRespaldo`). Reconecta con backoff exponencial (1 s a 30 s,
con jitter) y responde el heartbeat del servidor.

---

## Reglas de diseño (no negociables)

**Color** — `tinta` para texto y botones principales, `lima` para todo lo del pasajero (tu puesto, tu
bus, confirmaciones) **siempre con tinta encima**, `naranja` para "otros" y urgencia (drops, presencia)
**nunca con texto blanco**. Texto secundario mínimo `texto-2` (7:1). Ningún estado se distingue solo por
color: los puestos llevan número, ✓, punto o ✕. Todo pensado para leerse **al sol**.

**Tipo** — `font-display` (Bricolage Grotesque) para titulares; `font-sans` (Geist) para la interfaz;
clase `num` (Geist Mono tabular) para horas, precios, puestos y contadores.

**Movimiento** (curvas en `globals.css`) — presionar: clase `tap` (160 ms, `scale(.97)`); cambios de
estado 200 ms; hojas con Vaul. Nunca `scale(0)`, nunca `ease-in`, solo `transform`/`opacity`. Lo que se
toca cientos de veces (barra inferior, contadores) **no se anima**. Todo respeta
`prefers-reduced-motion`.

**Móvil** — ya configurado: sin destello al tocar, `100dvh`, márgenes seguros (`pt-seguro`,
`pb-seguro`), campos de 16 px con `inputMode`/`enterKeyHint`, hover solo con mouse, carriles con imán
(`carril`), hojas con `scroll-hoja`. Nada tocable mide menos de 44 px.

**Peor caso** — nombres de empresa largos en una línea con "…" (y `title`), rutas largas se parten,
precios y horas **nunca** se truncan, plurales con `plural()`, y toda lista tiene estado vacío, de error
y de carga.

---

## Agregar componentes

- **shadcn/ui** (gratis, MIT): `npx shadcn@latest add dialog` — sale con los colores de TripBus porque
  `globals.css` mapea sus variables a la marca.
- **React Bits** (gratis): `npx shadcn@latest add @react-bits/<Componente>-TS-TW`. Úsalo solo en
  momentos especiales (Bienvenida, Drop), nunca en asientos, pago o seguimiento.

---

## Despliegue

La imagen sirve la app con NGINX y hace de proxy a `/api` y `/ws`:

```bash
docker build -t ghcr.io/trip-bus/frontend .
docker run -p 3000:80 \
  -e API_GATEWAY_URL=http://api-gateway:8080 \
  -e REALTIME_URL=http://realtime-gateway:16007 \
  ghcr.io/trip-bus/frontend
```

Para levantarla junto al backend, agrega este servicio al `docker-compose.yml` del repo `API-gateway`:

```yaml
  frontend:
    restart: unless-stopped
    image: ${REGISTRY:-ghcr.io/trip-bus}/frontend:${TAG:-latest}
    build: ../frontend
    ports:
      - "${FRONTEND_PORT:-3000}:80"
    depends_on:
      - api-gateway
      - realtime-gateway
```

### Notas para el equipo de backend

- **Carrera al crear ofertas en `main`:** con `inicio = ahora`, el scheduler puede activar la oferta antes
  de que Seat Inventory reserve sus asientos y el cupo queda en 0. `develop` lo corrige (estado
  `BORRADOR`, US-054). Mientras tanto el panel crea los drops con inicio 15 s en el futuro.
- **`/itineraries/{id}/bus-position` en `main`** responde `PROGRAMADO` antes de la hora de salida aunque
  el bus ya transmita; la pantalla en vivo muestra el bus si la última señal tiene menos de 5 min.
- El frontend ya soporta los cambios de `develop` (WebSocket por el gateway, `connect` sin token en la
  URL, seguimiento anónimo, oferta `BORRADOR`).

**Pendiente en `API-gateway`:** como las peticiones llegan a través del NGINX del frontend, el gateway
ve la IP del contenedor y no la del usuario, y el límite por IP quedaría compartido. Agrega en el bloque
`server` de `nginx/templates/default.conf.template`:

```nginx
set_real_ip_from 172.16.0.0/12;   # red interna de Docker
real_ip_header   X-Forwarded-For;
```

El workflow `.github/workflows/ci-cd.yml` corre lint, pruebas y build en cada PR, y en `main`/`develop`
publica `ghcr.io/trip-bus/frontend`.
