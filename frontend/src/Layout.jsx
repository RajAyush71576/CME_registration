import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

const ADMIN_LINKS = [
  { to: '/admin/events', label: 'Events' },
  { to: '/admin/import', label: 'Import' },
  { to: '/admin/reports', label: 'Reports' },
]

const STAFF_LINKS = [
  { to: '/staff/events', label: 'Events' },
  { to: '/staff/check-in', label: 'Check-In' },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const links = user?.role === 'admin' ? ADMIN_LINKS : STAFF_LINKS

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-20 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <span className="text-base font-semibold tracking-tight text-gray-900">
            CME Registration
          </span>

          <nav className="order-3 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto sm:flex-1">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-gray-600 sm:inline">
              {user?.name} <span className="text-gray-400">({user?.role})</span>
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md px-2.5 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}
