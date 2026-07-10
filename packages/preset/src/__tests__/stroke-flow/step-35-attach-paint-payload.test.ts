import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { assertStrokeParameterCoverageForStep } from './stroke-parameter-coverage-test-helper'
import { attachStrokePaintPayload } from '../../components/stroke-render/solid-center-stroke-packets'
import { attachStrokePaintPayload as attachRegionPaintPayload } from '../../components/stroke-render/stroke-paint-payload'
import type { StrokeRegionPacket } from '../../components/stroke-render/stroke-region-packet'

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

const productEvidenceEnvelope = {
  bodyProductIds: ['body:paint'],
  terminalOwnershipOverlays: [],
  smoothContinuityOwnershipOverlays: []
}

const geometry = {
  geometryId: 'geometry:paint',
  polygons: [
    [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 }
    ]
  ],
  bounds: {
    minX: 0,
    minY: 0,
    maxX: 10,
    maxY: 10
  },
  renderDescriptor: {
    clipPolygons: [[{ x: 0, y: 0 }]]
  },
  debugMeta: {
    ownerStage: 'Stroke Geometry resolved packet assembly',
    routeId: 'build-resolved-stroke-regions',
    productEvidenceEnvelope
  }
}

const gradientStyle = {
  type: 'linear-gradient',
  stops: [
    { offset: 0, color: '#000000' },
    { offset: 1, color: '#ffffff' }
  ]
}

describe('stroke flow step 35: attach-paint-payload', () => {
  it('keeps attach-paint-payload as the thirty-fifth runtime step', () => {
    const data = loadInspectorData()
    const step = data.steps.find((entry) => entry.id === 'attach-paint-payload')
    const activeSteps = data.steps.filter(
      (entry) => entry.refactorStatus === 'active'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(step?.refactorStatus).toMatch(/^(locked|active|verified)$/)
    if (step?.refactorStatus === 'active') {
      expect(activeSteps.map((entry) => entry.id)).toEqual([
        'attach-paint-payload'
      ])
    }
  })

  it('declares the exact paint payload implementation surface', () => {
    const data = loadInspectorData()
    const step = data.steps.find((entry) => entry.id === 'attach-paint-payload')

    expect(step).toMatchObject({
      ownerStage: 'Stroke Geometry paint payload attachment',
      allowedInputs: [
        'ResolvedStrokeProductRecord geometry records',
        'unchanged ConstrainedDashedProductEvidenceEnvelope',
        'renderable stroke paint fields',
        'stroke.fill-normalized paint identity',
        'geometryId for paint-to-geometry association'
      ],
      requiredOutputs: [
        'SolidCenterStrokePaintPacket payloads',
        'resolved packets with unchanged geometry records',
        'paint-attached records with unchanged ConstrainedDashedProductEvidenceEnvelope',
        'paint identity evidence through paintKey',
        'gradientStyle carried as paint data only'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/solid-center-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/dashed-center-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/constrained-solid-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/constrained-dashed-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/stroke-paint-payload.ts',
        'packages/preset/src/components/stroke-render/stroke-product-evidence.ts'
      ]
    })
  })

  it('attaches paint payload while preserving geometry, descriptor, and debug metadata identities', () => {
    const packets = attachStrokePaintPayload({
      geometryPackets: [geometry],
      paint: {
        kind: 'gradient',
        color: 0x123456,
        alpha: 0.75,
        gradientStyle,
        paintKey: 'paint:gradient:1'
      }
    })

    expect(packets).toHaveLength(1)
    expect(packets[0].geometry).toBe(geometry)
    expect(packets[0].geometry.renderDescriptor).toBe(geometry.renderDescriptor)
    expect(packets[0].geometry.debugMeta).toBe(geometry.debugMeta)
    expect(packets[0].geometry.debugMeta.productEvidenceEnvelope).toBe(
      productEvidenceEnvelope
    )
    expect(packets[0].paint).toMatchObject({
      geometryId: 'geometry:paint',
      kind: 'gradient',
      color: 0x123456,
      alpha: 0.75,
      gradientStyle,
      paintKey: 'paint:gradient:1'
    })
    expect(packets[0].paint.gradientStyle).toBe(gradientStyle)
  })

  it('keeps paint parameters in paint payload while preserving geometry parameter metadata', () => {
    const geometryWithStrokeMetadata = {
      ...geometry,
      debugMeta: {
        ...geometry.debugMeta,
        authoredJoin: 'miter',
        resolvedJoin: 'bevel-by-miter-angle',
        strokeWidth: 20,
        dashAndGapSignature: 'dash:20-gap:10'
      }
    }
    const packets = attachStrokePaintPayload({
      geometryPackets: [geometryWithStrokeMetadata],
      paint: {
        kind: 'solid',
        color: 0xabcdef,
        alpha: 0.4,
        paintKey: 'solid:11259375:0.4'
      }
    })

    expect(packets[0].geometry).toBe(geometryWithStrokeMetadata)
    expect(packets[0].geometry.debugMeta).toMatchObject({
      authoredJoin: 'miter',
      resolvedJoin: 'bevel-by-miter-angle',
      strokeWidth: 20,
      dashAndGapSignature: 'dash:20-gap:10'
    })
    expect(packets[0].paint).toMatchObject({
      geometryId: 'geometry:paint',
      kind: 'solid',
      color: 0xabcdef,
      alpha: 0.4,
      paintKey: 'solid:11259375:0.4'
    })
    const serializedPaint = JSON.stringify(packets[0].paint)
    for (const forbiddenField of [
      'style',
      'position',
      'width',
      'cap',
      'join',
      'miterAngle',
      'dash',
      'gap',
      'colorFormat',
      'defaultColorFormat'
    ]) {
      expect(serializedPaint).not.toContain(forbiddenField)
    }
  })

  it('preserves region owner, terminal, and seam identity while attaching paint', () => {
    const region: StrokeRegionPacket = {
      regionId: 'region:paint-identity',
      sourceGeometryIds: ['geometry:paint-identity'],
      polygons: geometry.polygons,
      bounds: geometry.bounds,
      ownerSet: [{ ownerKey: 'owner:paint-identity' }],
      ownerStepIds: ['build-terminal-body-products'],
      intervalIds: ['interval:paint-identity'],
      terminalRoles: ['end'],
      seamBoundaryIds: ['seam:paint-identity'],
      sourceSpanIds: ['span:paint-identity'],
      sourceNetworkIds: ['network:paint-identity'],
      sourceContourIds: ['contour:paint-identity'],
      legalDomainIds: ['legal:paint-identity']
    }
    const [attached] = attachRegionPaintPayload([region], {
      color: 0x123456,
      alpha: 0.75
    })

    expect(attached).toMatchObject({
      ownerStepIds: ['build-terminal-body-products'],
      intervalIds: ['interval:paint-identity'],
      terminalRoles: ['end'],
      seamBoundaryIds: ['seam:paint-identity'],
      sourceSpanIds: ['span:paint-identity'],
      legalDomainIds: ['legal:paint-identity']
    })
  })

  it('returns no packets when no geometry records are emitted', () => {
    expect(
      attachStrokePaintPayload({
        geometryPackets: [],
        paint: {
          color: 0,
          alpha: 0,
          paintKey: 'paint:none'
        }
      })
    ).toEqual([])
  })

  it('keeps paint attachment free of geometry mutation and downstream packet construction', () => {
    const source = readFileSync(solidCenterSourcePath, 'utf8')
    const helperStart = source.indexOf(
      'export const attachStrokePaintPayload = ('
    )
    expect(helperStart).toBeGreaterThanOrEqual(0)
    const helperSource = source.slice(helperStart)

    for (const forbiddenToken of [
      'buildStrokeFinalFaces',
      'renderEntries',
      'hitPacket',
      'exportPacket',
      'resolvedJoin',
      'vertexAngle',
      'miterAngle',
      'angleSource',
      'strokePathStyle'
    ]) {
      expect(helperSource).not.toContain(forbiddenToken)
    }
  })
  it('matches the stroke parameter coverage matrix for this step', () => {
    assertStrokeParameterCoverageForStep('attach-paint-payload')
  })
})
