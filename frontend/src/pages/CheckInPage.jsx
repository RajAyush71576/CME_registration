import { useEffect, useState } from 'react'
import { api } from '../api'
import AttendanceCard from './AttendanceCard'

export default function CheckInPage() {
  const [events, setEvents] = useState([])
  const [participants, setParticipants] = useState([])
  const [eventId, setEventId] = useState('')
  const [participantId, setParticipantId] = useState('')
  const [registerError, setRegisterError] = useState('')
  const [registerMessage, setRegisterMessage] = useState('')
  const [deviceId, setDeviceId] = useState('TAB-REG-01')

  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searchError, setSearchError] = useState('')
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    api.listEvents().then(setEvents).catch(() => {})
    api.listParticipants().then(setParticipants).catch(() => {})
  }, [])

  const handleRegister = async (e) => {
    e.preventDefault()
    setRegisterError('')
    setRegisterMessage('')
    try {
      await api.createRegistration({ participant_id: participantId, event_id: eventId })
      setRegisterMessage('Registered for event.')
      setParticipantId('')
    } catch (err) {
      setRegisterError(err.message)
    }
  }

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

  return (
    <div className="space-y-8">
      <section>
        <h1 className="mb-4 text-xl font-semibold">Tablet Check-In</h1>
        <label className="block text-sm font-medium text-gray-700">Event</label>
        <select
          value={eventId}
          onChange={(e) => {
            setEventId(e.target.value)
            setResults([])
            setSearched(false)
          }}
          className="mt-1 w-full rounded border px-3 py-2"
        >
          <option value="">Select an event...</option>
          {events.map((ev) => (
            <option key={ev.event_id} value={ev.event_id}>
              {ev.event_name} ({ev.event_date})
            </option>
          ))}
        </select>

        <label className="mt-3 block text-sm font-medium text-gray-700">
          Device ID (this tablet)
        </label>
        <input
          value={deviceId}
          onChange={(e) => setDeviceId(e.target.value)}
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </section>

      {eventId && (
        <>
          <section className="rounded border bg-white p-4">
            <h2 className="mb-3 text-lg font-semibold">Register participant for this event</h2>
            <form onSubmit={handleRegister} className="flex gap-3">
              <select
                value={participantId}
                onChange={(e) => setParticipantId(e.target.value)}
                required
                className="flex-1 rounded border px-3 py-2"
              >
                <option value="">Select a participant...</option>
                {participants.map((p) => (
                  <option key={p.participant_id} value={p.participant_id}>
                    {p.name} · {p.phone}
                  </option>
                ))}
              </select>
              <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-white">
                Register
              </button>
            </form>
            {registerMessage && (
              <p className="mt-2 text-sm text-green-600">{registerMessage}</p>
            )}
            {registerError && <p className="mt-2 text-sm text-red-600">{registerError}</p>}
          </section>

          <section className="rounded border bg-white p-4">
            <h2 className="mb-3 text-lg font-semibold">Search & Auto-Fill</h2>
            <form onSubmit={handleSearch} className="flex gap-3">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Registration ID, mobile, email, or name"
                required
                className="flex-1 rounded border px-3 py-2"
              />
              <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-white">
                Search
              </button>
            </form>
            {searchError && <p className="mt-2 text-sm text-red-600">{searchError}</p>}

            <ul className="mt-4 divide-y">
              {results.map((r) => (
                <AttendanceCard
                  key={r.registration_id}
                  result={r}
                  deviceId={deviceId}
                  onUpdated={refreshResults}
                />
              ))}
              {searched && results.length === 0 && !searchError && (
                <li className="py-3 text-sm text-gray-500">No matching registration.</li>
              )}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}
