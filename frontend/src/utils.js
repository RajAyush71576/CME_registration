export const credits = (e) => Number(e?.cme_credits || 0)
// Hours (possibly fractional) → "1 h 30 min", "45 min", or "No minimum" for 0.
export const fmtDuration = (hours) => {
  const total = Math.round(Number(hours) * 60)
  if (!total) return 'No minimum'
  const h = Math.floor(total / 60)
  const m = total % 60
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`
}
export const num = (v) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })

// event_date is "YYYY-MM-DD" — parse as a local date, not UTC midnight.
export const parseDate = (d) => {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day)
}
export const fmtDate = (d) =>
  parseDate(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
// All times are 12-hour with uppercase AM/PM ("9:05 AM"); en-IN alone gives "9:05 am".
const TIME_OPTS = { hour: 'numeric', minute: '2-digit', hour12: true }
const upper = (s) => s.replace(/(am|pm)$/, (x) => x.toUpperCase())
export const fmtTime = (t) => {
  const [h, m] = t.split(':').map(Number)
  return upper(new Date(2000, 0, 1, h, m).toLocaleTimeString('en-IN', TIME_OPTS))
}
// "1 Oct 2026, 9:05 AM" in IST.
export const fmtDateTime = (iso) =>
  iso
    ? upper(new Date(iso).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', ...TIME_OPTS,
      }))
    : ''

// Current date + time in Asia/Kolkata, matching the backend's sign-in rules.
export function nowIST() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date()).map((p) => [p.type, p.value]),
  )
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` }
}

export function attendanceStatus(reg, event) {
  // Faculty-only manual present/absent call stands in for sign-in/out entirely when set.
  if (reg.manual_status === 'present') return { label: 'Completed', tone: 'green', key: 'completed' }
  if (reg.manual_status === 'absent') return { label: 'Absent', tone: 'red', key: 'absent' }
  const a = reg.attendance
  if (a?.sign_out_time) return { label: 'Completed', tone: 'green', key: 'completed' }
  if (a) return { label: 'Signed in', tone: 'blue', key: 'signed_in' }
  if (event?.status === 'closed') return { label: 'Absent', tone: 'red', key: 'absent' }
  return { label: 'Not signed in', tone: 'gray', key: 'not_signed_in' }
}

// Participant table order: not signed in first, then signed in, then completed; A–Z within each group.
const STATUS_RANK = { not_signed_in: 0, absent: 0, signed_in: 1, completed: 2 }
export const byAttendanceThenName = (event) => (a, b) =>
  STATUS_RANK[attendanceStatus(a, event).key] - STATUS_RANK[attendanceStatus(b, event).key] ||
  a.participant.name.localeCompare(b.participant.name, undefined, { sensitivity: 'base' })

export const ROLE_LABELS = { admin: 'Admin', staff: 'Staff' }
export const fmtClock = (iso) =>
  upper(new Date(iso).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', ...TIME_OPTS }))

// Same rule as the server: name@domain.tld (e.g. name@gmail.com).
export const EMAIL_PATTERN = '[A-Za-z0-9._%+\\-]+@[A-Za-z0-9\\-]+(\\.[A-Za-z0-9\\-]+)*\\.[A-Za-z]{2,}'
export const isEmail = (v) => new RegExp(`^${EMAIL_PATTERN}$`).test(String(v ?? '').trim())
export const EMAIL_HINT = 'Enter a valid email address, like name@gmail.com'

// "website" and "import" are both Excel-upload paths (CME website export vs. an external-society
// sheet) — both read as "Excel"; only on-site walk-ins are labeled differently.
export const SOURCE_LABELS = { website: 'Excel', import: 'Excel', on_spot: 'On-spot' }

// UTC ISO timestamp -> IST calendar day (YYYY-MM-DD), for date filters.
export const istDay = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

export const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`
