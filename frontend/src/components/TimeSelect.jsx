const pad = (n) => String(n).padStart(2, '0')
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1)
const MINUTES = Array.from({ length: 60 }, (_, i) => pad(i))

// 12-hour picker over a 24-hour "HH:MM" value. Focus a box and type to jump (e.g. "9", "30", "P").
export default function TimeSelect({ value, onChange, className = '' }) {
  const [h24, m] = value.split(':').map(Number)
  const pm = h24 >= 12
  const h12 = h24 % 12 || 12
  const emit = (h, min, isPm) => onChange(`${pad((h % 12) + (isPm ? 12 : 0))}:${pad(min)}`)

  return (
    <span className={`flex gap-2 ${className}`}>
      <select className="input w-auto" value={h12} onChange={(e) => emit(Number(e.target.value), m, pm)} aria-label="Hour">
        {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
      <select className="input w-auto" value={pad(m)} onChange={(e) => emit(h12, Number(e.target.value), pm)} aria-label="Minute">
        {MINUTES.map((mm) => <option key={mm} value={mm}>{mm}</option>)}
      </select>
      <select className="input w-auto" value={pm ? 'PM' : 'AM'} onChange={(e) => emit(h12, m, e.target.value === 'PM')} aria-label="AM or PM">
        <option>AM</option>
        <option>PM</option>
      </select>
    </span>
  )
}
