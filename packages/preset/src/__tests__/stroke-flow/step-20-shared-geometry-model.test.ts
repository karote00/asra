import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  assertStrokeParameterCoverageForStep,
  expectNoStrokeParameterOutputKeys,
  expectNoStrokeParameterSourceTokens
} from './stroke-parameter-coverage-test-helper'
import type { VectorNetwork, VectorPointNode, VectorSegment } from '@asyra/core'
import { buildVectorGeometryModelPath } from '../../components/stroke-render/path-geometry'
import { buildPathTopologyModel } from '../../components/stroke-render/path-topology-model'
import { buildResolvedVectorGeometryModel } from '../../components/stroke-render/resolved-vector-geometry-model'

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
const vectorSourcePath = resolve(
  repoRoot,
  'packages/preset/src/components/vector.ts'
)
const pathGeometrySourcePath = resolve(
  repoRoot,
  'packages/preset/src/components/stroke-render/path-geometry.ts'
)
const pathTopologySourcePath = resolve(
  repoRoot,
  'packages/preset/src/components/stroke-render/path-topology-model.ts'
)
const resolvedGeometrySourcePath = resolve(
  repoRoot,
  'packages/preset/src/components/stroke-render/resolved-vector-geometry-model.ts'
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

const point = (
  id: string,
  x: number,
  y: number,
  anchorType: VectorPointNode['anchorType'] = 'sharp'
): VectorPointNode => ({
  id,
  kind: 'anchor',
  x,
  y,
  anchorType
})

const segment = (
  id: string,
  startId: string,
  endId: string
): VectorSegment => ({
  id,
  startId,
  endId
})

const buildBowtieNetwork = () => {
  const points = {
    a: point('a', 0, 0),
    b: point('b', 100, 100),
    c: point('c', 0, 100),
    d: point('d', 100, 0)
  }
  const segments = {
    ab: segment('ab', 'a', 'b'),
    bc: segment('bc', 'b', 'c'),
    cd: segment('cd', 'c', 'd'),
    da: segment('da', 'd', 'a')
  }
  const network: VectorNetwork = {
    id: 'network:bowtie',
    pointIds: ['a', 'b', 'c', 'd'],
    segmentIds: ['ab', 'bc', 'cd', 'da'],
    closed: true
  }
  return { network, points, segments }
}

const buildBowtieSharedGeometry = (
  pointOverrides: Partial<
    Record<'a' | 'b' | 'c' | 'd', Partial<VectorPointNode>>
  > = {}
) => {
  const { network, points, segments } = buildBowtieNetwork()
  for (const [pointId, override] of Object.entries(pointOverrides)) {
    const existing = points[pointId as keyof typeof points]
    if (existing) {
      points[pointId as keyof typeof points] = { ...existing, ...override }
    }
  }
  const path = buildVectorGeometryModelPath(network, points, segments)
  const topology = buildPathTopologyModel({
    pathId: 'vector:fixture:network:bowtie',
    sourceId: 'vector:fixture',
    networkId: network.id,
    sourceRevision: `fixture-revision:${
      Object.keys(pointOverrides).join('+') || 'base'
    }`,
    sourceFamily: 'vector',
    fillRule: 'evenodd',
    points: path.sampledPoints,
    closed: path.closed
  })
  return { network, path, topology }
}

const collectStrokePipelineCounters = (run: () => void) => {
  const counters = new Map<string, number>()
  const globalRecord = globalThis as typeof globalThis & {
    __asyraStrokePipelineCounterSink?: (
      counterName: string,
      value: number
    ) => void
  }
  const previousSink = globalRecord.__asyraStrokePipelineCounterSink
  globalRecord.__asyraStrokePipelineCounterSink = (counterName, value = 1) => {
    counters.set(counterName, (counters.get(counterName) ?? 0) + value)
  }
  try {
    run()
  } finally {
    globalRecord.__asyraStrokePipelineCounterSink = previousSink
  }
  return counters
}

const expectNoVisibleStrokeProductFields = (record: unknown) => {
  const text = JSON.stringify(record, (_key, value) => {
    if (value instanceof Map) {
      return Array.from(value.entries())
    }
    if (typeof value === 'function') {
      return '[function]'
    }
    return value
  })
  for (const forbiddenField of [
    'strokeMaskPolygons',
    'descriptorProductPolygons',
    'strokePathStyle',
    'renderEntries',
    'resolvedJoin',
    'vertexAngle',
    'angleSource',
    'miterAngle',
    'capPolicy',
    'sourceVertexJoinFootprint'
  ]) {
    expect(text).not.toContain(forbiddenField)
  }
}

describe('stroke flow step 20: shared-geometry-model', () => {
  it('keeps shared-geometry-model as the current or verified twentieth step', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'shared-geometry-model'
    )
    const activeSteps = data.steps.filter(
      (entry) => entry.refactorStatus === 'active'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(step?.refactorStatus).toMatch(/^(active|verified)$/)
    if (step?.refactorStatus === 'active') {
      expect(activeSteps.map((entry) => entry.id)).toEqual([
        'shared-geometry-model'
      ])
    }
  })

  it('declares the exact shared geometry implementation surface', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'shared-geometry-model'
    )

    expect(step).toMatchObject({
      ownerStage: 'Stroke Geometry',
      allowedInputs: [
        'local source point map',
        'ordered authored vector networks',
        'normalized fill rule',
        'geometry cache revision keys'
      ],
      requiredOutputs: [
        'VectorNetworkPathModel records with source revisions',
        'PathTopologyModel records with contour, length, legal-domain, and self-intersection evidence',
        'ResolvedVectorGeometryModel records with self-intersection regions and stroke boundary domains when requested'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/path-geometry.ts',
        'packages/preset/src/components/stroke-render/path-topology-model.ts',
        'packages/preset/src/components/stroke-render/resolved-vector-geometry-model.ts',
        'packages/preset/src/components/vector.ts'
      ]
    })
    expect(step?.forbiddenContributors).toEqual(
      expect.arrayContaining([
        'visible stroke product output',
        'stroke render entries',
        'renderer projection output',
        'strokePathStyle.join',
        'endpoint cap geometry',
        'source-vertex join footprint geometry',
        'miter-resolution metadata'
      ])
    )
  })

  it('builds source-domain path, topology, and resolved geometry evidence only', () => {
    const { network, points, segments } = buildBowtieNetwork()
    const path = buildVectorGeometryModelPath(network, points, segments)
    const topology = buildPathTopologyModel({
      pathId: 'vector:fixture:network:bowtie',
      sourceId: 'vector:fixture',
      networkId: network.id,
      sourceRevision: 'fixture-revision',
      sourceFamily: 'vector',
      fillRule: 'evenodd',
      points: path.sampledPoints,
      closed: path.closed
    })
    const resolvedGeometry = buildResolvedVectorGeometryModel({
      modelId: 'vector:fixture:resolved-geometry',
      fillRule: 'evenodd',
      networks: [
        {
          networkId: network.id,
          path,
          topology
        }
      ],
      resolveSelfIntersecting: true
    })

    expect(path).toMatchObject({
      closed: true,
      segments: expect.arrayContaining([
        expect.objectContaining({ type: 'line' })
      ])
    })
    expect(path.totalLength).toBeGreaterThan(0)
    expect(path.segmentDistanceRanges).toHaveLength(4)
    expect(topology).toMatchObject({
      sourceRevision: 'fixture-revision',
      sourceFamily: 'vector',
      topologyFamily: 'self-intersecting',
      canonicalLengthBasis: 'arc-length-on-topology',
      closed: true
    })
    expect(topology.intersectionDescriptors).toEqual([
      { kind: 'self-intersection' }
    ])
    expect(topology.contours).toHaveLength(1)
    expect(topology.legalDomainDescriptors).toHaveLength(1)
    expect(resolvedGeometry).toMatchObject({
      modelId: 'vector:fixture:resolved-geometry',
      fillRule: 'evenodd'
    })
    expect(resolvedGeometry.networks[0].selfIntersecting).not.toBeNull()
    expect(
      resolvedGeometry.networks[0].selfIntersecting?.tracedSegments.length
    ).toBeGreaterThan(0)
    expectNoVisibleStrokeProductFields({ path, topology, resolvedGeometry })
    expectNoStrokeParameterOutputKeys({ path, topology, resolvedGeometry })
  })

  it('reuses validated current-source geometry cache across source drag frames', () => {
    const initialGeometry = buildBowtieSharedGeometry()
    const initialModel = buildResolvedVectorGeometryModel({
      modelId: 'vector:fixture:resolved-geometry',
      fillRule: 'evenodd',
      networks: [
        {
          networkId: initialGeometry.network.id,
          path: initialGeometry.path,
          topology: initialGeometry.topology
        }
      ],
      resolveSelfIntersecting: true
    })
    const draggedGeometry = buildBowtieSharedGeometry({
      b: { x: 115, y: 100 }
    })
    const draggedNetworks = [
      {
        networkId: draggedGeometry.network.id,
        path: draggedGeometry.path,
        topology: draggedGeometry.topology
      }
    ]
    const fullModel = buildResolvedVectorGeometryModel({
      modelId: 'vector:fixture:resolved-geometry',
      fillRule: 'evenodd',
      networks: draggedNetworks,
      resolveSelfIntersecting: true
    })
    let cachedModel:
      | ReturnType<typeof buildResolvedVectorGeometryModel>
      | undefined
    const counters = collectStrokePipelineCounters(() => {
      cachedModel = buildResolvedVectorGeometryModel({
        modelId: 'vector:fixture:resolved-geometry',
        fillRule: 'evenodd',
        networks: draggedNetworks,
        resolveSelfIntersecting: true,
        previousCache: initialModel.cache
      })
    })

    expect(cachedModel?.networks[0]?.selfIntersecting).toEqual(
      fullModel.networks[0]?.selfIntersecting
    )
    expect(
      counters.get('resolved-geometry-source-segment-trace-cache-hit') ?? 0
    ).toBeGreaterThan(0)
    expect(
      counters.get('resolved-geometry-source-segment-trace-cache-miss') ?? 0
    ).toBeGreaterThan(0)
    expectNoVisibleStrokeProductFields(cachedModel)
    expectNoStrokeParameterOutputKeys(cachedModel)
  })

  it('orchestrates shared geometry before stroke product ownership in vector rendering', () => {
    const vectorSource = readFileSync(vectorSourcePath, 'utf8')
    const pathStageStart = vectorSource.indexOf('const pathModelCache')
    const pathStageEnd = vectorSource.indexOf(
      'const hasConstrainedDashedIntent',
      pathStageStart
    )
    const resolvedStageStart = vectorSource.indexOf(
      'const needsResolvedGeometryModel'
    )
    const resolvedStageEnd = vectorSource.indexOf(
      'const resolvedGeometryByNetworkId',
      resolvedStageStart
    )
    const pathStage = vectorSource.slice(pathStageStart, pathStageEnd)
    const resolvedStage = vectorSource.slice(
      resolvedStageStart,
      resolvedStageEnd
    )

    expect(pathStageStart).toBeGreaterThanOrEqual(0)
    expect(pathStageEnd).toBeGreaterThan(pathStageStart)
    expect(resolvedStageStart).toBeGreaterThanOrEqual(0)
    expect(resolvedStageEnd).toBeGreaterThan(resolvedStageStart)
    expect(pathStage).toContain('buildVectorGeometryModelPath(')
    expect(pathStage).toContain('buildPathTopologyModel({')
    expect(pathStage).toContain('__asyraVectorPathModelCache')
    expect(pathStage).toContain('__asyraVectorPathGeometryModelCount')
    expect(pathStage).toContain('__asyraVectorPathTopologyModelCount')
    expect(resolvedStage).toContain('buildResolvedVectorGeometryModel({')
    expect(resolvedStage).toContain('__asyraResolvedVectorGeometryCache')
    for (const forbiddenToken of [
      'renderSolidCenterStrokeEntries',
      'strokePathStyle',
      'strokeMaskPolygons',
      'descriptorProductPolygons',
      'buildSourceVertexJoinFootprint',
      'resolvedJoin',
      'vertexAngle',
      'angleSource',
      'miterAngle',
      'capPolicy'
    ]) {
      expect(pathStage).not.toContain(forbiddenToken)
      expect(resolvedStage).not.toContain(forbiddenToken)
    }
  })

  it('keeps shared geometry model files free of visible stroke output ownership', () => {
    const sources = [
      readFileSync(pathGeometrySourcePath, 'utf8'),
      readFileSync(pathTopologySourcePath, 'utf8'),
      readFileSync(resolvedGeometrySourcePath, 'utf8')
    ]

    for (const source of sources) {
      expectNoStrokeParameterSourceTokens(source)
      for (const forbiddenToken of [
        'renderSolidCenterStrokeEntries',
        'strokeMaskPolygons',
        'descriptorProductPolygons',
        'strokePathStyle',
        'buildSourceVertexJoinFootprint',
        'resolvedJoin',
        'vertexAngle',
        'angleSource',
        'miterAngle',
        'capPolicy'
      ]) {
        expect(source).not.toContain(forbiddenToken)
      }
    }
  })

  it('matches the stroke parameter coverage matrix for this step', () => {
    assertStrokeParameterCoverageForStep('shared-geometry-model')
  })
})
