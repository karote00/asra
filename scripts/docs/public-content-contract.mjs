import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

import {
  isApprovedDocumentationSource,
  readApprovedDocumentationInputs
} from './public-documentation-inputs.mjs'

const require = createRequire(import.meta.url)
const inspector = require('../../docs/ai/framework/plans/asyra-public-package-documentation-flow-inspector.data.cjs')

export const PUBLIC_CONTENT_MANIFEST_PATH = 'docs/public/content-manifest.json'
export const PUBLIC_CONTENT_SCHEMA_PATH =
  'docs/public/schema/content-manifest.schema.json'

const PAGE_KEYS = [
  'description',
  'id',
  'packages',
  'path',
  'section',
  'sources',
  'title'
]

const START_PAGE_IDS = new Set([
  'start/create-design-app',
  'start/preset-2d',
  'cases/asyra-design'
])

const CONCEPT_PAGE_IDS = new Set([
  'learn/information-models',
  'learn/intent-and-features',
  'learn/canonical-state',
  'learn/transactions-and-durability',
  'learn/validation-load-migration',
  'learn/projection-registration-replacement',
  'learn/runtime-boundaries-roadmap'
])

const EXTEND_PAGE_IDS = new Set([
  'start/extend-with-ai',
  'build/custom-schema',
  'build/feature-session',
  'build/hierarchy-groups',
  'build/persistence-migration',
  'build/collaboration',
  'build/ai-actions',
  'build/app-retrieval-action'
])

const CUSTOMIZE_PAGE_IDS = new Set([
  'start/custom-composition',
  'build/render-boundary'
])

const freeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value
  }
  Object.freeze(value)
  Object.values(value).forEach(freeze)
  return value
}

const assertUniqueStrings = ({ label, values }) => {
  if (
    !Array.isArray(values) ||
    values.some((value) => typeof value !== 'string' || value.length === 0) ||
    new Set(values).size !== values.length
  ) {
    throw new Error(`${label} must contain unique non-empty strings`)
  }
}

const expectedSection = (id) => {
  if (id === 'overview') return 'Overview'
  if (START_PAGE_IDS.has(id)) return 'Start'
  if (CONCEPT_PAGE_IDS.has(id)) return 'Concepts'
  if (EXTEND_PAGE_IDS.has(id)) return 'Extend'
  if (CUSTOMIZE_PAGE_IDS.has(id)) return 'Customize'
  if (id.startsWith('reference/')) return 'Reference'
  throw new Error(`Unknown public documentation section for ${id}`)
}

export const validatePublicContentManifest = ({
  inputs,
  manifest,
  repositoryRoot
}) => {
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.pages)) {
    throw new Error(
      'Public content manifest must use schemaVersion 1 and pages'
    )
  }
  const ids = manifest.pages.map(({ id }) => id)
  if (JSON.stringify(ids) !== JSON.stringify(inspector.pageIds)) {
    throw new Error(
      'Public content manifest must match the exact ordered page inventory'
    )
  }

  const packageNames = new Set(inputs.packages.map(({ name }) => name))
  const paths = new Set()

  for (const page of manifest.pages) {
    if (
      JSON.stringify(Object.keys(page).sort()) !== JSON.stringify(PAGE_KEYS)
    ) {
      throw new Error(`${page.id} must use the exact public page metadata keys`)
    }
    if (
      typeof page.title !== 'string' ||
      page.title.length === 0 ||
      typeof page.description !== 'string' ||
      page.description.length === 0
    ) {
      throw new Error(`${page.id} requires a title and description`)
    }
    const expectedPath = page.id === 'overview' ? 'index.md' : `${page.id}.md`
    if (page.path !== expectedPath || page.path.includes('..')) {
      throw new Error(`${page.id} must use its stable Markdown path`)
    }
    if (paths.has(page.path)) {
      throw new Error(`${page.path} is owned by more than one page`)
    }
    paths.add(page.path)
    if (page.section !== expectedSection(page.id)) {
      throw new Error(`${page.id} has an invalid section`)
    }

    assertUniqueStrings({ label: `${page.id} sources`, values: page.sources })
    assertUniqueStrings({ label: `${page.id} packages`, values: page.packages })
    if (page.sources.length === 0) {
      throw new Error(`${page.id} requires at least one canonical source`)
    }
    for (const source of page.sources) {
      if (!isApprovedDocumentationSource(source)) {
        throw new Error(`${page.id} maps an unapproved source: ${source}`)
      }
      if (!fs.existsSync(path.join(repositoryRoot, source))) {
        throw new Error(`${page.id} maps a missing source: ${source}`)
      }
    }
    for (const name of page.packages) {
      if (!packageNames.has(name)) {
        throw new Error(`${page.id} maps an unknown package: ${name}`)
      }
    }
    if (page.id.startsWith('reference/packages/')) {
      const expectedPackage = `@asyra/${page.id.slice(
        'reference/packages/'.length
      )}`
      if (page.packages.length !== 1 || page.packages[0] !== expectedPackage) {
        throw new Error(`${page.id} must map exactly ${expectedPackage}`)
      }
    }
  }

  return freeze(manifest)
}

export const readPublicContentContract = async ({ repositoryRoot }) => {
  const root = path.resolve(repositoryRoot)
  const schemaPath = path.join(root, PUBLIC_CONTENT_SCHEMA_PATH)
  if (!fs.existsSync(schemaPath)) {
    throw new Error(
      `Public content schema is missing: ${PUBLIC_CONTENT_SCHEMA_PATH}`
    )
  }
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'))
  if (schema.$id !== 'https://asyra.dev/schemas/content-manifest.schema.json') {
    throw new Error('Public content schema requires its stable public id')
  }
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, PUBLIC_CONTENT_MANIFEST_PATH), 'utf8')
  )
  const inputs = await readApprovedDocumentationInputs({ repositoryRoot: root })
  return validatePublicContentManifest({
    inputs,
    manifest,
    repositoryRoot: root
  })
}
