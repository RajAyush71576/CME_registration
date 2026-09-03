import { useEffect, useState } from 'react'
import { api } from '../api'

const emptyForm = {
  name: '',
  designation: '',
  email: '',
  phone: '',
  whatsapp_number: '',
  place_of_work: '',
  country: '',
  medical_license_no: '',
  participant_type: 'Delegate',
}

export default function ParticipantsPage() {
  const [participants, setParticipants] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = () =>
    api.listParticipants().then(setParticipants).catch((e) => setError(e.message))

  useEffect(() => {
    load()
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await api.createParticipant({
        ...form,
        country: form.country || null,
        medical_license_no: form.medical_license_no || null,
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
        <h1 className="mb-4 text-xl font-semibold">New Participant</h1>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Name"
            required
            className="rounded border px-3 py-2"
          />
          <input
            name="designation"
            value={form.designation}
            onChange={handleChange}
            placeholder="Designation / Specialty"
            required
            className="rounded border px-3 py-2"
          />
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="Email"
            required
            className="rounded border px-3 py-2"
          />
          <input
            name="phone"
            value={form.phone}
            onChange={handleChange}
            placeholder="Phone"
            required
            className="rounded border px-3 py-2"
          />
          <input
            name="whatsapp_number"
            value={form.whatsapp_number}
            onChange={handleChange}
            placeholder="WhatsApp number"
            required
            className="rounded border px-3 py-2"
          />
          <input
            name="place_of_work"
            value={form.place_of_work}
            onChange={handleChange}
            placeholder="Place of work"
            required
            className="rounded border px-3 py-2"
          />
          <input
            name="country"
            value={form.country}
            onChange={handleChange}
            placeholder="Country (international attendees)"
            className="rounded border px-3 py-2"
          />
          <input
            name="medical_license_no"
            value={form.medical_license_no}
            onChange={handleChange}
            placeholder="Medical license no. (required if CME credits apply)"
            className="rounded border px-3 py-2"
          />
          <select
            name="participant_type"
            value={form.participant_type}
            onChange={handleChange}
            className="rounded border px-3 py-2"
          >
            <option value="Delegate">Delegate</option>
            <option value="Faculty">Faculty</option>
          </select>
          {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="col-span-2 rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
          >
            {submitting ? 'Creating...' : 'Create Participant'}
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Participants</h2>
        <ul className="divide-y rounded border bg-white">
          {participants.map((p) => (
            <li key={p.participant_id} className="px-4 py-3">
              <div className="font-medium">
                {p.name} <span className="text-gray-500">({p.participant_type})</span>
              </div>
              <div className="text-sm text-gray-600">
                {p.designation} · {p.phone} · {p.email}
                {p.medical_license_no ? ` · Lic. ${p.medical_license_no}` : ''}
              </div>
            </li>
          ))}
          {participants.length === 0 && (
            <li className="px-4 py-3 text-sm text-gray-500">No participants yet.</li>
          )}
        </ul>
      </section>
    </div>
  )
}
