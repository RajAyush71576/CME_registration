import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import Badge from '../components/Badge'
import CreateEventModal from '../components/CreateEventModal'
import { ErrorNote } from '../components/Modal'
import { useAutoRefresh, useLiveUpdates } from '../components/Refresh'
import { useAuth } from '../contexts/AuthContext'
import { credits, fmtDate, fmtDuration, nowIST, num, parseDate, plural } from '../utils'

const PAGE_SIZE = 10
const DATE_FILTERS = {
  all: 'All dates', today: 'Today', week: 'This week', month: 'This month', year: 'This year',
  upcoming: 'Upcoming', past: 'Past',
}

function matchesDate(filter, d) {
  if (filter === 'all') return true
  const date = parseDate(d)
  const today = parseDate(nowIST().date) // the venue's calendar day, whatever the device's time zone
  const day = 86400000
  switch (filter) {
    case 'today': return +date === +today
    case 'week': {
      const monday = new Date(today - ((today.getDay() + 6) % 7) * day)
      return date >= monday && date < new Date(+monday + 7 * day)
    }
    case 'month': return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth()
    case 'year': return date.getFullYear() === today.getFullYear()
    case 'upcoming': return date > today
    case 'past': return date < today
    default: return true
  }
}

// Small line icons (emoji render differently on every OS).
const ICONS = {
  calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  pin: 'M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  award: 'M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM8.5 14l-1.5 8 5-3 5 3-1.5-8',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  sparkle: 'M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z',
}
const Icon = ({ name, className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`} aria-hidden="true">
    <path d={ICONS[name]} />
  </svg>
)

function summarize(regs) {
  const s = { participants: regs.length, signedIn: 0, completed: 0, certificates: 0 }
  for (const r of regs) {
    if (r.attendance?.sign_out_time) s.completed++
    else if (r.attendance) s.signedIn++
    if (r.certificate) s.certificates++
  }
  return s
}

function DateBlock({ date, closed }) {
  const d = parseDate(date)
  return (
    <div className={`flex w-18 shrink-0 flex-col items-center overflow-hidden rounded-xl border text-center sm:w-20 ${closed
      ? 'border-gray-200 dark:border-white/10'
      : 'border-brand-200 dark:border-brand-500/30'}`}
    >
      <div className={`w-full py-1 text-[11px] font-bold tracking-wider text-white uppercase ${closed ? 'bg-gray-400 dark:bg-gray-600' : 'bg-brand-700'}`}>
        {d.toLocaleDateString('en-IN', { month: 'short' })}
      </div>
      <div className="pt-1 text-3xl leading-none font-extrabold">{d.getDate()}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{d.getFullYear()}</div>
      <div className="pb-1.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
        {d.toLocaleDateString('en-IN', { weekday: 'short' })}
      </div>
    </div>
  )
}

function Stat({ label, value, tone }) {
  const tones = {
    brand: 'text-brand-700 dark:text-brand-300',
    blue: 'text-sky-600 dark:text-sky-300',
    green: 'text-emerald-600 dark:text-emerald-300',
    amber: 'text-amber-600 dark:text-amber-300',
  }
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-white/5">
      <div className={`text-lg leading-tight font-bold ${tones[tone]}`}>{value ?? '–'}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
    </div>
  )
}

function EventCard({ event, stats, base }) {
  const closed = event.status === 'closed'
  const c = credits(event)
  return (
    <Link
      to={`${base}/${event.event_id}`}
      className="card group flex gap-4 p-4 transition-colors hover:border-brand-300 sm:p-5 dark:hover:border-brand-500/40"
    >
      <DateBlock date={event.event_date} closed={closed} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-bold group-hover:text-brand-700 dark:group-hover:text-brand-300">{event.event_name}</h3>
          <Badge tone={closed ? 'gray' : 'green'}>{closed ? 'Closed' : 'Active'}</Badge>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-300">
          <span className="inline-flex items-center gap-1.5"><Icon name="calendar" />{fmtDate(event.event_date)}</span>
          <span className="inline-flex items-center gap-1.5"><Icon name="pin" />{event.venue}</span>
          <span className="inline-flex items-center gap-1.5"><Icon name="award" />{c > 0 ? `${num(c)} CME credits` : 'No CME credits'}</span>
          <span className="inline-flex items-center gap-1.5"><Icon name="clock" />{fmtDuration(event.approx_duration_hours)}</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Participants" value={stats?.participants} tone="brand" />
          <Stat label="Signed in" value={stats?.signedIn} tone="blue" />
          <Stat label="Completed" value={stats?.completed} tone="green" />
          <Stat label="Certificates" value={stats?.certificates} tone="amber" />
        </div>
      </div>
    </Link>
  )
}

export default function Events() {
  const { user } = useAuth()
  const isAdmin = user.role === 'admin'
  const base = isAdmin ? '/admin/events' : '/staff/events'
  const [events, setEvents] = useState(null)
  const [stats, setStats] = useState({})
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [dateFilter, setDateFilter] = useState('today')
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)
  const [added, setAdded] = useState([]) // events that appeared since this screen first loaded
  const knownIds = useRef(null)
  const [justCreated, setJustCreated] = useState(false) // "Event created" confirmation for the admin who made it
  useEffect(() => {
    if (!justCreated) return
    const t = setTimeout(() => setJustCreated(false), 4000)
    return () => clearTimeout(t)
  }, [justCreated])

  const load = () => api.events().then((es) => {
    const ids = new Set(es.map((e) => e.event_id))
    const fresh = knownIds.current ? es.filter((e) => !knownIds.current.has(e.event_id)) : []
    // Drop events that were deleted since they were announced.
    setAdded((a) => [...fresh, ...a].filter((e) => ids.has(e.event_id)))
    knownIds.current = ids
    setEvents(es)
    setError('')
  }).catch((e) => setError(e.message))
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return (events || [])
      .filter((e) => status === 'all' || e.status === status)
      .filter((e) => matchesDate(dateFilter, e.event_date))
      .filter((e) => !term || [e.event_name, e.venue, e.department].some((v) => v.toLowerCase().includes(term)))
      .sort((a, b) => {
        // Active events first, closed ones last. Within each: most recently created first. Events from before
        // creation times were recorded (created_at null) come after those, by date ascending with today and
        // upcoming before past; same day → earlier start time, then A–Z. (ISO dates/times compare as strings.)
        const today = nowIST().date
        return (a.status === 'closed') - (b.status === 'closed') ||
          (b.created_at || '').localeCompare(a.created_at || '') ||
          (a.event_date < today) - (b.event_date < today) ||
          a.event_date.localeCompare(b.event_date) ||
          a.start_time.localeCompare(b.start_time) ||
          a.event_name.localeCompare(b.event_name)
      })
  }, [events, q, status, dateFilter])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pages)
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)

  const fetchStats = (list) => Promise.all(list.map((e) =>
    api.registrationsByEvent(e.event_id)
      .then((regs) => setStats((s) => ({ ...s, [e.event_id]: summarize(regs) })))
      .catch(() => {}),
  ))
  useEffect(() => { fetchStats(visible.filter((e) => !stats[e.event_id])) }, [visible.map((e) => e.event_id).join()])

  // New events and fresh counts from other tablets: the list, plus stats for the cards on screen.
  const refresh = () => Promise.all([load(), fetchStats(visible)])
  useAutoRefresh(refresh)
  useLiveUpdates(refresh)

  const resetPage = (setter) => (v) => { setter(v); setPage(1) }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">
          Events {events && <span className="text-gray-500 dark:text-gray-400">({filtered.length})</span>}
        </h1>
        {isAdmin && <button className="btn-primary" onClick={() => setCreating(true)}>+ New event</button>}
      </div>

      {justCreated && (
        <div role="status" className="animate-pop-in mb-4 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-100">
          <span aria-hidden="true">✓</span> Event created
        </div>
      )}

      {added.length > 0 && !justCreated && (
        <div role="status" className="animate-pop-in mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-brand-900 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-100">
          <Icon name="sparkle" className="h-5 w-5" />
          <span className="min-w-0 flex-1 text-sm">
            <b>{added.length > 1 ? `${added.length} new events created` : 'New event created'}</b>
          </span>
          <button className="btn-primary min-h-9 py-1" onClick={() => { setDateFilter('all'); setStatus('all'); setQ(''); setPage(1); setAdded([]) }}>
            Show
          </button>
          <button className="btn-ghost min-h-9 min-w-9 px-2" onClick={() => setAdded([])} aria-label="Dismiss">✕</button>
        </div>
      )}

      <div className="card mb-5 grid grid-cols-1 gap-3 p-3 sm:grid-cols-[1fr_auto_auto] sm:p-4">
        <input className="input" type="search" placeholder="Search by name, venue or department" value={q} onChange={(e) => resetPage(setQ)(e.target.value)} aria-label="Search events" />
        <select className="input" value={status} onChange={(e) => resetPage(setStatus)(e.target.value)} aria-label="Status">
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="closed">Closed</option>
        </select>
        <select className="input" value={dateFilter} onChange={(e) => resetPage(setDateFilter)(e.target.value)} aria-label="Date">
          {Object.entries(DATE_FILTERS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <ErrorNote>{error}</ErrorNote>
      {!events && !error && <p className="py-10 text-center text-gray-500 dark:text-gray-400">Loading events…</p>}
      {events && filtered.length === 0 && (
        <div className="card p-10 text-center">
          {events.length && dateFilter === 'today' && !q && status === 'all' ? (
            <>
              <p className="font-semibold">No events today.</p>
              <button className="btn-secondary mt-4" onClick={() => { setDateFilter('all'); setPage(1) }}>Show all events</button>
            </>
          ) : (
            <>
              <p className="font-semibold">{events.length ? 'No events match these filters.' : 'No events yet.'}</p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {events.length ? 'Clear the search or change the filters.' : isAdmin ? 'Create the first event to start taking registrations.' : 'Ask an admin to create an event.'}
              </p>
            </>
          )}
        </div>
      )}

      <div className="space-y-3">
        {visible.map((e) => <EventCard key={e.event_id} event={e} stats={stats[e.event_id]} base={base} />)}
      </div>

      {filtered.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500 dark:text-gray-400">
          <span>
            Showing {(current - 1) * PAGE_SIZE + 1} to {Math.min(current * PAGE_SIZE, filtered.length)} of {plural(filtered.length, 'event')}
          </span>
          {pages > 1 && (
            <nav className="flex flex-wrap gap-1" aria-label="Pagination">
              <button className="btn-secondary min-h-10 px-3" disabled={current === 1} onClick={() => setPage(current - 1)} aria-label="Previous page">‹</button>
              {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  aria-current={n === current ? 'page' : undefined}
                  className={n === current ? 'btn-primary min-h-10 min-w-10 px-3' : 'btn-secondary min-h-10 min-w-10 px-3'}
                >
                  {n}
                </button>
              ))}
              <button className="btn-secondary min-h-10 px-3" disabled={current === pages} onClick={() => setPage(current + 1)} aria-label="Next page">›</button>
            </nav>
          )}
        </div>
      )}

      {creating && <CreateEventModal onClose={() => setCreating(false)} onCreated={() => {
        // Clear the filters so the new event is on screen even if it isn't today.
        setCreating(false); setDateFilter('all'); setStatus('all'); setQ(''); setPage(1)
        load().then(() => { setAdded([]); setJustCreated(true) })
      }} />}
    </div>
  )
}
