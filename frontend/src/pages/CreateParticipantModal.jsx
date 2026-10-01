import { useState } from 'react'
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

const inputClass =
  'w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 dark:border-green-600 dark:bg-[#2a3743] dark:text-white dark:placeholder-slate-500 dark:focus:border-green-400'
const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-slate-400'

export default function CreateParticipantModal({ onClose, onCreated, eventId }) {
  const [form, setForm] = useState(emptyForm)
  const [sameAsPhone, setSameAsPhone] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((f) => ({
      ...f,
      [name]: value,
      ...(name === 'phone' && sameAsPhone ? { whatsapp_number: value } : {}),
    }))
  }

  const handleSameAsPhoneChange = (e) => {
    const checked = e.target.checked
    setSameAsPhone(checked)
    if (checked) setForm((f) => ({ ...f, whatsapp_number: f.phone }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const participant = await api.createParticipant({
        ...form,
        country: form.country || null,
        medical_license_no: form.medical_license_no || null,
      })
      if (eventId) {
        try {
          await api.createRegistration({
            participant_id: participant.participant_id,
            event_id: eventId,
          })
        } catch (regErr) {
          setError(
            `Participant created, but couldn't register them for this event: ${regErr.message}`,
          )
          return
        }
      }
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
        className="max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-slate-700/60 dark:bg-[#232f3b]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between border-b border-gray-200 pb-4 dark:border-slate-700/60">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">New Participant</h2>
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
            <label className={labelClass}>Name</label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              autoFocus
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Designation / Specialty</label>
            <input
              name="designation"
              value={form.designation}
              onChange={handleChange}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Participant type</label>
            <select
              name="participant_type"
              value={form.participant_type}
              onChange={handleChange}
              className={inputClass}
            >
              <option value="Delegate">Delegate</option>
              <option value="Faculty">Faculty</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Phone</label>
            <input
              name="phone"
              value={form.phone}
              onChange={handleChange}
              required
              className={inputClass}
            />
          </div>
          <div>
            <div className="mb-1 flex flex-nowrap items-center justify-between gap-2">
              <label className={`${labelClass} mb-0 whitespace-nowrap`}>WhatsApp number</label>
              <label className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs font-medium text-gray-600 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={sameAsPhone}
                  onChange={handleSameAsPhoneChange}
                  className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500 dark:border-slate-500 dark:bg-[#2a3743]"
                />
                Same as phone
              </label>
            </div>
            <input
              name="whatsapp_number"
              value={form.whatsapp_number}
              onChange={handleChange}
              required
              disabled={sameAsPhone}
              className={`${inputClass} ${sameAsPhone ? 'border-gray-200 bg-gray-100 text-gray-500 dark:border-slate-600 dark:bg-slate-700/40 dark:text-slate-400' : ''}`}
            />
          </div>
          <div>
            <label className={labelClass}>Place of work</label>
            <input
              name="place_of_work"
              value={form.place_of_work}
              onChange={handleChange}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Country</label>
            <input
              name="country"
              value={form.country}
              onChange={handleChange}
              placeholder="International attendees"
              className={inputClass}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Medical license no.</label>
            <input
              name="medical_license_no"
              value={form.medical_license_no}
              onChange={handleChange}
              placeholder="Required if the event has CME credits"
              className={inputClass}
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
              {submitting
                ? 'Creating...'
                : eventId
                  ? 'Create & Register for Event'
                  : 'Create Participant'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
