'use client'

import { Menu, X } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface MobileDocsItem {
  href: string
  label: string
}

interface MobileDocsGroup {
  id: string
  label: string
  items: MobileDocsItem[]
}

interface DocsMobileNavigationProps {
  groups: MobileDocsGroup[]
}

export function DocsMobileNavigation({ groups }: DocsMobileNavigationProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const dialogId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    if (!open) return
    dialogRef.current?.querySelector<HTMLElement>('button')?.focus()
  }, [open])

  const close = () => {
    setOpen(false)
    triggerRef.current?.focus()
  }

  const onDialogKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }
    if (event.key !== 'Tab') return
    const focusable =
      dialogRef.current?.querySelectorAll<HTMLElement>('button, a[href]')
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
    <div className="docs-mobile-navigation">
      <button
        aria-controls={dialogId}
        aria-expanded={open}
        className="docs-mobile-trigger"
        onClick={() => setOpen(true)}
        ref={triggerRef}
        type="button"
      >
        <Menu aria-hidden="true" size={18} />
        Browse documentation
      </button>
      {open
        ? createPortal(
            <div className="docs-navigation-layer">
              <button
                aria-label="Close documentation navigation"
                className="navigation-backdrop"
                onClick={close}
                tabIndex={-1}
                type="button"
              />
              <div
                aria-label="Documentation navigation"
                aria-modal="true"
                className="docs-navigation-sheet"
                id={dialogId}
                onKeyDown={onDialogKeyDown}
                ref={dialogRef}
                role="dialog"
              >
                <div className="navigation-sheet__header">
                  <span className="technical-label">DOCUMENTATION</span>
                  <button
                    aria-label="Close documentation navigation"
                    className="icon-button"
                    onClick={close}
                    type="button"
                  >
                    <X aria-hidden="true" size={21} />
                  </button>
                </div>
                {groups.map((group) => (
                  <section key={group.id}>
                    <p>{group.label}</p>
                    {group.items.map((item) => (
                      <Link href={item.href as Route} key={item.href}>
                        {item.label}
                      </Link>
                    ))}
                  </section>
                ))}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  )
}
