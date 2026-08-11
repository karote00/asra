'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function SiteHeaderAction() {
  const pathname = usePathname()

  if (pathname === '/') {
    return (
      <Link className="site-header__cta" href="/docs/start/create-design-app">
        Explore <span aria-hidden="true">→</span>
      </Link>
    )
  }

  return (
    <Link
      aria-label="Explore Asyra"
      className="site-header__utility"
      href="/docs/start/create-design-app"
    >
      <span aria-hidden="true" />
    </Link>
  )
}
