import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { assertStrokeParameterCoverageForStep } from './stroke-parameter-coverage-test-helper'
import { attachStrokePaintPayload } from '../../components/stroke-render/solid-center-stroke-packets'

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
    routeId: 'build-resolved-stroke-regions'
  }
}

const gradientStyle = {
  type: 'linear-gradient',
  stops: [
    { offset: 0, color: '#000000' },
    { offset: 1, color: '#ffffff' }
  ]
}

describe('stroke flow step 34: attach-paint-payload', () => {
  it('keeps attach-paint-payload as the current or verified thirty-fourth step', () => {
    const data = loadInspectorData()
    const step = data.steps.find((entry) => entry.id === 'attach-paint-payload')
    const activeSteps = data.steps.filter(
      (entry) => entry.refactorStatus === 'active'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(step?.refactorStatus).toMatch(/^(active|verified)$/)
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
        'SolidCenterStrokeResolvedPacket geometry records',
        'renderable stroke paint fields',
        'stroke.fill-normalized paint identity',
        'geometryId for paint-to-geometry association'
      ],
      requiredOutputs: [
        'SolidCenterStrokePaintPacket payloads',
        'resolved packets with unchanged geometry records',
        'paint identity evidence through paintKey',
        'gradientStyle carried as paint data only'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/solid-center-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/dashed-center-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/constrained-solid-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/constrained-dashed-stroke-packets.ts'
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
