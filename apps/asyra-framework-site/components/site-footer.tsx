import Link from 'next/link'

const navigation = [
  { href: '/docs', label: 'Docs' },
  { href: '/atlas', label: 'Runtime Atlas' },
  { href: '/asyra-design', label: 'Asyra Design' },
  { href: '/releases', label: 'Releases' },
  { href: '/roadmap', label: 'Roadmap' },
  {
    href: 'https://github.com/karote00/asyra',
    label: 'GitHub',
    newTab: true
  }
] as const

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <Link className="wordmark" href="/">
        ASYRA
      </Link>
      <nav aria-label="Footer navigation">
        {navigation.map((item) =>
          'newTab' in item && item.newTab ? (
            <a
              href={item.href}
              key={item.href}
              rel="noopener noreferrer"
              target="_blank"
            >
              {item.label}
            </a>
          ) : (
            <Link href={item.href} key={item.href}>
              {item.label}
            </Link>
          )
        )}
      </nav>
    </footer>
  )
}
