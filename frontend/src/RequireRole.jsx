import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

/** Must be nested inside a RequireAuth-protected route, so `user` is
 * guaranteed to be loaded by the time this renders. */
export default function RequireRole({ roles, children }) {
  const { user } = useAuth()
  if (!roles.includes(user?.role)) {
    const home = user?.role === 'admin' ? '/admin/events' : '/staff/events'
    return <Navigate to={home} replace />
  }
  return children
}
