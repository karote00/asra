const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const data = require('../asyra-website-launch-and-operations-flow-inspector.data.cjs')

const repoRoot = path.resolve(__dirname, '../../../../..')
const step = (id) => {
  const value = data.steps.find((item) => item.id === id)
  assert.ok(value, `Missing Launch Inspector step: ${id}`)
  return value
}

test('Launch authority paths resolve without treating ignored provider state as authority', () => {
  Object.values(data.authority).forEach((filePath) => {
    assert.ok(fs.existsSync(path.join(repoRoot, filePath)), filePath)
  })
})

test('Launch owns six exact and unique public release cases', () => {
  assert.deepEqual(data.caseIds, [
    'distinct-project-preservation',
    'integrated-preview-acceptance',
    'immutable-production-candidate',
    'production-indexing-metadata',
    'anonymous-production-surface',
    'rollback-readiness'
  ])
  assert.equal(new Set(data.caseIds).size, data.caseIds.length)
})

test('contract freezes a dedicated target, immutable source, exclusions, and failure behavior', () => {
  const source = JSON.stringify(step('freeze-launch-contract'))
  assert.match(source, /dedicated Vercel project/i)
  assert.match(source, /never mutates the existing Asyra Design project/i)
  assert.match(source, /One exact source commit/i)
  assert.match(
    source,
    /Custom DNS, analytics, monitoring vendors, new secrets, and package publication remain excluded/i
  )
  assert.match(source, /secret value in repository or logs/i)
})

test('accepted Preview owns every tracked launch input before its commit is frozen', () => {
  const preview = step('accept-integrated-preview')
  const source = JSON.stringify(preview)
  assert.match(source, /clean, pushed, immutable/i)
  assert.match(
    source,
    /Build, typecheck, lint, tests, routes, accessibility, performance, visual review, Atlas, clean-consumer, and release-readiness gates pass/i
  )
  ;[
    'apps/asyra-framework-site/vercel.json',
    'apps/asyra-framework-site/next.config.ts',
    'apps/asyra-framework-site/app/layout.tsx',
    'apps/asyra-framework-site/app/robots.ts',
    'apps/asyra-framework-site/app/sitemap.ts',
    'apps/asyra-framework-site/__tests__/launch.test.mjs',
    'apps/asyra-framework-site/__tests__/e2e/launch-production.spec.ts',
    'apps/asyra-framework-site/scripts/production-smoke.mjs'
  ].forEach((filePath) => {
    assert.ok(preview.implementationBoundary.includes(filePath), filePath)
  })
})

test('dedicated target configuration changes provider state without changing accepted source', () => {
  const target = step('configure-vercel-target')
  const source = JSON.stringify(target)
  assert.match(source, /org and project ids differ/i)
  assert.match(source, /NEXT_PUBLIC_SITE_INDEXING=true.*only.*production/i)
  assert.match(source, /No token, secret, or provider credential/i)
  assert.match(source, /root \.vercel link mutation/i)
  assert.match(source, /tracked website source or configuration change/i)
  assert.deepEqual(target.implementationBoundary, [
    'authenticated Vercel project and environment operations',
    'docs/ai/framework/plans/asyra-website-launch-and-operations-plan.md',
    '.vercel/project.json read-only; never mutate'
  ])
})

test('deployment uses the accepted source, stable alias, and a real rollback path', () => {
  const source = JSON.stringify(step('deploy-accepted-candidate'))
  assert.match(
    source,
    /deployed source commit equals the accepted Preview commit/i
  )
  assert.match(source, /stable production alias/i)
  assert.match(source, /prior healthy deployment remains resolvable/i)
  assert.match(source, /first project deployment.*unpromote\/delete-current/i)
  assert.match(source, /dirty or different source commit/i)
})

test('production verification is anonymous, indexed, complete, and fail closed', () => {
  const source = JSON.stringify(step('verify-production'))
  assert.match(source, /stable alias and immutable deployment use TLS/i)
  assert.match(source, /Robots permits production indexing/i)
  assert.match(
    source,
    /Every public route, search path, advanced guide, release fact, Roadmap, Asyra Design link, and Runtime Atlas case works anonymously/i
  )
  assert.match(
    source,
    /Security, cache, accessibility, responsive, reduced-motion, performance, and failure behavior gates pass/i
  )
  assert.match(
    source,
    /Provider authentication.*never substitutes anonymous checks/i
  )
  assert.match(source, /failed candidate left promoted/i)
})

test('operations record remains exact without inventing excluded monitoring', () => {
  const source = JSON.stringify(step('record-launch-operations'))
  assert.match(source, /public URL and source commit are exact/i)
  assert.match(source, /Rollback uses recorded provider deployment identity/i)
  assert.match(source, /No analytics or monitoring ownership is implied/i)
  assert.match(source, /credential or secret value/i)
})

test('Launch routes, artifacts, failures, and cache boundaries resolve', () => {
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

test('Launch invariants preserve project separation, indexing, secrets, rollback, and exclusions', () => {
  const source = JSON.stringify(data.invariants)
  assert.match(
    source,
    /Framework site project and Asyra Design project remain distinct/i
  )
  assert.match(source, /one exact source commit/i)
  assert.match(source, /Only production permits indexing/i)
  assert.match(
    source,
    /No credential, secret, private endpoint, or internal-only document/i
  )
  assert.match(source, /restores or unpromotes/i)
  assert.match(
    source,
    /Custom DNS, analytics, monitoring vendors, new secrets, and package publication remain excluded/i
  )
})
