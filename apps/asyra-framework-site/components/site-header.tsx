import Link from 'next/link'
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
          <span aria-hidden="true" className="wordmark__coordinate">
            00.00
          </span>
          <span>Asyra</span>
        </Link>
        <SiteNavigation items={primaryNavigation} />
      </div>
    </header>
  )
}
