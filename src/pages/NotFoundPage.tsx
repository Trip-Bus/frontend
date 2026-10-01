import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Página no encontrada</h1>
      <Link to="/">Volver al inicio</Link>
    </main>
  )
}
