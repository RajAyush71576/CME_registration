import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './Layout'
import RequireAuth from './RequireAuth'
import CheckInPage from './pages/CheckInPage'
import EventsPage from './pages/EventsPage'
import ImportPage from './pages/ImportPage'
import LoginPage from './pages/LoginPage'
import ParticipantsPage from './pages/ParticipantsPage'
import ReportsPage from './pages/ReportsPage'

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
        <Route index element={<Navigate to="/events" replace />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/participants" element={<ParticipantsPage />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/check-in" element={<CheckInPage />} />
        <Route path="/reports" element={<ReportsPage />} />
      </Route>
    </Routes>
  )
}

export default App
