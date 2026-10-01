import { createBrowserRouter } from 'react-router'
import { AdminLayout } from '../layouts/AdminLayout'
import { PublicLayout } from '../layouts/PublicLayout'
import { AdminHomePage } from '../pages/admin/AdminHomePage'
import { HomePage } from '../pages/HomePage'
import { NotFoundPage } from '../pages/NotFoundPage'

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
  { path: '*', element: <NotFoundPage /> },
])
