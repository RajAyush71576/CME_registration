import { useState } from 'react'
import { api } from '../api'
import SignaturePad from '../SignaturePad'

function formatTime(iso) {
  return new Date(iso).toLocaleString()
}

export default function AttendanceCard({ result, deviceId, onUpdated }) {
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

  return (
    <li className="py-3">
      <div className="font-medium">
        {participant.name}{' '}
        <span className="text-gray-500">({participant.participant_type})</span>
      </div>
      <div className="text-sm text-gray-600">
        {participant.designation} · {participant.phone} · {participant.email}
        {participant.medical_license_no ? ` · Lic. ${participant.medical_license_no}` : ''}
      </div>
      <div className="text-xs text-gray-400">Registration ID: {registrationId}</div>

      {!attendance && (
        <div className="mt-2">
          {!showPad ? (
            <button
              type="button"
              onClick={() => setShowPad(true)}
              className="rounded bg-green-600 px-3 py-1.5 text-sm text-white"
            >
              Sign In
            </button>
          ) : (
            <div className="mt-2 space-y-2">
              <SignaturePad onChange={setSignature} />
              <button
                type="button"
                onClick={handleSignIn}
                disabled={submitting}
                className="rounded bg-green-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
              >
                {submitting ? 'Signing in...' : 'Confirm Sign In'}
              </button>
            </div>
          )}
        </div>
      )}

      {attendance && !attendance.sign_out_time && (
        <div className="mt-2">
          <p className="text-sm text-green-700">
            Signed in at {formatTime(attendance.sign_in_time)}
          </p>
          {!showPad ? (
            <button
              type="button"
              onClick={() => setShowPad(true)}
              className="mt-1 rounded bg-blue-600 px-3 py-1.5 text-sm text-white"
            >
              Sign Out
            </button>
          ) : (
            <div className="mt-2 space-y-2">
              <SignaturePad onChange={setSignature} />
              <button
                type="button"
                onClick={handleSignOut}
                disabled={submitting}
                className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
              >
                {submitting ? 'Signing out...' : 'Confirm Sign Out'}
              </button>
            </div>
          )}
        </div>
      )}

      {attendance?.sign_out_time && (
        <div className="mt-2">
          <p className="text-sm text-gray-700">
            Attendance complete: {formatTime(attendance.sign_in_time)} –{' '}
            {formatTime(attendance.sign_out_time)}
          </p>

          {!certificate ? (
            <button
              type="button"
              onClick={handleIssueCertificate}
              disabled={issuing}
              className="mt-2 rounded bg-purple-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              {issuing ? 'Issuing...' : 'Issue Certificate'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleDownloadCertificate}
              disabled={downloading}
              className="mt-2 rounded bg-purple-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              {downloading
                ? 'Opening...'
                : `Download Certificate No. ${certificate.certificate_no}`}
            </button>
          )}
          {certError && <p className="mt-1 text-sm text-red-600">{certError}</p>}
        </div>
      )}

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </li>
  )
}
