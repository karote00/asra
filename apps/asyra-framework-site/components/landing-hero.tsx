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
          <p className="section-eyebrow">A framework for your own world</p>
          <h1 id="landing-title">Build what your world needs.</h1>
          <p className="landing-hero__lead">
            You define the knowledge and rules. Asyra gives your product a
            predictable path from intent to outcome.
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

        <div aria-hidden="true" className="landing-hero__instrument">
          <div className="landing-hero__axis landing-hero__axis--horizontal" />
          <div className="landing-hero__axis landing-hero__axis--vertical" />
          <span className="landing-hero__coordinate landing-hero__coordinate--one">
            Intent
          </span>
          <span className="landing-hero__coordinate landing-hero__coordinate--two">
            Rules
          </span>
          <span className="landing-hero__coordinate landing-hero__coordinate--three">
            Outcome
          </span>
          <span className="landing-hero__mark">A</span>
        </div>
      </div>
    </section>
  )
}
