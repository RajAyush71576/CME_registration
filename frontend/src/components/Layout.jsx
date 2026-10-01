import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ThemeToggle } from '../contexts/ThemeContext'

const NAV = {
  admin: [
    { to: '/admin/events', label: 'Events' },
    { to: '/participants', label: 'Participants' },
    { to: '/admin/import', label: 'Import' },
    { to: '/admin/reports', label: 'Reports' },
    { to: '/admin/users', label: 'Users' },
  ],
  staff: [{ to: '/staff/events', label: 'Events' }],
}

export function Logo({ size = 'h-9 w-9 text-lg' }) {
  return (
    <span className={`grid ${size} shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-600 to-brand-800 font-extrabold text-white shadow-sm shadow-brand-900/30`}>
      C
    </span>
  )
}

function FullscreenToggle() {
  const [full, setFull] = useState(!!document.fullscreenElement)
  useEffect(() => {
    const onChange = () => setFull(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])
  if (!document.documentElement.requestFullscreen) return null
  const toggle = () => (full ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {})
  return (
    <button type="button" onClick={toggle} className="btn-ghost min-w-11 px-2.5 text-lg" aria-label={full ? 'Exit full screen' : 'Full screen'} title={full ? 'Exit full screen' : 'Full screen'}>
      {full ? '⤡' : '⤢'}
    </button>
  )
}

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const onLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-gray-200/80 bg-white/80 backdrop-blur-md dark:border-white/10 dark:bg-night-header/85">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6">
          <NavLink to="/" className="flex items-center gap-2.5 font-bold tracking-tight">
            <Logo />
            <span className="text-base sm:text-lg">CME Registration</span>
          </NavLink>
          <nav className="order-last flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto">
            {NAV[user.role].map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `btn min-h-10 px-3.5 ${isActive
                    ? 'bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10'}`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <div className="mr-2 hidden text-right leading-tight md:block">
              <div className="text-sm font-semibold">{user.name}</div>
              <div className="text-xs text-gray-500 capitalize dark:text-gray-400">{user.role}</div>
            </div>
            <FullscreenToggle />
            <ThemeToggle />
            <button type="button" onClick={onLogout} className="btn-secondary min-h-10 px-3">Log out</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  )
}
