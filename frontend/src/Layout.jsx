import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import ThemeToggle from './ThemeToggle'
import FullscreenToggle from './FullscreenToggle'

const ADMIN_LINKS = [
  { to: '/admin/events', label: 'Events' },
  { to: '/admin/import', label: 'Import' },
  { to: '/admin/reports', label: 'Reports' },
]

const STAFF_LINKS = [{ to: '/staff/events', label: 'Events' }]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const links = user?.role === 'admin' ? ADMIN_LINKS : STAFF_LINKS

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#1c2731]">
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur dark:border-slate-700/60 dark:bg-[#212e39]/95">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <span className="text-base font-semibold tracking-tight text-gray-900 dark:text-white">
            CME Registration
          </span>

          <nav className="order-3 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto sm:flex-1">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `shrink-0 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-400'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-gray-600 sm:inline dark:text-slate-300">
              {user?.name} <span className="text-gray-400 dark:text-slate-500">({user?.role})</span>
            </span>
            <FullscreenToggle />
            <ThemeToggle />
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md px-2.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
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
