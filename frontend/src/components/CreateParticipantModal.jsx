import { useState } from 'react'
import { api } from '../api'
import { COUNTRIES, DEFAULT_COUNTRY, DEFAULT_DIAL, dialFor } from '../countries'
import Modal, { ErrorNote, Field } from './Modal'
import { EMAIL_HINT, EMAIL_PATTERN, isEmail } from '../utils'

export const EMPTY_PARTICIPANT = {
  name: '', designation: '', email: '', phone: '', whatsapp_number: '', place_of_work: '',
  country: DEFAULT_COUNTRY, medical_license_no: '', participant_type: 'Delegate',
}

// Known codes, longest first, so "+919876543210" splits as +91 / 9876543210 rather than +9198 / 76543210.
const DIALS = [...new Set(COUNTRIES.map((c) => c.dial))].sort((a, b) => b.length - a.length)

// Stored as "+91 9876543210". Older numbers have no code; treat those as Indian.
export const splitPhone = (v) => {
  const s = (v || '').trimStart()
  if (!s.startsWith('+')) return [DEFAULT_DIAL, s]
  const dial = DIALS.find((d) => s.startsWith(d)) || s.match(/^\+\d{0,4}/)[0]
  return [dial, s.slice(dial.length).trimStart()]
}
// Inner spaces are kept so "98765 43210" can be typed; the backend trims the ends.
export const joinPhone = (dial, number) => (number.trim() ? `${dial} ${number.trimStart()}` : '')

const isoFor = (dial, country) =>
  (COUNTRIES.find((c) => c.name === country && c.dial === dial) || COUNTRIES.find((c) => c.dial === dial))?.iso

function PhoneInput({ value, onChange, country, label, ...props }) {
  const [dial, number] = splitPhone(value)
  // Several countries share a code (+1, +7…): remember which one was picked, else prefer the participant's country.
  const [picked, setPicked] = useState(null)
  const iso = picked && COUNTRIES.find((c) => c.iso === picked)?.dial === dial ? picked : isoFor(dial, country)
  const pickCode = (e) => {
    setPicked(e.target.value)
    onChange(joinPhone(COUNTRIES.find((c) => c.iso === e.target.value).dial, number))
  }
  // A pasted "+44 7700 900123" sets the code instead of ending up inside the number.
  const typeNumber = (e) => {
    const v = e.target.value
    if (v.trimStart().startsWith('+')) {
      const [d, n] = splitPhone(v)
      if (isoFor(d, country)) {
        setPicked(isoFor(d, country))
        return onChange(joinPhone(d, n))
      }
    }
    onChange(joinPhone(dial, v))
  }
  return (
    <span className="flex gap-2">
      <select className="input w-32 shrink-0" value={iso} disabled={props.disabled} aria-label={`${label} country code`} onChange={pickCode}>
        {COUNTRIES.map((c) => <option key={c.iso} value={c.iso}>{c.dial} {c.name}</option>)}
      </select>
      <input className="input min-w-0" type="tel" inputMode="tel" autoComplete="off" maxLength={20} aria-label={label}
        pattern="[0-9(][0-9 ()\-]{5,19}" title="Digits only, 6–20 characters (spaces, dashes and brackets allowed)"
        value={number} onChange={typeNumber} {...props} />
    </span>
  )
}

const isCountry = (v) => COUNTRIES.find((c) => c.name.toLowerCase() === (v || '').trim().toLowerCase())

// Shared by the create modal and the inline edit form in the detail modal.
export function ParticipantFields({ form, setForm, licenseRequired }) {
  const [sameAsPhone, setSameAsPhone] = useState(() => !!form.phone && form.phone === form.whatsapp_number)
  const [emailTouched, setEmailTouched] = useState(false)
  const setValue = (k) => (v) =>
    setForm((f) => ({ ...f, [k]: v, ...(k === 'phone' && sameAsPhone ? { whatsapp_number: v } : {}) }))
  const set = (k) => (e) => setValue(k)(e.target.value)
  // Picking a country (an exact list match) switches both phone codes to match; numbers are kept.
  const setCountry = (e) => {
    const match = isCountry(e.target.value)
    const country = match ? match.name : e.target.value
    const dial = match && dialFor(match.name)
    setForm((f) => ({
      ...f, country,
      ...(dial ? { phone: joinPhone(dial, splitPhone(f.phone)[1]), whatsapp_number: joinPhone(dial, splitPhone(f.whatsapp_number)[1]) } : {}),
    }))
  }
  const countryValid = !form.country?.trim() || !!isCountry(form.country)
  const toggleSame = (e) => {
    setSameAsPhone(e.target.checked)
    if (e.target.checked) setForm((f) => ({ ...f, whatsapp_number: f.phone }))
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Full name"><input className="input" required maxLength={200} autoComplete="off" value={form.name} onChange={set('name')} /></Field>
      <Field label="Designation"><input className="input" required maxLength={200} autoComplete="off" value={form.designation} onChange={set('designation')} /></Field>
      <Field label="Email" required>
        <input className="input" type="email" required maxLength={255} autoComplete="off" pattern={EMAIL_PATTERN} title={EMAIL_HINT} placeholder="name@gmail.com"
          value={form.email} onChange={set('email')} onBlur={() => setEmailTouched(true)} />
        {emailTouched && form.email && !isEmail(form.email) && <span className="mt-1 block text-xs text-red-600 dark:text-red-400">{EMAIL_HINT}</span>}
      </Field>
      <Field label="Phone" required><PhoneInput label="Phone number" required value={form.phone} onChange={setValue('phone')} country={form.country} /></Field>
      <div>
        <Field label="WhatsApp number" required>
          <PhoneInput label="WhatsApp number" required disabled={sameAsPhone} value={form.whatsapp_number} onChange={setValue('whatsapp_number')} country={form.country} />
        </Field>
        <label className="mt-1 inline-flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-gray-600 dark:text-gray-300">
          <input type="checkbox" className="h-5 w-5 accent-brand-700" checked={sameAsPhone} onChange={toggleSame} />
          Same as phone
        </label>
      </div>
      <Field label="Place of work"><input className="input" required maxLength={255} autoComplete="off" value={form.place_of_work} onChange={set('place_of_work')} /></Field>
      <Field label="Country">
        <input className="input" list="country-list" placeholder="Type to search" maxLength={100} autoComplete="off"
          ref={(el) => el?.setCustomValidity(countryValid ? '' : 'Pick a country from the list')}
          value={form.country || ''} onChange={setCountry} />
        <datalist id="country-list">{COUNTRIES.map((c) => <option key={c.iso} value={c.name} />)}</datalist>
        {!countryValid && <span className="mt-1 block text-xs text-red-600 dark:text-red-400">Pick a country from the list</span>}
      </Field>
      <Field label="Medical license no.">
        <input className="input" required={licenseRequired} maxLength={100} autoComplete="off" value={form.medical_license_no || ''} onChange={set('medical_license_no')} />
        <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
          {licenseRequired ? 'Required: this event awards CME credits' : 'Needed for events that award CME credits'}
        </span>
      </Field>
      <Field label="Participant type">
        <select className="input" value={form.participant_type} onChange={set('participant_type')}>
          <option value="Delegate">Delegate</option>
          <option value="Faculty">Faculty</option>
        </select>
      </Field>
    </div>
  )
}

export default function CreateParticipantModal({ event, onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY_PARTICIPANT)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // Set once the participant exists but registering them failed: the button then only retries the registration.
  const [created, setCreated] = useState(null)
  const licenseRequired = Number(event?.cme_credits || 0) > 0
  const dirty = !created && JSON.stringify(form) !== JSON.stringify(EMPTY_PARTICIPANT)

  const register = async (participant) => {
    try {
      await api.register(participant.participant_id, event.event_id, 'on_spot')
    } catch (err) {
      setCreated(participant)
      setError(`${participant.existing ? 'This email already belongs to a participant' : 'Participant created'}, but couldn't register them for this event: ${err.message}`)
      setBusy(false)
      return onCreated(participant, { keepOpen: true })
    }
    onCreated(participant)
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    if (created) return register(created)
    let participant
    try {
      // An email that already exists comes back as that participant (existing: true); we register them as-is.
      participant = await api.createParticipant(form)
    } catch (err) {
      setError(err.message)
      return setBusy(false)
    }
    if (event) return register(participant)
    onCreated(participant)
  }

  return (
    <Modal
      title="New participant"
      subtitle={event ? `On-spot registration for ${event.event_name}` : undefined}
      onClose={onClose}
      dirty={dirty}
      footer={<>
        <button type="button" className="btn-secondary" onClick={onClose}>{created ? 'Close' : 'Cancel'}</button>
        <button form="create-participant" className="btn-primary" disabled={busy}>
          {busy ? 'Saving…' : created ? 'Retry registration' : event ? 'Create and register' : 'Create participant'}
        </button>
      </>}
    >
      <form id="create-participant" onSubmit={submit} className="space-y-4">
        <fieldset disabled={!!created} className="contents">
          <ParticipantFields form={form} setForm={setForm} licenseRequired={licenseRequired} />
        </fieldset>
        <ErrorNote>{error}</ErrorNote>
      </form>
    </Modal>
  )
}
