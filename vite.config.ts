/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// En desarrollo, Vite hace de proxy igual que el NGINX de producción:
//   /api/v1/* → API Gateway (sin el prefijo /api/v1) p. ej. /api/v1/trips/search → :18000/trips/search
//   /ws     → Realtime Gateway (WebSocket)
// Así el navegador solo habla con un origen y no hay problemas de CORS.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.DEV_API_TARGET || 'http://localhost:18000'
  const wsTarget = env.DEV_WS_TARGET || 'ws://localhost:18000'

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      host: true, // accesible desde el celular en la misma red: http://<IP-del-PC>:5173
      port: 5173,
      proxy: {
        '/api/v1': {
          target: apiTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/v1/, ''),
        },
        '/ws': { target: wsTarget, ws: true, changeOrigin: true },
      },
    },
    preview: { host: true, port: 4173 },
    test: {
      environment: 'node',
      include: ['src/**/*.test.{ts,tsx}'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'lcov'],
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/**/*.test.*', 'src/main.tsx', 'src/**/*.d.ts'],
        thresholds: { lines: 40, statements: 40, functions: 40, branches: 40 },
      },
    },
  }
})
