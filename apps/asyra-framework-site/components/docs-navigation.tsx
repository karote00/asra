'use client'

import { useRef } from 'react'

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
            <a
              aria-current={page.id === currentId ? 'page' : undefined}
              href={page.href}
              onClick={onNavigate}
            >
              {page.title}
            </a>
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
  const dialogRef = useRef<HTMLDialogElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  return (
    <>
      <aside className="docs-navigation" aria-label="Documentation sections">
        <NavigationLinks currentId={currentId} sections={sections} />
      </aside>
      <button
        className="docs-navigation-trigger"
        onClick={() => dialogRef.current?.showModal()}
        ref={triggerRef}
        type="button"
      >
        Browse documentation
      </button>
      <dialog
        aria-labelledby="docs-navigation-title"
        className="docs-navigation-dialog"
        onClose={() => triggerRef.current?.focus()}
        ref={dialogRef}
      >
        <div className="docs-navigation-dialog__header">
          <p id="docs-navigation-title">Documentation</p>
          <form method="dialog">
            <button aria-label="Close documentation navigation" type="submit">
              Close
            </button>
          </form>
        </div>
        <nav aria-label="Documentation sections">
          <NavigationLinks
            currentId={currentId}
            onNavigate={() => dialogRef.current?.close()}
            sections={sections}
          />
        </nav>
      </dialog>
    </>
  )
}
