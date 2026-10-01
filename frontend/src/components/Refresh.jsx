import { useEffect, useRef } from 'react'
import { api, API_URL, getToken } from '../api'

// Instant updates: the server pushes a small "X changed (for event Y)" ping over Server-Sent Events whenever
// someone creates/closes an event, registers, signs in/out or issues a certificate. `onChange(msg)` then
// re-fetches. The server ends each stream after ~25 s; we reconnect with a fresh short-lived ticket (the
// login token never goes in the URL). The version number tells us if anything changed while reconnecting.
export function useLiveUpdates(onChange) {
  const fn = useRef(onChange)
  fn.current = onChange
  useEffect(() => {
    if (!getToken() || typeof EventSource === 'undefined') return
    let version = null
    let es = null
    let timer = null
    let stopped = false
    let failures = 0
    const connect = async () => {
      let ticket
      try {
        ticket = (await api.liveTicket()).ticket
      } catch {
        return retry()
      }
      if (stopped) return
      es = new EventSource(`${API_URL}/live?token=${encodeURIComponent(ticket)}`)
      es.onopen = () => { failures = 0 }
      es.onmessage = (e) => {
        let msg
        try { msg = JSON.parse(e.data) } catch { return }
        if (version !== null && msg.version !== version) fn.current(msg)
        version = msg.version
      }
      es.onerror = () => { es.close(); retry() }
    }
    // Back off up to 30 s while the server is unreachable; normal stream ends reconnect after 1 s.
    const retry = () => {
      if (stopped) return
      failures += 1
      timer = setTimeout(connect, Math.min(1000 * 2 ** (failures - 1), 30000))
    }
    connect()
    return () => { stopped = true; clearTimeout(timer); es?.close() }
  }, [])
}

// Backup for the live stream: re-runs `refresh` every `ms` while the tab is visible, and as soon as the
// tab/window is looked at again (e.g. a tablet waking from sleep).
export function useAutoRefresh(refresh, ms = 60000) {
  const fn = useRef(refresh)
  fn.current = refresh
  useEffect(() => {
    const run = () => document.visibilityState === 'visible' && fn.current()
    const id = setInterval(run, ms)
    document.addEventListener('visibilitychange', run)
    window.addEventListener('focus', run)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', run)
      window.removeEventListener('focus', run)
    }
  }, [ms])
}
