import { createBrowserRouter, type RouteObject } from 'react-router'
import { AdminLayout } from '@/layouts/AdminLayout'
import { PublicLayout } from '@/layouts/PublicLayout'
import { AdminHomePage } from '@/pages/admin/AdminHomePage'
import { HomePage } from '@/pages/HomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'

// Rutas solo de desarrollo: en `npm run build` import.meta.env.DEV es false
// y el import dinámico desaparece del bundle de producción.
const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: '/dev/ui',
        lazy: async () => ({ Component: (await import('@/pages/dev/UiPage')).UiPage }),
      },
    ]
  : []

export const router = createBrowserRouter([
  {
    path: '/',
    element: <PublicLayout />,
    children: [{ index: true, element: <HomePage /> }],
  },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [{ index: true, element: <AdminHomePage /> }],
  },
  ...devRoutes,
  { path: '*', element: <NotFoundPage /> },
])
