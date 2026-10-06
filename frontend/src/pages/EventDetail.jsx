import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import Badge from '../components/Badge'
import CreateParticipantModal, { ParticipantTypeInput } from '../components/CreateParticipantModal'
import EventStaffCard from '../components/EventStaff'
import { pickFile, useImportFlow, XLSX_ACCEPT } from '../components/ImportFlow'
import { ErrorNote } from '../components/Modal'
import ParticipantDetailModal from '../components/ParticipantDetailModal'
import { useAutoRefresh, useLiveUpdates } from '../components/Refresh'
import CreateEventModal from '../components/CreateEventModal'
import { useAuth } from '../contexts/AuthContext'
import { attendanceStatus, byAttendanceThenName, credits, fmtClock, fmtDate, fmtDuration, fmtTime, num, ROLE_LABELS, SOURCE_LABELS } from '../utils'

// Columns that only fit on wide screens; portrait tablets get the rest without sideways scrolling.
const WIDE_ONLY = ['Source', 'Signatures taken by']

function Taker({ label, time, name, role }) {
  return (
    <div className="flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="w-7 text-[11px] font-semibold text-gray-500 uppercase dark:text-gray-400">{label}</span>
      <span className="text-xs text-gray-500 tabular-nums dark:text-gray-400">{fmtClock(time)}</span>
      {name ? (
        <span className="font-medium">
          {name}
          <span className={`ml-1.5 rounded px-1 py-px text-[10px] font-bold uppercase ${role === 'admin'
            ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200'
            : 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200'}`}>{ROLE_LABELS[role] || role}</span>
        </span>
      ) : (
        <span className="text-xs text-gray-500 italic dark:text-gray-400">not recorded</span>
      )}
    </div>
  )
}

// Who took the sign-in and sign-out signatures, with the time and their role.
function TakenBy({ attendance: a }) {
  if (!a) return <span className="text-gray-400">—</span>
  return (
    <div className="space-y-1">
      <Taker label="In" time={a.sign_in_time} name={a.signed_in_by_name} role={a.signed_in_by_role} />
      {a.sign_out_time && <Taker label="Out" time={a.sign_out_time} name={a.signed_out_by_name} role={a.signed_out_by_role} />}
    </div>
  )
}

export default function EventDetail() {
  const { eventId } = useParams()
  const { user } = useAuth()
  const isAdmin = user.role === 'admin'
  const [event, setEvent] = useState(null)
  const [regs, setRegs] = useState([])
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [designation, setDesignation] = useState('')
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')
  const [staffFilter, setStaffFilter] = useState('')
  const [openId, setOpenId] = useState(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(false)

  const loadRegs = useCallback(() => api.registrationsByEvent(eventId).then(setRegs), [eventId])
  const refresh = useCallback(
    () => Promise.all([api.event(eventId).then(setEvent), loadRegs()]).catch((e) => setError(e.message)),
    [eventId, loadRegs],
  )
  useEffect(() => { refresh() }, [refresh])
  // Sign-ins and walk-ins from other tablets appear without a reload.
  useAutoRefresh(refresh)
  // Changes to this event (or to participants, who can be in several events) refresh at once.
  useLiveUpdates((msg) => (!msg.event_id || msg.event_id === eventId) && refresh())
  // Admins can import a registration sheet straight into this event.
  const importFlow = useImportFlow(() => loadRegs().catch((e) => setError(e.message)))

  const staffNames = useMemo(() => [...new Set(regs.flatMap((r) =>
    [r.registered_by_name, r.attendance?.signed_in_by_name, r.attendance?.signed_out_by_name]).filter(Boolean))].sort(), [regs])

  const designations = useMemo(() => [...new Set(regs.map((r) => r.participant.designation))].sort(), [regs])
  const types = useMemo(() => [...new Set(regs.map((r) => r.participant.participant_type))].sort(), [regs])

  const filtered = useMemo(() => {
    const term = name.trim().toLowerCase()
    return regs
      .filter(({ participant: p }) => !term || [p.name, p.phone, p.whatsapp_number, p.email].some((v) => v?.toLowerCase().includes(term)))
      .filter((r) => !designation || r.participant.designation === designation)
      .filter((r) => !type || r.participant.participant_type === type)
      // 'absent' is just 'not signed in' once the event is closed.
      .filter((r) => !status || attendanceStatus(r, event).key.replace('absent', 'not_signed_in') === status)
      .filter((r) => !staffFilter ||
        [r.registered_by_name, r.attendance?.signed_in_by_name, r.attendance?.signed_out_by_name].includes(staffFilter))
      .sort(byAttendanceThenName(event))
  }, [regs, name, designation, type, status, staffFilter, event])

  const hasFilters = name || designation || type || status || staffFilter

  if (error && !event) return <ErrorNote>{error}</ErrorNote>
  if (!event) return <p className="py-10 text-center text-gray-500 dark:text-gray-400">Loading event…</p>

  const closed = event.status === 'closed'
  const c = credits(event)
  const attendanceStarted = regs.some((r) => r.attendance)
  const openReg = regs.find((r) => r.registration_id === openId)

  const closeEvent = async () => {
    if (!confirm(`Close "${event.event_name}"? Sign-in and sign-out will stop for everyone.`)) return
    try {
      setEvent(await api.closeEvent(event.event_id))
    } catch (e) {
      setError(e.message)
    }
  }

  const details = [
    ['Date', fmtDate(event.event_date)],
    ['Start time', fmtTime(event.start_time)],
    ['Venue', event.venue],
    ['Department', event.department],
    ['Organizing doctors', event.organizing_doctors.length ? event.organizing_doctors.join(', ') : '—'],
    ['CME credits', c > 0 ? num(c) : 'None'],
    ['Duration', Number(event.approx_duration_hours) ? `${fmtDuration(event.approx_duration_hours)} (approx.)` : 'No minimum — sign-out any time after sign-in'],
  ]

  return (
    <div className="space-y-5">
      <Link to={isAdmin ? '/admin/events' : '/staff/events'} className="btn-ghost -ml-3">← Back to events</Link>

      <div className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{event.event_name}</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge tone={closed ? 'gray' : 'green'}>{closed ? 'Closed' : 'Active'}</Badge>
              <Badge tone={c > 0 ? 'brand' : 'gray'}>{c > 0 ? `${num(c)} CME credits` : 'No CME credits'}</Badge>
            </div>
          </div>
          {isAdmin && !closed && (
            <div className="flex flex-wrap items-center gap-2">
              {attendanceStarted
                ? <span className="text-sm text-gray-500 dark:text-gray-400" title="Events can only be edited until the first participant signs in">🔒 Editing locked — sign-in has started</span>
                : <button className="btn-secondary" onClick={() => setEditing(true)}>Edit event</button>}
              <button className="btn-danger" onClick={closeEvent}>Close event</button>
            </div>
          )}
        </div>
        <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {details.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-gray-500 dark:text-gray-400">{k}</dt>
              <dd className="mt-0.5 font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}
      </div>

      <EventStaffCard regs={regs} />

      {importFlow.error && <ErrorNote>{importFlow.error}</ErrorNote>}
      {importFlow.resultCard}

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 p-4 dark:border-white/10">
          <h2 className="text-lg font-bold">
            Participants{' '}
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {hasFilters ? `(${filtered.length} of ${regs.length})` : `(${regs.length})`}
            </span>
          </h2>
          {!closed && (
            <div className="ml-auto flex w-full flex-wrap items-center gap-2 sm:w-auto">
              {isAdmin && (
                <>
                  <ParticipantTypeInput
                    id="default-participant-type-list"
                    className="input w-36 shrink-0 sm:w-40"
                    value={importFlow.defaultType}
                    onChange={importFlow.setDefaultType}
                    placeholder="Default type for import"
                  />
                  <label className={`btn-secondary flex-1 cursor-pointer sm:flex-none ${importFlow.busy ? 'pointer-events-none opacity-60' : ''}`}>
                    <input type="file" accept={XLSX_ACCEPT} className="sr-only" disabled={importFlow.busy || importFlow.reviewing}
                      onChange={pickFile((file) => importFlow.start(event, file))} />
                    <span aria-hidden="true">⬆</span> {importFlow.busy ? 'Reading file…' : 'Import participants'}
                  </label>
                </>
              )}
              <button className="btn-primary flex-1 sm:flex-none" onClick={() => setCreating(true)}>+ New participant</button>
            </div>
          )}
        </div>

        {regs.length > 0 && (
          <div className="grid grid-cols-1 gap-3 border-b border-gray-100 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(11rem,1fr)_auto_auto_auto_auto_auto] dark:border-white/10">
            <input className="input" type="search" placeholder="Search name, phone or email" value={name} onChange={(e) => setName(e.target.value)} aria-label="Search by name, phone or email" />
            <select className="input" value={designation} onChange={(e) => setDesignation(e.target.value)} aria-label="Filter by designation">
              <option value="">All designations</option>
              {designations.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select className="input" value={type} onChange={(e) => setType(e.target.value)} aria-label="Filter by participant type">
              <option value="">All types</option>
              {types.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by attendance">
              <option value="">Any status</option>
              <option value="not_signed_in">{closed ? 'Absent' : 'Not signed in'}</option>
              <option value="signed_in">Signed in</option>
              <option value="completed">Completed</option>
            </select>
            {staffNames.length > 0 && (
              <select className="input" value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)} aria-label="Filter by staff">
                <option value="">Any staff</option>
                {staffNames.map((n) => <option key={n} value={n}>Taken by {n}</option>)}
              </select>
            )}
            <button className="btn-secondary" onClick={() => { setName(''); setDesignation(''); setType(''); setStatus(''); setStaffFilter('') }} disabled={!hasFilters}>Clear</button>
          </div>
        )}

        {regs.length === 0 ? (
          <p className="p-10 text-center text-sm text-gray-500 dark:text-gray-400">
            No one is registered yet. Add walk-in participants with + New participant{isAdmin ? ', or bring in a registration sheet with Import participants' : ''}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-gray-50 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:bg-white/5 dark:text-gray-400">
                <tr>
                  {['Name', 'Designation', 'Contact', 'Type', 'Source', 'Attendance', 'Signatures taken by', 'Certificate'].map((h) => (
                    <th key={h} className={`px-4 py-3 ${WIDE_ONLY.includes(h) ? 'hidden lg:table-cell' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {filtered.map((r) => {
                  const s = attendanceStatus(r, event)
                  return (
                    <tr
                      key={r.registration_id}
                      onClick={() => setOpenId(r.registration_id)}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter' && e.key !== ' ') return
                        e.preventDefault()
                        setOpenId(r.registration_id)
                      }}
                      role="button"
                      aria-label={`Open ${r.participant.name}`}
                      tabIndex={0}
                      className="cursor-pointer hover:bg-brand-50/60 focus:bg-brand-50/60 dark:hover:bg-white/5 dark:focus:bg-white/5"
                    >
                      <td className="px-4 py-3 font-semibold">{r.participant.name}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{r.participant.designation}</td>
                      <td className="px-4 py-3">
                        <div>{r.participant.phone}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{r.participant.email}</div>
                      </td>
                      <td className="px-4 py-3">{r.participant.participant_type}</td>
                      <td className="hidden px-4 py-3 text-gray-600 lg:table-cell dark:text-gray-300">{SOURCE_LABELS[r.source] || r.source}</td>
                      <td className="px-4 py-3">
                        <Badge tone={s.tone}>{s.label}</Badge>
                      </td>
                      <td className="hidden px-4 py-3 lg:table-cell"><TakenBy attendance={r.attendance} /></td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{r.certificate ? `No. ${r.certificate.certificate_no}` : '—'}</td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="p-8 text-center text-gray-500 dark:text-gray-400">No participants match these filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {openReg && (
        <ParticipantDetailModal reg={openReg} event={event} onClose={() => setOpenId(null)} onChanged={loadRegs} />
      )}
      {creating && (
        <CreateParticipantModal
          event={event}
          onClose={() => setCreating(false)}
          onCreated={(_, opts) => { loadRegs().catch((e) => setError(e.message)); if (!opts?.keepOpen) setCreating(false) }}
        />
      )}
      {importFlow.modal}
      {editing && (
        <CreateEventModal event={event} onClose={() => setEditing(false)} onCreated={(saved) => { setEvent(saved); setEditing(false) }} />
      )}
    </div>
  )
}
