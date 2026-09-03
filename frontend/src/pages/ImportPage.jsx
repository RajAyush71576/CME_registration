import { useEffect, useState } from 'react'
import { api } from '../api'

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
      <section>
        <h1 className="mb-2 text-xl font-semibold">Excel Import</h1>
        <p className="mb-4 text-sm text-gray-600">
          Upload the CME website Excel export, or an external society list reformatted to
          the standard template.{' '}
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="text-blue-600 underline"
          >
            Download template
          </button>
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <select
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            required
            className="w-full rounded border px-3 py-2"
          >
            <option value="">Select an event...</option>
            {events.map((ev) => (
              <option key={ev.event_id} value={ev.event_id}>
                {ev.event_name} ({ev.event_date})
              </option>
            ))}
          </select>
          <select
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value)}
            className="w-full rounded border px-3 py-2"
          >
            <option value="cme_website">CME website export</option>
            <option value="external_society">External society list</option>
          </select>
          <input
            type="file"
            accept=".xlsx"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            required
            className="w-full rounded border px-3 py-2"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
          >
            {submitting ? 'Importing...' : 'Import'}
          </button>
        </form>

        {result && (
          <div className="mt-4 rounded border bg-white p-4">
            <p className="text-sm font-medium">
              {result.batch.row_count} rows processed ·{' '}
              {result.batch.row_count - result.batch.error_count} imported ·{' '}
              {result.batch.error_count} errors
            </p>
            {result.errors.length > 0 && (
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-sm text-red-600">
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
        <h2 className="mb-3 text-lg font-semibold">Import History</h2>
        <ul className="divide-y rounded border bg-white">
          {batches.map((b) => (
            <li key={b.batch_id} className="px-4 py-3 text-sm">
              <span className="font-medium">{b.source_file}</span> · {b.source_type} ·{' '}
              {b.row_count} rows · {b.error_count} errors ·{' '}
              {new Date(b.imported_at).toLocaleString()} · by {b.imported_by}
            </li>
          ))}
          {batches.length === 0 && (
            <li className="px-4 py-3 text-sm text-gray-500">No imports yet.</li>
          )}
        </ul>
      </section>
    </div>
  )
}
