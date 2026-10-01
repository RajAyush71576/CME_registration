import { useMemo } from 'react'

// What each staff member / admin recorded at this event.
export default function EventStaffCard({ regs }) {
  const activity = useMemo(() => {
    const rows = {}
    const bump = (name, key, role) => {
      if (!name) return
      rows[name] ??= { name, role: null, registered: 0, signedIn: 0, signedOut: 0 }
      rows[name][key]++
      rows[name].role ??= role
    }
    for (const r of regs) {
      bump(r.registered_by_name, 'registered', r.registered_by_role)
      bump(r.attendance?.signed_in_by_name, 'signedIn', r.attendance?.signed_in_by_role)
      bump(r.attendance?.signed_out_by_name, 'signedOut', r.attendance?.signed_out_by_role)
    }
    return Object.values(rows).sort((a, b) => a.name.localeCompare(b.name))
  }, [regs])

  if (activity.length === 0) return null
  const unrecorded = regs.filter((r) => r.attendance && !r.attendance.signed_in_by_name).length

  return (
    <div className="card p-5 sm:p-6">
      <h2 className="text-lg font-bold">Entries by staff &amp; admin</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead className="bg-gray-50 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:bg-white/5 dark:text-gray-400">
            <tr>
              <th className="py-2 pr-4 pl-2">Name</th>
              <th className="py-2 pr-4 text-right">Registered</th>
              <th className="py-2 pr-4 text-right">Signed in</th>
              <th className="py-2 pr-2 text-right">Signed out</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {activity.map((a) => (
              <tr key={a.name}>
                <td className="py-2.5 pr-4 pl-2 font-medium">{a.name} <span className="ml-1 text-xs font-normal text-gray-500 dark:text-gray-400">{a.role === 'admin' ? 'Admin' : 'Staff'}</span></td>
                <td className="py-2.5 pr-4 text-right">{a.registered}</td>
                <td className="py-2.5 pr-4 text-right">{a.signedIn}</td>
                <td className="py-2.5 pr-2 text-right">{a.signedOut}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {unrecorded > 0 && (
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{unrecorded} older attendance {unrecorded === 1 ? 'record predates' : 'records predate'} staff tracking.</p>
        )}
      </div>
    </div>
  )
}
