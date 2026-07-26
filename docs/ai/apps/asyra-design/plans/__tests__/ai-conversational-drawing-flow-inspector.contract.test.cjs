const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const data = require('../ai-conversational-drawing-flow-inspector.data.cjs')
const repoRoot = path.resolve(__dirname, '../../../../../..')

const requiredStepFields = [
  'id',
  'order',
  'laneId',
  'title',
  'ownerPackage',
  'purpose',
  'inputs',
  'outputs',
  'conditions',
  'bypasses',
  'allowedContributors',
  'forbiddenContributors',
  'cacheDimensions',
  'implementationBoundary',
  'specRefs',
  'failureOwnerStepId'
]

const requiredStepIds = [
  'accept-mock-conversation-intent',
  'manage-one-conversation-turn',
  'produce-deterministic-mock-candidate',
  'orchestrate-runtime-preflight-and-progress',
  'resolve-app-confirmation',
  'execute-one-app-composition-transaction',
  'persist-committed-document-snapshot',
  'project-conversation-and-current-history'
]

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

const anchorForHeading = (heading) =>
  heading
    .trim()
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

test('Conversational AI Inspector authorities and active-plan routing resolve', () => {
  assert.equal(
    data.target.title,
    'Asyra Design Conversational AI Mock Drawing Inspector'
  )
  assert.equal(
    data.authority.specPath,
    'docs/ai/apps/asyra-design/plans/ai-conversational-drawing-plan.md'
  )
  assert.equal(
    data.authority.inspectorPath,
    'docs/ai/apps/asyra-design/plans/ai-conversational-drawing-flow-inspector.data.cjs'
  )
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.specPath)))
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.inspectorPath)))
  assert.ok(
    fs.existsSync(
      path.resolve(
        __dirname,
        '../ai-conversational-drawing-flow-inspector.html'
      )
    )
  )
  assert.ok(Object.isFrozen(data))
  assert.ok(data.steps.every(Object.isFrozen))

  const plansIndex = fs.readFileSync(
    path.resolve(repoRoot, 'docs/ai/apps/asyra-design/PLANS.md'),
    'utf8'
  )
  assert.match(
    plansIndex,
    /Current active plan:\s+`plans\/ai-conversational-drawing-plan\.md`/
  )
  assert.match(
    plansIndex,
    /ai-conversational-drawing-flow-inspector\.data\.cjs/
  )
})

test('Conversational AI Inspector exposes the eight exact owner steps', () => {
  assert.deepEqual(
    new Set(data.steps.map((item) => item.id)),
    new Set(requiredStepIds)
  )

  const laneIds = new Set(data.lanes.map((item) => item.id))
  const stepIds = new Set(requiredStepIds)
  data.steps.forEach((item) => {
    assert.deepEqual(Object.keys(item), requiredStepFields)
    assert.ok(laneIds.has(item.laneId), `${item.id} lane`)
    assert.ok(stepIds.has(item.failureOwnerStepId), `${item.id} failure owner`)
    assert.deepEqual(item.cacheDimensions, [], `${item.id} unjustified cache`)
    ;[
      'inputs',
      'outputs',
      'conditions',
      'bypasses',
      'allowedContributors',
      'forbiddenContributors',
      'implementationBoundary',
      'specRefs'
    ].forEach((field) => {
      assert.ok(item[field].length > 0, `${item.id} empty ${field}`)
    })
  })
})

test('implementation roots and specification anchors resolve', () => {
  const markdown = fs.readFileSync(
    path.resolve(repoRoot, data.authority.specPath),
    'utf8'
  )
  const anchors = new Set(
    markdown
      .split('\n')
      .filter((line) => /^#{1,6}\s+/.test(line))
      .map((line) => anchorForHeading(line.replace(/^#{1,6}\s+/, '')))
  )

  ;[
    ...data.steps.flatMap((item) => item.specRefs),
    ...data.invariants.flatMap((item) => item.specRefs),
    ...data.acceptanceContracts.flatMap((item) => item.specRefs)
  ].forEach((reference) => {
    assert.match(reference, /^#[a-z0-9-]+$/)
    assert.ok(anchors.has(reference.slice(1)), `missing anchor ${reference}`)
  })

  data.steps.forEach((item) => {
    item.implementationBoundary.forEach((boundary) => {
      assert.ok(
        fs.existsSync(path.resolve(repoRoot, boundary)),
        `${item.id} missing implementation root ${boundary}`
      )
    })
  })
})

test('mock mode and provider boundary stay explicit, deterministic, and inert by default', () => {
  const intake = contractText(step('accept-mock-conversation-intent'))
  const provider = contractText(step('produce-deterministic-mock-candidate'))

  assert.match(intake, /Exact ai=mock/)
  assert.match(intake, /Meta\/Ctrl\+I toggle shortcut/)
  assert.match(intake, /Context Menu Toggle Agent Panel/)
  assert.match(intake, /opening focuses the prompt.*closing restores/i)
  assert.match(intake, /unknown AI modes construct no AI UI or runtime/)
  assert.match(intake, /without trimmed text emits no Feature or provider/)
  assert.match(intake, /file selection.*drag-and-drop/i)
  assert.match(intake, /PNG, JPEG, and WebP/)
  assert.match(intake, /removable accessible thumbnails/)
  assert.match(intake, /never uploaded.*canonical document state/i)
  assert.match(
    intake,
    /Selecting Balanced detail or Maximum detail.*exactly one new App-owned selection intent.*original settled-turn attachments/i
  )
  assert.match(intake, /never rereads, reuploads.*second request path/i)
  assert.match(
    intake,
    /active-turn exclusion prevents double submission.*older clarification.*no longer exposes actionable choice buttons/i
  )
  assert.match(
    intake,
    /non-latest clarification.*disposed controller.*active turn emits no new UI intent/i
  )
  assert.match(intake, /read failures.*no Feature or provider/i)
  assert.match(intake, /disables Send and attachment changes/i)
  assert.match(intake, /second turn is rejected rather than queued/)
  assert.match(intake, /default production or generated-app AI activation/)

  assert.match(provider, /deterministic fixture/)
  assert.match(provider, /finite.*abortable delay/i)
  assert.match(
    provider,
    /draw-this-image phrase with at least one accepted detached image attachment.*request_drawing_detail_choice/i
  )
  assert.match(
    provider,
    /Balanced detail selection intent.*7,111 ordinary editable VTracer-derived polygon items/i
  )
  assert.match(
    provider,
    /Maximum detail selection intent.*27,471 valid ordinary editable VTracer-derived polygon items.*295,794 canonical points/i
  )
  assert.match(
    provider,
    /exact English draw-only-the-cat instruction.*pure-white ordinary editable background Vector.*uploaded image intrinsic pixel width and height/i
  )
  assert.match(
    provider,
    /without an accepted detached image attachment.*no action/i
  )
  assert.match(provider, /raw image data never enters action arguments/i)
  assert.match(provider, /cat-face.*eye-size.*whisker-color.*pupil-color/i)
  assert.match(provider, /apps\/asyra-design\/e2e/)
  assert.match(provider, /network fetch.*model SDK.*API key/i)
  assert.match(provider, /never contains fabricated private chain-of-thought/)
})

test('runtime progress is observational and confirmation is an app-owned visible wait', () => {
  const runtime = contractText(
    step('orchestrate-runtime-preflight-and-progress')
  )
  const confirmation = contractText(step('resolve-app-confirmation'))

  assert.match(runtime, /stable redacted operational phases/)
  assert.match(runtime, /Observer exceptions are contained/)
  assert.match(runtime, /cannot alter retry, permission, confirmation/)
  assert.match(runtime, /raw provider body.*chain-of-thought/i)
  assert.match(
    runtime,
    /complete provider candidate validates before permission/
  )

  assert.match(confirmation, /visibly enters waiting-for-confirmation state/)
  assert.match(confirmation, /undoability.*destructive or external impact/i)
  assert.match(
    confirmation,
    /does not show verbose action arguments by default/
  )
  assert.match(
    confirmation,
    /Feature abort.*app teardown.*releases the pending wait/i
  )
  assert.match(confirmation, /mandatory complete low-level action listing/)
  assert.match(confirmation, /visual ghost scene/)
})

test('App execution owns bounded creation, incremental updates, partial commit, and fatal rollback', () => {
  const conversation = contractText(step('manage-one-conversation-turn'))
  const execution = contractText(
    step('execute-one-app-composition-transaction')
  )

  assert.match(conversation, /revalidated against current canonical state/)
  assert.match(conversation, /never falls back to deleting and regenerating/)
  assert.match(
    conversation,
    /non-authoritative semantic role to element-id hints/
  )
  assert.match(
    conversation,
    /non-negative monotonic duration from accepted submission through settlement/
  )

  assert.match(execution, /strict validated batch descriptor/)
  assert.match(
    execution,
    /request_drawing_detail_choice.*no provider-selected labels.*structured no-change evidence/i
  )
  assert.match(
    execution,
    /clarification action performs no common-API or canonical mutation.*no history commit/i
  )
  assert.match(execution, /App-generated canonical ids/)
  assert.match(
    execution,
    /without artificial item, subpath, per-path point, or composition point-count ceilings/
  )
  assert.match(
    execution,
    /App common API and Core injected Scene Tree batch-add request.*memory-bounded internal chunks.*never the accepted total item, subpath, or point count/i
  )
  assert.match(
    execution,
    /creates one canonical Group.*before streaming ordered child batches directly into that Group.*parent membership once per internal chunk.*one intended undo entry/i
  )
  assert.match(
    execution,
    /clone-free internal canonical write.*instead of generic Setter cloneDeep.*discarded raw-change capture.*ADD_ELEMENT records remain the sole transaction, replay, undo\/redo, Render, persistence/i
  )
  assert.match(
    execution,
    /retains every original workspace topology point.*group-local computed bounds.*does not materialize the complete composition in the workspace.*27,471-child move.*900-second live E2E budget/i
  )
  assert.match(
    execution,
    /Vector eye geometry scales every existing canonical anchor\/control point.*preserving element, point, segment, network, and subpath ids/i
  )
  assert.match(
    execution,
    /whisker stroke color.*pupil primary fill color.*ordinary App common APIs/i
  )
  assert.match(execution, /packages\/core\/src/)
  assert.match(execution, /packages\/scene-tree\/src/)
  assert.match(
    execution,
    /Render hierarchy placement precedes the ordinary Preset Vector strategy/
  )
  assert.match(
    execution,
    /Preset Group projection preserves every Vector workspace point/
  )
  assert.match(
    execution,
    /packages\/render\/src\/layers\/scene\/render-layer\.ts/
  )
  assert.match(execution, /packages\/preset\/src\/components\/vector\.ts/)
  assert.match(execution, /Recoverable.*skipped.*resolved partial result/i)
  assert.match(execution, /one intended undo entry/)
  assert.match(execution, /Executor rejection.*canonical consistency/i)
  assert.match(execution, /rolls back rollbackable writes/)
  assert.match(execution, /catching rollback-only fatal failure/)
  assert.match(
    execution,
    /Missing, duplicated, unknown, or exact atomic aiDelivery.*transaction-end shared delivery.*only after the outer transaction commits/i
  )
  assert.match(
    execution,
    /Exact progressive aiDelivery.*ordinary immediate shared delivery.*point-aware child batch.*256-item transient maximum.*2,048-canonical-point soft target.*over-target element remains one accepted batch.*total items, paths, and points remain unlimited/i
  )
  assert.match(
    execution,
    /progressive multi-target update yields after each applied canonical update.*peer.*before the Agent turn settles/i
  )
  assert.match(
    execution,
    /same one outer app transaction and one intended local undo entry.*never.*network batches into separate history actions/i
  )
  assert.match(
    execution,
    /Factory retains the source shared-delivery mode.*Undo and Redo replay.*linked Factory compensation/i
  )
  assert.match(execution, /packages\/factory\/src/)
  assert.match(execution, /AI-specific publication protocol/)
})

test('high-detail commit persistence is capacity-appropriate and keeps Core ownership', () => {
  const persistence = contractText(
    step('persist-committed-document-snapshot')
  )

  assert.match(persistence, /framework IndexedDB provider/)
  assert.match(persistence, /not constrained by localStorage quota/)
  assert.match(
    persistence,
    /preserve.*ids, topology, hierarchy, styles, bounds, and document version/i
  )
  assert.match(
    persistence,
    /legacy localStorage key.*removes the legacy key only after the durable write succeeds/i
  )
  assert.match(persistence, /Core remains the sole commit-time snapshot/)
  assert.match(persistence, /persistence-failed.*separate from runtime commit/i)
  assert.match(
    persistence,
    /Attachments, conversation turns, progress, semantic target hints.*never enter/i
  )
  assert.match(persistence, /packages\/persistence\/src/)
  assert.match(persistence, /apps\/asyra-design\/src\/document-persistence\.ts/)
})

test('Message Bar controls only the current AI history action through app APIs', () => {
  const projection = contractText(
    step('project-conversation-and-current-history')
  )

  assert.match(projection, /applicable top history action/)
  assert.match(
    projection,
    /exact settled request_drawing_detail_choice no-change result.*Balanced detail.*Maximum detail.*element and point counts/i
  )
  assert.match(
    projection,
    /Maximum visibly warns.*temporarily use much more memory.*reduce App responsiveness/i
  )
  assert.match(
    projection,
    /never presents provider wording.*raw attachment data.*action arguments.*canonical state/i
  )
  assert.match(
    projection,
    /Malformed, unknown, provider-invented, or incomplete clarification evidence.*no detail options/i
  )
  assert.match(
    projection,
    /without any You or Mock AI speaker\/provider labels/
  )
  assert.match(projection, /panel header, messages, or Message Bar/)
  assert.match(
    projection,
    /recorded duration as a concise elapsed-time summary/
  )
  assert.match(projection, /After successful Undo.*offers Redo/i)
  assert.match(
    projection,
    /later committed action invalidates an older AI history control/
  )
  assert.match(projection, /app history APIs.*Factory replay/i)
  assert.match(projection, /UI stores no inverse, snapshot, or replay patch/)
  assert.match(projection, /zero-mutation turns expose no enabled Undo/)
})

test('Conversational AI Gherkin contract is registered and covers agreed product decisions', () => {
  const featureDirectory = path.resolve(
    repoRoot,
    'docs/ai/apps/asyra-design/bdd-features'
  )
  const featureName = 'ai-conversational-drawing.feature'
  const featurePath = path.join(featureDirectory, featureName)
  const index = fs.readFileSync(
    path.join(featureDirectory, 'README.md'),
    'utf8'
  )
  const feature = fs.readFileSync(featurePath, 'utf8')

  assert.ok(fs.existsSync(featurePath))
  assert.match(index, new RegExp(featureName.replace('.', '\\.')))
  assert.match(feature, /exact "ai=mock" mode/)
  assert.match(feature, /畫一個貓臉/)
  assert.match(feature, /把眼睛放大一點/)
  assert.match(feature, /把鬍鬚改成藍色/)
  assert.match(feature, /private chain-of-thought/)
  assert.match(feature, /recoverable missing or duplicate item/)
  assert.match(feature, /Fatal canonical failure rolls back/)
  assert.match(feature, /Confirmation waits visibly/)
  assert.match(
    feature,
    /Message Bar Undo and Redo follow the current history top/
  )
  assert.match(feature, /exact "ai=mock&aiDelivery=progressive" mode/)
  assert.match(
    feature,
    /selects atomic or progressive collaboration delivery without splitting history/
  )
  assert.match(
    feature,
    /Factory canonical replay should retain the source delivery mode and batch boundaries/
  )
  assert.match(feature, /survives browser reload/)
  assert.match(feature, /acknowledge the complete snapshot in IndexedDB/)
  assert.match(
    feature,
    /legacy value should be removed only after the IndexedDB write succeeds/
  )

  data.steps.forEach((item) => {
    assert.ok(
      item.implementationBoundary.includes(
        'docs/ai/apps/asyra-design/bdd-features'
      ),
      `${item.id} must allow synchronized Gherkin contracts`
    )
  })
})

test('completed Gate 4 clarification remains compatible and points to the successor plan', () => {
  const completedPlan = fs.readFileSync(
    path.resolve(
      repoRoot,
      'docs/ai/framework/plans/completed/ai-agent-runtime-plan.md'
    ),
    'utf8'
  )
  const packageContract = fs.readFileSync(
    path.resolve(repoRoot, 'docs/ai/framework/packages/ai-agent-runtime.md'),
    'utf8'
  )
  const goldenPath = fs.readFileSync(
    path.resolve(
      repoRoot,
      'docs/ai/framework/golden-paths/compose-ai-agent-runtime.md'
    ),
    'utf8'
  )

  assert.match(completedPlan, /Post-Closeout Clarification/)
  assert.match(
    completedPlan,
    /resolved executor result.*recoverable partial-item/s
  )
  assert.match(completedPlan, /rejected\/throwing executor.*fatal/s)
  assert.match(
    completedPlan,
    /apps\/asyra-design\/plans\/ai-conversational-drawing-plan\.md/
  )

  assert.match(packageContract, /recoverable partial-item evidence/)
  assert.match(packageContract, /rejected\/throwing executor/)
  assert.match(packageContract, /does not require an app.*visual preview/s)

  assert.match(goldenPath, /recoverable partial result/)
  assert.match(goldenPath, /rejected\/throwing executor is fatal/)
})
