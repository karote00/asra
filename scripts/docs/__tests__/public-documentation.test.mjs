import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  checkPublicDocumentation,
  createPublicDocumentationBundle
} from '../public-documentation.mjs'

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..'
)

test('public indexes derive the exact page, source, and API inventories', async () => {
  const bundle = await createPublicDocumentationBundle({ repositoryRoot })

  assert.equal(bundle.contentIndex.schemaVersion, 1)
  assert.equal(bundle.contentIndex.pages.length, 41)
  assert.equal(bundle.sourceMap.pages.length, 41)
  assert.equal(bundle.apiIndex.packages.length, 19)
  assert.deepEqual(
    bundle.contentIndex.sections.map(({ id }) => id),
    ['overview', 'start', 'learn', 'build', 'reference', 'cases']
  )

  for (const page of bundle.contentIndex.pages) {
    assert.match(page.contentSha256, /^[a-f0-9]{64}$/)
    assert.ok(page.wordCount > 0)
    assert.ok(page.headings.length > 1)
    assert.ok(fs.existsSync(path.join(repositoryRoot, page.markdownPath)))
    assert.equal('examples' in page, false)
  }
  for (const page of bundle.sourceMap.pages) {
    assert.ok(page.sources.length > 0)
    for (const source of page.sources) {
      assert.match(source.sha256, /^[a-f0-9]{64}$/)
      assert.ok(fs.existsSync(path.join(repositoryRoot, source.path)))
      assert.doesNotMatch(
        source.path,
        /\/(audits|decisions|plans\/completed|task-breakdowns)\//
      )
    }
  }
  for (const packageRecord of bundle.apiIndex.packages) {
    assert.deepEqual(
      packageRecord.entries.map(({ path: entryPath }) => entryPath),
      packageRecord.publicEntries
    )
    for (const entry of packageRecord.entries) {
      if (entry.path.endsWith('.css')) {
        assert.deepEqual(entry.symbols, [])
        assert.deepEqual(entry.members, [])
      } else {
        assert.ok(entry.symbols.length > 0)
        assert.deepEqual(entry.symbols, [...entry.symbols].sort())
        assert.deepEqual(entry.members, [...entry.members].sort())
      }
    }
  }
  const core = bundle.apiIndex.packages.find(
    ({ name }) => name === '@asyra/core'
  )
  assert.ok(
    core.entries
      .find(({ path: entryPath }) => entryPath === '.')
      .symbols.includes('Core')
  )
  assert.ok(
    core.entries
      .find(({ path: entryPath }) => entryPath === './contracts')
      .symbols.includes('SharedPublication')
  )
  assert.ok(
    core.entries
      .find(({ path: entryPath }) => entryPath === '.')
      .members.includes('defineSystemProperty')
  )
})

test('llms discovery is public-only and states the current/future boundary', async () => {
  const { llms } = await createPublicDocumentationBundle({ repositoryRoot })

  assert.match(llms, /^# Asyra Framework/m)
  assert.match(llms, /41 public Markdown pages/)
  assert.match(llms, /Current: browser\/Core/)
  assert.match(llms, /Future: Headless Core and Core Kernel/)
  assert.doesNotMatch(llms, /docs\/ai\//)
  assert.doesNotMatch(llms, /AI_PROVIDER_API_KEY|ws:\/\/|package-private/)
  assert.equal((llms.match(/^- \[/gm) ?? []).length, 41)
})

test('checked public documentation artifacts are deterministic and current', async () => {
  const bundle = await checkPublicDocumentation({ repositoryRoot })
  assert.equal(bundle.contentIndex.pages.length, 41)
  assert.equal(bundle.apiIndex.packages.length, 19)
})
