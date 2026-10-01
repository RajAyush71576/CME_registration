import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import CreateParticipantModal from '../components/CreateParticipantModal'
import { ErrorNote } from '../components/Modal'
import { SOURCE_LABELS, fmtDate, istDay } from '../utils'

// Chip colour = how this person's attendance stands at that event.
const ATTENDANCE = {
  completed: ['Completed', 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-200'],
  signed_in: ['Signed in', 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-400/25 dark:bg-sky-500/10 dark:text-sky-200'],
  absent: ['Absent', 'border-red-200 bg-red-50 text-red-800 dark:border-red-400/25 dark:bg-red-500/10 dark:text-red-200'],
  not_signed_in: ['Not signed in', 'border-gray-200 bg-white text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-gray-200'],
}

function EventChips({ events }) {
  if (!events.length) return <span className="text-xs text-gray-400">Not registered for any event</span>
  return (
    <div className="flex min-w-[17rem] max-w-[28rem] flex-wrap gap-1.5">
      {events.map((e) => {
        const [label, cls] = ATTENDANCE[e.attendance]
        return (
          <Link
            key={e.event_id}
            to={`/admin/events/${e.event_id}`}
            title={`${e.event_name} · ${fmtDate(e.event_date)} · ${label}`}
            className={`inline-flex max-w-full items-baseline gap-1.5 rounded-lg border px-2 py-1 text-xs font-medium whitespace-nowrap hover:underline ${cls}`}
          >
            <span className="max-w-[12rem] truncate">{e.event_name}</span>
            <span className="font-normal opacity-70">{fmtDate(e.event_date)}</span>
          </Link>
        )
      })}
    </div>
  )
}

export default function Participants() {
  const [list, setList] = useState(null)
  const [name, setName] = useState('')
  const [designation, setDesignation] = useState('')
  const [date, setDate] = useState('')
  const [eventId, setEventId] = useState('')
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

  const load = () => api.participants().then(setList).catch((e) => setError(e.message))
  useEffect(() => { load() }, [])

  const designations = useMemo(() => [...new Set((list || []).map((p) => p.designation))].sort(), [list])
  const eventOptions = useMemo(() => {
    const byId = new Map()
    for (const p of list || []) for (const e of p.events) byId.set(e.event_id, e)
    return [...byId.values()].sort((a, b) => a.event_date.localeCompare(b.event_date) || a.event_name.localeCompare(b.event_name))
  }, [list])

  const filtered = useMemo(() => {
    const term = name.trim().toLowerCase()
    return (list || [])
      .filter((p) => !term || [p.name, p.phone, p.whatsapp_number, p.email].some((v) => v?.toLowerCase().includes(term)))
      .filter((p) => !designation || p.designation === designation)
      .filter((p) => !date || istDay(p.created_at) === date)
      .filter((p) => !eventId || (eventId === 'none' ? !p.events.length : p.events.some((e) => e.event_id === eventId)))
  }, [list, name, designation, date, eventId])

  const hasFilters = name || designation || date || eventId

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Participants {list && <span className="text-gray-500 dark:text-gray-400">({filtered.length})</span>}</h1>
        <button className="btn-primary" onClick={() => setCreating(true)}>+ New participant</button>
      </div>
      <div className="card grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-[minmax(12rem,1fr)_auto_minmax(0,16rem)_auto_auto]">
        <input className="input" type="search" placeholder="Search name, phone or email" value={name} onChange={(e) => setName(e.target.value)} aria-label="Search by name, phone or email" />
        <select className="input" value={designation} onChange={(e) => setDesignation(e.target.value)} aria-label="Filter by designation">
          <option value="">All designations</option>
          {designations.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className="input" value={eventId} onChange={(e) => setEventId(e.target.value)} aria-label="Filter by event">
          <option value="">All events</option>
          {eventOptions.map((e) => <option key={e.event_id} value={e.event_id}>{e.event_name} — {fmtDate(e.event_date)}</option>)}
          <option value="none">Not registered for any event</option>
        </select>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Filter by date added" />
        <button className="btn-secondary" onClick={() => { setName(''); setDesignation(''); setDate(''); setEventId('') }} disabled={!hasFilters}>Clear</button>
      </div>
      <ErrorNote>{error}</ErrorNote>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-500 dark:text-gray-400">
        <span>Event colours show attendance:</span>
        {Object.values(ATTENDANCE).map(([label, cls]) => (
          <span key={label} className={`rounded-md border px-1.5 py-0.5 font-medium ${cls}`}>{label}</span>
        ))}
        <span>· Click an event to open it.</span>
      </p>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead className="bg-gray-50 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:bg-white/5 dark:text-gray-400">
            <tr>{['Name', 'Designation', 'Contact', 'Place of work', 'Type', 'Events registered', 'Source', 'Added'].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {filtered.map((p) => (
              <tr key={p.participant_id}>
                <td className="px-4 py-3 font-semibold">{p.name}</td>
                <td className="px-4 py-3">{p.designation}</td>
                <td className="px-4 py-3"><div>{p.phone}</div><div className="text-xs text-gray-500 dark:text-gray-400">{p.email}</div></td>
                <td className="px-4 py-3">{p.place_of_work}</td>
                <td className="px-4 py-3">{p.participant_type}</td>
                <td className="px-4 py-3"><EventChips events={p.events} /></td>
                <td className="px-4 py-3">{SOURCE_LABELS[p.source] || p.source}</td>
                <td className="px-4 py-3 whitespace-nowrap">{fmtDate(istDay(p.created_at))}</td>
              </tr>
            ))}
            {list && filtered.length === 0 && (
              <tr><td colSpan={8} className="p-8 text-center text-gray-500 dark:text-gray-400">{list.length ? 'No participants match these filters.' : 'No participants yet.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {creating && <CreateParticipantModal onClose={() => setCreating(false)} onCreated={() => { setCreating(false); load() }} />}
    </div>
  )
}
