const TONES = {
  green:
    'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400 dark:ring-1 dark:ring-inset dark:ring-green-500/30',
  gray: 'bg-gray-200 text-gray-600 dark:bg-slate-500/15 dark:text-slate-300 dark:ring-1 dark:ring-inset dark:ring-slate-500/30',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400 dark:ring-1 dark:ring-inset dark:ring-blue-500/30',
  red: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400 dark:ring-1 dark:ring-inset dark:ring-red-500/30',
}

export default function Badge({ children, tone = 'gray' }) {
  return (
    <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}>
      {children}
    </span>
  )
}
