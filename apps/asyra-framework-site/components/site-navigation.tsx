'use client'

import { Menu, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'

interface NavigationItem {
  href: string
  label: string
}

interface SiteNavigationProps {
  items: readonly NavigationItem[]
}

export function SiteNavigation({ items }: SiteNavigationProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const dialogId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return

    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }
    document.body.dataset.navigationOpen = 'true'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      delete document.body.dataset.navigationOpen
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const closeAndRestoreFocus = () => {
    setOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <>
      <nav className="desktop-navigation" aria-label="Primary navigation">
        {items.map((item) => (
          <Link
            aria-current={pathname === item.href ? 'page' : undefined}
            href={item.href}
            key={item.href}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <button
        aria-controls={dialogId}
        aria-expanded={open}
        aria-label="Open navigation"
        className="navigation-trigger"
        onClick={() => setOpen(true)}
        ref={triggerRef}
        type="button"
      >
        <Menu aria-hidden="true" size={20} strokeWidth={1.8} />
        <span>Menu</span>
      </button>
      {open ? (
        <div className="navigation-layer" role="presentation">
          <button
            aria-label="Close navigation"
            className="navigation-backdrop"
            onClick={closeAndRestoreFocus}
            tabIndex={-1}
            type="button"
          />
          <div
            aria-label="Primary navigation"
            aria-modal="true"
            className="navigation-sheet"
            id={dialogId}
            role="dialog"
          >
            <div className="navigation-sheet__header">
              <span className="technical-label">SITE INDEX</span>
              <button
                aria-label="Close navigation"
                className="icon-button"
                onClick={closeAndRestoreFocus}
                ref={closeRef}
                type="button"
              >
                <X aria-hidden="true" size={22} strokeWidth={1.8} />
              </button>
            </div>
            <nav aria-label="Mobile primary navigation">
              {items.map((item, index) => (
                <Link
                  aria-current={pathname === item.href ? 'page' : undefined}
                  href={item.href}
                  key={item.href}
                >
                  <span aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      ) : null}
    </>
  )
}
