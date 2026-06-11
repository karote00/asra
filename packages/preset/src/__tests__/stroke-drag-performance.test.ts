import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
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
const describeProfile =
  process.env.ASYRA_STROKE_DRAG_PROFILE === '1' ? describe : describe.skip
const PERFORMANCE_MEASUREMENT_SCOPE = 'cpu-only'
const RENDERER_COVERAGE = 'fake'
const DOES_NOT_MEASURE_RENDERER = true
const require = createRequire(import.meta.url)
const clipperWasmPath = require.resolve('clipper2-wasm/dist/umd/clipper2z.wasm')
const CLIPPER_STROKE_DRAG_TEST_BACKEND_ID = 'stroke-drag-clipper2-test'

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
  __asyraNativeCenterSolidStrokeRenderCount?: number
  __asyraCenterSolidPathMaskRenderCount?: number
  __asyraConstrainedDashedProductNetworkIds?: string[]
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
  (graphic.__asyraNativeCenterSolidStrokeRenderCount ?? 0) > 0 ||
  (graphic.__asyraCenterSolidPathMaskRenderCount ?? 0) > 0 ||
  (graphic.__asyraConstrainedDashedProductNetworkIds?.length ?? 0) > 0 ||
  (graphic.__asyraSolidCenterStrokeExportPackets?.length ?? 0) > 0 ||
  getStrokeCacheEntries(graphic).some(
    ([, entry]) =>
      entry.kind === 'solid' ||
      entry.kind === 'gradient' ||
      entry.kind === 'masked-solid' ||
      entry.kind === 'solid-graphics' ||
      entry.kind === 'drag-solid-graphics'
  )

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
    cacheEntries.every(
      ([cacheKey, entry]) =>
        !cacheKey.startsWith('drag-visual:') &&
        entry.kind !== 'drag-solid-graphics'
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

const createMixedDescriptorAndFallbackInsideDashedData = () => {
  const base = createReportedRoundInsideDashedStarVectorData()
  return {
    ...base,
    id: 'multi-network-inside-dashed-drag',
    width: 760,
    height: 640,
    points: {
      ...base.points,
      'fallback-rect-a': {
        id: 'fallback-rect-a',
        kind: 'anchor',
        x: 540,
        y: 80,
        anchorType: 'sharp'
      },
      'fallback-rect-b': {
        id: 'fallback-rect-b',
        kind: 'anchor',
        x: 720,
        y: 80,
        anchorType: 'sharp'
      },
      'fallback-rect-c': {
        id: 'fallback-rect-c',
        kind: 'anchor',
        x: 720,
        y: 240,
        anchorType: 'sharp'
      },
      'fallback-rect-d': {
        id: 'fallback-rect-d',
        kind: 'anchor',
        x: 540,
        y: 240,
        anchorType: 'sharp'
      }
    },
    segments: {
      ...base.segments,
      'fallback-rect-ab': {
        id: 'fallback-rect-ab',
        startId: 'fallback-rect-a',
        endId: 'fallback-rect-b',
        outControlId: null,
        inControlId: null
      },
      'fallback-rect-bc': {
        id: 'fallback-rect-bc',
        startId: 'fallback-rect-b',
        endId: 'fallback-rect-c',
        outControlId: null,
        inControlId: null
      },
      'fallback-rect-cd': {
        id: 'fallback-rect-cd',
        startId: 'fallback-rect-c',
        endId: 'fallback-rect-d',
        outControlId: null,
        inControlId: null
      },
      'fallback-rect-da': {
        id: 'fallback-rect-da',
        startId: 'fallback-rect-d',
        endId: 'fallback-rect-a',
        outControlId: null,
        inControlId: null
      }
    },
    networks: {
      ...base.networks,
      'fallback-rect-network': {
        id: 'fallback-rect-network',
        pointIds: [
          'fallback-rect-a',
          'fallback-rect-b',
          'fallback-rect-c',
          'fallback-rect-d'
        ],
        segmentIds: [
          'fallback-rect-ab',
          'fallback-rect-bc',
          'fallback-rect-cd',
          'fallback-rect-da'
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
  let measuredPhaseFrameCount = 0
  const phaseSink = (phaseName: string, durationMs: number) => {
    if (measuredPhaseFrameCount <= 0) {
      return
    }
    phaseTotals[phaseName] = (phaseTotals[phaseName] ?? 0) + durationMs
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
    if (shouldMeasureFrame) {
      measuredPhaseFrameCount += 1
    }
    const data = mutateDragFrame(frame, kind, pathKind)
    const start = performance.now()
    renderVectorFrame(graphic, data, stroke)
    const end = performance.now()

    if (frame >= WARMUP_FRAMES) {
      frameTimes.push(end - start)
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
    phases: Object.fromEntries(
      Object.entries(phaseTotals).map(([phaseName, totalMs]) => [
        phaseName,
        totalMs / Math.max(1, measuredPhaseFrameCount)
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

    const counters = collectStrokePipelineCounters(() => {
      renderVectorFrameWithDataStrokes(graphic, data)
    })

    expectConstrainedDashedProductNetworks(graphic, [
      REPORTED_VECTOR_10_INSIDE_DASHED_NETWORK_ID
    ])
    expect(counters['constrained-dashed-inside-mask-visual-entry'] ?? 0).toBe(0)
    expect(hasCurrentStrokeProductOutput(graphic)).toBe(true)
    clearInteractionState()
  })

  it('should fallback per network when only one constrained dashed descriptor succeeds', () => {
    const graphic = new RecordingVectorGraphic()
    const data = createMixedDescriptorAndFallbackInsideDashedData()
    setPathEditingState({
      vectorId: data.id,
      mouseDragging: true,
      mouseDown: true
    })

    renderVectorFrameWithDataStrokes(graphic, data)

    expectConstrainedDashedProductNetworks(graphic, [
      REPORTED_ROUND_INSIDE_DASHED_STAR_NETWORK_ID,
      'fallback-rect-network'
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
    expect(phases.has('constrained dashed candidates')).toBe(true)
    expect(phases.has('constrained dashed acceptance')).toBe(true)
    expect(phases.has('constrained dashed promotion')).toBe(true)
    expectFullStrokeRenderCache(graphic)
    expect(hasCurrentStrokeProductOutput(graphic)).toBe(true)
    clearInteractionState()
  })

  it('should reuse non-visual hover hit area during drag and rebuild it after drag stops', () => {
    const graphic = new RecordingVectorGraphic()
    const stroke = createStroke('round')
    setPathEditingState({
      vectorId: 'drag-profile:anchor',
      mouseDragging: false,
      mouseDown: false
    })
    renderVectorFrame(graphic, mutateDragFrame(0, 'anchor'), stroke)
    const initialHitArea = graphic.hitArea
    expect(initialHitArea ?? null).not.toBeNull()

    setPathEditingState({
      vectorId: 'drag-profile:anchor',
      mouseDragging: true,
      mouseDown: true
    })
    const dragCounters = collectStrokePipelineCounters(() => {
      renderVectorFrame(graphic, mutateDragFrame(1, 'anchor'), stroke)
    })

    expect(graphic.hitArea).toBe(initialHitArea)
    expect(dragCounters['vector-hit-area-drag-cache-hit']).toBe(1)
    expect(dragCounters['vector-hit-area-rebuild'] ?? 0).toBe(0)
    expectFullStrokeRenderCache(graphic)
    expect(hasCurrentStrokeProductOutput(graphic)).toBe(true)

    setPathEditingState({
      vectorId: 'drag-profile:anchor',
      mouseDragging: false,
      mouseDown: false
    })
    const finalCounters = collectStrokePipelineCounters(() => {
      renderVectorFrame(graphic, mutateDragFrame(2, 'anchor'), stroke)
    })

    expect(graphic.hitArea ?? null).not.toBeNull()
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.length ?? 0
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
    expect(phases.has('constrained dashed candidates')).toBe(true)
    expect(phases.has('constrained dashed acceptance')).toBe(true)
    expect(phases.has('constrained dashed promotion')).toBe(true)
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

  it('should use native center solid visible render during drag without visible polygon packets', () => {
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

    expect(graphic.__asyraNativeCenterSolidStrokeRenderCount).toBe(1)
    expect(
      dragCounters['native-center-solid-visible-packet-skip']
    ).toBeGreaterThan(0)
    expect(graphic.__asyraSolidCenterStrokeExportPackets ?? []).toHaveLength(0)
    expect(hasCurrentStrokeProductOutput(graphic)).toBe(true)

    setPathEditingState({
      vectorId: 'drag-profile:center-solid-anchor',
      mouseDragging: false,
      mouseDown: false
    })
    renderVectorFrame(graphic, data, stroke)

    expect(graphic.__asyraNativeCenterSolidStrokeRenderCount).toBe(1)
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

    expect(graphic.__asyraNativeCenterSolidStrokeRenderCount).toBe(0)
    expect(graphic.__asyraCenterSolidPathMaskRenderCount).toBe(1)
    expect(
      dragCounters['path-mask-center-solid-visible-packet-skip']
    ).toBeGreaterThan(0)
    expect(graphic.__asyraSolidCenterStrokeExportPackets ?? []).toHaveLength(0)
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
      phases.has('constrained-solid:solid-mask-model-inside-exact-source-stroke')
    ).toBe(false)
    expect(
      phases.has(
        'constrained-solid:solid-mask-model-inside-stroke-mask-intersection'
      )
    ).toBe(false)
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
      getPathModelRevisionKeys(graphic).every((key) => key.includes('final:v1'))
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
      getPathModelRevisionKeys(graphic).every((key) => key.includes('final:v1'))
    ).toBe(true)
    clearInteractionState()
  })
})

describeProfile('stroke drag performance profile', () => {
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
    const metrics = dragKinds.flatMap((kind) =>
      strokeScenarios.map((scenario) =>
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
    process.stdout.write(
      `STROKE_DRAG_METRICS ${JSON.stringify({
        measurementScope: PERFORMANCE_MEASUREMENT_SCOPE,
        rendererCoverage: RENDERER_COVERAGE,
        doesNotMeasureRenderer: DOES_NOT_MEASURE_RENDERER,
        cpuProfileBudgetMs: CPU_PROFILE_RENDER_BUDGET_MS,
        enforceCpuProfileBudget: SHOULD_ENFORCE_CPU_PROFILE_BUDGET,
        enforceCpuProfileP95Budget: SHOULD_ENFORCE_CPU_PROFILE_P95_BUDGET,
        maxP95Ms,
        maxAverageMs,
        metrics
      })}\n`
    )
    expect(metrics.every((metric) => metric.incompleteFrameCount === 0)).toBe(
      true
    )
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
