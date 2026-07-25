/* eslint-disable @typescript-eslint/no-require-imports */
/* global __dirname, require */

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const { JSDOM, VirtualConsole } = require('jsdom')

const projectRoot = path.resolve(__dirname, '../../..')
const rendererPath = path.join(__dirname, '../viewer.js')
const rendererSource = fs.readFileSync(rendererPath, 'utf8').trimEnd()

const expectedTopLevelKeys = [
  'schema',
  'target',
  'authority',
  'links',
  'lanes',
  'steps',
  'routes',
  'artifacts',
  'invariants',
  'acceptanceContracts'
]

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

const clone = (value) => JSON.parse(JSON.stringify(value))

const collectIds = (items) => new Set(items.map((item) => item.id))

const loadData = (dataPath) => {
  const resolvedPath = require.resolve(dataPath)
  require.cache[resolvedPath] = undefined
  return require(resolvedPath)
}

const isDeeplyFrozen = (value) =>
  !value ||
  typeof value !== 'object' ||
  (Object.isFrozen(value) && Object.values(value).every(isDeeplyFrozen))

const githubAnchor = (heading) =>
  heading
    .toLowerCase()
    .replaceAll('`', '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

const createViewerDom = (entryPath, dataScript, data) => {
  const html = fs.readFileSync(entryPath, 'utf8')
  const serializedData = JSON.stringify(data).replaceAll('<', '\\u003c')
  const inlineData = `<script>
    globalThis.FLOW_INSPECTOR_DATA = ${serializedData}
    SVGSVGElement.prototype.createSVGPoint = function () {
      return {
        x: 0,
        y: 0,
        matrixTransform() {
          return { x: this.x, y: this.y }
        }
      }
    }
    SVGElement.prototype.getScreenCTM = function () {
      return { inverse: () => ({}) }
    }
  </script>`
  const runnableHtml = html.replace(
    new RegExp(
      `<script src=["']${dataScript.replaceAll('.', '\\.')}["']><\\/script>`
    ),
    inlineData
  )
  const errors = []
  const virtualConsole = new VirtualConsole()
  virtualConsole.on('error', (...args) => errors.push(args))
  virtualConsole.on('jsdomError', (error) => errors.push(['jsdomError', error]))
  const dom = new JSDOM(runnableHtml, {
    pretendToBeVisual: true,
    runScripts: 'dangerously',
    virtualConsole
  })

  return { dom, errors }
}

const targets = [
  {
    id: 'asyra-design-group-context-menu',
    entryPath: path.join(
      projectRoot,
      'docs/ai/apps/asyra-design/plans/group-context-menu-flow-inspector.html'
    ),
    dataScript: './group-context-menu-flow-inspector.data.cjs',
    filterLaneTitle: 'App Menu and Command Policy'
  },
  {
    id: 'asyra-design-remote-subtree-restore-snapshot',
    entryPath: path.join(
      projectRoot,
      'docs/ai/apps/asyra-design/plans/remote-subtree-restore-snapshot-flow-inspector.html'
    ),
    dataScript: './remote-subtree-restore-snapshot-flow-inspector.data.cjs',
    filterLaneTitle: 'Canonical Owner Restore'
  },
  {
    id: 'asyra-design-group-interaction-mvp',
    entryPath: path.join(
      projectRoot,
      'docs/ai/apps/asyra-design/plans/group-interaction-mvp-flow-inspector.html'
    ),
    dataScript: './group-interaction-mvp-flow-inspector.data.cjs',
    filterLaneTitle: 'Layers Interaction and Projection'
  },
  {
    id: 'stroke-engine',
    entryPath: path.join(
      projectRoot,
      'docs/ai/apps/asyra-design/plans/stroke-engine-final/stroke-flow-inspector.html'
    ),
    dataScript: './stroke-flow-inspector.data.js',
    filterLaneTitle: 'Integration'
  },
  {
    id: 'transaction-atomicity',
    entryPath: path.join(
      projectRoot,
      'docs/ai/framework/plans/transaction-flow-inspector.html'
    ),
    dataScript: './transaction-flow-inspector.data.cjs',
    filterLaneTitle: 'Factory State'
  },
  {
    id: 'render-engine-boundary',
    entryPath: path.join(
      projectRoot,
      'docs/ai/framework/plans/render-engine-boundary-flow-inspector.html'
    ),
    dataScript: './render-engine-boundary-flow-inspector.data.cjs',
    filterLaneTitle: 'Render Adapter'
  },
  {
    id: 'canvas-pipeline-debugger',
    entryPath: path.join(
      projectRoot,
      'docs/ai/framework/plans/canvas-pipeline-debugger-flow-inspector.html'
    ),
    dataScript: './canvas-pipeline-debugger-flow-inspector.data.cjs',
    filterLaneTitle: 'Diagnostic Projection'
  },
  {
    id: 'property-type-redefinition',
    entryPath: path.join(
      projectRoot,
      'docs/ai/framework/plans/property-type-redefinition-flow-inspector.html'
    ),
    dataScript: './property-type-redefinition-flow-inspector.data.cjs',
    filterLaneTitle: 'Property Runtime'
  },
  {
    id: 'ai-agent-runtime',
    entryPath: path.join(
      projectRoot,
      'docs/ai/framework/plans/ai-agent-runtime-flow-inspector.html'
    ),
    dataScript: './ai-agent-runtime-flow-inspector.data.cjs',
    filterLaneTitle: 'Complete Plan Preflight'
  },
  {
    id: 'group-component-and-hierarchy',
    entryPath: path.join(
      projectRoot,
      'docs/ai/framework/plans/group-component-and-hierarchy-flow-inspector.html'
    ),
    dataScript: './group-component-and-hierarchy-flow-inspector.data.cjs',
    filterLaneTitle: 'App Intent and Remote Policy'
  }
]

for (const target of targets) {
  const dataPath = path.resolve(
    path.dirname(target.entryPath),
    target.dataScript
  )

  test(`${target.id} satisfies the complete Flow Inspector structure`, () => {
    const data = loadData(dataPath)
    const dataSource = fs.readFileSync(dataPath, 'utf8')

    assert.deepEqual(Object.keys(data), expectedTopLevelKeys)
    assert.doesNotMatch(dataSource, /\brequire\s*\(/)
    assert.ok(isDeeplyFrozen(data))
    assert.equal(data.schema.id, 'asyra.flow-inspector')
    assert.equal(data.schema.version, 2)
    assert.ok(Array.isArray(data.steps))
    assert.equal(Object.hasOwn(data, 'stages'), false)
    assert.ok(data.steps.length > 0)

    for (const step of data.steps) {
      assert.ok(Object.hasOwn(step, 'failureOwnerStepId'))
      assert.equal(Object.hasOwn(step, 'failureOwnerStageId'), false)
    }
    for (const artifact of data.artifacts) {
      assert.ok(Object.hasOwn(artifact, 'ownerStepId'))
      assert.ok(Object.hasOwn(artifact, 'consumerStepIds'))
      assert.equal(Object.hasOwn(artifact, 'ownerStageId'), false)
      assert.equal(Object.hasOwn(artifact, 'consumerStageIds'), false)
    }
    for (const invariant of data.invariants) {
      assert.ok(Object.hasOwn(invariant, 'stepIds'))
      assert.equal(Object.hasOwn(invariant, 'stageIds'), false)
    }
    for (const contract of data.acceptanceContracts) {
      assert.ok(Object.hasOwn(contract, 'stepIds'))
      assert.equal(Object.hasOwn(contract, 'stageIds'), false)
    }

    const laneIds = collectIds(data.lanes)
    const stepIds = collectIds(data.steps)
    const routeIds = collectIds(data.routes)
    const artifactIds = collectIds(data.artifacts)
    const invariantIds = collectIds(data.invariants)
    const acceptanceIds = collectIds(data.acceptanceContracts)

    assert.equal(laneIds.size, data.lanes.length)
    assert.equal(stepIds.size, data.steps.length)
    assert.equal(routeIds.size, data.routes.length)
    assert.equal(artifactIds.size, data.artifacts.length)
    assert.equal(invariantIds.size, data.invariants.length)
    assert.equal(acceptanceIds.size, data.acceptanceContracts.length)

    for (const step of data.steps) {
      assert.deepEqual(Object.keys(step), requiredStepFields)
      assert.ok(
        laneIds.has(step.laneId),
        `${step.id} must reference a valid lane`
      )
      assert.ok(
        stepIds.has(step.failureOwnerStepId),
        `${step.id} must reference a valid failure owner`
      )
      for (const input of step.inputs.filter((value) =>
        value.startsWith('artifact:')
      )) {
        assert.ok(
          artifactIds.has(input),
          `${step.id} must consume an existing artifact`
        )
      }
      for (const output of step.outputs) {
        assert.ok(
          artifactIds.has(output),
          `${step.id} must produce an existing artifact`
        )
      }
    }

    for (const route of data.routes) {
      assert.ok(stepIds.has(route.from), `${route.id} must have a valid source`)
      if (route.kind === 'terminal') {
        assert.equal(Object.hasOwn(route, 'to'), false)
      } else {
        assert.ok(
          stepIds.has(route.to),
          `${route.id} must have a valid destination`
        )
      }
      for (const artifactId of route.producedArtifacts) {
        const artifact = data.artifacts.find((item) => item.id === artifactId)
        assert.ok(artifact, `${route.id} must reference an existing artifact`)
        assert.equal(
          artifact.ownerStepId,
          route.from,
          `${route.id} must start at the artifact owner`
        )
        if (route.to) {
          assert.ok(
            artifact.consumerStepIds.includes(route.to),
            `${route.id} destination must consume ${artifactId}`
          )
        }
      }
    }

    for (const artifact of data.artifacts) {
      const owner = data.steps.find((step) => step.id === artifact.ownerStepId)
      assert.ok(owner, `${artifact.id} must have a valid owner`)
      assert.ok(
        owner.outputs.includes(artifact.id),
        `${artifact.id} must be an owner output`
      )
      assert.equal(artifact.terminal, artifact.consumerStepIds.length === 0)
      for (const consumerId of artifact.consumerStepIds) {
        const consumer = data.steps.find((step) => step.id === consumerId)
        assert.ok(consumer, `${artifact.id} must have valid consumers`)
        assert.ok(
          consumer.inputs.includes(artifact.id),
          `${artifact.id} must be a declared consumer input`
        )
        assert.ok(
          data.routes.some(
            (route) =>
              route.from === artifact.ownerStepId &&
              route.to === consumerId &&
              route.producedArtifacts.includes(artifact.id)
          ),
          `${artifact.id} must have an owner-to-consumer route`
        )
      }
      if (artifact.terminal) {
        assert.ok(
          data.routes.some(
            (route) =>
              route.kind === 'terminal' &&
              route.from === artifact.ownerStepId &&
              route.producedArtifacts.includes(artifact.id)
          ),
          `${artifact.id} must have a terminal route`
        )
      }
    }

    for (const invariant of data.invariants) {
      for (const stepId of invariant.stepIds) {
        assert.ok(
          stepIds.has(stepId),
          `${invariant.id} must reference valid steps`
        )
      }
      for (const artifactId of invariant.artifactIds) {
        assert.ok(
          artifactIds.has(artifactId),
          `${invariant.id} must reference valid artifacts`
        )
      }
    }

    for (const contract of data.acceptanceContracts) {
      for (const stepId of contract.stepIds) {
        assert.ok(
          stepIds.has(stepId),
          `${contract.id} must reference valid steps`
        )
      }
    }

    const spec = fs.readFileSync(
      path.resolve(projectRoot, data.authority.specPath),
      'utf8'
    )
    const specAnchors = new Set(
      [...spec.matchAll(/^#{1,6}\s+(.+)$/gm)].map((match) =>
        githubAnchor(match[1])
      )
    )
    for (const item of [
      ...data.steps,
      ...data.invariants,
      ...data.acceptanceContracts
    ]) {
      for (const specRef of item.specRefs) {
        assert.match(specRef, /^#[a-z0-9-]+$/)
        assert.ok(
          specAnchors.has(specRef.slice(1)),
          `${item.id} must reference an existing specification anchor: ${specRef}`
        )
      }
    }

    for (const link of data.links) {
      assert.ok(
        fs.existsSync(path.resolve(path.dirname(dataPath), link.href)),
        `${link.id} must reference an existing local file`
      )
    }
  })

  test(`${target.id} viewer entry is directly openable and renderer-synchronized`, () => {
    const html = fs.readFileSync(target.entryPath, 'utf8')
    const embeddedRenderer = html.match(
      /<script data-flow-inspector-renderer>\n([\s\S]*?)\n[ ]{4}<\/script>/
    )

    assert.match(
      html,
      new RegExp(
        `<script src=["']${target.dataScript.replaceAll('.', '\\.')}["']><\\/script>`
      ),
      'target data must load from the viewer entry directory'
    )
    assert.doesNotMatch(
      html,
      /<script[^>]+src=["'][^"']*tools\/flow-inspector\/viewer\.js["']/,
      'direct-open viewer entries must not load the renderer across directories'
    )
    assert.ok(embeddedRenderer, 'shared renderer must be embedded in the entry')
    assert.equal(
      embeddedRenderer[1],
      rendererSource,
      'embedded renderer must exactly match tools/flow-inspector/viewer.js'
    )
  })

  test(`${target.id} viewer renders steps, filters lanes, and updates detail`, () => {
    const data = loadData(dataPath)
    const { dom, errors } = createViewerDom(
      target.entryPath,
      target.dataScript,
      data
    )
    const { document } = dom.window

    assert.deepEqual(errors, [])
    assert.equal(
      document.querySelectorAll('.step-card').length,
      data.steps.length
    )
    assert.equal(
      document.querySelectorAll('.filter-button').length,
      data.lanes.length + 1
    )
    assert.equal(
      document.querySelector('#detail h2').textContent,
      data.steps[0].title
    )

    const laneFilter = [...document.querySelectorAll('.filter-button')].find(
      (button) => button.textContent === target.filterLaneTitle
    )
    assert.ok(laneFilter)
    laneFilter.dispatchEvent(
      new dom.window.MouseEvent('click', { bubbles: true })
    )
    assert.equal(
      document.querySelectorAll('.step-card').length,
      data.steps.filter(
        (step) =>
          data.lanes.find((lane) => lane.id === step.laneId)?.title ===
          target.filterLaneTitle
      ).length
    )
    assert.equal(
      document.querySelector('#detail h2').textContent,
      data.steps.find(
        (step) =>
          data.lanes.find((lane) => lane.id === step.laneId)?.title ===
          target.filterLaneTitle
      ).title
    )
    dom.window.close()
  })

  test(`${target.id} viewer rejects inconsistent artifact handoffs`, () => {
    const malformed = clone(loadData(dataPath))
    const handoffRoute = malformed.routes.find(
      (route) => route.to && route.producedArtifacts.length > 0
    )
    const handoffArtifact = malformed.artifacts.find(
      (artifact) => artifact.id === handoffRoute.producedArtifacts[0]
    )
    const wrongOwner = malformed.steps.find(
      (step) => step.id !== handoffArtifact.ownerStepId
    )
    const wrongConsumer = malformed.steps.find(
      (step) =>
        step.id !== handoffRoute.to &&
        step.id !== wrongOwner.id &&
        !step.inputs.includes(handoffArtifact.id)
    )

    handoffArtifact.ownerStepId = wrongOwner.id
    handoffArtifact.consumerStepIds = [wrongConsumer.id]

    const { dom, errors } = createViewerDom(
      target.entryPath,
      target.dataScript,
      malformed
    )
    const errorCodes = errors.flatMap((entry) => entry[1]?.errors ?? [])

    assert.ok(
      errorCodes.includes(`${handoffArtifact.id}:owner-output`),
      'runtime validation must reject an artifact absent from its owner outputs'
    )
    assert.ok(
      errorCodes.includes(
        `${handoffArtifact.id}:consumer-input:${wrongConsumer.id}`
      ),
      'runtime validation must reject an artifact absent from consumer inputs'
    )
    assert.ok(
      errorCodes.includes(
        `${handoffRoute.id}:artifact-owner:${handoffArtifact.id}`
      ),
      'runtime validation must reject a route that does not start at the artifact owner'
    )
    assert.ok(
      errorCodes.includes(
        `${handoffRoute.id}:artifact-consumer:${handoffArtifact.id}`
      ),
      'runtime validation must reject a route whose destination is not an artifact consumer'
    )
    dom.window.close()
  })
}
