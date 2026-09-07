import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { api } from '../api'
import Badge from '../Badge'
import CreateEventModal from './CreateEventModal'

const PAGE_SIZE = 10

function formatDateBlock(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`)
  return {
    month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    day: d.toLocaleDateString('en-US', { day: '2-digit' }),
    year: d.getFullYear(),
    weekday: d.toLocaleDateString('en-US', { weekday: 'long' }),
  }
}

function StatChip({ icon, tone, count, label }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    purple: 'bg-purple-50 text-purple-600',
  }
  return (
    <div className="flex items-center gap-2">
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sm ${tones[tone]}`}>
        {icon}
      </span>
      <div className="leading-tight">
        <div className="font-semibold text-gray-900">{count}</div>
        <div className="text-xs text-gray-500">{label}</div>
      </div>
    </div>
  )
}

export default function EventsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [events, setEvents] = useState([])
  const [eventStats, setEventStats] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const navigate = useNavigate()

  const load = () => {
    setLoading(true)
    api
      .listEvents()
      .then(async (evs) => {
        setEvents(evs)
        const entries = await Promise.all(
          evs.map((ev) =>
            api
              .listEventRegistrations(ev.event_id)
              .then((regs) => [ev.event_id, regs])
              .catch(() => [ev.event_id, []]),
          ),
        )
        const stats = {}
        for (const [eventId, regs] of entries) {
          stats[eventId] = {
            participants: regs.length,
            signedIn: regs.filter((r) => r.attendance && !r.attendance.sign_out_time).length,
            completed: regs.filter((r) => r.attendance?.sign_out_time).length,
            certificates: regs.filter((r) => r.certificate).length,
          }
        }
        setEventStats(stats)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const handleCreated = () => {
    setShowCreate(false)
    load()
  }

  const detailPrefix = isAdmin ? '/admin/events' : '/staff/events'

  const filteredEvents = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return [...events]
      .filter((ev) => statusFilter === 'all' || ev.status === statusFilter)
      .filter(
        (ev) =>
          !needle ||
          [ev.event_name, ev.venue, ev.department].some((f) =>
            (f || '').toLowerCase().includes(needle),
          ),
      )
      .sort((a, b) => a.event_date.localeCompare(b.event_date))
  }, [events, query, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageStart = (currentPage - 1) * PAGE_SIZE
  const pageEvents = filteredEvents.slice(pageStart, pageStart + PAGE_SIZE)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900">
          All Events <span className="text-gray-400">({filteredEvents.length})</span>
        </h1>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
          >
            + Create Event
          </button>
        )}
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative sm:flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            🔍
          </span>
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(1)
            }}
            placeholder="Search events..."
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            ⚲
          </span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            className="w-full appearance-none rounded-lg border border-gray-300 py-2.5 pl-9 pr-8 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 sm:w-40"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : (
        <>
          <div className="space-y-3">
            {pageEvents.map((ev) => {
              const date = formatDateBlock(ev.event_date)
              const stats = eventStats[ev.event_id] || {
                participants: 0,
                signedIn: 0,
                completed: 0,
                certificates: 0,
              }
              return (
                <div
                  key={ev.event_id}
                  onClick={() => navigate(`${detailPrefix}/${ev.event_id}`)}
                  className="flex cursor-pointer flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:bg-gray-50 sm:flex-row sm:items-center sm:gap-5 sm:p-5"
                >
                  <div className="flex w-20 shrink-0 flex-col items-center rounded-lg bg-indigo-50 px-2 py-2 text-indigo-600">
                    <span className="text-xs font-semibold">{date.month}</span>
                    <span className="text-2xl font-bold leading-tight">{date.day}</span>
                    <span className="text-xs font-medium">{date.year}</span>
                    <span className="text-[10px] text-indigo-400">{date.weekday}</span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-gray-900">{ev.event_name}</span>
                      <Badge tone={ev.status === 'closed' ? 'gray' : 'green'}>
                        {ev.status === 'closed' ? 'Closed' : 'Active'}
                      </Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500">
                      <span>📅 {ev.event_date}</span>
                      <span>|</span>
                      <span>📍 {ev.venue}</span>
                      <span>|</span>
                      <span>🏷️ {ev.cme_credits ? 'CME credits' : 'No CME credits'}</span>
                      <span>|</span>
                      <span>🕐 {ev.approx_duration_hours}h</span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:gap-6">
                      <StatChip icon="👥" tone="blue" count={stats.participants} label="Participants" />
                      <StatChip icon="✅" tone="green" count={stats.signedIn} label="Signed In" />
                      <StatChip icon="⏱️" tone="orange" count={stats.completed} label="Completed" />
                      <StatChip icon="🎓" tone="purple" count={stats.certificates} label="Certificates" />
                    </div>
                  </div>

                  <div
                    className="flex shrink-0 items-center gap-2 self-start sm:self-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      aria-label="More options"
                    >
                      ⋯
                    </button>
                    <span
                      onClick={() => navigate(`${detailPrefix}/${ev.event_id}`)}
                      className="cursor-pointer text-xl text-gray-300"
                    >
                      ›
                    </span>
                  </div>
                </div>
              )
            })}
            {pageEvents.length === 0 && (
              <div className="rounded-xl border border-gray-200 bg-white px-5 py-10 text-center text-sm text-gray-500 shadow-sm">
                {query || statusFilter !== 'all' ? 'No events match your filters.' : 'No events yet.'}
              </div>
            )}
          </div>

          {filteredEvents.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
              <span>
                Showing {pageStart + 1} to {Math.min(pageStart + PAGE_SIZE, filteredEvents.length)}{' '}
                of {filteredEvents.length} events
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="rounded-md p-1.5 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Previous page"
                >
                  ‹
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    className={`h-7 w-7 rounded-md text-sm font-medium ${
                      p === currentPage
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-md p-1.5 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Next page"
                >
                  ›
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {showCreate && (
        <CreateEventModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}
    </div>
  )
}
