import { useState } from 'react'
import { api } from '../api'
import { nowIST } from '../utils'
import Modal, { ErrorNote, Field } from './Modal'
import TimeSelect from './TimeSelect'

// Event dates follow the venue's calendar (IST), not the device's time zone.
const isoDate = (offsetDays) =>
  new Date(Date.parse(`${nowIST().date}T00:00:00Z`) + offsetDays * 86400000).toISOString().slice(0, 10)
const DURATION_PRESETS = [[0, 30], [1, 0], [1, 30], [2, 0], [3, 0], [4, 0], [6, 0], [8, 0]]
const presetLabel = ([h, m]) => (h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`)
const MAX_HOURS = 72

const EMPTY = {
  event_name: '', event_date: '', start_time: '09:00', venue: '', department: '',
  duration_h: '', duration_m: '', doctors: ['', '', ''], cme_credits: '0', require_sign_out: true,
}

// Form values for an existing event (edit mode).
function fromEvent(ev) {
  const minutes = Math.round(Number(ev.approx_duration_hours) * 60)
  const doctors = [...ev.organizing_doctors, '', '', ''].slice(0, 3)
  return {
    event_name: ev.event_name, event_date: ev.event_date, start_time: ev.start_time.slice(0, 5), venue: ev.venue,
    department: ev.department, duration_h: String(Math.floor(minutes / 60)), duration_m: String(minutes % 60),
    doctors, cme_credits: String(Number(ev.cme_credits)), require_sign_out: ev.require_sign_out,
  }
}

// New event, or — with `event` — edit that event (only the changed fields are sent).
export default function CreateEventModal({ event, onClose, onCreated }) {
  const initial = event ? fromEvent(event) : EMPTY
  const [form, setForm] = useState(initial)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const today = isoDate(0)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const setChecked = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.checked }))
  const setDoctor = (i) => (e) => setForm((f) => ({ ...f, doctors: f.doctors.map((d, j) => (j === i ? e.target.value : d)) }))

  const submit = async (e) => {
    e.preventDefault()
    const hours = Number(form.duration_h || 0)
    const minutes = Number(form.duration_m || 0)
    if (minutes > 59) return setError('Minutes must be between 0 and 59.')
    if (hours + minutes / 60 > MAX_HOURS) return setError(`Duration can be at most ${MAX_HOURS} hours.`)
    if (form.event_date < today && form.event_date !== initial.event_date) return setError('The event date can’t be in the past.')
    const { duration_h, duration_m, doctors, ...rest } = form
    const payload = {
      ...rest,
      organizing_doctors: doctors.map((d) => d.trim()).filter(Boolean),
      approx_duration_hours: Number((hours + minutes / 60).toFixed(4)),
      cme_credits: Number(form.cme_credits || 0),
    }
    let changes = payload
    if (event) {
      const before = { ...event, start_time: event.start_time.slice(0, 5),
        approx_duration_hours: Number(event.approx_duration_hours), cme_credits: Number(event.cme_credits) }
      changes = Object.fromEntries(Object.entries(payload).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(before[k])))
      if (!Object.keys(changes).length) return onClose()
    }
    setError('')
    setBusy(true)
    try {
      const saved = event ? await api.updateEvent(event.event_id, changes) : await api.createEvent(payload)
      onCreated(saved)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Modal
      title={event ? 'Edit event' : 'New event'}
      subtitle={event ? 'You can edit the event until the first participant signs in.' : undefined}
      onClose={onClose}
      dirty={JSON.stringify(form) !== JSON.stringify(initial)}
      footer={<>
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button form="create-event" className="btn-primary" disabled={busy}>{busy ? (event ? 'Saving…' : 'Creating…') : (event ? 'Save changes' : 'Create event')}</button>
      </>}
    >
      <form id="create-event" onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Event name" className="sm:col-span-2">
          <input className="input" required maxLength={255} value={form.event_name} onChange={set('event_name')} />
        </Field>
        <Field label="Date" required>
          <input className="input" type="date" required min={initial.event_date && initial.event_date < today ? initial.event_date : today} value={form.event_date} onChange={set('event_date')} />
          <span className="mt-2 flex gap-2">
            <button type="button" className="btn-secondary min-h-11 px-3 py-1" onClick={() => setForm((f) => ({ ...f, event_date: isoDate(0) }))}>Today</button>
            <button type="button" className="btn-secondary min-h-11 px-3 py-1" onClick={() => setForm((f) => ({ ...f, event_date: isoDate(1) }))}>Tomorrow</button>
          </span>
        </Field>
        <div>
          <span className="label" id="start-time-label">Start time</span>
          <div role="group" aria-labelledby="start-time-label">
            <TimeSelect value={form.start_time} onChange={(v) => setForm((f) => ({ ...f, start_time: v }))} />
          </div>
        </div>
        <Field label="Venue">
          <input className="input" required maxLength={255} value={form.venue} onChange={set('venue')} />
        </Field>
        <Field label="Department">
          <input className="input" required maxLength={200} value={form.department} onChange={set('department')} />
        </Field>
        <fieldset className="sm:col-span-2">
          <legend className="label">
            Approx. duration (minimum time before sign-out)<span className="ml-0.5 text-red-500" aria-hidden="true">*</span>
          </legend>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2">
              <input className="input w-20" type="number" required min="0" max={MAX_HOURS} step="1" inputMode="numeric"
                value={form.duration_h} onChange={set('duration_h')} aria-label="Hours" placeholder="0" />
              <span className="text-sm text-gray-600 dark:text-gray-300">h</span>
            </label>
            <label className="flex items-center gap-2">
              <input className="input w-20" type="number" min="0" max="59" step="1" inputMode="numeric"
                value={form.duration_m} onChange={set('duration_m')} aria-label="Minutes" placeholder="0" />
              <span className="text-sm text-gray-600 dark:text-gray-300">min</span>
            </label>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {DURATION_PRESETS.map(([h, m]) => {
              const active = Number(form.duration_h || 0) === h && Number(form.duration_m || 0) === m && form.duration_h !== ''
              return (
                <button
                  key={`${h}:${m}`}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setForm((f) => ({ ...f, duration_h: String(h), duration_m: String(m) }))}
                  className={`btn min-h-11 px-3 py-1 ${active
                    ? 'bg-brand-700 text-white'
                    : 'border-2 border-gray-200 bg-white text-gray-700 hover:border-brand-300 dark:border-white/10 dark:bg-night-input dark:text-gray-200'}`}
                >
                  {presetLabel([h, m])}
                </button>
              )
            })}
          </div>
          <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">Enter 0 h 0 min if participants may sign out any time after signing in.</p>
        </fieldset>
        <fieldset className="sm:col-span-2">
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-0.5 h-4 w-4" checked={form.require_sign_out} onChange={setChecked('require_sign_out')} />
            <span>
              <span className="label mb-0">Require sign-out</span>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {form.require_sign_out
                  ? 'Checked: participants must sign in and then sign out to be marked present.'
                  : 'Unchecked: there’s no sign-out step — signing in alone marks a participant present.'}
              </p>
            </span>
          </label>
        </fieldset>
        <Field label="CME credits">
          <input className="input" type="number" min="0" max="9999.99" step="0.5" value={form.cme_credits} onChange={set('cme_credits')} />
        </Field>
        <fieldset className="sm:col-span-2">
          <legend className="label">Organizing doctors (up to 3)</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {form.doctors.map((d, i) => (
              <input key={i} className="input" maxLength={200} aria-label={`Organizing doctor ${i + 1}`}
                placeholder={['Dr. A. Menon', 'Dr. R. Iyer', 'Dr. S. Rao'][i]} value={d} onChange={setDoctor(i)} />
            ))}
          </div>
        </fieldset>
        <div className="sm:col-span-2"><ErrorNote>{error}</ErrorNote></div>
      </form>
    </Modal>
  )
}
