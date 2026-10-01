import { useEffect, useId, useRef } from 'react'

// Shared shell for the dialogs: backdrop click + Esc close (asking first when `dirty`), body scroll lock,
// focus moved in on open and given back on close.
export default function Modal({ title, subtitle, onClose, children, size = 'max-w-2xl', footer, dirty = false }) {
  const titleId = useId()
  const box = useRef(null)
  const close = useRef(null)
  close.current = () => (!dirty || confirm('Discard your changes?')) && onClose()

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && close.current()
    const prev = document.body.style.overflow
    const opener = document.activeElement
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    const first = box.current?.querySelector('input:not([type=hidden]):not(:disabled), select, textarea')
    ;(first || box.current)?.focus()
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      opener?.focus?.()
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-gray-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && close.current()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={box}
        tabIndex={-1}
        className={`animate-pop-in flex max-h-[92dvh] outline-none w-full ${size} flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl dark:bg-night-card`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4 sm:px-6 dark:border-white/10">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold">{title}</h2>
            {subtitle && <div className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{subtitle}</div>}
          </div>
          <button type="button" onClick={() => close.current()} className="btn-ghost -mr-2 min-w-11 px-2 text-xl" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 px-5 py-4 sm:px-6 dark:border-white/10">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

export function ErrorNote({ children }) {
  if (!children) return null
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-300">
      {children}
    </div>
  )
}

// Shows a red * when the wrapped input is required (or when `required` is passed explicitly).
export function Field({ label, children, className = '', required }) {
  const isRequired = required ?? !!children?.props?.required
  return (
    <label className={`block ${className}`}>
      <span className="label">
        {label}
        {isRequired && <span className="ml-0.5 text-red-500" aria-hidden="true">*</span>}
      </span>
      {children}
    </label>
  )
}
