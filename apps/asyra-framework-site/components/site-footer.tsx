import Link from 'next/link'

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div>
        <p className="technical-label">Asyra Framework</p>
        <p>
          Deterministic infrastructure for domain-owned information products.
        </p>
      </div>
      <nav aria-label="Footer navigation">
        <Link href="/docs/reference/support-release">Support policy</Link>
        <Link href="/roadmap">Current and future boundaries</Link>
      </nav>
    </footer>
  )
}
