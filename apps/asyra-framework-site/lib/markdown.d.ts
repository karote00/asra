export interface MarkdownHeadingBlock {
  type: 'heading'
  depth: number
  id: string
  value: string
}

export interface MarkdownParagraphBlock {
  type: 'paragraph'
  value: string
}

export interface MarkdownCodeBlock {
  type: 'code'
  language: string
  value: string
}

export interface MarkdownListBlock {
  type: 'list'
  ordered: boolean
  items: string[]
}

export interface MarkdownTableBlock {
  type: 'table'
  header: string[]
  rows: string[][]
}

export type MarkdownBlock =
  | MarkdownHeadingBlock
  | MarkdownParagraphBlock
  | MarkdownCodeBlock
  | MarkdownListBlock
  | MarkdownTableBlock

export interface MarkdownHeading {
  depth: number
  id: string
  title: string
}

export function plainText(value: string): string
export function createSlugger(): (value: string) => string
export function parseMarkdown(source: string): MarkdownBlock[]
export function markdownHeadings(source: string): MarkdownHeading[]
