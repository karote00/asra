interface TableOfContentsItem {
  depth: number
  id: string
  text: string
}

export function DocsTableOfContents({
  items
}: {
  items: readonly TableOfContentsItem[]
}) {
  return (
    <aside className="docs-toc" aria-label="On this page">
      <p>On this page</p>
      <ol>
        {items.map((item) => (
          <li className={`docs-toc--depth-${item.depth}`} key={item.id}>
            <a href={`#${item.id}`}>{item.text}</a>
          </li>
        ))}
      </ol>
    </aside>
  )
}
