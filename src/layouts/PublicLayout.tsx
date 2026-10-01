import { Link, Outlet } from 'react-router'

export function PublicLayout() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 24px',
          borderBottom: '1px solid #ccc',
        }}
      >
        <Link to="/">TripBus</Link>
        <nav>
          <Link to="/admin">Admin</Link>
        </nav>
      </header>
      <main style={{ flex: 1, padding: 24 }}>
        <Outlet />
      </main>
    </div>
  )
}
