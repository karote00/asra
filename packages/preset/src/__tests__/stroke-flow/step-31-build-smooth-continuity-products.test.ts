import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { assertStrokeParameterCoverageForStep } from './stroke-parameter-coverage-test-helper'
import {
  appendSmoothContinuityBodyProgramOwnershipEvidence,
  buildSmoothContinuityOwnershipOverlaysFromBodyPrograms,
  buildSmoothContinuityProducts
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

const curveOffsetOuterBoundaryProof = {
  evidenceId: 'curve-offset-proof:step-31',
  basis: 'authored-source-curve-offset-at-stroke-width' as const,
  strokeWidth: 12,
  verified: true as const
}

const bodyProductReferences = [
  {
    bodyProductId: 'step-31:interval:1:body-program',
    intervalId: 'interval:1',
    splitRangeId: 'split:1',
    ownerStepId: 'build-dash-interval-body-products' as const
  }
]

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

const expectSmoothOwnershipOverlayOnly = (record: unknown) => {
  const text = JSON.stringify(record)
  for (const forbiddenField of [
    'polygons',
    'strokePaths',
    'paint',
    'descriptorPath',
    'descriptorId',
    'source-vertex-join',
    'visible-construction-helper',
    'disconnected-strip',
    'radial-slice',
    'renderEntries',
    'finalFaces'
  ]) {
    expect(text).not.toContain(forbiddenField)
  }
}

describe('stroke flow step 31: build-smooth-continuity-products', () => {
  it('keeps build-smooth-continuity-products as the thirty-first runtime step', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'build-smooth-continuity-products'
    )
    const activeSteps = data.steps.filter(
      (entry) => entry.refactorStatus === 'active'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(step?.refactorStatus).toMatch(/^(locked|active|verified)$/)
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
      ownerStage:
        'Stroke Geometry smooth-continuity product and ownership binding',
      allowedInputs: [
        'selected constrained dashed or constrained solid product family',
        'smooth-continuity group',
        'curve or smooth span evidence',
        'referenced dash interval body product ids',
        'ConstrainedDashedProductEvidenceEnvelope initialized by build-dash-interval-body-products'
      ],
      requiredOutputs: [
        'non-visible constrained dashed smooth-continuity ownership overlays referencing dash body products',
        'ConstrainedDashedProductEvidenceEnvelope with smooth ownership overlays appended by overlayId',
        'constrained solid same-owner smooth-span products or exact descriptors'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/constrained-dashed-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/solid-center-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/stroke-product-evidence.ts'
      ]
    })
    expect(step?.forbiddenContributors).toEqual(
      expect.arrayContaining([
        'source-vertex join product',
        'duplicate constrained dashed body polygons or stroke paths',
        'constrained dashed paint payload',
        'visible seam-repair product',
        'visible construction/helper product',
        'disconnected strip product'
      ])
    )
  })

  it('builds a non-visible constrained-dashed ownership overlay over the Step 27 body product', () => {
    const products = buildSmoothContinuityProducts({
      productFamilyId: 'constrained-dashed',
      cachePrefix: 'step-31',
      groups: [
        {
          smoothContinuityGroupId: 'smooth:group:1',
          dashIntervalIds: ['interval:1'],
          splitRangeIds: ['split:1'],
          referencedBodyProducts: bodyProductReferences,
          tangentContinuityProof: continuityProof,
          curveOffsetOuterBoundaryProof,
          highCurvatureSmooth: true
        }
      ]
    })

    expect(products).toEqual([
      {
        overlayId: 'step-31:smooth:group:1:smooth-ownership',
        productFamilyId: 'constrained-dashed',
        recordKind: 'smooth-continuity-ownership-overlay',
        channel: 'evidence',
        visibleContributor: 'none-non-visible-ownership-overlay',
        geometryBasis: 'smooth-continuity-ownership-overlay',
        smoothContinuityGroupId: 'smooth:group:1',
        bodyProductIds: ['step-31:interval:1:body-program'],
        dashIntervalIds: ['interval:1'],
        splitRangeIds: ['split:1'],
        tangentContinuityProof: continuityProof,
        curveOffsetOuterBoundaryProof,
        singleContinuousFootprintProof: {
          referencedBodyProductCount: 1,
          continuous: true
        },
        noSourceVertexJoinOwnershipProof: {
          basis: 'tangent-continuous-source-span',
          verified: true
        },
        ownerStepId: 'build-smooth-continuity-products',
        ownerStage: 'Stroke Geometry smooth-continuity ownership binding',
        evidence: {
          bodyProductOwnerStepId: 'build-dash-interval-body-products',
          highCurvatureDoesNotCreateJoinOwnership: true,
          zeroVisibleContribution: true
        }
      }
    ])
    expectSmoothOwnershipOverlayOnly(products)
  })

  it('appends compact smooth evidence immutably to every referenced body envelope', () => {
    const [overlay] = buildSmoothContinuityProducts({
      productFamilyId: 'constrained-dashed',
      cachePrefix: 'step-31-append',
      groups: [
        {
          smoothContinuityGroupId: 'smooth:append',
          dashIntervalIds: ['interval:1'],
          splitRangeIds: ['split:1'],
          referencedBodyProducts: bodyProductReferences,
          tangentContinuityProof: continuityProof,
          curveOffsetOuterBoundaryProof
        }
      ]
    })
    const initialProgram = {
      bodyProductId: 'step-31:interval:1:body-program',
      intervalId: 'interval:1',
      productEvidenceEnvelope: {
        bodyProductIds: ['step-31:interval:1:body-program'],
        terminalOwnershipOverlays: [],
        smoothContinuityOwnershipOverlays: []
      }
    }
    const initialPrograms = new Map([
      ['interval:1', initialProgram]
    ])

    expect(appendSmoothContinuityBodyProgramOwnershipEvidence).toBeTypeOf(
      'function'
    )
    const updatedPrograms =
      appendSmoothContinuityBodyProgramOwnershipEvidence({
        programsByIntervalId: initialPrograms as never,
        overlays: [overlay] as never
      })
    const updatedProgram = updatedPrograms.get('interval:1')

    expect(initialProgram.productEvidenceEnvelope).toMatchObject({
      smoothContinuityOwnershipOverlays: []
    })
    expect(updatedProgram).not.toBe(initialProgram)
    expect(updatedProgram?.productEvidenceEnvelope).toMatchObject({
      bodyProductIds: ['step-31:interval:1:body-program'],
      terminalOwnershipOverlays: [],
      smoothContinuityOwnershipOverlays: [
        {
          overlayId: 'step-31-append:smooth:append:smooth-ownership',
          bodyProductIds: ['step-31:interval:1:body-program'],
          intervalIds: ['interval:1'],
          splitRangeIds: ['split:1'],
          smoothContinuityGroupId: 'smooth:append',
          tangentContinuityProof: continuityProof,
          curveOffsetOuterBoundaryProof,
          singleContinuousFootprintProof: true,
          noSourceVertexJoinOwnershipProof: true,
          ownerStepId: 'build-smooth-continuity-products',
          zeroVisibleContribution: true
        }
      ]
    })
    const compactOverlay = updatedProgram?.productEvidenceEnvelope
      .smoothContinuityOwnershipOverlays[0] as unknown as Record<
      string,
      unknown
    >
    for (const forbiddenField of [
      'evidence',
      'ownerStage',
      'referencedBodyProducts',
      'polygons',
      'strokePaths',
      'paint'
    ]) {
      expect(compactOverlay).not.toHaveProperty(forbiddenField)
    }

    const appendedTwice =
      appendSmoothContinuityBodyProgramOwnershipEvidence({
        programsByIntervalId: updatedPrograms,
        overlays: [overlay] as never
      })
    expect(
      appendedTwice.get('interval:1')?.productEvidenceEnvelope
        .smoothContinuityOwnershipOverlays
    ).toHaveLength(1)
  })

  it('derives runtime smooth ownership from Step 27 curve evidence and rejects sharp-owned intervals', () => {
    const createProgram = (
      intervalId: string,
      sourceSegmentIndex: number,
      startTangent: { x: number; y: number },
      endTangent: { x: number; y: number }
    ) => ({
      bodyProductId: `body:${intervalId}`,
      intervalId,
      authoredStrokeWidth: 12,
      interval: {
        domainPlanSplitRangeId: `split:${intervalId}`
      },
      rawCurveEvidence: {
        coveredSourceSegments: [
          {
            sourceSegmentIndex,
            segmentType: 'cubic',
            startTangent,
            endTangent
          }
        ]
      },
      productEvidenceEnvelope: {
        bodyProductIds: [`body:${intervalId}`],
        terminalOwnershipOverlays: [],
        smoothContinuityOwnershipOverlays: []
      }
    })
    const programs = new Map([
      [
        'interval:previous',
        createProgram(
          'interval:previous',
          0,
          { x: 1, y: 0 },
          { x: 1, y: 0 }
        )
      ],
      [
        'interval:next',
        createProgram(
          'interval:next',
          1,
          { x: 1, y: 0.001 },
          { x: 1, y: 0.001 }
        )
      ]
    ])
    const smoothPlan = {
      kind: 'source-vertex',
      vertexIndex: 1,
      previousSegmentIndex: 0,
      nextSegmentIndex: 1,
      intervals: [
        { intervalId: 'interval:previous' },
        { intervalId: 'interval:next' }
      ]
    }

    const overlays = buildSmoothContinuityOwnershipOverlaysFromBodyPrograms({
      cachePrefix: 'runtime-step-31',
      programsByIntervalId: programs as never,
      smoothPlans: [smoothPlan] as never,
      sharpJoinPlans: []
    })

    expect(overlays).toEqual([
      expect.objectContaining({
        productFamilyId: 'constrained-dashed',
        recordKind: 'smooth-continuity-ownership-overlay',
        visibleContributor: 'none-non-visible-ownership-overlay',
        bodyProductIds: [
          'body:interval:previous',
          'body:interval:next'
        ],
        dashIntervalIds: ['interval:previous', 'interval:next'],
        splitRangeIds: [
          'split:interval:previous',
          'split:interval:next'
        ],
        tangentContinuityProof: expect.objectContaining({
          continuous: true,
          previousTangent: { x: 1, y: 0 },
          nextTangent: expect.objectContaining({ x: expect.any(Number) })
        }),
        curveOffsetOuterBoundaryProof: expect.objectContaining({
          strokeWidth: 12,
          verified: true
        })
      })
    ])
    expectSmoothOwnershipOverlayOnly(overlays)

    expect(
      buildSmoothContinuityOwnershipOverlaysFromBodyPrograms({
        cachePrefix: 'runtime-step-31',
        programsByIntervalId: programs as never,
        smoothPlans: [smoothPlan] as never,
        sharpJoinPlans: [
          {
            intervals: [{ intervalId: 'interval:next' }]
          }
        ] as never
      })
    ).toEqual([])
  })

  it('keeps the constrained-solid same-owner smooth span as one continuous product', () => {
    const products = buildSmoothContinuityProducts({
      productFamilyId: 'constrained-solid',
      cachePrefix: 'step-31',
      legalSideId: 'legal-side:outside',
      groups: [
        {
          smoothContinuityGroupId: 'smooth:group:1',
          dashIntervalIds: ['interval:1'],
          splitRangeIds: ['split:1'],
          tangentContinuityProof: continuityProof,
          curveOffsetOuterBoundaryProof,
          highCurvatureSmooth: true,
          footprintPolygons: [footprintPolygon]
        }
      ]
    })

    expect(products).toHaveLength(1)
    expect(products[0]).toMatchObject({
      productId: 'step-31:smooth:group:1:smooth-product',
      productMode: 'pre-legality-smooth-continuity-product',
      visibleContributor: 'smooth-continuity-dash-body',
      geometryBasis: 'single-continuous-smooth-footprint',
      materializationKind: 'smooth-continuity-product',
      legalSideId: 'legal-side:outside',
      smoothContinuityGroupId: 'smooth:group:1',
      dashIntervalIds: ['interval:1'],
      splitRangeIds: ['split:1'],
      tangentContinuityProof: continuityProof,
      curveOffsetOuterBoundaryProof,
      singleContinuousFootprintProof: {
        polygonCount: 1,
        continuous: true
      },
      ownerStepId: 'build-smooth-continuity-products',
      ownerStage: 'Stroke Geometry smooth-continuity product assembly'
    })
    expect(products[0].polygons).toEqual([footprintPolygon])
    expectSmoothProductOnly(products)
  })

  it('emits exact same-owner smooth-span descriptors without visible helper polygons', () => {
    const products = buildSmoothContinuityProducts({
      productFamilyId: 'constrained-solid',
      cachePrefix: 'step-31-descriptor',
      legalSideId: 'legal-side:outside',
      groups: [
        {
          smoothContinuityGroupId: 'smooth:descriptor',
          dashIntervalIds: ['interval:descriptor'],
          splitRangeIds: ['split:descriptor'],
          tangentContinuityProof: continuityProof,
          curveOffsetOuterBoundaryProof,
          descriptorPath,
          descriptorId: 'descriptor:smooth:1'
        }
      ]
    })

    expect(products).toEqual([
      expect.objectContaining({
        productId: 'step-31-descriptor:smooth:descriptor:smooth-descriptor',
        productMode: 'pre-legality-smooth-span-descriptor',
        visibleContributor: 'same-owner-smooth-span-descriptor',
        geometryBasis: 'declared-smooth-span-descriptor',
        descriptorId: 'descriptor:smooth:1',
        descriptorPath,
        curveOffsetOuterBoundaryProof,
        ownerStepId: 'build-smooth-continuity-products',
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
      productFamilyId: 'constrained-solid',
      cachePrefix: 'step-31-filter',
      legalSideId: 'legal-side:outside',
      groups: [
        {
          smoothContinuityGroupId: 'smooth:sharp',
          dashIntervalIds: ['interval:sharp'],
          splitRangeIds: ['split:sharp'],
          tangentContinuityProof: { ...continuityProof, continuous: false },
          curveOffsetOuterBoundaryProof,
          footprintPolygons: [footprintPolygon]
        },
        {
          smoothContinuityGroupId: 'smooth:empty',
          dashIntervalIds: ['interval:empty'],
          splitRangeIds: ['split:empty'],
          tangentContinuityProof: continuityProof,
          curveOffsetOuterBoundaryProof,
          footprintPolygons: []
        },
        {
          smoothContinuityGroupId: 'smooth:fragmented',
          dashIntervalIds: ['interval:fragmented'],
          splitRangeIds: ['split:fragmented'],
          tangentContinuityProof: continuityProof,
          curveOffsetOuterBoundaryProof,
          footprintPolygons: [footprintPolygon, footprintPolygon]
        },
        {
          smoothContinuityGroupId: 'smooth:unverified-offset',
          dashIntervalIds: ['interval:unverified-offset'],
          splitRangeIds: ['split:unverified-offset'],
          tangentContinuityProof: continuityProof,
          footprintPolygons: [footprintPolygon]
        }
      ]
    })

    expect(products).toEqual([])
  })

  it('rejects constrained-dashed overlays without verified proof or Step 27 body references', () => {
    expect(
      buildSmoothContinuityProducts({
        productFamilyId: 'constrained-dashed',
        cachePrefix: 'step-31-invalid',
        groups: [
          {
            smoothContinuityGroupId: 'smooth:discontinuous',
            dashIntervalIds: ['interval:1'],
            splitRangeIds: ['split:1'],
            referencedBodyProducts: bodyProductReferences,
            tangentContinuityProof: {
              ...continuityProof,
              continuous: false
            },
            curveOffsetOuterBoundaryProof
          },
          {
            smoothContinuityGroupId: 'smooth:no-body',
            dashIntervalIds: ['interval:2'],
            splitRangeIds: ['split:2'],
            referencedBodyProducts: [],
            tangentContinuityProof: continuityProof,
            curveOffsetOuterBoundaryProof
          },
          {
            smoothContinuityGroupId: 'smooth:wrong-owner',
            dashIntervalIds: ['interval:3'],
            splitRangeIds: ['split:3'],
            referencedBodyProducts: [
              {
                bodyProductId: 'step-30:terminal-copy',
                intervalId: 'interval:3',
                splitRangeId: 'split:3',
                ownerStepId: 'build-terminal-body-products' as const
              }
            ],
            tangentContinuityProof: continuityProof,
            curveOffsetOuterBoundaryProof
          }
        ]
      })
    ).toEqual([])
  })

  it('keeps the constrained-dashed overlay builder free of visible product ownership', () => {
    const source = readFileSync(constrainedDashedSourcePath, 'utf8')
    const helperSource = extractBetween(
      source,
      'export const buildConstrainedDashedSmoothContinuityOwnershipOverlays = (',
      'const buildConstrainedSolidSmoothContinuityProducts = ('
    )

    for (const forbiddenToken of [
      'source-vertex-join',
      'visible-construction-helper',
      'helperGeometry',
      'disconnected-strip',
      'radial-slice',
      'comb-like',
      'polygons',
      'strokePaths',
      'paint',
      'descriptor',
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

  it('keeps runtime smooth identity on Step 27 body products without a second visible product', () => {
    const source = readFileSync(constrainedDashedSourcePath, 'utf8')
    const materializeSource = extractBetween(
      source,
      'const materializeSourceVertexBoundaryJoinRecord = (',
      'const getSourceVertexBoundaryJoinPlanMaterializationKey = ('
    )
    const runtimeOverlaySource = extractBetween(
      source,
      'const smoothContinuityOwnershipOverlays =',
      'const baseJoinDiagnostics = {'
    )
    const bodyIdentitySource = extractBetween(
      source,
      'const materializedIntervalPackets =',
      'const packetAssembly ='
    )

    expect(materializeSource).not.toContain('buildSmoothContinuityProducts')
    expect(runtimeOverlaySource).toContain(
      'buildSmoothContinuityOwnershipOverlaysFromBodyPrograms('
    )
    expect(runtimeOverlaySource).toContain(
      'const dashBodyGeometryProgramsWithSmoothContinuityByIntervalId ='
    )
    expect(runtimeOverlaySource).toContain(
      'appendSmoothContinuityBodyProgramOwnershipEvidence('
    )
    expect(bodyIdentitySource).toContain(
      "visibleContributor: 'dash-interval-body'"
    )
    expect(bodyIdentitySource).not.toContain(
      "'Stroke Geometry smooth-continuity product assembly'"
    )
  })

  it('matches the stroke parameter coverage matrix for this step', () => {
    assertStrokeParameterCoverageForStep('build-smooth-continuity-products')
  })
})
