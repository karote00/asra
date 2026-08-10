import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { loadContentBundle } from '../lib/content.mjs'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (filePath) => fs.readFileSync(path.join(appRoot, filePath), 'utf8')

test('public routes do not expose executable validation examples', () => {
  const bundle = loadContentBundle()
  assert.equal(
    fs.existsSync(path.join(appRoot, 'app/examples/page.tsx')),
    false
  )
  assert.equal('examples' in bundle, false)
  assert.equal('runtime' in bundle, false)
})

test('Asyra Design route preserves reference-product and URL boundaries', () => {
  const bundle = loadContentBundle()
  const source = read('app/asyra-design/page.tsx')
  const instrument = read('components/evidence-product-instrument.tsx')
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
  assert.match(source, /EvidenceProductInstrument/)
  assert.match(instrument, /REFERENCE PRODUCT \/ COMPOSITION MAP/)
  assert.match(instrument, /Your App/)
  assert.match(instrument, /Asyra Framework/)
})

test('Releases route derives all candidate facts and package rows', () => {
  const bundle = loadContentBundle()
  const source = read('app/releases/page.tsx')
  assert.equal(bundle.packages.length, 19)
  assert.equal(bundle.release.status, 'CANDIDATE')
  assert.equal(bundle.release.publicationAuthorized, false)
  assert.match(source, /bundle\.packages\.map/)
  assert.match(source, /bundle\.release\.status/)
  assert.match(source, /release-register/)
  assert.match(source, /Publication authority/)
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
  assert.match(source, /roadmap-axis/)
  assert.match(source, /Current infrastructure/)
  assert.match(source, /Future runtime/)
})

test('supporting route hero uses the Revision 2 contract instrument', () => {
  const source = read('components/evidence-hero.tsx')
  assert.match(source, /evidence-hero__instrument/)
  assert.match(source, /PUBLIC CONTRACT/)
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
