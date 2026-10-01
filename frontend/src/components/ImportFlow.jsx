import { useState } from 'react'
import { api } from '../api'
import { plural } from '../utils'
import ImportPreviewModal from './ImportPreviewModal'

const SOURCE_TYPE = 'cme_website'

// Excel import into one event: read file → review/fix rows → commit → result, with "Fix & import" for rows
// that didn't go in. Shared by the Import page and the event page. `onImported` runs after every commit.
export function useImportFlow(onImported) {
  const [preview, setPreview] = useState(null) // { fileName, rows, event, retry } — the event the rows were checked against
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const start = async (event, file) => {
    setError('')
    setResult(null)
    setBusy(true)
    try {
      const { rows } = await api.importPreview(event.event_id, file, SOURCE_TYPE)
      if (!rows.length) setError(`${file.name} has no participant rows below the header.`)
      else setPreview({ fileName: file.name, rows, event })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const commit = async (rows) => {
    const { event, fileName, retry } = preview
    const res = await api.importCommit({
      event_id: event.event_id, source_type: SOURCE_TYPE, rows,
      source_file: retry ? `${fileName} (corrections)` : fileName,
    })
    // Keep the rows that didn't go in, with their reasons, so they can be fixed and pushed again.
    const reasons = Object.fromEntries(res.errors.map((e) => [e.row_number, e.error_message.split('; ')]))
    const failed = rows.filter((r) => reasons[r.row_number]).map((r) => ({ ...r, errors: reasons[r.row_number] }))
    setPreview(null)
    setResult({ ...res, failed, event, fileName, retry })
    onImported?.()
  }

  const fixFailed = () => setPreview({ fileName: result.fileName, rows: result.failed, event: result.event, retry: true })

  const resultCard = result && (
    <div className="card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-bold">
          {result.retry ? 'Corrections: imported' : 'Imported'} {result.batch.row_count - result.batch.error_count} of {plural(result.batch.row_count, 'row')}
          <span className="ml-2 text-sm font-medium text-gray-500 dark:text-gray-400">into {result.event.event_name}</span>
        </h2>
        <button className="btn-ghost -mt-1 -mr-2 min-w-10 px-2" onClick={() => setResult(null)} aria-label="Dismiss import result">✕</button>
      </div>
      {result.errors.length > 0 ? (
        <ul className="mt-3 space-y-1 text-sm text-red-700 dark:text-red-300">
          {result.errors.map((e) => <li key={e.row_number}>Row {e.row_number}: {e.error_message}</li>)}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">Every row was registered.</p>
      )}
      {result.failed.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-400/30 dark:bg-amber-500/10">
          <p className="text-sm text-amber-900 dark:text-amber-100">
            {plural(result.failed.length, 'entry', 'entries')} still need fixing. Correct them and they'll be added to <b>{result.event.event_name}</b>.
          </p>
          <button className="btn-primary" onClick={fixFailed}>Fix &amp; import {plural(result.failed.length, 'entry', 'entries')}</button>
        </div>
      )}
    </div>
  )

  const modal = preview && (
    <ImportPreviewModal
      fileName={preview.fileName}
      event={preview.event}
      initialRows={preview.rows}
      onClose={() => setPreview(null)}
      onCommit={commit}
    />
  )

  return { start, busy, error, setError, reviewing: !!preview, resultCard, modal }
}

export const XLSX_ACCEPT = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

// File input handler: hands the picked file to `onPick` and clears the input so the same file can be picked again.
export const pickFile = (onPick) => (e) => {
  const file = e.target.files[0]
  e.target.value = ''
  if (file) onPick(file)
}
