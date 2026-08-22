import { Fragment, type ReactNode } from 'react'
import type { PublicPage } from '@/lib/content'
import type { MarkdownBlock } from '@/lib/markdown'
import { parseMarkdownBlocks } from '@/lib/markdown.mjs'

const githubSourceRoot = 'https://github.com/karote00/asyra/blob/main/'
const isExternalWebsite = (href: string) => /^https?:\/\//.test(href)

const resolveMarkdownHref = (
  href: string,
  currentPath: string,
  pages: readonly PublicPage[]
) => {
  if (/^(?:https?:|mailto:|#)/.test(href)) return href
  const [targetPath, hash] = href.split('#', 2)
  const currentRepositoryPath = `docs/public/${currentPath}`
  const repositoryPath = new URL(
    targetPath,
    `https://repository.invalid/${currentRepositoryPath}`
  ).pathname.replace(/^\//, '')
  const publicPrefix = 'docs/public/'
  const publicPath = repositoryPath.startsWith(publicPrefix)
    ? repositoryPath.slice(publicPrefix.length)
    : null
  const publicPage = pages.find(({ path }) => path === publicPath)
  const suffix = hash ? `#${hash}` : ''
  if (publicPage) return `${publicPage.href}${suffix}`
  return `${githubSourceRoot}${repositoryPath}${suffix}`
}

const inlinePattern = /(\[[^\]]+]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g

function InlineMarkdown({
  currentPath,
  pages,
  text
}: {
  currentPath: string
  pages: readonly PublicPage[]
  text: string
}) {
  const parts = text.split(inlinePattern).filter(Boolean)
  return parts.map((part, index): ReactNode => {
    const key = `${index}-${part.slice(0, 12)}`
    const link = part.match(/^\[([^\]]+)]\(([^)]+)\)$/)
    if (link) {
      const href = resolveMarkdownHref(link[2], currentPath, pages)
      const externalWebsite = isExternalWebsite(href)
      return (
        <a
          href={href}
          key={key}
          rel={externalWebsite ? 'noopener noreferrer' : undefined}
          target={externalWebsite ? '_blank' : undefined}
        >
          {link[1]}
        </a>
      )
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={key}>{part.slice(1, -1)}</code>
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={key}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={key}>{part.slice(1, -1)}</em>
    }
    return <Fragment key={key}>{part}</Fragment>
  })
}

function MarkdownBlockView({
  block,
  currentPath,
  pages
}: {
  block: MarkdownBlock
  currentPath: string
  pages: readonly PublicPage[]
}) {
  const inline = (text: string) => (
    <InlineMarkdown currentPath={currentPath} pages={pages} text={text} />
  )
  if (block.type === 'heading') {
    if (block.depth === 1) return null
    if (block.depth === 2) return <h2 id={block.id}>{inline(block.text)}</h2>
    if (block.depth === 3) return <h3 id={block.id}>{inline(block.text)}</h3>
    return <h4 id={block.id}>{inline(block.text)}</h4>
  }
  if (block.type === 'paragraph') return <p>{inline(block.text)}</p>
  if (block.type === 'list') {
    const List = block.ordered ? 'ol' : 'ul'
    return (
      <List>
        {block.items.map((item) => (
          <li key={item}>{inline(item)}</li>
        ))}
      </List>
    )
  }
  if (block.type === 'table') {
    return (
      <div className="markdown-table-scroll" role="region" tabIndex={0}>
        <table>
          <thead>
            <tr>
              {block.headers.map((header) => (
                <th key={header} scope="col">
                  {inline(header)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={`${rowIndex}-${row.join('-')}`}>
                {row.map((cell, cellIndex) => (
                  <td key={`${cellIndex}-${cell}`}>{inline(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
  return (
    <div className="markdown-code">
      {block.language ? <span>{block.language}</span> : null}
      <pre tabIndex={0}>
        <code>{block.code}</code>
      </pre>
    </div>
  )
}

export function MarkdownContent({
  currentPath,
  markdown,
  pages
}: {
  currentPath: string
  markdown: string
  pages: readonly PublicPage[]
}) {
  const blocks = parseMarkdownBlocks(markdown) as readonly MarkdownBlock[]
  return (
    <div className="markdown-content">
      {blocks.map((block, index) => (
        <MarkdownBlockView
          block={block}
          currentPath={currentPath}
          key={`${block.type}-${index}`}
          pages={pages}
        />
      ))}
    </div>
  )
}
