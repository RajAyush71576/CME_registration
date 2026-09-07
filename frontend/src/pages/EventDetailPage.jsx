import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { api } from '../api'
import Badge from '../Badge'
import CreateParticipantModal from './CreateParticipantModal'

function attendanceStatus(attendance, eventStatus) {
  if (!attendance) return eventStatus === 'closed' ? 'Absent' : 'Not signed in'
  if (attendance.sign_out_time) return 'Completed'
  return 'Signed in'
}

function statusTone(status) {
  if (status === 'Completed') return 'green'
  if (status === 'Signed in') return 'blue'
  if (status === 'Absent') return 'red'
  return 'gray'
}

export default function EventDetailPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const eventsPath = isAdmin ? '/admin/events' : '/staff/events'
  const { eventId } = useParams()
  const [event, setEvent] = useState(null)
  const [registrations, setRegistrations] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [closing, setClosing] = useState(false)
  const [closeError, setCloseError] = useState('')

  const loadRegistrations = () =>
    api.listEventRegistrations(eventId).then(setRegistrations).catch((e) => setError(e.message))

  const handleCloseEvent = async () => {
    if (!window.confirm('Close this event? Sign-in/sign-out will no longer be possible.')) {
      return
    }
    setCloseError('')
    setClosing(true)
    try {
      const updated = await api.closeEvent(eventId)
      setEvent(updated)
    } catch (err) {
      setCloseError(err.message)
    } finally {
      setClosing(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    setError('')
    Promise.all([api.getEvent(eventId), api.listEventRegistrations(eventId)])
      .then(([ev, regs]) => {
        setEvent(ev)
        setRegistrations(regs)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [eventId])

  const handleCreated = () => {
    setShowCreate(false)
    loadRegistrations()
  }

  if (loading) return <p className="text-sm text-gray-500">Loading...</p>
  if (error)
    return <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
  if (!event) return null

  return (
    <div className="space-y-6">
      <Link
        to={eventsPath}
        className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
      >
        ← Back to Events
      </Link>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold text-gray-900">
            {event.event_name}
            <Badge tone={event.status === 'closed' ? 'gray' : 'green'}>
              {event.status === 'closed' ? 'Closed' : 'Active'}
            </Badge>
            {event.cme_credits && <Badge tone="blue">CME credits</Badge>}
          </h1>
          {isAdmin && event.status !== 'closed' && (
            <button
              type="button"
              onClick={handleCloseEvent}
              disabled={closing}
              className="rounded-lg border border-red-300 px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {closing ? 'Closing...' : 'Close Event'}
            </button>
          )}
        </div>
        {closeError && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {closeError}
          </p>
        )}
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-gray-500">Date</dt>
            <dd className="mt-0.5 font-medium text-gray-900">{event.event_date}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Venue</dt>
            <dd className="mt-0.5 font-medium text-gray-900">{event.venue}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Department</dt>
            <dd className="mt-0.5 font-medium text-gray-900">{event.department}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Organizing Doctors</dt>
            <dd className="mt-0.5 font-medium text-gray-900">
              {event.organizing_doctors.join(', ') || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">CME Credits</dt>
            <dd className="mt-0.5 font-medium text-gray-900">
              {event.cme_credits ? 'Yes' : 'No'}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Approx. Duration</dt>
            <dd className="mt-0.5 font-medium text-gray-900">{event.approx_duration_hours}h</dd>
          </div>
        </dl>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">
            Participants <span className="text-gray-400">({registrations.length})</span>
          </h2>
          {!isAdmin && event.status !== 'closed' && (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
            >
              + New Participant
            </button>
          )}
        </div>
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Designation</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Attendance</th>
                <th className="px-4 py-3">Certificate</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {registrations.map((r) => {
                const status = attendanceStatus(r.attendance, event.status)
                return (
                  <tr key={r.registration_id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">
                      {r.participant.name}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.participant.designation}</td>
                    <td className="px-4 py-3 text-gray-600">
                      <div>{r.participant.phone}</div>
                      <div>{r.participant.email}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                      {r.participant.participant_type}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">{r.source}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Badge tone={statusTone(status)}>{status}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                      {r.certificate ? `No. ${r.certificate.certificate_no}` : '—'}
                    </td>
                  </tr>
                )
              })}
              {registrations.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                    No participants registered for this event yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showCreate && (
        <CreateParticipantModal
          eventId={eventId}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  )
}
