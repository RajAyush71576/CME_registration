import { Fragment, useMemo, useState } from 'react'
import Modal, { ErrorNote } from './Modal'
import { EMAIL_HINT, isEmail, plural } from '../utils'

const COLUMNS = [
  ['name', 'Name'], ['designation', 'Designation'], ['email', 'Email'], ['phone', 'Phone'],
  ['whatsapp_number', 'WhatsApp'], ['place_of_work', 'Place of work'], ['country', 'Country'],
  ['medical_license_no', 'License no.'], ['participant_type', 'Type'],
]
const LABELS = Object.fromEntries(COLUMNS)
// Same limits as the database columns.
const MAX_LENGTH = {
  name: 200, designation: 200, email: 255, phone: 50, whatsapp_number: 50, place_of_work: 255,
  country: 100, medical_license_no: 100, participant_type: 20,
}
// Field from either a code ("whatsapp_number") or a label the server uses ("WhatsApp number").
const fieldOf = (s) =>
  LABELS[s] ? s : COLUMNS.find(([f, l]) => [l, f.replace(/_/g, ' ')].some((x) => s.toLowerCase().startsWith(x.toLowerCase())))?.[0]

// Which cell an error is about (so it can be outlined) plus a plain-language message.
function describe(err) {
  if (err.startsWith('Missing ')) {
    const f = fieldOf(err.slice(8))
    return { field: f, text: `${LABELS[f] || err.slice(8)} is missing` }
  }
  if (err.endsWith(' is missing')) return { field: fieldOf(err), text: err }
  if (/^(participant_type|participant type|type) must/i.test(err)) return { field: 'participant_type', text: 'Type must be Faculty or Delegate' }
  if (/too long/i.test(err)) return { field: fieldOf(err), text: err }
  if (err.includes('license')) return { field: 'medical_license_no', text: 'License no. is required because this event gives CME credits' }
  if (err === EMAIL_HINT) return { field: 'email', text: 'Email address is not valid (it should look like name@gmail.com)' }
  if (err.includes('Duplicate email')) return { field: 'email', text: 'This email appears more than once in the file' }
  if (err.includes('already registered')) return { field: 'email', text: err }
  return { field: null, text: err }
}

const REQUIRED = ['name', 'designation', 'email', 'phone', 'whatsapp_number', 'place_of_work', 'participant_type']

// Mirrors the server's checks so errors update as rows are edited.
// "Already registered" can only come from the server, so it's kept until the email changes.
function validate(rows, originals, needsLicense) {
  const seen = new Set()
  return rows.map((row) => {
    const errors = REQUIRED.filter((f) => !String(row[f] ?? '').trim()).map((f) => `Missing ${f}`)
    const type = String(row.participant_type ?? '').trim()
    if (type && !['Faculty', 'Delegate'].includes(type.charAt(0).toUpperCase() + type.slice(1).toLowerCase())) {
      errors.push('participant_type must be Faculty or Delegate')
    }
    if (needsLicense && !String(row.medical_license_no ?? '').trim()) {
      errors.push('Medical license number is required for CME-credit events')
    }
    for (const [f, max] of Object.entries(MAX_LENGTH)) {
      if (String(row[f] ?? '').trim().length > max) errors.push(`${LABELS[f]} is too long (max ${max} characters)`)
    }
    const email = String(row.email ?? '').trim().toLowerCase()
    if (email && !isEmail(email)) errors.push(EMAIL_HINT)
    if (email) {
      if (seen.has(email)) errors.push('Duplicate email in this file')
      seen.add(email)
      const orig = originals[row.row_number]
      if (orig && orig.email.trim().toLowerCase() === email) {
        errors.push(...orig.errors.filter((e) => e.endsWith('is already registered for this event')))
      }
    }
    return { ...row, errors }
  })
}

export default function ImportPreviewModal({ fileName, event, initialRows, onClose, onCommit }) {
  const originals = useMemo(() => Object.fromEntries(initialRows.map((r) => [r.row_number, r])), [initialRows])
  const [rows, setRows] = useState(initialRows)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const needsLicense = Number(event.cme_credits) > 0
  const checked = useMemo(() => validate(rows, originals, needsLicense), [rows, originals, needsLicense])
  const bad = checked.filter((r) => r.errors.length).length
  const good = rows.length - bad

  const edit = (i, field, value) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [field]: value } : r)))
  const remove = (i) => setRows((rs) => rs.filter((_, j) => j !== i))

  const commit = async () => {
    setBusy(true)
    setError('')
    try {
      await onCommit(rows.map(({ errors, ...r }) => r))
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <Modal
      size="max-w-[min(96vw,1400px)]"
      title="Review import"
      subtitle={`${fileName} → ${event.event_name} · ${plural(rows.length, 'row')}${bad ? `, ${bad} with problems (they'll be skipped)` : ''}`}
      onClose={onClose}
      dirty={rows !== initialRows}
      footer={<>
        <ErrorNote>{error}</ErrorNote>
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={commit} disabled={busy || good === 0}>
          {busy ? 'Importing…' : `Import ${plural(good, 'row')}`}
        </button>
      </>}
    >
      {rows.length === 0 ? (
        <p className="py-8 text-center text-gray-500 dark:text-gray-400">No rows left to import.</p>
      ) : (
        <div className="-mx-5 max-h-[62vh] overflow-auto sm:-mx-6">
          <table className="w-full min-w-[1200px] text-sm">
            <thead className="sticky top-0 z-10 bg-gray-50 text-left text-xs font-semibold tracking-wide whitespace-nowrap text-gray-500 uppercase shadow-[0_1px_0_0_rgb(0_0_0/0.08)] dark:bg-night-input dark:text-gray-400">
              <tr>
                <th className="px-2 py-3 pl-5 sm:pl-6">Row</th>
                {COLUMNS.map(([f, label]) => (
                  <th key={label} className="px-1 py-3">
                    {label}
                    {(REQUIRED.includes(f) || (f === 'medical_license_no' && needsLicense)) && <span className="ml-0.5 text-red-500" aria-hidden="true">*</span>}
                  </th>
                ))}
                <th className="w-12 pr-5" />
              </tr>
            </thead>
            <tbody>
              {checked.map((r, i) => {
                const problems = r.errors.map(describe)
                const badFields = new Set(problems.map((p) => p.field))
                const tint = problems.length ? 'bg-red-50 dark:bg-red-500/10' : ''
                return (
                  <Fragment key={r.row_number}>
                    <tr className={tint}>
                      <td className={`px-2 pl-5 whitespace-nowrap text-gray-500 sm:pl-6 dark:text-gray-400 ${problems.length ? 'pt-1.5' : 'py-1.5'}`}>
                        {r.row_number}
                        {problems.length > 0 && <span className="ml-1.5 text-red-600 dark:text-red-400" aria-hidden="true">⚠</span>}
                      </td>
                      {COLUMNS.map(([f]) => (
                        <td key={f} className="px-1 py-1.5">
                          <input
                            className={`w-full min-w-24 rounded-md border bg-white px-2 py-1.5 text-sm focus:ring-2 focus:outline-none dark:bg-night-input ${badFields.has(f)
                              ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20 dark:border-red-400/70'
                              : 'border-gray-200 focus:border-brand-500 focus:ring-brand-500/20 dark:border-white/10'}`}
                            value={r[f] ?? ''}
                            maxLength={MAX_LENGTH[f]}
                            onChange={(e) => edit(i, f, e.target.value)}
                            aria-label={`Row ${r.row_number} ${LABELS[f]}`}
                            aria-invalid={badFields.has(f) || undefined}
                          />
                        </td>
                      ))}
                      <td className="pr-5 text-right">
                        <button className="btn-ghost min-h-11 min-w-11 px-2 text-gray-500 hover:text-red-600 dark:text-gray-400" onClick={() => remove(i)} aria-label={`Remove row ${r.row_number}`}>✕</button>
                      </td>
                    </tr>
                    {problems.length > 0 && (
                      <tr className={tint}>
                        <td />
                        <td colSpan={COLUMNS.length + 1} className="px-1 pb-2.5">
                          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs font-semibold text-red-700 dark:text-red-300" aria-label={`Row ${r.row_number} problems`}>
                            {problems.map((p) => <li key={p.text}>• {p.text}</li>)}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}
