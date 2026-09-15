import { useState } from 'react'
import { useAuth } from '../AuthContext'
import { api } from '../api'
import Badge from '../Badge'
import SignaturePad from '../SignaturePad'

const DEVICE_ID = 'STAFF-PORTAL'

const inputClass =
  'w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 dark:border-green-600 dark:bg-[#2a3743] dark:text-white dark:placeholder-slate-500 dark:focus:border-green-400'
const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-slate-400'
const actionBtn =
  'rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50'

function formatTime(iso) {
  return new Date(iso).toLocaleString()
}

function formatStartTime(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function attendanceStatus(attendance, eventStatus) {
  if (!attendance) return eventStatus === 'closed' ? 'Absent' : 'Not signed in'
  if (attendance.sign_out_time) return 'Completed'
  return 'Signed in'
}

function statusTone(status) {
  if (status === 'Completed') return 'green'
  if (status === 'Signed in') return 'blue'
  if (status === 'Absent') return 'red'
  return 'gray'
}

export default function ParticipantDetailModal({
  registration,
  eventStatus,
  eventDate,
  eventStartTime,
  approxDurationHours,
  onClose,
  onUpdated,
}) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const { participant, attendance, certificate, registration_id: registrationId } = registration
  const eventClosed = eventStatus === 'closed'

  const todayUtc = new Date().toISOString().slice(0, 10)
  const isEventDay = eventDate === todayUtc
  const eventStartsAt =
    eventDate && eventStartTime ? new Date(`${eventDate}T${eventStartTime}Z`).getTime() : null
  const signInAvailable = eventStartsAt == null || (isEventDay && Date.now() >= eventStartsAt)

  const remainingHours =
    attendance && !attendance.sign_out_time
      ? Number(approxDurationHours) -
        (Date.now() - new Date(attendance.sign_in_time).getTime()) / 3_600_000
      : 0
  const signOffAvailable = remainingHours <= 0

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: participant.name,
    designation: participant.designation,
    email: participant.email,
    phone: participant.phone,
    whatsapp_number: participant.whatsapp_number,
    place_of_work: participant.place_of_work,
    country: participant.country || '',
    medical_license_no: participant.medical_license_no || '',
    participant_type: participant.participant_type,
  })
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState('')

  const [signature, setSignature] = useState(null)
  const [showPad, setShowPad] = useState(false)
  const [attendanceError, setAttendanceError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [certError, setCertError] = useState('')
  const [issuing, setIssuing] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const status = attendanceStatus(attendance, eventStatus)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
  }

  const handleSaveEdit = async (e) => {
    e.preventDefault()
    setEditError('')
    setSavingEdit(true)
    try {
      await api.updateParticipant(participant.participant_id, {
        ...form,
        country: form.country || null,
        medical_license_no: form.medical_license_no || null,
      })
      setEditing(false)
      onUpdated()
    } catch (err) {
      setEditError(err.message)
    } finally {
      setSavingEdit(false)
    }
  }

  const runAttendanceAction = async (action) => {
    if (!signature) {
      setAttendanceError('Please sign before continuing.')
      return
    }
    setAttendanceError('')
    setSubmitting(true)
    try {
      await action()
      setSignature(null)
      setShowPad(false)
      onUpdated()
    } catch (err) {
      setAttendanceError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSignIn = () =>
    runAttendanceAction(() =>
      api.signIn({ registration_id: registrationId, device_id: DEVICE_ID, signature }),
    )

  const handleSignOut = () =>
    runAttendanceAction(() => api.signOut(attendance.attendance_id, { signature }))

  const handleIssueCertificate = async () => {
    setCertError('')
    setIssuing(true)
    try {
      await api.issueCertificate(registrationId)
      onUpdated()
    } catch (err) {
      setCertError(err.message)
    } finally {
      setIssuing(false)
    }
  }

  const handleDownloadCertificate = async () => {
    setCertError('')
    setDownloading(true)
    try {
      const blob = await api.downloadCertificate(certificate.certificate_id)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      setCertError(err.message)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[95vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-gray-200 bg-white p-4 shadow-xl sm:p-6 dark:border-slate-700/60 dark:bg-[#232f3b]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3 border-b border-gray-200 pb-4 dark:border-slate-700/60">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{participant.name}</h2>
            <div className="mt-0.5 font-mono text-xs text-gray-400 dark:text-slate-500">Reg. {registrationId}</div>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={statusTone(status)}>{status}</Badge>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-start">
        {/* Participant details / edit form */}
        {!editing || attendance?.sign_out_time ? (
          <div className="rounded-lg border border-gray-200 p-4 dark:border-slate-700/60">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Participant details</h3>
              {!attendance?.sign_out_time && !isAdmin && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Edit
                </button>
              )}
            </div>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-gray-500 dark:text-slate-500">Designation</dt>
                <dd className="font-medium text-gray-900 dark:text-slate-200">{participant.designation}</dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-slate-500">Type</dt>
                <dd className="font-medium text-gray-900 dark:text-slate-200">{participant.participant_type}</dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-slate-500">Phone</dt>
                <dd className="font-medium text-gray-900 dark:text-slate-200">{participant.phone}</dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-slate-500">WhatsApp</dt>
                <dd className="font-medium text-gray-900 dark:text-slate-200">{participant.whatsapp_number}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-gray-500 dark:text-slate-500">Email</dt>
                <dd className="font-medium text-gray-900 dark:text-slate-200">{participant.email}</dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-slate-500">Place of work</dt>
                <dd className="font-medium text-gray-900 dark:text-slate-200">{participant.place_of_work}</dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-slate-500">Country</dt>
                <dd className="font-medium text-gray-900 dark:text-slate-200">{participant.country || '—'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-gray-500 dark:text-slate-500">Medical license no.</dt>
                <dd className="font-medium text-gray-900 dark:text-slate-200">
                  {participant.medical_license_no || '—'}
                </dd>
              </div>
            </dl>
          </div>
        ) : (
          <form
            onSubmit={handleSaveEdit}
            className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-4 sm:grid-cols-2 dark:border-slate-700/60"
          >
            <div className="sm:col-span-2">
              <label className={labelClass}>Name</label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                required
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
              <label className={labelClass}>WhatsApp number</label>
              <input
                name="whatsapp_number"
                value={form.whatsapp_number}
                onChange={handleChange}
                required
                className={inputClass}
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
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Medical license no.</label>
              <input
                name="medical_license_no"
                value={form.medical_license_no}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
            {editError && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                {editError}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1 sm:col-span-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-md border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="rounded-md bg-green-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingEdit ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </form>
        )}

        {/* Attendance / sign-in-out + certificate */}
        <div className="space-y-4">
        <div className="rounded-lg border border-gray-200 p-4 dark:border-slate-700/60">
          <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Attendance</h3>

          {eventClosed && (
            <p className="rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-600 dark:bg-slate-700/40 dark:text-slate-300">
              This event is closed — sign-in and sign-out are no longer available.
            </p>
          )}

          {!eventClosed && !isAdmin && !attendance && (
            <div>
              {!signInAvailable ? (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                  {isEventDay
                    ? `Sign-in opens at ${formatStartTime(eventStartTime)} today.`
                    : 'Sign-in is only available on the day of the event.'}
                </p>
              ) : !showPad ? (
                <button
                  type="button"
                  onClick={() => setShowPad(true)}
                  className={`${actionBtn} bg-green-600 hover:bg-green-700`}
                >
                  Sign In
                </button>
              ) : (
                <div className="space-y-3">
                  <SignaturePad onChange={setSignature} />
                  <button
                    type="button"
                    onClick={handleSignIn}
                    disabled={submitting}
                    className={`${actionBtn} bg-green-600 hover:bg-green-700`}
                  >
                    {submitting ? 'Signing in...' : 'Confirm Sign In'}
                  </button>
                </div>
              )}
            </div>
          )}

          {!eventClosed && attendance && !attendance.sign_out_time && (
            <div>
              <p className="mb-2 text-sm font-medium text-blue-700 dark:text-blue-400">
                Signed in at {formatTime(attendance.sign_in_time)}
              </p>
              {isAdmin ? null : !signOffAvailable ? (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                  Sign-off not yet available: {remainingHours.toFixed(2)}h remaining to meet the
                  event's approximate duration ({Number(approxDurationHours)}h).
                </p>
              ) : !showPad ? (
                <button
                  type="button"
                  onClick={() => setShowPad(true)}
                  className={`${actionBtn} bg-blue-600 hover:bg-blue-700`}
                >
                  Sign Out
                </button>
              ) : (
                <div className="space-y-3">
                  <SignaturePad onChange={setSignature} />
                  <button
                    type="button"
                    onClick={handleSignOut}
                    disabled={submitting}
                    className={`${actionBtn} bg-blue-600 hover:bg-blue-700`}
                  >
                    {submitting ? 'Signing out...' : 'Confirm Sign Out'}
                  </button>
                </div>
              )}
            </div>
          )}

          {attendance?.sign_out_time && (
            <p className="text-sm font-medium text-green-700 dark:text-green-400">
              Attendance complete: {formatTime(attendance.sign_in_time)} –{' '}
              {formatTime(attendance.sign_out_time)}
            </p>
          )}

          {eventClosed && !attendance && (
            <p className="mt-2 text-sm text-gray-500 dark:text-slate-500">No attendance recorded.</p>
          )}

          {attendanceError && (
            <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
              {attendanceError}
            </p>
          )}
        </div>

        {/* Certificate */}
        {attendance?.sign_out_time && isAdmin && (
          <div className="rounded-lg border border-gray-200 p-4 dark:border-slate-700/60">
            <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Certificate</h3>
            {!certificate ? (
              <button
                type="button"
                onClick={handleIssueCertificate}
                disabled={issuing}
                className={`${actionBtn} bg-purple-600 hover:bg-purple-700`}
              >
                {issuing ? 'Issuing...' : 'Issue Certificate'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDownloadCertificate}
                disabled={downloading}
                className={`${actionBtn} bg-purple-600 hover:bg-purple-700`}
              >
                {downloading
                  ? 'Opening...'
                  : `Download Certificate No. ${certificate.certificate_no}`}
              </button>
            )}
            {certError && (
              <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                {certError}
              </p>
            )}
          </div>
        )}
        </div>
        </div>
      </div>
    </div>
  )
}
