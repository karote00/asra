import Link from 'next/link'
import { BrandLogo } from '@/components/brand-logo'
import { SiteHeaderAction } from '@/components/site-header-action'
import { SiteNavigation } from '@/components/site-navigation'

export const primaryNavigation = [
  { href: '/#why-framework', label: 'Why Asyra' },
  { href: '/asyra-design', label: 'Products' },
  { href: '/atlas', label: 'Runtime Atlas' },
  { href: '/docs', label: 'Docs' },
  { href: '/roadmap', label: 'Roadmap' }
] as const

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="wordmark" href="/" aria-label="Asyra home">
          <BrandLogo className="wordmark__logo" />
        </Link>
        <div className="site-header__navigation">
          <SiteNavigation items={primaryNavigation} />
          <SiteHeaderAction />
        </div>
      </div>
    </header>
  )
}
