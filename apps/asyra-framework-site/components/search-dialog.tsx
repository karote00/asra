'use client'

import { Search, X } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { SearchRecord } from '@/lib/content'

interface SearchDialogProps {
  records: SearchRecord[]
}

export function SearchDialog({ records }: SearchDialogProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const dialogId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('en-US')
    if (!normalized)
      return records.filter(({ kind }) => kind === 'page').slice(0, 8)
    return records
      .filter((record) =>
        [record.title, record.description, record.section]
          .join(' ')
          .toLocaleLowerCase('en-US')
          .includes(normalized)
      )
      .slice(0, 12)
  }, [query, records])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
  }, [open])

  const close = () => {
    setOpen(false)
    setQuery('')
    triggerRef.current?.focus()
  }

  const onDialogKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }
    if (event.key !== 'Tab') return
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button, input, a[href]'
    )
    if (!focusable?.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <>
      <button
        aria-controls={dialogId}
        aria-expanded={open}
        className="search-trigger"
        onClick={() => setOpen(true)}
        ref={triggerRef}
        type="button"
      >
        <Search aria-hidden="true" size={16} />
        Search docs
        <kbd>⌘ K</kbd>
      </button>
      {open ? (
        <div className="search-layer">
          <button
            aria-label="Close search"
            className="navigation-backdrop"
            onClick={close}
            tabIndex={-1}
            type="button"
          />
          <div
            aria-label="Search documentation"
            aria-modal="true"
            className="search-dialog"
            id={dialogId}
            onKeyDown={onDialogKeyDown}
            ref={dialogRef}
            role="dialog"
          >
            <div className="search-input-row">
              <Search aria-hidden="true" size={19} />
              <input
                aria-label="Search documentation"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search concepts, packages, and actions"
                ref={inputRef}
                type="search"
                value={query}
              />
              <button aria-label="Close search" onClick={close} type="button">
                <X aria-hidden="true" size={20} />
              </button>
            </div>
            <p aria-live="polite" className="search-count">
              {results.length} {results.length === 1 ? 'result' : 'results'}
            </p>
            <div className="search-results">
              {results.map((record) => (
                <Link
                  href={record.href as Route}
                  key={record.id}
                  onClick={close}
                >
                  <span>{record.section}</span>
                  <strong>{record.title}</strong>
                  <small>{record.description}</small>
                </Link>
              ))}
              {results.length === 0 ? (
                <p className="search-empty">
                  No matching page or heading. Try a package name or product
                  action.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
