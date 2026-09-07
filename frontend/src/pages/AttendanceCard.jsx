import { useState } from 'react'
import { useAuth } from '../AuthContext'
import { api } from '../api'
import SignaturePad from '../SignaturePad'

function formatTime(iso) {
  return new Date(iso).toLocaleString()
}

const actionBtn =
  'rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50'

export default function AttendanceCard({ result, deviceId, onUpdated }) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const { participant, attendance, certificate, registration_id: registrationId } = result
  const [signature, setSignature] = useState(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showPad, setShowPad] = useState(false)
  const [certError, setCertError] = useState('')
  const [issuing, setIssuing] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const runAction = async (action) => {
    if (!signature) {
      setError('Please sign before continuing.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await action()
      setSignature(null)
      setShowPad(false)
      onUpdated()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSignIn = () =>
    runAction(() => api.signIn({ registration_id: registrationId, device_id: deviceId, signature }))

  const handleSignOut = () =>
    runAction(() => api.signOut(attendance.attendance_id, { signature }))

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

  const stateBorder = attendance?.sign_out_time
    ? 'border-l-4 border-l-green-500'
    : attendance
      ? 'border-l-4 border-l-blue-500'
      : 'border-l-4 border-l-gray-300'

  return (
    <li className={`rounded-lg border border-gray-200 bg-white p-4 shadow-sm ${stateBorder}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-gray-900">{participant.name}</span>
        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
          {participant.participant_type}
        </span>
      </div>
      <div className="mt-1 text-sm text-gray-600">
        {participant.designation} · {participant.phone} · {participant.email}
        {participant.medical_license_no ? ` · Lic. ${participant.medical_license_no}` : ''}
      </div>
      <div className="mt-0.5 font-mono text-xs text-gray-400">Reg. {registrationId}</div>

      {!attendance && (
        <div className="mt-3">
          {!showPad ? (
            <button
              type="button"
              onClick={() => setShowPad(true)}
              className={`${actionBtn} bg-green-600 hover:bg-green-700`}
            >
              Sign In
            </button>
          ) : (
            <div className="mt-2 space-y-3">
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

      {attendance && !attendance.sign_out_time && (
        <div className="mt-3">
          <p className="text-sm font-medium text-blue-700">
            Signed in at {formatTime(attendance.sign_in_time)}
          </p>
          {!showPad ? (
            <button
              type="button"
              onClick={() => setShowPad(true)}
              className={`${actionBtn} mt-2 bg-blue-600 hover:bg-blue-700`}
            >
              Sign Out
            </button>
          ) : (
            <div className="mt-2 space-y-3">
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
        <div className="mt-3">
          <p className="text-sm font-medium text-green-700">
            Attendance complete: {formatTime(attendance.sign_in_time)} –{' '}
            {formatTime(attendance.sign_out_time)}
          </p>

          {isAdmin &&
            (!certificate ? (
              <button
                type="button"
                onClick={handleIssueCertificate}
                disabled={issuing}
                className={`${actionBtn} mt-2 bg-purple-600 hover:bg-purple-700`}
              >
                {issuing ? 'Issuing...' : 'Issue Certificate'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDownloadCertificate}
                disabled={downloading}
                className={`${actionBtn} mt-2 bg-purple-600 hover:bg-purple-700`}
              >
                {downloading
                  ? 'Opening...'
                  : `Download Certificate No. ${certificate.certificate_no}`}
              </button>
            ))}
          {certError && (
            <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {certError}
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
    </li>
  )
}
