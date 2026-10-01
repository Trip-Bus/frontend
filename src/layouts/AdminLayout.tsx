import { Link, Outlet } from 'react-router'
import { Logo } from '@/shared/components/Logo'

export function AdminLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-verde-andino text-arena">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/admin" className="flex items-center gap-3 rounded-sm">
            <Logo variant="dark" size="sm" />
            <span className="text-etiqueta tracking-wide uppercase">Admin</span>
          </Link>
          <nav className="flex items-center gap-4 text-pequeno font-medium">
            <Link to="/" className="rounded-sm hover:underline">
              Ver sitio
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}
