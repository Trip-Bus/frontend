import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col items-start gap-4 px-4 py-16 sm:px-6">
      <h1 className="font-display text-titulo-1">Página no encontrada</h1>
      <Link to="/" className="rounded-sm text-verde-andino hover:underline">
        Volver al inicio
      </Link>
    </main>
  )
}
