const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const data = require('../ai-conversational-drawing-performance-flow-inspector.data.cjs')
const repoRoot = path.resolve(__dirname, '../../../../../..')

const step = (id) => {
  const value = data.steps.find((item) => item.id === id)
  assert.ok(value, `Missing Inspector step: ${id}`)
  return value
}

const contractText = (owner) =>
  [
    owner.purpose,
    ...owner.inputs,
    ...owner.outputs,
    ...owner.conditions,
    ...owner.bypasses,
    ...owner.allowedContributors,
    ...owner.forbiddenContributors,
    ...owner.implementationBoundary
  ].join(' ')

const read = (relativePath) =>
  fs.readFileSync(path.resolve(repoRoot, relativePath), 'utf8')

test('performance Inspector authorities resolve and stay immutable', () => {
  const plan = read(data.authority.specPath)

  assert.equal(
    data.target.id,
    'asyra-design-ai-conversational-drawing-performance'
  )
  assert.equal(
    data.authority.specPath,
    'docs/ai/apps/asyra-design/plans/ai-conversational-drawing-performance-plan.md'
  )
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.specPath)))
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.inspectorPath)))
  assert.ok(Object.isFrozen(data))
  assert.ok(data.steps.every(Object.isFrozen))
  assert.doesNotMatch(
    plan,
    /docs\/ai\/framework\/plans\/completed\/canonical-projection-and-collaboration-contract-realignment-plan\.md/
  )
})

test('formal performance evidence uses production detached queries and named harness spans', () => {
  const owner = step('evaluate-performance-and-equivalence')
  const text = contractText(owner)

  assert.match(
    text,
    /production performance profile.*detached canonical.*history.*Factory transaction-status.*commit.*publication/i
  )
  assert.match(text, /dev-only window\.__Core__.*cannot satisfy/i)
  assert.match(
    text,
    /navigation.*App readiness.*collaboration readiness.*Mock AI.*reference attachment.*runtime evidence.*history baselines.*harness spans/i
  )
  assert.doesNotMatch(text, /persistence baseline/i)
  ;[
    'apps/asyra-design/e2e',
    'apps/asyra-design/playwright.collaboration.config.ts',
    'apps/asyra-design/src/init/performance/ai-drawing-performance-profile.ts',
    'apps/asyra-design/src/init/__tests__'
  ].forEach((boundary) =>
    assert.ok(owner.implementationBoundary.includes(boundary), boundary)
  )
})

test('performance plan and BDD retain the production evidence boundary', () => {
  const plan = read(data.authority.specPath)
  const feature = read(
    'docs/ai/apps/asyra-design/bdd-features/ai-conversational-drawing-performance.feature'
  )

  assert.match(
    plan,
    /Production evidence uses the dedicated AI drawing performance profile[\s\S]*dev-only `window\.__Core__`[\s\S]*cannot satisfy a release gate/i
  )
  assert.match(
    feature,
    /Scenario: Production performance evidence remains detached from dev-only globals[\s\S]*production performance profile[\s\S]*window\.__Core__[\s\S]*harness spans/i
  )
})

test('local progressive drawing paints exact bounds before cooperative canonical batches', () => {
  const owner = step('stage-local-interactive-composition')
  const proofOwner = step('evaluate-local-interactive-drawing')
  const text = contractText(owner)
  const proofText = contractText(proofOwner)
  const plan = read(data.authority.specPath)
  const feature = read(
    'docs/ai/apps/asyra-design/bdd-features/ai-conversational-drawing-performance.feature'
  )

  assert.match(
    text,
    /validated.*bounds.*runtime-only.*loading.*DOM.*paint opportunity.*before.*canonical mutation/i
  )
  assert.match(
    text,
    /point.*element-count.*budget/i
  )
  assert.match(
    text,
    /multiple deterministic plural Core batches.*one outer App transaction.*one intended history action/i
  )
  assert.match(
    text,
    /successful.*batch.*ordinary.*projection.*progress.*later browser task.*AbortSignal/i
  )
  assert.match(text, /CSS.*transform.*opacity.*compositor/i)
  assert.match(
    text,
    /atomic.*one all-children.*progressive.*multiple.*plural/i
  )
  assert.match(
    text,
    /clear.*success.*failure.*cancel.*rollback/i
  )
  assert.match(
    text,
    /App-owned document interaction lock.*before.*outer App transaction.*pan.*zoom.*block.*document mutation/i
  )
  assert.match(
    text,
    /viewport navigation.*ordinary Feature execution.*no canonical mutation.*history.*AI action.*transaction evidence/i
  )
  assert.doesNotMatch(
    text,
    /navigation.*never joins the AI transaction/i
  )
  assert.match(
    text,
    /release.*success.*failure.*cancel.*teardown/i
  )
  assert.ok(
    owner.forbiddenContributors.includes(
      'AI-only renderer or canonical loading placeholder'
    )
  )
  assert.ok(
    owner.forbiddenContributors.includes(
      'loading, progress, or slice-policy parameters in Core, Props Manager, or Scene Tree'
    )
  )
  ;[
    'Canvas or Render-owned loading overlay',
    'JavaScript per-frame loading animation',
    'microtask-only progressive yield',
    'one timeout scheduled independently for every planned range'
  ].forEach((contributor) =>
    assert.ok(owner.forbiddenContributors.includes(contributor), contributor)
  )
  assert.ok(
    owner.implementationBoundary.includes('apps/asyra-design/src/constants')
  )
  assert.ok(
    owner.implementationBoundary.includes('apps/asyra-design/src/render-app')
  )
  assert.ok(
    owner.implementationBoundary.includes(
      'docs/ai/apps/asyra-design/API_SURFACES.md'
    )
  )
  assert.match(
    proofText,
    /one fresh single Actor.*one empty canonical document.*one 7,112-element.*one terminal exact canonical summary/i
  )
  assert.match(
    proofText,
    /connected DOM.*non-zero/i
  )
  assert.match(
    proofText,
    /longest canonical work unit.*cooperative yield count/i
  )
  assert.match(
    proofText,
    /Contents.*collaboration.*second Actor.*CRDT.*excluded.*No IndexedDB.*repeated measured run/i
  )
  assert.ok(
    data.routes.some(
      (route) =>
        route.from === 'stage-local-interactive-composition' &&
        route.to === 'apply-canonical-property-scene-batch' &&
        route.producedArtifacts.includes(
          'artifact:composition-batch-sequence'
        )
    )
  )
  assert.ok(
    data.routes.some(
      (route) =>
        route.from === 'stage-local-interactive-composition' &&
        route.to === 'evaluate-local-interactive-drawing' &&
        route.producedArtifacts.includes('artifact:app-bulk-timing')
    )
  )
  assert.ok(
    data.routes.some(
      (route) =>
        route.from === 'stage-local-interactive-composition' &&
        route.to === 'evaluate-local-interactive-drawing' &&
        route.producedArtifacts.includes(
          'artifact:local-drawing-progress-state'
        )
    )
  )
  assert.ok(
    data.artifacts.some(
      (artifact) =>
        artifact.id === 'artifact:local-interactive-drawing-proof' &&
        artifact.ownerStepId === 'evaluate-local-interactive-drawing' &&
        artifact.terminal
      )
  )
  assert.ok(
    data.artifacts.some(
      (artifact) =>
        artifact.id === 'artifact:local-drawing-progress-state' &&
        /DOM compositor overlay/i.test(artifact.channel)
    )
  )

  assert.match(
    plan,
    /Current Local Interactive Drawing Closure[\s\S]*single Actor[\s\S]*Contents[\s\S]*CRDT[\s\S]*IndexedDB/i
  )
  assert.match(
    plan,
    /Exact-Bounds Loading Frame[\s\S]*DOM[\s\S]*CSS[\s\S]*paint opportunity[\s\S]*before canonical mutation/i
  )
  assert.match(
    plan,
    /Cooperative Progressive Composition[\s\S]*point[\s\S]*element-count[\s\S]*later browser task[\s\S]*one outer transaction[\s\S]*one intended Undo/i
  )
  assert.match(
    plan,
    /Document Interaction Lock[\s\S]*pan[\s\S]*zoom[\s\S]*document mutation[\s\S]*success[\s\S]*failure[\s\S]*cancellation[\s\S]*teardown/i
  )
  assert.match(
    feature,
    /Scenario: Exact-bounds loading state precedes local drawing[\s\S]*runtime-only[\s\S]*DOM[\s\S]*compositor/i
  )
  assert.match(
    feature,
    /connected App DOM overlay.*before any canonical element[\s\S]*ordinary Vector/i
  )
  assert.match(
    feature,
    /Scenario: Local progressive composition becomes visible in cooperative batches[\s\S]*point and element-count[\s\S]*later browser task[\s\S]*one outer transaction[\s\S]*one Undo/i
  )
  assert.match(
    feature,
    /Scenario: Drawing progress keeps navigation responsive while edits stay locked[\s\S]*pan[\s\S]*zoom[\s\S]*document mutation[\s\S]*one Undo/i
  )
})

test('demo documents load empty without client persistence', () => {
  const owner = step('load-empty-demo-document')
  const localProofOwner = step('evaluate-local-interactive-drawing')
  const text = contractText(owner)
  const plan = read(data.authority.specPath)
  const feature = read(
    'docs/ai/apps/asyra-design/bdd-features/ai-conversational-drawing-performance.feature'
  )

  assert.match(
    text,
    /ordinary local.*collaboration.*without.*persistence provider.*capture.*save.*IndexedDB/i
  )
  assert.match(text, /load.*canonical empty document/i)
  assert.doesNotMatch(text, /ordinary non-collaboration.*FILE.*unchanged/i)
  assert.ok(
    !localProofOwner.inputs.includes('artifact:empty-memory-demo-document')
  )
  assert.ok(
    !data.routes.some(
      (route) =>
        route.from === 'load-empty-demo-document' &&
        route.to === 'evaluate-local-interactive-drawing'
    )
  )
  assert.doesNotMatch(
    JSON.stringify(data),
    /bypass-collaboration-client-persistence|artifact:collaboration-client-persistence-bypass/
  )
  assert.doesNotMatch(JSON.stringify(data), /persist-local-commit-snapshots/)
  assert.doesNotMatch(
    JSON.stringify(data),
    /artifact:(?:local-commit-snapshot-trigger|committed-persistence-snapshots|persistence-timing)/
  )
  assert.match(
    plan,
    /Demo Client Persistence Bypass[\s\S]*ordinary local[\s\S]*collaboration[\s\S]*zero client persistence/i
  )
  assert.match(
    feature,
    /Scenario: Demo documents load empty without client persistence[\s\S]*ordinary local[\s\S]*collaboration[\s\S]*IndexedDB/i
  )
})
