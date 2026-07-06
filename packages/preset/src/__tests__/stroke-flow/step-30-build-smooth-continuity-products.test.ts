import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { assertStrokeParameterCoverageForStep } from './stroke-parameter-coverage-test-helper'
import { buildSmoothContinuityProducts } from '../../components/stroke-render/constrained-dashed-stroke-packets'

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

const footprintPolygon = [
  { x: 0, y: 0 },
  { x: 24, y: 2 },
  { x: 24, y: 10 },
  { x: 0, y: 8 }
]

const descriptorPath = [
  { x: 0, y: 4 },
  { x: 12, y: 5 },
  { x: 24, y: 6 }
]

const continuityProof = {
  continuous: true,
  previousTangent: { x: 1, y: 0 },
  nextTangent: { x: 1, y: 0.001 },
  tolerance: 0.01
}

const expectSmoothProductOnly = (record: unknown) => {
  const text = JSON.stringify(record)
  for (const forbiddenField of [
    'source-vertex-join',
    'protected-continuity-zone',
    'visible-construction-helper',
    'helperGeometry',
    'disconnected-strip',
    'comb-like',
    'renderEntries',
    'finalFaces',
    'strokeMaskPolygons',
    'fillClipPolygons'
  ]) {
    expect(text).not.toContain(forbiddenField)
  }
}

describe('stroke flow step 30: build-smooth-continuity-products', () => {
  it('keeps build-smooth-continuity-products as the current or verified thirtieth step', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'build-smooth-continuity-products'
    )
    const activeSteps = data.steps.filter(
      (entry) => entry.refactorStatus === 'active'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(step?.refactorStatus).toMatch(/^(active|verified)$/)
    if (step?.refactorStatus === 'active') {
      expect(activeSteps.map((entry) => entry.id)).toEqual([
        'build-smooth-continuity-products'
      ])
    }
  })

  it('declares the exact smooth-continuity implementation surface', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'build-smooth-continuity-products'
    )

    expect(step).toMatchObject({
      ownerStage: 'Stroke Geometry smooth-continuity product assembly',
      allowedInputs: [
        'smooth-continuity group',
        'curve or smooth span evidence',
        'dash interval coverage when dashed'
      ],
      requiredOutputs: [
        'pre-legality smooth-continuity products or exact smooth-span descriptors'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/constrained-dashed-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/solid-center-stroke-packets.ts'
      ]
    })
    expect(step?.forbiddenContributors).toEqual(
      expect.arrayContaining([
        'source-vertex join product',
        'visible seam-repair product',
        'visible construction/helper product',
        'disconnected strip product'
      ])
    )
  })

  it('builds one continuous pre-legality smooth-continuity product for high-curvature smooth spans', () => {
    const products = buildSmoothContinuityProducts({
      cachePrefix: 'step-30',
      legalSideId: 'legal-side:outside',
      groups: [
        {
          smoothContinuityGroupId: 'smooth:group:1',
          dashIntervalIds: ['interval:1'],
          splitRangeIds: ['split:1'],
          tangentContinuityProof: continuityProof,
          highCurvatureSmooth: true,
          footprintPolygons: [footprintPolygon]
        }
      ]
    })

    expect(products).toHaveLength(1)
    expect(products[0]).toMatchObject({
      productId: 'step-30:smooth:group:1:smooth-product',
      productMode: 'pre-legality-smooth-continuity-product',
      visibleContributor: 'smooth-continuity-dash-body',
      geometryBasis: 'single-continuous-smooth-footprint',
      materializationKind: 'smooth-continuity-product',
      legalSideId: 'legal-side:outside',
      smoothContinuityGroupId: 'smooth:group:1',
      dashIntervalIds: ['interval:1'],
      splitRangeIds: ['split:1'],
      tangentContinuityProof: continuityProof,
      singleContinuousFootprintProof: {
        polygonCount: 1,
        continuous: true
      },
      ownerStage: 'Stroke Geometry smooth-continuity product assembly'
    })
    expect(products[0].polygons).toEqual([footprintPolygon])
    expectSmoothProductOnly(products)
  })

  it('emits exact same-owner smooth-span descriptors without visible helper polygons', () => {
    const products = buildSmoothContinuityProducts({
      cachePrefix: 'step-30-descriptor',
      legalSideId: 'legal-side:outside',
      groups: [
        {
          smoothContinuityGroupId: 'smooth:descriptor',
          dashIntervalIds: ['interval:descriptor'],
          splitRangeIds: ['split:descriptor'],
          tangentContinuityProof: continuityProof,
          descriptorPath,
          descriptorId: 'descriptor:smooth:1'
        }
      ]
    })

    expect(products).toEqual([
      expect.objectContaining({
        productId: 'step-30-descriptor:smooth:descriptor:smooth-descriptor',
        productMode: 'pre-legality-smooth-span-descriptor',
        visibleContributor: 'same-owner-smooth-span-descriptor',
        geometryBasis: 'declared-smooth-span-descriptor',
        descriptorId: 'descriptor:smooth:1',
        descriptorPath,
        polygons: [],
        singleContinuousFootprintProof: {
          polygonCount: 0,
          continuous: true
        }
      })
    ])
    expectSmoothProductOnly(products)
  })

  it('does not emit smooth-continuity fallback output for sharp, discontinuous, empty, or fragmented groups', () => {
    const products = buildSmoothContinuityProducts({
      cachePrefix: 'step-30-filter',
      legalSideId: 'legal-side:outside',
      groups: [
        {
          smoothContinuityGroupId: 'smooth:sharp',
          dashIntervalIds: ['interval:sharp'],
          splitRangeIds: ['split:sharp'],
          tangentContinuityProof: { ...continuityProof, continuous: false },
          footprintPolygons: [footprintPolygon]
        },
        {
          smoothContinuityGroupId: 'smooth:empty',
          dashIntervalIds: ['interval:empty'],
          splitRangeIds: ['split:empty'],
          tangentContinuityProof: continuityProof,
          footprintPolygons: []
        },
        {
          smoothContinuityGroupId: 'smooth:fragmented',
          dashIntervalIds: ['interval:fragmented'],
          splitRangeIds: ['split:fragmented'],
          tangentContinuityProof: continuityProof,
          footprintPolygons: [footprintPolygon, footprintPolygon]
        }
      ]
    })

    expect(products).toEqual([])
  })

  it('keeps the smooth-continuity helper free of source-vertex, protected-zone, helper, strip, and render output ownership', () => {
    const source = readFileSync(constrainedDashedSourcePath, 'utf8')
    const helperSource = extractBetween(
      source,
      'export const buildSmoothContinuityProducts = (',
      'export const getConstrainedDashedVisibleIntervals = ('
    )

    for (const forbiddenToken of [
      'source-vertex-join',
      'protected-continuity-zone',
      'visible-construction-helper',
      'helperGeometry',
      'disconnected-strip',
      'comb-like',
      'renderEntries',
      'finalFaces',
      'strokeMaskPolygons',
      'fillClipPolygons'
    ]) {
      expect(helperSource).not.toContain(forbiddenToken)
    }
  })

  it('keeps runtime smooth-continuity materialization free of post-clip stitch and boundary restoration', () => {
    const source = readFileSync(constrainedDashedSourcePath, 'utf8')
    const runtimeSource = extractBetween(
      source,
      "measureStrokePipelinePhase(\n                'constrained dashed interval: post process'",
      'const joinOwnershipRecords:'
    )

    for (const forbiddenToken of [
      'stitchClippedProductFragments',
      'shouldStitchSmoothProductFragments',
      'stitchedSmoothProductPolygons',
      'preserveSmoothSourceBoundaryEdges',
      'smooth source clip'
    ]) {
      expect(runtimeSource).not.toContain(forbiddenToken)
    }
  })

  it('keeps runtime smooth boundaries on smooth-continuity product ownership', () => {
    const source = readFileSync(constrainedDashedSourcePath, 'utf8')
    const materializeSource = extractBetween(
      source,
      'const materializeSourceVertexBoundaryJoinRecord = (',
      'const getSourceVertexBoundaryJoinPlanMaterializationKey = ('
    )
    const packetAssemblySource = extractBetween(
      source,
      'const materializationKind =\n                    record.materializationKind ??',
      'const shouldPreserveOutsideJoinDescriptor = false'
    )

    expect(materializeSource).toContain('buildSmoothContinuityProducts')
    expect(packetAssemblySource).toContain("'smooth-continuity-product'")
  })

  it('matches the stroke parameter coverage matrix for this step', () => {
    assertStrokeParameterCoverageForStep('build-smooth-continuity-products')
  })

})
