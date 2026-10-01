<<<<<<< HEAD
export const API_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`

const TOKEN_KEY = 'cme_token'
export const getToken = () => sessionStorage.getItem(TOKEN_KEY)
export const setToken = (t) => sessionStorage.setItem(TOKEN_KEY, t)
export const clearToken = () => sessionStorage.removeItem(TOKEN_KEY)

let onUnauthorized = () => {}
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn }

// Pydantic error -> "whatsapp number: String should have at least 1 character".
const fieldError = (d) => {
  const field = d.loc?.filter((l) => l !== 'body' && typeof l === 'string').at(-1)
  const msg = d.msg?.replace(/^Value error, /, '')
  return field ? `${field.replace(/_/g, ' ')}: ${msg}` : msg
}

async function errorMessage(res) {
  try {
    const body = await res.json()
    if (Array.isArray(body.detail)) return body.detail.map(fieldError).join('; ')
    if (body.detail) return body.detail
  } catch { /* not JSON */ }
  return `Something went wrong (${res.status}). Try again.`
}

async function raw(path, { body, headers, ...opts } = {}) {
  const token = getToken()
  const isForm = body instanceof FormData
  let res
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...opts,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body && !isForm ? JSON.stringify(body) : body,
    })
  } catch {
    throw new Error("Can't reach the server. Check the tablet's Wi-Fi, or ask an admin.")
  }
  if (res.status === 401 && path !== '/auth/login') {
    clearToken()
    onUnauthorized()
  }
  if (!res.ok) throw new Error(await errorMessage(res))
  return res
}

export async function request(path, opts) {
  const res = await raw(path, opts)
  return res.status === 204 ? null : res.json()
}

async function blob(path) {
  return (await raw(path)).blob()
}

// Uses the server's filename (Content-Disposition) so same-day downloads don't collide.
async function download(path, fallback) {
  const res = await raw(path)
  const name = res.headers.get('Content-Disposition')?.match(/filename="?([^";]+)"?/)?.[1]
  saveBlob(await res.blob(), name || fallback)
}

function saveBlob(b, filename) {
  const url = URL.createObjectURL(b)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Open the tab synchronously (inside the click) so popup blockers allow it, then fill it.
async function openBlobInTab(path) {
  const win = window.open('', '_blank')
  try {
    const url = URL.createObjectURL(await blob(path))
    if (win) win.location.href = url
    else window.location.href = url
  } catch (e) {
    win?.close()
    throw e
  }
}

const today = () => new Date().toLocaleDateString('en-CA') // YYYY-MM-DD

export const api = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
  liveTicket: () => request('/auth/live-ticket', { method: 'POST' }),

  users: () => request('/users'),
  createUser: (data) => request('/users', { method: 'POST', body: data }),
  updateUser: (id, data) => request(`/users/${id}`, { method: 'PATCH', body: data }),

  events: () => request('/events'),
  event: (id) => request(`/events/${id}`),
  createEvent: (data) => request('/events', { method: 'POST', body: data }),
  updateEvent: (id, data) => request(`/events/${id}`, { method: 'PATCH', body: data }),
  closeEvent: (id) => request(`/events/${id}/close`, { method: 'POST' }),

  participants: () => request('/participants'),
  createParticipant: (data) => request('/participants', { method: 'POST', body: data }),
  updateParticipant: (id, data) => request(`/participants/${id}`, { method: 'PATCH', body: data }),

  register: (participant_id, event_id, source = 'on_spot') =>
    request('/registrations', { method: 'POST', body: { participant_id, event_id, source } }),
  registrationsByEvent: (eventId) => request(`/registrations/by-event/${eventId}`),

  signIn: (registration_id, signature, device_id = 'STAFF-PORTAL') =>
    request('/attendance/sign-in', { method: 'POST', body: { registration_id, device_id, signature } }),
  signOut: (attendanceId, signature) =>
    request(`/attendance/${attendanceId}/sign-out`, { method: 'POST', body: { signature } }),

  issueCertificate: (registration_id) => request('/certificates/issue', { method: 'POST', body: { registration_id } }),
  openCertificate: (certificateId) => openBlobInTab(`/certificates/${certificateId}/pdf`),

  importPreview: (eventId, file, sourceType = 'cme_website') => {
    const form = new FormData()
    form.append('event_id', eventId)
    form.append('source_type', sourceType)
    form.append('file', file)
    return request('/import/preview', { method: 'POST', body: form })
  },
  importCommit: (data) => request('/import/commit', { method: 'POST', body: data }),
  importBatches: () => request('/import/batches'),
  downloadTemplate: async () => saveBlob(await blob('/import/template'), 'cme_import_template.xlsx'),

  attendanceReportRows: (eventId) => request(`/reports/attendance/rows${eventId ? `?event_id=${eventId}` : ''}`),
  downloadAttendanceReport: (eventId) =>
    download(`/reports/attendance${eventId ? `?event_id=${eventId}` : ''}`, `attendance_report_${today()}.xlsx`),
=======
const API_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`

let token = sessionStorage.getItem('cme_token') || null
let unauthorizedHandler = null

export function setToken(newToken) {
  token = newToken
  if (newToken) sessionStorage.setItem('cme_token', newToken)
  else sessionStorage.removeItem('cme_token')
}

export function getToken() {
  return token
}

export function onUnauthorized(handler) {
  unauthorizedHandler = handler
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${API_URL}${path}`, { ...options, headers })

  if (res.status === 401) {
    setToken(null)
    unauthorizedHandler?.()
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const detail = body.detail
    throw new Error(
      Array.isArray(detail)
        ? detail.map((d) => d.msg).join(', ')
        : detail || `Request failed (${res.status})`,
    )
  }
  return res.status === 204 ? null : res.json()
}

export const api = {
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),

  listEvents: () => request('/events'),
  getEvent: (eventId) => request(`/events/${eventId}`),
  createEvent: (data) =>
    request('/events', { method: 'POST', body: JSON.stringify(data) }),
  closeEvent: (eventId) => request(`/events/${eventId}/close`, { method: 'POST' }),
  updateEvent: (eventId, data) =>
    request(`/events/${eventId}`, { method: 'PATCH', body: JSON.stringify(data) }),

  listEventRegistrations: (eventId) => request(`/registrations/by-event/${eventId}`),

  listParticipants: () => request('/participants'),
  createParticipant: (data) =>
    request('/participants', { method: 'POST', body: JSON.stringify(data) }),
  updateParticipant: (participantId, data) =>
    request(`/participants/${participantId}`, { method: 'PATCH', body: JSON.stringify(data) }),

  createRegistration: (data) =>
    request('/registrations', { method: 'POST', body: JSON.stringify(data) }),
  searchRegistrations: (eventId, q) =>
    request(
      `/registrations/search?event_id=${encodeURIComponent(eventId)}&q=${encodeURIComponent(q)}`,
    ),

  signIn: (data) =>
    request('/attendance/sign-in', { method: 'POST', body: JSON.stringify(data) }),
  signOut: (attendanceId, data) =>
    request(`/attendance/${attendanceId}/sign-out`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  issueCertificate: (registrationId) =>
    request('/certificates/issue', {
      method: 'POST',
      body: JSON.stringify({ registration_id: registrationId }),
    }),
  downloadCertificate: async (certificateId) => {
    const headers = token ? { Authorization: `Bearer ${token}` } : {}
    const res = await fetch(`${API_URL}/certificates/${certificateId}/pdf`, { headers })
    if (!res.ok) throw new Error(`Download failed (${res.status})`)
    return res.blob()
  },

  downloadAttendanceReport: async (eventId) => {
    const headers = token ? { Authorization: `Bearer ${token}` } : {}
    const qs = eventId ? `?event_id=${encodeURIComponent(eventId)}` : ''
    const res = await fetch(`${API_URL}/reports/attendance${qs}`, { headers })
    if (!res.ok) throw new Error(`Download failed (${res.status})`)
    return res.blob()
  },

  downloadObserverSheet: async (eventId) => {
    const headers = token ? { Authorization: `Bearer ${token}` } : {}
    const res = await fetch(`${API_URL}/observer-sheet/${eventId}`, { headers })
    if (!res.ok) throw new Error(`Download failed (${res.status})`)
    return res.blob()
  },

  listImportBatches: () => request('/import/batches'),
  downloadImportTemplate: async () => {
    const headers = token ? { Authorization: `Bearer ${token}` } : {}
    const res = await fetch(`${API_URL}/import/template`, { headers })
    if (!res.ok) throw new Error(`Download failed (${res.status})`)
    return res.blob()
  },
  importParticipants: async (eventId, sourceType, file) => {
    const formData = new FormData()
    formData.append('event_id', eventId)
    formData.append('source_type', sourceType)
    formData.append('file', file)

    const headers = token ? { Authorization: `Bearer ${token}` } : {}
    const res = await fetch(`${API_URL}/import/participants`, {
      method: 'POST',
      headers,
      body: formData,
    })
    if (res.status === 401) {
      setToken(null)
      unauthorizedHandler?.()
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.detail || `Import failed (${res.status})`)
    }
    return res.json()
  },
>>>>>>> f6417903ef485a178711941303c1c7bbbf4c6de5
}
