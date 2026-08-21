'use client'

import { useMemo, useRef, useState } from 'react'

export interface SearchRecord {
  description: string
  href: string
  section: string
  title: string
}

export function SearchDialog({
  records
}: {
  records: readonly SearchRecord[]
}) {
  const [query, setQuery] = useState('')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const results = useMemo(() => {
    if (!normalizedQuery) return records.slice(0, 8)
    return records
      .filter(({ description, section, title }) =>
        `${title} ${description} ${section}`
          .toLocaleLowerCase()
          .includes(normalizedQuery)
      )
      .slice(0, 12)
  }, [normalizedQuery, records])

  return (
    <>
      <button
        className="docs-search-trigger"
        onClick={() => dialogRef.current?.showModal()}
        ref={triggerRef}
        type="button"
      >
        Search 41 guides
        <span aria-hidden="true">/</span>
      </button>
      <dialog
        aria-labelledby="search-title"
        className="search-dialog"
        onClose={() => triggerRef.current?.focus()}
        ref={dialogRef}
      >
        <div className="search-dialog__header">
          <div>
            <p className="support-label">Local documentation search</p>
            <h2 id="search-title">Find a guide or concept</h2>
          </div>
          <form method="dialog">
            <button aria-label="Close search" type="submit">
              Close
            </button>
          </form>
        </div>
        <label className="search-field">
          <span>Search</span>
          <input
            autoFocus
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Transactions, rendering, AI actions..."
            type="search"
            value={query}
          />
        </label>
        <p aria-live="polite" className="search-dialog__count">
          {results.length} {results.length === 1 ? 'result' : 'results'}
        </p>
        <div className="search-results">
          {results.map((result) => (
            <a href={result.href} key={`${result.href}-${result.title}`}>
              <span>{result.section}</span>
              <strong>{result.title}</strong>
              <p>{result.description}</p>
            </a>
          ))}
          {results.length === 0 ? (
            <p className="search-empty">
              No matching guide. Try a package name or a broader concept.
            </p>
          ) : null}
        </div>
      </dialog>
    </>
  )
}
