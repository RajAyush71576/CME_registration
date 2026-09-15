import { useState } from 'react'
import { api } from '../api'

const emptyForm = {
  event_name: '',
  event_date: '',
  start_time: '09:00',
  venue: '',
  organizing_doctors: '',
  department: '',
  cme_credits: '',
  approx_duration_hours: '',
}

const inputClass =
  'w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 dark:border-green-600 dark:bg-[#2a3743] dark:text-white dark:placeholder-slate-500 dark:focus:border-green-400'
const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-slate-400'

export default function CreateEventModal({ onClose, onCreated }) {
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await api.createEvent({
        ...form,
        organizing_doctors: form.organizing_doctors
          .split(',')
          .map((d) => d.trim())
          .filter(Boolean),
        approx_duration_hours: Number(form.approx_duration_hours),
        cme_credits: Number(form.cme_credits) || 0,
      })
      onCreated()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-slate-700/60 dark:bg-[#232f3b]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between border-b border-gray-200 pb-4 dark:border-slate-700/60">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">New Event</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClass}>Event name</label>
            <input
              name="event_name"
              value={form.event_name}
              onChange={handleChange}
              required
              autoFocus
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Date</label>
            <input
              type="date"
              name="event_date"
              value={form.event_date}
              onChange={handleChange}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Start time</label>
            <input
              type="time"
              name="start_time"
              value={form.start_time}
              onChange={handleChange}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Venue</label>
            <input
              name="venue"
              value={form.venue}
              onChange={handleChange}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Department</label>
            <input
              name="department"
              value={form.department}
              onChange={handleChange}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Approx. duration (hours)</label>
            <input
              type="number"
              step="0.5"
              name="approx_duration_hours"
              value={form.approx_duration_hours}
              onChange={handleChange}
              required
              className={inputClass}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Organizing doctors</label>
            <input
              name="organizing_doctors"
              value={form.organizing_doctors}
              onChange={handleChange}
              placeholder="Comma-separated, up to 3"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>CME credits</label>
            <input
              type="number"
              step="0.5"
              min="0"
              name="cme_credits"
              value={form.cme_credits}
              onChange={handleChange}
              placeholder="0"
              className={`${inputClass} w-24`}
            />
          </div>
          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-green-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
