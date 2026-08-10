import Link from 'next/link'
import { ArrowRight, Play } from 'lucide-react'
import type { ReleaseCandidate } from '@/lib/content'

interface LandingHeroProps {
  release: ReleaseCandidate
}

export function LandingHero({ release }: LandingHeroProps) {
  return (
    <section aria-labelledby="landing-title" className="landing-hero">
      <div className="landing-hero__layout">
        <div className="landing-hero__message">
          <h1 id="landing-title">Build worlds from information.</h1>
          <p className="landing-hero__lead">
            From an idea to an <strong>executable model.</strong>
          </p>
          <p className="landing-hero__promise">
            You define the knowledge and rules. Asyra gives your product a
            predictable path from intent to outcome.
          </p>

          <nav aria-label="Start with Asyra" className="landing-hero__actions">
            <Link
              className="landing-action landing-action--primary"
              href="/docs/start/create-design-app"
            >
              <span>
                <strong>Start with a working product</strong>
                <small>Explore a complete product built on Asyra.</small>
              </span>
              <ArrowRight aria-hidden="true" size={18} />
            </Link>
            <Link
              className="landing-action landing-action--compose"
              href="/docs/start/custom-composition"
            >
              <span>
                <strong>Build your own system</strong>
                <small>Compose a product around your domain.</small>
              </span>
              <ArrowRight aria-hidden="true" size={18} />
            </Link>
          </nav>

          <div className="landing-hero__secondary-actions">
            <Link href="/atlas">
              <Play aria-hidden="true" size={15} />
              See how Asyra works
            </Link>
            <Link href="/docs">Read documentation</Link>
          </div>

          <p className="landing-hero__release">
            <span>{release.status}</span>
            <span>{release.family}</span>
            <strong>{release.packageCount} public packages</strong>
            <span>Publication is not implied</span>
          </p>
        </div>

        <figure className="landing-hero__instrument">
          <svg
            aria-hidden="true"
            className="landing-hero__constellation"
            viewBox="0 0 620 600"
          >
            <g className="landing-hero__orbits">
              <circle cx="310" cy="300" r="92" />
              <circle cx="310" cy="300" r="168" />
              <ellipse cx="310" cy="300" rx="244" ry="126" />
              <ellipse
                cx="310"
                cy="300"
                rx="238"
                ry="142"
                transform="rotate(46 310 300)"
              />
            </g>
            <g className="landing-hero__routes">
              <path d="M310 300L310 74" />
              <path d="M310 300L522 174" />
              <path d="M310 300L526 410" />
              <path d="M310 300L310 532" />
              <path d="M310 300L96 414" />
              <path d="M310 300L102 178" />
            </g>
            <g className="landing-hero__route-nodes">
              <circle cx="310" cy="132" r="6" />
              <circle cx="452" cy="216" r="6" />
              <circle cx="456" cy="378" r="6" />
              <circle cx="310" cy="468" r="6" />
              <circle cx="164" cy="382" r="6" />
              <circle cx="164" cy="218" r="6" />
            </g>
            <circle
              className="landing-hero__canonical-disc"
              cx="310"
              cy="300"
              r="76"
            />
            <g className="landing-hero__cube">
              <path d="M310 246L345 266V307L310 328L275 307V266Z" />
              <path d="M275 266L310 287L345 266M310 287V328" />
            </g>
          </svg>

          <div aria-hidden="true" className="landing-hero__canonical-label">
            <span>Asyra</span>
            <strong>Infrastructure</strong>
          </div>

          <ol
            aria-label="App-owned product possibilities around canonical information"
            className="landing-hero__domain-list"
          >
            <li data-domain="bim">
              <span>B</span>
              <strong>BIM</strong>
            </li>
            <li data-domain="whiteboard">
              <span>W</span>
              <strong>Whiteboard</strong>
            </li>
            <li data-domain="vr">
              <span>V</span>
              <strong>VR</strong>
            </li>
            <li data-domain="design">
              <span>D</span>
              <strong>Design</strong>
            </li>
            <li data-domain="simulation">
              <span>4</span>
              <strong>4D</strong>
            </li>
            <li data-domain="ai-model">
              <span>AI</span>
              <strong>AI</strong>
            </li>
          </ol>

          <figcaption>
            Canonical information becomes many App-owned products.
          </figcaption>
        </figure>
      </div>
    </section>
  )
}
