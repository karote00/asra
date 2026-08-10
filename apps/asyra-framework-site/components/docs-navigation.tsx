import type { Route } from 'next'
import Link from 'next/link'
import type { ContentBundle } from '@/lib/content'

interface DocsNavigationProps {
  bundle: ContentBundle
  currentPageId: string
}

const sectionLabel = (id: string) => {
  if (id === 'overview') return 'Overview'
  if (id === 'cases') return 'Reference products'
  return `${id.charAt(0).toUpperCase()}${id.slice(1)}`
}

export function DocsNavigation({ bundle, currentPageId }: DocsNavigationProps) {
  return (
    <nav aria-label="Documentation" className="docs-navigation">
      {bundle.sections.map((section, index) => (
        <section key={section.id}>
          <p>
            <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
            {sectionLabel(section.id)}
          </p>
          <ul>
            {section.pageIds.map((pageId) => {
              const page = bundle.pageById.get(pageId)
              if (!page) return null
              return (
                <li key={page.id}>
                  <Link
                    aria-current={
                      currentPageId === page.id ? 'page' : undefined
                    }
                    href={page.route as Route}
                  >
                    {page.title}
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </nav>
  )
}

export { sectionLabel }
