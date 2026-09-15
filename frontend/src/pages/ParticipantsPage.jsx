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
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Participants</h1>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="rounded-md bg-green-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-green-500"
        >
          + Create Participant
        </button>
      </div>

      <div className="relative mb-4">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500">
          🔍
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, phone, email, or designation"
          className="w-full rounded-md border-2 border-gray-300 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 dark:border-green-600 dark:bg-[#2a3743] dark:text-white dark:placeholder-slate-500 dark:focus:border-green-400"
        />
      </div>

      {error && (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-slate-400">Loading...</p>
      ) : (
        <ul className="divide-y divide-gray-200 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:divide-slate-700/60 dark:border-slate-700/60 dark:bg-[#232f3b]">
          {filtered.map((p) => (
            <li key={p.participant_id} className="px-4 py-3.5 sm:px-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-gray-900 dark:text-white">{p.name}</span>
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-white/5 dark:text-slate-300">
                  {p.participant_type}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-sm text-gray-500 dark:text-slate-400">
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
            <li className="px-5 py-10 text-center text-sm text-gray-500 dark:text-slate-400">
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
