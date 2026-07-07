import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { assertStrokeParameterCoverageForStep } from './stroke-parameter-coverage-test-helper'
import {
  buildTerminalBodyProducts,
  type DashIntervalBodyEndpointCapPolicy
} from '../../components/stroke-render/constrained-dashed-stroke-packets'

type RefactorStatus = 'locked' | 'active' | 'verified'

interface InspectorStep {
  id: string
  refactorStatus: RefactorStatus
  implementationFiles: string[]
  allowedInputs: string[]
  requiredOutputs: string[]
  ownerStage: string
  forbiddenContributors: string[]
  evidenceRequired: string[]
}

interface InspectorRoute {
  id: string
  consumes: string[]
  cacheKeyInputs: string[]
  evidenceRequired: string[]
  specRuleRefs: string[]
  computationContract?: {
    computedAt: string
    consumesArtifacts: string[]
    producesArtifacts: string[]
    consumedBy: string[]
    mustNotRecomputeAfter: string
    forbiddenLateComputation: string[]
  }
}

interface InspectorData {
  steps: InspectorStep[]
  conditionalRoutes: InspectorRoute[]
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
const constrainedDashedSourcePath = resolve(
  repoRoot,
  'packages/preset/src/components/stroke-render/constrained-dashed-stroke-packets.ts'
)

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

const extractBetween = (source: string, start: string, end: string): string => {
  const startIndex = source.indexOf(start)
  const endIndex = source.indexOf(end, startIndex)
  expect(startIndex).toBeGreaterThanOrEqual(0)
  expect(endIndex).toBeGreaterThan(startIndex)
  return source.slice(startIndex, endIndex)
}

const routeById = (data: InspectorData, routeId: string): InspectorRoute => {
  const route = data.conditionalRoutes.find((entry) => entry.id === routeId)
  expect(route, routeId).toBeDefined()
  return route as InspectorRoute
}

const bodyPolygon = [
  { x: 0, y: 0 },
  { x: 16, y: 0 },
  { x: 16, y: 8 },
  { x: 0, y: 8 }
]

const startTerminalPolicy: DashIntervalBodyEndpointCapPolicy = {
  terminalRole: 'start',
  suppressStartCap: true,
  suppressEndCap: false,
  startCap: false,
  endCap: true,
  signature: 'start:start-flat:end-cap'
}

const startEndTerminalPolicy: DashIntervalBodyEndpointCapPolicy = {
  terminalRole: 'start-end',
  suppressStartCap: true,
  suppressEndCap: true,
  startCap: false,
  endCap: false,
  signature: 'start-end:start-flat:end-flat'
}

const middlePolicy: DashIntervalBodyEndpointCapPolicy = {
  terminalRole: 'middle',
  suppressStartCap: false,
  suppressEndCap: false,
  startCap: true,
  endCap: true,
  signature: 'middle:start-cap:end-cap'
}

const expectTerminalBodyOnly = (record: unknown) => {
  const text = JSON.stringify(record)
  for (const forbiddenField of [
    'endpoint-side-cap',
    'terminalOverhang',
    'sourceVertexApex',
    'source-vertex-join',
    'join-owned-terminal-body',
    'repair',
    'renderEntries',
    'finalFaces',
    'strokeMaskPolygons',
    'fillClipPolygons'
  ]) {
    expect(text).not.toContain(forbiddenField)
  }
}

describe('stroke flow step 29: build-terminal-body-products', () => {
  it('keeps build-terminal-body-products as the current or verified twenty-ninth step', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'build-terminal-body-products'
    )
    const activeSteps = data.steps.filter(
      (entry) => entry.refactorStatus === 'active'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(step?.refactorStatus).toMatch(/^(active|verified)$/)
    if (step?.refactorStatus === 'active') {
      expect(activeSteps.map((entry) => entry.id)).toEqual([
        'build-terminal-body-products'
      ])
    }
  })

  it('declares the exact terminal body implementation surface', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'build-terminal-body-products'
    )

    expect(step).toMatchObject({
      ownerStage: 'Stroke Geometry terminal body assembly',
      allowedInputs: [
        'terminal DashProductInterval',
        'Step 27 verified terminal dash body seam boundary',
        'terminal role',
        'endpoint cap policy',
        'legal side'
      ],
      requiredOutputs: [
        'pre-legality terminal body products with seam boundary provenance'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/constrained-dashed-stroke-packets.ts'
      ]
    })
    expect(step?.forbiddenContributors).toEqual(
      expect.arrayContaining([
        'endpoint-side cap at join-owned terminal',
        'terminal overhang',
        'source-vertex apex coverage'
      ])
    )
    expect(step?.evidenceRequired).toEqual(
      expect.arrayContaining([
        'dash body seam boundary artifact id',
        'seam boundary id',
        'join ownership signature'
      ])
    )
  })

  it('declares terminal bodies as seam-boundary consumers, not seam repair owners', () => {
    const data = loadInspectorData()
    const route = routeById(
      data,
      'constrained-dashed-join-owned-terminal-body-product'
    )

    expect(route.consumes).toEqual(
      expect.arrayContaining([
        'artifact:dash-product-interval',
        'artifact:dash-body-seam-boundary'
      ])
    )
    expect(route.cacheKeyInputs).toContain('dash body seam boundary signature')
    expect(route.computationContract).toMatchObject({
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
    expect(route.computationContract?.forbiddenLateComputation).toEqual(
      expect.arrayContaining([
        'source-vertex corner coverage',
        'dash/join seam closure',
        'endpoint-side cap restoration',
        'terminal seam boundary relocation'
      ])
    )
    expect(route.specRuleRefs).toContain(
      'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#computation-ownership-and-timing-contract'
    )
  })

  it('builds pre-legality terminal body products from terminal intervals', () => {
    const products = buildTerminalBodyProducts({
      productFamilyId: 'constrained-dashed',
      cachePrefix: 'step-29',
      legalSideId: 'legal-side:outside',
      intervals: [
        {
          intervalId: 'interval:start',
          kind: 'visible',
          splitRangeId: 'split:start',
          seamBoundaryId: 'seam:start',
          terminalRole: 'start',
          endpointCapPolicy: startTerminalPolicy,
          joinOwnershipSignature: 'source-vertex:join-owned',
          bodyPolygons: [bodyPolygon]
        }
      ]
    })

    expect(products).toHaveLength(1)
    expect(products[0]).toMatchObject({
      productId: 'step-29:interval:start:terminal-body',
      productFamilyId: 'constrained-dashed',
      productMode: 'pre-legality-terminal-body',
      visibleContributor: 'terminal-interval-body',
      geometryBasis: 'terminal-dash-interval-body',
      materializationKind: 'terminal-body',
      legalSideId: 'legal-side:outside',
      intervalId: 'interval:start',
      splitRangeId: 'split:start',
      seamBoundaryId: 'seam:start',
      terminalRole: 'start',
      endpointCapPolicy: startTerminalPolicy,
      joinOwnershipSignature: 'source-vertex:join-owned',
      capContributors: [
        {
          side: 'end',
          contribution: 'body-side-cap',
          policySignature: startTerminalPolicy.signature
        }
      ],
      ownerStage: 'Stroke Geometry terminal body assembly',
      evidence: {
        terminalRole: 'start',
        endpointCapPolicySignature: startTerminalPolicy.signature,
        seamBoundaryId: 'seam:start',
        joinOwnershipSignature: 'source-vertex:join-owned'
      }
    })
    expect(products[0].bounds).toEqual({
      minX: 0,
      minY: 0,
      maxX: 16,
      maxY: 8
    })
    expectTerminalBodyOnly(products)
  })

  it('suppresses both endpoint-side caps for start-end join-owned terminal bodies', () => {
    const products = buildTerminalBodyProducts({
      productFamilyId: 'constrained-dashed',
      cachePrefix: 'step-29-start-end',
      legalSideId: 'legal-side:outside',
      intervals: [
        {
          intervalId: 'interval:start-end',
          kind: 'visible',
          splitRangeId: 'split:start-end',
          seamBoundaryId: 'seam:start-end',
          terminalRole: 'start-end',
          endpointCapPolicy: startEndTerminalPolicy,
          joinOwnershipSignature: 'source-vertex:join-owned',
          bodyPolygons: [bodyPolygon]
        }
      ]
    })

    expect(products).toHaveLength(1)
    expect(products[0]).toMatchObject({
      terminalRole: 'start-end',
      capContributors: []
    })
    expectTerminalBodyOnly(products)
  })

  it('does not emit terminal body fallback output for middle, gap, empty, or duplicate intervals', () => {
    const products = buildTerminalBodyProducts({
      productFamilyId: 'constrained-dashed',
      cachePrefix: 'step-29-filter',
      legalSideId: 'legal-side:outside',
      intervals: [
        {
          intervalId: 'interval:middle',
          kind: 'visible',
          splitRangeId: 'split:middle',
          seamBoundaryId: 'seam:middle',
          terminalRole: 'middle',
          endpointCapPolicy: middlePolicy,
          joinOwnershipSignature: 'none',
          bodyPolygons: [bodyPolygon]
        },
        {
          intervalId: 'interval:gap',
          kind: 'gap',
          splitRangeId: 'split:gap',
          seamBoundaryId: 'seam:gap',
          terminalRole: 'start',
          endpointCapPolicy: startTerminalPolicy,
          joinOwnershipSignature: 'source-vertex:join-owned',
          bodyPolygons: [bodyPolygon]
        },
        {
          intervalId: 'interval:empty',
          kind: 'visible',
          splitRangeId: 'split:empty',
          seamBoundaryId: 'seam:empty',
          terminalRole: 'start',
          endpointCapPolicy: startTerminalPolicy,
          joinOwnershipSignature: 'source-vertex:join-owned',
          bodyPolygons: []
        },
        {
          intervalId: 'interval:duplicate',
          kind: 'visible',
          splitRangeId: 'split:duplicate-a',
          seamBoundaryId: 'seam:duplicate-a',
          terminalRole: 'end',
          endpointCapPolicy: startTerminalPolicy,
          joinOwnershipSignature: 'source-vertex:join-owned',
          bodyPolygons: [bodyPolygon]
        },
        {
          intervalId: 'interval:duplicate',
          kind: 'visible',
          splitRangeId: 'split:duplicate-b',
          seamBoundaryId: 'seam:duplicate-b',
          terminalRole: 'end',
          endpointCapPolicy: startTerminalPolicy,
          joinOwnershipSignature: 'source-vertex:join-owned',
          bodyPolygons: [bodyPolygon]
        }
      ]
    })

    expect(products.map((product) => product.intervalId)).toEqual([
      'interval:duplicate'
    ])
    expectTerminalBodyOnly(products)
  })

  it('keeps the terminal body helper free of source-vertex, overhang, and render output ownership', () => {
    const source = readFileSync(constrainedDashedSourcePath, 'utf8')
    const helperSource = extractBetween(
      source,
      'export const buildTerminalBodyProducts = (',
      'export const getConstrainedDashedVisibleIntervals = ('
    )

    for (const forbiddenToken of [
      'endpoint-side-cap',
      'terminalOverhang',
      'sourceVertexApex',
      'source-vertex-join',
      'renderEntries',
      'finalFaces',
      'strokeMaskPolygons',
      'fillClipPolygons'
    ]) {
      expect(helperSource).not.toContain(forbiddenToken)
    }
  })

  it('keeps runtime terminal body packet metadata in terminal-body ownership', () => {
    const source = readFileSync(constrainedDashedSourcePath, 'utf8')
    const runtimeMetadataSource = extractBetween(
      source,
      "const debugMeta: SolidCenterStrokeGeometryDebugMeta =\n          measureStrokePipelinePhase(\n            'constrained dashed terminal body: packet metadata'",
      '        return [\n          {'
    )

    expect(runtimeMetadataSource).toContain(
      "visibleContributor: 'terminal-interval-body'"
    )
    expect(runtimeMetadataSource).toContain(
      "geometryBasis: 'terminal-dash-interval-body'"
    )
  })

  it('lets source-vertex incident terminal bodies keep Step 27 seam provenance', () => {
    const source = readFileSync(constrainedDashedSourcePath, 'utf8')
    const runtimeAssemblySource = extractBetween(
      source,
      'const joinOwnedTerminalBodyPackets = measureStrokePipelinePhase(',
      'const joinOwnedTerminalBodyProductPolygons ='
    )
    const runtimeMetadataSource = extractBetween(
      source,
      "const debugMeta: SolidCenterStrokeGeometryDebugMeta =\n          measureStrokePipelinePhase(\n            'constrained dashed terminal body: packet metadata'",
      '        return [\n          {'
    )

    expect(runtimeAssemblySource).not.toMatch(
      /if \(record\.kind === 'source-vertex'\) {\s+return \[\]\s+}/
    )
    expect(runtimeAssemblySource).not.toContain(
      "record.kind !== 'source-vertex'"
    )
    expect(runtimeAssemblySource).toContain('buildJoinOwnedTerminalBodyPacket(')
    expect(runtimeAssemblySource).toContain('record,')
    expect(runtimeMetadataSource).toContain(
      "terminalJoinRecord?.kind === 'source-vertex'"
    )
    expect(source).toContain('terminalJoinRecord.previousSeamBoundary')
    expect(source).toContain('terminalJoinRecord.nextSeamBoundary')
    expect(runtimeMetadataSource).toContain('dashBodySeamBoundaries')
  })

  it('does not drop terminal body products by positive-area sliver thresholds', () => {
    const source = readFileSync(constrainedDashedSourcePath, 'utf8')

    for (const forbiddenToken of [
      'getMinimumTerminalBodyProductArea',
      'terminal-body-positive-area-sliver',
      'terminal-body-cache-positive-area-sliver',
      'terminal-body-final-positive-area-sliver'
    ]) {
      expect(source).not.toContain(forbiddenToken)
    }
  })

  it('matches the stroke parameter coverage matrix for this step', () => {
    assertStrokeParameterCoverageForStep('build-terminal-body-products')
  })
})
