import Link from 'next/link'

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__identity">
        <span aria-hidden="true" className="site-footer__mark" />
        <div>
          <p className="technical-label">Asyra Framework</p>
          <p>
            Deterministic infrastructure for domain-owned information products.
          </p>
        </div>
      </div>
      <nav aria-label="Footer navigation">
        <Link href="/docs">Documentation</Link>
        <Link href="/releases">Releases</Link>
        <Link href="/docs/reference/support-release">Support policy</Link>
        <Link href="/roadmap">Current and future boundaries</Link>
      </nav>
      <p className="site-footer__orientation">
        Built for <strong>Visual + machine</strong>
        <span aria-hidden="true" className="site-footer__matrix" />
      </p>
    </footer>
  )
}
