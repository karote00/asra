import type { MarkdownHeading } from './markdown.mjs'

export interface PublicSourceRecord {
  path: string
  sha256: string
}

export interface PublicPage {
  id: string
  path: string
  section: string
  title: string
  description: string
  sources: string[]
  packages: string[]
  examples: string[]
  route: string
  slug: string[]
  markdown: string
  markdownPath: string
  digest: string
  headings: MarkdownHeading[]
  sourceRecords: PublicSourceRecord[]
}

export interface SearchRecord {
  id: string
  pageId: string
  title: string
  description: string
  section: string
  href: string
  kind: 'page' | 'heading'
}

export interface ContentSection {
  id: string
  pageIds: string[]
}

export interface ReleaseCandidate {
  family: string
  packageCount: number
  publicationAuthorized?: boolean
  status: 'CANDIDATE'
}

export interface PublicPackageRecord {
  name: string
  version: string
  guideId: string
  guidePath: string
  examples: string[]
  frameworkDependencies: string[]
  publicEntries: string[]
}

export interface PublicExampleRecord {
  id: string
  title: string
  objective: string
  expectedResult: string
  environment: string
  runCommand: string
  source: string
  snippet: string
}

export interface ContentBundle {
  pages: PublicPage[]
  pageById: Map<string, PublicPage>
  pageByPath: Map<string, PublicPage>
  sections: ContentSection[]
  searchRecords: SearchRecord[]
  release: ReleaseCandidate
  packages: PublicPackageRecord[]
  examples: PublicExampleRecord[]
  runtime: { node: string; packageManager: string }
  repoRoot: string
}

export function resolveRepositoryRoot(): string
export function validatePageRecord(input: {
  manifestPage: Record<string, unknown>
  indexPage: Record<string, unknown>
  sourceMapPage: Record<string, unknown>
  markdown: string
}): { digest: string; headings: MarkdownHeading[] }
export function loadContentBundle(options?: {
  repoRoot?: string
}): ContentBundle
export function resolveContentHref(input: {
  bundle: ContentBundle
  page: PublicPage
  href: string
}): string
export function pageForSlug(
  bundle: ContentBundle,
  slug?: string[]
): PublicPage | undefined
export function textForSearch(value: string): string
