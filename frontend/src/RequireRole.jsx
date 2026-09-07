import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

/** Must be nested inside a RequireAuth-protected route, so `user` is
 * guaranteed to be loaded by the time this renders. */
export default function RequireRole({ roles, children }) {
  const { user } = useAuth()
  if (!roles.includes(user?.role)) {
    return <Navigate to="/unauthorized" replace />
  }
  return children
}
