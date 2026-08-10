#!/usr/bin/env node

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { readPublicContentContract } from './public-content-contract.mjs'
import {
  checkPublicPackageReference,
  createPublicPackageReference,
  writePublicPackageReference
} from './public-package-reference.mjs'

export const PUBLIC_DOCUMENTATION_PATHS = Object.freeze({
  apiIndex: 'docs/public/generated/api-index.json',
  contentIndex: 'docs/public/generated/content-index.json',
  llms: 'docs/public/llms.txt',
  sourceMap: 'docs/public/generated/source-map.json'
})

const SECTION_IDS = Object.freeze([
  'overview',
  'start',
  'learn',
  'build',
  'reference',
  'cases'
])

const sha256 = (value) => createHash('sha256').update(value).digest('hex')

const readSource = (root, relativePath) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8')

const markdownHeadings = (source) =>
  [...source.matchAll(/^(#{1,6})\s+(.+)$/gm)].map((match) => ({
    depth: match[1].length,
    title: match[2].replaceAll('`', '')
  }))

const markdownWordCount = (source) => {
  const words = source
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[`#*_[\]()>|]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  return words.length
}

const serializeJson = (value) => `${JSON.stringify(value, null, 2)}\n`

const serializeLlms = ({ contentIndex }) => {
  const lines = [
    '# Asyra Framework',
    '',
    '> Public, source-mapped documentation for people and AI coding agents.',
    '',
    `This index contains ${contentIndex.pages.length} public Markdown pages.`,
    'Current: browser/Core composition, official 2D Preset, and engine-neutral CUSTOM composition.',
    'Future: Headless Core and Core Kernel for non-visible and machine-facing products; no current public API or delivery date.',
    '',
    'Use create-asyra-design-app for the complete beginner product path. Use Start and Build for Framework composition.',
    'Treat app domain schemas, permissions, migration, retrieval, services, and product rules as app-owned.',
    '',
    '## Public pages',
    ''
  ]
  for (const page of contentIndex.pages) {
    lines.push(`- [${page.title}](${page.path}): ${page.description}`)
  }
  lines.push('')
  return lines.join('\n')
}

export const createPublicDocumentationBundle = async ({ repositoryRoot }) => {
  const root = path.resolve(repositoryRoot)
  const content = await readPublicContentContract({ repositoryRoot: root })
  const packageReference = await createPublicPackageReference({
    repositoryRoot: root
  })

  const pages = content.pages.map((page) => {
    const markdownPath = `docs/public/${page.path}`
    const markdown = readSource(root, markdownPath)
    return {
      contentSha256: sha256(markdown),
      description: page.description,
      examples: page.examples,
      headings: markdownHeadings(markdown),
      id: page.id,
      markdownPath,
      packages: page.packages,
      path: page.path,
      section: page.section,
      title: page.title,
      wordCount: markdownWordCount(markdown)
    }
  })

  const contentIndex = {
    pages,
    release: {
      family: packageReference.release.family,
      packageCount: packageReference.release.packageCount,
      publicationAuthorized: packageReference.release.publicationAuthorized,
      status: packageReference.release.status
    },
    schemaVersion: 1,
    sections: SECTION_IDS.map((id) => ({
      id,
      pageIds: pages
        .filter((page) => page.section.toLowerCase() === id)
        .map((page) => page.id)
    }))
  }

  const sourceMap = {
    pages: content.pages.map((page) => ({
      id: page.id,
      pageSha256: pages.find(({ id }) => id === page.id).contentSha256,
      sources: page.sources.map((sourcePath) => ({
        path: sourcePath,
        sha256: sha256(readSource(root, sourcePath))
      }))
    })),
    schemaVersion: 1
  }

  const apiIndex = {
    packages: packageReference.packages.map((packageRecord) => ({
      frameworkDependencies: packageRecord.frameworkDependencies,
      guideId: packageRecord.guideId,
      guidePath: packageRecord.guidePath,
      name: packageRecord.name,
      publicEntries: packageRecord.publicEntries,
      version: packageRecord.version
    })),
    schemaVersion: 1
  }

  return {
    apiIndex,
    contentIndex,
    llms: serializeLlms({ contentIndex }),
    sourceMap
  }
}

const serializedBundle = (bundle) => ({
  apiIndex: serializeJson(bundle.apiIndex),
  contentIndex: serializeJson(bundle.contentIndex),
  llms: bundle.llms,
  sourceMap: serializeJson(bundle.sourceMap)
})

export const writePublicDocumentation = async ({ repositoryRoot }) => {
  await writePublicPackageReference({ repositoryRoot })
  const bundle = await createPublicDocumentationBundle({ repositoryRoot })
  const serialized = serializedBundle(bundle)
  for (const [key, relativePath] of Object.entries(
    PUBLIC_DOCUMENTATION_PATHS
  )) {
    fs.mkdirSync(path.dirname(path.join(repositoryRoot, relativePath)), {
      recursive: true
    })
    fs.writeFileSync(path.join(repositoryRoot, relativePath), serialized[key])
  }
  return bundle
}

export const checkPublicDocumentation = async ({ repositoryRoot }) => {
  await checkPublicPackageReference({ repositoryRoot })
  const bundle = await createPublicDocumentationBundle({ repositoryRoot })
  const serialized = serializedBundle(bundle)
  for (const [key, relativePath] of Object.entries(
    PUBLIC_DOCUMENTATION_PATHS
  )) {
    const artifactPath = path.join(repositoryRoot, relativePath)
    if (!fs.existsSync(artifactPath)) {
      throw new Error(
        `${relativePath} is missing; generate public documentation`
      )
    }
    if (fs.readFileSync(artifactPath, 'utf8') !== serialized[key]) {
      throw new Error(
        `${relativePath} is stale; regenerate public documentation`
      )
    }
  }
  return bundle
}

const isDirectInvocation =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectInvocation) {
  const [mode, ...unexpected] = process.argv.slice(2)
  if (!['--check', '--write'].includes(mode) || unexpected.length > 0) {
    throw new Error(
      'Usage: node scripts/docs/public-documentation.mjs --check|--write'
    )
  }
  const repositoryRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../..'
  )
  const bundle =
    mode === '--write'
      ? await writePublicDocumentation({ repositoryRoot })
      : await checkPublicDocumentation({ repositoryRoot })
  process.stdout.write(
    `Public documentation ${
      mode === '--write' ? 'written' : 'current'
    }: ${bundle.contentIndex.pages.length} pages, ${
      bundle.apiIndex.packages.length
    } packages\n`
  )
}
