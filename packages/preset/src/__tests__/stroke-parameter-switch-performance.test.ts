import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { beforeAll, describe, expect, it } from 'vitest'
import { BehaviorSubject, Subscription } from 'rxjs'
import { Container } from 'pixi.js'
import Clipper2ZFactory from 'clipper2-wasm'
import core, {
  VECTOR_TOKENS,
  renderStrategyRegistry,
  type VectorNetwork,
  type VectorPointNode,
  type VectorSegment
} from '@asyra/core'
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
  registerGeometryBackend,
  selectGeometryBackend
} from '../components/stroke-render/geometry-backend'
import {
  createClipper2GeometryBackend,
  type Clipper2Module
} from '../components/stroke-render/clipper2-geometry-backend'

const FRAME_COUNT = Number(
  process.env.ASYRA_STROKE_PARAMETER_SWITCH_FRAMES ?? 300
)
const WARMUP_FRAMES = Math.min(20, Math.max(0, Math.floor(FRAME_COUNT / 10)))
const SHOULD_RUN_STROKE_PARAMETER_SWITCH_PROFILE =
  process.env.ASYRA_STROKE_PARAMETER_SWITCH_PROFILE === '1'
const describeProfile = describe
const PERFORMANCE_MEASUREMENT_SCOPE = 'cpu-only'
const RENDERER_COVERAGE = 'fake'
const DOES_NOT_MEASURE_RENDERER = true
const SHOULD_ENFORCE_PARAMETER_P95 =
  process.env.ASYRA_STROKE_PARAMETER_SWITCH_ENFORCE_P95 === '1'
const PARAMETER_SWITCH_P95_BUDGET_MS = Number(
  process.env.ASYRA_STROKE_PARAMETER_SWITCH_P95_BUDGET_MS ?? 11.11
)
const require = createRequire(import.meta.url)
const clipperWasmPath = require.resolve('clipper2-wasm/dist/umd/clipper2z.wasm')
const CLIPPER_STROKE_PARAMETER_SWITCH_TEST_BACKEND_ID =
  'stroke-parameter-switch-clipper2-test'

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
        primaryTool: 'select',
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
  core.defineSystemProperty<boolean>(
    'strokeDebugDisableVisualOverlapCollapse',
    false
  )

  const backend = createClipper2GeometryBackend(await loadClipperModule(), {
    backendId: CLIPPER_STROKE_PARAMETER_SWITCH_TEST_BACKEND_ID,
    backendVersion: `${CLIPPER_STROKE_PARAMETER_SWITCH_TEST_BACKEND_ID}@test`
  })
  registerGeometryBackend({
    backendId: CLIPPER_STROKE_PARAMETER_SWITCH_TEST_BACKEND_ID,
    load: () => backend
  })
  selectGeometryBackend(CLIPPER_STROKE_PARAMETER_SWITCH_TEST_BACKEND_ID)
})

class RecordingVectorGraphic extends Container {
  __asyraSolidCenterStrokeExportPackets?: unknown[]
  __asyraStrokeMeshCache?: Map<string, { kind?: string }>
  __asyraCenterPathSolidStrokeRenderCount?: number
  __asyraCenterSolidPathMaskRenderCount?: number
  __asyraStrokeRenderFaceDebugMetas?: unknown[]
  __asyraStrokeRenderEntries?: unknown[]
  hitArea?: { contains: (x: number, y: number) => boolean } | null

  constructor() {
    super()
    Object.defineProperty(this, 'addChild', {
      configurable: true,
      value: undefined
    })
  }

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

const getStrokeCacheEntries = (graphic: RecordingVectorGraphic) =>
  Array.from(graphic.__asyraStrokeMeshCache?.entries() ?? [])

const hasProductOutput = (graphic: RecordingVectorGraphic) =>
  (graphic.__asyraCenterPathSolidStrokeRenderCount ?? 0) > 0 ||
  (graphic.__asyraCenterSolidPathMaskRenderCount ?? 0) > 0 ||
  (graphic.__asyraStrokeRenderFaceDebugMetas?.length ?? 0) > 0 ||
  (graphic.__asyraStrokeRenderEntries?.length ?? 0) > 0 ||
  getStrokeCacheEntries(graphic).some(
    ([, entry]) =>
      entry.kind === 'solid' ||
      entry.kind === 'gradient' ||
      entry.kind === 'masked-solid' ||
      entry.kind === 'solid-graphics'
  )

const hasProductPipelineCounterChange = (
  counters: Record<string, number>,
  before: Record<string, number>
) =>
  [
    'interval-sweep-count',
    'final-coverage-builder-hit',
    'center-product-solid-stroke-render-count',
    'path-mask-center-solid-stroke-render-count',
    'stroke-stage-cache:product-geometry-hit',
    'stroke-stage-cache:product-geometry-store',
    'stroke-stage-cache:render-output-hidden',
    'visual-overlap-collapse-no-union-backend'
  ].some(
    (counterName) => (counters[counterName] ?? 0) > (before[counterName] ?? 0)
  )

const formatTopPhaseTotals = (
  phaseTotals: Map<string, number>,
  phaseCounts: Map<string, number>
) =>
  [...phaseTotals.entries()]
    .sort(([, leftTotal], [, rightTotal]) => rightTotal - leftTotal)
    .slice(0, 12)
    .map(([phaseName, totalMs]) => ({
      phaseName,
      totalMs,
      count: phaseCounts.get(phaseName) ?? 0,
      averageMs: totalMs / Math.max(1, phaseCounts.get(phaseName) ?? 0)
    }))

const getPercentile = (values: number[], percentile: number) => {
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * percentile) - 1)
  )
  return sorted[index] ?? 0
}

const toReportedClosedStarVectorData = () => ({
  points: {
    'tp-56': {
      id: 'tp-56',
      kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
      anchorType: 'sharp',
      x: 246.91886685202462,
      y: 0
    },
    'tp-57': {
      id: 'tp-57',
      kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
      anchorType: 'smooth',
      x: 75.04396933738008,
      y: 457.5261356375752
    },
    'tp-56:out': {
      id: 'tp-56:out',
      kind: VECTOR_TOKENS.POINT.KIND.CONTROL,
      controlRole: VECTOR_TOKENS.CONTROL.ROLE.OUT,
      x: 195.9809570843745,
      y: 149.61104635348715
    },
    'tp-57:in': {
      id: 'tp-57:in',
      kind: VECTOR_TOKENS.POINT.KIND.CONTROL,
      controlRole: VECTOR_TOKENS.CONTROL.ROLE.IN,
      x: -46.963000165973426,
      y: 476.8923212730281
    },
    'tp-57:out': {
      id: 'tp-57:out',
      kind: VECTOR_TOKENS.POINT.KIND.CONTROL,
      controlRole: VECTOR_TOKENS.CONTROL.ROLE.OUT,
      x: 227.55268121657173,
      y: 433.3184035932593
    },
    'tp-58': {
      id: 'tp-58',
      kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
      anchorType: 'sharp',
      x: 423.6353107755326,
      y: 198.5034027633924
    },
    'tp-59': {
      id: 'tp-59',
      kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
      anchorType: 'sharp',
      x: 0,
      y: 91.98938176840147
    },
    'tp-60': {
      id: 'tp-60',
      kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
      anchorType: 'smooth',
      x: 307.43819696281525,
      y: 428.4768571843963
    },
    'tp-59:out': {
      id: 'tp-59:out',
      kind: VECTOR_TOKENS.POINT.KIND.CONTROL,
      controlRole: VECTOR_TOKENS.CONTROL.ROLE.OUT,
      x: 0,
      y: 91.98938176840147
    },
    'tp-60:in': {
      id: 'tp-60:in',
      kind: VECTOR_TOKENS.POINT.KIND.CONTROL,
      controlRole: VECTOR_TOKENS.CONTROL.ROLE.IN,
      x: 275.9681453052044,
      y: 498.6792801129134
    },
    'tp-60:out': {
      id: 'tp-60:out',
      kind: VECTOR_TOKENS.POINT.KIND.CONTROL,
      controlRole: VECTOR_TOKENS.CONTROL.ROLE.OUT,
      x: 338.9082486204261,
      y: 358.2744342558792
    }
  } satisfies Record<string, VectorPointNode>,
  segments: {
    'ts-95': {
      id: 'ts-95',
      startId: 'tp-56',
      endId: 'tp-57',
      outControlId: 'tp-56:out',
      inControlId: 'tp-57:in'
    },
    'ts-96': {
      id: 'ts-96',
      startId: 'tp-57',
      endId: 'tp-58',
      outControlId: 'tp-57:out',
      inControlId: null
    },
    'ts-97': {
      id: 'ts-97',
      startId: 'tp-58',
      endId: 'tp-59',
      outControlId: null,
      inControlId: null
    },
    'ts-98': {
      id: 'ts-98',
      startId: 'tp-59',
      endId: 'tp-60',
      outControlId: 'tp-59:out',
      inControlId: 'tp-60:in'
    },
    'ts-99': {
      id: 'ts-99',
      startId: 'tp-60',
      endId: 'tp-56',
      outControlId: 'tp-60:out',
      inControlId: null
    }
  } satisfies Record<string, VectorSegment>,
  networks: {
    'tn-14': {
      id: 'tn-14',
      pointIds: ['tp-56', 'tp-57', 'tp-58', 'tp-59', 'tp-60'],
      segmentIds: ['ts-95', 'ts-96', 'ts-97', 'ts-98', 'ts-99'],
      closed: true
    }
  } satisfies Record<string, VectorNetwork>
})

const measureScenario = (
  label: string,
  getStroke: (frame: number) => ReturnType<typeof createDefaultStroke>
) => {
  const strategy = renderStrategyRegistry.get('vector')
  expect(strategy).toBeTypeOf('function')

  const graphic = new RecordingVectorGraphic()
  const baseData = {
    id: `measure:${label}`,
    x: 0,
    y: 0,
    width: 423.6353107755326,
    height: 458.34939129152076,
    ...toReportedClosedStarVectorData(),
    pointCoordinateSpace: 'workspace',
    closed: true,
    fills: []
  }
  const frameTimes: number[] = []
  const counters: Record<string, number> = {}
  const phaseTotals = new Map<string, number>()
  const phaseCounts = new Map<string, number>()
  let invalidFrameCount = 0
  const globalWithSinks = globalThis as typeof globalThis & {
    __asyraStrokePipelineCounterSink?: (
      counterName: string,
      value: number
    ) => void
    __asyraVectorRenderPhaseSink?: (
      phaseName: string,
      durationMs: number
    ) => void
  }
  const previousCounterSink = globalWithSinks.__asyraStrokePipelineCounterSink
  const previousPhaseSink = globalWithSinks.__asyraVectorRenderPhaseSink
  globalWithSinks.__asyraStrokePipelineCounterSink = (counterName, value) => {
    counters[counterName] = (counters[counterName] ?? 0) + value
  }
  globalWithSinks.__asyraVectorRenderPhaseSink = (phaseName, durationMs) => {
    phaseTotals.set(phaseName, (phaseTotals.get(phaseName) ?? 0) + durationMs)
    phaseCounts.set(phaseName, (phaseCounts.get(phaseName) ?? 0) + 1)
  }

  try {
    for (let frame = 0; frame < FRAME_COUNT; frame += 1) {
      const counterSnapshot = { ...counters }
      const start = performance.now()
      const stroke = getStroke(frame)
      ;(
        strategy as unknown as (
          target: RecordingVectorGraphic,
          data: Record<string, unknown>
        ) => void
      )(graphic, {
        ...baseData,
        strokes: [stroke]
      })
      const end = performance.now()
      if (frame >= WARMUP_FRAMES) {
        frameTimes.push(end - start)
      }
      if (
        stroke.visible !== false &&
        !hasProductOutput(graphic) &&
        !hasProductPipelineCounterChange(counters, counterSnapshot)
      ) {
        invalidFrameCount += 1
      }
    }
  } finally {
    globalWithSinks.__asyraStrokePipelineCounterSink = previousCounterSink
    globalWithSinks.__asyraVectorRenderPhaseSink = previousPhaseSink
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
    invalidFrameCount,
    counters,
    topPhases: formatTopPhaseTotals(phaseTotals, phaseCounts)
  }
}

const measureInsideDashedFormalRouteBreakdown = () =>
  measureScenario('inside dashed formal product route', (frame) =>
    createDefaultStroke({
      id: 'pp-312',
      width: 10,
      style: StrokeStyles.DASHED,
      position: StrokePositions.INSIDE,
      dashPattern: [20, 20],
      dashOffset: frame * 2,
      color: '#d51a1a'
    })
  )

describeProfile('stroke parameter switch performance profile', () => {
  if (!SHOULD_RUN_STROKE_PARAMETER_SWITCH_PROFILE) {
    it('should run: keep stroke parameter switch performance profile opt-in by environment', () => {
      expect(SHOULD_RUN_STROKE_PARAMETER_SWITCH_PROFILE).toBe(false)
    })
    return
  }

  it('should profile: measure reported closed star vector render strategy parameter CPU updates', () => {
    const metrics = [
      measureScenario('inside dashed dashOffset slider', (frame) =>
        createDefaultStroke({
          id: 'pp-312',
          width: 10,
          style: StrokeStyles.DASHED,
          position: StrokePositions.INSIDE,
          dashPattern: [20, 20],
          dashOffset: frame * 2,
          color: '#d51a1a'
        })
      ),
      measureScenario('inside dashed width slider', (frame) =>
        createDefaultStroke({
          id: 'pp-312',
          width: 6 + (frame % 20),
          style: StrokeStyles.DASHED,
          position: StrokePositions.INSIDE,
          dashPattern: [20, 20],
          dashOffset: 0,
          color: '#d51a1a'
        })
      ),
      measureScenario('center to inside position toggle', (frame) =>
        createDefaultStroke({
          id: 'pp-312',
          width: 10,
          style: StrokeStyles.DASHED,
          position:
            frame % 2 === 0 ? StrokePositions.CENTER : StrokePositions.INSIDE,
          dashPattern: [20, 20],
          dashOffset: 0,
          color: '#d51a1a'
        })
      ),
      measureScenario('inside dashed cap cycle', (frame) =>
        createDefaultStroke({
          id: 'pp-312',
          width: 10,
          style: StrokeStyles.DASHED,
          position: StrokePositions.INSIDE,
          dashPattern: [20, 20],
          dashOffset: 0,
          capType: [
            StrokeCapTypes.BUTT,
            StrokeCapTypes.SQUARE,
            StrokeCapTypes.ROUND
          ][frame % 3],
          color: '#d51a1a'
        })
      ),
      measureScenario('outside dashed cap cycle', (frame) =>
        createDefaultStroke({
          id: 'pp-312',
          width: 10,
          style: StrokeStyles.DASHED,
          position: StrokePositions.OUTSIDE,
          dashPattern: [20, 20],
          dashOffset: 0,
          capType: [
            StrokeCapTypes.BUTT,
            StrokeCapTypes.SQUARE,
            StrokeCapTypes.ROUND
          ][frame % 3],
          color: '#d51a1a'
        })
      ),
      measureScenario('outside dashed join cycle', (frame) =>
        createDefaultStroke({
          id: 'pp-312',
          width: 10,
          style: StrokeStyles.DASHED,
          position: StrokePositions.OUTSIDE,
          dashPattern: [20, 20],
          dashOffset: 0,
          joinType: [
            StrokeJoinTypes.MITER,
            StrokeJoinTypes.BEVEL,
            StrokeJoinTypes.ROUND
          ][frame % 3],
          color: '#d51a1a'
        })
      ),
      measureScenario('inside dashed miter slider', (frame) =>
        createDefaultStroke({
          id: 'pp-312',
          width: 10,
          style: StrokeStyles.DASHED,
          position: StrokePositions.INSIDE,
          dashPattern: [20, 20],
          dashOffset: 0,
          joinType: StrokeJoinTypes.MITER,
          miterAngle: 8 + (frame % 80),
          color: '#d51a1a'
        })
      ),
      measureScenario('inside dashed paint opacity slider', (frame) =>
        createDefaultStroke({
          id: 'pp-312',
          width: 10,
          style: StrokeStyles.DASHED,
          position: StrokePositions.INSIDE,
          dashPattern: [20, 20],
          dashOffset: 0,
          color: frame % 2 === 0 ? '#d51a1a' : '#1ad57d',
          opacity: 30 + (frame % 70)
        })
      ),
      measureScenario('inside dashed visible toggle', (frame) =>
        createDefaultStroke({
          id: 'pp-312',
          width: 10,
          style: StrokeStyles.DASHED,
          position: StrokePositions.INSIDE,
          dashPattern: [20, 20],
          dashOffset: 0,
          visible: frame % 2 === 0,
          color: '#d51a1a'
        })
      ),
      measureScenario('inside solid cap cycle', (frame) =>
        createDefaultStroke({
          id: 'pp-312',
          width: 10,
          style: StrokeStyles.SOLID,
          position: StrokePositions.INSIDE,
          capType: [
            StrokeCapTypes.BUTT,
            StrokeCapTypes.SQUARE,
            StrokeCapTypes.ROUND
          ][frame % 3],
          joinType: StrokeJoinTypes.ROUND,
          color: '#d51a1a',
          opacity: 0.5
        })
      ),
      measureScenario('inside solid join cycle', (frame) =>
        createDefaultStroke({
          id: 'pp-312',
          width: 10,
          style: StrokeStyles.SOLID,
          position: StrokePositions.INSIDE,
          capType: StrokeCapTypes.ROUND,
          joinType: [
            StrokeJoinTypes.MITER,
            StrokeJoinTypes.BEVEL,
            StrokeJoinTypes.ROUND
          ][frame % 3],
          color: '#d51a1a',
          opacity: 0.5
        })
      ),
      measureScenario('inside solid opacity slider', (frame) =>
        createDefaultStroke({
          id: 'pp-312',
          width: 10,
          style: StrokeStyles.SOLID,
          position: StrokePositions.INSIDE,
          capType: StrokeCapTypes.ROUND,
          joinType: StrokeJoinTypes.ROUND,
          color: '#d51a1a',
          opacity: 30 + (frame % 70)
        })
      )
    ]

    process.stdout.write(
      `STAR_PARAM_SWITCH_METRICS ${JSON.stringify({
        measurementScope: PERFORMANCE_MEASUREMENT_SCOPE,
        rendererCoverage: RENDERER_COVERAGE,
        doesNotMeasureRenderer: DOES_NOT_MEASURE_RENDERER,
        metrics
      })}\n`
    )
    expect(metrics.every((metric) => metric.invalidFrameCount === 0)).toBe(true)
    const getMetric = (label: string) => {
      const metric = metrics.find((entry) => entry.label === label)
      if (!metric) {
        throw new Error(`Missing stroke parameter switch metric: ${label}`)
      }
      return metric
    }
    const getGeometryReuseCount = (label: string) => {
      const counters = getMetric(label).counters
      return (
        (counters['resolved-geometry-model-cache-hit'] ?? 0) +
        (counters['resolved-geometry-frame-cache-reused'] ?? 0)
      )
    }

    expect(
      getMetric('inside dashed cap cycle').counters[
        'stroke-stage-cache:product-geometry-hit'
      ] ?? 0
    ).toBeGreaterThanOrEqual(FRAME_COUNT - 3)
    expect(getGeometryReuseCount('outside dashed cap cycle')).toBeGreaterThan(0)
    expect(
      getMetric('outside dashed cap cycle').counters[
        'stroke-stage-cache:product-geometry-store'
      ] ?? 0
    ).toBeGreaterThan(0)
    expect(getGeometryReuseCount('outside dashed join cycle')).toBeGreaterThan(
      0
    )
    expect(
      getMetric('outside dashed join cycle').counters[
        'stroke-stage-cache:product-geometry-store'
      ] ?? 0
    ).toBeGreaterThan(0)
    expect(
      getMetric('inside dashed paint opacity slider').counters[
        'stroke-stage-cache:product-geometry-hit'
      ] ?? 0
    ).toBeGreaterThanOrEqual(FRAME_COUNT - 1)
    expect(
      getMetric('inside dashed visible toggle').counters[
        'stroke-stage-cache:render-output-hidden'
      ] ?? 0
    ).toBeGreaterThanOrEqual(Math.floor(FRAME_COUNT / 2))
    expect(getGeometryReuseCount('inside solid cap cycle')).toBeGreaterThan(0)
    expect(
      getMetric('inside solid opacity slider').counters[
        'stroke-stage-cache:product-geometry-hit'
      ] ?? 0
    ).toBeGreaterThanOrEqual(FRAME_COUNT - 1)
    if (SHOULD_ENFORCE_PARAMETER_P95) {
      const maxP95Ms = Math.max(...metrics.map((metric) => metric.p95Ms))
      expect(maxP95Ms).toBeLessThanOrEqual(PARAMETER_SWITCH_P95_BUDGET_MS)
    }
  })

  it('should profile: break down reported closed star constrained dashed formal route', () => {
    const breakdown = measureInsideDashedFormalRouteBreakdown()
    process.stdout.write(
      `STAR_CONSTRAINED_DASHED_PHASES ${JSON.stringify({
        measurementScope: PERFORMANCE_MEASUREMENT_SCOPE,
        rendererCoverage: RENDERER_COVERAGE,
        doesNotMeasureRenderer: DOES_NOT_MEASURE_RENDERER,
        breakdown
      })}\n`
    )
    const phaseNames = new Set(
      breakdown.topPhases.map((phase) => phase.phaseName)
    )
    expect(phaseNames.has('constrained dashed packets')).toBe(true)
    expect(
      phaseNames.has('constrained dashed packets: inside aggregate descriptor')
    ).toBe(true)
    expect(
      (breakdown.counters['stroke-stage-cache:product-geometry-store'] ?? 0) +
        (breakdown.counters['stroke-stage-cache:product-geometry-hit'] ?? 0)
    ).toBeGreaterThan(0)
    expect(breakdown.invalidFrameCount).toBe(0)
  })
})
