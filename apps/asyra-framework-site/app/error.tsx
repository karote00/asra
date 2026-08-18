'use client'

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="simple-state">
      <p className="eyebrow">Something interrupted the page</p>
      <h1>Try the page again.</h1>
      <button className="button button--red" onClick={reset} type="button">
        Try again
      </button>
    </main>
  )
}
