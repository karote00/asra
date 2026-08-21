export interface PublicHeading {
  depth: number
  title: string
}

export interface PublicPage {
  contentSha256: string
  description: string
  headings: readonly PublicHeading[]
  href: string
  id: string
  markdown: string
  packages: readonly string[]
  path: string
  section: string
  sources: readonly string[]
  title: string
  verifiedSha256: string
  wordCount: number
}

export interface PublicPackage {
  contractPath: string
  directory: string
  frameworkDependencies: readonly string[]
  guideId: string
  guidePath: string
  license: string
  manifestPath: string
  name: string
  publicEntries: readonly string[]
  version: string
  verifiedDigests: Readonly<{
    contract: string
    guide: string
    manifest: string
  }>
}

export interface VerifiedPublicContent {
  packages: readonly PublicPackage[]
  pages: readonly PublicPage[]
  sections: ReadonlyMap<string, readonly PublicPage[]>
}

export function loadVerifiedPublicContent(): Promise<VerifiedPublicContent>
export function publicPageHref(id: string): string
export function resolvePublicContentPath(relativePath: string): string
