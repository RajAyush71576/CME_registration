import { useEffect, useRef } from 'react'

const PAD_HEIGHT = 260

export default function SignaturePad({ onChange }) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const drawing = useRef(false)
  const last = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const cssWidth = container.offsetWidth

      canvas.width = cssWidth * dpr
      canvas.height = PAD_HEIGHT * dpr
      canvas.style.width = `${cssWidth}px`
      canvas.style.height = `${PAD_HEIGHT}px`
      canvas.getContext('2d').scale(dpr, dpr)
      onChange(null)
    }

    resize()
    window.addEventListener('resize', resize)
    window.addEventListener('orientationchange', resize)
    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('orientationchange', resize)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const point = e.touches ? e.touches[0] : e
    return { x: point.clientX - rect.left, y: point.clientY - rect.top }
  }

  const start = (e) => {
    e.preventDefault()
    drawing.current = true
    last.current = getPos(e)
  }

  const move = (e) => {
    if (!drawing.current) return
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    const pos = getPos(e)
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#111'
    ctx.beginPath()
    ctx.moveTo(last.current.x, last.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    last.current = pos
  }

  const end = () => {
    if (!drawing.current) return
    drawing.current = false
    onChange(canvasRef.current.toDataURL('image/png'))
  }

  const clear = () => {
    const canvas = canvasRef.current
    const dpr = window.devicePixelRatio || 1
    canvas.getContext('2d').clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)
    onChange(null)
  }

  return (
    <div ref={containerRef} className="w-full">
      <canvas
        ref={canvasRef}
        className="w-full touch-none rounded-lg border-2 border-dashed border-gray-300 bg-white dark:border-green-600/60"
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-xs text-gray-400 dark:text-slate-500">Sign above</span>
        <button
          type="button"
          onClick={clear}
          className="text-xs font-medium text-gray-500 underline hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          Clear signature
        </button>
      </div>
    </div>
  )
}
