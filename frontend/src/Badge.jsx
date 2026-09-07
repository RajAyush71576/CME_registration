const TONES = {
  green: 'bg-green-100 text-green-700',
  gray: 'bg-gray-200 text-gray-600',
  blue: 'bg-blue-100 text-blue-700',
  red: 'bg-red-100 text-red-700',
}

export default function Badge({ children, tone = 'gray' }) {
  return (
    <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}>
      {children}
    </span>
  )
}
