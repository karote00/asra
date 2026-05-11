import { beforeAll, describe, expect, it } from 'vitest'
import { BehaviorSubject, Subscription } from 'rxjs'
import { Container } from 'pixi.js'
import core, {
  VECTOR_TOKENS,
  renderStrategyRegistry,
  type RenderLayerRegistration,
  type VectorNetwork,
  type VectorPointNode,
  type VectorSegment
} from '@asyra/core'
import {
  StrokeCapTypes,
  StrokePositions,
  StrokeStyles,
  createDefaultStroke
} from '@asyra/utils'
import { applyPreset } from '../preset'
import type { PresetDependencies } from '../types'
import { createReportedRoundInsideDashedStarVectorData } from './inside-dashed-fixtures'

type PipelineDragKind = 'anchor' | 'in-control' | 'out-control'
type PipelineVectorData = Omit<
  ReturnType<typeof createReportedRoundInsideDashedStarVectorData>,
  'points' | 'segments' | 'networks'
> & {
  points: Record<string, VectorPointNode>
  segments: Record<string, VectorSegment>
  networks: Record<string, VectorNetwork>
  strokeDebugOptions?: {
    disableVisualOverlapCollapse?: boolean
  }
}

const FRAME_COUNT = Number(process.env.ASYRA_STROKE_DRAG_PIPELINE_FRAMES ?? 120)
const WARMUP_FRAMES = Math.min(20, Math.max(0, Math.floor(FRAME_COUNT / 10)))
const VISUAL_FRAME_BUDGET_MS = 8.33
const SHOULD_ENFORCE_VISUAL_FRAME_BUDGET =
  process.env.ASYRA_STROKE_DRAG_PIPELINE_ENFORCE_120FPS === '1'
const describeProfile =
  process.env.ASYRA_STROKE_DRAG_PIPELINE_PROFILE === '1'
    ? describe
    : describe.skip

let currentVectorData: PipelineVectorData =
  createReportedRoundInsideDashedStarVectorData()
let currentMouseWorkspacePos = { x: 0, y: 0 }
const registeredLayers = new Map<string, RenderLayerRegistration>()
const systemPropertyMap = new Map<string, BehaviorSubject<unknown>>()

const getSystemPropertyValue = <T>(key: string): T | undefined =>
  systemPropertyMap.get(key)?.value as T | undefined

const setSystemPropertyForTest = (key: string, value: unknown) => {
  const state = systemPropertyMap.get(key)
  if (state) {
    state.next(value)
  } else {
    systemPropertyMap.set(key, new BehaviorSubject(value))
  }
  core.setSystemProperty(key, value)
}

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext =
    HTMLCanvasElement.prototype.getContext ?? (() => null)

  const presetDeps = {
    sceneTree: {
      getElementById: (elementId: string) =>
        elementId === currentVectorData.id
          ? {
              get: (key: string) => (key === 'type' ? 'vector' : undefined),
              getAllComputedData: () => {
                ;(
                  globalThis as typeof globalThis & {
                    __asyraStrokePipelineCounterSink?: (
                      counterName: string,
                      value: number
                    ) => void
                  }
                ).__asyraStrokePipelineCounterSink?.(
                  'scene-get-all-computed-data-count',
                  1
                )
                return currentVectorData
              }
            }
          : undefined
    },
    systemContext: {
      getManagedProperty: <T>(key: string) => getSystemPropertyValue<T>(key),
      getSystemContextSnapshot: () => ({
        primaryTool: 'pen',
        mousePosition: currentMouseWorkspacePos
      })
    },
    render: {
      getViewportPosition: () => ({ x: 0, y: 0 }),
      getViewportScale: () => 1,
      getMousePosInWorkspace: () => currentMouseWorkspacePos,
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
      registerRenderLayer: (registration: RenderLayerRegistration) => {
        registeredLayers.set(registration.name, registration)
      },
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
  core.defineSystemProperty('selectedVectorPoint', null)
  core.defineSystemProperty('hoveredVectorPoint', null)
  core.defineSystemProperty('selectedVectorSegment', null)
  core.defineSystemProperty('hoveredVectorSegment', null)
  core.defineSystemProperty('hoveredVectorSegmentInsertPoint', null)
  core.defineSystemProperty('pathEditingStartNewSubpath', false)
})

class RecordingVectorGraphic extends Container {
  __asyraVectorDragVisualMode?: boolean
  __asyraStrokeMeshCache?: Map<string, { kind?: string }>

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

const getPercentile = (values: number[], percentile: number) => {
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * percentile) - 1)
  )
  return sorted[index] ?? 0
}

const measurePipelinePhase = <T>(phaseName: string, run: () => T): T => {
  const start = performance.now()
  try {
    return run()
  } finally {
    ;(
      globalThis as typeof globalThis & {
        __asyraVectorRenderPhaseSink?: (
          phaseName: string,
          durationMs: number
        ) => void
      }
    ).__asyraVectorRenderPhaseSink?.(phaseName, performance.now() - start)
  }
}

const addCounter = (counterName: string, value = 1) => {
  ;(
    globalThis as typeof globalThis & {
      __asyraStrokePipelineCounterSink?: (
        counterName: string,
        value: number
      ) => void
    }
  ).__asyraStrokePipelineCounterSink?.(counterName, value)
}

const createStroke = (capType: 'butt' | 'square' | 'round') =>
  createDefaultStroke({
    id: `pipeline-inside-dashed-${capType}`,
    width: 10,
    style: StrokeStyles.DASHED,
    position: StrokePositions.INSIDE,
    capType,
    dashPattern: [20, 20],
    dashOffset: 0,
    color: '#d51a1a'
  })

const createCenterSolidStroke = () =>
  createDefaultStroke({
    id: 'pipeline-center-solid',
    width: 10,
    style: StrokeStyles.SOLID,
    position: StrokePositions.CENTER,
    capType: StrokeCapTypes.ROUND,
    color: '#d51a1a'
  })

const createInitialVectorData = (
  kind: PipelineDragKind,
  stroke: ReturnType<typeof createDefaultStroke>
): PipelineVectorData => ({
  ...createReportedRoundInsideDashedStarVectorData(),
  id: `pipeline-drag:${kind}:${stroke.id}`,
  strokes: [stroke],
  strokeDebugOptions: {
    disableVisualOverlapCollapse: false
  }
})

const getPointTargetPosition = (
  point: VectorPointNode,
  kind: PipelineDragKind
) => {
  if (kind === 'anchor') {
    return { x: point.x, y: point.y }
  }

  return { x: point.x, y: point.y }
}

const getUpdatedPointIds = (kind: PipelineDragKind) => {
  if (kind === 'anchor') {
    return ['tp-52', 'tp-52:in', 'tp-52:out']
  }

  return [kind === 'in-control' ? 'tp-52:in' : 'tp-52:out']
}

const getAffectedSegmentIds = (kind: PipelineDragKind) =>
  kind === 'anchor'
    ? ['ts-84', 'ts-85']
    : [kind === 'in-control' ? 'ts-84' : 'ts-85']

const updatePipelineVectorPoint = (
  kind: PipelineDragKind,
  frame: number,
  initialData: PipelineVectorData
) =>
  measurePipelinePhase('pen-tool:update', () => {
    const deltaX = Math.sin(frame / 7) * 18
    const deltaY = Math.cos(frame / 9) * 14
    currentMouseWorkspacePos = {
      x: deltaX,
      y: deltaY
    }

    const topology = measurePipelinePhase('vector-api:topology-read', () => {
      addCounter('vector-api-topology-read-count')
      addCounter(
        'vector-api-topology-normalize-point-count',
        Object.keys(currentVectorData.points).length
      )
      addCounter(
        'vector-api-topology-normalize-segment-count',
        Object.keys(currentVectorData.segments).length
      )
      return {
        points: currentVectorData.points,
        segments: currentVectorData.segments,
        networks: currentVectorData.networks
      }
    })

    const nextPoints = measurePipelinePhase(
      'vector-api:topology-update',
      () => {
        const updatedPointIds = getUpdatedPointIds(kind)
        const points = { ...topology.points }
        updatedPointIds.forEach((pointId) => {
          const currentPoint = points[pointId]
          const initialPoint = initialData.points[pointId]
          if (!currentPoint || !initialPoint) {
            return
          }

          const initialTarget = getPointTargetPosition(initialPoint, kind)
          points[pointId] = {
            ...currentPoint,
            x: initialTarget.x + deltaX,
            y: initialTarget.y + deltaY
          }
        })
        addCounter(
          'vector-api-known-affected-segment-count',
          getAffectedSegmentIds(kind).length
        )
        return points
      }
    )

    measurePipelinePhase('vector-api:commit', () => {
      currentVectorData = {
        ...currentVectorData,
        points: nextPoints
      }
      addCounter('vector-api-computed-patch-key-count', 1)
    })
  })

const renderVectorFrame = (
  graphic: RecordingVectorGraphic,
  data: PipelineVectorData
) => {
  const strategy = renderStrategyRegistry.get('vector')
  expect(strategy).toBeTypeOf('function')
  ;(
    strategy as unknown as (
      target: RecordingVectorGraphic,
      data: PipelineVectorData
    ) => void
  )(graphic, data)
}

const renderOverlayFrame = () => {
  const layer = registeredLayers.get('vector-editing-layer')
  expect(layer).toBeDefined()
  layer?.update?.()
}

const setPathEditingState = (
  data: PipelineVectorData,
  kind: PipelineDragKind
) => {
  setSystemPropertyForTest('pathEditingVectorId', data.id)
  setSystemPropertyForTest('pathEditingMode', true)
  setSystemPropertyForTest('mouseDragging', true)
  setSystemPropertyForTest('mouseDown', true)
  setSystemPropertyForTest('selectedVectorPoint', {
    elementId: data.id,
    pointId: 'tp-52',
    index: 4,
    target:
      kind === 'anchor'
        ? VECTOR_TOKENS.POINT.TARGET.ANCHOR
        : kind === 'in-control'
          ? VECTOR_TOKENS.POINT.TARGET.IN_HANDLE
          : VECTOR_TOKENS.POINT.TARGET.OUT_HANDLE,
    x: data.points['tp-52'].x,
    y: data.points['tp-52'].y
  })
}

const clearInteractionState = () => {
  setSystemPropertyForTest('pathEditingVectorId', null)
  setSystemPropertyForTest('pathEditingMode', false)
  setSystemPropertyForTest('mouseDragging', false)
  setSystemPropertyForTest('mouseDown', false)
  setSystemPropertyForTest('selectedVectorPoint', null)
}

const measurePipelineScenario = (
  label: string,
  kind: PipelineDragKind,
  stroke: ReturnType<typeof createDefaultStroke>
) => {
  const initialData = createInitialVectorData(kind, stroke)
  currentVectorData = initialData
  setPathEditingState(initialData, kind)
  const graphic = new RecordingVectorGraphic()
  const frameTimes: number[] = []
  const phaseTotals: Record<string, number> = {}
  const counters: Record<string, number> = {}
  let invalidFrameCount = 0

  ;(
    globalThis as typeof globalThis & {
      __asyraVectorRenderPhaseSink?: (
        phaseName: string,
        durationMs: number
      ) => void
      __asyraStrokePipelineCounterSink?: (
        counterName: string,
        value: number
      ) => void
    }
  ).__asyraVectorRenderPhaseSink = (phaseName, durationMs) => {
    phaseTotals[phaseName] = (phaseTotals[phaseName] ?? 0) + durationMs
  }
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
    for (let frame = 0; frame < FRAME_COUNT; frame += 1) {
      const start = performance.now()
      updatePipelineVectorPoint(kind, frame, initialData)
      renderVectorFrame(graphic, currentVectorData)
      renderOverlayFrame()
      const end = performance.now()

      if (frame >= WARMUP_FRAMES) {
        frameTimes.push(end - start)
      }
      if (graphic.__asyraVectorDragVisualMode !== true) {
        invalidFrameCount += 1
      }
    }
  } finally {
    ;(
      globalThis as typeof globalThis & {
        __asyraVectorRenderPhaseSink?: (
          phaseName: string,
          durationMs: number
        ) => void
        __asyraStrokePipelineCounterSink?: (
          counterName: string,
          value: number
        ) => void
      }
    ).__asyraVectorRenderPhaseSink = undefined
    ;(
      globalThis as typeof globalThis & {
        __asyraStrokePipelineCounterSink?: (
          counterName: string,
          value: number
        ) => void
      }
    ).__asyraStrokePipelineCounterSink = undefined
    clearInteractionState()
  }

  return {
    label,
    averageMs:
      frameTimes.reduce((total, value) => total + value, 0) / frameTimes.length,
    p95Ms: getPercentile(frameTimes, 0.95),
    maxMs: Math.max(...frameTimes),
    invalidFrameCount,
    phases: Object.fromEntries(
      Object.entries(phaseTotals).map(([phaseName, totalMs]) => [
        phaseName,
        totalMs / FRAME_COUNT
      ])
    ),
    counters: Object.fromEntries(
      Object.entries(counters).map(([counterName, total]) => [
        counterName,
        total / FRAME_COUNT
      ])
    )
  }
}

describeProfile('stroke drag full pipeline performance profile', () => {
  it('should profile: path editing drag update, vector render, and editing overlay', () => {
    const dragKinds = ['anchor', 'in-control', 'out-control'] as const
    const strokes = [
      createStroke('butt'),
      createStroke('square'),
      createStroke('round'),
      createCenterSolidStroke()
    ]
    const metrics = dragKinds.flatMap((kind) =>
      strokes.map((stroke) =>
        measurePipelineScenario(`${kind}:${stroke.id}`, kind, stroke)
      )
    )

    const maxP95Ms = Math.max(...metrics.map((metric) => metric.p95Ms))
    process.stdout.write(
      `STROKE_DRAG_PIPELINE_METRICS ${JSON.stringify({
        budgetMs: VISUAL_FRAME_BUDGET_MS,
        enforceBudget: SHOULD_ENFORCE_VISUAL_FRAME_BUDGET,
        maxP95Ms,
        metrics
      })}\n`
    )

    expect(metrics.every((metric) => metric.invalidFrameCount === 0)).toBe(true)
    expect(
      metrics.some(
        (metric) =>
          (metric.counters['scene-get-all-computed-data-count'] ?? 0) > 0
      )
    ).toBe(true)
    expect(
      metrics.every(
        (metric) =>
          (metric.counters['stroke-render-coordinate-signature-fallback'] ??
            0) === 0
      )
    ).toBe(true)
    expect(
      metrics.every((metric) =>
        Object.prototype.hasOwnProperty.call(
          metric.phases,
          'visual overlap collapse'
        )
      )
    ).toBe(true)
    expect(
      metrics.every(
        (metric) =>
          (metric.counters[
            'visual-overlap-collapse-polygon-cache-key-fallback'
          ] ?? 0) === 0
      )
    ).toBe(true)
    const dashedMetrics = metrics.filter((metric) =>
      metric.label.includes('pipeline-inside-dashed')
    )
    expect(
      dashedMetrics.every((metric) =>
        Object.prototype.hasOwnProperty.call(
          metric.phases,
          'stroke product visual compiler'
        )
      )
    ).toBe(true)
    expect(
      dashedMetrics.every(
        (metric) =>
          !Object.prototype.hasOwnProperty.call(
            metric.phases,
            'constrained dashed candidates'
          )
      )
    ).toBe(true)
    expect(
      dashedMetrics.every(
        (metric) =>
          (metric.counters['stroke-product-visual-compiler-entry-count'] ?? 0) >
          0
      )
    ).toBe(true)
    expect(
      dashedMetrics.every(
        (metric) => (metric.counters['sweep-plan-build-count'] ?? 0) === 1
      )
    ).toBe(true)
    expect(
      dashedMetrics.every(
        (metric) => (metric.counters['dash-visible-interval-count'] ?? 0) > 0
      )
    ).toBe(true)
    expect(
      dashedMetrics.every(
        (metric) => (metric.counters['sweep-render-span-count'] ?? 0) > 0
      )
    ).toBe(true)
    expect(
      dashedMetrics.every(
        (metric) => (metric.counters['interval-sweep-count'] ?? 0) === 0
      )
    ).toBe(true)
    expect(
      dashedMetrics.every(
        (metric) => (metric.counters['final-coverage-builder-hit'] ?? 0) === 0
      )
    ).toBe(true)
    if (SHOULD_ENFORCE_VISUAL_FRAME_BUDGET) {
      expect(maxP95Ms).toBeLessThan(VISUAL_FRAME_BUDGET_MS)
    } else {
      expect(maxP95Ms).toBeGreaterThan(0)
    }
  })
})
