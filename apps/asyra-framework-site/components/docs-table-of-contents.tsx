import type { PublicPage } from '@/lib/content'

interface DocsTableOfContentsProps {
  page: PublicPage
}

export function DocsTableOfContents({ page }: DocsTableOfContentsProps) {
  const headings = page.headings.filter(
    ({ depth }) => depth === 2 || depth === 3
  )
  return (
    <nav aria-label="On this page" className="docs-table-of-contents">
      <p className="technical-label">ON THIS PAGE</p>
      <ol>
        {headings.map((heading) => (
          <li data-depth={heading.depth} key={heading.id}>
            <a href={`#${heading.id}`}>{heading.title}</a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
