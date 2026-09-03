import { useEffect, useState } from 'react'
import { api } from '../api'

const emptyForm = {
  event_name: '',
  event_date: '',
  venue: '',
  organizing_doctors: '',
  department: '',
  cme_credits: false,
  approx_duration_hours: '',
}

export default function EventsPage() {
  const [events, setEvents] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = () => api.listEvents().then(setEvents).catch((e) => setError(e.message))

  useEffect(() => {
    load()
  }, [])

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
      })
      setForm(emptyForm)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <h1 className="mb-4 text-xl font-semibold">New Event</h1>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
          <input
            name="event_name"
            value={form.event_name}
            onChange={handleChange}
            placeholder="Event name"
            required
            className="rounded border px-3 py-2"
          />
          <input
            type="date"
            name="event_date"
            value={form.event_date}
            onChange={handleChange}
            required
            className="rounded border px-3 py-2"
          />
          <input
            name="venue"
            value={form.venue}
            onChange={handleChange}
            placeholder="Venue"
            required
            className="rounded border px-3 py-2"
          />
          <input
            name="department"
            value={form.department}
            onChange={handleChange}
            placeholder="Department"
            required
            className="rounded border px-3 py-2"
          />
          <input
            name="organizing_doctors"
            value={form.organizing_doctors}
            onChange={handleChange}
            placeholder="Organizing doctors (comma-separated, up to 3)"
            className="col-span-2 rounded border px-3 py-2"
          />
          <input
            type="number"
            step="0.5"
            name="approx_duration_hours"
            value={form.approx_duration_hours}
            onChange={handleChange}
            placeholder="Approx. duration (hours)"
            required
            className="rounded border px-3 py-2"
          />
          <label className="flex items-center gap-2 px-3 py-2 text-sm">
            <input
              type="checkbox"
              name="cme_credits"
              checked={form.cme_credits}
              onChange={handleChange}
            />
            CME credits
          </label>
          {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="col-span-2 rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
          >
            {submitting ? 'Creating...' : 'Create Event'}
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Events</h2>
        <ul className="divide-y rounded border bg-white">
          {events.map((ev) => (
            <li key={ev.event_id} className="px-4 py-3">
              <div className="font-medium">{ev.event_name}</div>
              <div className="text-sm text-gray-600">
                {ev.event_date} · {ev.venue} · {ev.department} ·{' '}
                {ev.cme_credits ? 'CME credits' : 'No CME credits'} ·{' '}
                {ev.approx_duration_hours}h
              </div>
            </li>
          ))}
          {events.length === 0 && (
            <li className="px-4 py-3 text-sm text-gray-500">No events yet.</li>
          )}
        </ul>
      </section>
    </div>
  )
}
