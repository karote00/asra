import Link from 'next/link'
import { BrandLogo } from '@/components/brand-logo'
import { SiteNavigation } from '@/components/site-navigation'

export const primaryNavigation = [
  { href: '/docs', label: 'Docs' },
  { href: '/asyra-design', label: 'Asyra Design' },
  { href: '/releases', label: 'Releases' },
  { href: '/roadmap', label: 'Roadmap' },
  { href: '/atlas', label: 'Runtime Atlas' }
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
          <Link
            className="site-header__cta"
            href="/docs/start/create-design-app"
          >
            Explore <span aria-hidden="true">✦</span>
          </Link>
        </div>
      </div>
    </header>
  )
}
