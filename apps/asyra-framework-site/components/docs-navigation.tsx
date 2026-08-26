'use client'

import Link from 'next/link'
import { useLayoutEffect, useRef } from 'react'

import { DialogCloseButton } from '@/components/dialog-close-button'
import { useModalDialog } from '@/components/use-modal-dialog'

const navigationScrollKey = 'asyra-docs-navigation-scroll-top'

interface NavigationPage {
  href: string
  id: string
  title: string
}

interface NavigationSection {
  pages: readonly NavigationPage[]
  title: string
}

function NavigationLinks({
  currentId,
  sections,
  onNavigate
}: {
  currentId: string
  onNavigate?: () => void
  sections: readonly NavigationSection[]
}) {
  return sections.map((section) => (
    <section className="docs-navigation__section" key={section.title}>
      <h2>{section.title}</h2>
      <ul>
        {section.pages.map((page) => (
          <li key={page.id}>
            <Link
              aria-current={page.id === currentId ? 'page' : undefined}
              href={page.href}
              onClick={onNavigate}
            >
              {page.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  ))
}

export function DocsNavigation({
  currentId,
  sections
}: {
  currentId: string
  sections: readonly NavigationSection[]
}) {
  const navigationRef = useRef<HTMLElement>(null)
  const { closeDialog, dialogRef, handleDialogClose, openDialog, triggerRef } =
    useModalDialog()

  useLayoutEffect(() => {
    const savedPosition = window.sessionStorage.getItem(navigationScrollKey)
    if (!savedPosition || !navigationRef.current) return

    const scrollTop = Number.parseFloat(savedPosition)
    if (Number.isFinite(scrollTop)) {
      navigationRef.current.scrollTop = scrollTop
    }
    window.sessionStorage.removeItem(navigationScrollKey)
  }, [currentId])

  const preserveNavigationPosition = () => {
    if (!navigationRef.current) return
    window.sessionStorage.setItem(
      navigationScrollKey,
      navigationRef.current.scrollTop.toString()
    )
  }

  return (
    <>
      <aside
        aria-label="Documentation sections"
        className="docs-navigation"
        ref={navigationRef}
      >
        <NavigationLinks
          currentId={currentId}
          onNavigate={preserveNavigationPosition}
          sections={sections}
        />
      </aside>
      <button
        className="docs-navigation-trigger"
        onClick={openDialog}
        ref={triggerRef}
        type="button"
      >
        Browse documentation
      </button>
      <dialog
        aria-labelledby="docs-navigation-title"
        className="docs-navigation-dialog"
        onClose={handleDialogClose}
        ref={dialogRef}
      >
        <div className="docs-navigation-dialog__header">
          <p id="docs-navigation-title">Documentation</p>
          <form method="dialog">
            <DialogCloseButton
              label="Close documentation navigation"
              onClick={closeDialog}
            />
          </form>
        </div>
        <nav aria-label="Documentation sections">
          <NavigationLinks
            currentId={currentId}
            onNavigate={closeDialog}
            sections={sections}
          />
        </nav>
      </dialog>
    </>
  )
}
