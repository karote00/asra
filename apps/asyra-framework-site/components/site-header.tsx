'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRef } from 'react'

type SiteHeaderProps = Readonly<{
  variant?: 'landing' | 'supporting'
}>

const supportingNavigation = [
  { href: '/docs', label: 'Docs' },
  { href: '/atlas', label: 'Runtime Atlas' },
  { href: '/asyra-design', label: 'Asyra Design' },
  { href: '/releases', label: 'Releases' },
  { href: '/roadmap', label: 'Roadmap' }
] as const

export function SiteHeader({ variant = 'supporting' }: SiteHeaderProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const pathname = usePathname()
  const landing = variant === 'landing'

  const closeNavigation = () => dialogRef.current?.close()
  const openNavigation = () => dialogRef.current?.showModal()

  const navigationLinks = supportingNavigation.map(({ href, label }) => (
    <Link
      aria-current={
        pathname === href || pathname.startsWith(`${href}/`)
          ? 'page'
          : undefined
      }
      href={href}
      key={href}
      onClick={closeNavigation}
    >
      {label}
    </Link>
  ))

  return (
    <header className={landing ? 'site-header' : 'site-frame-header'}>
      <Link
        aria-label="Asyra home"
        className={landing ? 'wordmark' : 'site-frame-wordmark'}
        href={landing ? '#top' : '/'}
      >
        ASYRA
      </Link>
      <nav
        aria-label="Primary navigation"
        className={landing ? 'primary-nav' : 'site-frame-navigation'}
      >
        {navigationLinks}
      </nav>
      <button
        aria-label="Open navigation"
        className="navigation-trigger"
        onClick={openNavigation}
        ref={menuButtonRef}
        type="button"
      >
        <span aria-hidden="true">Menu</span>
      </button>
      <dialog
        aria-labelledby="navigation-title"
        className="navigation-dialog"
        onClose={() => menuButtonRef.current?.focus()}
        ref={dialogRef}
      >
        <div className="navigation-dialog__bar">
          <p id="navigation-title">Navigate Asyra</p>
          <form method="dialog">
            <button aria-label="Close navigation" type="submit">
              Close
            </button>
          </form>
        </div>
        <nav aria-label="Mobile navigation">{navigationLinks}</nav>
        <a
          className="navigation-dialog__source"
          href="https://github.com/karote00/asyra"
          rel="noopener noreferrer"
          target="_blank"
        >
          View source on GitHub
        </a>
      </dialog>
    </header>
  )
}
