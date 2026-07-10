import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { assertStrokeParameterCoverageForStep } from './stroke-parameter-coverage-test-helper'
import * as constrainedDashedStrokePackets from '../../components/stroke-render/constrained-dashed-stroke-packets'
import {
  materializeStrokeProductDescriptors,
  type StrokeDescriptorStrategyRecord
} from '../../components/stroke-render/stroke-render-descriptor'
import { mergeConstrainedDashedProductEvidenceEnvelopes } from '../../components/stroke-render/stroke-product-evidence'

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
  stepResponsibilityMatrix: Record<
    string,
    {
      classification: string
      ownerMode: string
      primaryArtifacts: string[]
      allowedActions: string[]
      forbiddenActions: string[]
    }
  >
  crossStepArtifactLifecycleMatrix: Record<
    string,
    {
      artifactClassId: string
      computedAt: string
      preserveThrough: string[]
      consumedBy: string[]
      mustNotRecomputeAfter: string
      mayDropOnlyWhen: string[]
      dropEvidenceRequired: string[]
      downstreamAuthority: boolean
    }
  >
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
const dashedPacketsSourcePath = resolve(
  repoRoot,
  'packages/preset/src/components/stroke-render/constrained-dashed-stroke-packets.ts'
)

const extractBetween = (source: string, start: string, end: string): string => {
  const startIndex = source.indexOf(start)
  const endIndex = source.indexOf(end, startIndex)
  expect(startIndex).toBeGreaterThanOrEqual(0)
  expect(endIndex).toBeGreaterThan(startIndex)
  return source.slice(startIndex, endIndex)
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

const collectDescriptorPolygonEvidence = <T>(run: () => T) => {
  const phases: string[] = []
  const counters = new Map<string, number>()
  const globalRecord = globalThis as typeof globalThis & {
    __asyraVectorRenderDetailPhaseSink?: (
      phaseName: string,
      durationMs: number
    ) => void
    __asyraStrokePipelineCounterSink?: (
      counterName: string,
      value: number
    ) => void
  }
  const previousPhaseSink = globalRecord.__asyraVectorRenderDetailPhaseSink
  const previousCounterSink = globalRecord.__asyraStrokePipelineCounterSink
  globalRecord.__asyraVectorRenderDetailPhaseSink = (phaseName) => {
    phases.push(phaseName)
  }
  globalRecord.__asyraStrokePipelineCounterSink = (counterName, value = 1) => {
    counters.set(counterName, (counters.get(counterName) ?? 0) + value)
  }
  try {
    return { counters, phases, result: run() }
  } finally {
    globalRecord.__asyraVectorRenderDetailPhaseSink = previousPhaseSink
    globalRecord.__asyraStrokePipelineCounterSink = previousCounterSink
  }
}

const strokePathGroups = [
  {
    strokePaths: [[{ x: 0, y: 0 }]],
    strokePathStyle: {
      width: 12,
      cap: 'butt' as const,
      join: 'miter' as const,
      miterLimit: 4
    }
  }
]
const descriptorProductPolygons = [
  [
    { x: 100, y: 100 },
    { x: 120, y: 100 },
    { x: 120, y: 120 }
  ]
]

const eligibleStrategy: StrokeDescriptorStrategyRecord = {
  strategyId: 'strategy:descriptor',
  ownerStepId: 'select-stroke-descriptor-strategy',
  ownerStage: 'Stroke Geometry descriptor strategy selection',
  status: 'descriptor-eligible',
  descriptorRouteKind: 'same-owner-smooth-span',
  requiredLegalityBasis: 'legality-equivalent-pre-product',
  outputChannelIntent: 'render-and-hit-export',
  productBuilderId: 'build-smooth-continuity-products',
  materializationStage: 'after-apply-legality',
  consumesPostLegalityArtifact: false,
  ownerBoundarySplitProof: {
    ownerBoundaryId: 'owner-boundary:descriptor',
    splitProofId: 'split-proof:descriptor',
    complete: true
  },
  legalityEquivalenceEvidence: {
    basisId: 'basis:descriptor',
    complete: true
  }
}

describe('stroke flow step 37: materialize-stroke-product-descriptors', () => {
  it('keeps materialize-stroke-product-descriptors as the thirty-seventh runtime step', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'materialize-stroke-product-descriptors'
    )
    const activeSteps = data.steps.filter(
      (entry) => entry.refactorStatus === 'active'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(step?.refactorStatus).toMatch(/^(locked|active|verified)$/)
    if (step?.refactorStatus === 'active') {
      expect(activeSteps.map((entry) => entry.id)).toEqual([
        'materialize-stroke-product-descriptors'
      ])
    }
  })

  it('declares the exact descriptor materialization implementation surface', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'materialize-stroke-product-descriptors'
    )

    expect(step).toMatchObject({
      ownerStage: 'Product Output descriptor materialization',
      allowedInputs: [
        'finalFaces',
        'post-legality product units or legality-equivalent product units',
        'descriptor strategy records',
        'final-face ConstrainedDashedProductEvidenceEnvelope',
        'output channel separation',
        'resolved-packet full cache-key alias from build-resolved-stroke-regions'
      ],
      requiredOutputs: [
        'renderer-ready product descriptors with channel and owner metadata',
        'descriptor product identity preserving every body and ownership overlay id'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/constrained-dashed-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/stroke-render-descriptor.ts',
        'packages/preset/src/components/stroke-render/stroke-product-evidence.ts'
      ]
    })
  })

  it('classifies descriptor materialization as channel projection over final products', () => {
    const data = loadInspectorData()
    const responsibility =
      data.stepResponsibilityMatrix['materialize-stroke-product-descriptors']
    const lifecycle =
      data.crossStepArtifactLifecycleMatrix[
        'artifact:constrained-dashed-render-descriptor'
      ]

    expect(responsibility).toMatchObject({
      classification: 'channel-projection',
      ownerMode:
        'materialize renderer-ready descriptors from already declared final products'
    })
    expect(responsibility.forbiddenActions.join(' ')).toContain('new geometry')
    expect(lifecycle).toMatchObject({
      artifactClassId: 'required-product-artifact',
      computedAt: 'materialize-stroke-product-descriptors',
      mustNotRecomputeAfter: 'render-entries',
      downstreamAuthority: true
    })
    expect(lifecycle.consumedBy).toEqual(
      expect.arrayContaining(['render-entries', 'hit-export'])
    )
  })

  it('materializes renderer-ready descriptors with visible and evidence channels separated', () => {
    const descriptors = materializeStrokeProductDescriptors({
      finalFaces: [
        {
          faceId: 'face:descriptor',
          ownerStepIds: ['build-smooth-continuity-products'],
          renderDescriptor: {
            strokePathGroups,
            descriptorProductPolygons
          },
          debugMeta: {
            ownerStage: 'Stroke Geometry final face assembly'
          }
        }
      ],
      strategies: [eligibleStrategy]
    })

    expect(descriptors).toEqual([
      expect.objectContaining({
        descriptorId: 'descriptor:face:descriptor',
        ownerStage: 'Product Output descriptor materialization',
        finalFaceId: 'face:descriptor',
        strategyId: 'strategy:descriptor',
        descriptorRouteKind: 'same-owner-smooth-span',
        requiredLegalityBasis: 'legality-equivalent-pre-product',
        productBuilderId: 'build-smooth-continuity-products',
        outputChannelIntent: 'render-and-hit-export',
        visibleChannel: {
          strokePathGroups
        },
        evidenceChannel: {
          descriptorProductPolygons
        },
        ownerMetadata: {
          finalFaceOwnerStage: 'Stroke Geometry final face assembly',
          finalFaceOwnerStepIds: ['build-smooth-continuity-products'],
          strategyOwnerStage: 'Stroke Geometry descriptor strategy selection'
        }
      })
    ])
    expect(descriptors[0].visibleChannel).not.toHaveProperty(
      'descriptorProductPolygons'
    )
  })

  it('preserves every body and ownership-overlay id in descriptor identity', () => {
    const dashStrategy: StrokeDescriptorStrategyRecord = {
      ...eligibleStrategy,
      strategyId: 'strategy:batched-dash',
      descriptorRouteKind: 'outside-dashed-visible-band',
      requiredLegalityBasis: 'post-legality-product',
      outputChannelIntent: 'render-and-hit-export',
      productBuilderId: 'build-dash-interval-body-products',
      consumesPostLegalityArtifact: true,
      legalityEquivalenceEvidence: undefined
    }
    const descriptors = materializeStrokeProductDescriptors({
      finalFaces: [
        {
          faceId: 'face:batched-dash',
          ownerStepIds: [
            'build-dash-interval-body-products',
            'build-terminal-body-products',
            'build-smooth-continuity-products'
          ],
          bodyProductIds: ['body:1', 'body:2'],
          terminalOverlayIds: ['terminal-overlay:1'],
          smoothOverlayIds: ['smooth-overlay:2'],
          intervalIds: ['interval:1', 'interval:2'],
          renderDescriptor: { strokePathGroups }
        }
      ],
      strategies: [dashStrategy]
    })

    expect(descriptors).toHaveLength(1)
    expect(descriptors[0].productIdentity).toMatchObject({
      bodyProductIds: ['body:1', 'body:2'],
      terminalOverlayIds: ['terminal-overlay:1'],
      smoothOverlayIds: ['smooth-overlay:2'],
      intervalIds: ['interval:1', 'interval:2']
    })
  })

  it('merges body and ownership-overlay evidence by stable product identity', () => {
    const terminalOverlay = {
      overlayId: 'terminal-overlay:1',
      bodyProductId: 'body:1',
      intervalId: 'interval:1',
      terminalRole: 'start' as const,
      endpointCapPolicySignature: 'cap-policy:1',
      seamBoundaryIds: ['seam:1'],
      joinOwnershipSignatures: ['join:1'],
      ownerStepId: 'build-terminal-body-products' as const,
      zeroVisibleContribution: true as const
    }
    const smoothOverlay = {
      overlayId: 'smooth-overlay:1',
      bodyProductIds: ['body:1', 'body:2'],
      intervalIds: ['interval:1', 'interval:2'],
      splitRangeIds: ['split:1', 'split:2'],
      smoothContinuityGroupId: 'smooth-group:1',
      tangentContinuityProof: {
        continuous: true as const,
        previousTangent: { x: 1, y: 0 },
        nextTangent: { x: 1, y: 0 },
        tolerance: 0.001
      },
      curveOffsetOuterBoundaryProof: {
        evidenceId: 'curve-proof:1',
        basis: 'authored-source-curve-offset-at-stroke-width' as const,
        strokeWidth: 8,
        verified: true as const
      },
      singleContinuousFootprintProof: true as const,
      noSourceVertexJoinOwnershipProof: true as const,
      ownerStepId: 'build-smooth-continuity-products' as const,
      zeroVisibleContribution: true as const
    }

    const merged = mergeConstrainedDashedProductEvidenceEnvelopes([
      {
        bodyProductIds: ['body:2', 'body:1'],
        terminalOwnershipOverlays: [terminalOverlay],
        smoothContinuityOwnershipOverlays: []
      },
      {
        bodyProductIds: ['body:1', 'body:3'],
        terminalOwnershipOverlays: [terminalOverlay],
        smoothContinuityOwnershipOverlays: [smoothOverlay]
      }
    ])

    expect(merged).toEqual({
      bodyProductIds: ['body:2', 'body:1', 'body:3'],
      terminalOwnershipOverlays: [terminalOverlay],
      smoothContinuityOwnershipOverlays: [smoothOverlay]
    })
  })

  it('attaches the merged body-program envelope to inside and outside aggregate descriptors', () => {
    const source = readFileSync(dashedPacketsSourcePath, 'utf8')
    const insideAggregatePacketSource = extractBetween(
      source,
      'const insideAggregateDescriptorPacket =',
      'const outsideAggregateDescriptorPackets ='
    )
    const outsideAggregatePacketSource = extractBetween(
      source,
      'const outsideAggregateDescriptorPackets =',
      'const materializedIntervalPackets ='
    )

    for (const packetSource of [
      insideAggregatePacketSource,
      outsideAggregatePacketSource
    ]) {
      expect(packetSource).toContain(
        'mergeConstrainedDashedProductEvidenceEnvelopes('
      )
      expect(packetSource).toMatch(
        /descriptorItems\.map\(\s*\(item\) => item\.productEvidenceEnvelope\s*\)/
      )
      expect(packetSource).toContain('productEvidenceEnvelope,')
    }
  })

  it('joins compatible body programs without crossing a locked sharp-owner endpoint', () => {
    const joinBodyProgramPaths = (
      constrainedDashedStrokePackets as unknown as {
        joinDescriptorBodyProgramStrokePaths?: (
          records: {
            path: { x: number; y: number }[]
            lockStart?: boolean
            lockEnd?: boolean
          }[]
        ) => { x: number; y: number }[][]
      }
    ).joinDescriptorBodyProgramStrokePaths

    expect(joinBodyProgramPaths).toBeTypeOf('function')
    if (!joinBodyProgramPaths) {
      return
    }

    const paths = joinBodyProgramPaths([
      {
        path: [
          { x: 0, y: 0 },
          { x: 1, y: 0 }
        ]
      },
      {
        path: [
          { x: 1, y: 0 },
          { x: 2, y: 0 }
        ],
        lockEnd: true
      },
      {
        path: [
          { x: 2, y: 0 },
          { x: 3, y: 0 }
        ]
      }
    ])

    expect(paths).toEqual([
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 }
      ],
      [
        { x: 2, y: 0 },
        { x: 3, y: 0 }
      ]
    ])
  })

  it('materializes a simple smooth body path as one continuous descriptor polygon', () => {
    const buildDescriptorProductPolygons = (
      constrainedDashedStrokePackets as unknown as {
        buildCenterStrokeDescriptorProductPolygons?: (
          middleStrokePaths: { x: number; y: number }[][],
          terminalBodyStrokePaths: { x: number; y: number }[][],
          terminalCapPolygons: { x: number; y: number }[][],
          stroke: {
            cap: 'butt'
            join: 'round'
            miterAngle: number
            miterLimit: number
          },
          strokeWidth: number
        ) => { x: number; y: number }[][]
      }
    ).buildCenterStrokeDescriptorProductPolygons

    expect(buildDescriptorProductPolygons).toBeTypeOf('function')
    if (!buildDescriptorProductPolygons) {
      return
    }

    const polygons = buildDescriptorProductPolygons(
      [
        [
          { x: 0, y: 0 },
          { x: 8, y: 4 },
          { x: 16, y: 7 },
          { x: 24, y: 9 },
          { x: 32, y: 10 }
        ]
      ],
      [],
      [],
      {
        cap: 'butt',
        join: 'round',
        miterAngle: 45,
        miterLimit: 4
      },
      8
    )

    expect(polygons).toHaveLength(1)
    expect(polygons[0].length).toBeGreaterThanOrEqual(8)
    const signedArea = polygons[0].reduce((area, point, index, polygon) => {
      const next = polygon[(index + 1) % polygon.length]
      return area + point.x * next.y - next.x * point.y
    }, 0)
    expect(Math.abs(signedArea / 2)).toBeGreaterThan(200)
  })

  it('attributes descriptor polygon subphases while preserving cache-hit output', () => {
    const buildDescriptorProductPolygons = (
      constrainedDashedStrokePackets as unknown as {
        buildCenterStrokeDescriptorProductPolygons?: (
          middleStrokePaths: { x: number; y: number }[][],
          terminalBodyStrokePaths: { x: number; y: number }[][],
          terminalCapPolygons: { x: number; y: number }[][],
          stroke: {
            cap: 'round'
            join: 'round'
            miterAngle: number
            miterLimit: number
          },
          strokeWidth: number
        ) => { x: number; y: number }[][]
      }
    ).buildCenterStrokeDescriptorProductPolygons

    expect(buildDescriptorProductPolygons).toBeTypeOf('function')
    if (!buildDescriptorProductPolygons) {
      return
    }

    const build = () =>
      buildDescriptorProductPolygons(
        [
          [
            { x: 0.25, y: 1.5 },
            { x: 7.75, y: 5.25 },
            { x: 15.5, y: 8.125 },
            { x: 23.25, y: 9.875 },
            { x: 31.75, y: 10.625 }
          ]
        ],
        [],
        [],
        {
          cap: 'round',
          join: 'round',
          miterAngle: 37,
          miterLimit: 3.5
        },
        7.25
      )
    const cacheMiss = collectDescriptorPolygonEvidence(build)
    const cacheHit = collectDescriptorPolygonEvidence(build)
    const requiredPhases = [
      'constrained dashed descriptor polygons: cache key and lookup',
      'constrained dashed descriptor polygons: two-point materialization',
      'constrained dashed descriptor polygons: collinear materialization',
      'constrained dashed descriptor polygons: continuous ribbon materialization',
      'constrained dashed descriptor polygons: fallback materialization',
      'constrained dashed descriptor polygons: middle round caps',
      'constrained dashed descriptor polygons: cache store'
    ]

    expect(cacheMiss.phases).toEqual(expect.arrayContaining(requiredPhases))
    expect(
      cacheMiss.counters.get(
        'center-stroke-descriptor-product-polygon-cache-miss'
      )
    ).toBe(1)
    expect(
      cacheHit.counters.get(
        'center-stroke-descriptor-product-polygon-cache-hit'
      )
    ).toBe(1)
    expect(cacheHit.result).toEqual(cacheMiss.result)
  })

  it.each([1, 7.25, 64])(
    'proves analytic round-cap points need no generic cleanup at width %s',
    (strokeWidth) => {
      const buildDescriptorProductPolygons = (
        constrainedDashedStrokePackets as unknown as {
          buildCenterStrokeDescriptorProductPolygons?: (
            middleStrokePaths: { x: number; y: number }[][],
            terminalBodyStrokePaths: { x: number; y: number }[][],
            terminalCapPolygons: { x: number; y: number }[][],
            stroke: {
              cap: 'round'
              join: 'round'
              miterAngle: number
              miterLimit: number
            },
            strokeWidth: number
          ) => { x: number; y: number }[][]
        }
      ).buildCenterStrokeDescriptorProductPolygons

      expect(buildDescriptorProductPolygons).toBeTypeOf('function')
      if (!buildDescriptorProductPolygons) {
        return
      }

      const polygons = buildDescriptorProductPolygons(
        [
          [
            { x: 0, y: 0 },
            { x: 8, y: 3 },
            { x: 16, y: 5 },
            { x: 24, y: 6 }
          ]
        ],
        [],
        [],
        {
          cap: 'round',
          join: 'round',
          miterAngle: 45,
          miterLimit: 4
        },
        strokeWidth
      )
      const caps = polygons.slice(-2)
      const radius = strokeWidth / 2
      const segmentCount = Math.max(
        8,
        Math.ceil(
          Math.PI / Math.max(Math.PI / 64, 0.35 / radius)
        )
      )

      expect(caps).toHaveLength(2)
      caps.forEach((cap) => {
        expect(cap).toHaveLength(segmentCount + 1)
        for (let index = 0; index < cap.length; index += 1) {
          const previous = cap[(index - 1 + cap.length) % cap.length]
          const point = cap[index]
          const next = cap[(index + 1) % cap.length]
          const nextDx = next.x - point.x
          const nextDy = next.y - point.y
          const firstVector = {
            x: point.x - previous.x,
            y: point.y - previous.y
          }
          const secondVector = { x: nextDx, y: nextDy }

          expect(nextDx * nextDx + nextDy * nextDy).toBeGreaterThan(1e-12)
          expect(
            Math.abs(
              firstVector.x * secondVector.y -
                firstVector.y * secondVector.x
            )
          ).toBeGreaterThan(1e-6)
        }
      })
    }
  )

  it('performs one aggregate cache lookup and consumes validated ribbon output without duplicate normalization or cleanup', () => {
    const source = readFileSync(dashedPacketsSourcePath, 'utf8')
    const continuousRibbonSource = extractBetween(
      source,
      'const buildContinuousDescriptorRibbonPolygons = (',
      'export const buildCenterStrokeDescriptorProductPolygons = ('
    )

    expect(
      source.match(/getCachedInsideAggregateDescriptorProduct\(/g) ?? []
    ).toHaveLength(1)
    expect(continuousRibbonSource).toContain(
      "ribbonGeometry.validityStatus !== 'simple-outline'"
    )
    expect(continuousRibbonSource).toContain(
      'center-stroke-descriptor-continuous-ribbon-status:'
    )
    expect(continuousRibbonSource).not.toContain('normalizeVector(')
    expect(continuousRibbonSource).not.toContain('.map(cleanPolygon)')
  })

  it('matches each final face to its own eligible product-builder strategy', () => {
    const dashStrategy: StrokeDescriptorStrategyRecord = {
      ...eligibleStrategy,
      strategyId: 'strategy:dash',
      descriptorRouteKind: 'outside-dashed-visible-band',
      requiredLegalityBasis: 'post-legality-product',
      outputChannelIntent: 'render-only',
      productBuilderId: 'build-dash-interval-body-products',
      consumesPostLegalityArtifact: true,
      legalityEquivalenceEvidence: undefined
    }
    const descriptors = materializeStrokeProductDescriptors({
      finalFaces: [
        {
          faceId: 'face:smooth',
          ownerStepIds: ['build-smooth-continuity-products'],
          renderDescriptor: { strokePathGroups }
        },
        {
          faceId: 'face:dash',
          ownerStepIds: ['build-dash-interval-body-products'],
          renderDescriptor: { strokePaths: strokePathGroups[0].strokePaths }
        },
        {
          faceId: 'face:canonical',
          ownerStepIds: ['build-center-products'],
          renderDescriptor: { strokePathGroups }
        }
      ],
      strategies: [dashStrategy, eligibleStrategy]
    })

    expect(descriptors).toEqual([
      expect.objectContaining({
        finalFaceId: 'face:smooth',
        strategyId: 'strategy:descriptor',
        descriptorRouteKind: 'same-owner-smooth-span',
        productBuilderId: 'build-smooth-continuity-products'
      }),
      expect.objectContaining({
        finalFaceId: 'face:dash',
        strategyId: 'strategy:dash',
        descriptorRouteKind: 'outside-dashed-visible-band',
        productBuilderId: 'build-dash-interval-body-products'
      })
    ])
  })

  it('keeps diagnostics-only descriptor geometry out of the visible channel', () => {
    const descriptors = materializeStrokeProductDescriptors({
      finalFaces: [
        {
          faceId: 'face:diagnostic',
          ownerStepIds: ['build-smooth-continuity-products'],
          renderDescriptor: {
            strokePathGroups,
            descriptorProductPolygons
          }
        }
      ],
      strategies: [
        {
          ...eligibleStrategy,
          strategyId: 'strategy:diagnostic',
          outputChannelIntent: 'diagnostics-only'
        }
      ]
    })

    expect(descriptors).toEqual([
      expect.objectContaining({
        outputChannelIntent: 'diagnostics-only',
        visibleChannel: {},
        evidenceChannel: { descriptorProductPolygons }
      })
    ])
  })

  it('bypasses materialization when equivalence cannot be proven', () => {
    const descriptors = materializeStrokeProductDescriptors({
      finalFaces: [
        {
          faceId: 'face:canonical',
          ownerStepIds: ['build-smooth-continuity-products'],
          renderDescriptor: {
            strokePathGroups,
            descriptorProductPolygons
          }
        }
      ],
      strategies: [
        {
          ...eligibleStrategy,
          status: 'canonical-product-required'
        }
      ]
    })

    expect(descriptors).toEqual([])
  })

  it('keeps ownership-exclusion strokePathGroups as visible descriptors with style fallback', () => {
    const source = readFileSync(dashedPacketsSourcePath, 'utf8')

    expect(
      source.match(/const materializedStrokePathGroups =/g) ?? []
    ).toHaveLength(2)
    expect(
      source.match(/strokePathStyle: group\.strokePathStyle/g) ?? []
    ).toHaveLength(2)
    expect(source.match(/\? materializedStrokePathGroups/g) ?? []).toHaveLength(
      2
    )
    expect(source.match(/strokePathStyle: undefined/g) ?? []).toEqual([])
  })

  it('materializes inside aggregate body paths as visible descriptor groups while keeping clip polygons separate', () => {
    const source = readFileSync(dashedPacketsSourcePath, 'utf8')
    const insideAggregateDescriptorSource = extractBetween(
      source,
      'const buildInsideDashedAggregateDescriptorProduct = (',
      'const resolveOutsideDescriptorStrokePathSelectedSide = ('
    )

    expect(insideAggregateDescriptorSource).toContain('strokePathGroups:')
    expect(insideAggregateDescriptorSource).toContain(
      'strokePaths: joinedMiddleStrokePaths'
    )
    expect(insideAggregateDescriptorSource).toContain(
      'strokePaths: joinedTerminalBodyStrokePaths'
    )
    expect(insideAggregateDescriptorSource).toContain(
      'resolveCompatibleDashBodyMaterializationStyle(items)'
    )
    expect(insideAggregateDescriptorSource).toContain(
      'const descriptorStrokeWidth = materializationStyle.width'
    )
    expect(insideAggregateDescriptorSource).toContain(
      'width: descriptorStrokeWidth'
    )
    expect(insideAggregateDescriptorSource).toContain(
      'cap: materializationStyle.cap'
    )
    expect(insideAggregateDescriptorSource).toContain("cap: 'butt'")
    expect(insideAggregateDescriptorSource).toContain(
      'fillClipPolygons: clipPolygons'
    )
    expect(insideAggregateDescriptorSource).toContain(
      'descriptorProductPolygons: productPolygons'
    )
    expect(insideAggregateDescriptorSource).toContain(
      'const terminalRole = item.terminalRole'
    )
    expect(insideAggregateDescriptorSource).toContain(
      'lockStart: item.endpointLocks.start'
    )
    expect(insideAggregateDescriptorSource).toContain(
      'lockEnd: item.endpointLocks.end'
    )
    expect(insideAggregateDescriptorSource).not.toContain(
      'suppressProductGeometry'
    )
    expect(insideAggregateDescriptorSource).not.toContain(
      'stroke: Pick<RenderableStroke'
    )
    expect(insideAggregateDescriptorSource).not.toContain('strokeWidth: number')
    expect(insideAggregateDescriptorSource).not.toContain('stroke.cap')
  })

  it('derives outside descriptor geometry style from compatible Step 27 body programs', () => {
    const source = readFileSync(dashedPacketsSourcePath, 'utf8')
    const outsideAggregateDescriptorSource = extractBetween(
      source,
      'const buildOutsideDashedAggregateDescriptorProduct = (',
      'const getSourceSegmentStartTangent = ('
    )

    expect(outsideAggregateDescriptorSource).toContain(
      'resolveCompatibleDashBodyMaterializationStyle(items)'
    )
    expect(outsideAggregateDescriptorSource).toContain(
      'const outsideDescriptorStrokeWidth = materializationStyle.width'
    )
    expect(outsideAggregateDescriptorSource).toContain(
      'const strokeWidth = materializationStyle.width / 2'
    )
    expect(outsideAggregateDescriptorSource).not.toContain('stroke: Pick<')
    expect(outsideAggregateDescriptorSource).not.toContain(
      'strokeWidth: number'
    )
    expect(outsideAggregateDescriptorSource).not.toContain('stroke.cap')
  })

  it('groups aggregate descriptors by completed legal-domain and materialization-style identity', () => {
    const source = readFileSync(dashedPacketsSourcePath, 'utf8')
    const compatibilitySource = extractBetween(
      source,
      'const buildDashBodyDescriptorCompatibilitySignature = (',
      'interface DashedAggregateDescriptorProduct {'
    )
    const insideGroupingSource = extractBetween(
      source,
      'const insideAggregateDescriptorIntervalGroups =',
      'const insideAggregateDescriptorIntervalIds ='
    )
    const outsideGroupingSource = extractBetween(
      source,
      'const outsideAggregateDescriptorIntervalGroups =',
      'const outsideAggregateDescriptorPackets ='
    )

    expect(compatibilitySource).toContain('program.legalSideId')
    expect(compatibilitySource).toContain('program.legalDomainId')
    expect(compatibilitySource).toContain('program.materializationStyle')
    expect(compatibilitySource).toContain('program.productDomainMode')
    expect(compatibilitySource).toContain('program.strokePosition')
    expect(compatibilitySource).toContain(
      'buildDashBodyDescriptorCompatibilitySignature(program)'
    )
    expect(compatibilitySource).not.toContain(
      'getFormalProductDomainModeForInterval('
    )
    expect(insideGroupingSource).toContain(
      'groupDashBodyDescriptorIntervalsByCompatibility('
    )
    expect(insideGroupingSource).toContain('[0] ?? []')
    expect(outsideGroupingSource).toContain(
      'groupDashBodyDescriptorIntervalsByCompatibility('
    )
    expect(insideGroupingSource).not.toContain('strokeDomainPlan,')
    expect(outsideGroupingSource).not.toContain('strokeDomainPlan,')
  })

  it('batches completed Step 27 body programs without rebuilding owner semantics from raw intervals', () => {
    const source = readFileSync(dashedPacketsSourcePath, 'utf8')
    const aggregatePacketSource = extractBetween(
      source,
      'const insideAggregateDescriptorPacket =',
      'const outsideAggregateDescriptorPackets ='
    )
    const descriptorItemSource = extractBetween(
      aggregatePacketSource,
      'const descriptorItems:',
      'if (!descriptorItemsReady) {'
    )

    expect(descriptorItemSource).toContain(
      'dashBodyGeometryProgramsWithSmoothContinuityByIntervalId.get('
    )
    expect(descriptorItemSource).not.toContain(
      'buildDashIntervalBodyGeometryProgram('
    )
    expect(descriptorItemSource).not.toContain('getJoinOwnedEndpointCapPolicy(')
    expect(descriptorItemSource).not.toContain('getDashEndpointCapPolicy(')
    expect(descriptorItemSource).not.toContain(
      'resolveBoundaryDomainMaterializationRange('
    )
  })

  it('batches outside descriptors from completed Step 27 body programs without replaying source semantics', () => {
    const source = readFileSync(dashedPacketsSourcePath, 'utf8')
    const aggregatePacketSource = extractBetween(
      source,
      'const outsideAggregateDescriptorPackets =',
      'const materializedIntervalPackets ='
    )
    const descriptorItemSource = extractBetween(
      aggregatePacketSource,
      'const descriptorItems =',
      'if (!descriptorItems || descriptorItems.length === 0) {'
    )

    expect(descriptorItemSource).toContain(
      'dashBodyGeometryProgramsWithSmoothContinuityByIntervalId.get('
    )
    expect(descriptorItemSource).not.toContain(
      'buildDashIntervalBodyGeometryProgram('
    )
    expect(descriptorItemSource).not.toContain(
      'buildDashIntervalBodyProductId('
    )
    expect(descriptorItemSource).not.toContain(
      'projectPointToSourceSegmentDistance('
    )
    expect(descriptorItemSource).not.toContain('getJoinOwnedEndpointCapPolicy(')
    expect(descriptorItemSource).not.toContain('getDashEndpointCapPolicy(')
    expect(descriptorItemSource).not.toContain(
      'resolveOutsideDescriptorStrokePathSelectedSide('
    )
  })

  it('projects descriptor metadata only from completed body programs and evidence identity', () => {
    const source = readFileSync(dashedPacketsSourcePath, 'utf8')
    const insideAggregatePacketSource = extractBetween(
      source,
      'const insideAggregateDescriptorPacket =',
      'const outsideAggregateDescriptorPackets ='
    )
    const outsideAggregatePacketSource = extractBetween(
      source,
      'const outsideAggregateDescriptorPackets =',
      'const materializedIntervalPackets ='
    )
    const insideMetadataSource = extractBetween(
      insideAggregatePacketSource,
      'const intervalIds: string[] = []',
      'const debugMeta: SolidCenterStrokeGeometryDebugMeta = {'
    )
    const outsideMetadataSource = extractBetween(
      outsideAggregatePacketSource,
      'const aggregateDescriptorMetadata =',
      'const debugMeta: SolidCenterStrokeGeometryDebugMeta = {'
    )

    expect(insideMetadataSource).toContain(
      'for (const bodyProgram of descriptorItems)'
    )
    expect(outsideMetadataSource).toContain(
      'descriptorItems.forEach((bodyProgram) => {'
    )
    for (const metadataSource of [
      insideMetadataSource,
      outsideMetadataSource
    ]) {
      expect(metadataSource).toContain('const interval = bodyProgram.interval')
      expect(metadataSource).toContain('bodyProgram.endpointCapPolicy')
      expect(metadataSource).toMatch(
        /buildDashBodyProgramSplitRangeTerminalRecords\(\s*bodyProgram\s*\)/
      )
      expect(metadataSource).toContain('bodyProgram.materializationStyle')
      expect(metadataSource).toMatch(
        /(?:body|descriptor)Program\.productDomainMode/
      )
      expect(metadataSource).toMatch(
        /(?:body|descriptor)Program\.strokePosition/
      )
      expect(metadataSource).toContain(
        "productEvidenceEnvelope.bodyProductIds.join(',')"
      )
      expect(metadataSource).not.toContain('getJoinOwnedEndpointCapPolicy(')
      expect(metadataSource).not.toContain('getDashEndpointCapPolicy(')
      expect(metadataSource).not.toContain(
        'getBoundaryDomainMaterializedSelectedSide('
      )
      expect(metadataSource).not.toContain(
        'getFormalProductDomainModeForInterval('
      )
      expect(metadataSource).not.toContain(
        'getFormalProductDomainModeForIntervals('
      )
      expect(metadataSource).not.toContain('intervalStroke.width')
      expect(metadataSource).not.toContain('stroke.cap')
      expect(metadataSource).not.toContain('stroke.join')
      expect(metadataSource).not.toContain('stroke.miterLimit')
    }
  })

  it('reuses the completed packet-stage signature for inside aggregate descriptor caching', () => {
    const source = readFileSync(dashedPacketsSourcePath, 'utf8')
    const aggregatePacketSource = extractBetween(
      source,
      'const insideAggregateDescriptorPacket =',
      'const outsideAggregateDescriptorPackets ='
    )
    const cacheSignatureSource = extractBetween(
      aggregatePacketSource,
      'const precomputedProductSignature =',
      'const aggregateDescriptorResult ='
    )

    expect(cacheSignatureSource).toContain(
      'packetStageCacheKeys.packetStageKey'
    )
    expect(cacheSignatureSource).not.toContain('buildPolygonListCacheSignature')
    expect(cacheSignatureSource).not.toContain(
      'insideAggregateDescriptorIntervals.map'
    )
    expect(cacheSignatureSource).not.toContain(
      'buildConstrainedDashedPacketStageCacheKeyBasis'
    )
    expect(cacheSignatureSource).not.toContain(
      'buildImplicitFillRegionRelativeCacheSignature'
    )
  })

  it('does not prune descriptor product fragments by visual area thresholds', () => {
    const source = readFileSync(dashedPacketsSourcePath, 'utf8')
    const aggregateDescriptorSource = extractBetween(
      source,
      'const buildOutsideDashedAggregateDescriptorProduct = (',
      'const getSourceSegmentStartTangent = ('
    )

    expect(aggregateDescriptorSource).not.toContain(
      'pruneSmallClippedProductFragments'
    )
    expect(source).not.toContain('const pruneSmallClippedProductFragments = (')
  })

  it('matches the stroke parameter coverage matrix for this step', () => {
    assertStrokeParameterCoverageForStep(
      'materialize-stroke-product-descriptors'
    )
  })
})
