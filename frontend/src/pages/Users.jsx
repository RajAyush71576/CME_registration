import { useEffect, useState } from 'react'
import { api } from '../api'
import Badge from '../components/Badge'
import Modal, { ErrorNote, Field } from '../components/Modal'
import { useAuth } from '../contexts/AuthContext'
import { EMAIL_HINT, EMAIL_PATTERN, isEmail } from '../utils'

function UserModal({ user, isSelf, onClose, onSaved }) {
  const editing = !!user
  const [initial] = useState(() => ({
    name: user?.name || '', email: user?.email || '', password: '', role: user?.role || 'staff',
    is_active: user?.is_active ?? true,
  }))
  const [form, setForm] = useState(initial)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [emailTouched, setEmailTouched] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const { password, ...rest } = form
      const body = editing ? { ...rest, ...(password ? { password } : {}) } : form
      await (editing ? api.updateUser(user.user_id, body) : api.createUser(body))
      onSaved()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Modal
      title={editing ? `Edit ${user.name}` : 'New user'}
      subtitle={editing ? user.email : 'Staff accounts sign participants in and out on the tablets.'}
      onClose={onClose}
      dirty={JSON.stringify(form) !== JSON.stringify(initial)}
      size="max-w-lg"
      footer={<>
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button form="user-form" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create user'}</button>
      </>}
    >
      <form id="user-form" onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Full name" className="sm:col-span-2">
          <input className="input" required maxLength={200} autoComplete="off" value={form.name} onChange={set('name')} placeholder="Priya Menon" />
        </Field>
        <Field label="Email (used to log in)" className="sm:col-span-2" required>
          <input className="input" type="email" required maxLength={255} autoComplete="off" pattern={EMAIL_PATTERN} title={EMAIL_HINT} placeholder="name@gmail.com"
            value={form.email} onChange={set('email')} onBlur={() => setEmailTouched(true)} />
          {emailTouched && form.email && !isEmail(form.email) && <span className="mt-1 block text-xs text-red-600 dark:text-red-400">{EMAIL_HINT}</span>}
        </Field>
        <div>
          <Field label={editing ? 'New password (leave blank to keep)' : 'Password'} required={!editing}>
            <input className="input" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} maxLength={72}
              pattern=".*\S.*" title="Use at least 8 characters, not only spaces"
              required={!editing} value={form.password} onChange={set('password')} placeholder="At least 8 characters" />
          </Field>
          <label className="mt-1 inline-flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-gray-600 dark:text-gray-300">
            <input type="checkbox" className="h-5 w-5 accent-brand-700" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
            Show password
          </label>
        </div>
        <Field label="Role">
          <select className="input" value={form.role} onChange={set('role')} disabled={isSelf}>
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>
        </Field>
        {editing && !isSelf && (
          <label className="flex min-h-11 cursor-pointer items-center gap-3 sm:col-span-2">
            <input type="checkbox" className="h-5 w-5 accent-brand-700" checked={form.is_active} onChange={set('is_active')} />
            <span>
              <span className="font-semibold">Account active</span>
              <span className="block text-sm text-gray-500 dark:text-gray-400">Deactivated users can't log in. Their past entries are kept.</span>
            </span>
          </label>
        )}
        {form.role === 'admin' && !isSelf && (
          <p className="text-sm text-amber-700 sm:col-span-2 dark:text-amber-300">Admins can manage every event, user and report.</p>
        )}
        <div className="sm:col-span-2"><ErrorNote>{error}</ErrorNote></div>
      </form>
    </Modal>
  )
}

export default function Users() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null) // user object, or 'new'

  const load = () => api.users().then(setUsers).catch((e) => setError(e.message))
  useEffect(() => { load() }, [])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users {users && <span className="text-gray-500 dark:text-gray-400">({users.length})</span>}</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Create accounts for the people working the tablets. Every staff account can work every event.</p>
        </div>
        <button className="btn-primary" onClick={() => setEditing('new')}>+ New user</button>
      </div>
      <ErrorNote>{error}</ErrorNote>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-gray-50 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:bg-white/5 dark:text-gray-400">
            <tr>{['Name', 'Email', 'Role', 'Status', ''].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {users?.map((u) => (
              <tr key={u.user_id} className={u.is_active ? '' : 'opacity-60'}>
                <td className="px-4 py-3 font-semibold">{u.name}{u.user_id === me.user_id && <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">(you)</span>}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{u.email}</td>
                <td className="px-4 py-3"><Badge tone={u.role === 'admin' ? 'brand' : 'blue'}>{u.role === 'admin' ? 'Admin' : 'Staff'}</Badge></td>
                <td className="px-4 py-3"><Badge tone={u.is_active ? 'green' : 'gray'}>{u.is_active ? 'Active' : 'Deactivated'}</Badge></td>
                <td className="px-4 py-3 text-right"><button className="btn-secondary min-h-11 py-1" onClick={() => setEditing(u)} aria-label={`Edit ${u.name}`}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <UserModal
          user={editing === 'new' ? null : editing}
          isSelf={editing !== 'new' && editing.user_id === me.user_id}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}
    </div>
  )
}
