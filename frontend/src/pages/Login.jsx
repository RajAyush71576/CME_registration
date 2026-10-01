import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Logo } from '../components/Layout'
import { ErrorNote, Field } from '../components/Modal'
import { homeFor, useAuth } from '../contexts/AuthContext'
import { ThemeToggle } from '../contexts/ThemeContext'

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={homeFor(user)} replace />

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const u = await login(email.trim(), password)
      navigate(location.state?.from || homeFor(u), { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-[28rem] w-[48rem] -translate-x-1/2 rounded-full bg-brand-300/25 blur-3xl dark:bg-brand-700/20" />
      <ThemeToggle className="absolute top-4 right-4" />
      <div className="card animate-pop-in relative w-full max-w-sm p-7 sm:p-8">
        <div className="mb-7 flex flex-col items-center text-center">
          <Logo size="h-14 w-14 text-2xl" />
          <h1 className="mt-4 text-2xl font-bold tracking-tight">CME Registration</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Log in to continue</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email">
            <input className="input" type="email" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Password">
            <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <ErrorNote>{error}</ErrorNote>
          <button className="btn-primary w-full min-h-12 text-base" disabled={busy}>
            {busy ? 'Logging in…' : 'Log in'}
          </button>
        </form>
      </div>
    </div>
  )
}
