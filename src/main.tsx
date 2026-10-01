import { LucideProvider } from 'lucide-react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import './index.css'
import { router } from '@/app/router'
import { Toaster } from '@/components/ui/sonner'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LucideProvider strokeWidth={1.75}>
      <RouterProvider router={router} />
      <Toaster />
    </LucideProvider>
  </StrictMode>,
)
