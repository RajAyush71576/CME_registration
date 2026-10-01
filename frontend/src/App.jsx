import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import { homeFor, useAuth } from './contexts/AuthContext'
import EventDetail from './pages/EventDetail'
import Events from './pages/Events'
import Import from './pages/Import'
import Login from './pages/Login'
import Participants from './pages/Participants'
import Reports from './pages/Reports'
import Users from './pages/Users'

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) {
    return <div className="grid min-h-screen place-items-center text-sm text-gray-500 dark:text-gray-400">Loading…</div>
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}

function RequireRole({ roles, children }) {
  const { user } = useAuth()
  return roles.includes(user.role) ? children : <Navigate to={homeFor(user)} replace />
}

const admin = (el) => <RequireRole roles={['admin']}>{el}</RequireRole>
const anyone = (el) => <RequireRole roles={['admin', 'staff']}>{el}</RequireRole>

function Home() {
  const { user } = useAuth()
  return <Navigate to={homeFor(user)} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Home />} />
        <Route path="/admin/events" element={admin(<Events />)} />
        <Route path="/admin/events/:eventId" element={admin(<EventDetail />)} />
        <Route path="/admin/import" element={admin(<Import />)} />
        <Route path="/admin/reports" element={admin(<Reports />)} />
        <Route path="/admin/users" element={admin(<Users />)} />
        <Route path="/staff/events" element={anyone(<Events />)} />
        <Route path="/staff/events/:eventId" element={anyone(<EventDetail />)} />
        <Route path="/participants" element={admin(<Participants />)} />
        <Route path="*" element={<Home />} />
      </Route>
    </Routes>
  )
}
