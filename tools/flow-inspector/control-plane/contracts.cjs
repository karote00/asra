/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')

const MANIFEST_PATH = 'packages/factory/flow-contracts.json'
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0
const requireCondition = (condition, message) => {
  if (!condition) throw new Error('Invalid proof contract: ' + message)
}
const unique = (values, label) => {
  requireCondition(
    Array.isArray(values) && values.length > 0,
    label + ' is empty'
  )
  requireCondition(
    values.every(nonempty) && new Set(values).size === values.length,
    label + ' is invalid or duplicated'
  )
}

function admitContract(manifest, architecture) {
  requireCondition(manifest?.version === 1, 'unsupported mapping version')
  requireCondition(
    architecture?.schema?.version === 2 &&
      architecture.target.id === manifest.targetId,
    'target/schema mismatch'
  )
  unique(
    manifest.flows?.map((flow) => flow.id),
    'flow ids'
  )
  const steps = new Map(architecture.steps.map((step) => [step.id, step]))
  requireCondition(
    steps.size === architecture.steps.length,
    'duplicate architecture steps'
  )
  const artifacts = new Map(
    architecture.artifacts.map((artifact) => [artifact.id, artifact])
  )
  requireCondition(
    artifacts.size === architecture.artifacts.length,
    'duplicate artifacts'
  )
  for (const artifact of artifacts.values()) {
    requireCondition(steps.has(artifact.ownerStepId), 'missing artifact owner')
    requireCondition(
      artifact.consumerStepIds.every((id) => steps.has(id)),
      'missing artifact consumer'
    )
  }
  for (const route of architecture.routes) {
    requireCondition(
      steps.has(route.from) && (!route.to || steps.has(route.to)),
      'broken route'
    )
    requireCondition(
      route.producedArtifacts.every((id) => artifacts.has(id)),
      'missing route artifact'
    )
  }
  const cases = []
  const flows = manifest.flows.map((flow) => {
    unique(flow.stepIds, 'selected steps')
    requireCondition(
      nonempty(flow.title) && nonempty(flow.goal),
      'missing flow outcome'
    )
    unique(
      flow.cases?.map((item) => item.id),
      'required cases'
    )
    const selected = new Set(flow.stepIds)
    const resolved = flow.stepIds.map((id) => {
      const step = steps.get(id)
      requireCondition(
        step && nonempty(step.ownerPackage),
        'unknown step or owner'
      )
      for (const key of ['purpose', 'failureOwnerStepId'])
        requireCondition(nonempty(step[key]), 'missing ' + key)
      requireCondition(
        steps.has(step.failureOwnerStepId),
        'unknown failure owner'
      )
      for (const key of [
        'inputs',
        'outputs',
        'conditions',
        'bypasses',
        'allowedContributors',
        'forbiddenContributors',
        'implementationBoundary',
        'specRefs'
      ]) {
        unique(step[key], id + ' ' + key)
      }
      for (const output of step.outputs.filter((value) =>
        value.startsWith('artifact:')
      )) {
        requireCondition(
          artifacts.get(output)?.ownerStepId === id,
          'conflicting output owner'
        )
      }
      for (const input of step.inputs.filter((value) =>
        value.startsWith('artifact:')
      )) {
        const artifact = artifacts.get(input)
        requireCondition(
          artifact && artifact.consumerStepIds.includes(id),
          'missing input producer/consumer'
        )
        if (!selected.has(artifact.ownerStepId)) {
          requireCondition(
            manifest.externalInputs.includes(input),
            'undeclared external input'
          )
        } else {
          requireCondition(
            architecture.routes.some(
              (route) =>
                route.from === artifact.ownerStepId &&
                route.to === id &&
                route.producedArtifacts.includes(input)
            ),
            'missing selected handoff'
          )
        }
      }
      requireCondition(
        flow.cases.some((item) => item.stepId === id),
        'step lacks an obligation'
      )
      return structuredClone(step)
    })
    for (const item of flow.cases) {
      requireCondition(
        selected.has(item.stepId) && nonempty(item.testName),
        'missing case mapping'
      )
      cases.push({ ...item, flowId: flow.id })
    }
    return { id: flow.id, title: flow.title, goal: flow.goal, steps: resolved }
  })
  unique(
    cases.map((item) => item.id),
    'case ids'
  )
  unique(
    cases.map((item) => item.testName),
    'test names'
  )
  unique(manifest.negativeCaseIds, 'negative proof cases')
  requireCondition(
    manifest.negativeCaseIds.every((id) =>
      cases.some((item) => item.id === id)
    ),
    'unknown negative proof case'
  )
  for (const key of [
    'testFile',
    'configFile',
    'architecturePath',
    'specPath'
  ]) {
    requireCondition(
      nonempty(manifest[key]) &&
        !path.isAbsolute(manifest[key]) &&
        !manifest[key].split('/').includes('..'),
      'invalid ' + key
    )
  }
  return {
    version: manifest.version,
    negativeCaseIds: manifest.negativeCaseIds,
    targetId: manifest.targetId,
    manifestPath: MANIFEST_PATH,
    architecturePath: manifest.architecturePath,
    specPath: manifest.specPath,
    testFile: manifest.testFile,
    configFile: manifest.configFile,
    digest: createHash('sha256')
      .update(JSON.stringify({ manifest, architecture }))
      .digest('hex'),
    flows,
    cases
  }
}

function loadContract(repositoryRoot) {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(repositoryRoot, MANIFEST_PATH), 'utf8')
  )
  // This proof executes trusted repository-owned contracts, never uploaded code.
  const inspector = path.resolve(repositoryRoot, manifest.architecturePath)
  requireCondition(
    inspector.startsWith(repositoryRoot + path.sep),
    'architecture path escape'
  )
  Reflect.deleteProperty(require.cache, require.resolve(inspector))
  return admitContract(manifest, require(inspector))
}

module.exports = { admitContract, loadContract, MANIFEST_PATH }
