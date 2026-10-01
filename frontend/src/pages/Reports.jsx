import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api'
import Badge from '../components/Badge'
import Modal, { ErrorNote, Field } from '../components/Modal'
import { useAutoRefresh, useLiveUpdates } from '../components/Refresh'
import { fmtClock, fmtDate, fmtTime, plural } from '../utils'

// The sheet says "Completed"/"Signed in"/…; older servers sent PRESENT/SIGNED IN/… — accept both.
const STATUS_LABELS = { PRESENT: 'Completed', 'SIGNED IN': 'Signed in', ABSENT: 'Absent', 'NOT SIGNED IN': 'Not signed in' }
const STATUS_TONES = { Completed: 'green', 'Signed in': 'blue', Absent: 'red', 'Not signed in': 'gray' }
const statusLabel = (s) => STATUS_LABELS[s] || s

function Signature({ src, alt }) {
  if (!src) return null
  // White chip so dark ink stays readable in dark mode.
  return <img src={src} alt={alt} className="h-12 max-w-36 rounded-md bg-white object-contain p-1 ring-1 ring-gray-200 dark:ring-white/10" />
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

// Report times are IST wall-clock "2026-10-01 10:58" (or ISO). → "1 Oct 2026, 10:58 AM" / "10:58 AM".
const WALL = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/
const isIso = (s) => /[zZ]|[+-]\d{2}:?\d{2}$/.test(s)
const fmtStamp = (s) => {
  if (!s) return ''
  if (isIso(s)) return `${fmtDate(new Date(s).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }))}, ${fmtClock(s)}`
  const m = s.match(WALL)
  return m ? `${fmtDate(m[1])}, ${fmtTime(m[2])}` : s
}
const fmtStampTime = (s) => {
  if (!s) return ''
  if (isIso(s)) return fmtClock(s)
  const m = s.match(WALL)
  return m ? fmtTime(m[2]) : s
}

function SignaturePanel({ label, time, by, sig }) {
  return (
    <figure className="flex flex-col">
      <figcaption className="mb-2 flex items-baseline justify-between gap-2">
        <span className="font-bold">{label}</span>
        {time && <span className="text-sm text-gray-500 tabular-nums dark:text-gray-400">{fmtStamp(time)}</span>}
      </figcaption>
      <div className="flex h-56 items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-white p-4 dark:border-white/15">
        {sig
          ? <img src={sig} alt={`${label} signature`} className="block max-h-full max-w-full object-contain" />
          : <span className="text-sm text-gray-500">{time ? 'Signature image missing' : `Not ${label.toLowerCase()} yet`}</span>}
      </div>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
        {!time ? '\u00a0' : by ? <>Taken by <b>{by}</b></> : <span className="text-gray-500 italic dark:text-gray-400">Taker not recorded</span>}
      </p>
    </figure>
  )
}

// Medium pop-up to check both signatures side by side.
function SignatureViewer({ row, col, onClose }) {
  const event = row[col['Event Name']]
  return (
    <Modal
      size="max-w-3xl"
      title={row[col['Participant Name']]}
      subtitle={[row[col.Designation], event && `${event} · ${fmtDate(row[col['Event Date']])}`].filter(Boolean).join(' — ')}
      onClose={onClose}
      footer={<button className="btn-secondary" onClick={onClose}>Close</button>}
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <SignaturePanel label="Signed in" time={row[col['Sign-in Time']]} by={row[col['Signed In By']]} sig={row[col['Sign-in Signature']]} />
        <SignaturePanel label="Signed out" time={row[col['Sign-out Time']]} by={row[col['Signed Out By']]} sig={row[col['Sign-out Signature']]} />
      </div>
    </Modal>
  )
}

// One sign-in or sign-out: when, who took it (with role), and the signature.
function SignCell({ time, by, sig, label }) {
  if (!time) return <span className="text-gray-400">—</span>
  return (
    <div className="flex items-center gap-3">
      <Signature src={sig} alt={`${label} signature`} />
      <div className="text-xs leading-5 whitespace-nowrap">
        <div className="font-medium text-gray-900 tabular-nums dark:text-gray-100">{fmtStampTime(time)}</div>
        {by
          ? <div className="text-gray-600 dark:text-gray-300">by <span className="font-semibold">{by}</span></div>
          : <div className="text-gray-500 italic dark:text-gray-400">taker not recorded</div>}
      </div>
    </div>
  )
}

function ReportPreview({ eventId }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [updatedAt, setUpdatedAt] = useState(null)
  const [viewing, setViewing] = useState(null) // row whose signatures are open

  const seq = useRef(0) // only the newest request may update the table (fast event switching)
  const inFlight = useRef(null)

  const load = useCallback(() => {
    if (inFlight.current?.eventId === eventId) return inFlight.current.promise // focus + visibilitychange fire together
    const mine = ++seq.current
    setLoading(true)
    setError('')
    const promise = api.attendanceReportRows(eventId)
      .then((d) => { if (mine === seq.current) { setData(d); setUpdatedAt(new Date()) } })
      .catch((e) => { if (mine === seq.current) setError(e.message) })
      .finally(() => {
        if (mine === seq.current) setLoading(false)
        if (inFlight.current?.promise === promise) inFlight.current = null
      })
    inFlight.current = { eventId, promise }
    return promise
  }, [eventId])

  useEffect(() => { setData(null); load() }, [load])
  // Sign-ins happen on other tablets: refresh on changes, and when this tab is looked at again.
  useAutoRefresh(load)
  useLiveUpdates((msg) => (!eventId || !msg.event_id || msg.event_id === eventId) && load())

  if (error && !data) return <ErrorNote>{error}</ErrorNote>
  if (!data) return <p className="py-10 text-center text-gray-500 dark:text-gray-400">{loading ? 'Loading report…' : ''}</p>

  const col = Object.fromEntries(data.columns.map((c, i) => [c, i]))
  const headers = ['Participant', ...(eventId ? [] : ['Event']), 'Status', 'Sign-in', 'Sign-out', 'View']

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-4 dark:border-white/10">
        <div>
          <h2 className="text-lg font-bold">Report preview <span className="text-sm font-medium text-gray-500 dark:text-gray-400">({plural(data.rows.length, 'row')})</span></h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Same rows as the Excel sheet{updatedAt && `, as of ${fmtClock(updatedAt)}`}.
          </p>
        </div>
      </div>
      <ErrorNote>{error}</ErrorNote>
      {data.rows.length === 0 ? (
        <p className="p-10 text-center text-sm text-gray-500 dark:text-gray-400">No registrations to report yet.</p>
      ) : (
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-gray-50 text-xs font-semibold tracking-wide whitespace-nowrap text-gray-500 uppercase dark:bg-night-input dark:text-gray-400">
              <tr>{headers.map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {data.rows.map((row, r) => {
                const status = statusLabel(row[col['Attendance Status']])
                return (
                  <tr key={r} className="align-middle">
                    <td className="px-4 py-3">
                      <div className="font-semibold">{row[col['Participant Name']]}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{row[col.Designation]}</div>
                    </td>
                    {!eventId && (
                      <td className="px-4 py-3">
                        <div>{row[col['Event Name']]}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{fmtDate(row[col['Event Date']])}</div>
                      </td>
                    )}
                    <td className="px-4 py-3"><Badge tone={STATUS_TONES[status] || 'gray'}>{status}</Badge></td>
                    <td className="px-4 py-3">
                      <SignCell label="Sign-in" time={row[col['Sign-in Time']]} by={row[col['Signed In By']]} sig={row[col['Sign-in Signature']]} />
                    </td>
                    <td className="px-4 py-3">
                      <SignCell label="Sign-out" time={row[col['Sign-out Time']]} by={row[col['Signed Out By']]} sig={row[col['Sign-out Signature']]} />
                    </td>
                    <td className="px-4 py-3">
                      {row[col['Sign-in Time']] ? (
                        <button
                          className="btn-ghost min-h-10 min-w-10 px-2 text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/15"
                          onClick={() => setViewing(row)}
                          aria-label={`View signatures of ${row[col['Participant Name']]}`}
                          title="View signatures"
                        >
                          <EyeIcon />
                        </button>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {viewing && <SignatureViewer row={viewing} col={col} onClose={() => setViewing(null)} />}
    </div>
  )
}

export default function Reports() {
  const [events, setEvents] = useState([])
  const [eventId, setEventId] = useState('')
  const [busy, setBusy] = useState({})
  const [error, setError] = useState('')
  const inFlight = useRef({})

  useEffect(() => { api.events().then(setEvents).catch((e) => setError(e.message)) }, [])

  // Refs guard against double taps before React re-renders the disabled state.
  const guarded = (key, fn) => async () => {
    if (inFlight.current[key]) return
    inFlight.current[key] = true
    setBusy((b) => ({ ...b, [key]: true }))
    setError('')
    try { await fn() } catch (e) { setError(e.message) } finally {
      inFlight.current[key] = false
      setBusy((b) => ({ ...b, [key]: false }))
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Reports</h1>

      <div className="card p-5 sm:p-6">
        <Field label="Event" className="max-w-md">
          <select className="input" value={eventId} onChange={(e) => setEventId(e.target.value)}>
            <option value="">All events</option>
            {events.map((e) => <option key={e.event_id} value={e.event_id}>{e.event_name} — {fmtDate(e.event_date)}</option>)}
          </select>
        </Field>
      </div>

      <ErrorNote>{error}</ErrorNote>

      <div className="card flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
        <div className="max-w-2xl">
          <h2 className="text-lg font-bold">Attendance report</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            Excel sheet with every participant's status, sign-in and sign-out times, CME credits earned and both signatures.
            {eventId ? '' : ' Covers all events.'}
          </p>
        </div>
        <button className="btn-primary" disabled={busy.report} onClick={guarded('report', () => api.downloadAttendanceReport(eventId))}>
          {busy.report ? 'Preparing…' : 'Download attendance report'}
        </button>
      </div>

      <ReportPreview eventId={eventId} />
    </div>
  )
}
