import Link from 'next/link'

export function SiteFooter() {
  return (
    <footer className="site-frame-footer">
      <div>
        <Link className="site-frame-wordmark" href="/">
          ASYRA
        </Link>
        <p>Composable infrastructure for tools built around your domain.</p>
      </div>
      <nav aria-label="Footer navigation">
        <Link href="/docs">Docs</Link>
        <Link href="/asyra-design">Asyra Design</Link>
        <Link href="/releases">Releases</Link>
        <Link href="/roadmap">Roadmap</Link>
        <a href="https://github.com/karote00/asyra">GitHub</a>
      </nav>
      <p className="site-frame-footer__identity">
        <span>2026</span>
        <a href="https://github.com/karote00/asyra/blob/main/LICENSE">
          MIT License
        </a>
      </p>
    </footer>
  )
}
