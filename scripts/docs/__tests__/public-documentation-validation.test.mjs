import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  validateMarkdownLinks,
  validatePublicDocumentation,
  validatePublicImportMentions
} from '../public-documentation-validation.mjs'

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..'
)

test('complete public documentation passes structural, link, and API gates', async () => {
  const summary = await validatePublicDocumentation({ repositoryRoot })

  assert.equal(summary.pageCount, 41)
  assert.equal(summary.packageGuideCount, 19)
  assert.equal(summary.advancedGuideCount, 15)
  assert.ok(summary.typescriptSnippetCount >= 15)
  assert.ok(summary.localLinkCount > 100)
  assert.ok(summary.apiReferenceCount > 50)
  assert.equal(summary.unownedMarkdownCount, 0)
})

test('public guides do not retain malformed copy fragments', () => {
  const hierarchyGuide = fs.readFileSync(
    path.join(repositoryRoot, 'docs/public/build/hierarchy-groups.md'),
    'utf8'
  )

  assert.doesNotMatch(hierarchyGuide, /\bThe public\s+The\b/)
})

test('link validation rejects missing and escaping targets', () => {
  assert.throws(
    () =>
      validateMarkdownLinks({
        filePath: path.join(repositoryRoot, 'docs/public/index.md'),
        repositoryRoot,
        source: '[missing](missing-page.md)'
      }),
    /broken local link/
  )
  assert.throws(
    () =>
      validateMarkdownLinks({
        filePath: path.join(repositoryRoot, 'docs/public/index.md'),
        repositoryRoot,
        source: '[outside](../../../../outside.md)'
      }),
    /escapes the repository/
  )
})

test('public import validation rejects private and unsupported subpaths', () => {
  const apiIndex = {
    packages: [
      {
        name: '@asyra/core',
        publicEntries: ['.', './contracts']
      }
    ]
  }
  assert.throws(
    () =>
      validatePublicImportMentions({
        apiIndex,
        pageId: 'test/private',
        source: 'Use `@asyra/core/src/core`.'
      }),
    /private package path/
  )
  assert.throws(
    () =>
      validatePublicImportMentions({
        apiIndex,
        pageId: 'test/unsupported',
        source: 'Use `@asyra/core/unknown`.'
      }),
    /unsupported public subpath/
  )
})
