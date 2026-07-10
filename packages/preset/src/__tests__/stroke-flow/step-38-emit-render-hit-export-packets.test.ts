import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { assertStrokeParameterCoverageForStep } from './stroke-parameter-coverage-test-helper'
import { emitSolidCenterStrokeProductOutputPacketsFromFinalFaces } from '../../components/stroke-render/solid-center-stroke-packets'

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
  artifactRegistry: { id: string }[]
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
const solidCenterSourcePath = resolve(
  repoRoot,
  'packages/preset/src/components/stroke-render/solid-center-stroke-packets.ts'
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

type FinalFaceInput = Parameters<
  typeof emitSolidCenterStrokeProductOutputPacketsFromFinalFaces
>[0][number]

const visiblePolygon = [
  { x: 0, y: 0 },
  { x: 20, y: 0 },
  { x: 20, y: 20 },
  { x: 0, y: 20 }
]

const evidencePolygon = [
  { x: 100, y: 100 },
  { x: 120, y: 100 },
  { x: 120, y: 120 },
  { x: 100, y: 120 }
]

const descriptor = {
  strokePathGroups: [
    {
      strokePaths: [[{ x: 0, y: 0 }]],
      strokePathStyle: {
        width: 10,
        cap: 'butt' as const,
        join: 'miter' as const,
        miterLimit: 4
      }
    }
  ],
  descriptorProductPolygons: [evidencePolygon],
  fillClipPolygons: [evidencePolygon]
}

const productEvidenceEnvelope = {
  bodyProductIds: ['body:output'],
  terminalOwnershipOverlays: [],
  smoothContinuityOwnershipOverlays: []
}

const finalFace = {
  faceId: 'face:output',
  sourceGeometryIds: ['geometry:output'],
  polygons: [visiblePolygon],
  bounds: {
    minX: 0,
    minY: 0,
    maxX: 20,
    maxY: 20
  },
  visualPacketKey: 'visual:output',
  paintKey: 'paint:output',
  strokeSpecKey: 'stroke-spec:output',
  ownerSet: [
    {
      ownerKey: 'owner:output',
      strokeId: 'stroke:output',
      intervalId: 'interval:output'
    }
  ],
  ownerStepIds: ['build-source-vertex-join-products'],
  intervalIds: ['interval:output'],
  terminalRoles: ['middle'],
  seamBoundaryIds: ['seam:output'],
  sourceSpanIds: ['span:output'],
  sourceNetworkIds: ['network:output'],
  sourceContourIds: ['contour:output'],
  legalDomainIds: ['legal:output'],
  productEvidenceEnvelope,
  productMode: 'post-legality-product',
  productSignature: 'source-vertex-join',
  debugMeta: {
    ownerKey: 'owner:output',
    strokeId: 'stroke:output',
    intervalId: 'interval:output',
    productMode: 'post-legality-product',
    productSignature: 'source-vertex-join',
    routeId: 'emit-render-hit-export-packets',
    visibleContributor: 'source-vertex-join',
    geometryBasis: 'canonical-join-footprint',
    productEvidenceEnvelope
  },
  renderDescriptor: descriptor,
  paint: {
    geometryId: 'geometry:output',
    color: 0x777777,
    alpha: 1,
    paintKey: 'paint:output'
  }
} satisfies FinalFaceInput

describe('stroke flow step 38: emit-render-hit-export-packets', () => {
  it('keeps emit-render-hit-export-packets as the thirty-eighth runtime step', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'emit-render-hit-export-packets'
    )
    const activeSteps = data.steps.filter(
      (entry) => entry.refactorStatus === 'active'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(step?.refactorStatus).toMatch(/^(locked|active|verified)$/)
    if (step?.refactorStatus === 'active') {
      expect(activeSteps.map((entry) => entry.id)).toEqual([
        'emit-render-hit-export-packets'
      ])
    }
  })

  it('declares the exact output packet implementation surface', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'emit-render-hit-export-packets'
    )

    expect(step).toMatchObject({
      ownerStage: 'Product Output channel projection',
      allowedInputs: [
        'final faces',
        'renderDescriptor visible route',
        'hit/export evidence references',
        'final-face ConstrainedDashedProductEvidenceEnvelope'
      ],
      requiredOutputs: [
        'visible render packets',
        'hit-test packets',
        'export packets',
        'render, hit-test, and export product identity preserving every body and ownership overlay id'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/solid-center-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/stroke-region-packet.ts',
        'packages/preset/src/components/stroke-render/stroke-product-evidence.ts',
        'packages/preset/src/components/vector.ts'
      ]
    })
  })

  it('classifies packet emission as channel projection and keeps diagnostics non-product', () => {
    const data = loadInspectorData()
    const responsibility =
      data.stepResponsibilityMatrix['emit-render-hit-export-packets']
    const lifecycle =
      data.crossStepArtifactLifecycleMatrix['artifact:hit-export-packets']
    const artifactIds = data.artifactRegistry.map((artifact) => artifact.id)

    expect(responsibility).toMatchObject({
      classification: 'channel-projection',
      ownerMode:
        'project final faces into render, hit-test, and export packet channels'
    })
    expect(responsibility.forbiddenActions.join(' ')).toContain(
      'new geometry'
    )
    expect(lifecycle).toMatchObject({
      artifactClassId: 'required-product-artifact',
      computedAt: 'emit-render-hit-export-packets',
      mustNotRecomputeAfter: 'hit-export',
      downstreamAuthority: true
    })
    expect(artifactIds).not.toContain('artifact:runtime-diagnostics')
  })

  it('emits render, hit, and export packets with explicit product channel tags by default', () => {
    const output = emitSolidCenterStrokeProductOutputPacketsFromFinalFaces([
      finalFace
    ])

    expect(output.renderPackets).toEqual([
      expect.objectContaining({
        channel: 'render',
        visibility: 'visible',
        geometryId: 'geometry:output',
        polygons: [visiblePolygon],
        descriptorRouteMode: 'descriptor-visible-route',
        primaryOwner: finalFace.ownerSet[0],
        ownerStepIds: ['build-source-vertex-join-products'],
        intervalIds: ['interval:output'],
        terminalRoles: ['middle'],
        seamBoundaryIds: ['seam:output']
      })
    ])
    expect(output.renderPackets[0].renderDescriptor).toEqual({
      strokePathGroups: descriptor.strokePathGroups,
      fillClipPolygons: descriptor.fillClipPolygons
    })
    expect(output.renderPackets[0].renderDescriptor).not.toHaveProperty(
      'descriptorProductPolygons'
    )
    expect(output.renderPackets[0].productEvidenceEnvelope).toBe(
      productEvidenceEnvelope
    )

    expect(output.hitTestPackets).toEqual([
      expect.objectContaining({
        channel: 'hit-test',
        visibility: 'hit-export',
        equivalenceReason: 'descriptor-evidence-projection',
        geometryId: 'geometry:output',
        primaryOwner: finalFace.ownerSet[0],
        ownerStepIds: ['build-source-vertex-join-products'],
        terminalRoles: ['middle'],
        seamBoundaryIds: ['seam:output']
      })
    ])
    expect(output.exportPackets).toEqual([
      expect.objectContaining({
        channel: 'export',
        visibility: 'hit-export',
        equivalenceReason: 'descriptor-evidence-projection',
        geometryId: 'geometry:output',
        primaryOwner: finalFace.ownerSet[0],
        ownerStepIds: ['build-source-vertex-join-products'],
        terminalRoles: ['middle'],
        seamBoundaryIds: ['seam:output']
      })
    ])
    expect(output.hitTestPackets[0].productEvidenceEnvelope).toBe(
      productEvidenceEnvelope
    )
    expect(output.exportPackets[0].productEvidenceEnvelope).toBe(
      productEvidenceEnvelope
    )
    expect(output.diagnosticPackets).toEqual([])
  })

  it('keeps evidence polygons out of visible render while allowing hit/export projection', () => {
    const evidenceOnlyDescriptorFace = {
      ...finalFace,
      faceId: 'face:evidence-separated',
      sourceGeometryIds: ['geometry:evidence-separated'],
      visualPacketKey: 'visual:evidence-separated',
      renderDescriptor: {
        descriptorProductPolygons: [evidencePolygon]
      },
      debugMeta: {
        ...finalFace.debugMeta,
        productMode: 'center-product',
        productSignature: 'center-product:dashed'
      }
    } satisfies FinalFaceInput

    const output = emitSolidCenterStrokeProductOutputPacketsFromFinalFaces([
      evidenceOnlyDescriptorFace
    ])

    expect(output.renderPackets[0]).toMatchObject({
      channel: 'render',
      polygons: [visiblePolygon]
    })
    expect(output.renderPackets[0].renderDescriptor).toBeUndefined()
    expect(output.hitTestPackets[0]).toMatchObject({
      channel: 'hit-test',
      polygons: [evidencePolygon],
      equivalenceReason: 'descriptor-evidence-projection'
    })
    expect(output.exportPackets[0]).toMatchObject({
      channel: 'export',
      polygons: [evidencePolygon],
      equivalenceReason: 'descriptor-evidence-projection'
    })
  })

  it('emits optional non-product diagnostic packets only when diagnostics are explicitly enabled', () => {
    const output = emitSolidCenterStrokeProductOutputPacketsFromFinalFaces(
      [finalFace],
      { includeDiagnostics: true }
    )

    expect(output.diagnosticPackets).toEqual([
      expect.objectContaining({
        channel: 'diagnostic',
        visibility: 'non-visible',
        diagnosticKind: 'descriptor-evidence',
        geometryId: 'geometry:output',
        sourceProductOwner: finalFace.ownerSet[0],
        evidenceChannel: {
          descriptorProductPolygons: [evidencePolygon],
          fillClipPolygons: [evidencePolygon]
        }
      })
    ])
  })

  it('emits empty channel arrays for hidden-output or no-final-face input', () => {
    expect(emitSolidCenterStrokeProductOutputPacketsFromFinalFaces([])).toEqual(
      {
        renderPackets: [],
        hitTestPackets: [],
        exportPackets: [],
        diagnosticPackets: []
      }
    )
  })

  it('keeps packet emission free of renderer projection and geometry repair', () => {
    const source = readFileSync(solidCenterSourcePath, 'utf8')
    const helperStart = source.indexOf(
      'export const emitSolidCenterStrokeProductOutputPacketsFromFinalFaces = ('
    )
    const helperEnd = source.indexOf(
      'const defineLazySolidCenterStrokeExportPackets',
      helperStart
    )
    expect(helperStart).toBeGreaterThanOrEqual(0)
    expect(helperEnd).toBeGreaterThan(helperStart)
    const helperSource = source.slice(helperStart, helperEnd)

    for (const forbiddenToken of [
      'toSolidCenterStrokeRenderEntries',
      'buildRenderEntryFromFinalFace',
      'renderSolidCenterStrokeEntries',
      'strokePathStyle.join',
      'endpoint cap repair',
      'patch geometry'
    ]) {
      expect(helperSource).not.toContain(forbiddenToken)
    }
  })
  it('matches the stroke parameter coverage matrix for this step', () => {
    assertStrokeParameterCoverageForStep('emit-render-hit-export-packets')
  })
})
