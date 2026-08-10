import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { loadContentBundle } from '../lib/content.mjs'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (filePath) => fs.readFileSync(path.join(appRoot, filePath), 'utf8')

test('Examples route presents the exact maintained inventory', () => {
  const bundle = loadContentBundle()
  const source = read('app/examples/page.tsx')
  assert.equal(bundle.examples.length, 11)
  assert.match(source, /bundle\.examples\.map/)
  assert.match(source, /example\.runCommand/)
  assert.match(source, /example\.expectedResult/)
  assert.match(source, /example\.source/)
})

test('Asyra Design route preserves reference-product and URL boundaries', () => {
  const bundle = loadContentBundle()
  const source = read('app/asyra-design/page.tsx')
  assert.match(source, /Reference product, not Framework owner/i)
  assert.match(source, /pageById\.get\('cases\/asyra-design'\)/)
  assert.match(source, /verifiedLandingFacts\.designApp\.href/)
  assert.match(
    source,
    /Verified \{verifiedLandingFacts\.designApp\.verifiedAt\}/
  )
  assert.doesNotMatch(source, /No public Asyra Design deployment URL/i)
  assert.doesNotMatch(
    source,
    new RegExp(`https?://(?:www\\.)?${bundle.repositoryName}`, 'i')
  )
})

test('Releases route derives all candidate facts and package rows', () => {
  const bundle = loadContentBundle()
  const source = read('app/releases/page.tsx')
  assert.equal(bundle.packages.length, 19)
  assert.equal(bundle.release.status, 'CANDIDATE')
  assert.equal(bundle.release.publicationAuthorized, false)
  assert.match(source, /bundle\.packages\.map/)
  assert.match(source, /bundle\.release\.status/)
  assert.doesNotMatch(source, /releaseDate|publishedAt|latestVersion/)
})

test('Roadmap route states that future non-visible runtime is not current support', () => {
  const source = read('app/roadmap/page.tsx')
  assert.match(source, /Non-visible, AI-facing information products/i)
  assert.match(
    source,
    /not a current\s+public Headless Core or Core Kernel\s+contract/i
  )
  assert.match(source, /pageById\.get\('learn\/runtime-boundaries-roadmap'\)/)
})

test('status legend distinguishes current, App-owned, and roadmap meanings by shape', () => {
  const source = read('components/status-legend.tsx')
  assert.match(source, /data-status="current"/)
  assert.match(source, /data-status="app"/)
  assert.match(source, /data-status="roadmap"/)
  assert.match(source, /Current Framework/)
  assert.match(source, /App-owned possibility/)
  assert.match(source, /Verified roadmap/)
})
