import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { assertStrokeParameterCoverageForStep } from './stroke-parameter-coverage-test-helper'
import { buildStrokeFinalFacesFromResolvedPackets } from '../../components/stroke-render/stroke-final-face'

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
const finalFaceSourcePath = resolve(
  repoRoot,
  'packages/preset/src/components/stroke-render/stroke-final-face.ts'
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

const renderDescriptor = {
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

const paint = {
  geometryId: 'geometry:final',
  color: 0x777777,
  alpha: 1,
  paintKey: 'paint:final'
}

describe('stroke flow step 35: build-final-faces', () => {
  it('keeps build-final-faces as the current or verified thirty-fifth step', () => {
    const data = loadInspectorData()
    const step = data.steps.find((entry) => entry.id === 'build-final-faces')
    const activeSteps = data.steps.filter(
      (entry) => entry.refactorStatus === 'active'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(step?.refactorStatus).toMatch(/^(active|verified)$/)
    if (step?.refactorStatus === 'active') {
      expect(activeSteps.map((entry) => entry.id)).toEqual([
        'build-final-faces'
      ])
    }
  })

  it('declares the exact final face implementation surface', () => {
    const data = loadInspectorData()
    const step = data.steps.find((entry) => entry.id === 'build-final-faces')

    expect(step).toMatchObject({
      ownerStage: 'Stroke Geometry final face assembly',
      allowedInputs: [
        'paint-attached semantic stroke records',
        'canonical product packets',
        'render descriptors with visible route and evidence route separation'
      ],
      requiredOutputs: [
        'final faces for canonical visible product packets',
        'final faces carrying renderDescriptor for descriptor-visible routes',
        'separated hit/export/diagnostic evidence references'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/stroke-final-face.ts',
        'packages/preset/src/components/stroke-render/stroke-candidate-arrangement.ts',
        'packages/preset/src/components/stroke-render/solid-center-stroke-packets.ts',
        'packages/preset/src/components/vector.ts'
      ]
    })
  })

  it('builds final faces from canonical visible product polygons while carrying descriptor channels unchanged', () => {
    const faces = buildStrokeFinalFacesFromResolvedPackets([
      {
        geometry: {
          geometryId: 'geometry:final',
          polygons: [visiblePolygon],
          bounds: {
            minX: 0,
            minY: 0,
            maxX: 20,
            maxY: 20
          },
          debugMeta: {
            productMode: 'post-legality-product',
            productSignature: 'source-vertex-join',
            routeId: 'build-final-faces',
            ownerKey: 'owner:face',
            strokeId: 'stroke:face',
            legalDomainIds: ['legal:face']
          },
          renderDescriptor
        },
        paint
      }
    ])

    expect(faces).toHaveLength(1)
    expect(faces[0]).toMatchObject({
      faceId: 'geometry:final',
      sourceGeometryIds: ['geometry:final'],
      polygons: [visiblePolygon],
      bounds: {
        minX: 0,
        minY: 0,
        maxX: 20,
        maxY: 20
      },
      legalDomainIds: ['legal:face'],
      productMode: 'post-legality-product',
      productSignature: 'source-vertex-join'
    })
    expect(faces[0].renderDescriptor).toBe(renderDescriptor)
    expect(faces[0].paint).toBe(paint)
    expect(faces[0].polygons).not.toEqual([evidencePolygon])
  })

  it('keeps final face assembly free of render entry and hit/export construction', () => {
    const source = readFileSync(finalFaceSourcePath, 'utf8')
    const start = source.indexOf(
      'export const buildStrokeFinalFacesFromResolvedPackets = <'
    )
    const end = source.indexOf(
      'const buildDebugMetaFromPaintAttachedRegion',
      start
    )
    expect(start).toBeGreaterThanOrEqual(0)
    expect(end).toBeGreaterThan(start)
    const helperSource = source.slice(start, end)

    for (const forbiddenToken of [
      'renderEntries',
      'hitPacket',
      'exportPacket',
      'diagnosticGeometry',
      'masked-source-stroke',
      'descriptorProductPolygons'
    ]) {
      expect(helperSource).not.toContain(forbiddenToken)
    }
  })
  it('matches the stroke parameter coverage matrix for this step', () => {
    assertStrokeParameterCoverageForStep('build-final-faces')
  })
})
