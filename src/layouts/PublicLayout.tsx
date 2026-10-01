import { Link, Outlet } from 'react-router'
import { Logo } from '@/shared/components/Logo'

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-borde bg-superficie">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="rounded-sm">
            <Logo variant="light" size="sm" />
          </Link>
          <nav className="flex items-center gap-4 text-pequeno font-medium">
            <Link to="/admin" className="rounded-sm text-verde-andino hover:underline">
              Admin
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
