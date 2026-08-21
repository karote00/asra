import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CopyMarkdownButton } from '@/components/copy-markdown-button'
import { DocsNavigation } from '@/components/docs-navigation'
import { DocsTableOfContents } from '@/components/docs-table-of-contents'
import { MarkdownContent } from '@/components/markdown-content'
import { SearchDialog, type SearchRecord } from '@/components/search-dialog'
import { SiteFrame } from '@/components/site-frame'
import type { VerifiedPublicContent } from '@/lib/content'
import type { MarkdownBlock } from '@/lib/markdown'
import { loadVerifiedPublicContent } from '@/lib/content.mjs'
import { parseMarkdownBlocks } from '@/lib/markdown.mjs'

const loadContent = async (): Promise<VerifiedPublicContent> =>
  loadVerifiedPublicContent()

const parseBlocks = (markdown: string): readonly MarkdownBlock[] =>
  parseMarkdownBlocks(markdown) as readonly MarkdownBlock[]

export async function getDocumentationMetadata(
  pageId: string
): Promise<Metadata> {
  const { pages } = await loadContent()
  const page = pages.find(({ id }) => id === pageId)
  if (!page) return { title: 'Documentation not found | Asyra' }
  return {
    alternates: { canonical: page.href },
    description: page.description,
    title: `${page.title} | Asyra Docs`
  }
}

export async function DocumentationPage({ pageId }: { pageId: string }) {
  const content = await loadContent()
  const page = content.pages.find(({ id }) => id === pageId)
  if (!page) notFound()

  const sections = [...content.sections].map(([title, pages]) => ({
    pages: pages.map(({ href, id, title: pageTitle }) => ({
      href,
      id,
      title: pageTitle
    })),
    title
  }))
  const pageBlocks = parseBlocks(page.markdown)
  const tableOfContents = pageBlocks.flatMap((block) =>
    block.type === 'heading' && block.depth > 1 && block.depth < 4
      ? [{ depth: block.depth, id: block.id, text: block.text }]
      : []
  )
  const searchRecords: SearchRecord[] = content.pages.flatMap((record) => {
    const pageRecord = {
      description: record.description,
      href: record.href,
      section: record.section,
      title: record.title
    }
    const headingRecords = parseBlocks(record.markdown).flatMap((block) =>
      block.type === 'heading' && block.depth > 1
        ? [
            {
              description: record.description,
              href: `${record.href}#${block.id}`,
              section: record.section,
              title: block.text
            }
          ]
        : []
    )
    return [pageRecord, ...headingRecords]
  })

  return (
    <SiteFrame>
      <header className="docs-hero engineering-grid">
        <div>
          <p className="support-label">Documentation / {page.section}</p>
          <h1>{page.title}</h1>
          <p>{page.description}</p>
        </div>
        <SearchDialog records={searchRecords} />
      </header>
      <div className="docs-layout">
        <DocsNavigation currentId={page.id} sections={sections} />
        <article className="docs-article">
          <div className="docs-article__tools">
            <p>
              {page.wordCount} words / {page.sources.length} canonical sources
            </p>
            <CopyMarkdownButton markdown={page.markdown} />
          </div>
          <MarkdownContent
            currentPath={page.path}
            markdown={page.markdown}
            pages={content.pages}
          />
          <footer className="docs-source-evidence">
            <p className="support-label">Canonical source evidence</p>
            <ul>
              {page.sources.map((source) => (
                <li key={source}>
                  <a
                    href={`https://github.com/karote00/asyra/blob/main/${source}`}
                  >
                    {source}
                  </a>
                </li>
              ))}
            </ul>
          </footer>
        </article>
        <DocsTableOfContents items={tableOfContents} />
      </div>
    </SiteFrame>
  )
}
