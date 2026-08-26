import type { Metadata } from 'next'
import { EvidenceStrip } from '@/components/evidence-strip'
import { FoundationPageHero } from '@/components/foundation-page-hero'
import { MarkdownContent } from '@/components/markdown-content'
import { SiteFrame } from '@/components/site-frame'
import type { VerifiedPublicContent } from '@/lib/content'
import { loadVerifiedPublicContent } from '@/lib/content.mjs'
import {
  currentFrameworkRelease,
  frameworkReleaseHistory
} from './framework-release-history'

export const metadata: Metadata = {
  alternates: { canonical: '/releases' },
  description:
    'Review important Asyra Framework milestones, current package versions, supported environments, migration, and release boundaries.',
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
        <p className="support-label">Releases / Framework milestones</p>
        <h1>Know exactly what your product composes.</h1>
        <p>
          Follow important Framework milestones, then inspect the current
          package family, supported environments, migration boundaries, and
          security guidance before composing or upgrading a product.
        </p>
      </FoundationPageHero>

      <EvidenceStrip
        items={[
          {
            label: 'Current release',
            value: `v${currentFrameworkRelease.version}`
          },
          { label: 'Inventory', value: '19 public packages' },
          { label: 'License', value: 'MIT' },
          { label: 'Supported composition', value: '2D + CUSTOM' }
        ]}
      />

      <section
        aria-labelledby="release-history-title"
        className="support-section release-history"
      >
        <div className="support-section__heading">
          <p className="support-label">Release history</p>
          <h2 id="release-history-title">Important Framework milestones.</h2>
          <p>
            This history records releases that materially advance the public
            Framework. Smaller package and website updates will be tracked
            separately.
          </p>
        </div>

        <div className="release-history__list">
          {frameworkReleaseHistory.map((release) => (
            <article key={release.version}>
              <div className="release-history__identity">
                <p>v{release.version}</p>
                <span>{release.status}</span>
              </div>
              <div className="release-history__content">
                <h3>{release.title}</h3>
                <p>{release.summary}</p>
                <ul>
                  {release.highlights.map((highlight) => (
                    <li key={highlight}>{highlight}</li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="support-section package-inventory">
        <div className="support-section__heading">
          <p className="support-label">Current package inventory</p>
          <h2>Small owners. Explicit dependencies.</h2>
          <p>
            Choose only the package owners your product needs. Compare their
            current versions, public entrypoints, and Framework dependencies
            before composing or upgrading your product.
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
          <h2>Environment, security, migration, and compatibility.</h2>
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
