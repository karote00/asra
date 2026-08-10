#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { readPublicContentContract } from './public-content-contract.mjs'
import { checkPublicDocumentation } from './public-documentation.mjs'

const BUILD_HEADINGS = Object.freeze([
  '## Prerequisites',
  '## Ownership',
  '## Public APIs',
  '## Flow',
  '## Expected result',
  '## Validate',
  '## Forbidden shortcuts',
  '## Canonical sources'
])

const PACKAGE_GUIDE_HEADINGS = Object.freeze([
  '## Owns',
  '## Does not own',
  '## Compose when',
  '## Public entrypoints and prerequisites',
  '## Lifecycle, inputs, outputs, and failure',
  '## Relationships',
  '## Maintained use path',
  '## Replacement and disabled behavior',
  '## Support, migration, and deprecation',
  '## Canonical sources and release inventory'
])

const markdownFilesBelow = (directory) => {
  const files = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (!['generated', 'schema'].includes(entry.name)) {
        files.push(...markdownFilesBelow(entryPath))
      }
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(path.resolve(entryPath))
    }
  }
  return files.sort()
}

const headingSlug = (title) =>
  title
    .toLowerCase()
    .replaceAll('`', '')
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')

const markdownHeadingSlugs = (source) =>
  new Set(
    [...source.matchAll(/^#{1,6}\s+(.+)$/gm)].map((match) =>
      headingSlug(match[1])
    )
  )

export const validateMarkdownLinks = ({ filePath, repositoryRoot, source }) => {
  let localLinkCount = 0
  for (const match of source.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const destination = match[1].trim()
    if (/^(?:https?:|mailto:)/i.test(destination)) continue
    const [relativeTarget, fragment] = destination.split('#', 2)
    const targetPath = relativeTarget
      ? path.resolve(path.dirname(filePath), decodeURIComponent(relativeTarget))
      : filePath
    const relativeFromRoot = path.relative(repositoryRoot, targetPath)
    if (
      relativeFromRoot === '..' ||
      relativeFromRoot.startsWith(`..${path.sep}`)
    ) {
      throw new Error(
        `${path.relative(repositoryRoot, filePath)} link escapes the repository: ${destination}`
      )
    }
    if (!fs.existsSync(targetPath)) {
      throw new Error(
        `${path.relative(repositoryRoot, filePath)} has a broken local link: ${destination}`
      )
    }
    if (fragment && targetPath.endsWith('.md')) {
      const targetSource = fs.readFileSync(targetPath, 'utf8')
      if (!markdownHeadingSlugs(targetSource).has(fragment.toLowerCase())) {
        throw new Error(
          `${path.relative(repositoryRoot, filePath)} has a broken heading link: ${destination}`
        )
      }
    }
    localLinkCount += 1
  }
  return localLinkCount
}

export const validatePublicImportMentions = ({ apiIndex, pageId, source }) => {
  const packagesByName = new Map(
    apiIndex.packages.map((packageRecord) => [
      packageRecord.name,
      packageRecord
    ])
  )
  for (const match of source.matchAll(
    /@asyra\/(?:[a-z0-9-]+|\*)(?:\/[a-z0-9._/-]+)?/gi
  )) {
    const mention = match[0]
    if (mention === '@asyra/*') continue
    const [, packageDirectory, ...subpathParts] = mention.split('/')
    const packageName = `@asyra/${packageDirectory}`
    const packageRecord = packagesByName.get(packageName)
    if (!packageRecord) {
      throw new Error(`${pageId} names an unsupported package: ${mention}`)
    }
    if (
      subpathParts.some((segment) =>
        ['dist', 'internal', 'src'].includes(segment)
      )
    ) {
      throw new Error(`${pageId} names a private package path: ${mention}`)
    }
    const entryPath =
      subpathParts.length === 0 ? '.' : `./${subpathParts.join('/')}`
    if (!packageRecord.publicEntries.includes(entryPath)) {
      throw new Error(
        `${pageId} names an unsupported public subpath: ${mention}`
      )
    }
  }
}

const sectionSource = (source, heading) => {
  const start = source.indexOf(`${heading}\n`)
  if (start === -1) return ''
  const contentStart = start + heading.length + 1
  const nextHeading = source.indexOf('\n## ', contentStart)
  return source.slice(
    contentStart,
    nextHeading === -1 ? source.length : nextHeading
  )
}

const apiReferences = (source) => {
  const references = []
  for (const match of source.matchAll(/`([^`\n]+)`/g)) {
    const raw = match[1].trim()
    if (raw.startsWith('@asyra/') || raw.includes('/')) continue
    const callable = raw.match(
      /^([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\([^)]*\)$/
    )
    const generic = raw.match(/^([A-Za-z_$][\w$]*)<.+>$/)
    const plain = raw.match(/^[A-Za-z_$][\w$]*$/)
    const identifier = callable?.[1] ?? generic?.[1] ?? plain?.[0]
    if (!identifier) continue
    references.push(identifier.split('.').at(-1))
  }
  return [...new Set(references)]
}

const apiHeadingForPage = (pageId) => {
  if (pageId.startsWith('build/')) return '## Public APIs'
  if (pageId.startsWith('reference/packages/')) {
    return '## Public entrypoints and prerequisites'
  }
  return null
}

const requiredHeadingsForPage = (pageId) => {
  if (pageId.startsWith('build/')) return BUILD_HEADINGS
  if (pageId.startsWith('reference/packages/')) {
    return PACKAGE_GUIDE_HEADINGS
  }
  return []
}

const validateApiReferences = ({ apiIndex, page, repositoryRoot, source }) => {
  const heading = apiHeadingForPage(page.id)
  if (!heading) return 0
  const references = apiReferences(sectionSource(source, heading))
  const packagesByName = new Map(
    apiIndex.packages.map((packageRecord) => [
      packageRecord.name,
      packageRecord
    ])
  )
  const apiPackages = page.id.startsWith('reference/packages/')
    ? apiIndex.packages
    : page.packages
        .map((packageName) => packagesByName.get(packageName))
        .filter(Boolean)
  const publicTerms = new Set(
    apiPackages.flatMap((packageRecord) => {
      return packageRecord.entries.flatMap(({ members, symbols }) => [
        ...members,
        ...symbols
      ])
    })
  )
  const mappedSource = page.sources
    .map((sourcePath) =>
      fs.readFileSync(path.join(repositoryRoot, sourcePath), 'utf8')
    )
    .join('\n')
  const unresolved = references.filter(
    (reference) =>
      !publicTerms.has(reference) &&
      !new RegExp(`\\b${reference}\\b`).test(mappedSource)
  )
  if (unresolved.length > 0) {
    throw new Error(
      `${page.id} names unresolved public APIs: ${unresolved.join(', ')}`
    )
  }
  return references.length
}

const validatePageStructure = ({ page, source }) => {
  const headings = [...source.matchAll(/^(#{1,6})\s+(.+)$/gm)]
  if (headings.length < 2) {
    throw new Error(`${page.id} requires a title and section headings`)
  }
  const title = headings[0][2].replaceAll('`', '')
  if (headings[0][1] !== '#' || title !== page.title) {
    throw new Error(`${page.id} title must match the content manifest`)
  }
  let previousDepth = 1
  for (const heading of headings.slice(1)) {
    const depth = heading[1].length
    if (depth > previousDepth + 1) {
      throw new Error(`${page.id} skips a Markdown heading level`)
    }
    previousDepth = depth
  }
  if (!source.includes('## Canonical sources')) {
    throw new Error(`${page.id} requires a Canonical sources section`)
  }
  const requiredHeadings = requiredHeadingsForPage(page.id)
  for (const heading of requiredHeadings) {
    if (!source.includes(heading)) {
      throw new Error(`${page.id} is missing ${heading}`)
    }
  }
  const wordCount = source
    .replace(/```[\s\S]*?```/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length
  if (wordCount < 250) {
    throw new Error(`${page.id} is too short for its public contract`)
  }
}

export const validatePublicDocumentation = async ({ repositoryRoot }) => {
  const root = path.resolve(repositoryRoot)
  const bundle = await checkPublicDocumentation({ repositoryRoot: root })
  const content = await readPublicContentContract({ repositoryRoot: root })
  const expectedMarkdown = new Set(
    content.pages.map((page) => path.resolve(root, 'docs/public', page.path))
  )
  const actualMarkdown = markdownFilesBelow(path.join(root, 'docs/public'))
  const unownedMarkdown = actualMarkdown.filter(
    (filePath) => !expectedMarkdown.has(filePath)
  )
  const missingMarkdown = [...expectedMarkdown].filter(
    (filePath) => !actualMarkdown.includes(filePath)
  )
  if (unownedMarkdown.length > 0 || missingMarkdown.length > 0) {
    throw new Error(
      `Public Markdown ownership mismatch: missing=[${missingMarkdown
        .map((filePath) => path.relative(root, filePath))
        .join(', ')}] unowned=[${unownedMarkdown
        .map((filePath) => path.relative(root, filePath))
        .join(', ')}]`
    )
  }

  let localLinkCount = 0
  let apiReferenceCount = 0
  for (const page of content.pages) {
    const filePath = path.join(root, 'docs/public', page.path)
    const source = fs.readFileSync(filePath, 'utf8')
    validatePageStructure({ page, source })
    validatePublicImportMentions({
      apiIndex: bundle.apiIndex,
      pageId: page.id,
      source
    })
    localLinkCount += validateMarkdownLinks({
      filePath,
      repositoryRoot: root,
      source
    })
    apiReferenceCount += validateApiReferences({
      apiIndex: bundle.apiIndex,
      page,
      repositoryRoot: root,
      source
    })
  }

  const roadmap = fs.readFileSync(
    path.join(root, 'docs/public/learn/runtime-boundaries-roadmap.md'),
    'utf8'
  )
  for (const heading of [
    '## What is current',
    '## What is future',
    '## Do not claim yet'
  ]) {
    if (!roadmap.includes(heading)) {
      throw new Error(`Runtime roadmap is missing ${heading}`)
    }
  }

  return Object.freeze({
    apiReferenceCount,
    localLinkCount,
    packageGuideCount: content.pages.filter((page) =>
      page.id.startsWith('reference/packages/')
    ).length,
    pageCount: content.pages.length,
    unownedMarkdownCount: unownedMarkdown.length
  })
}

const isDirectInvocation =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectInvocation) {
  if (process.argv.length !== 2) {
    throw new Error(
      'Usage: node scripts/docs/public-documentation-validation.mjs'
    )
  }
  const repositoryRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../..'
  )
  const summary = await validatePublicDocumentation({ repositoryRoot })
  process.stdout.write(
    `Public documentation valid: ${summary.pageCount} pages, ${summary.packageGuideCount} package guides, ${summary.localLinkCount} local links, ${summary.apiReferenceCount} API references\n`
  )
}
