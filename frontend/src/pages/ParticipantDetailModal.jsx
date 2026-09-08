import { useState } from 'react'
import { useAuth } from '../AuthContext'
import { api } from '../api'
import Badge from '../Badge'
import SignaturePad from '../SignaturePad'

const DEVICE_ID = 'STAFF-PORTAL'

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100'
const labelClass = 'mb-1 block text-sm font-medium text-gray-700'
const actionBtn =
  'rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50'

function formatTime(iso) {
  return new Date(iso).toLocaleString()
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
  approxDurationHours,
  onClose,
  onUpdated,
}) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const { participant, attendance, certificate, registration_id: registrationId } = registration
  const eventClosed = eventStatus === 'closed'

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
        className="max-h-[95vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{participant.name}</h2>
            <div className="mt-0.5 font-mono text-xs text-gray-400">Reg. {registrationId}</div>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={statusTone(status)}>{status}</Badge>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
        {/* Participant details / edit form */}
        {!editing || attendance?.sign_out_time ? (
          <div className="rounded-lg border border-gray-200 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Participant details</h3>
              {!attendance?.sign_out_time && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  Edit
                </button>
              )}
            </div>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-gray-500">Designation</dt>
                <dd className="font-medium text-gray-900">{participant.designation}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Type</dt>
                <dd className="font-medium text-gray-900">{participant.participant_type}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Phone</dt>
                <dd className="font-medium text-gray-900">{participant.phone}</dd>
              </div>
              <div>
                <dt className="text-gray-500">WhatsApp</dt>
                <dd className="font-medium text-gray-900">{participant.whatsapp_number}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-gray-500">Email</dt>
                <dd className="font-medium text-gray-900">{participant.email}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Place of work</dt>
                <dd className="font-medium text-gray-900">{participant.place_of_work}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Country</dt>
                <dd className="font-medium text-gray-900">{participant.country || '—'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-gray-500">Medical license no.</dt>
                <dd className="font-medium text-gray-900">
                  {participant.medical_license_no || '—'}
                </dd>
              </div>
            </dl>
          </div>
        ) : (
          <form
            onSubmit={handleSaveEdit}
            className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-4 sm:grid-cols-2"
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
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">
                {editError}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1 sm:col-span-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingEdit ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </form>
        )}

        {/* Attendance / sign-in-out + certificate */}
        <div className="space-y-4">
        <div className="rounded-lg border border-gray-200 p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Attendance</h3>

          {eventClosed && (
            <p className="rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-600">
              This event is closed — sign-in and sign-out are no longer available.
            </p>
          )}

          {!eventClosed && !attendance && (
            <div>
              {!showPad ? (
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
              <p className="mb-2 text-sm font-medium text-blue-700">
                Signed in at {formatTime(attendance.sign_in_time)}
              </p>
              {!signOffAvailable ? (
                <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
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
            <p className="text-sm font-medium text-green-700">
              Attendance complete: {formatTime(attendance.sign_in_time)} –{' '}
              {formatTime(attendance.sign_out_time)}
            </p>
          )}

          {eventClosed && !attendance && (
            <p className="mt-2 text-sm text-gray-500">No attendance recorded.</p>
          )}

          {attendanceError && (
            <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {attendanceError}
            </p>
          )}
        </div>

        {/* Certificate */}
        {attendance?.sign_out_time && isAdmin && (
          <div className="rounded-lg border border-gray-200 p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">Certificate</h3>
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
              <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
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
