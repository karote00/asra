import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { markdownHeadings, plainText } from './markdown.mjs'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const authorityPaths = Object.freeze({
  manifest: 'docs/public/content-manifest.json',
  contentIndex: 'docs/public/generated/content-index.json',
  sourceMap: 'docs/public/generated/source-map.json',
  packageReference: 'docs/public/generated/package-reference.json',
  examples: 'docs/examples/inventory.json'
})

const sha256 = (value) =>
  crypto.createHash('sha256').update(value).digest('hex')

const readJson = (repoRoot, filePath) =>
  JSON.parse(fs.readFileSync(path.join(repoRoot, filePath), 'utf8'))

export const resolveRepositoryRoot = () => {
  const candidates = [
    process.env.ASYRA_REPOSITORY_ROOT,
    process.cwd(),
    path.resolve(process.cwd(), '../..'),
    path.resolve(appRoot, '../..')
  ].filter(Boolean)
  const root = candidates.find((candidate) =>
    fs.existsSync(path.join(candidate, authorityPaths.manifest))
  )
  if (!root) {
    throw new Error('Asyra public content root is unavailable')
  }
  return root
}

const pageRoute = (pageId) =>
  pageId === 'overview' ? '/docs' : `/docs/${pageId}`

const headingContract = (headings) =>
  headings.map(({ depth, title }) => ({ depth, title }))

export const validatePageRecord = ({
  manifestPage,
  indexPage,
  sourceMapPage,
  markdown
}) => {
  if (!indexPage || !sourceMapPage) {
    throw new Error(`Missing generated content record for ${manifestPage.id}`)
  }
  const digest = sha256(markdown)
  if (
    digest !== indexPage.contentSha256 ||
    digest !== sourceMapPage.pageSha256
  ) {
    throw new Error(`Public content digest drift: ${manifestPage.id}`)
  }
  const contractHeadings = headingContract(markdownHeadings(markdown))
  if (JSON.stringify(contractHeadings) !== JSON.stringify(indexPage.headings)) {
    throw new Error(`Public content heading drift: ${manifestPage.id}`)
  }
  for (const key of ['id', 'path', 'section', 'title', 'description']) {
    if (manifestPage[key] !== indexPage[key]) {
      throw new Error(
        `Public content metadata drift: ${manifestPage.id}:${key}`
      )
    }
  }
  return { digest, headings: markdownHeadings(markdown) }
}

const validateRelease = (release, expectedPackageCount) => {
  if (
    release.status !== 'CANDIDATE' ||
    release.packageCount !== expectedPackageCount ||
    release.publicationAuthorized === true
  ) {
    throw new Error('Website release input is not a provisional candidate')
  }
}

export const loadContentBundle = ({
  repoRoot = resolveRepositoryRoot()
} = {}) => {
  const manifest = readJson(repoRoot, authorityPaths.manifest)
  const contentIndex = readJson(repoRoot, authorityPaths.contentIndex)
  const sourceMap = readJson(repoRoot, authorityPaths.sourceMap)
  const packageReference = readJson(repoRoot, authorityPaths.packageReference)
  const examples = readJson(repoRoot, authorityPaths.examples)

  if (manifest.pages.length !== 41) {
    throw new Error(
      `Expected 41 public pages, received ${manifest.pages.length}`
    )
  }
  if (
    new Set(manifest.pages.map(({ id }) => id)).size !== manifest.pages.length
  ) {
    throw new Error('Public content contains duplicate page ids')
  }
  if (packageReference.packages.length !== 19) {
    throw new Error('Expected the 19-package public release inventory')
  }
  validateRelease(contentIndex.release, packageReference.packages.length)
  validateRelease(packageReference.release, packageReference.packages.length)
  if (
    examples.release.status !== 'CANDIDATE' ||
    examples.release.packageCount !== packageReference.packages.length
  ) {
    throw new Error('Example inventory does not match the release candidate')
  }

  const indexById = new Map(contentIndex.pages.map((page) => [page.id, page]))
  const sourcesById = new Map(sourceMap.pages.map((page) => [page.id, page]))
  const pages = manifest.pages.map((manifestPage) => {
    const markdownPath = path.posix.join('docs/public', manifestPage.path)
    const markdown = fs.readFileSync(path.join(repoRoot, markdownPath), 'utf8')
    const indexPage = indexById.get(manifestPage.id)
    const sourceMapPage = sourcesById.get(manifestPage.id)
    const { digest, headings } = validatePageRecord({
      manifestPage,
      indexPage,
      sourceMapPage,
      markdown
    })
    return Object.freeze({
      ...manifestPage,
      route: pageRoute(manifestPage.id),
      slug: manifestPage.id === 'overview' ? [] : manifestPage.id.split('/'),
      markdown,
      markdownPath,
      digest,
      headings,
      sourceRecords: sourceMapPage.sources
    })
  })

  const pageById = new Map(pages.map((page) => [page.id, page]))
  const pageByPath = new Map(pages.map((page) => [page.markdownPath, page]))
  const searchRecords = pages.flatMap((page) => [
    Object.freeze({
      id: page.id,
      pageId: page.id,
      title: page.title,
      description: page.description,
      section: page.section,
      href: page.route,
      kind: 'page'
    }),
    ...page.headings
      .filter(({ depth }) => depth === 2 || depth === 3)
      .map((heading) =>
        Object.freeze({
          id: `${page.id}#${heading.id}`,
          pageId: page.id,
          title: heading.title,
          description: page.description,
          section: page.section,
          href: `${page.route}#${heading.id}`,
          kind: 'heading'
        })
      )
  ])

  return Object.freeze({
    pages: Object.freeze(pages),
    pageById,
    pageByPath,
    sections: Object.freeze(contentIndex.sections),
    searchRecords: Object.freeze(searchRecords),
    release: Object.freeze(contentIndex.release),
    packages: Object.freeze(packageReference.packages),
    examples: Object.freeze(examples.examples),
    runtime: Object.freeze(examples.runtime),
    repoRoot
  })
}

const sourceRevision = () =>
  process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || 'main'

const githubSourceHref = (repoPath, hash = '') => {
  const encodedPath = repoPath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
  return `https://github.com/karote00/asyra/blob/${sourceRevision()}/${encodedPath}${hash}`
}

export const resolveContentHref = ({ bundle, page, href }) => {
  if (/^(?:https?:|mailto:|tel:)/.test(href) || href.startsWith('#')) {
    return href
  }
  const [target, fragment = ''] = href.split('#')
  const repoPath = path.posix.normalize(
    path.posix.join('docs/public', path.posix.dirname(page.path), target)
  )
  const publicPage = bundle.pageByPath.get(repoPath)
  const hash = fragment ? `#${fragment}` : ''
  if (publicPage) return `${publicPage.route}${hash}`
  return githubSourceHref(repoPath, hash)
}

export const pageForSlug = (bundle, slug = []) => {
  const id = slug.length === 0 ? 'overview' : slug.join('/')
  return bundle.pageById.get(id)
}

export const textForSearch = (value) =>
  plainText(value).toLocaleLowerCase('en-US')
