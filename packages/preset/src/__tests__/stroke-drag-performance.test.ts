import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { BehaviorSubject, Subscription } from 'rxjs'
import { Container } from 'pixi.js'
import Clipper2ZFactory from 'clipper2-wasm'
import core, { renderStrategyRegistry } from '@asyra/core'
import {
  StrokeCapTypes,
  StrokeJoinTypes,
  StrokePositions,
  StrokeStyles,
  createDefaultStroke
} from '@asyra/utils'
import { applyPreset } from '../preset'
import type { PresetDependencies } from '../types'
import {
  REPORTED_ROUND_INSIDE_DASHED_STAR_NETWORK_ID,
  REPORTED_VECTOR_10_INSIDE_DASHED_NETWORK_ID,
  createReportedRoundInsideDashedStarVectorData,
  createReportedVector10InsideDashedDragData
} from './inside-dashed-fixtures'
import {
  registerGeometryBackend,
  selectGeometryBackend
} from '../components/stroke-render/geometry-backend'
import type { SolidCenterStrokeGeometryDebugMeta } from '../components/stroke-render/solid-center-stroke-packets'
import type { SolidCenterStrokeRenderEntry } from '../components/stroke-render/solid-center-stroke-render'
import {
  createClipper2GeometryBackend,
  type Clipper2Module
} from '../components/stroke-render/clipper2-geometry-backend'

const FRAME_COUNT = Number(process.env.ASYRA_STROKE_DRAG_FRAMES ?? 120)
const WARMUP_FRAMES = Math.min(20, Math.max(0, Math.floor(FRAME_COUNT / 10)))
const CPU_PROFILE_RENDER_BUDGET_MS = 8.33
const SHOULD_ENFORCE_CPU_PROFILE_BUDGET =
  process.env.ASYRA_STROKE_DRAG_ENFORCE_CPU_BUDGET === '1'
const SHOULD_ENFORCE_CPU_PROFILE_P95_BUDGET =
  process.env.ASYRA_STROKE_DRAG_ENFORCE_CPU_P95_BUDGET === '1'
const SCENARIO_FILTER = process.env.ASYRA_STROKE_DRAG_SCENARIO_FILTER
const METRICS_FILE = process.env.ASYRA_STROKE_DRAG_METRICS_FILE
const SHOULD_INCLUDE_PROFILE_COUNTERS =
  process.env.ASYRA_STROKE_DRAG_PROFILE_COUNTERS === '1'
const SHOULD_RUN_STROKE_DRAG_PROFILE =
  process.env.ASYRA_STROKE_DRAG_PROFILE === '1'
const describeProfile = describe
const PERFORMANCE_MEASUREMENT_SCOPE = 'cpu-only'
const RENDERER_COVERAGE = 'fake'
const DOES_NOT_MEASURE_RENDERER = true
const require = createRequire(import.meta.url)
const clipperWasmPath = require.resolve('clipper2-wasm/dist/umd/clipper2z.wasm')
const CLIPPER_STROKE_DRAG_TEST_BACKEND_ID = 'stroke-drag-clipper2-test'
const REMOVED_CENTER_SOLID_PACKET_SKIP_COUNTER = [
  'center',
  'product',
  'solid',
  'visible',
  'packet',
  'skip'
].join('-')
const REMOVED_PATH_MASK_CENTER_SOLID_PACKET_SKIP_COUNTER = [
  'path',
  'mask',
  'center',
  'solid',
  'visible',
  'packet',
  'skip'
].join('-')

const loadClipperModule = async () =>
  (await (
    Clipper2ZFactory as (options: {
      wasmBinary: Uint8Array
    }) => Promise<Clipper2Module>
  )({
    wasmBinary: readFileSync(clipperWasmPath)
  })) as Clipper2Module

beforeAll(async () => {
  HTMLCanvasElement.prototype.getContext =
    HTMLCanvasElement.prototype.getContext ?? (() => null)

  const systemPropertyMap = new Map<string, BehaviorSubject<unknown>>()
  const presetDeps = {
    sceneTree: {
      getElementById: () => undefined
    },
    systemContext: {
      getManagedProperty: () => undefined,
      getSystemContextSnapshot: () => ({
        primaryTool: 'pen',
        mousePosition: { x: 0, y: 0 }
      })
    },
    render: {
      getViewportPosition: () => ({ x: 0, y: 0 }),
      getViewportScale: () => 1,
      getMousePosInWorkspace: () => ({ x: 0, y: 0 }),
      zoomTo: () => undefined,
      panTo: () => undefined
    }
  } as unknown as PresetDependencies

  applyPreset(
    {
      registerEvent: (event: string | { eventName: string }) => ({
        eventName: typeof event === 'string' ? event : event.eventName,
        publish: () => undefined,
        subscribe: () => new Subscription()
      }),
      registerDataChannelObserver: () => undefined,
      getPresetDependencies: () => presetDeps,
      registerRenderLayer: () => undefined,
      registerPropertySchema: () => undefined,
      defineSelection: () => undefined,
      getSelection: () => undefined,
      defineUIProperty: () => undefined,
      defineSystemProperty: <T>(key: string, defaultValue: T) => {
        const existing = systemPropertyMap.get(key)
        if (existing) {
          return existing as BehaviorSubject<T>
        }

        const state = new BehaviorSubject<T>(defaultValue)
        systemPropertyMap.set(key, state as BehaviorSubject<unknown>)
        return state
      },
      getSystemPropertyObservable: <T>(key: string) =>
        systemPropertyMap.get(key) as BehaviorSubject<T> | undefined,
      createRenderGradientFillStyle: () => null as never
    },
    presetDeps
  )

  core.defineSystemProperty<string | null>('pathEditingVectorId', null)
  core.defineSystemProperty<boolean>('pathEditingMode', false)
  core.defineSystemProperty<boolean>('mouseDragging', false)
  core.defineSystemProperty<boolean>('mouseDown', false)
  core.defineSystemProperty<boolean>(
    'strokeDebugDisableVisualOverlapCollapse',
    false
  )
  const backend = createClipper2GeometryBackend(await loadClipperModule(), {
    backendId: CLIPPER_STROKE_DRAG_TEST_BACKEND_ID,
    backendVersion: `${CLIPPER_STROKE_DRAG_TEST_BACKEND_ID}@test`
  })
  registerGeometryBackend({
    backendId: CLIPPER_STROKE_DRAG_TEST_BACKEND_ID,
    load: () => backend
  })
  selectGeometryBackend(CLIPPER_STROKE_DRAG_TEST_BACKEND_ID)
})

class RecordingVectorGraphic extends Container {
  __asyraSolidCenterStrokeExportPackets?: unknown[]
  __asyraCenterPathSolidStrokeRenderCount?: number
  __asyraCenterSolidPathMaskRenderCount?: number
  __asyraConstrainedDashedProductNetworkIds?: string[]
  __asyraStrokeRenderFaceDebugMetas?: SolidCenterStrokeGeometryDebugMeta[]
  __asyraStrokeRenderEntries?: SolidCenterStrokeRenderEntry[]
  __asyraStrokeMeshCache?: Map<string, { kind?: string }>
  __asyraVectorPathModelCache?: {
    entries: Map<
      string,
      {
        revision: { key: string }
        model: { path: { sampledPoints: unknown[] } }
      }
    >
  }
  hitArea?: { contains: (x: number, y: number) => boolean } | null

  clear() {
    return this
  }

  moveTo() {
    return this
  }

  lineTo() {
    return this
  }

  bezierCurveTo() {
    return this
  }

  closePath() {
    return this
  }

  cut() {
    return this
  }

  fill() {
    return this
  }
}

const renderVectorFrame = (
  graphic: RecordingVectorGraphic,
  data: Record<string, unknown>,
  stroke: ReturnType<typeof createDefaultStroke>
) => {
  const strategy = renderStrategyRegistry.get('vector')
  expect(strategy).toBeTypeOf('function')
  ;(
    strategy as unknown as (
      target: RecordingVectorGraphic,
      data: Record<string, unknown>
    ) => void
  )(graphic, {
    ...data,
    strokes: [stroke]
  })
}

const renderVectorFrameWithDataStrokes = (
  graphic: RecordingVectorGraphic,
  data: Record<string, unknown>
) => {
  const strategy = renderStrategyRegistry.get('vector')
  expect(strategy).toBeTypeOf('function')
  ;(
    strategy as unknown as (
      target: RecordingVectorGraphic,
      data: Record<string, unknown>
    ) => void
  )(graphic, data)
}

const setPathEditingState = ({
  vectorId,
  mouseDragging,
  mouseDown
}: {
  vectorId: string | null
  mouseDragging: boolean
  mouseDown: boolean
}) => {
  core.setSystemProperty('pathEditingVectorId', vectorId)
  core.setSystemProperty('pathEditingMode', vectorId !== null)
  core.setSystemProperty('mouseDragging', mouseDragging)
  core.setSystemProperty('mouseDown', mouseDown)
}

const clearInteractionState = () => {
  core.setSystemProperty('pathEditingVectorId', null)
  core.setSystemProperty('pathEditingMode', false)
  core.setSystemProperty('mouseDragging', false)
  core.setSystemProperty('mouseDown', false)
}

const getStrokeCacheEntries = (graphic: RecordingVectorGraphic) =>
  Array.from(graphic.__asyraStrokeMeshCache?.entries() ?? [])

const getConstrainedDashedProductNetworkIds = (
  graphic: RecordingVectorGraphic
) => new Set(graphic.__asyraConstrainedDashedProductNetworkIds ?? [])

const expectConstrainedDashedProductNetworks = (
  graphic: RecordingVectorGraphic,
  expectedNetworkIds: string[]
) => {
  const actualNetworkIds = getConstrainedDashedProductNetworkIds(graphic)
  expectedNetworkIds.forEach((networkId) => {
    expect(Array.from(actualNetworkIds)).toContain(networkId)
  })
}

const expectConstrainedDashedProductContract = (
  graphic: RecordingVectorGraphic,
  networkId: string
) => {
  const productMetas = (graphic.__asyraStrokeRenderFaceDebugMetas ?? []).filter(
    (meta) =>
      meta.productSignature?.startsWith('constrained-dashed:') === true &&
      meta.networkId === networkId
  )
  const invalidMetas = productMetas.filter(
    (meta) =>
      meta.domainPlanDomainMode !== 'closed-constrained-domain' ||
      meta.domainPlanSplitRangeId?.startsWith(
        'closed-constrained-source-domain:'
      ) === true ||
      meta.dashEndpointCapPolicySignature === undefined ||
      meta.joinOwnershipSignature === undefined ||
      meta.smoothContinuityGroupId === undefined
  )

  if (productMetas.length === 0 || invalidMetas.length > 0) {
    throw new Error(
      `Expected constrained dashed product contract for ${networkId}. Product metas: ${JSON.stringify(
        productMetas.map((meta) => ({
          intervalId: meta.intervalId,
          splitRangeId: meta.domainPlanSplitRangeId,
          domainMode: meta.domainPlanDomainMode,
          selectedSide: meta.domainPlanSelectedSide,
          boundaryRole: meta.domainPlanBoundaryRole,
          terminalRole: meta.domainPlanTerminalRole,
          endpointCapPolicy: meta.dashEndpointCapPolicySignature,
          joinOwnership: meta.joinOwnershipSignature,
          smoothGroup: meta.smoothContinuityGroupId,
          sourceSegmentIndex: meta.domainPlanSplitRangeSourceSegmentIndex
        })),
        null,
        2
      )}`
    )
  }
}

const getConstrainedDashedProductContractSignature = (
  graphic: RecordingVectorGraphic
) =>
  (graphic.__asyraStrokeRenderFaceDebugMetas ?? [])
    .filter(
      (meta) =>
        meta.productSignature?.startsWith('constrained-dashed:') === true
    )
    .map((meta) => ({
      networkId: meta.networkId,
      intervalId: meta.intervalId,
      strokePosition: meta.strokePosition,
      strokeWidth: meta.strokeWidth,
      strokeJoin: meta.strokeJoin,
      strokeCap: meta.strokeCap,
      domainMode: meta.domainPlanDomainMode,
      splitRangeId: meta.domainPlanSplitRangeId,
      selectedSide: meta.domainPlanSelectedSide,
      boundaryRole: meta.domainPlanBoundaryRole,
      terminalRole: meta.domainPlanTerminalRole,
      endpointCapPolicy: meta.dashEndpointCapPolicySignature,
      joinOwnership: meta.joinOwnershipSignature,
      smoothGroup: meta.smoothContinuityGroupId,
      sourceSegmentIndex: meta.domainPlanSplitRangeSourceSegmentIndex,
      terminalRecords: meta.domainPlanSplitRangeTerminals?.map((terminal) => ({
        role: terminal.terminalRole,
        sourceSegmentIndex: terminal.sourceSegmentIndex
      }))
    }))
    .sort((a, b) =>
      [
        a.networkId,
        a.splitRangeId,
        a.intervalId,
        a.terminalRole,
        String(a.selectedSide)
      ]
        .join('|')
        .localeCompare(
          [
            b.networkId,
            b.splitRangeId,
            b.intervalId,
            b.terminalRole,
            String(b.selectedSide)
          ].join('|')
        )
    )

const isConstrainedDashedStroke = (
  stroke: ReturnType<typeof createDefaultStroke>
) =>
  stroke.style === StrokeStyles.DASHED &&
  (stroke.position === StrokePositions.INSIDE ||
    stroke.position === StrokePositions.OUTSIDE) &&
  stroke.width > 0

const getRequiredConstrainedDashedNetworkIds = (
  data: Record<string, unknown>,
  stroke: ReturnType<typeof createDefaultStroke>
) => {
  if (!isConstrainedDashedStroke(stroke)) {
    return []
  }

  const networks = Object.values(
    (data.networks ?? {}) as Record<
      string,
      { id: string; closed?: boolean; segmentIds?: string[] }
    >
  )
  return networks
    .filter(
      (network) =>
        network.closed === true ||
        (network.closed === false && (network.segmentIds?.length ?? 0) >= 3)
    )
    .map((network) => network.id)
}

const hasRequiredConstrainedDashedNetworkOutput = (
  graphic: RecordingVectorGraphic,
  data: Record<string, unknown>,
  stroke: ReturnType<typeof createDefaultStroke>
) => {
  if (!isConstrainedDashedStroke(stroke)) {
    return true
  }

  const actualNetworkIds = getConstrainedDashedProductNetworkIds(graphic)
  return getRequiredConstrainedDashedNetworkIds(data, stroke).every(
    (networkId) => actualNetworkIds.has(networkId)
  )
}

const hasCurrentStrokeProductOutput = (graphic: RecordingVectorGraphic) =>
  (graphic.__asyraCenterPathSolidStrokeRenderCount ?? 0) > 0 ||
  (graphic.__asyraCenterSolidPathMaskRenderCount ?? 0) > 0 ||
  (graphic.__asyraConstrainedDashedProductNetworkIds?.length ?? 0) > 0 ||
  (graphic.__asyraStrokeRenderFaceDebugMetas?.length ?? 0) > 0 ||
  (graphic.__asyraStrokeRenderEntries?.length ?? 0) > 0 ||
  getStrokeCacheEntries(graphic).some(
    ([, entry]) =>
      entry.kind === 'solid' ||
      entry.kind === 'gradient' ||
      entry.kind === 'masked-solid' ||
      entry.kind === 'solid-graphics'
  )

interface TestPoint {
  x: number
  y: number
}

const toLocalTestPoint = (
  point: TestPoint,
  data: Record<string, unknown>
): TestPoint => ({
  x: point.x - Number(data.x ?? 0),
  y: point.y - Number(data.y ?? 0)
})

const cubicTestPoint = (
  start: TestPoint,
  outControl: TestPoint,
  inControl: TestPoint,
  end: TestPoint,
  t: number
): TestPoint => {
  const mt = 1 - t
  return {
    x:
      mt * mt * mt * start.x +
      3 * mt * mt * t * outControl.x +
      3 * mt * t * t * inControl.x +
      t * t * t * end.x,
    y:
      mt * mt * mt * start.y +
      3 * mt * mt * t * outControl.y +
      3 * mt * t * t * inControl.y +
      t * t * t * end.y
  }
}

const sampleReportedSegmentPoint = (
  data: Record<string, unknown>,
  segment: {
    startId: string
    endId: string
    outControlId?: string | null
    inControlId?: string | null
  },
  t: number
) => {
  const points = data.points as Record<string, TestPoint | undefined>
  const start = points[segment.startId]
  const end = points[segment.endId]
  if (!start || !end) {
    return null
  }

  const outControl =
    (segment.outControlId ? points[segment.outControlId] : undefined) ?? start
  const inControl =
    (segment.inControlId ? points[segment.inControlId] : undefined) ?? end
  const hasCurve =
    (segment.outControlId !== null && segment.outControlId !== undefined) ||
    (segment.inControlId !== null && segment.inControlId !== undefined)
  const worldPoint = hasCurve
    ? cubicTestPoint(start, outControl, inControl, end, t)
    : {
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t
      }

  return toLocalTestPoint(worldPoint, data)
}

const isPointInPolygon = (point: TestPoint, polygon: TestPoint[]) => {
  let inside = false
  for (
    let index = 0, previousIndex = polygon.length - 1;
    index < polygon.length;
    previousIndex = index, index += 1
  ) {
    const current = polygon[index]
    const previous = polygon[previousIndex]
    if (!current || !previous) {
      continue
    }
    const intersects =
      current.y > point.y !== previous.y > point.y &&
      point.x <
        ((previous.x - current.x) * (point.y - current.y)) /
          (previous.y - current.y || Number.EPSILON) +
          current.x
    if (intersects) {
      inside = !inside
    }
  }
  return inside
}

const hasProductGeometryNearLocalPoint = (
  polygons: TestPoint[][],
  point: TestPoint,
  radius: number
) => {
  for (let y = -radius; y <= radius; y += 2) {
    for (let x = -radius; x <= radius; x += 2) {
      const probe = { x: point.x + x, y: point.y + y }
      if (polygons.some((polygon) => isPointInPolygon(probe, polygon))) {
        return true
      }
    }
  }
  return false
}

const getTestPointBounds = (points: TestPoint[]) => {
  if (points.length === 0) {
    return null
  }
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  points.forEach((point) => {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  })
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  }
}

const getPolygonBoundsForTest = (polygons: TestPoint[][]) =>
  getTestPointBounds(polygons.flat())

const getConstrainedDashedProductSourceSegmentIndexes = (
  graphic: RecordingVectorGraphic,
  networkId: string
) => {
  const indexes = new Set<number>()
  ;(graphic.__asyraStrokeRenderFaceDebugMetas ?? []).forEach((meta) => {
    if (
      meta.networkId !== networkId ||
      meta.productSignature?.startsWith('constrained-dashed:') !== true
    ) {
      return
    }
    if (typeof meta.domainPlanSplitRangeSourceSegmentIndex === 'number') {
      indexes.add(meta.domainPlanSplitRangeSourceSegmentIndex)
    }
    meta.productSourceSegmentIndexes?.forEach((index) => {
      indexes.add(index)
    })
    meta.domainPlanSplitRangeTerminals?.forEach((terminal) => {
      if (typeof terminal.sourceSegmentIndex === 'number') {
        indexes.add(terminal.sourceSegmentIndex)
      }
    })
  })
  return indexes
}

const analyzeReportedInsideDashedRenderEntrySegmentCoverage = (
  graphic: RecordingVectorGraphic,
  data: Record<string, unknown>,
  networkId: string
) => {
  const network = (
    data.networks as Record<
      string,
      { segmentIds: string[]; id: string } | undefined
    >
  )[networkId]
  const segments = data.segments as Record<
    string,
    | {
        id: string
        startId: string
        endId: string
        outControlId?: string | null
        inControlId?: string | null
      }
    | undefined
  >
  const productPolygons = (graphic.__asyraStrokeRenderEntries ?? [])
    .filter(
      (entry) =>
        entry.debugMeta?.networkId === networkId &&
        entry.debugMeta?.productSignature?.startsWith('constrained-dashed:') ===
          true
    )
    .flatMap((entry) => entry.polygons as TestPoint[][])
  const segmentCoverages = (network?.segmentIds ?? []).map((segmentId) => {
    const segment = segments[segmentId]
    let coveredSamples = 0
    let sampleCount = 0
    if (segment) {
      for (let index = 0; index <= 30; index += 1) {
        const t = index / 30
        if (t < 0.04 || t > 0.96) {
          continue
        }
        const point = sampleReportedSegmentPoint(data, segment, t)
        if (!point) {
          continue
        }
        sampleCount += 1
        if (hasProductGeometryNearLocalPoint(productPolygons, point, 14)) {
          coveredSamples += 1
        }
      }
    }
    return {
      id: segmentId,
      coveredSamples,
      sampleCount,
      recall: sampleCount === 0 ? 0 : coveredSamples / sampleCount
    }
  })
  const expectedLocalPoints = (network?.segmentIds ?? []).flatMap(
    (segmentId) => {
      const segment = segments[segmentId]
      if (!segment) {
        return []
      }
      const points: TestPoint[] = []
      for (let index = 0; index <= 40; index += 1) {
        const point = sampleReportedSegmentPoint(data, segment, index / 40)
        if (point) {
          points.push(point)
        }
      }
      return points
    }
  )

  return {
    productPolygonCount: productPolygons.length,
    productBounds: getPolygonBoundsForTest(productPolygons),
    expectedLocalBounds: getTestPointBounds(expectedLocalPoints),
    segmentCoverages,
    coveredSegmentCount: segmentCoverages.filter(
      (segment) => segment.coveredSamples > 0
    ).length,
    worstSegmentRecall: Math.min(
      ...segmentCoverages.map((segment) => segment.recall)
    )
  }
}

const getPathModelSampleCount = (graphic: RecordingVectorGraphic) =>
  Array.from(
    graphic.__asyraVectorPathModelCache?.entries.values() ?? []
  ).reduce((total, entry) => total + entry.model.path.sampledPoints.length, 0)

const getPathModelRevisionKeys = (graphic: RecordingVectorGraphic) =>
  Array.from(graphic.__asyraVectorPathModelCache?.entries.values() ?? []).map(
    (entry) => entry.revision.key
  )

const expectFullStrokeRenderCache = (graphic: RecordingVectorGraphic) => {
  const cacheEntries = getStrokeCacheEntries(graphic)
  expect(cacheEntries.length).toBeGreaterThan(0)
  expect(
    cacheEntries.every(([, entry]) =>
      ['solid', 'gradient', 'masked-solid', 'solid-graphics'].includes(
        entry.kind
      )
    )
  ).toBe(true)
}

const collectRenderPhases = (callback: () => void) => {
  const phases = new Set<string>()
  ;(
    globalThis as typeof globalThis & {
      __asyraVectorRenderPhaseSink?: (
        phaseName: string,
        durationMs: number
      ) => void
    }
  ).__asyraVectorRenderPhaseSink = (phaseName) => {
    phases.add(phaseName)
  }
  try {
    callback()
  } finally {
    ;(
      globalThis as typeof globalThis & {
        __asyraVectorRenderPhaseSink?: (
          phaseName: string,
          durationMs: number
        ) => void
      }
    ).__asyraVectorRenderPhaseSink = undefined
  }
  return phases
}

const collectStrokePipelineCounters = (callback: () => void) => {
  const counters: Record<string, number> = {}
  ;(
    globalThis as typeof globalThis & {
      __asyraStrokePipelineCounterSink?: (
        counterName: string,
        value: number
      ) => void
    }
  ).__asyraStrokePipelineCounterSink = (counterName, value) => {
    counters[counterName] = (counters[counterName] ?? 0) + value
  }
  try {
    callback()
  } finally {
    ;(
      globalThis as typeof globalThis & {
        __asyraStrokePipelineCounterSink?: (
          counterName: string,
          value: number
        ) => void
      }
    ).__asyraStrokePipelineCounterSink = undefined
  }
  return counters
}

const collectStrokePipelineTraces = (callback: () => void) => {
  const traces: { eventName: string; payload: Record<string, unknown> }[] = []
  const target = globalThis as typeof globalThis & {
    __asyraStrokePipelineTraceSink?: (
      eventName: string,
      payload: Record<string, unknown>
    ) => void
  }
  const previousSink = target.__asyraStrokePipelineTraceSink
  target.__asyraStrokePipelineTraceSink = (eventName, payload) => {
    traces.push({ eventName, payload })
    previousSink?.(eventName, payload)
  }

  try {
    callback()
  } finally {
    target.__asyraStrokePipelineTraceSink = previousSink
  }

  return traces
}

const getPercentile = (values: number[], percentile: number) => {
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * percentile) - 1)
  )
  return sorted[index] ?? 0
}

const createStroke = (
  capType: 'butt' | 'square' | 'round',
  position: StrokePositions = StrokePositions.INSIDE
) =>
  createDefaultStroke({
    id: `drag-${position}-dashed-${capType}`,
    width: 10,
    style: StrokeStyles.DASHED,
    position,
    capType,
    dashPattern: [20, 20],
    dashOffset: 0,
    color: '#d51a1a'
  })

const createCenterSolidStroke = (opacity = 1) =>
  createDefaultStroke({
    id: 'drag-center-solid',
    width: 10,
    style: StrokeStyles.SOLID,
    position: StrokePositions.CENTER,
    capType: StrokeCapTypes.ROUND,
    opacity,
    color: '#d51a1a'
  })

const createConstrainedSolidStroke = (position: StrokePositions) =>
  createDefaultStroke({
    id: `drag-${position}-solid`,
    width: 10,
    style: StrokeStyles.SOLID,
    position,
    capType: StrokeCapTypes.ROUND,
    joinType: StrokeJoinTypes.ROUND,
    color: '#d51a1a',
    opacity: 0.5
  })

const createMixedPerNetworkInsideDashedData = () => {
  const base = createReportedRoundInsideDashedStarVectorData()
  return {
    ...base,
    id: 'multi-network-inside-dashed-drag',
    width: 760,
    height: 640,
    points: {
      ...base.points,
      'secondary-rect-a': {
        id: 'secondary-rect-a',
        kind: 'anchor',
        x: 540,
        y: 80,
        anchorType: 'sharp'
      },
      'secondary-rect-b': {
        id: 'secondary-rect-b',
        kind: 'anchor',
        x: 720,
        y: 80,
        anchorType: 'sharp'
      },
      'secondary-rect-c': {
        id: 'secondary-rect-c',
        kind: 'anchor',
        x: 720,
        y: 240,
        anchorType: 'sharp'
      },
      'secondary-rect-d': {
        id: 'secondary-rect-d',
        kind: 'anchor',
        x: 540,
        y: 240,
        anchorType: 'sharp'
      }
    },
    segments: {
      ...base.segments,
      'secondary-rect-ab': {
        id: 'secondary-rect-ab',
        startId: 'secondary-rect-a',
        endId: 'secondary-rect-b',
        outControlId: null,
        inControlId: null
      },
      'secondary-rect-bc': {
        id: 'secondary-rect-bc',
        startId: 'secondary-rect-b',
        endId: 'secondary-rect-c',
        outControlId: null,
        inControlId: null
      },
      'secondary-rect-cd': {
        id: 'secondary-rect-cd',
        startId: 'secondary-rect-c',
        endId: 'secondary-rect-d',
        outControlId: null,
        inControlId: null
      },
      'secondary-rect-da': {
        id: 'secondary-rect-da',
        startId: 'secondary-rect-d',
        endId: 'secondary-rect-a',
        outControlId: null,
        inControlId: null
      }
    },
    networks: {
      ...base.networks,
      'secondary-rect-network': {
        id: 'secondary-rect-network',
        pointIds: [
          'secondary-rect-a',
          'secondary-rect-b',
          'secondary-rect-c',
          'secondary-rect-d'
        ],
        segmentIds: [
          'secondary-rect-ab',
          'secondary-rect-bc',
          'secondary-rect-cd',
          'secondary-rect-da'
        ],
        closed: true
      }
    },
    strokes: [
      createDefaultStroke({
        id: 'multi-network-inside-dashed-stroke',
        width: 10,
        style: StrokeStyles.DASHED,
        position: StrokePositions.INSIDE,
        capType: StrokeCapTypes.ROUND,
        dashPattern: [20, 20],
        dashOffset: 0,
        color: '#d51a1a',
        opacity: 0.5,
        joinType: 'round'
      })
    ]
  }
}

const createOpenSelfIntersectingDashedStarVectorData = () => {
  const base = createReportedRoundInsideDashedStarVectorData()
  const network = base.networks[REPORTED_ROUND_INSIDE_DASHED_STAR_NETWORK_ID]

  return {
    ...base,
    id: 'open-self-intersecting-dashed-drag',
    networks: {
      [network.id]: {
        ...network,
        pointIds: ['tp-49', 'tp-50', 'tp-51', 'tp-52', 'tp-48'],
        segmentIds: ['ts-82', 'ts-83', 'ts-84', 'ts-85'],
        closed: false
      }
    },
    closed: false
  }
}

const mutateDragFrame = (
  frame: number,
  kind: 'anchor' | 'in-control' | 'out-control',
  pathKind: 'closed' | 'open-self-intersecting' = 'closed'
) => {
  const base =
    pathKind === 'open-self-intersecting'
      ? createOpenSelfIntersectingDashedStarVectorData()
      : createReportedRoundInsideDashedStarVectorData()
  const deltaX = Math.sin(frame / 7) * 18
  const deltaY = Math.cos(frame / 9) * 14
  const points = { ...base.points } as Record<
    string,
    { x: number; y: number } & Record<string, unknown>
  >

  if (kind === 'anchor') {
    ;(['tp-52', 'tp-52:in', 'tp-52:out'] as const).forEach((pointId) => {
      points[pointId] = {
        ...points[pointId],
        x: points[pointId].x + deltaX,
        y: points[pointId].y + deltaY
      }
    })
  } else {
    const pointId = kind === 'in-control' ? 'tp-52:in' : 'tp-52:out'
    points[pointId] = {
      ...points[pointId],
      x: points[pointId].x + deltaX,
      y: points[pointId].y + deltaY
    }
  }

  return {
    ...base,
    id: `drag-profile:${pathKind}:${kind}`,
    points,
    strokeDebugOptions: {
      disableVisualOverlapCollapse: false
    }
  }
}

const measureDragScenario = (
  label: string,
  kind: 'anchor' | 'in-control' | 'out-control',
  stroke: ReturnType<typeof createDefaultStroke>,
  pathKind: 'closed' | 'open-self-intersecting' = 'closed'
) => {
  const strategy = renderStrategyRegistry.get('vector')
  expect(strategy).toBeTypeOf('function')

  const graphic = new RecordingVectorGraphic()
  core.setSystemProperty(
    'pathEditingVectorId',
    `drag-profile:${pathKind}:${kind}`
  )
  core.setSystemProperty('pathEditingMode', true)
  core.setSystemProperty('mouseDragging', true)
  core.setSystemProperty('mouseDown', true)

  const frameTimes: number[] = []
  let incompleteFrameCount = 0
  const phaseTotals: Record<string, number> = {}
  const phaseFrameSamples: Record<string, number[]> = {}
  const counters: Record<string, number> = {}
  let currentFramePhaseTotals: Record<string, number> | null = null
  let measuredPhaseFrameCount = 0
  let shouldRecordCounters = false
  const phaseSink = (phaseName: string, durationMs: number) => {
    if (measuredPhaseFrameCount <= 0) {
      return
    }
    phaseTotals[phaseName] = (phaseTotals[phaseName] ?? 0) + durationMs
    if (currentFramePhaseTotals) {
      currentFramePhaseTotals[phaseName] =
        (currentFramePhaseTotals[phaseName] ?? 0) + durationMs
    }
  }
  const counterTarget = globalThis as typeof globalThis & {
    __asyraStrokePipelineCounterSink?: (
      counterName: string,
      value: number
    ) => void
  }
  const previousCounterSink = counterTarget.__asyraStrokePipelineCounterSink
  if (SHOULD_INCLUDE_PROFILE_COUNTERS) {
    counterTarget.__asyraStrokePipelineCounterSink = (counterName, value) => {
      previousCounterSink?.(counterName, value)
      if (!shouldRecordCounters) {
        return
      }
      counters[counterName] = (counters[counterName] ?? 0) + value
    }
  }

  for (let frame = 0; frame < FRAME_COUNT; frame += 1) {
    const shouldMeasureFrame = frame >= WARMUP_FRAMES
    ;(
      globalThis as typeof globalThis & {
        __asyraVectorRenderPhaseSink?: (
          phaseName: string,
          durationMs: number
        ) => void
      }
    ).__asyraVectorRenderPhaseSink = shouldMeasureFrame ? phaseSink : undefined
    shouldRecordCounters = shouldMeasureFrame
    if (shouldMeasureFrame) {
      measuredPhaseFrameCount += 1
      currentFramePhaseTotals = {}
    } else {
      currentFramePhaseTotals = null
    }
    const data = mutateDragFrame(frame, kind, pathKind)
    const start = performance.now()
    renderVectorFrame(graphic, data, stroke)
    const end = performance.now()

    if (frame >= WARMUP_FRAMES) {
      frameTimes.push(end - start)
      const framePhases = currentFramePhaseTotals ?? {}
      Object.entries(framePhases).forEach(([phaseName, durationMs]) => {
        const samples = phaseFrameSamples[phaseName] ?? []
        samples.push(durationMs)
        phaseFrameSamples[phaseName] = samples
      })
      Object.keys(phaseTotals).forEach((phaseName) => {
        if (!(phaseName in framePhases)) {
          const samples = phaseFrameSamples[phaseName] ?? []
          samples.push(0)
          phaseFrameSamples[phaseName] = samples
        }
      })
    }
    if (!hasCurrentStrokeProductOutput(graphic)) {
      incompleteFrameCount += 1
    }
    if (!hasRequiredConstrainedDashedNetworkOutput(graphic, data, stroke)) {
      incompleteFrameCount += 1
    }
  }

  clearInteractionState()
  ;(
    globalThis as typeof globalThis & {
      __asyraVectorRenderPhaseSink?: (
        phaseName: string,
        durationMs: number
      ) => void
    }
  ).__asyraVectorRenderPhaseSink = undefined
  shouldRecordCounters = false
  if (SHOULD_INCLUDE_PROFILE_COUNTERS) {
    counterTarget.__asyraStrokePipelineCounterSink = previousCounterSink
  }

  return {
    label,
    measurementScope: PERFORMANCE_MEASUREMENT_SCOPE,
    rendererCoverage: RENDERER_COVERAGE,
    doesNotMeasureRenderer: DOES_NOT_MEASURE_RENDERER,
    averageMs:
      frameTimes.reduce((total, value) => total + value, 0) / frameTimes.length,
    p95Ms: getPercentile(frameTimes, 0.95),
    maxMs: Math.max(...frameTimes),
    incompleteFrameCount,
    ...(SHOULD_INCLUDE_PROFILE_COUNTERS ? { counters } : {}),
    phases: Object.fromEntries(
      Object.entries(phaseTotals).map(([phaseName, totalMs]) => [
        phaseName,
        totalMs / Math.max(1, measuredPhaseFrameCount)
      ])
    ),
    phaseP95s: Object.fromEntries(
      Object.entries(phaseFrameSamples).map(([phaseName, samples]) => [
        phaseName,
        getPercentile(samples, 0.95)
      ])
    ),
    phaseMaxes: Object.fromEntries(
      Object.entries(phaseFrameSamples).map(([phaseName, samples]) => [
        phaseName,
        Math.max(...samples)
      ])
    )
  }
}

describe('stroke drag complete render contract', () => {
  it('should keep the reported vector-10 inside dashed network visible during drag', () => {
    const graphic = new RecordingVectorGraphic()
    const data = createReportedVector10InsideDashedDragData()
    setPathEditingState({
      vectorId: data.id,
      mouseDragging: true,
      mouseDown: true
    })

    let traces: ReturnType<typeof collectStrokePipelineTraces> = []
    const counters = collectStrokePipelineCounters(() => {
      traces = collectStrokePipelineTraces(() => {
        renderVectorFrameWithDataStrokes(graphic, data)
      })
    })

    expectConstrainedDashedProductNetworks(graphic, [
      REPORTED_VECTOR_10_INSIDE_DASHED_NETWORK_ID
    ])
    expectConstrainedDashedProductContract(
      graphic,
      REPORTED_VECTOR_10_INSIDE_DASHED_NETWORK_ID
    )
    const coveredSourceIndexes =
      getConstrainedDashedProductSourceSegmentIndexes(
        graphic,
        REPORTED_VECTOR_10_INSIDE_DASHED_NETWORK_ID
      )
    if (Array.from(coveredSourceIndexes).sort().join(',') !== '0,1,2,3,4') {
      throw new Error(
        `Expected reported vector-10 inside dashed product metadata to cover source segment indexes 0..4. Actual indexes: ${JSON.stringify(
          Array.from(coveredSourceIndexes).sort()
        )}. Product contract: ${JSON.stringify(
          getConstrainedDashedProductContractSignature(graphic),
          null,
          2
        )}. Empty product traces: ${JSON.stringify(
          traces.filter(
            (trace) =>
              trace.eventName === 'constrained-dashed-empty-product' ||
              trace.eventName === 'constrained-dashed-empty-range-product' ||
              trace.eventName === 'constrained-dashed-final-range-empty'
          ),
          null,
          2
        )}`
      )
    }

    const segmentCoverage =
      analyzeReportedInsideDashedRenderEntrySegmentCoverage(
        graphic,
        data,
        REPORTED_VECTOR_10_INSIDE_DASHED_NETWORK_ID
      )
    if (
      segmentCoverage.coveredSegmentCount !== 5 ||
      segmentCoverage.worstSegmentRecall <= 0 ||
      !segmentCoverage.productBounds ||
      !segmentCoverage.expectedLocalBounds ||
      segmentCoverage.productBounds.width <
        segmentCoverage.expectedLocalBounds.width * 0.9 ||
      segmentCoverage.productBounds.height <
        segmentCoverage.expectedLocalBounds.height * 0.75
    ) {
      throw new Error(
        `Expected reported vector-10 inside dashed render entries to cover all source segments. Coverage: ${JSON.stringify(
          {
            ...segmentCoverage,
            productContract:
              getConstrainedDashedProductContractSignature(graphic)
          },
          null,
          2
        )}`
      )
    }
    expect(counters['constrained-dashed-inside-mask-visual-entry'] ?? 0).toBe(0)
    expect(
      getStrokeCacheEntries(graphic).some(
        ([, entry]) =>
          entry.kind === 'masked-solid' || entry.kind === 'solid-graphics'
      )
    ).toBe(true)
    expect(hasCurrentStrokeProductOutput(graphic)).toBe(true)
    clearInteractionState()
  })

  it('should route per network when only one constrained dashed descriptor succeeds', () => {
    const graphic = new RecordingVectorGraphic()
    const data = createMixedPerNetworkInsideDashedData()
    setPathEditingState({
      vectorId: data.id,
      mouseDragging: true,
      mouseDown: true
    })

    renderVectorFrameWithDataStrokes(graphic, data)
    expectConstrainedDashedProductNetworks(graphic, [
      REPORTED_ROUND_INSIDE_DASHED_STAR_NETWORK_ID,
      'secondary-rect-network'
    ])
    expect(hasCurrentStrokeProductOutput(graphic)).toBe(true)
    clearInteractionState()
  })

  it.each([
    ['inside', StrokePositions.INSIDE],
    ['outside', StrokePositions.OUTSIDE]
  ] as const)(
    'should keep open self-intersecting %s dashed output visible during drag',
    (_label, position) => {
      const graphic = new RecordingVectorGraphic()
      const data = createOpenSelfIntersectingDashedStarVectorData()
      const stroke = createStroke('round', position)
      setPathEditingState({
        vectorId: data.id,
        mouseDragging: true,
        mouseDown: true
      })

      renderVectorFrame(graphic, data, stroke)

      expectConstrainedDashedProductNetworks(graphic, [
        REPORTED_ROUND_INSIDE_DASHED_STAR_NETWORK_ID
      ])
      expect(hasCurrentStrokeProductOutput(graphic)).toBe(true)
      clearInteractionState()
    }
  )

  it.each([
    ['inside round', StrokePositions.INSIDE, StrokeCapTypes.ROUND],
    ['outside round', StrokePositions.OUTSIDE, StrokeCapTypes.ROUND],
    ['outside square', StrokePositions.OUTSIDE, StrokeCapTypes.SQUARE]
  ] as const)(
    'should keep constrained dashed %s product contract identical for static and drag renders',
    (_label, position, capType) => {
      const staticGraphic = new RecordingVectorGraphic()
      const dragGraphic = new RecordingVectorGraphic()
      const data = mutateDragFrame(11, 'anchor', 'open-self-intersecting')
      const stroke = createStroke(capType, position)

      setPathEditingState({
        vectorId: data.id,
        mouseDragging: false,
        mouseDown: false
      })
      renderVectorFrame(staticGraphic, data, stroke)

      setPathEditingState({
        vectorId: data.id,
        mouseDragging: true,
        mouseDown: true
      })
      renderVectorFrame(dragGraphic, data, stroke)

      expect(getConstrainedDashedProductContractSignature(dragGraphic)).toEqual(
        getConstrainedDashedProductContractSignature(staticGraphic)
      )
      expect(hasCurrentStrokeProductOutput(dragGraphic)).toBe(true)
      clearInteractionState()
    }
  )

  it('should render the full constrained dashed stroke pipeline during path editing drag', () => {
    const graphic = new RecordingVectorGraphic()
    const data = mutateDragFrame(4, 'anchor')
    setPathEditingState({
      vectorId: 'drag-profile:anchor',
      mouseDragging: true,
      mouseDown: true
    })

    const phases = collectRenderPhases(() =>
      renderVectorFrame(graphic, data, createStroke('square'))
    )

    expect(phases.has('constrained dashed product visuals')).toBe(false)
    expect(phases.has('constrained dashed packets')).toBe(true)
    expectFullStrokeRenderCache(graphic)
    expect(hasCurrentStrokeProductOutput(graphic)).toBe(true)
    clearInteractionState()
  })

  it('should keep constrained dashed product output complete while hit area rebuilds through the same drag pipeline', () => {
    const staticGraphic = new RecordingVectorGraphic()
    const dragGraphic = new RecordingVectorGraphic()
    const finalGraphic = new RecordingVectorGraphic()
    const stroke = createStroke('round')
    const staticData = mutateDragFrame(1, 'anchor')
    setPathEditingState({
      vectorId: 'drag-profile:anchor',
      mouseDragging: false,
      mouseDown: false
    })
    renderVectorFrame(staticGraphic, staticData, stroke)
    expect(staticGraphic.hitArea ?? null).not.toBeNull()

    setPathEditingState({
      vectorId: 'drag-profile:anchor',
      mouseDragging: true,
      mouseDown: true
    })
    const dragCounters = collectStrokePipelineCounters(() => {
      renderVectorFrame(dragGraphic, staticData, stroke)
    })

    expect(dragCounters['vector-hit-area-drag-cache-hit']).toBeUndefined()
    expect(dragGraphic.hitArea ?? null).not.toBeNull()
    expectFullStrokeRenderCache(dragGraphic)
    expect(hasCurrentStrokeProductOutput(dragGraphic)).toBe(true)
    expect(getConstrainedDashedProductContractSignature(dragGraphic)).toEqual(
      getConstrainedDashedProductContractSignature(staticGraphic)
    )

    setPathEditingState({
      vectorId: 'drag-profile:anchor',
      mouseDragging: false,
      mouseDown: false
    })
    const finalCounters = collectStrokePipelineCounters(() => {
      renderVectorFrame(finalGraphic, mutateDragFrame(2, 'anchor'), stroke)
    })

    expect(finalGraphic.hitArea ?? null).not.toBeNull()
    expect(
      finalGraphic.__asyraSolidCenterStrokeExportPackets?.length ?? 0
    ).toBeGreaterThan(0)
    expect(finalCounters['vector-hit-area-rebuild']).toBe(1)
    clearInteractionState()
  })

  it('should keep debug overlap on the full raw/debug stroke pipeline during drag', () => {
    const graphic = new RecordingVectorGraphic()
    const data = {
      ...mutateDragFrame(4, 'anchor'),
      strokeDebugOptions: {
        disableVisualOverlapCollapse: true
      }
    }
    setPathEditingState({
      vectorId: 'drag-profile:anchor',
      mouseDragging: true,
      mouseDown: true
    })

    const phases = collectRenderPhases(() =>
      renderVectorFrame(graphic, data, createStroke('square'))
    )

    expect(phases.has('stroke product visual compiler')).toBe(false)
    expect(phases.has('constrained dashed packets')).toBe(true)
    clearInteractionState()
  })

  it('should treat mouseDown without mouseDragging as a full render that updates export packets', () => {
    const graphic = new RecordingVectorGraphic()
    const data = mutateDragFrame(5, 'anchor')
    setPathEditingState({
      vectorId: 'drag-profile:anchor',
      mouseDragging: false,
      mouseDown: true
    })

    renderVectorFrame(graphic, data, createStroke('butt'))

    expectFullStrokeRenderCache(graphic)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.length ?? 0
    ).toBeGreaterThan(0)
    clearInteractionState()
  })

  it('should keep full stroke cache while dragging and after drag stops', () => {
    const graphic = new RecordingVectorGraphic()
    const stroke = createStroke('round')
    setPathEditingState({
      vectorId: 'drag-profile:out-control',
      mouseDragging: true,
      mouseDown: true
    })
    renderVectorFrame(graphic, mutateDragFrame(6, 'out-control'), stroke)

    setPathEditingState({
      vectorId: 'drag-profile:out-control',
      mouseDragging: false,
      mouseDown: false
    })
    renderVectorFrame(graphic, mutateDragFrame(7, 'out-control'), stroke)

    expectFullStrokeRenderCache(graphic)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.length ?? 0
    ).toBeGreaterThan(0)
    clearInteractionState()
  })

  it('should use center path solid render during drag with the same product packets as static render', () => {
    const graphic = new RecordingVectorGraphic()
    const stroke = createCenterSolidStroke()
    const data = mutateDragFrame(8, 'anchor')

    setPathEditingState({
      vectorId: 'drag-profile:center-solid-anchor',
      mouseDragging: true,
      mouseDown: true
    })
    const dragCounters = collectStrokePipelineCounters(() => {
      renderVectorFrame(graphic, data, stroke)
    })

    expect(graphic.__asyraCenterPathSolidStrokeRenderCount).toBe(1)
    expect(
      dragCounters[REMOVED_CENTER_SOLID_PACKET_SKIP_COUNTER]
    ).toBeUndefined()
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.length ?? 0
    ).toBeGreaterThan(0)
    expect(hasCurrentStrokeProductOutput(graphic)).toBe(true)

    setPathEditingState({
      vectorId: 'drag-profile:center-solid-anchor',
      mouseDragging: false,
      mouseDown: false
    })
    renderVectorFrame(graphic, data, stroke)

    expect(graphic.__asyraCenterPathSolidStrokeRenderCount).toBe(1)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.length ?? 0
    ).toBeGreaterThan(0)
    clearInteractionState()
  })

  it('should use a single-composite path mask for translucent self-intersecting center solid drag', () => {
    const graphic = new RecordingVectorGraphic()
    const stroke = createCenterSolidStroke(0.5)
    const data = mutateDragFrame(8, 'anchor')

    setPathEditingState({
      vectorId: 'drag-profile:center-solid-anchor',
      mouseDragging: true,
      mouseDown: true
    })
    const dragCounters = collectStrokePipelineCounters(() => {
      renderVectorFrame(graphic, data, stroke)
    })

    expect(graphic.__asyraCenterPathSolidStrokeRenderCount).toBe(0)
    expect(graphic.__asyraCenterSolidPathMaskRenderCount).toBe(1)
    expect(
      dragCounters[REMOVED_PATH_MASK_CENTER_SOLID_PACKET_SKIP_COUNTER]
    ).toBeUndefined()
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.length ?? 0
    ).toBeGreaterThan(0)
    expect(
      getStrokeCacheEntries(graphic).some(
        ([, entry]) => entry.kind === 'masked-solid'
      )
    ).toBe(true)
    expect(hasCurrentStrokeProductOutput(graphic)).toBe(true)

    clearInteractionState()
  })

  it('should keep face-owned render-mask product final for inside solid self-intersecting drag frames', () => {
    const graphic = new RecordingVectorGraphic()
    const stroke = createConstrainedSolidStroke(StrokePositions.INSIDE)
    const data = mutateDragFrame(8, 'anchor')

    setPathEditingState({
      vectorId: 'drag-profile:inside-solid-anchor',
      mouseDragging: true,
      mouseDown: true
    })
    const phases = collectRenderPhases(() => {
      renderVectorFrame(graphic, data, stroke)
    })

    expect(
      phases.has('constrained-solid:self-intersecting-solid-mask-model-packets')
    ).toBe(true)
    expect(
      phases.has('constrained-solid:solid-mask-model-inside-face-owned-mask')
    ).toBe(false)
    expect(
      phases.has(
        'constrained-solid:solid-mask-model-inside-exact-source-stroke'
      )
    ).toBe(false)
    expect(
      phases.has(
        'constrained-solid:solid-mask-model-inside-stroke-mask-intersection'
      )
    ).toBe(false)
    expect(hasCurrentStrokeProductOutput(graphic)).toBe(true)
    clearInteractionState()
  })

  it('should keep outside solid self-intersecting drag frames on the render-mask product path', () => {
    const graphic = new RecordingVectorGraphic()
    const stroke = createConstrainedSolidStroke(StrokePositions.OUTSIDE)
    const data = mutateDragFrame(8, 'anchor')

    setPathEditingState({
      vectorId: 'drag-profile:outside-solid-anchor',
      mouseDragging: true,
      mouseDown: true
    })
    const phases = collectRenderPhases(() => {
      renderVectorFrame(graphic, data, stroke)
    })

    expect(
      phases.has('constrained-solid:self-intersecting-solid-mask-model-packets')
    ).toBe(true)
    expect(
      phases.has(
        'constrained-solid:solid-mask-model-outside-stroke-fill-difference'
      )
    ).toBe(false)
    expect(
      phases.has('constrained-solid:solid-mask-model-outside-result-union')
    ).toBe(false)
    expect(
      getStrokeCacheEntries(graphic).some(
        ([, entry]) => entry.kind === 'masked-solid'
      )
    ).toBe(true)
    expect(hasCurrentStrokeProductOutput(graphic)).toBe(true)
    clearInteractionState()
  })

  it('should run: keep full self-intersecting path precision during drag', () => {
    const graphic = new RecordingVectorGraphic()
    const stroke = createStroke('round')
    const data = mutateDragFrame(9, 'anchor')

    setPathEditingState({
      vectorId: 'drag-profile:anchor',
      mouseDragging: true,
      mouseDown: true
    })
    renderVectorFrame(graphic, data, stroke)

    const dragSampleCount = getPathModelSampleCount(graphic)
    expect(dragSampleCount).toBeGreaterThan(320)
    expect(
      getPathModelRevisionKeys(graphic).every((key) =>
        key.includes('final:v2:12:160:range')
      )
    ).toBe(true)

    setPathEditingState({
      vectorId: 'drag-profile:anchor',
      mouseDragging: false,
      mouseDown: false
    })
    renderVectorFrame(graphic, data, stroke)

    const finalSampleCount = getPathModelSampleCount(graphic)
    expect(finalSampleCount).toBe(dragSampleCount)
    expect(
      getPathModelRevisionKeys(graphic).every((key) =>
        key.includes('final:v2:12:160:range')
      )
    ).toBe(true)
    clearInteractionState()
  })
})

describeProfile('stroke drag performance profile', () => {
  if (!SHOULD_RUN_STROKE_DRAG_PROFILE) {
    it('should run: keep stroke drag performance profile opt-in by environment', () => {
      expect(SHOULD_RUN_STROKE_DRAG_PROFILE).toBe(false)
    })
    return
  }

  it('should profile: render anchor and curve-handle drag CPU updates with complete stroke geometry', () => {
    const dragKinds = ['anchor', 'in-control', 'out-control'] as const
    const strokeScenarios = [
      {
        label: 'closed-inside-dashed-butt',
        stroke: createStroke('butt', StrokePositions.INSIDE),
        pathKind: 'closed' as const
      },
      {
        label: 'closed-inside-dashed-square',
        stroke: createStroke('square', StrokePositions.INSIDE),
        pathKind: 'closed' as const
      },
      {
        label: 'closed-inside-dashed-round',
        stroke: createStroke('round', StrokePositions.INSIDE),
        pathKind: 'closed' as const
      },
      {
        label: 'closed-center-dashed-round',
        stroke: createStroke('round', StrokePositions.CENTER),
        pathKind: 'closed' as const
      },
      {
        label: 'closed-outside-dashed-round',
        stroke: createStroke('round', StrokePositions.OUTSIDE),
        pathKind: 'closed' as const
      },
      {
        label: 'open-center-dashed-round',
        stroke: createStroke('round', StrokePositions.CENTER),
        pathKind: 'open-self-intersecting' as const
      },
      {
        label: 'open-inside-dashed-round',
        stroke: createStroke('round', StrokePositions.INSIDE),
        pathKind: 'open-self-intersecting' as const
      },
      {
        label: 'open-outside-dashed-round',
        stroke: createStroke('round', StrokePositions.OUTSIDE),
        pathKind: 'open-self-intersecting' as const
      },
      {
        label: 'closed-center-solid-round',
        stroke: createCenterSolidStroke(),
        pathKind: 'closed' as const
      },
      {
        label: 'closed-inside-solid-round',
        stroke: createConstrainedSolidStroke(StrokePositions.INSIDE),
        pathKind: 'closed' as const
      },
      {
        label: 'closed-outside-solid-round',
        stroke: createConstrainedSolidStroke(StrokePositions.OUTSIDE),
        pathKind: 'closed' as const
      }
    ]
    const filteredScenarios = SCENARIO_FILTER
      ? strokeScenarios.filter((scenario) =>
          `${scenario.label}:`.includes(SCENARIO_FILTER)
        )
      : strokeScenarios
    expect(filteredScenarios.length).toBeGreaterThan(0)
    const metrics = dragKinds.flatMap((kind) =>
      filteredScenarios.map((scenario) =>
        measureDragScenario(
          `${scenario.label}:${kind}`,
          kind,
          scenario.stroke,
          scenario.pathKind
        )
      )
    )

    const maxP95Ms = Math.max(...metrics.map((metric) => metric.p95Ms))
    const maxAverageMs = Math.max(...metrics.map((metric) => metric.averageMs))
    const profilePayload = {
      measurementScope: PERFORMANCE_MEASUREMENT_SCOPE,
      rendererCoverage: RENDERER_COVERAGE,
      doesNotMeasureRenderer: DOES_NOT_MEASURE_RENDERER,
      cpuProfileBudgetMs: CPU_PROFILE_RENDER_BUDGET_MS,
      enforceCpuProfileBudget: SHOULD_ENFORCE_CPU_PROFILE_BUDGET,
      enforceCpuProfileP95Budget: SHOULD_ENFORCE_CPU_PROFILE_P95_BUDGET,
      maxP95Ms,
      maxAverageMs,
      metrics
    }
    if (METRICS_FILE) {
      mkdirSync(dirname(METRICS_FILE), { recursive: true })
      writeFileSync(
        METRICS_FILE,
        `${JSON.stringify(profilePayload, null, 2)}\n`
      )
    }
    process.stdout.write(
      `STROKE_DRAG_METRICS ${JSON.stringify(profilePayload)}\n`
    )
    const incompleteMetrics = metrics
      .filter((metric) => metric.incompleteFrameCount !== 0)
      .map((metric) => ({
        label: metric.label,
        incompleteFrameCount: metric.incompleteFrameCount
      }))
    expect(incompleteMetrics).toEqual([])
    if (SHOULD_ENFORCE_CPU_PROFILE_BUDGET) {
      expect(maxAverageMs).toBeLessThan(CPU_PROFILE_RENDER_BUDGET_MS)
      if (SHOULD_ENFORCE_CPU_PROFILE_P95_BUDGET) {
        expect(maxP95Ms).toBeLessThan(CPU_PROFILE_RENDER_BUDGET_MS)
      }
    } else {
      expect(maxP95Ms).toBeGreaterThan(0)
    }
  })
})
