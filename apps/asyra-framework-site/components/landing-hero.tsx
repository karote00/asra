import Link from 'next/link'
import { ArrowRight, Play } from 'lucide-react'
import type { ReleaseCandidate } from '@/lib/content'
import { GalaxyMap } from '@/components/galaxy-map'

interface LandingHeroProps {
  release: ReleaseCandidate
}

export function LandingHero({ release }: LandingHeroProps) {
  return (
    <section aria-labelledby="landing-title" className="landing-hero">
      <div className="landing-hero__layout">
        <div className="landing-hero__message">
          <h1 id="landing-title">
            <span>Build worlds</span> <span>from information.</span>
          </h1>
          <p className="landing-hero__lead">
            From an idea to an <strong>executable model.</strong>
          </p>
          <p className="landing-hero__promise">
            Asyra is deterministic infrastructure for executable information
            models. You bring domain expertise. We provide the runtime that
            makes it real.
          </p>
        </div>

        <figure
          aria-label="One Asyra infrastructure, many App-owned products"
          className="landing-hero__instrument"
        >
          <GalaxyMap className="landing-galaxy" />
        </figure>

        <div className="landing-hero__action-region">
          <nav aria-label="Start with Asyra" className="landing-hero__actions">
            <Link
              className="landing-action landing-action--primary"
              href="/docs/start/create-design-app"
            >
              <span>Start with a product</span>
              <ArrowRight aria-hidden="true" size={17} />
            </Link>
            <Link
              className="landing-action landing-action--compose"
              href="/docs/start/custom-composition"
            >
              <span>Build your own system</span>
              <ArrowRight aria-hidden="true" size={17} />
            </Link>
          </nav>

          <div className="landing-hero__secondary-actions">
            <Link href="/atlas">
              <Play aria-hidden="true" size={15} />
              See Asyra in 90 seconds
            </Link>
          </div>

          <p className="landing-hero__release">
            <span>{release.status}</span>
            <span>{release.family}</span>
            <strong>{release.packageCount} public packages</strong>
          </p>
        </div>
      </div>
    </section>
  )
}
