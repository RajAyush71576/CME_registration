import { Link } from 'react-router-dom'

export default function UnauthorizedPage() {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-xl">
        🚫
      </div>
      <h1 className="mb-2 text-lg font-semibold text-gray-900">Not authorized</h1>
      <p className="mb-5 text-sm text-gray-600">
        Your account doesn't have access to this page.
      </p>
      <Link
        to="/"
        className="inline-block rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
      >
        Go home
      </Link>
    </div>
  )
}
