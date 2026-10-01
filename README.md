# TripBus – Frontend

Frontend web de **TripBus**, la plataforma de venta de tiquetes de bus. En esta primera versión cubre los roles **Pasajero** y **Admin**.

Construido con **React + Vite + TypeScript**. Solo se comunica con:

- **API Gateway (REST)** — autenticación con JWT en el header `Authorization: Bearer <token>`.
- **Realtime Gateway (WebSocket)** — el JWT va en la query: `?token=<JWT>`.

## Requisitos

- Node.js 20.19+ (o 22.12+)

## Instalación

```bash
npm install
cp .env.example .env.local   # luego ajusta los valores si hace falta
```

## Ejecución

```bash
npm run dev       # servidor de desarrollo en http://localhost:5173
npm run build     # compila a dist/
npm run preview   # sirve el build localmente
npm run lint      # linter (oxlint)
```

## Sistema de diseño

**TripBus · Cordillera**, implementado con Tailwind CSS v4 + shadcn/ui (Radix) e íconos `lucide-react`.

- Los tokens (colores, radios, sombra, tipografía) viven en `src/index.css` dentro de `@theme`. La paleta por defecto de Tailwind está desactivada: usa solo clases de tokens, como `bg-verde-andino` o `text-texto-suave`.
- Los componentes de shadcn están en `src/components/ui/` y son código propio (editables).
- En desarrollo, abre **http://localhost:5173/dev/ui** para revisar paleta, tipografía y componentes. Esa ruta no existe en el build de producción.

## Variables de entorno

| Variable       | Descripción                         | Valor local                |
| -------------- | ----------------------------------- | -------------------------- |
| `VITE_API_URL` | URL base del API Gateway (REST)     | `http://localhost:8080`    |
| `VITE_WS_URL`  | URL del Realtime Gateway (WebSocket)| `ws://localhost:16007/ws`  |

`.env.local` no se sube al repositorio; `.env.example` sirve de plantilla. Vite solo expone al navegador las variables con prefijo `VITE_` (vía `import.meta.env`).
