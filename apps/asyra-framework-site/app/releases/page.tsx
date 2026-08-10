import type { Metadata } from 'next'
import type { Route } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { EvidenceHero } from '@/components/evidence-hero'
import { MarkdownContent } from '@/components/markdown-content'
import { loadContentBundle } from '@/lib/content'

export const metadata: Metadata = {
  title: 'Release candidate inventory',
  description:
    'Inspect manifest-derived Asyra package versions, public entrypoints, support, migration, deprecation, and security boundaries.'
}

export default function ReleasesPage() {
  const bundle = loadContentBundle()
  const supportPage = bundle.pageById.get('reference/support-release')
  if (!supportPage)
    throw new Error('Accepted support and release page is unavailable')

  return (
    <div className="evidence-page">
      <EvidenceHero
        coordinate="05"
        description="Versions and public entrypoints come from the repository manifests. This inventory remains provisional until publication is authorized and reconciled against the registry."
        eyebrow="Generated from manifests"
        title="A release candidate you can inspect before you trust."
      >
        <p className="candidate-line">
          <span>{bundle.release.status}</span>
          Family {bundle.release.family} · {bundle.release.packageCount}{' '}
          packages · publication not authorized
        </p>
      </EvidenceHero>
      <section
        aria-labelledby="package-inventory"
        className="package-inventory"
      >
        <div className="section-heading">
          <p className="technical-label">CURRENT CANDIDATE</p>
          <h2 id="package-inventory">Public package inventory</h2>
        </div>
        <div
          className="package-table"
          role="table"
          aria-label="Public package inventory"
        >
          {bundle.packages.map((packageRecord, index) => (
            <div className="package-row" key={packageRecord.name} role="row">
              <span aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div role="cell">
                <strong>{packageRecord.name}</strong>
                <small>{packageRecord.publicEntries.join(' · ')}</small>
              </div>
              <code role="cell">{packageRecord.version}</code>
              <Link href={`/docs/${packageRecord.guideId}` as Route}>
                Guide
                <ArrowRight aria-hidden="true" size={14} />
              </Link>
            </div>
          ))}
        </div>
      </section>
      <article className="release-contract">
        <MarkdownContent bundle={bundle} page={supportPage} />
      </article>
    </div>
  )
}
