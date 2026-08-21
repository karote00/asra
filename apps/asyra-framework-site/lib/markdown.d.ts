export type MarkdownBlock =
  | Readonly<{
      depth: number
      id: string
      text: string
      type: 'heading'
    }>
  | Readonly<{
      text: string
      type: 'paragraph'
    }>
  | Readonly<{
      items: readonly string[]
      ordered: boolean
      type: 'list'
    }>
  | Readonly<{
      headers: readonly string[]
      rows: readonly (readonly string[])[]
      type: 'table'
    }>
  | Readonly<{
      code: string
      language: string
      type: 'code'
    }>

export function parseMarkdownBlocks(markdown: string): readonly MarkdownBlock[]
export function slugifyHeading(value: string): string
