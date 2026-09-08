import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './AuthContext'
import Layout from './Layout'
import RequireAuth from './RequireAuth'
import RequireRole from './RequireRole'
import EventDetailPage from './pages/EventDetailPage'
import EventsPage from './pages/EventsPage'
import ImportPage from './pages/ImportPage'
import LoginPage from './pages/LoginPage'
import ParticipantsPage from './pages/ParticipantsPage'
import ReportsPage from './pages/ReportsPage'

function HomeRedirect() {
  const { user } = useAuth()
  return <Navigate to={user?.role === 'admin' ? '/admin/events' : '/staff/events'} replace />
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<HomeRedirect />} />
        <Route path="/participants" element={<ParticipantsPage />} />
        <Route
          path="/staff/events"
          element={
            <RequireRole roles={['admin', 'staff']}>
              <EventsPage />
            </RequireRole>
          }
        />
        <Route
          path="/staff/events/:eventId"
          element={
            <RequireRole roles={['admin', 'staff']}>
              <EventDetailPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/events"
          element={
            <RequireRole roles={['admin']}>
              <EventsPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/events/:eventId"
          element={
            <RequireRole roles={['admin']}>
              <EventDetailPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/import"
          element={
            <RequireRole roles={['admin']}>
              <ImportPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/reports"
          element={
            <RequireRole roles={['admin']}>
              <ReportsPage />
            </RequireRole>
          }
        />
      </Route>
    </Routes>
  )
}

export default App
