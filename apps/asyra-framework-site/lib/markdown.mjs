const headingPattern = /^(#{1,6})\s+(.+)$/
const unorderedPattern = /^[-*]\s+(.+)$/
const orderedPattern = /^\d+\.\s+(.+)$/

const cleanHeadingText = (value) =>
  value
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/[*_`~]/g, '')
    .trim()

export const slugifyHeading = (value) =>
  cleanHeadingText(value)
    .normalize('NFKD')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/@/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const isTableSeparator = (line) =>
  /^\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?$/.test(line)

const tableCells = (line) =>
  line
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim())

export function parseMarkdownBlocks(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const blocks = []
  const headingCounts = new Map()
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    if (line.trim() === '') {
      index += 1
      continue
    }

    if (line.startsWith('```')) {
      const language = line.slice(3).trim()
      const codeLines = []
      index += 1
      while (index < lines.length && !lines[index].startsWith('```')) {
        codeLines.push(lines[index])
        index += 1
      }
      if (index >= lines.length) throw new Error('Unclosed Markdown code fence')
      blocks.push({ code: codeLines.join('\n'), language, type: 'code' })
      index += 1
      continue
    }

    const heading = line.match(headingPattern)
    if (heading) {
      const text = cleanHeadingText(heading[2])
      const baseId = slugifyHeading(text) || 'section'
      const count = (headingCounts.get(baseId) ?? 0) + 1
      headingCounts.set(baseId, count)
      blocks.push({
        depth: heading[1].length,
        id: count === 1 ? baseId : `${baseId}-${count}`,
        text,
        type: 'heading'
      })
      index += 1
      continue
    }

    const listMatch = line.match(unorderedPattern) ?? line.match(orderedPattern)
    if (listMatch) {
      const ordered = orderedPattern.test(line)
      const pattern = ordered ? orderedPattern : unorderedPattern
      const items = []
      while (index < lines.length) {
        const item = lines[index].match(pattern)
        if (!item) break
        const itemLines = [item[1]]
        index += 1
        while (
          index < lines.length &&
          lines[index].trim() !== '' &&
          !lines[index].match(pattern) &&
          !lines[index].match(headingPattern) &&
          !lines[index].startsWith('```') &&
          !lines[index].startsWith('|')
        ) {
          itemLines.push(lines[index].trim())
          index += 1
        }
        items.push(itemLines.join(' '))
        while (index < lines.length && lines[index].trim() === '') index += 1
        if (!lines[index]?.match(pattern)) break
      }
      blocks.push({ items, ordered, type: 'list' })
      continue
    }

    if (
      line.includes('|') &&
      index + 1 < lines.length &&
      isTableSeparator(lines[index + 1])
    ) {
      const headers = tableCells(line)
      const rows = []
      index += 2
      while (index < lines.length && lines[index].includes('|')) {
        rows.push(tableCells(lines[index]))
        index += 1
      }
      blocks.push({ headers, rows, type: 'table' })
      continue
    }

    const paragraphLines = [line.trim()]
    index += 1
    while (
      index < lines.length &&
      lines[index].trim() !== '' &&
      !lines[index].match(headingPattern) &&
      !lines[index].match(unorderedPattern) &&
      !lines[index].match(orderedPattern) &&
      !lines[index].startsWith('```') &&
      !(lines[index].includes('|') && isTableSeparator(lines[index + 1] ?? ''))
    ) {
      paragraphLines.push(lines[index].trim())
      index += 1
    }
    blocks.push({ text: paragraphLines.join(' '), type: 'paragraph' })
  }

  return blocks
}
