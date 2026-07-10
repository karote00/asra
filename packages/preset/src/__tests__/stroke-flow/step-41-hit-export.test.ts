import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { assertStrokeParameterCoverageForStep } from './stroke-parameter-coverage-test-helper'
import {
  applySolidCenterStrokeExportPacketsFromFinalFaces,
  buildSolidCenterStrokeExportPacketsFromFinalFaces,
  buildSolidCenterStrokeHitTestPacketsFromFinalFaces,
  createSolidCenterStrokeHitAreaFromFinalFaces
} from '../../components/stroke-render/solid-center-stroke-packets'

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
  typeof buildSolidCenterStrokeHitTestPacketsFromFinalFaces
>[0][number]

const visiblePolygon = [
  { x: 0, y: 0 },
  { x: 20, y: 0 },
  { x: 20, y: 20 },
  { x: 0, y: 20 }
]

const productEvidenceEnvelope = {
  bodyProductIds: ['body:hit-export'],
  terminalOwnershipOverlays: [],
  smoothContinuityOwnershipOverlays: []
}

const finalFace = {
  faceId: 'face:hit-export',
  sourceGeometryIds: ['geometry:hit-export'],
  polygons: [visiblePolygon],
  bounds: {
    minX: 0,
    minY: 0,
    maxX: 20,
    maxY: 20
  },
  visualPacketKey: 'visual:hit-export',
  paintKey: 'paint:hit-export',
  strokeSpecKey: 'stroke-spec:hit-export',
  ownerSet: [
    {
      ownerKey: 'owner:hit-export',
      strokeId: 'stroke:hit-export',
      intervalId: 'interval:hit-export'
    }
  ],
  ownerStepIds: ['build-source-vertex-join-products'],
  intervalIds: ['interval:hit-export'],
  terminalRoles: ['middle'],
  seamBoundaryIds: ['seam:hit-export'],
  sourceSpanIds: ['span:hit-export'],
  sourceNetworkIds: ['network:hit-export'],
  sourceContourIds: ['contour:hit-export'],
  legalDomainIds: ['legal:hit-export'],
  productEvidenceEnvelope,
  productMode: 'post-legality-product',
  productSignature: 'source-vertex-join',
  debugMeta: {
    ownerKey: 'owner:hit-export',
    strokeId: 'stroke:hit-export',
    intervalId: 'interval:hit-export',
    productMode: 'post-legality-product',
    productSignature: 'source-vertex-join',
    routeId: 'hit-export',
    authoredJoin: 'miter',
    resolvedJoin: 'bevel-by-miter-angle',
    vertexAngle: 12,
    miterAngle: 28,
    angleSource: 'authored-center-path-contour-visit-tangents',
    angleComparison: 'vertexAngle <= miterAngle',
    visibleContributor: 'source-vertex-join',
    geometryBasis: 'canonical-join-footprint',
    productEvidenceEnvelope
  },
  paint: {
    geometryId: 'geometry:hit-export',
    color: 0x777777,
    alpha: 1,
    paintKey: 'paint:hit-export'
  }
} satisfies FinalFaceInput

describe('stroke flow step 41: hit-export', () => {
  it('keeps hit-export as the forty-first runtime step', () => {
    const data = loadInspectorData()
    const step = data.steps.find((entry) => entry.id === 'hit-export')
    const activeSteps = data.steps.filter(
      (entry) => entry.refactorStatus === 'active'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(step?.refactorStatus).toMatch(/^(locked|active|verified)$/)
    if (step?.refactorStatus === 'active') {
      expect(activeSteps.map((entry) => entry.id)).toEqual(['hit-export'])
    }
  })

  it('declares the exact hit/export implementation surface', () => {
    const data = loadInspectorData()
    const step = data.steps.find((entry) => entry.id === 'hit-export')

    expect(step).toMatchObject({
      ownerStage: 'Product Output hit/export projection',
      allowedInputs: [
        'stroke final faces',
        'projected hit/export packets derived from final faces',
        'final-face ConstrainedDashedProductEvidenceEnvelope',
        'source owner, interval, span, contour, network, legal-domain, bounds, and debug metadata carried by final faces'
      ],
      requiredOutputs: [
        'hover hit area backed by projected final-face polygons',
        'lazy export packet channel attached from projected final-face packets',
        'hit/export metadata preserving source owner and product channel evidence',
        'hit/export product identity preserving every body and ownership overlay id'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/solid-center-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/stroke-product-evidence.ts',
        'packages/preset/src/components/vector.ts'
      ]
    })
  })

  it('classifies hit/export as channel projection over final-face packets only', () => {
    const data = loadInspectorData()
    const responsibility = data.stepResponsibilityMatrix['hit-export']

    expect(responsibility).toMatchObject({
      classification: 'channel-projection',
      ownerMode:
        'project final-face backed hit/export packets without visible render authority'
    })
    expect(responsibility.primaryArtifacts).toEqual([
      'artifact:hit-export-packets'
    ])
    expect(responsibility.forbiddenActions.join(' ')).toContain('repair')
    expect(responsibility.forbiddenActions.join(' ')).toContain('recompute')
  })

  it('projects hit and export packets from final faces while preserving ownership and join provenance', () => {
    const hitPackets = buildSolidCenterStrokeHitTestPacketsFromFinalFaces([
      finalFace
    ])
    const exportPackets = buildSolidCenterStrokeExportPacketsFromFinalFaces([
      finalFace
    ])

    expect(hitPackets[0]).toMatchObject({
      channel: 'hit-test',
      visibility: 'hit-export'
    })
    expect(exportPackets[0]).toMatchObject({
      channel: 'export',
      visibility: 'hit-export'
    })

    for (const packets of [hitPackets, exportPackets]) {
      expect(packets).toEqual([
        expect.objectContaining({
          geometryId: 'geometry:hit-export',
          polygons: [visiblePolygon],
          bounds: finalFace.bounds,
          primaryOwner: finalFace.ownerSet[0],
          ownerSet: finalFace.ownerSet,
          ownerStepIds: ['build-source-vertex-join-products'],
          intervalIds: ['interval:hit-export'],
          terminalRoles: ['middle'],
          seamBoundaryIds: ['seam:hit-export'],
          sourceSpanIds: ['span:hit-export'],
          sourceNetworkIds: ['network:hit-export'],
          sourceContourIds: ['contour:hit-export'],
          legalDomainIds: ['legal:hit-export'],
          productEvidenceEnvelope,
          debugMeta: expect.objectContaining({
            authoredJoin: 'miter',
            resolvedJoin: 'bevel-by-miter-angle',
            vertexAngle: 12,
            miterAngle: 28,
            angleSource: 'authored-center-path-contour-visit-tangents',
            angleComparison: 'vertexAngle <= miterAngle',
            visibleContributor: 'source-vertex-join',
            geometryBasis: 'canonical-join-footprint'
          })
        })
      ])
      expect(packets[0].productEvidenceEnvelope).toBe(
        productEvidenceEnvelope
      )
    }
  })

  it('backs hover hit testing with projected final-face polygons only', () => {
    const hitArea = createSolidCenterStrokeHitAreaFromFinalFaces([finalFace])

    expect(hitArea?.contains(10, 10)).toBe(true)
    expect(hitArea?.contains(40, 40)).toBe(false)
    expect(createSolidCenterStrokeHitAreaFromFinalFaces([])).toBeNull()
  })

  it('attaches a lazy export packet channel and supports empty output', () => {
    const graphic: { __asyraSolidCenterStrokeExportPackets?: unknown } = {}
    applySolidCenterStrokeExportPacketsFromFinalFaces(graphic, [finalFace])

    expect(graphic.__asyraSolidCenterStrokeExportPackets).toEqual(
      buildSolidCenterStrokeExportPacketsFromFinalFaces([finalFace])
    )

    const emptyGraphic: { __asyraSolidCenterStrokeExportPackets?: unknown } = {}
    applySolidCenterStrokeExportPacketsFromFinalFaces(emptyGraphic, [])
    expect(emptyGraphic.__asyraSolidCenterStrokeExportPackets).toEqual([])
  })

  it('keeps hit/export projection free of render entries and geometry repair', () => {
    const source = readFileSync(solidCenterSourcePath, 'utf8')
    const helperStart = source.indexOf(
      'const buildProjectionPacketFromFinalFace = ('
    )
    const helperEnd = source.indexOf(
      'const buildProjectedPacketsFromFinalFaces',
      helperStart
    )
    expect(helperStart).toBeGreaterThanOrEqual(0)
    expect(helperEnd).toBeGreaterThan(helperStart)
    const helperSource = source.slice(helperStart, helperEnd)

    for (const forbiddenToken of [
      'buildRenderEntryFromFinalFace',
      'toSolidCenterStrokeRenderEntries',
      'renderSolidCenterStrokeEntries',
      'endpoint cap repair',
      'buildSourceVertexJoin'
    ]) {
      expect(helperSource).not.toContain(forbiddenToken)
    }
  })
  it('matches the stroke parameter coverage matrix for this step', () => {
    assertStrokeParameterCoverageForStep('hit-export')
  })
})
