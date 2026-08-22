import type { Metadata } from 'next'
import { EvidenceStrip } from '@/components/evidence-strip'
import { FoundationPageHero } from '@/components/foundation-page-hero'
import { MarkdownContent } from '@/components/markdown-content'
import { SiteFrame } from '@/components/site-frame'
import type { VerifiedPublicContent } from '@/lib/content'
import { loadVerifiedPublicContent } from '@/lib/content.mjs'

export const metadata: Metadata = {
  alternates: { canonical: '/releases' },
  description:
    'Inspect Asyra Framework package versions, supported environments, security reporting, migration, and release boundaries.',
  title: 'Releases and support | Asyra Framework'
}

const loadContent = async (): Promise<VerifiedPublicContent> =>
  loadVerifiedPublicContent()

export default async function ReleasesPage() {
  const content = await loadContent()
  const support = content.pages.find(
    ({ id }) => id === 'reference/support-release'
  )
  if (!support) throw new Error('Missing accepted support and release guide')

  return (
    <SiteFrame>
      <FoundationPageHero>
        <p className="support-label">Manifest-derived inventory</p>
        <h1>Know exactly what your product composes.</h1>
        <p>
          The current Framework inventory contains 19 public packages. Names,
          versions, public entries, and dependencies below come directly from
          verified manifests, not duplicated website constants.
        </p>
      </FoundationPageHero>

      <EvidenceStrip
        items={[
          { label: 'Inventory', value: '19 public packages' },
          { label: 'Module format', value: 'Public ESM entrypoints' },
          { label: 'License', value: 'MIT' },
          { label: 'Release truth', value: 'Verified project manifests' }
        ]}
      />

      <section className="support-section">
        <div className="support-section__heading">
          <p className="support-label">Current package inventory</p>
          <h2>Small owners. Explicit dependencies.</h2>
          <p>
            This page reports repository facts. Registry publication, tagging,
            deployment, and release authorization remain separate operations.
          </p>
        </div>
        <div className="package-ledger">
          <div className="package-ledger__header" aria-hidden="true">
            <span>Package</span>
            <span>Version</span>
            <span>Public entries</span>
            <span>Framework dependencies</span>
          </div>
          {content.packages.map((packageRecord) => (
            <article key={packageRecord.name}>
              <h3>{packageRecord.name}</h3>
              <p>{packageRecord.version}</p>
              <p>{packageRecord.publicEntries.join(', ')}</p>
              <p>
                {packageRecord.frameworkDependencies.length
                  ? packageRecord.frameworkDependencies.join(', ')
                  : 'None'}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="support-document">
        <header>
          <p className="support-label">Support and release boundaries</p>
          <h2>Environment, security, migration, and reproducible evidence.</h2>
        </header>
        <article className="docs-article">
          <MarkdownContent
            currentPath={support.path}
            markdown={support.markdown}
            pages={content.pages}
          />
        </article>
      </section>
    </SiteFrame>
  )
}
