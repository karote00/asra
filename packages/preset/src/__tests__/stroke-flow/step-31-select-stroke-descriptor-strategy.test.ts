import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { assertStrokeParameterCoverageForStep } from './stroke-parameter-coverage-test-helper'
import { selectStrokeDescriptorStrategy } from '../../components/stroke-render/stroke-render-descriptor'

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
const descriptorSourcePath = resolve(
  repoRoot,
  'packages/preset/src/components/stroke-render/stroke-render-descriptor.ts'
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

const expectStrategyOnly = (record: unknown) => {
  const text = JSON.stringify(record)
  for (const forbiddenField of [
    'rendererReadyDescriptor',
    'descriptorProductPolygons',
    'strokePathGroups',
    'renderEntries',
    'visiblePaint',
    'strokeMaskPolygons',
    'fillClipPolygons',
    'renderer-local-join'
  ]) {
    expect(text).not.toContain(forbiddenField)
  }
}

describe('stroke flow step 31: select-stroke-descriptor-strategy', () => {
  it('keeps select-stroke-descriptor-strategy as the current or verified thirty-first step', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'select-stroke-descriptor-strategy'
    )
    const activeSteps = data.steps.filter(
      (entry) => entry.refactorStatus === 'active'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(step?.refactorStatus).toMatch(/^(active|verified)$/)
    if (step?.refactorStatus === 'active') {
      expect(activeSteps.map((entry) => entry.id)).toEqual([
        'select-stroke-descriptor-strategy'
      ])
    }
  })

  it('declares the exact descriptor strategy implementation surface', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'select-stroke-descriptor-strategy'
    )

    expect(step).toMatchObject({
      ownerStage: 'Stroke Geometry descriptor strategy selection',
      allowedInputs: [
        'pre-legality product units or descriptor-eligible strategy evidence',
        'descriptor route kind',
        'required legal basis',
        'output channel intent'
      ],
      requiredOutputs: [
        'descriptor strategy records with required legality basis and owner-boundary metadata'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/constrained-dashed-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/stroke-render-descriptor.ts'
      ]
    })
    expect(step?.forbiddenContributors).toEqual(
      expect.arrayContaining([
        'renderer-ready descriptor',
        'post-legality artifact consumption before apply-legality',
        'descriptor evidence as visible paint',
        'renderer-local join completion'
      ])
    )
  })

  it('selects descriptor-eligible strategy records without materializing descriptors', () => {
    const strategies = selectStrokeDescriptorStrategy({
      candidates: [
        {
          candidateId: 'candidate:smooth-descriptor',
          descriptorRouteKind: 'same-owner-smooth-span',
          requiredLegalityBasis: 'legality-equivalent-pre-product',
          outputChannelIntent: 'render-and-hit-export',
          productBuilderId: 'build-smooth-continuity-products',
          ownerBoundarySplitProof: {
            ownerBoundaryId: 'owner-boundary:smooth',
            splitProofId: 'split-proof:smooth',
            complete: true
          },
          legalityEquivalenceEvidence: {
            basisId: 'basis:smooth',
            complete: true
          }
        }
      ]
    })

    expect(strategies).toEqual([
      expect.objectContaining({
        strategyId: 'strategy:candidate:smooth-descriptor',
        ownerStage: 'Stroke Geometry descriptor strategy selection',
        status: 'descriptor-eligible',
        descriptorRouteKind: 'same-owner-smooth-span',
        requiredLegalityBasis: 'legality-equivalent-pre-product',
        outputChannelIntent: 'render-and-hit-export',
        productBuilderId: 'build-smooth-continuity-products',
        materializationStage: 'after-apply-legality',
        consumesPostLegalityArtifact: false,
        ownerBoundarySplitProof: {
          ownerBoundaryId: 'owner-boundary:smooth',
          splitProofId: 'split-proof:smooth',
          complete: true
        },
        legalityEquivalenceEvidence: {
          basisId: 'basis:smooth',
          complete: true
        }
      })
    ])
    expectStrategyOnly(strategies)
  })

  it('routes descriptor-ineligible candidates back to canonical product output without fallback descriptors', () => {
    const strategies = selectStrokeDescriptorStrategy({
      candidates: [
        {
          candidateId: 'candidate:missing-proof',
          descriptorRouteKind: 'outside-dashed-visible-band',
          requiredLegalityBasis: 'post-legality-product',
          outputChannelIntent: 'render-only',
          productBuilderId: 'build-dash-interval-body-products',
          ownerBoundarySplitProof: {
            ownerBoundaryId: 'owner-boundary:missing',
            splitProofId: 'split-proof:missing',
            complete: false
          }
        }
      ]
    })

    expect(strategies).toEqual([
      expect.objectContaining({
        strategyId: 'strategy:candidate:missing-proof',
        status: 'canonical-product-required',
        descriptorRouteKind: 'outside-dashed-visible-band',
        requiredLegalityBasis: 'post-legality-product',
        materializationStage: 'after-apply-legality',
        consumesPostLegalityArtifact: true
      })
    ])
    expectStrategyOnly(strategies)
  })

  it('keeps descriptor strategy selection free of renderer-ready descriptor fields', () => {
    const source = readFileSync(descriptorSourcePath, 'utf8')
    const helperStart = source.indexOf(
      'export const selectStrokeDescriptorStrategy = ('
    )
    const helperEnd = source.indexOf(
      'export interface StrokeDescriptorRenderDescriptorInput',
      helperStart
    )
    expect(helperStart).toBeGreaterThanOrEqual(0)
    expect(helperEnd).toBeGreaterThan(helperStart)
    const helperSource = source.slice(helperStart, helperEnd)

    for (const forbiddenToken of [
      'descriptorProductPolygons',
      'strokePathGroups',
      'renderEntries',
      'visiblePaint',
      'strokeMaskPolygons',
      'fillClipPolygons',
      'strokePathStyle'
    ]) {
      expect(helperSource).not.toContain(forbiddenToken)
    }
  })
  it('matches the stroke parameter coverage matrix for this step', () => {
    assertStrokeParameterCoverageForStep('select-stroke-descriptor-strategy')
  })
})
