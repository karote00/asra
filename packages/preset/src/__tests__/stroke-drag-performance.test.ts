import { beforeAll, describe, expect, it } from 'vitest'
import { BehaviorSubject, Subscription } from 'rxjs'
import { Container } from 'pixi.js'
import core, { renderStrategyRegistry } from '@asyra/core'
import {
  StrokeCapTypes,
  StrokePositions,
  StrokeStyles,
  createDefaultStroke
} from '@asyra/utils'
import { applyPreset } from '../preset'
import type { PresetDependencies } from '../types'
import { createReportedRoundInsideDashedStarVectorData } from './inside-dashed-fixtures'

const FRAME_COUNT = Number(process.env.ASYRA_STROKE_DRAG_FRAMES ?? 120)
const WARMUP_FRAMES = Math.min(20, Math.max(0, Math.floor(FRAME_COUNT / 10)))
const VISUAL_FRAME_BUDGET_MS = 8.33
const describeProfile =
  process.env.ASYRA_STROKE_DRAG_PROFILE === '1' ? describe : describe.skip

beforeAll(() => {
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
})

class RecordingVectorGraphic extends Container {
  __asyraVectorDragVisualMode?: boolean
  __asyraSolidCenterStrokeExportPackets?: unknown[]
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

const getPercentile = (values: number[], percentile: number) => {
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * percentile) - 1)
  )
  return sorted[index] ?? 0
}

const createStroke = (capType: 'butt' | 'square' | 'round') =>
  createDefaultStroke({
    id: `drag-inside-dashed-${capType}`,
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
    id: 'drag-center-solid',
    width: 10,
    style: StrokeStyles.SOLID,
    position: StrokePositions.CENTER,
    capType: StrokeCapTypes.ROUND,
    color: '#d51a1a'
  })

const mutateDragFrame = (
  frame: number,
  kind: 'anchor' | 'in-control' | 'out-control'
) => {
  const base = createReportedRoundInsideDashedStarVectorData()
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
    id: `drag-profile:${kind}`,
    points,
    strokeDebugOptions: {
      disableVisualOverlapCollapse: false
    }
  }
}

const measureDragScenario = (
  label: string,
  kind: 'anchor' | 'in-control' | 'out-control',
  stroke: ReturnType<typeof createDefaultStroke>
) => {
  const strategy = renderStrategyRegistry.get('vector')
  expect(strategy).toBeTypeOf('function')

  const graphic = new RecordingVectorGraphic()
  core.setSystemProperty('pathEditingVectorId', `drag-profile:${kind}`)
  core.setSystemProperty('pathEditingMode', true)
  core.setSystemProperty('mouseDragging', true)
  core.setSystemProperty('mouseDown', true)

  const frameTimes: number[] = []
  let invalidFrameCount = 0
  const phaseTotals: Record<string, number> = {}

  for (let frame = 0; frame < FRAME_COUNT; frame += 1) {
    const data = mutateDragFrame(frame, kind)
    const start = performance.now()
    ;(
      strategy as unknown as (
        target: RecordingVectorGraphic,
        data: Record<string, unknown>
      ) => void
    )(graphic, {
      ...data,
      strokes: [stroke]
    })
    const end = performance.now()

    if (frame >= WARMUP_FRAMES) {
      frameTimes.push(end - start)
    }
    if (graphic.__asyraVectorDragVisualMode !== true) {
      invalidFrameCount += 1
    }
  }

  const phaseFrameCount = Math.min(24, FRAME_COUNT)
  ;(
    globalThis as typeof globalThis & {
      __asyraVectorRenderPhaseSink?: (
        phaseName: string,
        durationMs: number
      ) => void
    }
  ).__asyraVectorRenderPhaseSink = (phaseName, durationMs) => {
    phaseTotals[phaseName] = (phaseTotals[phaseName] ?? 0) + durationMs
  }
  for (let frame = 0; frame < phaseFrameCount; frame += 1) {
    const data = mutateDragFrame(frame, kind)
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

  core.setSystemProperty('pathEditingVectorId', null)
  core.setSystemProperty('pathEditingMode', false)
  core.setSystemProperty('mouseDragging', false)
  core.setSystemProperty('mouseDown', false)
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
    averageMs:
      frameTimes.reduce((total, value) => total + value, 0) / frameTimes.length,
    p95Ms: getPercentile(frameTimes, 0.95),
    maxMs: Math.max(...frameTimes),
    invalidFrameCount,
    phases: Object.fromEntries(
      Object.entries(phaseTotals).map(([phaseName, totalMs]) => [
        phaseName,
        totalMs / phaseFrameCount
      ])
    )
  }
}

describeProfile('stroke drag performance profile', () => {
  it('should profile: render anchor and curve-handle drag visual updates inside 120fps budget', () => {
    const dragKinds = ['anchor', 'in-control', 'out-control'] as const
    const strokes = [
      createStroke('butt'),
      createStroke('square'),
      createStroke('round'),
      createCenterSolidStroke()
    ]
    const metrics = dragKinds.flatMap((kind) =>
      strokes.map((stroke) =>
        measureDragScenario(`${kind}:${stroke.id}`, kind, stroke)
      )
    )

    process.stdout.write(`STROKE_DRAG_METRICS ${JSON.stringify(metrics)}\n`)
    expect(metrics.every((metric) => metric.invalidFrameCount === 0)).toBe(true)
    expect(Math.max(...metrics.map((metric) => metric.p95Ms))).toBeLessThan(
      VISUAL_FRAME_BUDGET_MS
    )
  })
})
