import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import CreateParticipantModal from './CreateParticipantModal'

export default function ParticipantsPage() {
  const [participants, setParticipants] = useState([])
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  const load = () =>
    api
      .listParticipants()
      .then(setParticipants)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))

  useEffect(() => {
    load()
  }, [])

  const handleCreated = () => {
    setShowCreate(false)
    load()
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return participants
    return participants.filter((p) =>
      [p.name, p.email, p.phone, p.whatsapp_number, p.designation, p.place_of_work]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(needle)),
    )
  }, [participants, query])

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900">Participants</h1>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
        >
          + Create Participant
        </button>
      </div>

      <div className="relative mb-4">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          🔍
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, phone, email, or designation"
          className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
      </div>

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {filtered.map((p) => (
            <li key={p.participant_id} className="px-4 py-3.5 sm:px-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-gray-900">{p.name}</span>
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                  {p.participant_type}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-sm text-gray-500">
                <span>{p.designation}</span>
                <span>·</span>
                <span>{p.phone}</span>
                <span>·</span>
                <span>{p.email}</span>
                {p.medical_license_no && (
                  <>
                    <span>·</span>
                    <span>Lic. {p.medical_license_no}</span>
                  </>
                )}
              </div>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-5 py-10 text-center text-sm text-gray-500">
              {query ? 'No participants match your search.' : 'No participants yet.'}
            </li>
          )}
        </ul>
      )}

      {showCreate && (
        <CreateParticipantModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}
    </div>
  )
}
