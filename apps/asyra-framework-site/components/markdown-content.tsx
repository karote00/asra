import type { ReactNode } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import type { ContentBundle, PublicPage } from '@/lib/content'
import { resolveContentHref } from '@/lib/content'
import { parseMarkdown } from '@/lib/markdown'

interface MarkdownContentProps {
  bundle: ContentBundle
  page: PublicPage
}

const tokens = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g

const InlineContent = ({
  bundle,
  page,
  value
}: MarkdownContentProps & { value: string }) => {
  const parts = value.split(tokens).filter(Boolean)
  return parts.map((part, index) => {
    const key = `${index}-${part}`
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={key}>{part.slice(1, -1)}</code>
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={key}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={key}>{part.slice(1, -1)}</em>
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (link) {
      const href = resolveContentHref({ bundle, page, href: link[2] })
      const external = /^https?:/.test(href)
      const label = (
        <InlineContent bundle={bundle} page={page} value={link[1]} />
      )
      if (external) {
        return (
          <a href={href} key={key} rel="noreferrer">
            {label}
          </a>
        )
      }
      return (
        <Link href={href as Route} key={key}>
          {label}
        </Link>
      )
    }
    return part
  })
}

const Heading = ({
  children,
  depth,
  id
}: {
  children: ReactNode
  depth: number
  id: string
}) => {
  const anchor = (
    <a
      aria-label="Link to this section"
      className="heading-anchor"
      href={`#${id}`}
    >
      #
    </a>
  )
  if (depth === 1) return <h1 id={id}>{children}</h1>
  if (depth === 2)
    return (
      <h2 id={id}>
        {children}
        {anchor}
      </h2>
    )
  if (depth === 3)
    return (
      <h3 id={id}>
        {children}
        {anchor}
      </h3>
    )
  return (
    <h4 id={id}>
      {children}
      {anchor}
    </h4>
  )
}

export function MarkdownContent({ bundle, page }: MarkdownContentProps) {
  const blocks = parseMarkdown(page.markdown)

  return (
    <div className="markdown-content">
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`
        if (block.type === 'heading') {
          return (
            <Heading depth={block.depth} id={block.id} key={key}>
              <InlineContent bundle={bundle} page={page} value={block.value} />
            </Heading>
          )
        }
        if (block.type === 'paragraph') {
          return (
            <p key={key}>
              <InlineContent bundle={bundle} page={page} value={block.value} />
            </p>
          )
        }
        if (block.type === 'code') {
          return (
            <figure className="code-block" key={key}>
              <figcaption>{block.language}</figcaption>
              <pre tabIndex={0}>
                <code>{block.value}</code>
              </pre>
            </figure>
          )
        }
        if (block.type === 'list') {
          const items = block.items.map((item, itemIndex) => (
            <li key={`${itemIndex}-${item}`}>
              <InlineContent bundle={bundle} page={page} value={item} />
            </li>
          ))
          return block.ordered ? (
            <ol key={key}>{items}</ol>
          ) : (
            <ul key={key}>{items}</ul>
          )
        }
        return (
          <div className="table-scroll" key={key} tabIndex={0}>
            <table>
              <thead>
                <tr>
                  {block.header.map((cell) => (
                    <th key={cell} scope="col">
                      <InlineContent bundle={bundle} page={page} value={cell} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr key={`${rowIndex}-${row.join('-')}`}>
                    {row.map((cell, cellIndex) => (
                      <td key={`${cellIndex}-${cell}`}>
                        <InlineContent
                          bundle={bundle}
                          page={page}
                          value={cell}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}
