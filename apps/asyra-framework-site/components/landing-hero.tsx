import Link from 'next/link'
import { ArrowDownRight, ArrowRight } from 'lucide-react'
import type { ReleaseCandidate } from '@/lib/content'

interface LandingHeroProps {
  release: ReleaseCandidate
}

export function LandingHero({ release }: LandingHeroProps) {
  return (
    <section aria-labelledby="landing-title" className="landing-hero">
      <div aria-hidden="true" className="landing-hero__registration">
        <span>00 / Public working sheet</span>
        <span>Outcome before machinery</span>
      </div>

      <div className="landing-hero__layout">
        <div className="landing-hero__message">
          <p className="section-eyebrow">
            Infrastructure for domain-owned information
          </p>
          <h1 id="landing-title">Build the model your world needs.</h1>
          <p className="landing-hero__lead">
            You define the knowledge and rules. Asyra gives your product a
            predictable path from intent to outcome.
          </p>
          <p className="landing-hero__promise">
            <strong>You own the meaning.</strong>
            <span>Asyra makes it operable.</span>
          </p>

          <nav aria-label="Start with Asyra" className="landing-hero__actions">
            <Link
              className="landing-action landing-action--primary"
              href="/docs/start/create-design-app"
            >
              <span>Start with a working product</span>
              <ArrowRight aria-hidden="true" size={18} />
            </Link>
            <Link className="landing-action" href="/atlas">
              <span>See how Asyra works</span>
              <ArrowDownRight aria-hidden="true" size={18} />
            </Link>
            <Link className="landing-action" href="/docs">
              <span>Read documentation</span>
              <ArrowRight aria-hidden="true" size={18} />
            </Link>
          </nav>

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
            <span>Canonical</span>
            <strong>information</strong>
          </div>

          <ol
            aria-label="App-owned product possibilities around canonical information"
            className="landing-hero__domain-list"
          >
            <li data-domain="bim">
              <span>01</span>
              <strong>BIM</strong>
            </li>
            <li data-domain="whiteboard">
              <span>02</span>
              <strong>Whiteboard</strong>
            </li>
            <li data-domain="vr">
              <span>03</span>
              <strong>VR</strong>
            </li>
            <li data-domain="design">
              <span>04</span>
              <strong>Design</strong>
            </li>
            <li data-domain="simulation">
              <span>05</span>
              <strong>Simulation</strong>
            </li>
            <li data-domain="ai-model">
              <span>06</span>
              <strong>AI model</strong>
            </li>
          </ol>

          <figcaption>
            Your domain supplies the rules. Each product remains App-owned.
          </figcaption>
        </figure>
      </div>
    </section>
  )
}
