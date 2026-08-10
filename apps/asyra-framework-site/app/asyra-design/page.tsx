import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { EvidenceHero } from '@/components/evidence-hero'
import { MarkdownContent } from '@/components/markdown-content'
import { StatusLegend } from '@/components/status-legend'
import { loadContentBundle } from '@/lib/content'

export const metadata: Metadata = {
  title: 'Asyra Design reference product',
  description:
    'See how the Asyra Design reference product composes Framework infrastructure with App-owned product knowledge.'
}

export default function ReferenceProductPage() {
  const bundle = loadContentBundle()
  const page = bundle.pageById.get('cases/asyra-design')
  if (!page) throw new Error('Accepted Asyra Design case study is unavailable')

  return (
    <div className="evidence-page">
      <EvidenceHero
        coordinate="04"
        description="Asyra Design is a working reference product. It shows how an App supplies product decisions, interaction, services, and domain rules while the Framework preserves reusable runtime boundaries."
        eyebrow="Reference product, not Framework owner"
        title="A real product path, with every responsibility visible."
      >
        <StatusLegend />
      </EvidenceHero>
      <div className="case-study-layout">
        <aside className="case-study-rail">
          <p className="technical-label">BEGIN WITH THE PRODUCT</p>
          <p>
            Generate an immediately usable App, then extend one bounded behavior
            through the public Framework route.
          </p>
          <Link className="primary-action" href="/docs/start/create-design-app">
            Start with Asyra Design
            <ArrowRight aria-hidden="true" size={17} />
          </Link>
          <p className="case-study-note">
            No public Asyra Design deployment URL is shown until its canonical
            URL is separately verified.
          </p>
        </aside>
        <article className="case-study-article">
          <MarkdownContent bundle={bundle} page={page} />
        </article>
      </div>
    </div>
  )
}
