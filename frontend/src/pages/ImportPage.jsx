import { useEffect, useState } from 'react'
import { api } from '../api'

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100'
const labelClass = 'mb-1 block text-sm font-medium text-gray-700'

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
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <h1 className="mb-2 text-xl font-semibold text-gray-900">Excel Import</h1>
        <p className="mb-5 text-sm text-gray-600">
          Upload the CME website Excel export, or an external society list reformatted to
          the standard template.{' '}
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="font-medium text-blue-600 underline hover:text-blue-700"
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
              className="block w-full text-sm text-gray-600 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Importing...' : 'Import'}
          </button>
        </form>

        {result && (
          <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-gray-200 px-3 py-1 font-medium text-gray-700">
                {result.batch.row_count} rows processed
              </span>
              <span className="rounded-full bg-green-100 px-3 py-1 font-medium text-green-700">
                {result.batch.row_count - result.batch.error_count} imported
              </span>
              {result.batch.error_count > 0 && (
                <span className="rounded-full bg-red-100 px-3 py-1 font-medium text-red-700">
                  {result.batch.error_count} errors
                </span>
              )}
            </div>
            {result.errors.length > 0 && (
              <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-sm text-red-700">
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
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Import History</h2>
        <ul className="divide-y overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {batches.map((b) => (
            <li key={b.batch_id} className="px-4 py-3.5 text-sm sm:px-5">
              <div className="font-medium text-gray-900">{b.source_file}</div>
              <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-gray-500">
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
            <li className="px-5 py-10 text-center text-sm text-gray-500">No imports yet.</li>
          )}
        </ul>
      </section>
    </div>
  )
}
