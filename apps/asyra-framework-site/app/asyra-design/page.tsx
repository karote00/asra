import type { Metadata } from 'next'
import { EvidenceStrip } from '@/components/evidence-strip'
import { FoundationPageHero } from '@/components/foundation-page-hero'
import { MarkdownContent } from '@/components/markdown-content'
import { SiteFrame } from '@/components/site-frame'
import { StatusSurface } from '@/components/status-surface'
import type { VerifiedPublicContent } from '@/lib/content'
import { loadVerifiedPublicContent } from '@/lib/content.mjs'

export const metadata: Metadata = {
  alternates: { canonical: '/asyra-design' },
  description:
    'Explore Asyra Design, the official design tool app and maintained reference implementation built with Asyra Framework.',
  title: 'Asyra Design | Official Asyra product'
}

const loadContent = async (): Promise<VerifiedPublicContent> =>
  loadVerifiedPublicContent()

export default async function AsyraDesignPage() {
  const content = await loadContent()
  const caseStudy = content.pages.find(({ id }) => id === 'cases/asyra-design')
  if (!caseStudy) throw new Error('Missing accepted Asyra Design case study')

  return (
    <SiteFrame>
      <FoundationPageHero
        aside={
          <div
            className="ownership-map"
            aria-label="Asyra Design ownership map"
          >
            <div>
              <span>01</span>
              <strong>Framework</strong>
              <p>Transactions, owners, validation, render contracts</p>
            </div>
            <div>
              <span>02</span>
              <strong>Preset</strong>
              <p>Selectable 2D defaults and provider policy</p>
            </div>
            <div>
              <span>03</span>
              <strong>App</strong>
              <p>Tools, Features, schemas, UI, AI meaning</p>
            </div>
            <div>
              <span>04</span>
              <strong>Services</strong>
              <p>Documents, sockets, persistence, authorization</p>
            </div>
          </div>
        }
        density="feature"
        layout="split"
        surface="dark"
      >
        <p className="support-label">
          Official product / Reference implementation
        </p>
        <h1>A complete design tool. Built with Asyra.</h1>
        <p>
          Asyra Design is the official design tool app built on Asyra Framework.
          It is a maintained reference implementation, not the Framework owner
          and not the only product shape Asyra supports.
        </p>
        <div className="support-actions">
          <a
            className="button button--red"
            href="https://asyra-design.vercel.app/?fileId=demo"
            rel="noopener noreferrer"
            target="_blank"
          >
            Open Asyra Design
          </a>
          <a
            className="support-text-action"
            href="/docs/start/create-design-app"
          >
            Create your own
          </a>
        </div>
      </FoundationPageHero>

      <EvidenceStrip
        items={[
          { label: 'Product', value: 'Working 2D design editor' },
          { label: 'Intent', value: 'Human and AI use Features' },
          { label: 'History', value: 'One action, one transaction' },
          { label: 'Source', value: 'Ordinary editable app code' }
        ]}
      />

      <section className="support-section support-section--split">
        <div>
          <p className="support-label">The reusable pattern</p>
          <h2>Product decisions stay where product builders can find them.</h2>
        </div>
        <div className="support-section__copy">
          <p>
            Features own bounded behavior. Common APIs own reusable mutations.
            Framework packages own canonical state and transaction guarantees.
            React and rendering remain projections, not hidden authorities.
          </p>
          <p>
            Replace the design-tool policy with the knowledge, rules, and visual
            language of your own domain.
          </p>
        </div>
      </section>

      <div className="status-grid support-section">
        <StatusSurface
          label="App-owned"
          title="Tools and product policy"
          tone="app"
        >
          <p>
            Shapes, Vector paths, selection, panels, Group commands, and UI.
          </p>
        </StatusSurface>
        <StatusSurface
          label="Framework-owned"
          title="Predictable action"
          tone="current"
        >
          <p>
            Canonical owners, transactions, validation, Undo/Redo, and
            projection.
          </p>
        </StatusSurface>
        <StatusSurface
          label="Optional"
          title="Collaboration and AI"
          tone="future"
        >
          <p>
            Explicit app composition with permissions, providers, and backend
            policy.
          </p>
        </StatusSurface>
      </div>

      <section className="support-document">
        <header>
          <p className="support-label">Complete implementation case study</p>
          <h2>Follow the product from startup to persistence.</h2>
        </header>
        <article className="docs-article">
          <MarkdownContent
            currentPath={caseStudy.path}
            markdown={caseStudy.markdown}
            pages={content.pages}
          />
        </article>
      </section>
    </SiteFrame>
  )
}
