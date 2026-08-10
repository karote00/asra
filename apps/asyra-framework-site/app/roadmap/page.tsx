import type { Metadata } from 'next'
import { EvidenceHero } from '@/components/evidence-hero'
import { MarkdownContent } from '@/components/markdown-content'
import { StatusLegend } from '@/components/status-legend'
import { loadContentBundle } from '@/lib/content'

export const metadata: Metadata = {
  title: 'Current and future runtime boundaries',
  description:
    'Separate current Asyra Framework support, App-owned product possibilities, and verified future runtime direction.',
  alternates: { canonical: '/roadmap' }
}

export default function RoadmapPage() {
  const bundle = loadContentBundle()
  const page = bundle.pageById.get('learn/runtime-boundaries-roadmap')
  if (!page) throw new Error('Accepted runtime roadmap is unavailable')

  return (
    <div className="evidence-page">
      <EvidenceHero
        coordinate="06"
        description="Asyra is designed for domains the Framework does not know. Current infrastructure, App-owned possibilities, and future runtime work stay visually and semantically separate."
        eyebrow="Current, possible, and planned"
        title="The direction is ambitious. The support boundary stays exact."
      >
        <StatusLegend />
      </EvidenceHero>
      <article className="roadmap-contract">
        <div className="roadmap-boundary-note">
          <span aria-hidden="true" />
          <p>
            Non-visible, AI-facing information products are an important
            direction, not a current public Headless Core or Core Kernel
            contract.
          </p>
        </div>
        <MarkdownContent bundle={bundle} page={page} />
      </article>
    </div>
  )
}
