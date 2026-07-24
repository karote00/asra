const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const data = require('../group-context-menu-flow-inspector.data.cjs')
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

const anchorForHeading = (heading) =>
  heading
    .trim()
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

test('Group Context Menu Inspector authorities resolve', () => {
  assert.equal(data.target.title, 'Asyra Design Group Context Menu Inspector')
  assert.equal(
    data.authority.specPath,
    'docs/ai/apps/asyra-design/plans/group-context-menu-plan.md'
  )
  assert.equal(
    data.authority.inspectorPath,
    'docs/ai/apps/asyra-design/plans/group-context-menu-flow-inspector.data.cjs'
  )
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.specPath)))
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.inspectorPath)))
  assert.ok(
    fs.existsSync(
      path.resolve(__dirname, '../group-context-menu-flow-inspector.html')
    )
  )
  assert.ok(Object.isFrozen(data))
  assert.ok(data.steps.every(Object.isFrozen))
})

test('Group Context Menu Inspector exposes the six required owner steps', () => {
  const requiredFields = [
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
    'intake-canvas-context-event',
    'manage-app-menu-session',
    'project-group-command-descriptors',
    'present-design-system-context-menu',
    'handoff-enabled-command-to-feature',
    'teardown-isolate-menu-instance'
  ]

  assert.deepEqual(
    new Set(data.steps.map((step) => step.id)),
    new Set(requiredStepIds)
  )

  const laneIds = new Set(data.lanes.map((item) => item.id))
  const stepIds = new Set(requiredStepIds)
  data.steps.forEach((item) => {
    assert.deepEqual(Object.keys(item), requiredFields)
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

test('every route and artifact has one resolvable owner-consumer handoff', () => {
  const stepIds = new Set(data.steps.map((item) => item.id))
  const artifactIds = new Set(data.artifacts.map((item) => item.id))

  assert.equal(artifactIds.size, data.artifacts.length, 'duplicate artifact id')
  assert.equal(
    new Set(data.routes.map((item) => item.id)).size,
    data.routes.length,
    'duplicate route id'
  )

  data.steps.forEach((item) => {
    item.inputs
      .filter((input) => input.startsWith('artifact:'))
      .forEach((id) => assert.ok(artifactIds.has(id), `${item.id} input ${id}`))
    item.outputs.forEach((id) =>
      assert.ok(artifactIds.has(id), `${item.id} output ${id}`)
    )
  })

  data.routes.forEach((route) => {
    assert.ok(stepIds.has(route.from), `${route.id} from`)
    if (route.to) assert.ok(stepIds.has(route.to), `${route.id} to`)
    route.producedArtifacts.forEach((id) => {
      const artifact = data.artifacts.find((item) => item.id === id)
      assert.ok(artifact, `${route.id} artifact ${id}`)
      assert.equal(artifact.ownerStepId, route.from, `${route.id} owner`)
      if (route.to) {
        assert.ok(artifact.consumerStepIds.includes(route.to), route.id)
      }
    })
  })

  data.artifacts.forEach((artifact) => {
    assert.ok(stepIds.has(artifact.ownerStepId), artifact.id)
    assert.ok(step(artifact.ownerStepId).outputs.includes(artifact.id))
    assert.equal(artifact.terminal, artifact.consumerStepIds.length === 0)
    artifact.consumerStepIds.forEach((consumerId) => {
      assert.ok(stepIds.has(consumerId), `${artifact.id} ${consumerId}`)
      assert.ok(step(consumerId).inputs.includes(artifact.id))
      assert.ok(
        data.routes.some(
          (route) =>
            route.from === artifact.ownerStepId &&
            route.to === consumerId &&
            route.producedArtifacts.includes(artifact.id)
        ),
        `${artifact.id} missing route to ${consumerId}`
      )
    })
  })
})

test('implementation boundaries and specification anchors resolve', () => {
  data.steps.forEach((item) => {
    item.implementationBoundary.forEach((boundary) => {
      assert.ok(
        fs.existsSync(path.resolve(repoRoot, boundary)),
        `${item.id} missing boundary ${boundary}`
      )
    })
  })

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
})

test('every app production step allows its formal suite registration', () => {
  ;[
    'intake-canvas-context-event',
    'manage-app-menu-session',
    'project-group-command-descriptors',
    'handoff-enabled-command-to-feature',
    'teardown-isolate-menu-instance'
  ].forEach((stepId) => {
    assert.ok(
      step(stepId).implementationBoundary.includes(
        'apps/asyra-design/package.json'
      ),
      `${stepId} must allow app formal suite registration`
    )
  })
})

test('Group and Context Menu Gherkin contracts are registered and allowed', () => {
  const featureDirectory = 'docs/ai/apps/asyra-design/bdd-features'
  const featurePaths = [
    `${featureDirectory}/group-interactions.feature`,
    `${featureDirectory}/group-context-menu.feature`
  ]

  featurePaths.forEach((featurePath) => {
    assert.ok(
      fs.existsSync(path.resolve(repoRoot, featurePath)),
      `missing Gherkin contract ${featurePath}`
    )
  })

  const readme = fs.readFileSync(
    path.resolve(repoRoot, `${featureDirectory}/README.md`),
    'utf8'
  )
  featurePaths.forEach((featurePath) => {
    assert.match(readme, new RegExp(path.basename(featurePath)))
  })

  const groupFeature = fs.readFileSync(
    path.resolve(repoRoot, featurePaths[0]),
    'utf8'
  )
  assert.match(groupFeature, /one intended undo commit/)
  assert.match(groupFeature, /Meta\+G/)
  assert.match(groupFeature, /Meta\+Shift\+G/)
  assert.match(groupFeature, /Ctrl\+G/)
  assert.match(groupFeature, /Ctrl\+Shift\+G/)

  const menuFeature = fs.readFileSync(
    path.resolve(repoRoot, featurePaths[1]),
    'utf8'
  )
  assert.match(menuFeature, /first command row should be "Group"/)
  assert.match(menuFeature, /second command row should be "Ungroup"/)
  assert.match(
    menuFeature,
    /app-owned context menu.*pointer client coordinates/i
  )
  assert.match(
    menuFeature,
    /existing Group feature command should run exactly once/
  )
  assert.match(
    menuFeature,
    /existing Ungroup feature command should run exactly once/
  )
  assert.match(menuFeature, /should not suppress the native context-menu event/)
  assert.match(
    menuFeature,
    /no canonical document or selection state should change/
  )

  data.steps.forEach((item) => {
    assert.ok(
      item.implementationBoundary.includes(featureDirectory),
      `${item.id} must allow synchronized Gherkin contracts`
    )
  })

  assert.match(
    data.acceptanceContracts
      .flatMap((contract) => contract.assertions)
      .join(' '),
    /Gherkin\/BDD synchronization/
  )
})

test('native intake removes global suppression and accepts only the canvas host', () => {
  const text = contractText(step('intake-canvas-context-event'))

  assert.match(text, /native contextmenu event.*client coordinates/i)
  assert.match(text, /preventDefault only after.*accepts/i)
  assert.match(text, /Input System removes.*unconditional window contextmenu/i)
  assert.match(text, /Editable fields.*Layers.*Properties.*Toolbar/i)
  assert.match(text, /retain native or existing behavior/i)
  assert.match(text, /does not hit test, retarget selection, transact/i)
  assert.match(text, /Input System command eligibility or menu state/i)
  assert.ok(
    step('intake-canvas-context-event').implementationBoundary.includes(
      'docs/ai/framework/packages/input-system.md'
    )
  )
  assert.ok(
    step('intake-canvas-context-event').implementationBoundary.includes(
      'docs/ai/apps/asyra-design/modules/input-mapping.md'
    )
  )
})

test('app menu session owns replacement, dismissal, focus return, and no writes', () => {
  const text = contractText(step('manage-app-menu-session'))

  assert.match(text, /exactly one session.*client coordinates/i)
  assert.match(text, /later accepted invocation replaces and repositions/i)
  assert.match(text, /Escape.*outside primary-pointer press.*Tab/i)
  assert.match(text, /successful enabled activation.*teardown close/i)
  assert.match(text, /Focus return.*invoking canvas host/i)
  assert.match(text, /no mutable selection, hierarchy, transaction/i)
  assert.match(text, /module-global menu session singleton/i)
})

test('shared descriptors own fixed rows, actual shortcuts, labels, and eligibility', () => {
  const text = contractText(step('project-group-command-descriptors'))

  assert.match(text, /order is exactly Group then Ungroup/i)
  assert.match(text, /existing canGroup.*existing canUngroup/i)
  assert.match(
    text,
    /command id, visible label, actual key metadata, platform display label, enabled state, and runGroupCommand callback/i
  )
  assert.match(text, /Meta\+G.*⌘G/i)
  assert.match(text, /Meta\+Shift\+G.*⇧⌘G/i)
  assert.match(text, /Ctrl\+G.*Ctrl\+G/i)
  assert.match(text, /Ctrl\+Shift\+G.*Ctrl\+Shift\+G/i)
  assert.match(text, /Editable shortcut targets.*no command intent/i)
  assert.match(text, /row-local hardcoded shortcut text/i)
  assert.match(text, /second Group or Ungroup implementation/i)
})

test('Design System presentation owns reusable layout and accessibility only', () => {
  const text = contractText(step('present-design-system-context-menu'))

  assert.match(text, /role menu.*role menuitem/i)
  assert.match(text, /aria-disabled/i)
  assert.match(text, /command label on the left.*shortcut label on the right/i)
  assert.match(text, /absent shortcut.*empty right-side value/i)
  assert.match(text, /clamped inside.*visible viewport/i)
  assert.match(text, /ArrowUp.*ArrowDown.*Home.*End.*Enter.*Space/i)
  assert.match(text, /Escape.*outside primary-pointer press.*Tab/i)
  assert.match(text, /disabled row cannot emit activation/i)
  assert.match(text, /Core, Factory, Feature, Preset, Render, or Input System/i)
  assert.match(text, /platform detection or Group command eligibility/i)
})

test('menu and actual shortcuts hand off once to the existing Group feature', () => {
  const text = contractText(step('handoff-enabled-command-to-feature'))

  assert.match(text, /menu.*closes.*first.*runGroupCommand exactly once/i)
  assert.match(text, /keyboard route.*same existing feature definition/i)
  assert.match(text, /one intended Factory transaction/i)
  assert.match(text, /post-operation selection.*rollback.*history/i)
  assert.match(text, /disabled, stale, or unavailable.*no feature/i)
  assert.match(text, /canonical rejection is not retried, reinterpreted/i)
  assert.match(text, /second transaction or Group feature/i)
})

test('teardown and separate app roots remain isolated', () => {
  const text = contractText(step('teardown-isolate-menu-instance'))

  assert.match(text, /portal and document listeners exactly once/i)
  assert.match(text, /Focus restoration never targets another app root/i)
  assert.match(text, /Two simultaneously mounted app roots.*independent/i)
  assert.match(text, /open state, pointer position, focused item/i)
  assert.match(text, /module-global menu or platform state/i)
  assert.match(text, /retained document listeners after teardown/i)
})

test('acceptance contracts cover product cases, gates, and review stop', () => {
  const acceptedStepIds = new Set(
    data.acceptanceContracts.flatMap((contract) => contract.stepIds)
  )
  data.steps.forEach((item) =>
    assert.ok(acceptedStepIds.has(item.id), `${item.id} lacks acceptance`)
  )

  const text = data.acceptanceContracts
    .flatMap((contract) => [contract.title, ...contract.assertions])
    .join(' ')

  ;[
    /Canvas right-click opens one menu.*second right-click replaces/i,
    /Group appears before Ungroup/i,
    /macOS shows ⌘G and ⇧⌘G.*actual Meta\+G and Meta\+Shift\+G/i,
    /Windows\/Linux shows Ctrl\+G and Ctrl\+Shift\+G.*actual Ctrl\+G and Ctrl\+Shift\+G/i,
    /complete menu stays inside.*center, edge, and corner/i,
    /Standard menu and menuitem roles/i,
    /invokes one existing Group\/Ungroup feature command exactly once/i,
    /Separate app roots do not share menu open state/i,
    /template sync.*synchronized center\/edge visual gates pass/i,
    /user review before closeout, push, pull request, or merge/i
  ].forEach((pattern) => assert.match(text, pattern))
})
