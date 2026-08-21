import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const sha256 = (value) => createHash('sha256').update(value).digest('hex')

const resolveRepositoryRoot = () => {
  const candidates = [process.cwd(), path.resolve(process.cwd(), '../..')]
  const repositoryRoot = candidates.find((candidate) =>
    existsSync(path.join(candidate, 'docs/public/content-manifest.json'))
  )
  if (!repositoryRoot) {
    throw new Error('Unable to locate the Asyra public content bundle')
  }
  return repositoryRoot
}

const repositoryRoot = resolveRepositoryRoot()
const publicContentRoot = path.join(repositoryRoot, 'docs/public')

const readJson = async (relativePath) =>
  JSON.parse(await readFile(path.join(repositoryRoot, relativePath), 'utf8'))

const assertUnique = (values, label) => {
  if (new Set(values).size !== values.length) {
    throw new Error(`Duplicate ${label} in the public content inventory`)
  }
}

const verifyDigest = async (relativePath, expectedSha256, label) => {
  const bytes = await readFile(path.join(repositoryRoot, relativePath))
  const actualSha256 = sha256(bytes)
  if (actualSha256 !== expectedSha256) {
    throw new Error(`${label} digest drift: ${relativePath}`)
  }
  return actualSha256
}

export const resolvePublicContentPath = (relativePath) => {
  if (path.isAbsolute(relativePath)) {
    throw new Error('Public content requires a relative path')
  }
  const resolved = path.resolve(publicContentRoot, relativePath)
  if (!resolved.startsWith(`${publicContentRoot}${path.sep}`)) {
    throw new Error('Public content path resolves outside docs/public')
  }
  return resolved
}

export const publicPageHref = (id) =>
  id === 'overview' ? '/docs' : `/docs/${id}`

export async function loadVerifiedPublicContent() {
  const [manifest, contentIndex, sourceMap, packageReference] =
    await Promise.all([
      readJson('docs/public/content-manifest.json'),
      readJson('docs/public/generated/content-index.json'),
      readJson('docs/public/generated/source-map.json'),
      readJson('docs/public/generated/package-reference.json')
    ])

  if (manifest.pages.length !== 41 || contentIndex.pages.length !== 41) {
    throw new Error(
      'The public content inventory must contain exactly 41 pages'
    )
  }
  if (packageReference.packages.length !== 19) {
    throw new Error('The package reference must contain exactly 19 packages')
  }

  assertUnique(
    manifest.pages.map(({ id }) => id),
    'page id'
  )
  assertUnique(
    manifest.pages.map(({ path: pagePath }) => pagePath),
    'page path'
  )
  assertUnique(
    packageReference.packages.map(({ name }) => name),
    'package name'
  )

  const indexedPages = new Map(
    contentIndex.pages.map((page) => [page.id, page])
  )
  const mappedPages = new Map(sourceMap.pages.map((page) => [page.id, page]))

  const pages = await Promise.all(
    manifest.pages.map(async (page) => {
      const indexed = indexedPages.get(page.id)
      const mapped = mappedPages.get(page.id)
      if (!indexed || !mapped) {
        throw new Error(`Missing generated public content record: ${page.id}`)
      }
      if (
        indexed.path !== page.path ||
        indexed.title !== page.title ||
        indexed.section !== page.section
      ) {
        throw new Error(`Public content metadata drift: ${page.id}`)
      }

      const markdown = await readFile(
        resolvePublicContentPath(page.path),
        'utf8'
      )
      const verifiedSha256 = sha256(markdown)
      if (
        indexed.contentSha256 !== verifiedSha256 ||
        mapped.pageSha256 !== verifiedSha256
      ) {
        throw new Error(`Public page digest drift: ${page.id}`)
      }

      await Promise.all(
        mapped.sources.map(({ path: sourcePath, sha256: sourceSha256 }) =>
          verifyDigest(
            sourcePath,
            sourceSha256,
            `Canonical source for ${page.id}`
          )
        )
      )

      return Object.freeze({
        ...page,
        contentSha256: indexed.contentSha256,
        headings: Object.freeze(indexed.headings),
        href: publicPageHref(page.id),
        markdown,
        verifiedSha256,
        wordCount: indexed.wordCount
      })
    })
  )

  const packages = await Promise.all(
    packageReference.packages.map(async (packageRecord) => {
      const [contractSha256, guideSha256, manifestSha256] = await Promise.all([
        verifyDigest(
          packageRecord.contractPath,
          packageRecord.sourceDigests.contract,
          `Package contract for ${packageRecord.name}`
        ),
        verifyDigest(
          packageRecord.guidePath,
          packageRecord.sourceDigests.guide,
          `Package guide for ${packageRecord.name}`
        ),
        verifyDigest(
          packageRecord.manifestPath,
          packageRecord.sourceDigests.manifest,
          `Package manifest for ${packageRecord.name}`
        )
      ])
      const packageManifest = JSON.parse(
        await readFile(
          path.join(repositoryRoot, packageRecord.manifestPath),
          'utf8'
        )
      )
      if (packageManifest.version !== packageRecord.version) {
        throw new Error(`Package version drift: ${packageRecord.name}`)
      }
      return Object.freeze({
        ...packageRecord,
        verifiedDigests: Object.freeze({
          contract: contractSha256,
          guide: guideSha256,
          manifest: manifestSha256
        })
      })
    })
  )

  const sections = new Map()
  for (const page of pages) {
    const sectionPages = sections.get(page.section) ?? []
    sectionPages.push(page)
    sections.set(page.section, sectionPages)
  }

  return Object.freeze({
    packages: Object.freeze(packages),
    pages: Object.freeze(pages),
    sections
  })
}
