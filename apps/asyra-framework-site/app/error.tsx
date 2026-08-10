'use client'

import { RotateCcw } from 'lucide-react'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <div className="foundation-status" role="alert">
      <div aria-hidden="true" className="foundation-status__coordinate">
        CONTENT / UNAVAILABLE
      </div>
      <p className="section-eyebrow">
        The requested public surface did not resolve
      </p>
      <h1>Verified content could not be presented.</h1>
      <div className="foundation-status__message">
        <p>
          No fallback copy, release fact, or product output was fabricated.
          Retry the same verified route or return to the documentation index.
        </p>
        {error.digest ? <code>Failure reference: {error.digest}</code> : null}
      </div>
      <button className="primary-action" onClick={reset} type="button">
        Retry this route
        <RotateCcw aria-hidden="true" size={17} />
      </button>
    </div>
  )
}
