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
import { splitTracedSegmentsByIntersections } from '../../components/stroke-render/self-intersecting-legal-domain'

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
const selfIntersectingGeometrySourcePath = resolve(
  repoRoot,
  'packages/preset/src/components/stroke-render/self-intersecting-legal-domain.ts'
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

const buildStarSharedGeometry = (
  pointOverrides: Partial<
    Record<'a' | 'b' | 'c' | 'd' | 'e', Partial<VectorPointNode>>
  > = {}
) => {
  const points = {
    a: point('a', 0, 48),
    b: point('b', 78, 48),
    c: point('c', 14, 0),
    d: point('d', 40, 86),
    e: point('e', 66, 0)
  }
  for (const [pointId, override] of Object.entries(pointOverrides)) {
    const existing = points[pointId as keyof typeof points]
    if (existing) {
      points[pointId as keyof typeof points] = { ...existing, ...override }
    }
  }
  const segments = {
    ab: segment('ab', 'a', 'b'),
    bc: segment('bc', 'b', 'c'),
    cd: segment('cd', 'c', 'd'),
    de: segment('de', 'd', 'e'),
    ea: segment('ea', 'e', 'a')
  }
  const network: VectorNetwork = {
    id: 'network:star',
    pointIds: ['a', 'b', 'c', 'd', 'e'],
    segmentIds: ['ab', 'bc', 'cd', 'de', 'ea'],
    closed: true
  }
  const path = buildVectorGeometryModelPath(network, points, segments)
  const topology = buildPathTopologyModel({
    pathId: 'vector:fixture:network:star',
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

const collectStrokePipelineCounterEvidence = (run: () => void) => {
  const totals = new Map<string, number>()
  const calls = new Map<string, number>()
  const globalRecord = globalThis as typeof globalThis & {
    __asyraStrokePipelineCounterSink?: (
      counterName: string,
      value: number
    ) => void
  }
  const previousSink = globalRecord.__asyraStrokePipelineCounterSink
  globalRecord.__asyraStrokePipelineCounterSink = (counterName, value = 1) => {
    totals.set(counterName, (totals.get(counterName) ?? 0) + value)
    calls.set(counterName, (calls.get(counterName) ?? 0) + 1)
  }
  try {
    run()
  } finally {
    globalRecord.__asyraStrokePipelineCounterSink = previousSink
  }
  return { calls, totals }
}

const collectResolvedGeometryPhaseEvidence = <T>(run: () => T) => {
  const phases: string[] = []
  const globalRecord = globalThis as typeof globalThis & {
    __asyraVectorRenderDetailPhaseSink?: (
      phaseName: string,
      durationMs: number
    ) => void
  }
  const previousSink = globalRecord.__asyraVectorRenderDetailPhaseSink
  globalRecord.__asyraVectorRenderDetailPhaseSink = (phaseName) => {
    phases.push(phaseName)
  }
  try {
    return { phases, result: run() }
  } finally {
    globalRecord.__asyraVectorRenderDetailPhaseSink = previousSink
  }
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
    expect(step?.refactorStatus).toMatch(/^(locked|active|verified)$/)
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
        'packages/preset/src/components/stroke-render/self-intersecting-legal-domain.ts',
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

  it('keeps unchanged segment and intersection caches valid across bounds rebase during anchor drag', () => {
    const initialGeometry = buildStarSharedGeometry()
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
    const draggedGeometry = buildStarSharedGeometry({
      a: { x: 3, y: 55 },
      b: { x: 66, y: 55 },
      c: { x: 2, y: 7 },
      d: { x: 28, y: 93 },
      e: { x: 54, y: 7 }
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
    ).toBe(3)
    expect(
      counters.get('resolved-geometry-source-segment-trace-cache-miss') ?? 0
    ).toBe(2)
    expect(
      counters.get('self-intersection-pair-cache-hit') ?? 0
    ).toBeGreaterThan(0)
  })

  it('aggregates pair-cache diagnostics once while preserving incremental geometry', () => {
    const initialGeometry = buildStarSharedGeometry()
    const initialModel = buildResolvedVectorGeometryModel({
      modelId: 'vector:fixture:resolved-geometry:aggregate-counters',
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
    const draggedGeometry = buildStarSharedGeometry({
      a: { x: 3, y: 55 },
      b: { x: 66, y: 55 },
      c: { x: 2, y: 7 },
      d: { x: 28, y: 93 },
      e: { x: 54, y: 7 }
    })
    const draggedNetworks = [
      {
        networkId: draggedGeometry.network.id,
        path: draggedGeometry.path,
        topology: draggedGeometry.topology
      }
    ]
    const fullModel = buildResolvedVectorGeometryModel({
      modelId: 'vector:fixture:resolved-geometry:aggregate-counters',
      fillRule: 'evenodd',
      networks: draggedNetworks,
      resolveSelfIntersecting: true
    })
    let cachedModel:
      | ReturnType<typeof buildResolvedVectorGeometryModel>
      | undefined
    const evidence = collectStrokePipelineCounterEvidence(() => {
      cachedModel = buildResolvedVectorGeometryModel({
        modelId: 'vector:fixture:resolved-geometry:aggregate-counters',
        fillRule: 'evenodd',
        networks: draggedNetworks,
        resolveSelfIntersecting: true,
        previousCache: initialModel.cache
      })
    })

    expect(cachedModel?.networks[0]?.selfIntersecting).toEqual(
      fullModel.networks[0]?.selfIntersecting
    )
    for (const counterName of [
      'self-intersection-pair-cache-hit',
      'self-intersection-pair-cache-miss'
    ]) {
      expect(evidence.totals.get(counterName) ?? 0).toBeGreaterThan(0)
      expect(evidence.calls.get(counterName)).toBe(1)
    }

    const crossingSegments = [
      {
        start: { x: 0, y: 0 },
        end: { x: 10, y: 10 },
        sourceSegmentIndex: 0,
        sourceStartDistance: 0,
        sourceEndDistance: 10
      },
      {
        start: { x: 0, y: 10 },
        end: { x: 10, y: 0 },
        sourceSegmentIndex: 1,
        sourceStartDistance: 0,
        sourceEndDistance: 10
      },
      {
        start: { x: 5, y: -2 },
        end: { x: 5, y: 12 },
        sourceSegmentIndex: 2,
        sourceStartDistance: 0,
        sourceEndDistance: 14
      }
    ]
    const initialSplit = splitTracedSegmentsByIntersections(crossingSegments, {
      returnCache: true,
      segmentSignatures: ['a', 'b', 'c']
    })
    const reorderedSegments = [
      crossingSegments[2],
      crossingSegments[0],
      crossingSegments[1]
    ]
    const signatureEvidence = collectStrokePipelineCounterEvidence(() => {
      splitTracedSegmentsByIntersections(reorderedSegments, {
        returnCache: true,
        segmentSignatures: ['c', 'a', 'b'],
        previousCache: initialSplit.cache
      })
    })
    expect(
      signatureEvidence.totals.get('self-intersection-pair-cache-signature-hit')
    ).toBe(3)
    expect(
      signatureEvidence.calls.get('self-intersection-pair-cache-signature-hit')
    ).toBe(1)
    expect(
      signatureEvidence.totals.get('self-intersection-pair-cache-hit')
    ).toBe(3)
    expect(
      signatureEvidence.calls.get('self-intersection-pair-cache-hit')
    ).toBe(1)

    const consecutiveEvidence = collectStrokePipelineCounterEvidence(() => {
      const splitSegments = splitTracedSegmentsByIntersections([
        {
          start: { x: 0, y: 0 },
          end: { x: 10, y: 0 },
          sourceSegmentIndex: 0,
          sourceStartDistance: 0,
          sourceEndDistance: 10
        },
        {
          start: { x: 10, y: 0 },
          end: { x: 20, y: 0 },
          sourceSegmentIndex: 0,
          sourceStartDistance: 10,
          sourceEndDistance: 20
        }
      ])
      expect(splitSegments).toHaveLength(2)
    })
    expect(
      consecutiveEvidence.totals.get(
        'self-intersection-consecutive-pair-skipped'
      )
    ).toBe(1)
    expect(
      consecutiveEvidence.calls.get(
        'self-intersection-consecutive-pair-skipped'
      )
    ).toBe(1)
  })

  it('reports source split cache-key and materialization cost separately', () => {
    const resolvedSource = readFileSync(resolvedGeometrySourcePath, 'utf8')
    const selfIntersectingSource = readFileSync(
      selfIntersectingGeometrySourcePath,
      'utf8'
    )

    expect(resolvedSource).toContain(
      'resolved self-intersecting geometry: source split range cache key'
    )
    expect(resolvedSource).toContain(
      'resolved self-intersecting geometry: source split range materialization'
    )
    expect(selfIntersectingSource).toContain('pairCacheHitCount')
    expect(selfIntersectingSource).toContain('pairCacheMissCount')
    expect(selfIntersectingSource).toContain('consecutivePairSkippedCount')
  })

  it('attributes source split materialization while preserving cache bypass output', () => {
    const geometry = buildStarSharedGeometry()
    const networks = [
      {
        networkId: geometry.network.id,
        path: geometry.path,
        topology: geometry.topology
      }
    ]
    const buildModel = () =>
      buildResolvedVectorGeometryModel({
        modelId: 'vector:fixture:resolved-geometry:source-split-attribution',
        fillRule: 'evenodd',
        networks,
        resolveSelfIntersecting: true
      })
    const cacheMiss = collectResolvedGeometryPhaseEvidence(buildModel)
    const cacheHit = collectResolvedGeometryPhaseEvidence(buildModel)
    const materializationPhases = [
      'resolved self-intersecting geometry: source split range cache lookup',
      'resolved self-intersecting geometry: source split range setup',
      'resolved self-intersecting geometry: source split range boundary role index',
      'resolved self-intersecting geometry: source split range legal face materialization',
      'resolved self-intersecting geometry: source split range contour merge',
      'resolved self-intersecting geometry: source split range finalize',
      'resolved self-intersecting geometry: source split range cache store'
    ]

    expect(cacheMiss.phases).toEqual(
      expect.arrayContaining(materializationPhases)
    )
    expect(cacheHit.phases).toContain(materializationPhases[0])
    materializationPhases.slice(1).forEach((phaseName) => {
      expect(cacheHit.phases).not.toContain(phaseName)
    })
    expect(cacheHit.result.networks[0]?.selfIntersecting).toEqual(
      cacheMiss.result.networks[0]?.selfIntersecting
    )
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

  it('keeps required resolved geometry timing independent from detailed diagnostics', () => {
    const vectorSource = readFileSync(vectorSourcePath, 'utf8')
    const phaseHelperStart = vectorSource.indexOf(
      'const measureVectorRenderPhase'
    )
    const phaseHelperEnd = vectorSource.indexOf(
      'const emitStrokePipelineCounter',
      phaseHelperStart
    )
    const phaseHelper = vectorSource.slice(phaseHelperStart, phaseHelperEnd)

    expect(phaseHelperStart).toBeGreaterThanOrEqual(0)
    expect(phaseHelperEnd).toBeGreaterThan(phaseHelperStart)
    expect(phaseHelper).toContain('__asyraVectorRenderPhaseSink')
    expect(phaseHelper).toContain('__asyraResolvedVectorGeometryPhaseSink')
    expect(phaseHelper).toContain(
      "phaseName === 'resolved vector geometry model'"
    )
    expect(phaseHelper).toContain('diagnosticSink ?? requiredEvidenceSink')
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
