import type { Route } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  BookOpen,
  Boxes,
  Braces,
  CircleCheck,
  Network,
  Sparkles
} from 'lucide-react'
import type { ContentBundle } from '@/lib/content'
import { SearchDialog } from '@/components/search-dialog'

interface DocsHomeProps {
  bundle: ContentBundle
}

const iconById = {
  concepts: CircleCheck,
  examples: Boxes,
  guides: Sparkles,
  integrations: Network,
  references: Braces,
  tutorials: BookOpen
} as const

export function DocsHome({ bundle }: DocsHomeProps) {
  const firstRoute = (sectionId: string, fallback: string) => {
    const section = bundle.sections.find(({ id }) => id === sectionId)
    const pageId = section?.pageIds[0]
    return (pageId ? bundle.pageById.get(pageId)?.route : undefined) ?? fallback
  }

  const cards = [
    {
      description: 'Understand the building blocks of Asyra.',
      href: firstRoute('learn', '/docs/learn/canonical-state'),
      id: 'concepts',
      title: 'Concepts'
    },
    {
      description: 'Step-by-step guidance for common tasks.',
      href: firstRoute('build', '/docs/build/render-boundary'),
      id: 'guides',
      title: 'Guides'
    },
    {
      description: 'Technical contracts and definitions.',
      href: firstRoute('reference', '/docs/reference/support-release'),
      id: 'references',
      title: 'References'
    },
    {
      description: 'Hands-on tutorials to build with Asyra.',
      href: firstRoute('start', '/docs/start/create-design-app'),
      id: 'tutorials',
      title: 'Tutorials'
    },
    {
      description: 'Real-world products across domains.',
      href: firstRoute('cases', '/asyra-design'),
      id: 'examples',
      title: 'Examples'
    },
    {
      description: 'Connect systems and extend Asyra.',
      href: firstRoute('advanced', '/docs/start/custom-composition'),
      id: 'integrations',
      title: 'Integrations'
    }
  ] as const

  const learn = [
    [
      'Start your journey',
      'New to Asyra? Begin here.',
      '/docs/start/create-design-app'
    ],
    [
      'Build a foundation',
      'Core concepts and models.',
      '/docs/learn/canonical-state'
    ],
    [
      'Go deeper',
      'Advanced patterns and capabilities.',
      '/docs/build/render-boundary'
    ],
    [
      'Ship with confidence',
      'Performance, testing, and practices.',
      '/docs/reference/support-release'
    ]
  ] as const

  return (
    <div className="docs-page docs-home" data-docs-view="home">
      <section className="docs-home__hero">
        <div>
          <h1>Docs</h1>
          <p>Your atlas for building with executable information.</p>
        </div>
        <SearchDialog records={bundle.searchRecords} />
      </section>

      <div className="docs-home__workspace">
        <nav aria-label="Documentation" className="docs-home__learn">
          <p className="technical-label">Learn</p>
          {learn.map(([title, description, href], index) => (
            <Link href={href as Route} key={href}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <span>
                <strong>{title}</strong>
                <small>{description}</small>
              </span>
              <ArrowRight aria-hidden="true" size={15} />
            </Link>
          ))}
        </nav>

        <section className="docs-home-atlas" aria-labelledby="docs-atlas-title">
          <header>
            <h2 id="docs-atlas-title">Explore the atlas</h2>
            <Link href="/docs/start/create-design-app">View all</Link>
          </header>
          <div className="docs-home-atlas__grid">
            {cards.map(({ description, href, id, title }) => {
              const Icon = iconById[id]
              return (
                <Link
                  className="docs-home-atlas__card"
                  data-tone={id}
                  href={href as Route}
                  key={id}
                >
                  <Icon aria-hidden="true" size={19} strokeWidth={1.45} />
                  <strong>{title}</strong>
                  <small>{description}</small>
                </Link>
              )
            })}
          </div>
        </section>
      </div>

      <section className="docs-home-query" aria-label="Example query">
        <div>
          <p className="technical-label">Example query</p>
          <code>
            <span>// Find all impacts within a selected flow</span>$ atlas query
            impacts --flow DEMO-01 --depth 3
          </code>
        </div>
        <Link href="/atlas">
          Run in Runtime Atlas <ArrowRight aria-hidden="true" size={16} />
        </Link>
      </section>
    </div>
  )
}
