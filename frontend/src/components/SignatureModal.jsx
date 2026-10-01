import { useCallback, useEffect, useRef, useState } from 'react'
import { ErrorNote } from './Modal'

// A tap or tiny flick isn't a signature: need this much ink (CSS px of path) before Confirm unlocks.
const MIN_INK = 40

const penWidth = (pt) => 1.5 + pt.p * 3

// Dot at the start, quadratic curves through midpoints, then the last half-segment to the final point.
function drawStroke(ctx, pts) {
  const [first] = pts
  ctx.beginPath()
  ctx.arc(first.x, first.y, penWidth(first) / 2, 0, Math.PI * 2)
  ctx.fill()
  for (let i = 2; i < pts.length; i++) drawSegment(ctx, pts[i - 2], pts[i - 1], pts[i])
  if (pts.length > 1) drawTail(ctx, pts)
}
function drawSegment(ctx, p0, p1, p2) {
  ctx.lineWidth = penWidth(p1)
  ctx.beginPath()
  ctx.moveTo((p0.x + p1.x) / 2, (p0.y + p1.y) / 2)
  ctx.quadraticCurveTo(p1.x, p1.y, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2)
  ctx.stroke()
}
function drawTail(ctx, pts) {
  const [p1, p2] = pts.slice(-2)
  ctx.lineWidth = penWidth(p2)
  ctx.beginPath()
  ctx.moveTo(pts.length > 2 ? (p1.x + p2.x) / 2 : p1.x, pts.length > 2 ? (p1.y + p2.y) / 2 : p1.y)
  ctx.lineTo(p2.x, p2.y)
  ctx.stroke()
}

const ACCENTS = {
  brand: { bar: 'bg-brand-700', btn: 'bg-brand-700 hover:bg-brand-800', ring: 'border-brand-300 dark:border-brand-500/40', ink: '#551560' },
  blue: { bar: 'bg-sky-600', btn: 'bg-sky-600 hover:bg-sky-700', ring: 'border-sky-300 dark:border-sky-500/40', ink: '#0c4a6e' },
}

export default function SignatureModal({ title, participant, accent = 'brand', onCancel, onConfirm }) {
  const a = ACCENTS[accent]
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const points = useRef([]) // the stroke being drawn
  const strokes = useRef([]) // finished strokes, kept so a resize/rotation can redraw them
  const ink = useRef(0)
  const activePointer = useRef(null)
  const size = useRef(null)
  const [signed, setSigned] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [portrait, setPortrait] = useState(false)
  const cancelRef = useRef(onCancel)
  cancelRef.current = onCancel

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const dpr = window.devicePixelRatio || 1
    const { width, height } = wrap.getBoundingClientRect()
    setPortrait(window.innerHeight > window.innerWidth && window.innerWidth < 768)
    const prev = size.current
    if (prev && prev.width === width && prev.height === height && prev.dpr === dpr) return // e.g. toolbar show/hide
    size.current = { width, height, dpr }
    // Keep the signature: scale finished strokes to the new box (resizing a canvas wipes its bitmap).
    const k = prev ? Math.min(width / prev.width, height / prev.height) : 1
    strokes.current = strokes.current.map((st) => st.map((pt) => ({ ...pt, x: pt.x * k, y: pt.y * k })))
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = a.ink
    ctx.fillStyle = a.ink
    strokes.current.forEach((st) => drawStroke(ctx, st))
  }, [a.ink])

  useEffect(() => {
    setupCanvas()
    const onResize = () => setupCanvas()
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation() // don't also close the modal underneath
        cancelRef.current()
      }
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [setupCanvas])

  const pos = (e) => {
    const r = canvasRef.current.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top, p: e.pressure || 0.5 }
  }

  const down = (e) => {
    e.preventDefault()
    // One pen at a time: a resting palm or second finger is ignored until this stroke ends.
    if (activePointer.current !== null) return
    activePointer.current = e.pointerId
    canvasRef.current.setPointerCapture(e.pointerId)
    const pt = pos(e)
    points.current = [pt]
    const ctx = canvasRef.current.getContext('2d')
    ctx.beginPath()
    ctx.arc(pt.x, pt.y, penWidth(pt) / 2, 0, Math.PI * 2)
    ctx.fill()
  }

  const move = (e) => {
    if (e.pointerId !== activePointer.current || !points.current.length) return
    const pts = points.current
    const pt = pos(e)
    const last = pts[pts.length - 1]
    ink.current += Math.hypot(pt.x - last.x, pt.y - last.y)
    pts.push(pt)
    if (ink.current >= MIN_INK) setSigned(true)
    if (pts.length < 3) return
    drawSegment(canvasRef.current.getContext('2d'), ...pts.slice(-3))
  }

  const up = (e) => {
    if (e.pointerId !== activePointer.current) return
    activePointer.current = null
    const pts = points.current
    if (pts.length > 1) drawTail(canvasRef.current.getContext('2d'), pts)
    if (pts.length) strokes.current.push(pts)
    points.current = []
  }

  const clear = () => {
    const c = canvasRef.current
    c.getContext('2d').clearRect(0, 0, c.width, c.height)
    strokes.current = []
    ink.current = 0
    setSigned(false)
  }

  const confirm = async () => {
    setBusy(true)
    setError('')
    try {
      await onConfirm(canvasRef.current.toDataURL('image/png'))
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  const facts = [
    ['Type', participant.participant_type],
    ['Designation', participant.designation],
    ['Phone', participant.phone],
    ['Place of work', participant.place_of_work],
  ]

  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 flex flex-col bg-gray-50 dark:bg-night-bg">
      <div className={`h-1.5 w-full ${a.bar}`} />
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-3 overflow-hidden p-3 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400">{title}</h2>
            <div className="text-2xl font-bold tracking-tight">{participant.name}</div>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
            {facts.map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-xs text-gray-500 dark:text-gray-400">{k}</dt>
                <dd className="truncate font-medium" title={v}>{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {portrait && (
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
            Tip: rotate your device to landscape for more room to sign.
          </div>
        )}

        <div ref={wrapRef} className={`relative min-h-48 flex-1 touch-none overflow-hidden rounded-2xl border-2 border-dashed bg-white dark:bg-white ${a.ring}`}>
          {!signed && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-lg text-gray-400 select-none">
              Sign here with your finger or stylus
            </div>
          )}
          <div className="pointer-events-none absolute right-8 bottom-10 left-8 border-b border-gray-300" />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 touch-none"
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
          />
        </div>

        <ErrorNote>{error}</ErrorNote>
        <div className="flex flex-wrap items-center gap-2 pb-[env(safe-area-inset-bottom)]">
          <button type="button" className="btn-ghost min-h-12" onClick={clear} disabled={!signed || busy}>Clear signature</button>
          <div className="ml-auto flex gap-2">
            <button type="button" className="btn-secondary min-h-12 px-6" onClick={onCancel} disabled={busy}>Cancel</button>
            <button type="button" className={`btn min-h-12 px-8 text-base text-white ${a.btn}`} onClick={confirm} disabled={!signed || busy}>
              {busy ? 'Saving…' : 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
