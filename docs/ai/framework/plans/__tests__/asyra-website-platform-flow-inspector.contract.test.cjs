const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const data = require('../asyra-website-platform-flow-inspector.data.cjs')

const repoRoot = path.resolve(__dirname, '../../../../..')
const step = (id) => {
  const value = data.steps.find((item) => item.id === id)
  assert.ok(value, `Missing Website Platform Inspector step: ${id}`)
  return value
}

test('platform authority and accepted handoffs resolve', () => {
  ;[
    data.authority.specPath,
    data.authority.inspectorPath,
    data.authority.contentManifestPath,
    data.authority.contentIndexPath,
    data.authority.sourceMapPath,
    data.authority.packageReferencePath,
    data.authority.visualHandoffPath
  ].forEach((filePath) => {
    assert.ok(fs.existsSync(path.join(repoRoot, filePath)), filePath)
  })
})

test('toolchain is exact and preserves the repository runtime', () => {
  assert.deepEqual(data.toolchain, {
    next: '16.3.0',
    react: '19.1.0',
    reactDom: '19.1.0',
    tailwindcss: '4.3.3',
    tailwindPostcss: '4.3.3',
    lucideReact: '1.31.0',
    typescript: '5.8.3',
    node: '24.x',
    yarn: '4.3.1'
  })
  const source = JSON.stringify(step('freeze-platform-contract'))
  assert.match(source, /without upgrading existing tools/i)
  assert.match(source, /unapproved dependency or hosted service/i)
})

test('required route and failure cases are exact and unique', () => {
  assert.deepEqual(data.routeIds, [
    'docs',
    'asyra-design',
    'releases',
    'roadmap',
    'landing-foundation',
    'atlas-foundation',
    'not-found',
    'content-failure',
    'unsupported-browser'
  ])
  assert.equal(new Set(data.routeIds).size, data.routeIds.length)
})

test('site foundation owns web structure without downstream product meaning', () => {
  const source = JSON.stringify(step('establish-site-foundation'))
  assert.match(source, /server-first, keyboard ordered/i)
  assert.match(source, /localization resilient/i)
  assert.match(source, /Landing and Atlas receive placeholders/i)
  assert.match(source, /generated raster production assets/i)
  assert.match(source, /external font, UI kit, analytics, or CMS/i)
  assert.match(source, /eslint\.config\.js/i)
})

test('content adapter fails closed on drift and semantic rewrite', () => {
  const source = JSON.stringify(step('load-public-content'))
  assert.match(source, /All forty-one public pages resolve exactly once/i)
  assert.match(source, /cryptographic source and page digests/i)
  assert.match(source, /visibly provisional/i)
  assert.match(source, /never fabricates fallback product copy/i)
  assert.match(source, /semantic rewrite by the presentation adapter/i)
  assert.doesNotMatch(source, /example inventory/i)
})

test('documentation owns server reading and bounded browser enhancements', () => {
  const documentationStep = step('present-documentation')
  const source = JSON.stringify(documentationStep)
  assert.match(source, /renders without client JavaScript/i)
  assert.match(source, /stable page and heading ids/i)
  assert.match(source, /focus-contained, Escape-closeable/i)
  assert.match(source, /accepted page bytes and canonical source links/i)
  assert.match(source, /hosted search/i)
  assert.ok(
    documentationStep.implementationBoundary.includes(
      'apps/asyra-framework-site/app/globals.css'
    )
  )
  assert.ok(
    documentationStep.implementationBoundary.includes(
      'apps/asyra-framework-site/__tests__/docs.test.mjs'
    )
  )
})

test('supporting routes preserve App, release, and roadmap boundaries', () => {
  const source = JSON.stringify(step('present-supporting-routes'))
  assert.match(source, /reference product rather than the Framework owner/i)
  assert.match(source, /non-empty fileId/i)
  assert.match(source, /manifest-derived and visibly provisional/i)
  assert.match(source, /Future non-visible runtime remains Roadmap/i)
  assert.match(source, /unverified app URL/i)
  assert.doesNotMatch(source, /Examples resolve|example inventories/i)
})

test('shared foundations stay independent from Landing and Atlas owners', () => {
  const sharedStep = step('expose-shared-foundations')
  const source = JSON.stringify(sharedStep)
  assert.match(source, /without inherited product story or runtime behavior/i)
  assert.match(source, /never fabricate output/i)
  assert.match(source, /Landing narrative implementation/i)
  assert.match(source, /Atlas executable cases or runtime state/i)
  assert.match(source, /without a global loading\.tsx streaming boundary/i)
  assert.match(source, /future asynchronous route owns a local Suspense/i)
  assert.match(source, /hidden until client JavaScript executes/i)
  assert.ok(
    sharedStep.implementationBoundary.includes(
      'apps/asyra-framework-site/app/layout.tsx'
    )
  )
  assert.equal(
    sharedStep.implementationBoundary.includes(
      'apps/asyra-framework-site/app/loading.tsx'
    ),
    false
  )
})

test('verification requires executable and synchronized evidence', () => {
  const source = JSON.stringify(step('verify-platform'))
  assert.match(source, /Strict typecheck, lint, focused tests/i)
  assert.match(source, /production build, and route smoke gates/i)
  assert.match(source, /synchronized visual cases/i)
  assert.match(source, /All forty-one content pages/i)
  assert.match(source, /Production deployment remains owned/i)
  assert.match(source, /manual inspection as sole evidence/i)
})

test('routes, artifacts, failure owners, and cache boundaries resolve', () => {
  const stepIds = new Set(data.steps.map(({ id }) => id))
  const artifactOwners = new Map(
    data.artifacts.map(({ id, ownerStepId }) => [id, ownerStepId])
  )
  assert.equal(stepIds.size, data.steps.length)
  assert.equal(artifactOwners.size, data.artifacts.length)

  data.steps.forEach((item) => {
    assert.deepEqual(item.cacheDimensions, [], item.id)
    assert.equal(item.failureOwnerStepId, item.id)
    assert.ok(item.implementationBoundary.length > 0)
    assert.ok(item.specRefs.length > 0)
  })
  data.routes.forEach((route) => {
    assert.ok(stepIds.has(route.from), route.id)
    assert.ok(stepIds.has(route.to), route.id)
    route.producedArtifacts.forEach((artifactId) => {
      assert.equal(artifactOwners.get(artifactId), route.from, route.id)
    })
  })
})

test('global audience, semantic authority, and deployment boundaries persist', () => {
  const source = JSON.stringify(data.invariants)
  assert.match(source, /global non-engineer/i)
  assert.match(source, /never rewrites accepted content semantics/i)
  assert.match(source, /Landing narrative and Runtime Atlas execution remain downstream/i)
  assert.match(source, /never production assets/i)
  assert.match(source, /No production deployment occurs/i)
})
