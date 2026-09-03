const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

let token = localStorage.getItem('cme_token') || null
let unauthorizedHandler = null

export function setToken(newToken) {
  token = newToken
  if (newToken) localStorage.setItem('cme_token', newToken)
  else localStorage.removeItem('cme_token')
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
  me: () => request('/auth/me'),

  listEvents: () => request('/events'),
  createEvent: (data) =>
    request('/events', { method: 'POST', body: JSON.stringify(data) }),

  listParticipants: () => request('/participants'),
  createParticipant: (data) =>
    request('/participants', { method: 'POST', body: JSON.stringify(data) }),

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
}
