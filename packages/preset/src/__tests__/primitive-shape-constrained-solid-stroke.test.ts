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
  __asyraSolidCenterStrokeExportPackets?: {
    bounds: { minX: number; minY: number; maxX: number; maxY: number }
  }[]
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
  type: 'rect' | 'oval',
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

describe('primitive shape constrained solid stroke wiring', () => {
  it('should run: rectangle inside stroke stays inside the legal owner domain on the main render path', () => {
    const graphic = runRenderStrategy('rect', {
      id: 'rect-inside',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 6,
          position: StrokePositions.INSIDE,
          style: StrokeStyles.SOLID
        })
      ]
    })

    expect(getProjectionMeshes(graphic)).toHaveLength(1)
    expect(graphic.__asyraSolidCenterStrokeExportPackets).toHaveLength(1)
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0].bounds).toEqual({
      minX: 0,
      minY: 0,
      maxX: 80,
      maxY: 40
    })
    expect(graphic.hitArea?.contains(1, 1)).toBe(true)
    expect(graphic.hitArea?.contains(-2, 1)).toBe(false)
  })

  it('should run: rectangle outside stroke stays outside the legal owner domain on the main render path', () => {
    const graphic = runRenderStrategy('rect', {
      id: 'rect-outside',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      fills: [createDefaultFill({ color: '#cccccc', visible: true })],
      strokes: [
        createDefaultStroke({
          width: 6,
          position: StrokePositions.OUTSIDE,
          style: StrokeStyles.SOLID
        })
      ]
    })

    expect(getProjectionMeshes(graphic)).toHaveLength(1)
    expect(graphic.__asyraSolidCenterStrokeExportPackets).toHaveLength(1)
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0].bounds).toEqual({
      minX: -6,
      minY: -6,
      maxX: 86,
      maxY: 46
    })
    expect(graphic.hitArea?.contains(40, 20)).toBe(true)
    expect(graphic.hitArea?.contains(-2, 1)).toBe(true)
    expect(graphic.hitArea?.contains(-10, -10)).toBe(false)
  })

  it('should run: oval inside stroke stays inside the legal owner domain on the main render path', () => {
    const graphic = runRenderStrategy('oval', {
      id: 'oval-inside',
      x: 0,
      y: 0,
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

    expect(getProjectionMeshes(graphic)).toHaveLength(1)
    expect(graphic.__asyraSolidCenterStrokeExportPackets).toHaveLength(1)
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0].bounds).toEqual({
      minX: 0,
      minY: 0,
      maxX: 72,
      maxY: 48
    })
    expect(graphic.hitArea?.contains(2, 24)).toBe(true)
    expect(graphic.hitArea?.contains(-2, 24)).toBe(false)
  })
})
