const BLOCK_START = /^(#{1,6})\s+|^```|^[-*+]\s+|^\d+\.\s+|^\|/

export const plainText = (value) =>
  value
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

export const createSlugger = () => {
  const counts = new Map()
  return (value) => {
    const base = plainText(value)
      .toLocaleLowerCase('en-US')
      .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
    const safeBase = base || 'section'
    const count = counts.get(safeBase) ?? 0
    counts.set(safeBase, count + 1)
    return count === 0 ? safeBase : `${safeBase}-${count}`
  }
}

const isTableDivider = (line) => /^\|?(?:\s*:?-{3,}:?\s*\|)+\s*$/.test(line)

const tableCells = (line) => {
  const normalized = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return normalized.split('|').map((cell) => cell.trim())
}

const consumeList = (lines, start, ordered) => {
  const matcher = ordered ? /^\s*\d+\.\s+(.+)$/ : /^\s*[-*+]\s+(.+)$/
  const items = []
  let index = start
  while (index < lines.length) {
    const match = lines[index].match(matcher)
    if (!match) break
    let text = match[1].trim()
    index += 1
    while (
      index < lines.length &&
      lines[index].trim() &&
      /^\s{2,}\S/.test(lines[index]) &&
      !matcher.test(lines[index])
    ) {
      text += ` ${lines[index].trim()}`
      index += 1
    }
    items.push(text)
  }
  return { block: { type: 'list', ordered, items }, next: index }
}

export const parseMarkdown = (source) => {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const slug = createSlugger()
  const blocks = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    if (!line.trim()) {
      index += 1
      continue
    }

    const fence = line.match(/^```([^\s`]*)\s*$/)
    if (fence) {
      const body = []
      const language = fence[1] || 'text'
      index += 1
      while (index < lines.length && !/^```\s*$/.test(lines[index])) {
        body.push(lines[index])
        index += 1
      }
      if (index >= lines.length) {
        throw new Error(`Unclosed Markdown fence for language ${language}`)
      }
      blocks.push({ type: 'code', language, value: body.join('\n') })
      index += 1
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      const value = heading[2].trim()
      blocks.push({
        type: 'heading',
        depth: heading[1].length,
        id: slug(value),
        value
      })
      index += 1
      continue
    }

    if (
      line.trim().startsWith('|') &&
      index + 1 < lines.length &&
      isTableDivider(lines[index + 1])
    ) {
      const header = tableCells(line)
      const rows = []
      index += 2
      while (index < lines.length && lines[index].trim().startsWith('|')) {
        rows.push(tableCells(lines[index]))
        index += 1
      }
      blocks.push({ type: 'table', header, rows })
      continue
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const result = consumeList(lines, index, false)
      blocks.push(result.block)
      index = result.next
      continue
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const result = consumeList(lines, index, true)
      blocks.push(result.block)
      index = result.next
      continue
    }

    const paragraph = [line.trim()]
    index += 1
    while (
      index < lines.length &&
      lines[index].trim() &&
      !BLOCK_START.test(lines[index])
    ) {
      paragraph.push(lines[index].trim())
      index += 1
    }
    blocks.push({ type: 'paragraph', value: paragraph.join(' ') })
  }

  return blocks
}

export const markdownHeadings = (source) =>
  parseMarkdown(source)
    .filter((block) => block.type === 'heading')
    .map(({ depth, id, value }) => ({ depth, id, title: plainText(value) }))
