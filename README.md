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
| `/ws` (WebSocket) | → `ws://localhost:16007/ws` | → `http://realtime-gateway:16007/ws` |

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
    tiempoReal.ts          WebSocket: useTopico, reconexión con backoff, heartbeat
    formato.ts             Pesos, horas de Colombia, plurales, iniciales (con pruebas)
  components/
    ui/                    Botón, Campo, Hoja inferior (base shadcn/ui)
    marca/                 Pantalla, BarraInferior, LiveDot, Logo, BotonVolver
  features/busqueda.ts     Estado de la búsqueda (URL + última búsqueda)
  pantallas/               Una pantalla por archivo
```

### Lo que ya funciona contra la API real

- **01 Bienvenida** (`/`) — solo la primera vez; con sesión va directo al inicio.
- **Entrar / Crear cuenta** (`/entrar`) — login, registro con política de datos (Ley 1581), redirección segura.
- **02 Inicio** (`/inicio`) — búsqueda en una frase con hojas para ciudad (`GET /trips/cities`), fecha y
  pasajeros; drop activo real (`GET /offers`); cerrar sesión (`POST /auth/logout`).
- **03 Salidas** (`/salidas?origen&destino&fecha&pasajeros`) — `GET /trips/search`, precio más bajo de
  cada día, regla de 24 h, ocupación, oferta, "+1" día, estados vacío, error y carga.

### Lo que sigue (rutas creadas, con los endpoints listados en pantalla)

| Ruta | Pantalla | Historias |
|---|---|---|
| `/viaje/:itineraryId/asientos` | 04 Puestos en vivo | US-016 a 022, US-026 |
| `/pago/:bookingId` | 05 Pago: mantener para pagar | US-031, 032, 034 |
| `/pase/:ticketId`, `/mis-tiquetes` | 06 Pase de abordar | US-033 |
| `/viaje/:itineraryId/en-vivo` | 07 Viaje en vivo | US-038, 039, 046, 047 |
| `/drop/:offerId` | 08 Drop | US-054, 056, 058 |

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

El canal exige sesión (JWT). Una sola conexión para toda la app; reconecta con backoff exponencial
(1 s a 30 s, con jitter) y responde el heartbeat del servidor.

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

**Pendiente en `API-gateway`:** como las peticiones llegan a través del NGINX del frontend, el gateway
ve la IP del contenedor y no la del usuario, y el límite por IP quedaría compartido. Agrega en el bloque
`server` de `nginx/templates/default.conf.template`:

```nginx
set_real_ip_from 172.16.0.0/12;   # red interna de Docker
real_ip_header   X-Forwarded-For;
```

El workflow `.github/workflows/ci-cd.yml` corre lint, pruebas y build en cada PR, y en `main`/`develop`
publica `ghcr.io/trip-bus/frontend`.
