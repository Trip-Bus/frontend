import { Link, Outlet } from 'react-router'

export function AdminLayout() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 24px',
          background: '#333',
          color: '#fff',
        }}
      >
        <Link to="/admin" style={{ color: 'inherit' }}>
          TripBus · Admin
        </Link>
        <nav>
          <Link to="/" style={{ color: 'inherit' }}>
            Ver sitio
          </Link>
        </nav>
      </header>
      <main style={{ flex: 1, padding: 24 }}>
        <Outlet />
      </main>
    </div>
  )
}
