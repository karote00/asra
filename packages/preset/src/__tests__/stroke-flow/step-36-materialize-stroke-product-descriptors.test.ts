import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { assertStrokeParameterCoverageForStep } from './stroke-parameter-coverage-test-helper'
import {
  materializeStrokeProductDescriptors,
  type StrokeDescriptorStrategyRecord
} from '../../components/stroke-render/stroke-render-descriptor'

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

describe('stroke flow step 36: materialize-stroke-product-descriptors', () => {
  it('keeps materialize-stroke-product-descriptors as the current or verified thirty-sixth step', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'materialize-stroke-product-descriptors'
    )
    const activeSteps = data.steps.filter(
      (entry) => entry.refactorStatus === 'active'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(step?.refactorStatus).toMatch(/^(active|verified)$/)
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
        'output channel separation'
      ],
      requiredOutputs: [
        'renderer-ready product descriptors with channel and owner metadata'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/constrained-dashed-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/stroke-render-descriptor.ts'
      ]
    })
  })

  it('materializes renderer-ready descriptors with visible and evidence channels separated', () => {
    const descriptors = materializeStrokeProductDescriptors({
      finalFaces: [
        {
          faceId: 'face:descriptor',
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
        descriptorRouteKind: 'same-owner-smooth-span',
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
          strategyOwnerStage: 'Stroke Geometry descriptor strategy selection'
        }
      })
    ])
    expect(descriptors[0].visibleChannel).not.toHaveProperty(
      'descriptorProductPolygons'
    )
  })

  it('bypasses materialization when equivalence cannot be proven', () => {
    const descriptors = materializeStrokeProductDescriptors({
      finalFaces: [
        {
          faceId: 'face:canonical',
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

    expect(source.match(/const materializedStrokePathGroups =/g) ?? [])
      .toHaveLength(2)
    expect(source.match(/strokePathStyle: group\.strokePathStyle/g) ?? [])
      .toHaveLength(2)
    expect(source.match(/\? materializedStrokePathGroups/g) ?? [])
      .toHaveLength(2)
    expect(source.match(/strokePathStyle: undefined/g) ?? []).toEqual([])
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
    assertStrokeParameterCoverageForStep('materialize-stroke-product-descriptors')
  })

})
