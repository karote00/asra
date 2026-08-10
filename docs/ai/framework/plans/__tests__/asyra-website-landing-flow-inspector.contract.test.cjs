const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const data = require('../asyra-website-landing-flow-inspector.data.cjs')

const repoRoot = path.resolve(__dirname, '../../../../..')
const step = (id) => {
  const value = data.steps.find((item) => item.id === id)
  assert.ok(value, `Missing Website Landing Inspector step: ${id}`)
  return value
}

test('Landing authority resolves the accepted platform, content, examples, and visual handoff', () => {
  Object.values(data.authority).forEach((filePath) => {
    assert.ok(fs.existsSync(path.join(repoRoot, filePath)), filePath)
  })
})

test('Landing owns fourteen exact, unique product cases', () => {
  assert.deepEqual(data.caseIds, [
    'global-desktop-first-layer',
    'global-mobile-first-layer',
    'working-product-entry',
    'framework-learning-entry',
    'custom-product-entry',
    'deterministic-path',
    'ownership-explorer',
    'optional-composition',
    'app-domain-possibilities',
    'future-machine-facing-roadmap',
    'asyra-design-reference',
    'release-policy-evidence',
    'reduced-motion-equivalence',
    'no-client-basic-narrative'
  ])
  assert.equal(new Set(data.caseIds).size, 14)
})

test('verified Asyra Design fact is public, dated, and evidence-backed', () => {
  assert.deepEqual(data.verifiedFacts.designApp, {
    href: 'https://asra.vercel.app',
    title: 'Asyra Design',
    verifiedAt: '2026-08-10',
    evidence:
      'GitHub deployment 5820501003 reported Production success; the stable alias returned an anonymous document titled Asyra Design.'
  })
  assert.doesNotMatch(data.verifiedFacts.designApp.href, /-projects\.vercel\.app/)
})

test('contract freezes global plain-language order and exact evidence', () => {
  const source = JSON.stringify(step('freeze-landing-contract'))
  assert.match(source, /first layer explains outcome, creator ownership/i)
  assert.match(source, /plain international English/i)
  assert.match(source, /fourteen product cases are exact/i)
  assert.match(source, /generated facts, or recorded external verification/i)
  assert.match(source, /Runtime Atlas output or duplicated executable case/i)
  assert.match(source, /unapproved dependency/i)
})

test('global narrative keeps domains App-owned and future work explicit', () => {
  const narrative = step('present-global-narrative')
  const source = JSON.stringify(narrative)
  assert.match(source, /understandable without package or API knowledge/i)
  assert.match(source, /Desktop and mobile retain the same narrative/i)
  assert.match(source, /App-owned possibilities rather than built-ins/i)
  assert.match(source, /Machine-facing information products are visibly Roadmap/i)
  assert.match(source, /HTML, CSS, and SVG only/i)
  assert.match(source, /generated raster or external media/i)
  assert.ok(
    narrative.implementationBoundary.includes(
      'apps/asyra-framework-site/app/page.tsx'
    )
  )
})

test('ownership explanation preserves canonical owners and Atlas boundary', () => {
  const ownership = step('explain-ownership-composition')
  const source = JSON.stringify(ownership)
  assert.match(source, /keyboard, touch, focus, and screen-reader operable/i)
  assert.match(source, /Factory transaction to canonical owners/i)
  assert.match(source, /Preset and Provider are optional dashed composition/i)
  assert.match(source, /never fabricates a run result/i)
  assert.match(source, /Without client JavaScript/i)
  assert.match(source, /Framework package runtime imported into Landing/i)
})

test('entries and evidence use generated facts and the verified public alias', () => {
  const entry = step('connect-entry-evidence')
  const source = JSON.stringify(entry)
  assert.match(source, /working-product beginner path/i)
  assert.match(source, /Framework-learning paths/i)
  assert.match(source, /derive from the content bundle/i)
  assert.match(source, /verified public alias/i)
  assert.match(source, /security, license, release, roadmap, and contribution-policy/i)
  assert.match(source, /protected deployment URL/i)
  assert.ok(
    entry.implementationBoundary.includes(
      'apps/asyra-framework-site/lib/landing-facts.mjs'
    )
  )
})

test('verification requires semantic, responsive, performance, and visual evidence', () => {
  const source = JSON.stringify(step('verify-landing'))
  assert.match(source, /Inspector, semantic tests, strict typecheck, lint/i)
  assert.match(source, /320px/i)
  assert.match(source, /200 percent zoom/i)
  assert.match(source, /synchronized live visual cases/i)
  assert.match(source, /fourteen exact product cases/i)
  assert.match(source, /Production deployment remains owned/i)
  assert.match(source, /manual inspection as sole evidence/i)
})

test('Landing routes, artifacts, failure owners, and cache boundaries resolve', () => {
  const stepIds = new Set(data.steps.map(({ id }) => id))
  const artifactOwners = new Map(
    data.artifacts.map(({ id, ownerStepId }) => [id, ownerStepId])
  )

  assert.equal(stepIds.size, data.steps.length)
  assert.equal(artifactOwners.size, data.artifacts.length)
  data.steps.forEach((item) => {
    assert.deepEqual(item.cacheDimensions, [], item.id)
    assert.equal(item.failureOwnerStepId, item.id)
    assert.ok(item.implementationBoundary.length > 0, item.id)
    assert.ok(item.specRefs.length > 0, item.id)
  })
  data.routes.forEach((route) => {
    assert.ok(stepIds.has(route.from), route.id)
    assert.ok(stepIds.has(route.to), route.id)
    route.producedArtifacts.forEach((artifactId) => {
      assert.equal(artifactOwners.get(artifactId), route.from, route.id)
    })
  })
})

test('Landing invariants preserve audience, ownership, roadmap, and deployment boundaries', () => {
  const source = JSON.stringify(data.invariants)
  assert.match(source, /worldwide non-engineer/i)
  assert.match(source, /complementary entry paths/i)
  assert.match(source, /never become built-in Framework claims/i)
  assert.match(source, /remain Roadmap/i)
  assert.match(source, /never executes or fabricates Runtime Atlas evidence/i)
  assert.match(source, /never production assets/i)
  assert.match(source, /No production deployment occurs/i)
})
