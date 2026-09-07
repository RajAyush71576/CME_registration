import { useEffect, useState } from 'react'
import { api } from '../api'
import AttendanceCard from './AttendanceCard'

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-3 text-base shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100'
const labelClass = 'mb-1 block text-sm font-medium text-gray-700'
const primaryBtn =
  'rounded-lg bg-blue-600 px-5 py-3 text-base font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50'

export default function CheckInPage() {
  const [events, setEvents] = useState([])
  const [eventId, setEventId] = useState('')
  const [deviceId, setDeviceId] = useState('TAB-REG-01')

  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searchError, setSearchError] = useState('')
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    api.listEvents().then(setEvents).catch(() => {})
  }, [])

  const handleSearch = async (e) => {
    e.preventDefault()
    setSearchError('')
    setSearched(true)
    try {
      const data = await api.searchRegistrations(eventId, query)
      setResults(data)
    } catch (err) {
      setSearchError(err.message)
      setResults([])
    }
  }

  const refreshResults = async () => {
    try {
      const data = await api.searchRegistrations(eventId, query)
      setResults(data)
    } catch (err) {
      setSearchError(err.message)
    }
  }

  const selectedEvent = events.find((ev) => ev.event_id === eventId)

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h1 className="mb-4 text-xl font-semibold text-gray-900">Tablet Check-In</h1>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Event</label>
            <select
              value={eventId}
              onChange={(e) => {
                setEventId(e.target.value)
                setResults([])
                setSearched(false)
              }}
              className={inputClass}
            >
              <option value="">Select an event...</option>
              {events.map((ev) => (
                <option key={ev.event_id} value={ev.event_id} disabled={ev.status === 'closed'}>
                  {ev.event_name} ({ev.event_date}){ev.status === 'closed' ? ' — closed' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Device ID (this tablet)</label>
            <input
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
        {selectedEvent?.status === 'closed' && (
          <p className="mt-3 rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-600">
            This event is closed — sign-in and sign-out are no longer available.
          </p>
        )}
      </section>

      {eventId && (
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Search & Auto-Fill</h2>
          <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Registration ID, mobile, email, or name"
              required
              autoFocus
              className={`${inputClass} sm:flex-1`}
            />
            <button type="submit" className={primaryBtn}>
              Search
            </button>
          </form>
          {searchError && (
            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {searchError}
            </p>
          )}

          <ul className="mt-4 space-y-3">
            {results.map((r) => (
              <AttendanceCard
                key={r.registration_id}
                result={r}
                deviceId={deviceId}
                onUpdated={refreshResults}
              />
            ))}
            {searched && results.length === 0 && !searchError && (
              <li className="rounded-lg border border-dashed border-gray-300 py-6 text-center text-sm text-gray-500">
                No matching registration.
              </li>
            )}
          </ul>
        </section>
      )}
    </div>
  )
}
