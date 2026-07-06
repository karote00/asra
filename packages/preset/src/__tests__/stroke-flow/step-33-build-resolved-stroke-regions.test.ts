import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { assertStrokeParameterCoverageForStep } from './stroke-parameter-coverage-test-helper'
import {
  normalizeResolvedStrokePacketGeometry,
  type SolidCenterStrokeResolvedPacket
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

const validPolygon = [
  { x: 2, y: 4 },
  { x: 18, y: 4 },
  { x: 18, y: 24 },
  { x: 2, y: 24 }
]

const invalidPolygon = [
  { x: 100, y: 100 },
  { x: 102, y: 102 }
]

const renderDescriptor = {
  clipPolygons: [[{ x: 0, y: 0 }]],
  strokePaths: [[{ x: 0, y: 0 }]]
}
const revisionSet = {
  sourceRevision: 'source:1',
  topologyRevision: 'topology:1',
  strokeRevision: 'stroke:1',
  dashRevision: 'dash:1',
  legalityRevision: 'legality:1',
  productRevision: 'product:1',
  renderRevision: 'render:1'
}
const debugMeta = {
  ownerStage: 'Stroke Geometry legality clipping',
  routeId: 'apply-legality',
  revisionSet
}
const paint = {
  geometryId: 'geometry:resolved',
  color: 0x777777,
  alpha: 1,
  paintKey: 'paint:identity'
}

const packet: SolidCenterStrokeResolvedPacket = {
  geometry: {
    geometryId: 'geometry:resolved',
    polygons: [invalidPolygon, validPolygon],
    bounds: {
      minX: 100,
      minY: 100,
      maxX: 102,
      maxY: 102
    },
    renderDescriptor,
    debugMeta
  },
  paint
}

describe('stroke flow step 33: build-resolved-stroke-regions', () => {
  it('keeps build-resolved-stroke-regions as the current or verified thirty-third step', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'build-resolved-stroke-regions'
    )
    const activeSteps = data.steps.filter(
      (entry) => entry.refactorStatus === 'active'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(step?.refactorStatus).toMatch(/^(active|verified)$/)
    if (step?.refactorStatus === 'active') {
      expect(activeSteps.map((entry) => entry.id)).toEqual([
        'build-resolved-stroke-regions'
      ])
    }
  })

  it('declares the exact resolved packet implementation surface', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'build-resolved-stroke-regions'
    )

    expect(step).toMatchObject({
      ownerStage: 'Stroke Geometry resolved packet assembly',
      allowedInputs: [
        'legality-applied canonical product packets',
        'legality-applied render descriptors',
        'stroke geometry debug metadata and revision sets',
        'paint packet references emitted by product builders'
      ],
      requiredOutputs: [
        'SolidCenterStrokeResolvedPacket records',
        'normalized packet polygons and bounds',
        'unchanged paint packet references',
        'unchanged renderDescriptor and debugMeta channels'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/solid-center-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/dashed-center-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/constrained-solid-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/constrained-dashed-stroke-packets.ts',
        'packages/preset/src/components/vector.ts'
      ]
    })
  })

  it('normalizes only packet polygons and bounds while preserving paint and metadata identities', () => {
    const normalized = normalizeResolvedStrokePacketGeometry([packet])

    expect(normalized).toHaveLength(1)
    expect(normalized[0].geometry.polygons).toEqual([validPolygon])
    expect(normalized[0].geometry.bounds).toEqual({
      minX: 2,
      minY: 4,
      maxX: 18,
      maxY: 24
    })
    expect(normalized[0].paint).toBe(paint)
    expect(normalized[0].geometry.renderDescriptor).toBe(renderDescriptor)
    expect(normalized[0].geometry.debugMeta).toBe(debugMeta)
    expect(normalized[0].geometry.debugMeta?.revisionSet).toBe(revisionSet)
  })

  it('does not build final faces, render entries, hit/export packets, joins, caps, or descriptor-visible products', () => {
    const source = readFileSync(solidCenterSourcePath, 'utf8')
    const start = source.indexOf(
      'export const normalizeResolvedStrokePacketGeometry = ('
    )
    const end = source.indexOf(
      'export const buildSolidCenterStrokeResolvedPackets = (',
      start
    )
    expect(start).toBeGreaterThanOrEqual(0)
    expect(end).toBeGreaterThan(start)
    const helperSource = source.slice(start, end)

    for (const forbiddenToken of [
      'buildStrokeFinalFaces',
      'renderEntries',
      'hitPacket',
      'exportPacket',
      'endpointCap',
      'source-vertex-join',
      'strokePathStyle',
      'descriptorProductPolygons'
    ]) {
      expect(helperSource).not.toContain(forbiddenToken)
    }
  })
  it('matches the stroke parameter coverage matrix for this step', () => {
    assertStrokeParameterCoverageForStep('build-resolved-stroke-regions')
  })

})
