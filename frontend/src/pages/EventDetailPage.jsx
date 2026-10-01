import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { api } from '../api'
import Badge from '../Badge'
import CreateParticipantModal from './CreateParticipantModal'
import ParticipantDetailModal from './ParticipantDetailModal'

function attendanceStatus(attendance, eventStatus) {
  if (!attendance) return eventStatus === 'closed' ? 'Absent' : 'Not signed in'
  if (attendance.sign_out_time) return 'Completed'
  return 'Signed in'
}

function formatTimeDisplay(timeStr) {
  if (!timeStr) return '—'
  const [h, m] = timeStr.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
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
  const [editingStartTime, setEditingStartTime] = useState(false)
  const [startTimeValue, setStartTimeValue] = useState('')
  const [savingStartTime, setSavingStartTime] = useState(false)
  const [startTimeError, setStartTimeError] = useState('')
  const [selectedRegistrationId, setSelectedRegistrationId] = useState(null)
  const [query, setQuery] = useState('')

  const loadRegistrations = () =>
    api.listEventRegistrations(eventId).then(setRegistrations).catch((e) => setError(e.message))

  const handleEditStartTime = () => {
    setStartTimeValue(event.start_time?.slice(0, 5) || '09:00')
    setStartTimeError('')
    setEditingStartTime(true)
  }

  const handleSaveStartTime = async (e) => {
    e.preventDefault()
    setStartTimeError('')
    setSavingStartTime(true)
    try {
      const updated = await api.updateEvent(eventId, { start_time: startTimeValue })
      setEvent(updated)
      setEditingStartTime(false)
    } catch (err) {
      setStartTimeError(err.message)
    } finally {
      setSavingStartTime(false)
    }
  }

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

  const selectedRegistration = registrations.find(
    (r) => r.registration_id === selectedRegistrationId,
  )

  const filteredRegistrations = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return registrations
    return registrations.filter((r) =>
      [
        r.participant.name,
        r.participant.designation,
        r.participant.phone,
        r.participant.email,
        r.participant.participant_type,
      ]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(needle)),
    )
  }, [registrations, query])

  if (loading) return <p className="text-sm text-gray-500 dark:text-slate-400">Loading...</p>
  if (error)
    return <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">{error}</p>
  if (!event) return null

  return (
    <div className="space-y-6">
      <Link
        to={eventsPath}
        className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
      >
        ← Back to Events
      </Link>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-700/60 dark:bg-[#232f3b]">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold text-gray-900 dark:text-white">
            {event.event_name}
            <Badge tone={event.status === 'closed' ? 'gray' : 'green'}>
              {event.status === 'closed' ? 'Closed' : 'Active'}
            </Badge>
            {event.cme_credits > 0 && <Badge tone="blue">{event.cme_credits} CME credits</Badge>}
          </h1>
          {isAdmin && event.status !== 'closed' && (
            <button
              type="button"
              onClick={handleCloseEvent}
              disabled={closing}
              className="rounded-md border border-red-300 px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {closing ? 'Closing...' : 'Close Event'}
            </button>
          )}
        </div>
        {closeError && (
          <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {closeError}
          </p>
        )}
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-gray-500 dark:text-slate-500">Date</dt>
            <dd className="mt-0.5 font-medium text-gray-900 dark:text-slate-200">{event.event_date}</dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-slate-500">Start Time</dt>
            {editingStartTime ? (
              <form onSubmit={handleSaveStartTime} className="mt-1 flex items-center gap-2">
                <input
                  type="time"
                  value={startTimeValue}
                  onChange={(e) => setStartTimeValue(e.target.value)}
                  required
                  autoFocus
                  className="rounded-md border-2 border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 dark:border-green-600 dark:bg-[#2a3743] dark:text-white dark:focus:border-green-400"
                />
                <button
                  type="submit"
                  disabled={savingStartTime}
                  className="rounded-md bg-green-600 px-2.5 py-1 text-xs font-medium text-white shadow-sm transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingStartTime ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingStartTime(false)}
                  className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <dd className="mt-0.5 flex items-center gap-2 font-medium text-gray-900 dark:text-slate-200">
                {formatTimeDisplay(event.start_time)}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={handleEditStartTime}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Edit
                  </button>
                )}
              </dd>
            )}
            {startTimeError && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{startTimeError}</p>
            )}
          </div>
          <div>
            <dt className="text-gray-500 dark:text-slate-500">Venue</dt>
            <dd className="mt-0.5 font-medium text-gray-900 dark:text-slate-200">{event.venue}</dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-slate-500">Department</dt>
            <dd className="mt-0.5 font-medium text-gray-900 dark:text-slate-200">{event.department}</dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-slate-500">Organizing Doctors</dt>
            <dd className="mt-0.5 font-medium text-gray-900 dark:text-slate-200">
              {event.organizing_doctors.join(', ') || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-slate-500">CME Credits</dt>
            <dd className="mt-0.5 font-medium text-gray-900 dark:text-slate-200">
              {event.cme_credits > 0 ? event.cme_credits : 'None'}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-slate-500">Approx. Duration</dt>
            <dd className="mt-0.5 font-medium text-gray-900 dark:text-slate-200">{event.approx_duration_hours}h</dd>
          </div>
        </dl>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Participants{' '}
              <span className="text-gray-400 dark:text-slate-500">
                ({query ? `${filteredRegistrations.length} of ${registrations.length}` : registrations.length})
              </span>
            </h2>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search participants"
              className="w-48 rounded-md border-2 border-gray-300 bg-white py-1.5 px-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 dark:border-green-600 dark:bg-[#2a3743] dark:text-white dark:placeholder-slate-500 dark:focus:border-green-400"
            />
          </div>
          {!isAdmin && event.status !== 'closed' && (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="rounded-md bg-green-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-green-500"
            >
              + New Participant
            </button>
          )}
        </div>
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-slate-700/60 dark:bg-[#232f3b]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:border-slate-700/60 dark:bg-white/5 dark:text-slate-400">
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
            <tbody className="divide-y divide-gray-200 dark:divide-slate-700/60">
              {filteredRegistrations.map((r) => {
                const status = attendanceStatus(r.attendance, event.status)
                return (
                  <tr
                    key={r.registration_id}
                    onClick={() => setSelectedRegistrationId(r.registration_id)}
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {r.participant.name}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-slate-400">{r.participant.designation}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-slate-400">
                      <div>{r.participant.phone}</div>
                      <div>{r.participant.email}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600 dark:text-slate-400">
                      {r.participant.participant_type}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600 dark:text-slate-400">{r.source}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Badge tone={statusTone(status)}>{status}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600 dark:text-slate-400">
                      {r.certificate ? `No. ${r.certificate.certificate_no}` : '—'}
                    </td>
                  </tr>
                )
              })}
              {filteredRegistrations.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-500 dark:text-slate-500">
                    {registrations.length === 0
                      ? 'No participants registered for this event yet.'
                      : 'No participants match your search.'}
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

      {selectedRegistration && (
        <ParticipantDetailModal
          registration={selectedRegistration}
          eventStatus={event.status}
          eventDate={event.event_date}
          eventStartTime={event.start_time}
          approxDurationHours={event.approx_duration_hours}
          onClose={() => setSelectedRegistrationId(null)}
          onUpdated={loadRegistrations}
        />
      )}
    </div>
  )
}
