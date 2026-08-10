import type { Route } from 'next'
import Link from 'next/link'
import type { ContentBundle, PublicPage } from '@/lib/content'
import { CopyMarkdownButton } from '@/components/copy-markdown-button'
import { DocsMobileNavigation } from '@/components/docs-mobile-navigation'
import { DocsNavigation, sectionLabel } from '@/components/docs-navigation'
import { DocsTableOfContents } from '@/components/docs-table-of-contents'
import { MarkdownContent } from '@/components/markdown-content'
import { SearchDialog } from '@/components/search-dialog'
import { sourceHref } from '@/lib/content'

interface DocsChromeProps {
  bundle: ContentBundle
  page: PublicPage
}

export function DocsChrome({ bundle, page }: DocsChromeProps) {
  const currentIndex = bundle.pages.findIndex(({ id }) => id === page.id)
  const previous = currentIndex > 0 ? bundle.pages[currentIndex - 1] : undefined
  const next =
    currentIndex < bundle.pages.length - 1
      ? bundle.pages[currentIndex + 1]
      : undefined
  const mobileGroups = bundle.sections.map((section) => ({
    id: section.id,
    label: sectionLabel(section.id),
    items: section.pageIds.flatMap((pageId) => {
      const item = bundle.pageById.get(pageId)
      return item ? [{ href: item.route, label: item.title }] : []
    })
  }))

  return (
    <div className="docs-page">
      <div aria-hidden="true" className="docs-coordinate-bar">
        <span>DOCUMENTATION / {page.section}</span>
        <span>
          PAGE {String(currentIndex + 1).padStart(2, '0')} /{' '}
          {String(bundle.pages.length).padStart(2, '0')}
        </span>
        <span>{page.id}</span>
      </div>
      <div className="docs-mobile-tools">
        <DocsMobileNavigation groups={mobileGroups} />
        <SearchDialog records={bundle.searchRecords} />
      </div>
      <div className="docs-layout">
        <aside className="docs-left-rail">
          <SearchDialog records={bundle.searchRecords} />
          <DocsNavigation bundle={bundle} currentPageId={page.id} />
        </aside>
        <article className="docs-article">
          <header className="docs-article__header">
            <div className="docs-breadcrumb">
              <Link href="/docs">Docs</Link>
              <span aria-hidden="true">/</span>
              <span>{page.section}</span>
            </div>
            <div className="docs-evidence-row">
              <span className="candidate-badge">
                RELEASE CANDIDATE · 0.5 FAMILY
              </span>
              <CopyMarkdownButton markdown={page.markdown} />
            </div>
          </header>
          <MarkdownContent bundle={bundle} page={page} />
          <nav aria-label="Adjacent documentation" className="docs-pagination">
            {previous ? (
              <Link href={previous.route as Route}>
                <span>Previous</span>
                {previous.title}
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link href={next.route as Route}>
                <span>Next</span>
                {next.title}
              </Link>
            ) : null}
          </nav>
        </article>
        <aside className="docs-right-rail">
          <DocsTableOfContents page={page} />
          <section className="source-evidence">
            <p className="technical-label">CANONICAL SOURCES</p>
            <ul>
              {page.sourceRecords.map((source) => (
                <li key={source.path}>
                  <a href={sourceHref(bundle, source.path)} rel="noreferrer">
                    {source.path}
                  </a>
                  <code>{source.sha256.slice(0, 10)}</code>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  )
}
