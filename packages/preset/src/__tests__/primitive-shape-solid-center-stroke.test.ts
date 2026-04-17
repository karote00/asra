import { beforeAll, describe, expect, it } from 'vitest'
import { BehaviorSubject, Subscription } from 'rxjs'
import { Container, Mesh } from 'pixi.js'
import core, { renderStrategyRegistry } from '@asyra/core'
import {
  StrokePositions,
  StrokeStyles,
  createDefaultFill,
  createDefaultStroke
} from '@asyra/utils'
import { applyPreset } from '../preset'
import type { PresetDependencies } from '../types'

beforeAll(() => {
  core.defineSystemProperty<string | null>('pathEditingVectorId', null)
  core.defineSystemProperty<boolean>('pathEditingMode', false)
  core.defineSystemProperty<boolean>('mouseDragging', false)

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
})

class RecordingShapeGraphic extends Container {
  __asyraSolidCenterStrokeExportPackets?: unknown[]
  hitArea?: { contains: (x: number, y: number) => boolean } | null

  clear() {
    return this
  }

  rect() {
    return this
  }

  ellipse() {
    return this
  }

  fill() {
    return this
  }
}

const getProjectionMeshes = (host: Container) =>
  host.children.flatMap((child) => {
    if (!(child instanceof Container)) {
      return []
    }

    return child.children.filter(
      (grandchild): grandchild is Mesh => grandchild instanceof Mesh
    )
  })

const runRenderStrategy = (
  type: 'rect' | 'frame' | 'oval',
  data: Record<string, unknown>
) => {
  const strategy = renderStrategyRegistry.get(type)
  expect(strategy).toBeTypeOf('function')

  const graphic = new RecordingShapeGraphic()
  ;(
    strategy as unknown as (
      graphic: RecordingShapeGraphic,
      data: Record<string, unknown>
    ) => void
  )(
    graphic,
    data
  )

  return graphic
}

describe('primitive shape solid-center stroke wiring', () => {
  it('should run: rectangle render strategy emits solid-center mesh for supported stroke', () => {
    const graphic = runRenderStrategy('rect', {
      id: 'rect-1',
      x: 12,
      y: 18,
      width: 80,
      height: 40,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 6,
          position: StrokePositions.CENTER,
          style: StrokeStyles.SOLID
        })
      ]
    })

    expect(getProjectionMeshes(graphic)).toHaveLength(1)
    expect(graphic.__asyraSolidCenterStrokeExportPackets).toHaveLength(1)
    expect(graphic.hitArea?.contains(1, 1)).toBe(true)
    expect(graphic.hitArea?.contains(40, 20)).toBe(false)
  })

  it('should run: rectangle render strategy preserves fill hover hit while still exposing stroke hit', () => {
    const graphic = runRenderStrategy('rect', {
      id: 'rect-fill-hit',
      x: 12,
      y: 18,
      width: 80,
      height: 40,
      fills: [createDefaultFill({ color: '#cccccc', visible: true })],
      strokes: [
        createDefaultStroke({
          width: 6,
          position: StrokePositions.CENTER,
          style: StrokeStyles.SOLID
        })
      ]
    })

    expect(graphic.hitArea?.contains(40, 20)).toBe(true)
    expect(graphic.hitArea?.contains(-2, 1)).toBe(true)
    expect(graphic.hitArea?.contains(100, 100)).toBe(false)
  })

  it('should not run: rectangle render strategy ignores unsupported dashed stroke slices', () => {
    const graphic = runRenderStrategy('rect', {
      id: 'rect-1',
      x: 12,
      y: 18,
      width: 80,
      height: 40,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 6,
          position: StrokePositions.CENTER,
          style: StrokeStyles.DASHED
        })
      ]
    })

    expect(getProjectionMeshes(graphic)).toHaveLength(0)
  })

  it('should not run: frame render strategy does not emit stroke mesh even when strokes are provided', () => {
    const graphic = runRenderStrategy('frame', {
      id: 'frame-1',
      x: 24,
      y: 30,
      width: 120,
      height: 64,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 4,
          position: StrokePositions.CENTER,
          style: StrokeStyles.SOLID
        })
      ]
    })

    expect(getProjectionMeshes(graphic)).toHaveLength(0)
  })

  it('should run: oval render strategy emits solid-center mesh for supported stroke', () => {
    const graphic = runRenderStrategy('oval', {
      id: 'oval-1',
      x: 8,
      y: 10,
      width: 72,
      height: 48,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 5,
          position: StrokePositions.CENTER,
          style: StrokeStyles.SOLID
        })
      ]
    })

    expect(getProjectionMeshes(graphic)).toHaveLength(1)
    expect(graphic.__asyraSolidCenterStrokeExportPackets).toHaveLength(1)
    expect(graphic.hitArea?.contains(2, 24)).toBe(true)
    expect(graphic.hitArea?.contains(36, 24)).toBe(false)
  })

  it('should run: oval render strategy preserves fill hover hit while still exposing stroke hit', () => {
    const graphic = runRenderStrategy('oval', {
      id: 'oval-fill-hit',
      x: 8,
      y: 10,
      width: 72,
      height: 48,
      fills: [createDefaultFill({ color: '#cccccc', visible: true })],
      strokes: [
        createDefaultStroke({
          width: 5,
          position: StrokePositions.CENTER,
          style: StrokeStyles.SOLID
        })
      ]
    })

    expect(graphic.hitArea?.contains(36, 24)).toBe(true)
    expect(graphic.hitArea?.contains(2, 24)).toBe(true)
    expect(graphic.hitArea?.contains(80, 24)).toBe(false)
  })

  it('should not run: frame render strategy keeps no stroke mesh after rerender with any stroke payload', () => {
    const graphic = runRenderStrategy('frame', {
      id: 'frame-1',
      x: 24,
      y: 30,
      width: 120,
      height: 64,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 4,
          position: StrokePositions.CENTER,
          style: StrokeStyles.SOLID
        })
      ]
    })

    expect(getProjectionMeshes(graphic)).toHaveLength(0)

    const strategy = renderStrategyRegistry.get('frame')
    ;(
      strategy as unknown as (
        graphic: RecordingShapeGraphic,
        data: Record<string, unknown>
      ) => void
    )(
      graphic,
      {
        id: 'frame-1',
        x: 24,
        y: 30,
        width: 120,
        height: 64,
        fills: [],
        strokes: [
          createDefaultStroke({
            width: 4,
            position: StrokePositions.INSIDE
          })
        ]
      }
    )

    expect(getProjectionMeshes(graphic)).toHaveLength(0)
  })

  it('should not run: oval render strategy ignores unsupported constrained stroke slices', () => {
    const graphic = runRenderStrategy('oval', {
      id: 'oval-1',
      x: 8,
      y: 10,
      width: 72,
      height: 48,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 5,
          position: StrokePositions.INSIDE,
          style: StrokeStyles.SOLID
        })
      ]
    })

    expect(getProjectionMeshes(graphic)).toHaveLength(0)
  })

  it('should run: rectangle render strategy keeps full corner coverage for supported closed solid stroke', () => {
    const graphic = runRenderStrategy('rect', {
      id: 'rect-corner-coverage',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 6,
          position: StrokePositions.CENTER,
          style: StrokeStyles.SOLID
        })
      ]
    })

    expect(getProjectionMeshes(graphic)).toHaveLength(1)
  })
})
