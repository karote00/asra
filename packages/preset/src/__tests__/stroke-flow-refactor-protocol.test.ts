import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

type RefactorStatus = 'locked' | 'active' | 'verified'
type RouteType = 'normal' | 'bypass' | 'terminal' | 'parallel'
type SourceFileOwnershipClassification =
  | 'owner-entry'
  | 'shared-helper'
  | 'diagnostics-only'
  | 'app-integration'
  | 'dead-residue'
type EntryPointKind =
  | 'function-boundary'
  | 'orchestration-boundary'
  | 'orchestration-slice'
  | 'evidence-gate'
type StrokeParameterCoverageRole =
  | 'consume'
  | 'preserve'
  | 'forbid'
  | 'dirty-key'
  | 'cache-key'
  | 'output-metadata'
  | 'not-applicable'

interface VerificationEvidence {
  gateName: string
  testFile: string
  status: string
  artifactPath: string
  verifiedAt: string
}

interface InspectorStep {
  id: string
  stepIndex: number
  stepNumber: number
  refactorStatus: RefactorStatus
  verificationEvidence: VerificationEvidence
  unitTestFile: string
  implementationFiles: string[]
  allowedInputs: string[]
  requiredOutputs: string[]
  allowedTestImports: string[]
  advanceGate: string[]
  integrationUnlockCondition: string
  ruleRefs: string[]
  asyraStrokeRules: string[]
  entryPointKind?: EntryPointKind
  entryPoint?: string
  implementationFunctions?: string[]
  helperAllowlist?: string[]
  orchestrationBoundary?: {
    ownerSurface: string
    inputBoundary: string
    outputBoundary: string
    forbiddenOwnership: string[]
  }
}

interface InspectorRoute {
  id: string
  from: string
  to: string
  routeType: RouteType
  exclusiveGroup: string
  decisionGroup: string
  parallelGroup: string
  coExecutionGroup: string
  routePriority: number
  conditionKind: string
  conditionId: string
  predicateInputs: string[]
  when: Record<string, unknown>
  elseOf: string
  resumeAt: string
  nextConsumer: string
  condition: string
  output: string
  ownerStage: string
  failureReopensStep: string
  inputs: string[]
  consumes: string[]
  produces: string[]
  skipSteps: string[]
  dirtyDependencies: string[]
  cacheKeyInputs: string[]
  limitations: string[]
  allowedContributors: string[]
  forbiddenContributors: string[]
  evidenceRequired: string[]
  visibleContributor: string
  geometryBasis: string
  specRuleRefs: string[]
  metricAssertions: Record<string, string>[]
  computationContract?: {
    computedAt: string
    consumesArtifacts: string[]
    producesArtifacts: string[]
    consumedBy: string[]
    mustNotRecomputeAfter: string
    forbiddenLateComputation: string[]
  }
}

interface InspectorArtifact {
  id: string
  kind: string
  channel: string
  ownerStage: string
  terminal: boolean
}

interface CoExecutionCompletionRule {
  coExecutionGroup: string
  owningDecisionGroup: string
  requiredRouteIds: string[]
  completionArtifactIds: string[]
  downstreamBarrier: string
  semantics: string
  specRuleRefs: string[]
}

interface SourceFileOwnershipRecord {
  filePath: string
  classification: SourceFileOwnershipClassification
  ownerStepId: string | null
  ownerRouteIds: string[]
  currentConsumers: string[]
  requiredInspectorField: string
  productionCodeChangeNeeded: boolean
}

interface LifecycleContractPhase {
  phase: string
  stepId: string
  routeIds: string[]
  consumesArtifacts?: string[]
  producesArtifacts?: string[]
  requiredEvidence?: string[]
  preservedEvidence?: string[]
  forbiddenLateComputation?: string[]
  failureReopensStep: string
}

interface LifecycleContract {
  id: string
  specRuleId: string
  specAnchor: string
  formalGate: string
  artifactIds: string[]
  ownerSteps: string[]
  lifecycle: LifecycleContractPhase[]
}

interface InspectorData {
  latestRules: string[]
  ruleRegistry: { id: string; text: string }[]
  routeTypes: RouteType[]
  currentExecutionState: {
    totalSteps: number
    refactorProtocolName: string
    activeRefactorStepId: string | null
    nextExecutableStepId: string
    planStatus: string
  }
  runtimeImplementationState: {
    phase: string
    previousCheckpoint: string
    activeStepId: string | null
    activeStepNumber: number | null
    activeStepUnitStatus: string
    activeStepGate: string
    verifiedStepIds: string[]
    sequentialLockPolicy: string
    stepRetryLimit: number
    implementationPolicy: string
    advancementRule: string
    lockedFuturePhases: string[]
    evidenceRequired: string[]
  }
  refactorProtocol: {
    name: string
    activeStepId: string | null
    currentMode: string
    schemaRepairGate: string
    unitTestRoot: string
    protocolValidatorTest: string
    testConformancePolicy: string
    stepExecutionPolicy: string
    stepRetryLimit: number
    stepRetryFailurePolicy: string
    integrationPolicy: string
    fullRegressionRetryLimit: number
    fullRegressionFailurePolicy: string
    e2ePolicy: string
    documentDeepAuditPolicy: string
    runtimeImplementationPolicy: string
  }
  documentDeepAuditProtocol: {
    source: string
    requiredPassOrder: string[]
    minimumMatrix: string[]
    forbiddenAuditBehavior: string[]
    validationGate: string
  }
  dashJoinSeamLifecycleContract: LifecycleContract
  sharedStepTestHelpers: string[]
  sourceFileOwnershipRecords: SourceFileOwnershipRecord[]
  entryBoundaryRequiredStepIds: string[]
  strokeParameterIds: string[]
  strokeParameterCoverageRoles: StrokeParameterCoverageRole[]
  strokeParameterCoverageMatrix: Record<
    string,
    Record<string, StrokeParameterCoverageRole[]>
  >
  steps: InspectorStep[]
  edges: [string, string][]
  conditionalRoutes: InspectorRoute[]
  artifactRegistry: InspectorArtifact[]
  coExecutionCompletionRules: CoExecutionCompletionRule[]
  nestedRoutesByStep: Record<string, InspectorRoute[]>
  evidenceRequiredByRoute: Record<string, string[]>
  stepContractErrors: string[]
  routeContractErrors: string[]
  refactorLockErrors: string[]
  entryBoundaryErrors: string[]
  refactorProtocolErrors: string[]
  runtimeImplementationErrors: string[]
  strokeParameterCoverageErrors: string[]
  dashJoinSeamLifecycleErrors: string[]
  sourceFileOwnershipErrors: string[]
  inspectorContractErrors: string[]
}

type InspectorDataModule = Partial<InspectorData> & {
  default?: InspectorData
  STROKE_FLOW_INSPECTOR_DATA?: InspectorData
}

const repoRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../'
)
const require = createRequire(import.meta.url)
const inspectorPath = resolve(
  repoRoot,
  'docs/ai/apps/asyra-design/plans/stroke-engine-final/stroke-flow-inspector.data.js'
)
const planPath = resolve(repoRoot, 'docs/ai/apps/asyra-design/PLANS.md')
const specPath = resolve(
  repoRoot,
  'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md'
)
const retiredSingleProductStepId = ['build', 'stroke', 'product', 'units'].join(
  '-'
)
const retiredDescriptorAssemblyStepId = [
  'assemble',
  'stroke',
  'product',
  'descriptors'
].join('-')
const retiredSingleProductGroupId = ['step', '24'].join('')

let cachedInspectorData: InspectorData | null = null

const globalInspectorRecord = globalThis as typeof globalThis & {
  STROKE_FLOW_INSPECTOR_DATA?: InspectorData
  window?: unknown
}

const requireInspectorData = (): InspectorData => {
  const loadedModule = require(inspectorPath) as InspectorDataModule
  const data =
    (loadedModule.currentExecutionState
      ? (loadedModule as InspectorData)
      : (loadedModule.STROKE_FLOW_INSPECTOR_DATA ??
        loadedModule.default ??
        globalInspectorRecord.STROKE_FLOW_INSPECTOR_DATA)) ?? null

  expect(data).toBeDefined()
  return data as InspectorData
}

const loadInspectorData = (): InspectorData => {
  if (cachedInspectorData) {
    return cachedInspectorData
  }
  Reflect.deleteProperty(require.cache, require.resolve(inspectorPath))
  Reflect.deleteProperty(globalInspectorRecord, 'STROKE_FLOW_INSPECTOR_DATA')
  cachedInspectorData = requireInspectorData()
  return cachedInspectorData
}

const readRepoFile = (path: string) => readFileSync(path, 'utf8')

const toRepoPath = (absolutePath: string) =>
  relative(repoRoot, absolutePath).split('/').join('/')

const resolveRepoImportSpecifier = (
  fromRepoPath: string,
  specifier: string
) => {
  if (!specifier.startsWith('.')) {
    return specifier
  }

  const fromAbsolutePath = resolve(repoRoot, fromRepoPath)
  const baseAbsolutePath = resolve(dirname(fromAbsolutePath), specifier)
  const candidates = [
    baseAbsolutePath,
    `${baseAbsolutePath}.ts`,
    `${baseAbsolutePath}.tsx`,
    resolve(baseAbsolutePath, 'index.ts'),
    resolve(baseAbsolutePath, 'index.tsx')
  ]
  const resolvedAbsolutePath =
    candidates.find((candidate) => existsSync(candidate)) ?? baseAbsolutePath

  return toRepoPath(resolvedAbsolutePath)
}

const parseStaticImports = (repoPath: string) => {
  const source = readRepoFile(resolve(repoRoot, repoPath))
  const importPattern =
    /^\s*import(?:\s+type)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/gm
  const imports: {
    line: number
    specifier: string
    resolvedSpecifier: string
  }[] = []
  let match: RegExpExecArray | null

  while ((match = importPattern.exec(source)) !== null) {
    const specifier = match[1]
    imports.push({
      line: source.slice(0, match.index).split(/\r?\n/).length,
      specifier,
      resolvedSpecifier: resolveRepoImportSpecifier(repoPath, specifier)
    })
  }

  return imports
}

const importMatchesAllowedEntry = (
  specifier: string,
  resolvedSpecifier: string,
  allowedEntry: string
) =>
  allowedEntry === specifier ||
  allowedEntry === resolvedSpecifier ||
  (allowedEntry.endsWith('/') && resolvedSpecifier.startsWith(allowedEntry)) ||
  (allowedEntry === 'node:' && specifier.startsWith('node:'))

const isAllowedStepImport = (
  specifier: string,
  resolvedSpecifier: string,
  allowedImports: string[]
) =>
  allowedImports.some((allowedEntry) =>
    importMatchesAllowedEntry(specifier, resolvedSpecifier, allowedEntry)
  )

const routeById = (data: InspectorData, id: string) => {
  const route = data.conditionalRoutes.find((candidate) => candidate.id === id)
  expect(route, id).toBeDefined()
  return route as InspectorRoute
}

describe('stroke flow refactor protocol', () => {
  it('loads inspector data without a browser window global', () => {
    const originalWindow = globalInspectorRecord.window

    try {
      Reflect.deleteProperty(globalInspectorRecord, 'window')
      Reflect.deleteProperty(
        globalInspectorRecord,
        'STROKE_FLOW_INSPECTOR_DATA'
      )
      Reflect.deleteProperty(require.cache, require.resolve(inspectorPath))

      const data = requireInspectorData()

      expect(data.currentExecutionState.refactorProtocolName).toBe(
        'Inspector-Flow-First Greenfield Stroke Engine Refactor'
      )
      expect(globalInspectorRecord.STROKE_FLOW_INSPECTOR_DATA).toBe(data)
    } finally {
      if (originalWindow === undefined) {
        Reflect.deleteProperty(globalInspectorRecord, 'window')
      } else {
        globalInspectorRecord.window = originalWindow
      }
      Reflect.deleteProperty(
        globalInspectorRecord,
        'STROKE_FLOW_INSPECTOR_DATA'
      )
      Reflect.deleteProperty(require.cache, require.resolve(inspectorPath))
    }
  })

  it('keeps inspector contract, refactor lock metadata, and rule refs valid', () => {
    const data = loadInspectorData()
    const ruleIds = new Set(data.ruleRegistry.map((rule) => rule.id))

    expect(data.stepContractErrors).toEqual([])
    expect(data.routeContractErrors).toEqual([])
    expect(data.refactorLockErrors).toEqual([])
    expect(data.entryBoundaryErrors).toEqual([])
    expect(data.refactorProtocolErrors).toEqual([])
    expect(data.runtimeImplementationErrors).toEqual([])
    expect(data.strokeParameterCoverageErrors).toEqual([])
    expect(data.sourceFileOwnershipErrors).toEqual([])
    expect(data.inspectorContractErrors).toEqual([])
    expect(data.steps).toHaveLength(41)
    expect(data.currentExecutionState.totalSteps).toBe(41)
    expect(data.steps.map((step) => step.id)).not.toContain(
      'visible-final-result'
    )
    expect('validationGates' in data).toBe(false)
    expect(data.ruleRegistry).toHaveLength(data.latestRules.length)
    expect(
      data.ruleRegistry.some((rule) => /^stroke-rule-\d+$/.test(rule.id))
    ).toBe(false)

    const unitTestRoot = data.refactorProtocol.unitTestRoot.endsWith('/')
      ? data.refactorProtocol.unitTestRoot
      : `${data.refactorProtocol.unitTestRoot}/`
    const expectedStepUnitFiles = data.steps
      .map((step) => step.unitTestFile)
      .sort()
    const actualStepUnitFiles = readdirSync(resolve(repoRoot, unitTestRoot))
      .filter((fileName) => /^step-.*\.test\.ts$/.test(fileName))
      .map((fileName) => `${unitTestRoot}${fileName}`)
      .sort()

    expect(actualStepUnitFiles).toEqual(expectedStepUnitFiles)

    for (const [index, step] of data.steps.entries()) {
      expect(step.stepIndex).toBe(index)
      expect(step.stepNumber).toBe(index + 1)
      expect(step.unitTestFile).toMatch(
        /^packages\/preset\/src\/__tests__\/stroke-flow\/step-\d{2}-[-a-z]+\.test\.ts$/
      )
      expect(step.implementationFiles.length).toBeGreaterThan(0)
      expect(step.allowedInputs.length).toBeGreaterThan(0)
      expect(step.requiredOutputs.length).toBeGreaterThan(0)
      expect(step.allowedTestImports.length).toBeGreaterThan(0)
      expect(step.advanceGate.length).toBeGreaterThan(0)
      expect(step.integrationUnlockCondition).toContain('locked')
      expect(step.ruleRefs.length).toBeGreaterThan(0)
      expect(step.ruleRefs.length).toBeLessThan(data.latestRules.length)
      expect(step.asyraStrokeRules).toHaveLength(step.ruleRefs.length)
      expect(step.verificationEvidence.gateName).toBeTruthy()
      expect(step.verificationEvidence.testFile).toBe(step.unitTestFile)
      expect(step.verificationEvidence.status).toBeTruthy()
      expect(step.verificationEvidence.artifactPath).toBeTruthy()
      expect(step.verificationEvidence.verifiedAt).toBeTruthy()
      expect(existsSync(resolve(repoRoot, step.unitTestFile))).toBe(true)
      for (const ruleRef of step.ruleRefs) {
        expect(ruleIds.has(ruleRef)).toBe(true)
      }
    }
  })

  it('tracks current stroke source-file ownership records', () => {
    const data = loadInspectorData()
    const stepIds = new Set(data.steps.map((step) => step.id))
    const routeIds = new Set(data.conditionalRoutes.map((route) => route.id))
    const ownershipRecords = new Map(
      data.sourceFileOwnershipRecords.map((record) => [record.filePath, record])
    )
    const requiredSourceFiles = [
      'packages/preset/src/components/oval.ts',
      'packages/preset/src/components/rectangle.ts',
      'packages/preset/src/components/stroke-render/arrangement-face-classifier.ts',
      'packages/preset/src/components/stroke-render/center-dashed-overlap-candidates.ts',
      'packages/preset/src/components/stroke-render/center-dashed-overlap-graph.ts',
      'packages/preset/src/components/stroke-render/center-dashed-ownership.ts',
      'packages/preset/src/components/stroke-render/clipper2-geometry-backend.ts',
      'packages/preset/src/components/stroke-render/constants.ts',
      'packages/preset/src/components/stroke-render/constrained-dashed-domain-geometry.ts',
      'packages/preset/src/components/stroke-render/constrained-domain-stroke-geometry.ts',
      'packages/preset/src/components/stroke-render/constrained-solid-legality-clipping.ts',
      'packages/preset/src/components/stroke-render/constrained-solid-legality-domain.ts',
      'packages/preset/src/components/stroke-render/constrained-solid-stroke-geometry.ts',
      'packages/preset/src/components/stroke-render/dashed-center-ribbon-geometry.ts',
      'packages/preset/src/components/stroke-render/ellipse-path.ts',
      'packages/preset/src/components/stroke-render/geometry-backend.ts',
      'packages/preset/src/components/stroke-render/legal-domain-normalization.ts',
      'packages/preset/src/components/stroke-render/self-intersecting-legal-domain.ts',
      'packages/preset/src/components/stroke-render/solid-stroke-geometry-core.ts',
      'packages/preset/src/components/stroke-render/source-span-graph.ts',
      'packages/preset/src/components/stroke-render/source-vertex-join-footprint.ts',
      'packages/preset/src/components/stroke-render/stroke-interval-frames.ts',
      'packages/preset/src/components/stroke-render/stroke-ownership.ts',
      'packages/preset/src/components/stroke-render/stroke-paint-payload.ts',
      'packages/preset/src/components/stroke-render/stroke-side-resolution.ts',
      'packages/render/src/index.ts',
      'packages/render/src/layers/overlay-layer.ts',
      'packages/render/src/layers/selection/selection-layer.ts',
      'packages/render/src/render.ts'
    ]

    expect(data.sourceFileOwnershipErrors).toEqual([])
    expect(data.sourceFileOwnershipRecords.length).toBeGreaterThanOrEqual(
      requiredSourceFiles.length
    )

    for (const filePath of requiredSourceFiles) {
      const record = ownershipRecords.get(filePath)

      expect(record, filePath).toBeDefined()
      if (!record) {
        throw new Error(`${filePath} missing source ownership record`)
      }
      expect(
        existsSync(resolve(repoRoot, record.filePath)),
        record.filePath
      ).toBe(true)
      expect(record.productionCodeChangeNeeded, record.filePath).toBe(false)
      expect(record.requiredInspectorField, record.filePath).toContain(
        'sourceFileOwnershipRecords.'
      )
      if (record.classification === 'dead-residue') {
        expect(record.ownerStepId, record.filePath).toBeNull()
        expect(record.ownerRouteIds, record.filePath).toEqual([])
        expect(record.currentConsumers, record.filePath).toEqual([])
      } else {
        expect(stepIds.has(record.ownerStepId ?? ''), record.filePath).toBe(
          true
        )
        expect(record.ownerRouteIds.length, record.filePath).toBeGreaterThan(0)
        for (const routeId of record.ownerRouteIds) {
          expect(routeIds.has(routeId), `${record.filePath}:${routeId}`).toBe(
            true
          )
        }
      }
    }
  })

  it('enforces step unit test imports against inspector allowedTestImports', () => {
    const data = loadInspectorData()
    const sharedHelpers = data.sharedStepTestHelpers

    expect(sharedHelpers).toContain(
      'packages/preset/src/__tests__/stroke-flow/stroke-parameter-coverage-test-helper.ts'
    )
    for (const sharedHelper of sharedHelpers) {
      expect(existsSync(resolve(repoRoot, sharedHelper)), sharedHelper).toBe(
        true
      )
    }

    const violations = data.steps.flatMap((step) => {
      const allowedImports = [...step.allowedTestImports, ...sharedHelpers]

      return parseStaticImports(step.unitTestFile)
        .filter(
          (importRecord) =>
            !isAllowedStepImport(
              importRecord.specifier,
              importRecord.resolvedSpecifier,
              allowedImports
            )
        )
        .map(
          (importRecord) =>
            `${step.id}:${step.unitTestFile}:${importRecord.line} imports ${importRecord.specifier} -> ${importRecord.resolvedSpecifier}`
        )
    })

    expect(violations).toEqual([])
  })

  it('requires explicit entry boundaries for high-risk orchestration steps', () => {
    const data = loadInspectorData()
    const expectedEntryBoundarySteps = [
      'render-mirror-patch-apply',
      'render-data-derivation',
      'stage-product-cache',
      'render-strategy-entry'
    ]

    expect(data.entryBoundaryRequiredStepIds).toEqual(
      expectedEntryBoundarySteps
    )
    expect(data.entryBoundaryErrors).toEqual([])

    for (const stepId of expectedEntryBoundarySteps) {
      const step = data.steps.find((entry) => entry.id === stepId)

      expect(step, stepId).toBeDefined()
      if (!step) {
        throw new Error(`${stepId} missing from inspector steps`)
      }
      expect(step.entryPointKind, stepId).toMatch(
        /^(orchestration-boundary|orchestration-slice|evidence-gate)$/
      )
      expect(step.entryPoint, stepId).toBeTruthy()
      expect(step.entryPoint, stepId).not.toContain('pending')
      expect(step.implementationFunctions?.length, stepId).toBeGreaterThan(0)
      expect(step.helperAllowlist?.length, stepId).toBeGreaterThan(0)
      expect(step.orchestrationBoundary, stepId).toMatchObject({
        ownerSurface: expect.stringContaining('#'),
        inputBoundary: expect.any(String),
        outputBoundary: expect.any(String),
        forbiddenOwnership: expect.any(Array)
      })
      expect(
        step.orchestrationBoundary?.forbiddenOwnership.length,
        stepId
      ).toBeGreaterThan(0)
      if (step.entryPointKind !== 'evidence-gate') {
        expect(step.orchestrationBoundary?.ownerSurface, stepId).toContain(
          step.entryPoint
        )
      }
    }
  })

  it('requires every inspector step to classify every supported stroke parameter', () => {
    const data = loadInspectorData()
    const expectedParameterIds = [
      'stroke.fill.visible',
      'stroke.fill.kind',
      'stroke.fill.color',
      'stroke.fill.opacity',
      'stroke.fill.gradient',
      'stroke.fill.colorFormat',
      'stroke.fill.defaultColorFormat',
      'stroke.style',
      'stroke.position',
      'stroke.width',
      'stroke.dash',
      'stroke.gap',
      'stroke.capType',
      'stroke.joinType',
      'stroke.miterAngle'
    ]
    const expectedRoles: StrokeParameterCoverageRole[] = [
      'consume',
      'preserve',
      'forbid',
      'dirty-key',
      'cache-key',
      'output-metadata',
      'not-applicable'
    ]
    const stepIds = data.steps.map((step) => step.id)
    const coverageStepIds = Object.keys(data.strokeParameterCoverageMatrix)

    expect(data.strokeParameterIds).toEqual(expectedParameterIds)
    expect(data.strokeParameterCoverageRoles).toEqual(expectedRoles)
    expect(data.strokeParameterCoverageErrors).toEqual([])
    expect(coverageStepIds.sort()).toEqual([...stepIds].sort())

    for (const step of data.steps) {
      const coverage = data.strokeParameterCoverageMatrix[step.id]
      expect(coverage, step.id).toBeDefined()
      expect(Object.keys(coverage).sort(), step.id).toEqual(
        [...expectedParameterIds].sort()
      )
      for (const parameterId of expectedParameterIds) {
        const roles = coverage[parameterId]
        expect(Array.isArray(roles), `${step.id}:${parameterId}`).toBe(true)
        expect(roles.length, `${step.id}:${parameterId}`).toBeGreaterThan(0)
        expect(
          roles.every((role) => expectedRoles.includes(role)),
          `${step.id}:${parameterId}`
        ).toBe(true)
        if (roles.includes('not-applicable')) {
          expect(roles, `${step.id}:${parameterId}`).toEqual(['not-applicable'])
        }
      }
    }

    const expectRole = (
      stepId: string,
      parameterId: string,
      role: StrokeParameterCoverageRole
    ) => {
      expect(
        data.strokeParameterCoverageMatrix[stepId]?.[parameterId],
        `${stepId}:${parameterId}`
      ).toContain(role)
    }
    const paintParameters = [
      'stroke.fill.visible',
      'stroke.fill.kind',
      'stroke.fill.color',
      'stroke.fill.opacity',
      'stroke.fill.gradient'
    ]
    const geometryParameters = [
      'stroke.style',
      'stroke.position',
      'stroke.width',
      'stroke.dash',
      'stroke.gap',
      'stroke.capType',
      'stroke.joinType',
      'stroke.miterAngle'
    ]

    for (const parameterId of expectedParameterIds) {
      expectRole('normalize-stroke-spec', parameterId, 'consume')
      expectRole('shared-geometry-model', parameterId, 'forbid')
      expectRole('dirty-revision-graph', parameterId, 'dirty-key')
      expectRole('renderer-projection', parameterId, 'forbid')
      for (const forbiddenRendererRole of [
        'consume',
        'dirty-key',
        'cache-key'
      ] satisfies StrokeParameterCoverageRole[]) {
        expect(
          data.strokeParameterCoverageMatrix['renderer-projection'][
            parameterId
          ],
          `renderer-projection:${parameterId}`
        ).not.toContain(forbiddenRendererRole)
      }
    }

    for (const parameterId of geometryParameters) {
      expectRole('stage-product-cache', parameterId, 'cache-key')
      expectRole('attach-paint-payload', parameterId, 'preserve')
    }
    for (const parameterId of paintParameters) {
      expectRole('attach-paint-payload', parameterId, 'consume')
    }
    for (const parameterId of ['stroke.joinType', 'stroke.miterAngle']) {
      expectRole('build-source-vertex-join-products', parameterId, 'consume')
      expectRole('build-smooth-continuity-products', parameterId, 'forbid')
    }
    for (const parameterId of ['stroke.dash', 'stroke.gap']) {
      expectRole('build-source-vertex-join-products', parameterId, 'preserve')
      expectRole(
        'build-source-vertex-join-products',
        parameterId,
        'output-metadata'
      )
    }
  })

  it('keeps schema repair state separate from product step verification', () => {
    const data = loadInspectorData()
    const activeSteps = data.steps.filter(
      (step) => step.refactorStatus === 'active'
    )

    expect(data.currentExecutionState.refactorProtocolName).toBe(
      data.refactorProtocol.name
    )
    expect(data.currentExecutionState.activeRefactorStepId).toBe(
      data.refactorProtocol.activeStepId
    )

    if (
      data.currentExecutionState.planStatus ===
      'inspector-flow-schema-repair-active'
    ) {
      expect(data.refactorProtocol.currentMode).toBe('schema-repair')
      expect(data.refactorProtocol.activeStepId).toBeNull()
      expect(activeSteps).toEqual([])
      expect(data.currentExecutionState.nextExecutableStepId).toBe(
        'inspector-schema-repair-gate'
      )
      expect(
        data.steps.some((step) => step.refactorStatus === 'verified')
      ).toBe(false)
      return
    }

    if (data.refactorProtocol.activeStepId === null) {
      expect(activeSteps).toEqual([])
      expect(data.currentExecutionState.planStatus).toBe(
        'inspector-flow-step-units-verified'
      )
      expect(data.currentExecutionState.nextExecutableStepId).toBe(
        'unit-complete-checkpoint'
      )
      expect(
        data.steps.every((step) => step.refactorStatus === 'verified')
      ).toBe(true)
      expect([
        'runtime-implementation-audit-active',
        'runtime-implementation-unit-complete'
      ]).toContain(data.runtimeImplementationState.phase)
      expect(data.runtimeImplementationState.previousCheckpoint).toBe(
        'unit-complete-checkpoint'
      )
      expect(data.runtimeImplementationState.stepRetryLimit).toBe(
        data.refactorProtocol.stepRetryLimit
      )
      expect(data.refactorProtocol.runtimeImplementationPolicy).toContain(
        'runtimeImplementationState'
      )
      expect(data.refactorProtocol.runtimeImplementationPolicy).toContain(
        'one runtime active step'
      )

      const verifiedRuntimeStepIds =
        data.runtimeImplementationState.verifiedStepIds
      const expectedVerifiedRuntimeStepIds = data.steps
        .slice(0, verifiedRuntimeStepIds.length)
        .map((step) => step.id)
      const expectedRuntimeActiveStep =
        data.steps[verifiedRuntimeStepIds.length]
      const runtimePipelineComplete =
        verifiedRuntimeStepIds.length === data.steps.length
      const runtimeActiveStep = data.steps.find(
        (step) => step.id === data.runtimeImplementationState.activeStepId
      )

      expect(verifiedRuntimeStepIds).toEqual(expectedVerifiedRuntimeStepIds)
      expect(verifiedRuntimeStepIds).not.toContain('visible-final-result')
      if (runtimePipelineComplete) {
        expect(data.runtimeImplementationState.phase).toBe(
          'runtime-implementation-unit-complete'
        )
        expect(data.runtimeImplementationState.activeStepId).toBeNull()
        expect(data.runtimeImplementationState.activeStepNumber).toBeNull()
        expect(data.runtimeImplementationState.activeStepUnitStatus).toBe(
          'complete'
        )
        expect(data.runtimeImplementationState.activeStepGate).toContain(
          '41 runtime inspector steps verified'
        )
      } else {
        expect(expectedRuntimeActiveStep).toBeDefined()
        expect(runtimeActiveStep).toBeDefined()
        expect(runtimeActiveStep?.id).toBe(expectedRuntimeActiveStep?.id)
        expect(verifiedRuntimeStepIds).not.toContain(
          data.runtimeImplementationState.activeStepId
        )
        expect(runtimeActiveStep?.stepNumber).toBe(
          data.runtimeImplementationState.activeStepNumber
        )
        expect(runtimeActiveStep?.refactorStatus).toBe('verified')
        expect(data.runtimeImplementationState.activeStepUnitStatus).toBe(
          'verified'
        )
        const runtimeUnitTestFile = runtimeActiveStep?.unitTestFile ?? ''
        const runtimeWorkspaceUnitTestFile = runtimeUnitTestFile.replace(
          /^packages\/preset\//,
          ''
        )
        expect(
          [runtimeUnitTestFile, runtimeWorkspaceUnitTestFile].some(
            (unitTestPath) =>
              data.runtimeImplementationState.activeStepGate.includes(
                unitTestPath
              )
          )
        ).toBe(true)
      }
      expect(data.runtimeImplementationState.sequentialLockPolicy).toContain(
        'first unverified runtime step'
      )
      expect(data.runtimeImplementationState.lockedFuturePhases).toEqual(
        expect.arrayContaining([
          'full package regression',
          'post-runtime stroke test suites',
          'E2E',
          'visual review',
          'performance',
          'cleanup'
        ])
      )
      expect(data.runtimeImplementationState.evidenceRequired).toEqual(
        expect.arrayContaining([
          'active inspector step contract',
          'referenced stroke engine spec rules',
          'implementation entry boundary mapping',
          'dedicated active step unit test result',
          'protocol validator result',
          'runtime verified step prefix ledger',
          'focused repair attempt count'
        ])
      )
      return
    }

    expect(activeSteps.map((step) => step.id)).toEqual([
      data.refactorProtocol.activeStepId
    ])
    expect(data.currentExecutionState.nextExecutableStepId).toBe(
      data.refactorProtocol.activeStepId
    )
  })

  it('keeps stroke tests tied to current spec and inspector ownership', () => {
    const data = loadInspectorData()
    const activeStep = data.steps.find(
      (step) => step.refactorStatus === 'active'
    )

    expect(data.refactorProtocol.testConformancePolicy).toContain(
      'current stroke engine spec'
    )
    expect(data.refactorProtocol.testConformancePolicy).toContain(
      'inspector step or route'
    )
    expect(data.refactorProtocol.testConformancePolicy).toContain('owner stage')

    if (!activeStep) {
      expect(data.refactorProtocol.activeStepId).toBeNull()
      return
    }

    expect(
      activeStep.unitTestFile.startsWith(data.refactorProtocol.unitTestRoot)
    ).toBe(true)

    const activeTestPath = resolve(repoRoot, activeStep.unitTestFile)
    if (!existsSync(activeTestPath)) {
      return
    }

    const activeTestSource = readRepoFile(activeTestPath)
    expect(activeTestSource).toContain(activeStep.id)
    expect(activeTestSource).toContain('loadInspectorData')
  })

  it('keeps docs, plan, and inspector protocol names synchronized', () => {
    const data = loadInspectorData()
    const spec = readRepoFile(specPath)
    const plan = readRepoFile(planPath)

    expect(data.refactorProtocol.name).toBe(
      'Inspector-Flow-First Greenfield Stroke Engine Refactor'
    )
    expect(spec).toContain('Inspector-Flow-First Greenfield Refactor Protocol')
    expect(spec).toContain('Spec Completeness Contract')
    expect(spec).toContain('Spec-To-Enforcement Contract')
    expect(spec).toContain('Document Deep Audit Protocol')
    expect(spec).toContain('Supported Stroke Feature Surface')
    expect(spec).toContain('Stroke Parameter Step Coverage Contract')
    expect(spec).toContain('Inspector routes must be typed architecture routes')
    expect(spec).toContain('structured predicates')
    expect(spec).toContain('artifact registry')
    expect(spec).toContain('Reference-Calibrated Stroke Parameter Contract')
    expect(spec).toContain('Stroke Parameter Normalization Contract')
    expect(spec).toContain('DEFAULT_MITER_ANGLE_DEGREES = 28.96')
    expect(spec).toContain('MITER_ANGLE_EPSILON_DEGREES = 0.000001')
    expect(spec).toContain('Alpha-Safe Descriptor Projection')
    expect(spec).toContain(
      '`degenerate-bevel` is the only degenerate local join footprint'
    )
    expect(spec).toContain('emitted: false')
    expect(spec).toContain('`vertexAngle: null`')
    expect(spec).toContain('`angleSource: "source-domain-degenerate"`')
    expect(spec).toContain('a deterministic Asyra product rule')
    expect(spec).toContain('not an implementation preference')
    expect(spec).toContain(
      'runtime repair code must not invent seam tolerances'
    )
    expect(spec).toContain('must collapse duplicate')
    expect(spec).toContain('materialization identity')
    expect(spec).toMatch(
      /all five internal pentagon corners must respond to `strokeJoin` and\s+`miterAngle`/
    )
    expect(spec).toContain(
      'diagnostics emitted as channel-separated sibling or aggregation consumers'
    )
    expect(spec).toContain('Stroke Field Mapping')
    expect(spec).toContain('`stepIndex` is the zero-based machine index')
    expect(spec).toContain('`stepNumber` is the one-based human-facing number')
    expect(spec).toContain('runtimeImplementationState')
    expect(spec).toContain('41 runtime inspector steps')
    expect(spec).toContain('post-runtime validation gates')
    expect(spec).toContain('runtime audit/refactor starts')
    expect(spec).toContain(
      'legal-domain clipping that never reauthors the dash'
    )
    expect(spec).toMatch(
      /Legal\s+clip boundaries are not dashed-line endpoints/
    )
    expect(spec).toMatch(
      /allocator must not change dash\/gap lengths,\s+redistribute gaps,\s+or collapse the\s+dash interval allocation/i
    )
    expect(spec).toContain('Cap And Terminal Terminology')
    expect(spec).toContain(
      'A true open endpoint is an authored path/network endpoint'
    )
    expect(spec).toMatch(
      /Center dashed true open endpoint\s*\|\s*The owning terminal dash body plus the true endpoint authored cap route/
    )
    expect(spec).toContain(
      'For join-owned `start`, `end`, and `start-end` interval terminals'
    )
    expect(spec).toContain('Miter Terminology And Descriptor Adapter Fields')
    expect(spec).toContain('rendererMiterLimit')
    expect(spec).toContain('miterAngleEpsilonDegrees')
    expect(spec).toContain('delta > MITER_ANGLE_EPSILON_DEGREES')
    const staleTrueOpenEndpointContributor = [
      'Center dashed true open endpoint |',
      'The owning terminal dash body and its body-side authored cap policy'
    ].join(' ')
    const staleBroadEndpointSuppression = [
      [
        'Endpoint-side dash caps are suppressed',
        'for `start`, `end`, and `start-end`'
      ].join(' '),
      'terminal roles before join materialization'
    ].join('\n')
    expect(spec).not.toContain(staleTrueOpenEndpointContributor)
    expect(spec).not.toContain(staleBroadEndpointSuppression)
    expect(plan).toContain('Stroke Engine Refactor Execution Plan')
    expect(plan).toContain('This file is an execution plan only.')
    expect(plan).toContain('does not define stroke geometry')
    expect(plan).toContain(
      'The stroke engine spec is the semantic source of truth'
    )
    expect(plan).toMatch(
      /The inspector flow is\s+the executable route and step contract/
    )
    expect(plan).toContain('runtime implementation audit/refactor')
    expect(plan).toContain('41 runtime steps')
    expect(plan).toContain('post-runtime validation gate')
    expect(plan).toContain('Current runtime implementation step: read from')
    expect(plan).toContain('runtimeImplementationState.activeStepId')
    expect(plan).toContain('inspector-flow-first')
    expect(plan).toContain('Stroke Test Conformance Policy')
    expect(plan).toContain('Execution Rules')
    expect(plan).toContain('Document-only schema/spec audits')
    expect(plan).toContain('stroke parameter coverage matrix')
    expect(plan).toMatch(/fixed document deep audit\s+matrix/)
    expect(plan).toContain('at most three focused repair attempts')
    expect(plan).toContain('may be attempted at most')
    expect(plan).toContain('three times')
    expect(plan).not.toContain('true open authored path/network endpoint uses')
    expect(plan).not.toContain('cap-aware minimum visual gap')
    expect(plan).not.toContain(
      'it must collapse to a single `start-end` visible dash'
    )
    expect(plan).not.toContain('a deterministic Asyra product rule')
    expect(plan).not.toMatch(
      /must\s+collapse duplicate source-side split ranges/
    )
    expect(plan).not.toContain('Alpha-Safe Descriptor Projection')
    expect(plan).not.toContain(
      '`degenerate-bevel` is reserved for source-domain'
    )
    expect(plan).not.toContain(
      'diagnostics emitted as channel-separated sibling or aggregation consumers'
    )
    expect(data.latestRules.join(' ')).toContain(
      '#cap-and-terminal-terminology'
    )
    const staleOpenEndpointCapRule = [
      'True dangling/open endpoints',
      'forbid endpoint-side caps'
    ].join(' ')
    const staleOpenNetworkOptionalCollapse = [
      'it',
      'may',
      'collapse into one `start-end` visible dash'
    ].join(' ')
    const staleSplitRangeOptionalCollapse = [
      'range',
      'may',
      'collapse into one `start-end` visible dash'
    ].join(' ')
    const stalePlanOptionalCollapse = [
      'it',
      'may',
      'collapse to a single `start-end` visible dash'
    ].join(' ')
    const staleSmallEpsilon = ['A small', 'epsilon may bias'].join(' ')
    const staleUndefinedAlphaSafe = [
      'alpha-safe',
      'for the visible product'
    ].join(' ')
    const staleMiterGreaterThanAuthoredAngle = [
      'vertex angle is greater',
      'than the authored miter angle'
    ].join(' ')
    const staleMiterLessThanAuthoredAngle = [
      'vertex angle is less',
      'than or equal to the authored miter angle'
    ].join(' ')
    const staleLinearDiagnosticsPipeline = [
      'render entries /',
      ['hit-export packets / diagnostics', 'renderer projection'].join(' -> ')
    ].join('\n')
    const staleRendererProjectionHitExportRoute = [
      'linear',
      'renderer-projection',
      'to',
      'hit-export'
    ].join('-')
    expect(data.latestRules.join(' ')).not.toContain(staleOpenEndpointCapRule)
    expect(data.latestRules.join(' ')).toContain(
      'cap footprint does not authorize dash/gap redistribution'
    )
    expect(data.latestRules.join(' ')).toContain(
      'legal-domain clipping must not create new half-dash terminals'
    )
    expect(data.latestRules.join(' ')).toContain(
      'Asyra cap-aware collapse rule'
    )
    expect(data.latestRules.join(' ')).toContain(
      'must collapse duplicate source-side split ranges'
    )
    expect(data.latestRules.join(' ')).toContain(
      '#alpha-safe-descriptor-projection'
    )
    expect(data.latestRules.join(' ')).toContain(
      'Document Deep Audit Protocol matrix'
    )
    expect(data.latestRules.join(' ')).toContain(
      'MITER_ANGLE_EPSILON_DEGREES = 0.000001'
    )
    expect(spec).not.toContain(staleOpenNetworkOptionalCollapse)
    expect(spec).not.toContain(staleSplitRangeOptionalCollapse)
    expect(spec).not.toContain(staleSmallEpsilon)
    expect(spec).not.toContain(staleMiterGreaterThanAuthoredAngle)
    expect(spec).not.toContain(staleMiterLessThanAuthoredAngle)
    expect(spec).not.toContain(staleLinearDiagnosticsPipeline)
    expect(spec).not.toContain('readability heuristic')
    expect(spec).not.toContain('runtime heuristic')
    expect(spec).not.toContain('measuring readability')
    expect(plan).not.toContain(stalePlanOptionalCollapse)
    expect(plan).not.toContain(staleUndefinedAlphaSafe)
    expect(plan).not.toContain(staleMiterGreaterThanAuthoredAngle)
    expect(plan).not.toContain(staleMiterLessThanAuthoredAngle)
    expect(plan).not.toContain(staleLinearDiagnosticsPipeline)
    expect(plan).not.toContain('readability heuristic')
    expect(plan).not.toContain('runtime heuristic')
    expect(plan).not.toContain('measuring readability')
    expect(plan).not.toContain(
      'canonicalization may collapse duplicate source-side split ranges'
    )
    expect(data.latestRules.join(' ')).not.toContain('readability floor')
    expect(JSON.stringify(data.conditionalRoutes)).not.toContain(
      staleRendererProjectionHitExportRoute
    )
    expect(data.refactorProtocol.stepExecutionPolicy).toContain(
      'all 41 runtime inspector steps'
    )
    expect(data.refactorProtocol.stepRetryLimit).toBe(3)
    expect(data.refactorProtocol.integrationPolicy).toContain(
      'unit-complete checkpoint'
    )
    expect(data.refactorProtocol.integrationPolicy).toContain('locked')
    expect(data.refactorProtocol.fullRegressionRetryLimit).toBe(3)
    expect(data.refactorProtocol.e2ePolicy).toContain('locked')
    expect(data.refactorProtocol.documentDeepAuditPolicy).toContain(
      'fixed matrix'
    )
    const strokeSpecRoute = routeById(
      data,
      'linear-normalize-stroke-spec-to-shared-geometry-model'
    )
    expect(strokeSpecRoute.specRuleRefs).toEqual(
      expect.arrayContaining([
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#reference-calibrated-stroke-parameter-contract',
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#stroke-parameter-normalization-contract'
      ])
    )
  })

  it('requires a fixed document deep audit matrix before document-only closure', () => {
    const data = loadInspectorData()
    const spec = readRepoFile(specPath)
    const plan = readRepoFile(planPath)
    const normalizedSpec = spec.toLowerCase()
    const protocol = data.documentDeepAuditProtocol
    const requiredMatrixItems = [
      'source-of-truth boundaries',
      'inspector/spec separation',
      'reference-calibrated stroke parameter rules',
      'join and miter resolution',
      'dash body, dash cap, and join seam continuity',
      'smooth-continuity and high-curvature routing',
      'center/inside/outside construction',
      'artifact lifecycle',
      'spec-to-enforcement lifecycle contracts',
      'channel separation',
      'cache, dirty, bypass, and current-state rendering',
      'owner-stage metadata',
      'forbidden contributors',
      'route predicates and reachability',
      'artifact registry integrity',
      'retired wording scan',
      'numeric tolerance and evidence uniqueness',
      'test/refactor/visual gates'
    ]

    expect(protocol.source).toBe(
      'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#document-deep-audit-protocol'
    )
    expect(protocol.validationGate).toBe(
      'packages/preset/src/__tests__/stroke-flow-refactor-protocol.test.ts'
    )
    expect(protocol.requiredPassOrder).toEqual([
      'define complete matrix before the deep audit starts',
      'run every matrix item in one pass',
      'summarize all findings together',
      'apply one focused documentation edit batch',
      'rerun the same matrix after edits',
      'record newly discovered audit concerns as deferred matrix extensions'
    ])
    expect(protocol.minimumMatrix).toEqual(requiredMatrixItems)
    expect(protocol.forbiddenAuditBehavior).toEqual(
      expect.arrayContaining([
        'adding a new focus area during the same deep-audit pass',
        'editing documentation before the complete matrix has been declared',
        'claiming closure from one matrix subsection',
        'rerunning a different matrix after edits without updating the protocol first'
      ])
    )
    for (const item of requiredMatrixItems) {
      expect(normalizedSpec).toContain(item)
      expect(protocol.minimumMatrix).toContain(item)
    }
    expect(spec).toMatch(
      /A deep audit must not add new\s+focus areas in the middle of the same pass\./
    )
    expect(spec).toMatch(/deferred matrix\s+extension/)
    expect(plan).toMatch(
      /New concerns found during an audit are\s+recorded as deferred matrix extensions/
    )
    expect(
      data.ruleRegistry.some(
        (rule) => rule.id === 'document-deep-audit-protocol'
      )
    ).toBe(true)
    expect(
      data.ruleRegistry.find(
        (rule) => rule.id === 'document-deep-audit-protocol'
      )?.text
    ).toContain('fixed Document Deep Audit Protocol matrix')
  })

  it('turns dash/join seam identity into a structured lifecycle contract', () => {
    const data = loadInspectorData()
    const spec = readRepoFile(specPath)
    const stepIds = new Set(data.steps.map((step) => step.id))
    const artifactIds = new Set(
      data.artifactRegistry.map((artifact) => artifact.id)
    )
    const ownershipRecords = new Map(
      data.sourceFileOwnershipRecords.map((record) => [record.filePath, record])
    )
    const contract = data.dashJoinSeamLifecycleContract
    const phaseById = new Map(
      contract.lifecycle.map((phase) => [phase.phase, phase])
    )

    expect(spec).toContain('Spec-To-Enforcement Contract')
    expect(spec).toContain('dash/join seam identity contract')
    expect(data.dashJoinSeamLifecycleErrors).toEqual([])
    expect(contract).toMatchObject({
      id: 'dash-join-seam-identity-lifecycle',
      specRuleId: 'dash-join-seam-contract',
      specAnchor:
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#dash-body-and-join-seam-contract',
      formalGate:
        'packages/preset/src/__tests__/stroke-flow-refactor-protocol.test.ts'
    })
    expect(contract.artifactIds).toEqual(
      expect.arrayContaining([
        'artifact:dash-body-seam-boundary',
        'artifact:constrained-dashed-source-vertex-join-product',
        'artifact:postLegalityProductUnits',
        'artifact:finalFaces',
        'artifact:constrained-dashed-render-descriptor',
        'artifact:renderEntries'
      ])
    )
    expect(contract.ownerSteps).toEqual(
      expect.arrayContaining([
        'build-dash-interval-body-products',
        'build-source-vertex-join-products',
        'apply-legality',
        'build-final-faces',
        'materialize-stroke-product-descriptors',
        'render-entries',
        'renderer-projection'
      ])
    )
    for (const stepId of contract.ownerSteps) {
      expect(stepIds.has(stepId), stepId).toBe(true)
    }
    for (const artifactId of contract.artifactIds) {
      expect(artifactIds.has(artifactId), artifactId).toBe(true)
    }
    for (const phase of contract.lifecycle) {
      expect(stepIds.has(phase.stepId), phase.phase).toBe(true)
      expect(stepIds.has(phase.failureReopensStep), phase.phase).toBe(true)
      for (const routeId of phase.routeIds) {
        const route = routeById(data, routeId)
        expect(
          route.from === phase.stepId || route.to === phase.stepId,
          `${phase.phase}:${routeId}`
        ).toBe(true)
      }
      for (const artifactId of [
        ...(phase.consumesArtifacts ?? []),
        ...(phase.producesArtifacts ?? [])
      ]) {
        expect(
          artifactIds.has(artifactId),
          `${phase.phase}:${artifactId}`
        ).toBe(true)
      }
    }
    expect([...phaseById.keys()]).toEqual(
      expect.arrayContaining([
        'produce-seam-boundary',
        'dispatch-seam-boundary',
        'consume-seam-boundary',
        'preserve-through-legality',
        'preserve-through-final-faces',
        'preserve-through-render-entries',
        'forbid-renderer-recompute'
      ])
    )
    expect(phaseById.get('produce-seam-boundary')?.producesArtifacts).toContain(
      'artifact:dash-body-seam-boundary'
    )
    expect(phaseById.get('consume-seam-boundary')?.requiredEvidence).toEqual(
      expect.arrayContaining([
        'proof that dash and join visible triangles share the same Step 27 seam endpoint identities',
        'dash/join zero-gap adjacency proof'
      ])
    )
    expect(
      phaseById.get('preserve-through-legality')?.preservedEvidence
    ).toEqual(
      expect.arrayContaining([
        'same Step 27 seam endpoint identity when visible dash/join products survive legality'
      ])
    )
    expect(
      phaseById.get('forbid-renderer-recompute')?.forbiddenLateComputation
    ).toEqual(
      expect.arrayContaining([
        'dash/join seam endpoint reinterpretation',
        'join shape decision',
        'cap shape decision',
        'same-paint alpha decision'
      ])
    )

    const joinRoute = routeById(
      data,
      'constrained-dashed-source-vertex-join-product'
    )
    expect(joinRoute.evidenceRequired).toEqual(
      expect.arrayContaining([
        'proof that dash and join visible triangles share the same Step 27 seam endpoint identities',
        'dash/join zero-gap adjacency proof'
      ])
    )
    const renderProjectionRoute = routeById(data, 'render-projection-merge')
    expect(
      renderProjectionRoute.computationContract?.forbiddenLateComputation
    ).toEqual(
      expect.arrayContaining([
        'join shape decision',
        'cap shape decision',
        'same-paint alpha decision'
      ])
    )

    const footprintRecord = ownershipRecords.get(
      'packages/preset/src/components/stroke-render/source-vertex-join-footprint.ts'
    )
    expect(footprintRecord).toMatchObject({
      classification: 'owner-entry',
      ownerStepId: 'build-source-vertex-join-products',
      requiredInspectorField: 'sourceFileOwnershipRecords.ownerEntry',
      productionCodeChangeNeeded: false
    })
    expect(footprintRecord?.ownerRouteIds).toEqual(
      expect.arrayContaining([
        'center-solid-canonical-source-vertex-join-footprint',
        'constrained-solid-canonical-source-vertex-join-footprint',
        'constrained-dashed-source-vertex-join-product'
      ])
    )
  })

  it('requires typed route schema, derived edges, and hit/export sibling flow', () => {
    const data = loadInspectorData()
    const routeTypeSet = new Set(data.routeTypes)
    const edgeSet = new Set(data.edges.map(([from, to]) => `${from}->${to}`))
    const routeEdgeSet = new Set(
      data.conditionalRoutes.map((route) => `${route.from}->${route.to}`)
    )
    const artifactIds = new Set(
      data.artifactRegistry.map((artifact) => artifact.id)
    )
    const decisionGroups = new Map<string, InspectorRoute[]>()

    for (const route of data.conditionalRoutes) {
      expect(routeTypeSet.has(route.routeType)).toBe(true)
      expect(route.exclusiveGroup).toBeTruthy()
      expect(route.decisionGroup).toBeTruthy()
      expect(route.parallelGroup).toBeTruthy()
      expect(route.coExecutionGroup).toBeTruthy()
      expect(Number.isFinite(route.routePriority)).toBe(true)
      expect(route.conditionKind).toBeTruthy()
      expect(route.conditionId).toBeTruthy()
      expect(route.predicateInputs.length).toBeGreaterThan(0)
      expect(route.when).toBeTruthy()
      expect(route.resumeAt).toBeTruthy()
      expect(route.nextConsumer).toBeTruthy()
      expect(route.consumes.length).toBeGreaterThan(0)
      expect(route.produces.length).toBeGreaterThan(0)
      expect(route.dirtyDependencies.length).toBeGreaterThan(0)
      expect(route.cacheKeyInputs.length).toBeGreaterThan(0)
      expect(route.visibleContributor).toBeTruthy()
      expect(route.geometryBasis).toBeTruthy()
      expect(route.specRuleRefs.length).toBeGreaterThan(0)
      expect(route.when).not.toHaveProperty('kind')
      expect(route.when).not.toHaveProperty('inputs')
      for (const artifactId of [...route.consumes, ...route.produces]) {
        expect(artifactIds.has(artifactId), `${route.id}:${artifactId}`).toBe(
          true
        )
      }
      decisionGroups.set(route.decisionGroup, [
        ...(decisionGroups.get(route.decisionGroup) ?? []),
        route
      ])
      if (route.conditionKind === 'else') {
        expect(route.routePriority).toBeGreaterThanOrEqual(900)
        expect(route.condition).toContain('Else route')
        expect(route.when.elseOf).toBe(route.decisionGroup)
        expect(route.elseOf).toBe(route.decisionGroup)
      } else {
        expect(route.elseOf).toBe('none')
        expect(
          route.when.all || route.when.any || route.when.not || route.when.field
        ).toBeTruthy()
      }
      if (route.routeType === 'parallel') {
        expect(route.parallelGroup).not.toBe('none')
        expect(route.coExecutionGroup).not.toBe('none')
      }
    }

    for (const [decisionGroup, routes] of decisionGroups.entries()) {
      const elseRoutes = routes.filter(
        (route) => route.conditionKind === 'else'
      )
      if (elseRoutes.length > 0) {
        expect(elseRoutes, decisionGroup).toHaveLength(1)
      }
      expect(new Set(routes.map((route) => route.conditionId)).size).toBe(
        routes.length
      )
    }

    expect(edgeSet).toEqual(routeEdgeSet)
    expect(
      data.conditionalRoutes.find(
        (route) =>
          route.from === 'renderer-projection' && route.to === 'hit-export'
      )
    ).toBeUndefined()
    expect(routeById(data, 'hit-export-channel-packet-projection').from).toBe(
      'emit-render-hit-export-packets'
    )
    expect(routeById(data, 'renderer-projection-diagnostics-snapshot').to).toBe(
      'runtime-diagnostics'
    )
    expect(routeById(data, 'diagnostics-channel-aggregation').to).toBe(
      'runtime-diagnostics'
    )
  })

  it('requires explicit dirty/cache bypass routes', () => {
    const data = loadInspectorData()
    const paintOnly = routeById(data, 'paint-only-cache-retint')
    const hiddenOutput = routeById(data, 'hidden-output-cache-bypass')
    const cacheHit = routeById(data, 'verified-product-descriptor-cache-hit')
    const sourceDrag = routeById(data, 'source-drag-dirty-classification')

    expect(paintOnly.routeType).toBe('bypass')
    expect(paintOnly.resumeAt).toBe('attach-paint-payload')
    expect(paintOnly.nextConsumer).toBe('attach-paint-payload')
    expect(paintOnly.skipSteps).toEqual(
      expect.arrayContaining([
        'resolve-stroke-domains',
        'allocate-dash-intervals',
        'select-stroke-product-family',
        'build-center-stroke-products',
        'build-constrained-solid-products',
        'build-dash-interval-body-products',
        'build-source-vertex-join-products',
        'build-terminal-body-products',
        'build-smooth-continuity-products',
        'select-stroke-descriptor-strategy',
        'apply-legality'
      ])
    )
    expect(hiddenOutput.skipSteps).toEqual(
      expect.arrayContaining([
        'build-final-faces',
        'materialize-stroke-product-descriptors',
        'attach-paint-payload'
      ])
    )
    expect(hiddenOutput.resumeAt).toBe('emit-render-hit-export-packets')
    expect(cacheHit.cacheKeyInputs).toEqual(
      expect.arrayContaining([
        'source revision',
        'topology/domain signature',
        'dash interval allocation signature',
        'terminal cap signature',
        'join/miter signature',
        'legal-side signature',
        'descriptor-mode signature',
        'paint signature',
        'output channel'
      ])
    )
    expect(cacheHit.resumeAt).toBe('build-final-faces')
    expect(sourceDrag.forbiddenContributors).toContain(
      'static stroke parameter dirtying'
    )
  })

  it('requires split product steps, spec refs, and miter field separation', () => {
    const data = loadInspectorData()
    const splitProductSteps = [
      'select-stroke-product-family',
      'build-center-stroke-products',
      'build-constrained-solid-products',
      'build-dash-interval-body-products',
      'build-source-vertex-join-products',
      'build-terminal-body-products',
      'build-smooth-continuity-products',
      'select-stroke-descriptor-strategy'
    ]
    const requiredProductRoutes = [
      'select-center-product-family',
      'select-constrained-solid-product-family',
      'select-constrained-dashed-product-family',
      'center-solid-authored-stroke-descriptor',
      'center-dashed-authored-stroke-descriptor',
      'center-solid-canonical-source-vertex-join-footprint',
      'constrained-solid-doubled-center-mask',
      'constrained-solid-canonical-source-vertex-join-footprint',
      'constrained-solid-same-owner-smooth-span-descriptor',
      'constrained-dashed-interval-body-product',
      'constrained-dashed-source-vertex-join-product',
      'constrained-dashed-smooth-continuity-product',
      'constrained-dashed-join-owned-terminal-body-product',
      'constrained-dashed-products-coexecute-descriptor-strategy'
    ]
    const requiredDescriptorOutputRoutes = [
      'constrained-dashed-descriptor-materialization',
      'constrained-dashed-inside-mask-descriptor',
      'constrained-dashed-outside-source-domain-descriptor',
      'constrained-dashed-outside-aggregate-descriptor',
      'canonical-final-face-render-entry'
    ]

    expect(data.steps.map((step) => step.id)).not.toContain(
      retiredSingleProductStepId
    )
    for (const id of splitProductSteps) {
      expect(data.steps.map((step) => step.id)).toContain(id)
      expect(data.nestedRoutesByStep[id], id).toBeDefined()
    }

    for (const id of requiredProductRoutes) {
      const route = routeById(data, id)
      expect(splitProductSteps).toContain(route.from)
      expect(route.exclusiveGroup).not.toContain(retiredSingleProductGroupId)
      expect(route.decisionGroup).not.toContain(retiredSingleProductStepId)
      expect(route.consumes.length).toBeGreaterThan(0)
      expect(route.produces.length).toBeGreaterThan(0)
      expect(route.visibleContributor).toBeTruthy()
      expect(route.geometryBasis).toBeTruthy()
      expect(route.specRuleRefs.length).toBeGreaterThan(0)
      if (route.routeType === 'parallel') {
        expect(route.coExecutionGroup).not.toBe('none')
      }
    }

    const nestedProductRouteIds = splitProductSteps.flatMap((stepId) =>
      (data.nestedRoutesByStep[stepId] ?? []).map((route) => route.id)
    )
    expect(nestedProductRouteIds).toEqual(
      expect.arrayContaining(requiredProductRoutes)
    )
    for (const stepId of splitProductSteps) {
      for (const route of data.nestedRoutesByStep[stepId] ?? []) {
        expect(route.ownerStage).toBeTruthy()
        expect(route.visibleContributor).toBeTruthy()
        expect(route.geometryBasis).toBeTruthy()
        expect(route.allowedContributors.length).toBeGreaterThan(0)
        expect(route.forbiddenContributors.length).toBeGreaterThan(0)
        expect(route.specRuleRefs.length).toBeGreaterThan(0)
      }
    }

    const artifactIds = new Set(
      data.artifactRegistry.map((artifact) => artifact.id)
    )
    for (const id of [
      'artifact:preLegalityProductUnits',
      'artifact:postLegalityProductUnits',
      'artifact:descriptorStrategyRecords',
      'artifact:finalFaces',
      'artifact:renderEntries',
      'artifact:hitExportPackets',
      'artifact:diagnosticSnapshots'
    ]) {
      expect(artifactIds.has(id), id).toBe(true)
    }

    expect(
      routeById(data, 'legality-product-unit-clipping').consumes
    ).toContain('artifact:preLegalityProductUnits')
    expect(
      routeById(
        data,
        'constrained-dashed-products-coexecute-descriptor-strategy'
      ).produces
    ).toContain('artifact:descriptorStrategyRecords')
    const materializationRoute = routeById(
      data,
      'constrained-dashed-descriptor-materialization'
    )
    expect(materializationRoute.from).toBe('build-final-faces')
    expect(materializationRoute.to).toBe(
      'materialize-stroke-product-descriptors'
    )
    expect(materializationRoute.consumes).not.toContain(
      'artifact:preLegalityProductUnits'
    )
    expect(materializationRoute.consumes).toEqual(
      expect.arrayContaining([
        'artifact:finalFaces',
        'artifact:descriptorStrategyRecords',
        'artifact:postLegalityProductUnits',
        'artifact:legalityEquivalentProductUnits'
      ])
    )
    expect(materializationRoute.produces).toContain(
      'artifact:constrained-dashed-render-descriptor'
    )
    expect(materializationRoute.produces).not.toContain('artifact:finalFaces')

    for (const id of requiredDescriptorOutputRoutes) {
      const route = routeById(data, id)
      expect(route.consumes.length).toBeGreaterThan(0)
      expect(route.produces.length).toBeGreaterThan(0)
      expect(route.specRuleRefs.length).toBeGreaterThan(0)
    }
    for (const id of [
      'constrained-dashed-inside-mask-descriptor',
      'constrained-dashed-outside-source-domain-descriptor',
      'constrained-dashed-outside-aggregate-descriptor'
    ]) {
      const route = routeById(data, id)
      expect(route.from).toBe('materialize-stroke-product-descriptors')
      expect(route.consumes).toContain(
        'artifact:constrained-dashed-render-descriptor'
      )
      expect(route.produces).toContain('artifact:renderEntries')
    }
    expect(routeById(data, 'canonical-final-face-render-entry').from).toBe(
      'build-final-faces'
    )
    expect(
      routeById(data, 'canonical-final-face-render-entry').produces
    ).toContain('artifact:renderEntries')

    const completionGroups = new Set(
      data.coExecutionCompletionRules.map((rule) => rule.coExecutionGroup)
    )
    const routeCoExecutionGroups = new Set(
      data.conditionalRoutes
        .map((route) => route.coExecutionGroup)
        .filter((group) => group !== 'none')
    )
    for (const group of routeCoExecutionGroups) {
      expect(completionGroups.has(group), group).toBe(true)
    }
    for (const rule of data.coExecutionCompletionRules) {
      expect(rule.requiredRouteIds.length).toBeGreaterThan(0)
      expect(rule.completionArtifactIds.length).toBeGreaterThan(0)
      expect(rule.semantics).toBeTruthy()
      for (const routeId of rule.requiredRouteIds) {
        expect(
          data.conditionalRoutes.some((route) => route.id === routeId)
        ).toBe(true)
      }
    }

    const joinRoute = routeById(
      data,
      'constrained-dashed-source-vertex-join-product'
    )
    expect(joinRoute.specRuleRefs.join(' ')).toContain(
      '#asyra-join-resolution-baseline'
    )
    expect(joinRoute.specRuleRefs.join(' ')).toContain(
      '#source-domain-angle-evidence'
    )
    expect(joinRoute.specRuleRefs.join(' ')).toContain(
      '#dash-body-and-join-seam-contract'
    )
    expect(joinRoute.metricAssertions.length).toBeGreaterThan(0)

    const diagnosticsRoute = routeById(data, 'diagnostics-channel-aggregation')
    expect(diagnosticsRoute.consumes).toEqual(
      expect.arrayContaining([
        'artifact:renderer-projection-diagnostic-snapshot',
        'artifact:hitExportPackets'
      ])
    )
    expect(diagnosticsRoute.produces).toContain('artifact:diagnosticSnapshots')

    const serializedRoutes = JSON.stringify(data.conditionalRoutes)
    const retiredRendererMiterField = ['miter', 'Limit'].join('')
    expect(serializedRoutes).not.toContain(retiredSingleProductStepId)
    expect(serializedRoutes).not.toContain(retiredDescriptorAssemblyStepId)
    expect(serializedRoutes).not.toContain(retiredSingleProductGroupId)
    expect(serializedRoutes).not.toContain('"kind":"all"')
    expect(
      JSON.stringify(data.conditionalRoutes.map((route) => route.when))
    ).not.toContain('"inputs"')
    expect(
      JSON.stringify(data.conditionalRoutes.map((route) => route.when))
    ).not.toContain('source.route-id')
    expect(
      JSON.stringify(data.conditionalRoutes.map((route) => route.when))
    ).not.toContain('source.source-revision')
    expect(serializedRoutes).not.toContain(retiredRendererMiterField)
    expect(serializedRoutes).toContain('rendererMiterLimit')
    expect(serializedRoutes).toContain('miterAngle')
    expect(serializedRoutes).toContain('vertexAngle')
    expect(serializedRoutes).toContain('angleSource')
  })

  it('requires stage-locked computation ownership for dash, join, and render output', () => {
    const data = loadInspectorData()
    const spec = readRepoFile(specPath)
    const artifactIds = new Set(
      data.artifactRegistry.map((artifact) => artifact.id)
    )
    const ruleIds = new Set(data.ruleRegistry.map((rule) => rule.id))
    const computationSpecRef =
      'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#computation-ownership-and-timing-contract'

    expect(spec).toContain('### Computation Ownership And Timing Contract')
    expect(ruleIds).toContain('computation-ownership-timing')
    expect(data.latestRules.join(' ')).toContain(
      '#computation-ownership-and-timing-contract'
    )
    expect(artifactIds).toContain('artifact:dash-body-seam-boundary')

    const dashBodyRoute = routeById(
      data,
      'constrained-dashed-interval-body-product'
    )
    expect(dashBodyRoute.produces).toEqual(
      expect.arrayContaining([
        'artifact:constrained-dashed-interval-body-product',
        'artifact:dash-body-seam-boundary'
      ])
    )
    expect(dashBodyRoute.cacheKeyInputs).toEqual(
      expect.arrayContaining(['terminal role', 'endpoint cap policy'])
    )
    expect(dashBodyRoute.computationContract).toMatchObject({
      computedAt: 'build-dash-interval-body-products',
      consumesArtifacts: ['artifact:dash-product-interval'],
      producesArtifacts: [
        'artifact:constrained-dashed-interval-body-product',
        'artifact:dash-body-seam-boundary'
      ],
      consumedBy: [
        'build-source-vertex-join-products',
        'build-terminal-body-products',
        'apply-legality'
      ],
      mustNotRecomputeAfter: 'build-source-vertex-join-products'
    })
    expect(dashBodyRoute.computationContract?.forbiddenLateComputation).toEqual(
      expect.arrayContaining([
        'dash interval endpoint relocation',
        'dash body seam boundary relocation',
        'endpoint cap suppression reinterpretation',
        'bevel endpoint substitution'
      ])
    )
    expect(dashBodyRoute.specRuleRefs).toContain(computationSpecRef)

    const joinDispatchRoute = routeById(
      data,
      'constrained-dashed-products-coexecute-source-vertex-join-products'
    )
    expect(joinDispatchRoute.consumes).toContain(
      'artifact:dash-body-seam-boundary'
    )
    expect(joinDispatchRoute.cacheKeyInputs).toContain(
      'dash body seam boundary signature'
    )
    expect(joinDispatchRoute.limitations.join(' ')).toContain(
      'may not recompute'
    )
    expect(joinDispatchRoute.evidenceRequired).toContain(
      'dash body seam boundary artifact ids'
    )
    expect(joinDispatchRoute.specRuleRefs).toContain(computationSpecRef)

    const sourceVertexJoinRoute = routeById(
      data,
      'constrained-dashed-source-vertex-join-product'
    )
    expect(sourceVertexJoinRoute.consumes).toContain(
      'artifact:dash-body-seam-boundary'
    )
    expect(sourceVertexJoinRoute.cacheKeyInputs).toContain(
      'dash body seam boundary signature'
    )
    expect(sourceVertexJoinRoute.evidenceRequired).toContain(
      'bevel and bevel-by-miter-angle cut-off edge endpoint ids from incident dash body outer boundaries'
    )
    expect(sourceVertexJoinRoute.computationContract).toMatchObject({
      computedAt: 'build-source-vertex-join-products',
      consumesArtifacts: [
        'artifact:dash-product-interval',
        'artifact:dash-body-seam-boundary'
      ],
      producesArtifacts: [
        'artifact:constrained-dashed-source-vertex-join-product'
      ],
      consumedBy: ['apply-legality', 'build-final-faces', 'render-entries'],
      mustNotRecomputeAfter: 'apply-legality'
    })
    expect(
      sourceVertexJoinRoute.computationContract?.forbiddenLateComputation
    ).toEqual(
      expect.arrayContaining([
        'vertexAngle from visible product footprint',
        'bevel cut-off endpoint relocation',
        'incident dash seam boundary reinterpretation',
        'renderer join ownership'
      ])
    )
    expect(sourceVertexJoinRoute.specRuleRefs).toContain(computationSpecRef)

    const terminalDispatchRoute = routeById(
      data,
      'constrained-dashed-products-coexecute-terminal-body-products'
    )
    expect(terminalDispatchRoute.consumes).toContain(
      'artifact:dash-body-seam-boundary'
    )
    expect(terminalDispatchRoute.cacheKeyInputs).toContain(
      'dash body seam boundary signature'
    )
    expect(terminalDispatchRoute.limitations.join(' ')).toContain(
      'may not recompute'
    )

    const terminalBodyRoute = routeById(
      data,
      'constrained-dashed-join-owned-terminal-body-product'
    )
    expect(terminalBodyRoute.consumes).toContain(
      'artifact:dash-body-seam-boundary'
    )
    expect(terminalBodyRoute.computationContract).toMatchObject({
      computedAt: 'build-terminal-body-products',
      consumesArtifacts: [
        'artifact:dash-product-interval',
        'artifact:dash-body-seam-boundary'
      ],
      producesArtifacts: [
        'artifact:constrained-dashed-join-owned-terminal-body-product'
      ],
      consumedBy: ['apply-legality', 'build-final-faces', 'render-entries'],
      mustNotRecomputeAfter: 'apply-legality'
    })
    expect(
      terminalBodyRoute.computationContract?.forbiddenLateComputation
    ).toEqual(
      expect.arrayContaining([
        'source-vertex corner coverage',
        'dash/join seam closure',
        'endpoint-side cap restoration',
        'terminal seam boundary relocation'
      ])
    )
    expect(terminalBodyRoute.specRuleRefs).toContain(computationSpecRef)

    const renderEntryRoute = routeById(
      data,
      'canonical-final-face-render-entry'
    )
    expect(renderEntryRoute.cacheKeyInputs).toContain(
      'same-paint overlap signature'
    )
    expect(renderEntryRoute.computationContract).toMatchObject({
      computedAt: 'render-entries',
      consumesArtifacts: ['artifact:finalFaces'],
      producesArtifacts: ['artifact:renderEntries'],
      consumedBy: ['renderer-projection', 'runtime-diagnostics'],
      mustNotRecomputeAfter: 'renderer-projection'
    })
    expect(renderEntryRoute.evidenceRequired.join(' ')).toContain(
      'same-paint single-composite'
    )
    expect(renderEntryRoute.specRuleRefs).toContain(computationSpecRef)

    const projectionRoute = routeById(data, 'render-projection-merge')
    expect(projectionRoute.computationContract).toMatchObject({
      computedAt: 'renderer-projection',
      consumesArtifacts: ['artifact:renderEntries'],
      producesArtifacts: ['stage:renderer-projection'],
      consumedBy: ['runtime-diagnostics'],
      mustNotRecomputeAfter: 'runtime-diagnostics'
    })
    expect(
      projectionRoute.computationContract?.forbiddenLateComputation
    ).toEqual(
      expect.arrayContaining([
        'join shape decision',
        'cap shape decision',
        'same-paint alpha decision',
        'descriptor evidence promotion'
      ])
    )
    expect(projectionRoute.limitations.join(' ')).toContain(
      'same-paint alpha decisions already carried by render entries'
    )
    expect(projectionRoute.specRuleRefs).toContain(computationSpecRef)
  })
})
