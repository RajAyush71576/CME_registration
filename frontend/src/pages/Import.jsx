import { useEffect, useState } from 'react'
import { api } from '../api'
import { ParticipantTypeInput } from '../components/CreateParticipantModal'
import { pickFile, useImportFlow, XLSX_ACCEPT } from '../components/ImportFlow'
import { ErrorNote, Field } from '../components/Modal'
import { fmtDate, fmtDateTime } from '../utils'

export default function Import() {
  const [events, setEvents] = useState([])
  const [eventId, setEventId] = useState('')
  const [batches, setBatches] = useState([])
  const [loadError, setLoadError] = useState('')

  const loadBatches = () => api.importBatches().then(setBatches).catch((e) => setLoadError(e.message))
  useEffect(() => {
    Promise.all([api.events().then((es) => setEvents(es.filter((e) => e.status === 'active'))), loadBatches()])
      .catch((e) => setLoadError(e.message))
  }, [])

  const event = events.find((e) => e.event_id === eventId)
  const flow = useImportFlow(loadBatches)
  const busy = flow.busy
  const error = flow.error || loadError
  const setError = (m) => { flow.setError(m); setLoadError('') }

  const download = () => api.downloadTemplate().catch((e) => setError(e.message))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Import registrations</h1>
        <p className="mt-1 max-w-2xl text-gray-600 dark:text-gray-300">
          Upload the registration sheet from the CME website. You'll review every row and fix problems before anything is saved.
          Use the{' '}
          <button type="button" onClick={download} className="font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800 dark:text-brand-300">
            Download template
          </button>{' '}
          link for the expected columns.
        </p>
      </div>

      <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 sm:p-6">
        <Field label="Event">
          <select className="input" value={eventId} disabled={busy || flow.reviewing} onChange={(e) => setEventId(e.target.value)}>
            <option value="">Choose an active event…</option>
            {events.map((e) => <option key={e.event_id} value={e.event_id}>{e.event_name} — {fmtDate(e.event_date)}</option>)}
          </select>
        </Field>
        <Field label="Excel file (.xlsx)">
          <input
            type="file"
            accept={XLSX_ACCEPT}
            disabled={!eventId || busy}
            onChange={pickFile((file) => flow.start(event, file))}
            className="input cursor-pointer py-2 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:font-semibold file:text-brand-800 disabled:cursor-not-allowed dark:file:bg-brand-500/15 dark:file:text-brand-200"
          />
          <span className="mt-1.5 block text-sm text-gray-500 dark:text-gray-400">
            {busy ? 'Reading file…' : eventId ? 'Picking a file opens the review screen.' : 'Choose an event first.'}
          </span>
        </Field>
        <Field label="Default participant type (optional)" className="sm:col-span-2">
          <ParticipantTypeInput id="default-participant-type-list" value={flow.defaultType} onChange={flow.setDefaultType} placeholder="e.g. Faculty" />
          <span className="mt-1.5 block text-sm text-gray-500 dark:text-gray-400">
            Used for any row that doesn't already have a Participant Type — handy when the whole sheet is one type (e.g. a society's "Faculty list" with no such column).
          </span>
        </Field>
        <div className="sm:col-span-2"><ErrorNote>{error}</ErrorNote></div>
      </div>

      {flow.resultCard}

      <div className="card overflow-hidden">
        <h2 className="border-b border-gray-100 p-4 text-lg font-bold dark:border-white/10">Import history</h2>
        {batches.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">No imports yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="bg-gray-50 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:bg-white/5 dark:text-gray-400">
                <tr>{['File', 'Imported', 'By', 'Rows', 'Errors'].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {batches.map((b) => (
                  <tr key={b.batch_id}>
                    <td className="px-4 py-3 font-medium">{b.source_file}</td>
                    <td className="px-4 py-3">{fmtDateTime(b.imported_at)}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{b.imported_by}</td>
                    <td className="px-4 py-3">{b.row_count}</td>
                    <td className={`px-4 py-3 ${b.error_count ? 'font-semibold text-red-600 dark:text-red-400' : ''}`}>{b.error_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {flow.modal}
    </div>
  )
}
