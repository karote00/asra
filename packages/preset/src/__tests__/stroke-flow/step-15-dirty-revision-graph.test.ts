import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { assertStrokeParameterCoverageForStep } from './stroke-parameter-coverage-test-helper'
import {
  buildStrokeRuntimeRevisionSet,
  computeStrokeDirtyKeys,
  type StrokeRevisionSet
} from '../../components/stroke-render/stroke-dirty-keys'

type RefactorStatus = 'locked' | 'active' | 'verified'

interface InspectorStep {
  id: string
  refactorStatus: RefactorStatus
  implementationFiles: string[]
  allowedInputs: string[]
  requiredOutputs: string[]
  ownerStage: string
}

interface InspectorData {
  steps: InspectorStep[]
  inspectorContractErrors: string[]
}

const repoRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../'
)
const require = createRequire(import.meta.url)
const inspectorPath = resolve(
  repoRoot,
  'docs/ai/apps/asyra-design/plans/stroke-engine-final/stroke-flow-inspector.data.js'
)
const vectorComponentSourcePath = resolve(
  repoRoot,
  'packages/preset/src/components/vector.ts'
)

const samplePoints = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 }
]

const baseStroke = {
  visible: true,
  style: 'solid',
  position: 'outside',
  width: 16,
  join: 'miter',
  miterLimit: 4,
  cap: 'butt',
  dash: 0,
  gap: 0,
  kind: 'solid',
  color: 0x808080,
  alpha: 1,
  paintKey: 'solid:gray'
}

let cachedInspectorData: InspectorData | null = null

const loadInspectorData = (): InspectorData => {
  if (cachedInspectorData) {
    return cachedInspectorData
  }
  const windowRecord: { STROKE_FLOW_INSPECTOR_DATA?: InspectorData } = {}
  ;(globalThis as typeof globalThis & { window?: unknown }).window =
    windowRecord
  Reflect.deleteProperty(require.cache, require.resolve(inspectorPath))
  require(inspectorPath)
  const data = windowRecord.STROKE_FLOW_INSPECTOR_DATA
  expect(data).toBeDefined()
  cachedInspectorData = data as InspectorData
  return cachedInspectorData
}

const buildRevisionSet = (
  overrides: Partial<Parameters<typeof buildStrokeRuntimeRevisionSet>[0]> = {}
): StrokeRevisionSet =>
  buildStrokeRuntimeRevisionSet({
    points: samplePoints,
    closed: true,
    stroke: baseStroke,
    productMode: 'constrained-solid',
    domainMode: 'closed-constrained-domain',
    ownerKey: 'vector:step-15',
    networkId: 'network:0',
    strokeId: 'stroke:0',
    sharedGeometrySignature: 'shared:0',
    strokeProductSignature: 'product:0',
    strokeDomainSignature: 'domain:0',
    intervalSignature: 'solid',
    endpointCapPolicySignature: 'cap:butt',
    joinOwnershipSignature: 'join:miter',
    ownerCount: 1,
    smoothContinuitySignature: 'smooth:0',
    productMaterializationSignature: 'materialized:0',
    legalitySignature: 'legal:0',
    resolvedRegionSignature: 'region:0',
    renderOutputSignature: 'render:0',
    ...overrides
  })

afterEach(() => {
  delete (
    globalThis as typeof globalThis & {
      __asyraStrokePipelineCounterSink?: unknown
    }
  ).__asyraStrokePipelineCounterSink
})

describe('stroke flow step 15: dirty-revision-graph', () => {
  it('keeps dirty-revision-graph as the current or verified fifteenth step', () => {
    const data = loadInspectorData()
    const step = data.steps.find((entry) => entry.id === 'dirty-revision-graph')
    const activeSteps = data.steps.filter(
      (entry) => entry.refactorStatus === 'active'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(step?.refactorStatus).toMatch(/^(active|verified)$/)
    if (step?.refactorStatus === 'active') {
      expect(activeSteps.map((entry) => entry.id)).toEqual([
        'dirty-revision-graph'
      ])
    }
  })

  it('limits this step implementation to dirty keys and their vector cache consumer', () => {
    const data = loadInspectorData()
    const step = data.steps.find((entry) => entry.id === 'dirty-revision-graph')

    expect(step).toMatchObject({
      ownerStage: 'Render Mirror',
      allowedInputs: [
        'previous stroke runtime revision set',
        'next stroke runtime revision set',
        'changed vector source points or stroke parameter patch'
      ],
      requiredOutputs: [
        'changed revision keys',
        'ordered dirty stage keys',
        'stroke pipeline cache counters'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/stroke-dirty-keys.ts',
        'packages/preset/src/components/vector.ts'
      ]
    })
  })

  it('keeps paint-only updates scoped to paint payload and render output', () => {
    const previous = buildRevisionSet()
    const next = buildRevisionSet({
      stroke: {
        ...baseStroke,
        color: 0xff0000,
        paintKey: 'solid:red'
      }
    })
    const counters: string[] = []
    ;(
      globalThis as typeof globalThis & {
        __asyraStrokePipelineCounterSink?: (counterName: string) => void
      }
    ).__asyraStrokePipelineCounterSink = (counterName) => {
      counters.push(counterName)
    }

    const result = computeStrokeDirtyKeys(previous, next)

    expect(result.changedRevisionKeys).toEqual(['paintRevision'])
    expect(result.dirtyKeys).toEqual(['paint-payload', 'render-hit-export'])
    expect(counters).toEqual(
      expect.arrayContaining([
        'stroke-revision-change:paintRevision',
        'stroke-dirty-key:paint-payload',
        'stroke-dirty-key:render-hit-export',
        'stroke-cache:paint-only-update'
      ])
    )
  })

  it('keeps join changes scoped to join ownership and downstream product stages', () => {
    const previous = buildRevisionSet()
    const next = buildRevisionSet({
      stroke: {
        ...baseStroke,
        join: 'bevel'
      },
      joinOwnershipSignature: 'join:bevel'
    })

    const result = computeStrokeDirtyKeys(previous, next)

    expect(result.changedRevisionKeys).toEqual([
      'ownershipRevision',
      'joinShapeRevision'
    ])
    expect(result.dirtyKeys).toEqual([
      'join-ownership',
      'smooth-continuity',
      'product-materialization',
      'legality',
      'resolved-regions',
      'render-hit-export'
    ])
    expect(result.dirtyKeys).not.toContain('path-topology')
    expect(result.dirtyKeys).not.toContain('stroke-domain')
    expect(result.dirtyKeys).not.toContain('interval-allocation')
  })

  it('classifies stroke geometry parameters into their first dirty owner stages', () => {
    const previous = buildRevisionSet()

    const widthChange = computeStrokeDirtyKeys(
      previous,
      buildRevisionSet({
        stroke: {
          ...baseStroke,
          width: 24
        },
        strokeDomainSignature: 'domain:width',
        endpointCapPolicySignature: 'cap:width',
        joinOwnershipSignature: 'join:width'
      })
    )
    expect(widthChange.changedRevisionKeys).toEqual(
      expect.arrayContaining([
        'strokeDomainRevision',
        'terminalCapRevision',
        'joinShapeRevision'
      ])
    )
    expect(widthChange.dirtyKeys).toEqual(
      expect.arrayContaining([
        'stroke-domain',
        'endpoint-cap-policy',
        'join-ownership',
        'render-hit-export'
      ])
    )
    expect(widthChange.dirtyKeys).not.toContain('path-topology')
    expect(widthChange.dirtyKeys).not.toContain('paint-payload')

    const previousDashed = buildRevisionSet({
      stroke: {
        ...baseStroke,
        style: 'dashed',
        dash: 20,
        gap: 10
      },
      intervalSignature: 'dash:20-10',
      renderOutputSignature: 'render:dash:20-10'
    })
    const dashChange = computeStrokeDirtyKeys(
      previousDashed,
      buildRevisionSet({
        stroke: {
          ...baseStroke,
          style: 'dashed',
          dash: 6,
          gap: 4
        },
        intervalSignature: 'dash:6-4',
        renderOutputSignature: 'render:dash:6-4'
      })
    )
    expect(dashChange.changedRevisionKeys).toEqual(
      expect.arrayContaining(['dashAndGapRevision', 'renderOutputRevision'])
    )
    expect(dashChange.dirtyKeys).toEqual(
      expect.arrayContaining(['dash-product-intervals', 'render-hit-export'])
    )
    expect(dashChange.changedRevisionKeys).not.toContain('strokeSpecRevision')
    expect(dashChange.changedRevisionKeys).not.toContain('strokeFamilyRevision')
    expect(dashChange.dirtyKeys).not.toContain('path-topology')
    expect(dashChange.dirtyKeys).not.toContain('paint-payload')

    const capChange = computeStrokeDirtyKeys(
      previous,
      buildRevisionSet({
        stroke: {
          ...baseStroke,
          cap: 'round'
        },
        endpointCapPolicySignature: 'cap:round'
      })
    )
    expect(capChange.changedRevisionKeys).toEqual(
      expect.arrayContaining(['terminalCapRevision'])
    )
    expect(capChange.dirtyKeys).toEqual(
      expect.arrayContaining(['endpoint-cap-policy', 'render-hit-export'])
    )
    expect(capChange.dirtyKeys).not.toContain('path-topology')
    expect(capChange.dirtyKeys).not.toContain('paint-payload')

    const positionChange = computeStrokeDirtyKeys(
      previous,
      buildRevisionSet({
        stroke: {
          ...baseStroke,
          position: 'inside'
        },
        strokeDomainSignature: 'domain:inside',
        endpointCapPolicySignature: 'cap:inside',
        joinOwnershipSignature: 'join:inside'
      })
    )
    expect(positionChange.changedRevisionKeys).toEqual(
      expect.arrayContaining([
        'strokeSpecRevision',
        'strokeDomainRevision',
        'terminalCapRevision',
        'joinShapeRevision'
      ])
    )
    expect(positionChange.dirtyKeys).toEqual(
      expect.arrayContaining([
        'stroke-product',
        'stroke-domain',
        'endpoint-cap-policy',
        'join-ownership',
        'render-hit-export'
      ])
    )
    expect(positionChange.dirtyKeys).not.toContain('path-topology')
    expect(positionChange.dirtyKeys).not.toContain('paint-payload')
  })

  it('keeps drag source-path changes separate from static stroke and paint revisions', () => {
    const previous = buildRevisionSet()
    const next = buildRevisionSet({
      points: [
        { x: 0, y: 0 },
        { x: 102, y: 0 },
        { x: 100, y: 100 }
      ],
      sharedGeometrySignature: 'shared:drag'
    })
    const counters: string[] = []
    ;(
      globalThis as typeof globalThis & {
        __asyraStrokePipelineCounterSink?: (counterName: string) => void
      }
    ).__asyraStrokePipelineCounterSink = (counterName) => {
      counters.push(counterName)
    }

    const result = computeStrokeDirtyKeys(previous, next)

    expect(result.changedRevisionKeys).toEqual([
      'sourcePathRevision',
      'sharedGeometryRevision',
      'intervalAllocationRevision'
    ])
    expect(result.dirtyKeys).toEqual([
      'path-topology',
      'shared-geometry',
      'domain-plan',
      'stroke-product',
      'stroke-domain',
      'interval-allocation',
      'dash-product-intervals',
      'endpoint-cap-policy',
      'join-ownership',
      'smooth-continuity',
      'product-materialization',
      'legality',
      'resolved-regions',
      'render-hit-export'
    ])
    expect(result.changedRevisionKeys).not.toContain('strokeSpecRevision')
    expect(result.changedRevisionKeys).not.toContain('strokeFamilyRevision')
    expect(result.changedRevisionKeys).not.toContain('paintRevision')
    expect(counters).toContain(
      'stroke-cache:drag-source-path-with-static-stroke'
    )
  })

  it('keeps vector cache consumer wired to runtime revision sets without owning dirty-key rules', () => {
    const vectorSource = readFileSync(vectorComponentSourcePath, 'utf8')

    expect(vectorSource).toContain(
      "import { buildStrokeRuntimeRevisionSet } from './stroke-render/stroke-dirty-keys'"
    )
    expect(vectorSource).toContain(
      'revisionSet: buildStrokeRuntimeRevisionSet({'
    )
    expect(vectorSource).toContain('stroke-stage-cache:product-geometry-hit')
    expect(vectorSource).toContain('stroke-stage-cache:product-geometry-miss')
    expect(vectorSource).toContain('stroke-stage-cache:product-geometry-store')
    expect(vectorSource).not.toContain('computeStrokeDirtyKeys(')
  })

  it('matches the stroke parameter coverage matrix for this step', () => {
    assertStrokeParameterCoverageForStep('dirty-revision-graph')
  })
})
