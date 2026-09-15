import { useEffect, useState } from 'react'
import { api } from '../api'

const inputClass =
  'w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 dark:border-green-600 dark:bg-[#2a3743] dark:text-white dark:focus:border-green-400'

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
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-700/60 dark:bg-[#232f3b]">
        <h1 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
          Attendance &amp; Reporting Export
        </h1>
        <p className="mb-4 text-sm text-gray-600 dark:text-slate-400">
          Exports a consolidated report (identity, event, sign-in/out timestamps, status,
          device) for offline sharing. Postgres remains the live source of truth.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <select
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className={`${inputClass} sm:flex-1`}
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
            className="rounded-md bg-green-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {downloading ? 'Preparing...' : 'Download Report'}
          </button>
        </div>
        {error && (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">{error}</p>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-700/60 dark:bg-[#232f3b]">
        <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
          CME Observer Sign-Off Sheet
        </h2>
        <p className="mb-4 text-sm text-gray-600 dark:text-slate-400">
          A colored, printable sheet listing only registrants who completed sign-out (i.e.
          met the event's approximate duration) — for one consolidated batch sign-off by the
          observer, rather than individual signatures. Requires a specific event above.
        </p>
        <button
          type="button"
          onClick={handleDownloadObserverSheet}
          disabled={!eventId || downloadingObserver}
          className="rounded-md bg-purple-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {downloadingObserver ? 'Preparing...' : 'Download Observer Sheet'}
        </button>
        {!eventId && (
          <p className="mt-2 text-xs text-gray-400 dark:text-slate-500">Select an event above first.</p>
        )}
        {observerError && (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {observerError}
          </p>
        )}
      </section>
    </div>
  )
}
