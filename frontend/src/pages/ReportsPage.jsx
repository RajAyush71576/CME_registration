import { useEffect, useState } from 'react'
import { api } from '../api'

export default function ReportsPage() {
  const [events, setEvents] = useState([])
  const [eventId, setEventId] = useState('')
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [observerError, setObserverError] = useState('')
  const [downloadingObserver, setDownloadingObserver] = useState(false)

  useEffect(() => {
    api.listEvents().then(setEvents).catch(() => {})
  }, [])

  const handleDownload = async () => {
    setError('')
    setDownloading(true)
    try {
      const blob = await api.downloadAttendanceReport(eventId || undefined)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const stamp = new Date().toISOString().slice(0, 10)
      a.download = `attendance_report_${stamp}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message)
    } finally {
      setDownloading(false)
    }
  }

  const handleDownloadObserverSheet = async () => {
    setObserverError('')
    setDownloadingObserver(true)
    try {
      const blob = await api.downloadObserverSheet(eventId)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      setObserverError(err.message)
    } finally {
      setDownloadingObserver(false)
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <h1 className="mb-2 text-xl font-semibold">Attendance & Reporting Export</h1>
        <p className="mb-4 text-sm text-gray-600">
          Exports a consolidated report (identity, event, sign-in/out timestamps, status,
          device) for offline sharing. The central workbook remains the live source of truth.
        </p>

        <div className="flex gap-3">
          <select
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className="flex-1 rounded border px-3 py-2"
          >
            <option value="">All events</option>
            {events.map((ev) => (
              <option key={ev.event_id} value={ev.event_id}>
                {ev.event_name} ({ev.event_date})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
          >
            {downloading ? 'Preparing...' : 'Download Report'}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="mb-2 text-lg font-semibold">CME Observer Sign-Off Sheet</h2>
        <p className="mb-3 text-sm text-gray-600">
          A colored, printable sheet listing only registrants who completed sign-out (i.e.
          met the event's approximate duration) — for one consolidated batch sign-off by the
          observer, rather than individual signatures. Requires a specific event above.
        </p>
        <button
          type="button"
          onClick={handleDownloadObserverSheet}
          disabled={!eventId || downloadingObserver}
          className="rounded bg-purple-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {downloadingObserver ? 'Preparing...' : 'Download Observer Sheet'}
        </button>
        {!eventId && (
          <p className="mt-2 text-xs text-gray-400">Select an event above first.</p>
        )}
        {observerError && <p className="mt-2 text-sm text-red-600">{observerError}</p>}
      </section>
    </div>
  )
}
