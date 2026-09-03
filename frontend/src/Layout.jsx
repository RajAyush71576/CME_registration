import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

const links = [
  { to: '/events', label: 'Events' },
  { to: '/participants', label: 'Participants' },
  { to: '/import', label: 'Import' },
  { to: '/check-in', label: 'Check-In' },
  { to: '/reports', label: 'Reports' },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-4xl items-center gap-6 px-4 py-3">
          <span className="font-semibold">CME Registration</span>
          <nav className="flex flex-1 gap-4">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `text-sm ${isActive ? 'font-semibold text-blue-600' : 'text-gray-600'}`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
          <span className="text-sm text-gray-600">
            {user?.name} <span className="text-gray-400">({user?.role})</span>
          </span>
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm text-gray-600 underline"
          >
            Log out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
