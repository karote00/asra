import type { Metadata } from 'next'
import { FoundationPageHero } from '@/components/foundation-page-hero'
import { RuntimeAtlas } from '@/components/runtime-atlas'
import { SiteFrame } from '@/components/site-frame'

export const metadata: Metadata = {
  alternates: { canonical: '/atlas' },
  description:
    'Operate six real Asyra Framework runtime cases and inspect intent, transactions, canonical owners, projections, rollback, Collaboration, and AI boundaries.',
  title: 'Runtime Atlas | Asyra Framework'
}

export default function RuntimeAtlasPage() {
  return (
    <SiteFrame>
      <FoundationPageHero
        aside={
          <>
            <p>
              Operate six cases through the real public runtime, then inspect
              who accepted the intent, where the transaction settled, and what
              verifiable state changed.
            </p>
            <p>
              This is a resettable browser/Core composition, not a Headless Core
              or server-runtime claim. Those boundaries remain on the{' '}
              <a href="/roadmap">Roadmap</a>.
            </p>
          </>
        }
        className="atlas-hero"
        layout="split"
      >
        <p className="support-label">Runtime Atlas / Executable evidence</p>
        <h1>Don’t take the architecture on faith. Run it.</h1>
      </FoundationPageHero>
      <RuntimeAtlas />
      <section className="atlas-boundary">
        <div>
          <p className="support-label">The rule behind every case</p>
          <h2>Intent may come from anywhere. Canonical writes do not.</h2>
        </div>
        <p>
          People, automation, collaboration, and AI all enter through bounded
          app-owned policy. Framework owners validate and settle state; canvas,
          hierarchy, properties, serialization, search, and presence remain
          projections or integrations—not competing sources of truth.
        </p>
      </section>
    </SiteFrame>
  )
}
