const assert = require('node:assert/strict')
const fs = require('node:fs')
const crypto = require('node:crypto')
const path = require('node:path')
const test = require('node:test')

const data = require('../asyra-website-landing-flow-inspector.data.cjs')
const repoRoot = path.resolve(__dirname, '../../../../..')

const step = (id) => {
  const value = data.steps.find((item) => item.id === id)
  assert.ok(value, `Missing Website Landing Inspector step: ${id}`)
  return value
}

test('result-first Landing authority resolves only the current contract and workspace', () => {
  Object.values(data.authority).forEach((filePath) => {
    assert.ok(fs.existsSync(path.join(repoRoot, filePath)), filePath)
  })
  assert.equal(
    data.authority.visualReferencePath,
    'docs/ai/framework/website/asyra-landing-v04-approved.png'
  )
  const reference = fs.readFileSync(
    path.join(repoRoot, data.authority.visualReferencePath)
  )
  assert.equal(
    crypto.createHash('sha256').update(reference).digest('hex'),
    'e43980029f7bee21f5580d0f58b6869e4dec42fb5e7c84fb98c5b2b7bf7abd3b'
  )
  assert.equal('platformInspectorPath' in data.authority, false)
})

test('result-first Landing owns thirteen exact and unique product cases', () => {
  assert.deepEqual(data.caseIds, [
    'desktop-editorial-composition',
    'mobile-single-column-reflow',
    'result-first-hero',
    'unlimited-domain-examples',
    'grow-without-rebuild',
    'shared-human-ai-action-path',
    'one-source-across-views',
    'connected-site-actions',
    'responsive-transparent-raster-assets',
    'perceptually-sharp-raster-rendering',
    'open-source-2026-footer',
    'no-client-reduced-motion-reading',
    'machine-readable-discovery'
  ])
  assert.equal(new Set(data.caseIds).size, 13)
})

test('contract replaces every previous website surface with the approved V04 page', () => {
  const source = JSON.stringify(step('freeze-result-first-contract'))
  assert.match(source, /V04.*authority for the retained composition/i)
  assert.match(source, /V09 closing concept.*explicit closing exception/i)
  assert.match(source, /existing committed and uncommitted website UI/i)
  assert.match(source, /environment setup/i)
  assert.match(source, /supporting route destination/i)
  assert.match(source, /2026.*open source/i)
  assert.match(source, /adaptive CSS engineering grid/i)
  assert.match(source, /alpha-derived drop shadow/i)
  assert.match(source, /asset-specific directional shadow decision/i)
  assert.match(source, /local-only artwork decision/i)
  assert.match(source, /Git-ignored.*default CI/i)
  assert.match(source, /committed public derivatives/i)
  assert.match(source, /eighteen selected public derivatives/i)
  assert.match(source, /published at \/llms\.txt/i)
  assert.match(source, /supporting human-facing routes.*Website Platform/i)
  assert.doesNotMatch(source, /without restoring removed human-facing content routes/i)
})

test('page owner selects the supplied true-alpha masters with one adaptive grid-and-shadow stage', () => {
  const owner = step('render-result-first-page')
  const source = JSON.stringify(owner)
  assert.match(source, /outcome before implementation detail/i)
  assert.match(source, /product-owner-supplied Photoroom true-alpha master/i)
  assert.match(source, /source-bounded lossless responsive WebP/i)
  assert.match(source, /premultiplied-alpha resizing/i)
  assert.match(source, /minimum 1\.1 source pixels/i)
  assert.match(source, /clamp-scaled minor and major grid lines/i)
  assert.match(source, /intersection nodes/i)
  assert.match(source, /alpha-derived drop-shadow depth/i)
  assert.match(
    source,
    /contact and cast shadows.*per-illustration lower-right perspective vector/i
  )
  assert.match(source, /dark stages.*blue ambient reflection/i)
  assert.match(source, /decoration only.*never recreate/i)
  assert.match(source, /edge-contrast sharpness oracle/i)
  assert.match(source, /fresh high-resolution rendering/i)
  assert.match(source, /approved V04 composition and topology/i)
  assert.match(source, /modern system sans/i)
  assert.match(source, /weight 500 or below/i)
  assert.match(source, /object count, topology, connector/i)
  assert.match(source, /labels and simple domain icons.*raster-composited/i)
  assert.match(source, /continuous domain rail/i)
  assert.match(source, /both edge assemblies/i)
  assert.match(source, /protected domain core/i)
  assert.match(source, /continuous blue infrastructure loop/i)
  assert.match(source, /four symmetric directional bridges/i)
  assert.match(source, /repeating a crop/i)
  assert.match(source, /supplied transparent closing master/i)
  assert.match(source, /no unreviewed generative topology drift/i)
  assert.match(source, /without JavaScript/i)
  assert.match(source, /code-drawn SVG/i)
  assert.match(source, /CSS-drawn internal diagram topology/i)
  assert.match(source, /closing-grid-v07-desktop raster.*never selected/i)
  assert.match(source, /Rejected V07 desktop.*never selected/i)
  assert.match(source, /rejected V08 Grow.*never selected/i)
  assert.match(source, /Rejected V09 Grow.*never selected/i)
  assert.match(source, /Rejected V10 Grow.*never selected/i)
  assert.match(source, /V11 through V14 Grow.*preserved.*never selected/i)
  assert.match(source, /retired Visible Change assets.*never selected/i)
  assert.equal(
    owner.implementationBoundary.includes(
      'apps/asyra-framework-site/app/impact-preview.tsx'
    ),
    false
  )
  assert.ok(
    owner.implementationBoundary.includes(
      'apps/asyra-framework-site/public/illustrations'
    )
  )
  assert.ok(
    owner.implementationBoundary.includes(
      'apps/asyra-framework-site/public/llms.txt'
    )
  )
  assert.ok(
    owner.implementationBoundary.includes(
      'scripts/docs/public-documentation.mjs'
    )
  )
  assert.ok(
    owner.implementationBoundary.includes(
      'apps/asyra-framework-site/artwork/v06'
    )
  )
  assert.ok(
    owner.implementationBoundary.includes(
      'apps/asyra-framework-site/artwork/v07'
    )
  )
  assert.ok(
    owner.implementationBoundary.includes(
      'apps/asyra-framework-site/scripts/build-closing-v07-superres.py'
    )
  )
  assert.ok(
    owner.implementationBoundary.includes(
      'apps/asyra-framework-site/artwork/v08'
    )
  )
  assert.ok(
    owner.implementationBoundary.includes(
      'apps/asyra-framework-site/scripts/build-closing-v08-geometric.py'
    )
  )
  assert.ok(
    owner.implementationBoundary.includes(
      'apps/asyra-framework-site/artwork/v09'
    )
  )
  assert.ok(
    owner.implementationBoundary.includes(
      'apps/asyra-framework-site/scripts/build-closing-v09-concept.py'
    )
  )
  assert.ok(
    owner.implementationBoundary.includes(
      'apps/asyra-framework-site/artwork/v14-desktop'
    )
  )
  assert.ok(
    owner.implementationBoundary.includes(
      'apps/asyra-framework-site/scripts/build-v06-assets.py'
    )
  )
  assert.ok(
    owner.implementationBoundary.includes(
      'apps/asyra-framework-site/artwork/v07-desktop'
    )
  )
  assert.ok(
    owner.implementationBoundary.includes(
      'apps/asyra-framework-site/scripts/build-v07-desktop-assets.py'
    )
  )
  assert.ok(
    owner.implementationBoundary.includes(
      'apps/asyra-framework-site/artwork/v08-desktop'
    )
  )
  assert.ok(
    owner.implementationBoundary.includes(
      'apps/asyra-framework-site/scripts/build-v08-desktop-assets.py'
    )
  )
  assert.ok(
    owner.implementationBoundary.includes(
      'apps/asyra-framework-site/artwork/v09-desktop'
    )
  )
  assert.ok(
    owner.implementationBoundary.includes(
      'apps/asyra-framework-site/scripts/build-v09-grow-desktop.py'
    )
  )
  assert.ok(
    owner.implementationBoundary.includes(
      'apps/asyra-framework-site/artwork/v10-desktop'
    )
  )
  assert.ok(
    owner.implementationBoundary.includes(
      'apps/asyra-framework-site/scripts/build-v10-grow-desktop.py'
    )
  )
  assert.ok(
    owner.implementationBoundary.includes(
      'apps/asyra-framework-site/artwork/v11-desktop'
    )
  )
  assert.ok(
    owner.implementationBoundary.includes(
      'apps/asyra-framework-site/scripts/build-v11-grow-desktop.py'
    )
  )
  assert.equal(
    owner.implementationBoundary.includes(
      'apps/asyra-framework-site/app/illustrations.tsx'
    ),
    false
  )
  assert.ok(
    owner.implementationBoundary.includes(
      'apps/asyra-framework-site/artwork/photoroom'
    )
  )
  assert.ok(
    owner.implementationBoundary.includes(
      'apps/asyra-framework-site/scripts/build-photoroom-assets.py'
    )
  )
})

test('verification requires synchronized production visual evidence', () => {
  const owner = step('verify-result-first-page')
  const source = JSON.stringify(owner)
  assert.match(
    source,
    /full-page and section-level 1440px, 864px, 820px, 390px, and 320px/i
  )
  assert.match(source, /default, hover, and focus CTA states/i)
  assert.match(
    source,
    /adaptive CSS grid and alpha-derived drop shadow.*2048px, 1440px, 864px, 820px, 390px, and 320px/i
  )
  assert.match(
    source,
    /six distinct computed shadow vectors.*2048px, 1440px, 864px, 820px, 390px, and 320px/i
  )
  assert.match(
    source,
    /default CI validates committed public derivatives without local artwork/i
  )
  assert.match(source, /ASYRA_LOCAL_ARTWORK_TESTS=1/i)
  assert.match(source, /immutable-master hashes.*local build-source contracts/i)
  assert.match(source, /true-alpha.*source-bounded width/i)
  assert.match(source, /No-client and reduced-motion/i)
  assert.match(source, /retired change-impact sections remain absent/i)
  assert.match(source, /edge-contrast sharpness oracles/i)
  assert.match(source, /development-server-only evidence/i)
  assert.match(source, /claiming visual completion without inspecting output/i)
  assert.match(source, /public \/llms\.txt response exactly matches/i)
  assert.ok(owner.implementationBoundary.includes('.gitignore'))
  assert.ok(
    owner.implementationBoundary.includes(
      'apps/asyra-framework-site/package.json'
    )
  )
})

test('steps, routes, artifacts, failure owners, and cache declarations resolve', () => {
  const stepIds = new Set(data.steps.map(({ id }) => id))
  const artifactOwners = new Map(
    data.artifacts.map(({ id, ownerStepId }) => [id, ownerStepId])
  )

  assert.equal(stepIds.size, data.steps.length)
  data.steps.forEach((item) => {
    assert.deepEqual(item.cacheDimensions, [])
    assert.equal(item.failureOwnerStepId, item.id)
    assert.ok(item.implementationBoundary.length > 0)
    assert.ok(item.specRefs.length > 0)
  })
  data.routes.forEach((route) => {
    assert.ok(stepIds.has(route.from))
    assert.ok(stepIds.has(route.to))
    route.producedArtifacts.forEach((artifactId) => {
      assert.equal(artifactOwners.get(artifactId), route.from)
    })
  })
})

test('Landing invariants preserve broad domains and open-source identity', () => {
  const source = JSON.stringify(data.invariants)
  assert.match(source, /any field/i)
  assert.match(source, /never decides its domain/i)
  assert.match(source, /same action path/i)
  assert.match(source, /2026.*open source/i)
  assert.match(source, /no company identity/i)
  assert.match(
    source,
    /Production deployment occurs only after every Landing gate passes/i
  )
})
