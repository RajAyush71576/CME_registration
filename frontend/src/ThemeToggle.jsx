import { useTheme } from './ThemeContext'

export default function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`rounded-md p-1.5 text-sm text-gray-500 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-white/5 ${className}`}
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  )
}
