import type { Metadata } from 'next'
import { FoundationPageHero } from '@/components/foundation-page-hero'
import { MarkdownContent } from '@/components/markdown-content'
import { SiteFrame } from '@/components/site-frame'
import { StatusSurface } from '@/components/status-surface'
import type { VerifiedPublicContent } from '@/lib/content'
import { loadVerifiedPublicContent } from '@/lib/content.mjs'

export const metadata: Metadata = {
  alternates: { canonical: '/roadmap' },
  description:
    'Separate current Asyra Framework capabilities from researched future runtime directions and unsupported claims.',
  title: 'Runtime roadmap | Asyra Framework'
}

const loadContent = async (): Promise<VerifiedPublicContent> =>
  loadVerifiedPublicContent()

export default async function RoadmapPage() {
  const content = await loadContent()
  const roadmap = content.pages.find(
    ({ id }) => id === 'learn/runtime-boundaries-roadmap'
  )
  if (!roadmap) throw new Error('Missing accepted runtime roadmap guide')

  return (
    <SiteFrame>
      <FoundationPageHero>
        <p className="support-label">Current support / Future research</p>
        <h1>Build from today’s contracts. See tomorrow clearly.</h1>
        <p>
          Non-visible and machine-facing information products are an important
          direction. A public Headless Core or independent Core Kernel is not a
          current API, package, or delivery promise.
        </p>
      </FoundationPageHero>

      <div className="status-grid roadmap-status-grid support-section">
        <StatusSurface
          label="What is current"
          title="Browser and Core composition"
          tone="current"
        >
          <p>
            Canonical information, Features, validation, transactions,
            persistence hooks, rendering, and explicit optional systems.
          </p>
        </StatusSurface>
        <StatusSurface
          label="What is future"
          title="Headless and Core Kernel research"
          tone="future"
        >
          <p>
            Runtime isolation, environment guarantees, package shape, startup,
            readiness, cleanup, and semver all require product decisions.
          </p>
        </StatusSurface>
        <StatusSurface
          label="Do not claim yet"
          title="No shortcut API"
          tone="boundary"
        >
          <p>
            No createHeadlessCore(), no published Kernel package, no full Node
            startup guarantee, and no delivery date.
          </p>
        </StatusSurface>
      </div>

      <section className="support-section support-section--split">
        <div>
          <p className="support-label">What you can build now</p>
          <h2>
            Canonical information does not have to be intrinsically visual.
          </h2>
        </div>
        <div className="support-section__copy">
          <p>
            Build a browser/Core information product today and add visual output
            only where the product needs it. Keep service retrieval, action
            policy, permissions, and environment proof App-owned.
          </p>
          <a
            className="support-text-action"
            href="/docs/start/custom-composition"
          >
            Read custom composition
          </a>
        </div>
      </section>

      <section className="support-document">
        <header>
          <p className="support-label">Complete runtime boundary guide</p>
          <h2>Current paths, future research, and unsupported claims.</h2>
        </header>
        <article className="docs-article">
          <MarkdownContent
            currentPath={roadmap.path}
            markdown={roadmap.markdown}
            pages={content.pages}
          />
        </article>
      </section>
    </SiteFrame>
  )
}
