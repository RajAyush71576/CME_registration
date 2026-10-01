import { useEffect, useState } from 'react'

export default function FullscreenToggle({ className = '' }) {
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement))

  useEffect(() => {
    const handleChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', handleChange)
    return () => document.removeEventListener('fullscreenchange', handleChange)
  }, [])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      document.documentElement.requestFullscreen()
    }
  }

  return (
    <button
      type="button"
      onClick={toggleFullscreen}
      aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
      title={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
      className={`rounded-md p-1.5 text-lg text-gray-500 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-white/5 ${className}`}
    >
      {isFullscreen ? '⤡' : '⤢'}
    </button>
  )
}
