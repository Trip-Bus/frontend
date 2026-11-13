import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'
import { Toaster } from 'sonner'
import { AlertasGlobales } from './components/marca/AlertasGlobales'

// Tipografías autoalojadas (sin depender de Google en tiempo de ejecución; sirven sin señal).
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import '@fontsource-variable/bricolage-grotesque/opsz.css'
import './styles/globals.css'

import { ApiError, EVENTO_MFA_OBLIGATORIA } from './lib/api'
import { router } from './router'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // No reintentar errores de negocio (4xx); sí caídas de red o 5xx, dos veces.
      retry: (fallos, error) =>
        fallos < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
    },
  },
})

// US-106: si el rol exige la verificación en dos pasos y aún no está activa, la API responde 403
// MFA_SETUP_REQUIRED: se lleva a la persona a activarla (desde ahí también puede cerrar sesión).
globalThis.addEventListener(EVENTO_MFA_OBLIGATORIA, () => {
  if (!router.state.location.pathname.startsWith('/cuenta/seguridad')) {
    void router.navigate('/cuenta/seguridad?obligatoria=1', { replace: true })
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <AlertasGlobales />
      <Toaster
        position="top-center"
        toastOptions={{
          className: 'font-sans',
          style: { borderRadius: 16, background: '#0d1411', color: '#fff', border: 'none' },
        }}
      />
    </QueryClientProvider>
  </StrictMode>,
)
