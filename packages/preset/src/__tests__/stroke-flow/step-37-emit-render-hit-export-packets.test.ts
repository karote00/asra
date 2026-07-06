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
  intervalIds: ['interval:output'],
  sourceSpanIds: ['span:output'],
  sourceNetworkIds: ['network:output'],
  sourceContourIds: ['contour:output'],
  legalDomainIds: ['legal:output'],
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
    geometryBasis: 'canonical-join-footprint'
  },
  renderDescriptor: descriptor,
  paint: {
    geometryId: 'geometry:output',
    color: 0x777777,
    alpha: 1,
    paintKey: 'paint:output'
  }
} satisfies FinalFaceInput

describe('stroke flow step 37: emit-render-hit-export-packets', () => {
  it('keeps emit-render-hit-export-packets as the current or verified thirty-seventh step', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'emit-render-hit-export-packets'
    )
    const activeSteps = data.steps.filter(
      (entry) => entry.refactorStatus === 'active'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(step?.refactorStatus).toMatch(/^(active|verified)$/)
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
        'hit/export evidence references'
      ],
      requiredOutputs: [
        'visible render packets',
        'hit-test packets',
        'export packets',
        'diagnostic packets with explicit non-visible channel tags'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/solid-center-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/stroke-region-packet.ts',
        'packages/preset/src/components/vector.ts'
      ]
    })
  })

  it('emits render, hit, export, and diagnostic packets with explicit channel tags', () => {
    const output =
      emitSolidCenterStrokeProductOutputPacketsFromFinalFaces([finalFace])

    expect(output.renderPackets).toEqual([
      expect.objectContaining({
        channel: 'render',
        visibility: 'visible',
        geometryId: 'geometry:output',
        polygons: [visiblePolygon],
        descriptorRouteMode: 'descriptor-visible-route',
        primaryOwner: finalFace.ownerSet[0]
      })
    ])
    expect(output.renderPackets[0].renderDescriptor).toEqual({
      strokePathGroups: descriptor.strokePathGroups,
      fillClipPolygons: descriptor.fillClipPolygons
    })
    expect(output.renderPackets[0].renderDescriptor).not.toHaveProperty(
      'descriptorProductPolygons'
    )

    expect(output.hitTestPackets).toEqual([
      expect.objectContaining({
        channel: 'hit-test',
        visibility: 'hit-export',
        equivalenceReason: 'descriptor-evidence-projection',
        geometryId: 'geometry:output',
        primaryOwner: finalFace.ownerSet[0]
      })
    ])
    expect(output.exportPackets).toEqual([
      expect.objectContaining({
        channel: 'export',
        visibility: 'hit-export',
        equivalenceReason: 'descriptor-evidence-projection',
        geometryId: 'geometry:output',
        primaryOwner: finalFace.ownerSet[0]
      })
    ])
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
    expect(emitSolidCenterStrokeProductOutputPacketsFromFinalFaces([])).toEqual({
      renderPackets: [],
      hitTestPackets: [],
      exportPackets: [],
      diagnosticPackets: []
    })
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
