import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { assertStrokeParameterCoverageForStep } from './stroke-parameter-coverage-test-helper'
import { applyStrokeProductLegality } from '../../components/stroke-render/stroke-candidate-arrangement'

type RefactorStatus = 'locked' | 'active' | 'verified'

interface InspectorStep {
  id: string
  refactorStatus: RefactorStatus
  implementationFiles: string[]
  allowedInputs: string[]
  requiredOutputs: string[]
  ownerStage: string
  forbiddenContributors: string[]
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
const arrangementSourcePath = resolve(
  repoRoot,
  'packages/preset/src/components/stroke-render/stroke-candidate-arrangement.ts'
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

const productPolygon = [
  { x: 0, y: 0 },
  { x: 20, y: 0 },
  { x: 20, y: 20 },
  { x: 0, y: 20 }
]

const clippedPolygon = [
  { x: 5, y: 5 },
  { x: 20, y: 5 },
  { x: 20, y: 20 },
  { x: 5, y: 20 }
]

const clipPolygon = [
  { x: 5, y: 5 },
  { x: 25, y: 5 },
  { x: 25, y: 25 },
  { x: 5, y: 25 }
]

const expectLegalityOnly = (record: unknown) => {
  const text = JSON.stringify(record)
  for (const forbiddenField of [
    'vertexAngle',
    'resolvedJoin',
    'endpointCap',
    'terminalOverhang',
    'constructionHelper',
    'strokePathStyle',
    'renderer-local-join',
    'strokeMaskPolygons'
  ]) {
    expect(text).not.toContain(forbiddenField)
  }
}

describe('stroke flow step 32: apply-legality', () => {
  it('keeps apply-legality as the current or verified thirty-second step', () => {
    const data = loadInspectorData()
    const step = data.steps.find((entry) => entry.id === 'apply-legality')
    const activeSteps = data.steps.filter(
      (entry) => entry.refactorStatus === 'active'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(step?.refactorStatus).toMatch(/^(active|verified)$/)
    if (step?.refactorStatus === 'active') {
      expect(activeSteps.map((entry) => entry.id)).toEqual(['apply-legality'])
    }
  })

  it('declares the exact legality clipping implementation surface', () => {
    const data = loadInspectorData()
    const step = data.steps.find((entry) => entry.id === 'apply-legality')

    expect(step).toMatchObject({
      ownerStage: 'Stroke Geometry legality clipping',
      allowedInputs: [
        'canonical product packets from the owning split product step',
        'inside fill regions or outside exterior regions',
        'legal-domain ids and contour ids',
        'render descriptor evidence channels'
      ],
      requiredOutputs: [
        'legality-clipped product polygons',
        'clipPolygons, fillClipPolygons, fillExcludePolygons, or legal-domain arrangement evidence',
        'legal-domain diagnostics and owner metadata'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/constrained-solid-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/constrained-dashed-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/stroke-candidate-arrangement.ts'
      ]
    })
    expect(step?.forbiddenContributors).toEqual(
      expect.arrayContaining([
        'new source-vertex join footprint geometry',
        'endpoint cap geometry',
        'descriptor evidence promoted to visible stroke mask'
      ])
    )
  })

  it('applies declared legal clip results without changing product ownership or evidence channels', () => {
    const results = applyStrokeProductLegality({
      productPackets: [
        {
          productId: 'product:inside',
          productMode: 'pre-legality-source-vertex-join',
          ownerStage: 'Stroke Geometry source-vertex join assembly',
          polygons: [productPolygon]
        }
      ],
      legalityRoute: 'inside-fill-clip',
      legalDomainIds: ['legal:inside'],
      contourIds: ['contour:inside'],
      clippedProductPolygons: [clippedPolygon],
      fillClipPolygons: [clipPolygon],
      descriptorEvidencePolygons: [clipPolygon]
    })

    expect(results).toEqual([
      expect.objectContaining({
        productId: 'product:inside:post-legality',
        sourceProductId: 'product:inside',
        productMode: 'post-legality-product',
        ownerStage: 'Stroke Geometry legality clipping',
        sourceOwnerStage: 'Stroke Geometry source-vertex join assembly',
        legalityRoute: 'inside-fill-clip',
        legalDomainIds: ['legal:inside'],
        contourIds: ['contour:inside'],
        visiblePolygons: [clippedPolygon],
        evidenceChannels: {
          fillClipPolygons: [clipPolygon],
          descriptorEvidencePolygons: [clipPolygon]
        },
        channelSeparation: {
          visible: 'legality-clipped-product-polygons',
          evidence: ['fillClipPolygons', 'descriptorEvidencePolygons']
        }
      })
    ])
    expect(results[0]).not.toHaveProperty('strokeMaskPolygons')
    expectLegalityOnly(results)
  })

  it('bypasses center products and reports missing legal domains without substitute output', () => {
    const center = applyStrokeProductLegality({
      productPackets: [
        {
          productId: 'product:center',
          productMode: 'center-product',
          ownerStage: 'Stroke Geometry center product assembly',
          polygons: [productPolygon]
        }
      ],
      legalityRoute: 'center-bypass',
      legalDomainIds: [],
      contourIds: []
    })
    const missing = applyStrokeProductLegality({
      productPackets: [
        {
          productId: 'product:outside',
          productMode: 'pre-legality-dash-interval-body',
          ownerStage: 'Stroke Geometry dashed interval body assembly',
          polygons: [productPolygon]
        }
      ],
      legalityRoute: 'missing-legal-domain',
      legalDomainIds: [],
      contourIds: []
    })

    expect(center[0]).toMatchObject({
      productId: 'product:center:post-legality',
      legalityRoute: 'center-bypass',
      visiblePolygons: [productPolygon],
      diagnostics: []
    })
    expect(missing[0]).toMatchObject({
      productId: 'product:outside:post-legality',
      legalityRoute: 'missing-legal-domain',
      visiblePolygons: [productPolygon],
      diagnostics: [
        {
          severity: 'warning',
          reason: 'missing-legal-domain'
        }
      ]
    })
    expectLegalityOnly([center, missing])
  })

  it('keeps the legality helper free of join resolution, cap construction, renderer join, and visible descriptor-mask promotion', () => {
    const source = readFileSync(arrangementSourcePath, 'utf8')
    const helperStart = source.indexOf(
      'export const applyStrokeProductLegality = ('
    )
    expect(helperStart).toBeGreaterThanOrEqual(0)
    const helperSource = source.slice(helperStart)

    for (const forbiddenToken of [
      'vertexAngle',
      'resolvedJoin',
      'endpointCap',
      'terminalOverhang',
      'constructionHelper',
      'strokePathStyle',
      'strokeMaskPolygons'
    ]) {
      expect(helperSource).not.toContain(forbiddenToken)
    }
  })

  it('keeps constrained dashed legality clipping free of post-clip repair paths', () => {
    const source = readFileSync(constrainedDashedSourcePath, 'utf8')
    const legalityClipStart = source.indexOf(
      'const clipSourcePathPolygonsToEvenOddLegalDomain = ('
    )
    const legalityClipEnd = source.indexOf(
      'const subtractInsideLegalResidue = (',
      legalityClipStart
    )
    const sourceBoundaryClipStart = source.indexOf(
      'const clipSourceSegmentRangePolygonsToAdjacentBoundaries = ('
    )
    const sourceBoundaryClipEnd = source.indexOf(
      'const shouldClipSourceSegmentRangeForInsideBoundary = (',
      sourceBoundaryClipStart
    )

    expect(legalityClipStart).toBeGreaterThanOrEqual(0)
    expect(legalityClipEnd).toBeGreaterThan(legalityClipStart)
    expect(sourceBoundaryClipStart).toBeGreaterThanOrEqual(0)
    expect(sourceBoundaryClipEnd).toBeGreaterThan(sourceBoundaryClipStart)

    const legalityClipSource = source.slice(legalityClipStart, legalityClipEnd)
    const sourceBoundaryClipSource = source.slice(
      sourceBoundaryClipStart,
      sourceBoundaryClipEnd
    )

    for (const forbiddenToken of [
      'restoreSubjectBoundaryPolygons',
      'restoreSubjectBoundaryPaths',
      'restoreSubjectBoundaryMaxEdgeLength',
      'restoreSubjectBoundarySnapTolerance',
      'restoreClippedProductLongBoundaryEdges',
      'stitchClippedProductFragments',
      'fragmentStitchRadius',
      'preserveSourceEdgeWhenBoundaryClipLosesCoverage'
    ]) {
      expect(legalityClipSource).not.toContain(forbiddenToken)
      expect(sourceBoundaryClipSource).not.toContain(forbiddenToken)
    }
  })

  it('matches the stroke parameter coverage matrix for this step', () => {
    assertStrokeParameterCoverageForStep('apply-legality')
  })

})
