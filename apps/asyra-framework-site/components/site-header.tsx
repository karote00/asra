'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { DialogCloseButton } from '@/components/dialog-close-button'
import { useModalDialog } from '@/components/use-modal-dialog'

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
  const { closeDialog, dialogRef, handleDialogClose, openDialog, triggerRef } =
    useModalDialog()
  const pathname = usePathname()
  const landing = variant === 'landing'

  const navigationLinks = supportingNavigation.map(({ href, label }) => (
    <Link
      aria-current={
        pathname === href || pathname.startsWith(`${href}/`)
          ? 'page'
          : undefined
      }
      href={href}
      key={href}
      onClick={closeDialog}
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
        onClick={openDialog}
        ref={triggerRef}
        type="button"
      >
        <span aria-hidden="true">Menu</span>
      </button>
      <dialog
        aria-labelledby="navigation-title"
        className="navigation-dialog"
        onClose={handleDialogClose}
        ref={dialogRef}
      >
        <div className="navigation-dialog__bar">
          <p id="navigation-title">Navigate Asyra</p>
          <form method="dialog">
            <DialogCloseButton label="Close navigation" onClick={closeDialog} />
          </form>
        </div>
        <nav aria-label="Mobile navigation">
          {navigationLinks}
          <a
            href="https://github.com/karote00/asyra"
            onClick={closeDialog}
            rel="noopener noreferrer"
            target="_blank"
          >
            GitHub
          </a>
        </nav>
      </dialog>
    </header>
  )
}
