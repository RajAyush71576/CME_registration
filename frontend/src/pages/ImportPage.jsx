import { useEffect, useState } from 'react'
import { api } from '../api'

const inputClass =
  'w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 dark:border-green-600 dark:bg-[#2a3743] dark:text-white dark:placeholder-slate-500 dark:focus:border-green-400'
const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-slate-400'

export default function ImportPage() {
  const [events, setEvents] = useState([])
  const [eventId, setEventId] = useState('')
  const [sourceType, setSourceType] = useState('cme_website')
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [batches, setBatches] = useState([])

  const loadBatches = () => api.listImportBatches().then(setBatches).catch(() => {})

  useEffect(() => {
    api.listEvents().then(setEvents).catch(() => {})
    loadBatches()
  }, [])

  const handleDownloadTemplate = async () => {
    setError('')
    try {
      const blob = await api.downloadImportTemplate()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'cme_import_template.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setResult(null)
    if (!file) {
      setError('Please choose a file.')
      return
    }
    setSubmitting(true)
    try {
      const data = await api.importParticipants(eventId, sourceType, file)
      setResult(data)
      setFile(null)
      e.target.reset()
      await loadBatches()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-700/60 dark:bg-[#232f3b]">
        <h1 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">Excel Import</h1>
        <p className="mb-5 text-sm text-gray-600 dark:text-slate-400">
          Upload the CME website Excel export, or an external society list reformatted to
          the standard template.{' '}
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="font-medium text-blue-600 underline hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Download template
          </button>
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Event</label>
              <select
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                required
                className={inputClass}
              >
                <option value="">Select an event...</option>
                {events.map((ev) => (
                  <option key={ev.event_id} value={ev.event_id}>
                    {ev.event_name} ({ev.event_date})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Source</label>
              <select
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value)}
                className={inputClass}
              >
                <option value="cme_website">CME website export</option>
                <option value="external_society">External society list</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Registrant file (.xlsx)</label>
            <input
              type="file"
              accept=".xlsx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
              className="block w-full text-sm text-gray-600 dark:text-slate-400 file:mr-4 file:rounded-md file:border-0 file:bg-green-600 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-white hover:file:bg-green-500"
            />
          </div>
          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">{error}</p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-green-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Importing...' : 'Import'}
          </button>
        </form>

        {result && (
          <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-slate-700/60 dark:bg-white/5">
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-gray-200 px-3 py-1 font-medium text-gray-700 dark:bg-slate-500/20 dark:text-slate-300">
                {result.batch.row_count} rows processed
              </span>
              <span className="rounded-full bg-green-100 px-3 py-1 font-medium text-green-700 dark:bg-green-500/15 dark:text-green-400">
                {result.batch.row_count - result.batch.error_count} imported
              </span>
              {result.batch.error_count > 0 && (
                <span className="rounded-full bg-red-100 px-3 py-1 font-medium text-red-700 dark:bg-red-500/15 dark:text-red-400">
                  {result.batch.error_count} errors
                </span>
              )}
            </div>
            {result.errors.length > 0 && (
              <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-sm text-red-700 dark:text-red-300">
                {result.errors.map((e, i) => (
                  <li key={i}>
                    Row {e.row_number}: {e.error_message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">Import History</h2>
        <ul className="divide-y divide-gray-200 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:divide-slate-700/60 dark:border-slate-700/60 dark:bg-[#232f3b]">
          {batches.map((b) => (
            <li key={b.batch_id} className="px-4 py-3.5 text-sm sm:px-5">
              <div className="font-medium text-gray-900 dark:text-white">{b.source_file}</div>
              <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-gray-500 dark:text-slate-500">
                <span>{b.source_type}</span>
                <span>·</span>
                <span>{b.row_count} rows</span>
                <span>·</span>
                <span>{b.error_count} errors</span>
                <span>·</span>
                <span>{new Date(b.imported_at).toLocaleString()}</span>
                <span>·</span>
                <span>by {b.imported_by}</span>
              </div>
            </li>
          ))}
          {batches.length === 0 && (
            <li className="px-5 py-10 text-center text-sm text-gray-500 dark:text-slate-400">No imports yet.</li>
          )}
        </ul>
      </section>
    </div>
  )
}
