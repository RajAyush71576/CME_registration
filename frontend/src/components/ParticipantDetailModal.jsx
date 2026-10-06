import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../contexts/AuthContext'
import { ROLE_LABELS, attendanceStatus, credits, fmtDateTime, fmtDuration, fmtTime, nowIST, SOURCE_LABELS } from '../utils'
import Badge from './Badge'
import { ParticipantFields } from './CreateParticipantModal'
import Modal, { ErrorNote } from './Modal'
import SignatureModal from './SignatureModal'

function Section({ title, children }) {
  return (
    <section className="border-t border-gray-100 pt-5 first:border-0 first:pt-0 dark:border-white/10">
      <h3 className="mb-3 text-sm font-bold text-gray-900 dark:text-gray-100">{title}</h3>
      {children}
    </section>
  )
}

function Notice({ tone = 'gray', children }) {
  const tones = {
    gray: 'bg-gray-50 text-gray-600 dark:bg-white/5 dark:text-gray-300',
    blue: 'bg-sky-50 text-sky-800 dark:bg-sky-500/10 dark:text-sky-200',
    green: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200',
    amber: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200',
    red: 'bg-red-50 text-red-800 dark:bg-red-500/10 dark:text-red-200',
  }
  return <div className={`rounded-lg px-3.5 py-3 text-sm ${tones[tone]}`}>{children}</div>
}

const who = (name, role) => (name ? `${name} (${ROLE_LABELS[role] || role})` : 'not recorded')

const useTick = (ms) => {
  const [, setN] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setN((n) => n + 1), ms)
    return () => clearInterval(id)
  }, [ms])
}

export default function ParticipantDetailModal({ reg, event, onClose, onChanged }) {
  useTick(30000) // re-check the sign-in / sign-out gates
  const { user } = useAuth()
  const isAdmin = user.role === 'admin'
  const p = reg.participant
  const att = reg.attendance
  const status = attendanceStatus(reg, event)
  const closed = event.status === 'closed'
  const isFaculty = p.participant_type === 'Faculty'
  const manualStatus = reg.manual_status

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(p)
  const [signing, setSigning] = useState(null) // 'in' | 'out'
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async (fn) => {
    setError('')
    setBusy(true)
    try { await fn() } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  const saveEdit = (e) => {
    e.preventDefault()
    run(async () => {
      const { participant_id, source, created_at, ...changes } = form
      await api.updateParticipant(p.participant_id, changes)
      setEditing(false)
      await onChanged()
    })
  }

  const now = nowIST()
  const isEventDay = now.date === event.event_date
  const opensAt = event.start_time.slice(0, 5)
  const signInOpen = isEventDay && now.time >= opensAt

  const hoursIn = att ? (Date.now() - new Date(att.sign_in_time)) / 3600000 : 0
  const required = Number(event.approx_duration_hours)
  const remaining = required - hoursIn

  // A failed save stays on the signature screen (so it can be retried); once saved, the screen closes and a
  // failed refresh is shown here instead of being lost with the unmounted signature screen.
  const onSigned = async (signature) => {
    if (signing === 'in') await api.signIn(reg.registration_id, signature)
    else await api.signOut(att.attendance_id, signature)
    setSigning(null)
    onChanged()?.catch?.((e) => setError(e.message))
  }

  const markAttendance = (mark) => run(async () => {
    await api.markAttendance(reg.registration_id, mark)
    await onChanged()
  })

  const details = [
    ['Designation', p.designation], ['Speciality', p.speciality || '—'], ['Type', p.participant_type], ['Email', p.email], ['Phone', p.phone],
    ['WhatsApp', p.whatsapp_number || '—'], ['Place of work', p.place_of_work], ['Country', p.country || '—'],
    ['Medical license no.', p.medical_license_no || '—'],
    ['Source', `${SOURCE_LABELS[reg.source] || reg.source}${reg.registered_by_name ? ` · by ${who(reg.registered_by_name, reg.registered_by_role)}` : ''}`],
  ]

  return (
    <>
      <Modal
        title={<span className="flex flex-wrap items-center gap-2">{p.name} <Badge tone={status.tone}>{status.label}</Badge></span>}
        subtitle={[p.designation, p.place_of_work].filter(Boolean).join(' · ')}
        onClose={onClose}
        dirty={editing && JSON.stringify(form) !== JSON.stringify(p)}
      >
        <div className="space-y-5">
          <Section title="Details">
            {editing ? (
              <form onSubmit={saveEdit} className="space-y-4">
                <ParticipantFields form={form} setForm={setForm} licenseRequired={credits(event) > 0} />
                <div className="flex justify-end gap-2">
                  <button type="button" className="btn-secondary" onClick={() => { setEditing(false); setForm(p) }}>Cancel</button>
                  <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
                </div>
              </form>
            ) : (
              <>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                  {details.map(([k, v]) => (
                    <div key={k} className="min-w-0">
                      <dt className="text-xs text-gray-500 dark:text-gray-400">{k}</dt>
                      <dd className="break-words font-medium">{v}</dd>
                    </div>
                  ))}
                </dl>
                {status.key !== 'completed' && (
                  <button className="btn-secondary mt-4" onClick={() => { setForm(p); setEditing(true) }}>Edit details</button>
                )}
              </>
            )}
          </Section>

          <Section title="Attendance">
            {manualStatus ? (
              <div className="space-y-3">
                <Notice tone={manualStatus === 'present' ? 'green' : 'red'}>
                  Marked {manualStatus === 'present' ? 'present' : 'absent'} by <b>{who(reg.manual_status_by_name, reg.manual_status_by_role)}</b> — a manual call, no sign-in/out was recorded.
                </Notice>
                {!closed && (
                  <button className="btn-secondary" disabled={busy} onClick={() => markAttendance(null)}>Undo, allow sign-in instead</button>
                )}
              </div>
            ) : att?.sign_out_time ? (
              <Notice tone="green">
                Attendance complete: {fmtDateTime(att.sign_in_time)} – {fmtDateTime(att.sign_out_time)}
                <span className="mt-1.5 block text-xs">
                  Sign-in signature taken by <b>{who(att.signed_in_by_name, att.signed_in_by_role)}</b>
                  <br />
                  Sign-out signature taken by <b>{who(att.signed_out_by_name, att.signed_out_by_role)}</b>
                </span>
              </Notice>
            ) : att && !event.require_sign_out ? (
              <Notice tone="green">
                Attendance complete: signed in at {fmtDateTime(att.sign_in_time)}
                <span className="mt-1.5 block text-xs">
                  Sign-out isn't required for this event — signature taken by <b>{who(att.signed_in_by_name, att.signed_in_by_role)}</b>
                </span>
              </Notice>
            ) : closed ? (
              <Notice>This event is closed, so attendance can no longer be recorded.</Notice>
            ) : att ? (
              <div className="space-y-3">
                <Notice tone="blue">Signed in at {fmtDateTime(att.sign_in_time)} · signature taken by {who(att.signed_in_by_name, att.signed_in_by_role)}</Notice>
                {remaining > 0 ? (
                  <Notice tone="amber">
                    Sign-out not available yet: {fmtDuration(Math.ceil(remaining * 60) / 60)} remaining to meet the event's approximate duration ({fmtDuration(required)}).
                  </Notice>
                ) : (
                  <button className="btn min-h-14 w-full bg-sky-600 text-base text-white hover:bg-sky-700" onClick={() => setSigning('out')}>
                    Sign out
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {signInOpen ? (
                  <button className="btn-primary min-h-14 w-full text-base" onClick={() => setSigning('in')}>Sign in</button>
                ) : (
                  <Notice>
                    {isEventDay
                      ? `Sign-in opens at ${fmtTime(event.start_time)} today.`
                      : 'Sign-in is only available on the day of the event.'}
                  </Notice>
                )}
                {isFaculty && (
                  <>
                    <div className="flex items-center gap-3 text-xs font-semibold tracking-wide text-gray-400 uppercase dark:text-gray-500">
                      <div className="h-px flex-1 bg-gray-200 dark:bg-white/10" />or mark directly<div className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Sign-in/out is optional for Faculty — mark present or absent instead. Left unmarked, Faculty show as Absent once the event closes.
                    </p>
                    <div className="flex gap-2">
                      <button className="btn min-h-12 flex-1 bg-emerald-600 text-white hover:bg-emerald-700" disabled={busy} onClick={() => markAttendance('present')}>
                        Mark present
                      </button>
                      <button className="btn min-h-12 flex-1 bg-red-600 text-white hover:bg-red-700" disabled={busy} onClick={() => markAttendance('absent')}>
                        Mark absent
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </Section>

          {isAdmin && status.key === 'completed' && (
            <Section title="Certificate">
              {reg.certificate ? (
                <button className="btn-primary" disabled={busy} onClick={() => run(() => api.openCertificate(reg.certificate.certificate_id))}>
                  Download certificate no. {reg.certificate.certificate_no}
                </button>
              ) : (
                <button className="btn-primary" disabled={busy} onClick={() => run(async () => { await api.issueCertificate(reg.registration_id); await onChanged() })}>
                  {busy ? 'Issuing…' : 'Issue certificate'}
                </button>
              )}
            </Section>
          )}

          <ErrorNote>{error}</ErrorNote>
        </div>
      </Modal>

      {signing && (
        <SignatureModal
          title={signing === 'in' ? 'Sign in' : 'Sign out'}
          accent={signing === 'in' ? 'brand' : 'blue'}
          participant={p}
          onCancel={() => setSigning(null)}
          onConfirm={onSigned}
        />
      )}
    </>
  )
}
