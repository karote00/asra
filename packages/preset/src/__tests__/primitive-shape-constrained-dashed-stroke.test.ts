import { beforeAll, describe, expect, it } from 'vitest'
import { BehaviorSubject, Subscription } from 'rxjs'
import { Container, Graphics, Mesh } from 'pixi.js'
import core, { renderStrategyRegistry } from '@asyra/core'
import {
  FillKinds,
  StrokePositions,
  StrokeStyles,
  StrokeJoinTypes,
  createDefaultGradientData,
  createDefaultStroke
} from '@asyra/utils'
import { applyPreset } from '../preset'
import type { PresetDependencies } from '../types'

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext =
    HTMLCanvasElement.prototype.getContext ??
    (() => null)

  const originalGetContext = HTMLCanvasElement.prototype.getContext

  HTMLCanvasElement.prototype.getContext = function getContext(
    this: HTMLCanvasElement,
    type: string
  ) {
    if (type !== '2d') {
      return originalGetContext.call(
        this,
        type as never
      ) as RenderingContext | null
    }

    return {
      createLinearGradient: () => ({
        addColorStop: () => undefined
      }),
      createRadialGradient: () => ({
        addColorStop: () => undefined
      }),
      fillRect: () => undefined,
      clearRect: () => undefined,
      save: () => undefined,
      restore: () => undefined,
      translate: () => undefined,
      scale: () => undefined,
      rotate: () => undefined,
      setTransform: () => undefined
    } as unknown as CanvasRenderingContext2D
  } as typeof HTMLCanvasElement.prototype.getContext

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
      createRenderGradientFillStyle: (options: unknown) => ({
        fill: {
          mocked: true,
          options
        }
      })
    },
    presetDeps
  )
})

class RecordingShapeGraphic extends Container {
  __asyraSolidCenterStrokeExportPackets?: {
    geometryId: string
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

const getProjectionGraphics = (host: Container) =>
  host.children.flatMap((child) => {
    if (!(child instanceof Container)) {
      return []
    }

    return child.children.filter(
      (grandchild): grandchild is Graphics => grandchild instanceof Graphics
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

describe('primitive shape constrained dashed stroke wiring', () => {
  it('should run: rectangle render strategy promotes full-loop inside constrained dashed packets on the main product path', () => {
    const graphic = runRenderStrategy('rect', {
      id: 'rect-constrained-dashed-inside',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 6,
          position: StrokePositions.INSIDE,
          style: StrokeStyles.DASHED,
          dashPattern: [400, 20],
          dashOffset: 0
        })
      ]
    })

    expect(getProjectionMeshes(graphic)).toHaveLength(1)
    expect(graphic.__asyraSolidCenterStrokeExportPackets).toHaveLength(1)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.geometryId
    ).toContain(':constrained-dashed:')
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds).toEqual({
      minX: 0,
      minY: 0,
      maxX: 80,
      maxY: 40
    })
    expect(graphic.hitArea?.contains(1, 1)).toBe(true)
    expect(graphic.hitArea?.contains(40, 20)).toBe(false)
  })

  it('should run: rectangle render strategy promotes full-loop outside constrained dashed packets on the same Family A product path', () => {
    const graphic = runRenderStrategy('rect', {
      id: 'rect-constrained-dashed-outside',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 6,
          position: StrokePositions.OUTSIDE,
          style: StrokeStyles.DASHED,
          dashPattern: [400, 20],
          dashOffset: 0
        })
      ]
    })

    expect(getProjectionMeshes(graphic)).toHaveLength(1)
    expect(graphic.__asyraSolidCenterStrokeExportPackets).toHaveLength(1)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.geometryId
    ).toContain(':constrained-dashed:')
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds).toEqual({
      minX: -6,
      minY: -6,
      maxX: 86,
      maxY: 46
    })
    expect(graphic.hitArea?.contains(-2, 1)).toBe(true)
    expect(graphic.hitArea?.contains(40, 20)).toBe(false)
  })

  it('should run: rectangle render strategy promotes inside single-edge constrained dashed packets on the first Family B product path', () => {
    const graphic = runRenderStrategy('rect', {
      id: 'rect-constrained-dashed-single-edge-inside',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 6,
          position: StrokePositions.INSIDE,
          style: StrokeStyles.DASHED,
          dashPattern: [20, 220],
          dashOffset: 220
        })
      ]
    })

    expect(getProjectionMeshes(graphic)).toHaveLength(1)
    expect(graphic.__asyraSolidCenterStrokeExportPackets).toHaveLength(1)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.geometryId
    ).toContain(':constrained-dashed:')
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds).toEqual({
      minX: 20,
      minY: 0,
      maxX: 40,
      maxY: 6
    })
    expect(graphic.hitArea?.contains(30, 1)).toBe(true)
    expect(graphic.hitArea?.contains(60, 1)).toBe(false)
    expect(graphic.hitArea?.contains(30, 20)).toBe(false)
  })

  it('should run: rectangle render strategy promotes the next constrained dashed single-edge gradient-paint representative on the Phase 6 product path', () => {
    const graphic = runRenderStrategy('rect', {
      id: 'rect-constrained-dashed-single-edge-gradient-inside',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 6,
          position: StrokePositions.INSIDE,
          style: StrokeStyles.DASHED,
          dashPattern: [20, 220],
          dashOffset: 220,
          kind: FillKinds.GRADIENT,
          gradient: {
            ...createDefaultGradientData(),
            gradientHandles: [
              { x: 0, y: 0.5 },
              { x: 1, y: 0.5 }
            ]
          }
        })
      ]
    })

    expect(getProjectionMeshes(graphic)).toHaveLength(0)
    expect(getProjectionGraphics(graphic)).toHaveLength(1)
    expect(graphic.__asyraSolidCenterStrokeExportPackets).toHaveLength(1)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.geometryId
    ).toContain(':constrained-dashed:')
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds).toEqual({
      minX: 20,
      minY: 0,
      maxX: 40,
      maxY: 6
    })
    expect(graphic.hitArea?.contains(30, 1)).toBe(true)
    expect(graphic.hitArea?.contains(60, 1)).toBe(false)
    expect(graphic.hitArea?.contains(30, 20)).toBe(false)
  })

  it('should run: rectangle render strategy promotes the next constrained dashed round-cap representative on the Phase 5 product path', () => {
    const graphic = runRenderStrategy('rect', {
      id: 'rect-constrained-dashed-single-edge-round-cap',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 6,
          position: StrokePositions.INSIDE,
          style: StrokeStyles.DASHED,
          capType: 'round',
          dashPattern: [20, 220],
          dashOffset: 220
        })
      ]
    })

    expect(getProjectionMeshes(graphic)).toHaveLength(1)
    expect(graphic.__asyraSolidCenterStrokeExportPackets).toHaveLength(1)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.geometryId
    ).toContain(':constrained-dashed:')
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.minX
    ).toBeCloseTo(14, 6)
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.minY).toBe(0)
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxX).toBe(46)
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxY).toBe(6)
    expect(graphic.hitArea?.contains(16, 3)).toBe(true)
    expect(graphic.hitArea?.contains(50, 3)).toBe(false)
    expect(graphic.hitArea?.contains(40, 20)).toBe(false)
  })

  it('should run: rectangle render strategy promotes the next outside constrained dashed round-cap representative on the Phase 5 product path', () => {
    const graphic = runRenderStrategy('rect', {
      id: 'rect-constrained-dashed-single-edge-round-cap-outside',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 6,
          position: StrokePositions.OUTSIDE,
          style: StrokeStyles.DASHED,
          capType: 'round',
          dashPattern: [20, 220],
          dashOffset: 220
        })
      ]
    })

    expect(getProjectionMeshes(graphic)).toHaveLength(1)
    expect(graphic.__asyraSolidCenterStrokeExportPackets).toHaveLength(1)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.geometryId
    ).toContain(':constrained-dashed:')
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.minX
    ).toBeCloseTo(14, 6)
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.minY).toBe(-6)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxX
    ).toBeCloseTo(46, 6)
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxY).toBe(0)
    expect(graphic.hitArea?.contains(16, -3)).toBe(true)
    expect(graphic.hitArea?.contains(50, -3)).toBe(false)
    expect(graphic.hitArea?.contains(30, 2)).toBe(false)
  })

  it('should run: rectangle render strategy promotes outside single-edge constrained dashed packets on the same Family B product path', () => {
    const graphic = runRenderStrategy('rect', {
      id: 'rect-constrained-dashed-single-edge-outside',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 6,
          position: StrokePositions.OUTSIDE,
          style: StrokeStyles.DASHED,
          dashPattern: [20, 220],
          dashOffset: 220
        })
      ]
    })

    expect(getProjectionMeshes(graphic)).toHaveLength(1)
    expect(graphic.__asyraSolidCenterStrokeExportPackets).toHaveLength(1)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.geometryId
    ).toContain(':constrained-dashed:')
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds).toEqual({
      minX: 20,
      minY: -6,
      maxX: 40,
      maxY: 0
    })
    expect(graphic.hitArea?.contains(30, -2)).toBe(true)
    expect(graphic.hitArea?.contains(30, 1)).toBe(false)
    expect(graphic.hitArea?.contains(60, -2)).toBe(false)
  })

  it('should run: rectangle render strategy promotes the next outside single-edge constrained dashed gradient-paint representative on the Phase 6 product path', () => {
    const graphic = runRenderStrategy('rect', {
      id: 'rect-constrained-dashed-single-edge-gradient-outside',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 6,
          position: StrokePositions.OUTSIDE,
          style: StrokeStyles.DASHED,
          dashPattern: [20, 220],
          dashOffset: 220,
          kind: FillKinds.GRADIENT,
          gradient: {
            ...createDefaultGradientData(),
            gradientHandles: [
              { x: 0, y: 0.5 },
              { x: 1, y: 0.5 }
            ]
          }
        })
      ]
    })

    expect(getProjectionMeshes(graphic)).toHaveLength(0)
    expect(getProjectionGraphics(graphic)).toHaveLength(1)
    expect(graphic.__asyraSolidCenterStrokeExportPackets).toHaveLength(1)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.geometryId
    ).toContain(':constrained-dashed:')
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds).toEqual({
      minX: 20,
      minY: -6,
      maxX: 40,
      maxY: 0
    })
    expect(graphic.hitArea?.contains(30, -2)).toBe(true)
    expect(graphic.hitArea?.contains(30, 1)).toBe(false)
    expect(graphic.hitArea?.contains(60, -2)).toBe(false)
  })

  it('should run: rectangle render strategy promotes outside bevel corner-spanning constrained dashed packets on the next Family C product path', () => {
    const graphic = runRenderStrategy('rect', {
      id: 'rect-constrained-dashed-corner-spanning-bevel-outside',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 6,
          position: StrokePositions.OUTSIDE,
          style: StrokeStyles.DASHED,
          joinType: 'bevel',
          dashPattern: [40, 200],
          dashOffset: 180
        })
      ]
    })

    expect(getProjectionMeshes(graphic)).toHaveLength(1)
    expect(graphic.__asyraSolidCenterStrokeExportPackets).toHaveLength(1)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.geometryId
    ).toContain(':constrained-dashed:')
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds).toEqual({
      minX: 60,
      minY: -6,
      maxX: 86,
      maxY: 20
    })
    expect(graphic.hitArea?.contains(70, -2)).toBe(true)
    expect(graphic.hitArea?.contains(82, 12)).toBe(true)
    expect(graphic.hitArea?.contains(70, 1)).toBe(false)
    expect(graphic.hitArea?.contains(20, -2)).toBe(false)
    expect(graphic.hitArea?.contains(30, 20)).toBe(false)
  })

  it('should run: rectangle render strategy promotes the next outside bevel corner-spanning constrained dashed gradient-paint representative on the Phase 6 product path', () => {
    const graphic = runRenderStrategy('rect', {
      id: 'rect-constrained-dashed-corner-spanning-bevel-gradient-outside',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 6,
          position: StrokePositions.OUTSIDE,
          style: StrokeStyles.DASHED,
          joinType: 'bevel',
          dashPattern: [40, 200],
          dashOffset: 180,
          kind: FillKinds.GRADIENT,
          gradient: {
            ...createDefaultGradientData(),
            gradientHandles: [
              { x: 0, y: 0.5 },
              { x: 1, y: 0.5 }
            ]
          }
        })
      ]
    })

    expect(getProjectionMeshes(graphic)).toHaveLength(0)
    expect(getProjectionGraphics(graphic)).toHaveLength(1)
    expect(graphic.__asyraSolidCenterStrokeExportPackets).toHaveLength(1)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.geometryId
    ).toContain(':constrained-dashed:')
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds).toEqual({
      minX: 60,
      minY: -6,
      maxX: 86,
      maxY: 20
    })
    expect(graphic.hitArea?.contains(70, -2)).toBe(true)
    expect(graphic.hitArea?.contains(82, 12)).toBe(true)
    expect(graphic.hitArea?.contains(70, 1)).toBe(false)
    expect(graphic.hitArea?.contains(20, -2)).toBe(false)
    expect(graphic.hitArea?.contains(30, 20)).toBe(false)
  })

  it('should run: rectangle render strategy promotes outside miter corner-spanning constrained dashed packets on the next bounded Family C product path', () => {
    const graphic = runRenderStrategy('rect', {
      id: 'rect-constrained-dashed-corner-spanning-miter-outside',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 6,
          position: StrokePositions.OUTSIDE,
          style: StrokeStyles.DASHED,
          joinType: 'miter',
          dashPattern: [40, 200],
          dashOffset: 180
        })
      ]
    })

    expect(getProjectionMeshes(graphic)).toHaveLength(1)
    expect(graphic.__asyraSolidCenterStrokeExportPackets).toHaveLength(1)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.geometryId
    ).toContain(':constrained-dashed:')
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds).toEqual({
      minX: 60,
      minY: -6,
      maxX: 86,
      maxY: 20
    })
    expect(graphic.hitArea?.contains(70, -2)).toBe(true)
    expect(graphic.hitArea?.contains(82, 12)).toBe(true)
    expect(graphic.hitArea?.contains(70, 1)).toBe(false)
    expect(graphic.hitArea?.contains(20, -2)).toBe(false)
    expect(graphic.hitArea?.contains(30, 20)).toBe(false)
  })

  it('should run: rectangle render strategy promotes outside round corner-spanning constrained dashed packets on the uniform-width Family C product path', () => {
    const graphic = runRenderStrategy('rect', {
      id: 'rect-constrained-dashed-corner-spanning-round-outside',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 6,
          position: StrokePositions.OUTSIDE,
          style: StrokeStyles.DASHED,
          joinType: 'round',
          dashPattern: [40, 200],
          dashOffset: 180
        })
      ]
    })

    expect(getProjectionMeshes(graphic)).toHaveLength(1)
    expect(graphic.__asyraSolidCenterStrokeExportPackets).toHaveLength(1)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.geometryId
    ).toContain(':constrained-dashed:')
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds).toEqual({
      minX: 60,
      minY: -6,
      maxX: 86,
      maxY: 20
    })
    expect(graphic.hitArea?.contains(70, -2)).toBe(true)
    expect(graphic.hitArea?.contains(82, 12)).toBe(true)
    expect(graphic.hitArea?.contains(70, 1)).toBe(false)
    expect(graphic.hitArea?.contains(20, -2)).toBe(false)
    expect(graphic.hitArea?.contains(30, 20)).toBe(false)
  })

  it('should run: rectangle render strategy promotes inside bevel corner-spanning constrained dashed packets on the first Family C product path', () => {
    const graphic = runRenderStrategy('rect', {
      id: 'rect-constrained-dashed-corner-spanning-bevel-inside',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 6,
          position: StrokePositions.INSIDE,
          style: StrokeStyles.DASHED,
          joinType: 'bevel',
          dashPattern: [40, 200],
          dashOffset: 180
        })
      ]
    })

    expect(getProjectionMeshes(graphic)).toHaveLength(1)
    expect(graphic.__asyraSolidCenterStrokeExportPackets).toHaveLength(1)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.geometryId
    ).toContain(':constrained-dashed:')
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds).toEqual({
      minX: 60,
      minY: 0,
      maxX: 80,
      maxY: 20
    })
    expect(graphic.hitArea?.contains(70, 1)).toBe(true)
    expect(graphic.hitArea?.contains(78, 12)).toBe(true)
    expect(graphic.hitArea?.contains(20, 1)).toBe(false)
    expect(graphic.hitArea?.contains(30, 20)).toBe(false)
  })

  it('should run: rectangle render strategy promotes the first corner-spanning constrained dashed gradient-paint representative on the Phase 6 product path', () => {
    const graphic = runRenderStrategy('rect', {
      id: 'rect-constrained-dashed-corner-spanning-bevel-gradient-inside',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 6,
          position: StrokePositions.INSIDE,
          style: StrokeStyles.DASHED,
          joinType: 'bevel',
          dashPattern: [40, 200],
          dashOffset: 180,
          kind: FillKinds.GRADIENT,
          gradient: {
            ...createDefaultGradientData(),
            gradientHandles: [
              { x: 0, y: 0.5 },
              { x: 1, y: 0.5 }
            ]
          }
        })
      ]
    })

    expect(getProjectionMeshes(graphic)).toHaveLength(0)
    expect(getProjectionGraphics(graphic)).toHaveLength(1)
    expect(graphic.__asyraSolidCenterStrokeExportPackets).toHaveLength(1)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.geometryId
    ).toContain(':constrained-dashed:')
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds).toEqual({
      minX: 60,
      minY: 0,
      maxX: 80,
      maxY: 20
    })
    expect(graphic.hitArea?.contains(70, 1)).toBe(true)
    expect(graphic.hitArea?.contains(78, 12)).toBe(true)
    expect(graphic.hitArea?.contains(20, 1)).toBe(false)
    expect(graphic.hitArea?.contains(30, 20)).toBe(false)
  })

  it('should run: rectangle render strategy promotes inside miter corner-spanning constrained dashed packets on the next Family C product path', () => {
    const graphic = runRenderStrategy('rect', {
      id: 'rect-constrained-dashed-corner-spanning-miter-inside',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 6,
          position: StrokePositions.INSIDE,
          style: StrokeStyles.DASHED,
          joinType: 'miter',
          dashPattern: [40, 200],
          dashOffset: 180
        })
      ]
    })

    expect(getProjectionMeshes(graphic)).toHaveLength(1)
    expect(graphic.__asyraSolidCenterStrokeExportPackets).toHaveLength(1)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.geometryId
    ).toContain(':constrained-dashed:')
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds).toEqual({
      minX: 60,
      minY: 0,
      maxX: 80,
      maxY: 20
    })
    expect(graphic.hitArea?.contains(70, 1)).toBe(true)
    expect(graphic.hitArea?.contains(78, 12)).toBe(true)
    expect(graphic.hitArea?.contains(20, 1)).toBe(false)
    expect(graphic.hitArea?.contains(30, 20)).toBe(false)
  })

  it('should run: rectangle render strategy promotes inside round corner-spanning constrained dashed packets on the uniform-width Family C product path', () => {
    const graphic = runRenderStrategy('rect', {
      id: 'rect-constrained-dashed-corner-spanning-round-inside',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 6,
          position: StrokePositions.INSIDE,
          style: StrokeStyles.DASHED,
          joinType: 'round',
          dashPattern: [40, 200],
          dashOffset: 180
        })
      ]
    })

    expect(getProjectionMeshes(graphic)).toHaveLength(1)
    expect(graphic.__asyraSolidCenterStrokeExportPackets).toHaveLength(1)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.geometryId
    ).toContain(':constrained-dashed:')
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds).toEqual({
      minX: 60,
      minY: 0,
      maxX: 80,
      maxY: 20
    })
    expect(graphic.hitArea?.contains(70, 1)).toBe(true)
    expect(graphic.hitArea?.contains(78, 12)).toBe(true)
    expect(graphic.hitArea?.contains(20, 1)).toBe(false)
    expect(graphic.hitArea?.contains(30, 20)).toBe(false)
  })

  it('should not run: rectangle render strategy keeps multiple eligible constrained dashed strokes blocked until 4C ownership is promoted', () => {
    const graphic = runRenderStrategy('rect', {
      id: 'rect-constrained-dashed-multi',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 6,
          position: StrokePositions.INSIDE,
          style: StrokeStyles.DASHED,
          dashPattern: [400, 20],
          dashOffset: 0
        }),
        createDefaultStroke({
          width: 6,
          position: StrokePositions.OUTSIDE,
          style: StrokeStyles.DASHED,
          dashPattern: [400, 20],
          dashOffset: 0
        })
      ]
    })

    expect(getProjectionMeshes(graphic)).toHaveLength(0)
    expect(graphic.__asyraSolidCenterStrokeExportPackets).toEqual([])
    expect(graphic.hitArea).toBeNull()
  })

  it('should run: rectangle render strategy promotes the first constrained dashed round-join representative on the Phase 5 product path', () => {
    const graphic = runRenderStrategy('rect', {
      id: 'rect-constrained-dashed-round-join',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 6,
          position: StrokePositions.INSIDE,
          style: StrokeStyles.DASHED,
          dashPattern: [400, 20],
          dashOffset: 0,
          joinType: StrokeJoinTypes.ROUND
        })
      ]
    })

    expect(getProjectionMeshes(graphic)).toHaveLength(1)
    expect(graphic.__asyraSolidCenterStrokeExportPackets).toHaveLength(1)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.geometryId
    ).toContain(':constrained-dashed:')
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds).toEqual({
      minX: 0,
      minY: 0,
      maxX: 80,
      maxY: 40
    })
    expect(graphic.hitArea?.contains(1, 1)).toBe(true)
    expect(graphic.hitArea?.contains(40, 20)).toBe(false)
  })

  it('should run: rectangle render strategy promotes the next outside constrained dashed round-join representative on the Phase 5 product path', () => {
    const graphic = runRenderStrategy('rect', {
      id: 'rect-constrained-dashed-round-join-outside',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 6,
          position: StrokePositions.OUTSIDE,
          style: StrokeStyles.DASHED,
          dashPattern: [400, 20],
          dashOffset: 0,
          joinType: StrokeJoinTypes.ROUND
        })
      ]
    })

    expect(getProjectionMeshes(graphic)).toHaveLength(1)
    expect(graphic.__asyraSolidCenterStrokeExportPackets).toHaveLength(1)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.geometryId
    ).toContain(':constrained-dashed:')
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds).toEqual({
      minX: -6,
      minY: -6,
      maxX: 86,
      maxY: 46
    })
    expect(graphic.hitArea?.contains(-2, 1)).toBe(true)
    expect(graphic.hitArea?.contains(1, 1)).toBe(false)
    expect(graphic.hitArea?.contains(40, 20)).toBe(false)
  })

  it('should run: rectangle render strategy promotes the first constrained dashed gradient-paint representative on the Phase 6 product path', () => {
    const graphic = runRenderStrategy('rect', {
      id: 'rect-constrained-dashed-gradient-inside',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 6,
          position: StrokePositions.INSIDE,
          style: StrokeStyles.DASHED,
          dashPattern: [400, 20],
          dashOffset: 0,
          kind: FillKinds.GRADIENT,
          gradient: {
            ...createDefaultGradientData(),
            gradientHandles: [
              { x: 0, y: 0.5 },
              { x: 1, y: 0.5 }
            ]
          }
        })
      ]
    })

    expect(getProjectionMeshes(graphic)).toHaveLength(0)
    expect(getProjectionGraphics(graphic)).toHaveLength(1)
    expect(graphic.__asyraSolidCenterStrokeExportPackets).toHaveLength(1)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.geometryId
    ).toContain(':constrained-dashed:')
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds).toEqual({
      minX: 0,
      minY: 0,
      maxX: 80,
      maxY: 40
    })
    expect(graphic.hitArea?.contains(1, 1)).toBe(true)
    expect(graphic.hitArea?.contains(40, 20)).toBe(false)
  })

  it('should run: rectangle render strategy promotes the next constrained dashed outside gradient-paint representative on the Phase 6 product path', () => {
    const graphic = runRenderStrategy('rect', {
      id: 'rect-constrained-dashed-gradient-outside',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 6,
          position: StrokePositions.OUTSIDE,
          style: StrokeStyles.DASHED,
          dashPattern: [400, 20],
          dashOffset: 0,
          kind: FillKinds.GRADIENT,
          gradient: {
            ...createDefaultGradientData(),
            gradientHandles: [
              { x: 0, y: 0.5 },
              { x: 1, y: 0.5 }
            ]
          }
        })
      ]
    })

    expect(getProjectionMeshes(graphic)).toHaveLength(0)
    expect(getProjectionGraphics(graphic)).toHaveLength(1)
    expect(graphic.__asyraSolidCenterStrokeExportPackets).toHaveLength(1)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.geometryId
    ).toContain(':constrained-dashed:')
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds).toEqual({
      minX: -6,
      minY: -6,
      maxX: 86,
      maxY: 46
    })
    expect(graphic.hitArea?.contains(-2, 1)).toBe(true)
    expect(graphic.hitArea?.contains(40, 20)).toBe(false)
  })

  it('should run: oval render strategy promotes full-loop inside constrained dashed packets on the same shape-generated path', () => {
    const graphic = runRenderStrategy('oval', {
      id: 'oval-constrained-dashed-inside',
      x: 0,
      y: 0,
      width: 72,
      height: 48,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 5,
          position: StrokePositions.INSIDE,
          style: StrokeStyles.DASHED,
          dashPattern: [400, 20],
          dashOffset: 0
        })
      ]
    })

    expect(getProjectionMeshes(graphic)).toHaveLength(1)
    expect(graphic.__asyraSolidCenterStrokeExportPackets).toHaveLength(1)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.geometryId
    ).toContain(':constrained-dashed:')
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds).toEqual({
      minX: 0,
      minY: 0,
      maxX: 72,
      maxY: 48
    })
    expect(graphic.hitArea?.contains(2, 24)).toBe(true)
    expect(graphic.hitArea?.contains(36, 24)).toBe(false)
  })

  it('should run: oval render strategy promotes full-loop outside constrained dashed packets on the same shape-generated path', () => {
    const graphic = runRenderStrategy('oval', {
      id: 'oval-constrained-dashed-outside',
      x: 0,
      y: 0,
      width: 72,
      height: 48,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 5,
          position: StrokePositions.OUTSIDE,
          style: StrokeStyles.DASHED,
          dashPattern: [400, 20],
          dashOffset: 0
        })
      ]
    })

    expect(getProjectionMeshes(graphic)).toHaveLength(1)
    expect(graphic.__asyraSolidCenterStrokeExportPackets).toHaveLength(1)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.geometryId
    ).toContain(':constrained-dashed:')
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.minX).toBeCloseTo(
      -5,
      1
    )
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.minY).toBeCloseTo(
      -5,
      1
    )
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxX).toBeCloseTo(
      77,
      1
    )
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxY).toBeCloseTo(
      53,
      1
    )
    expect(graphic.hitArea?.contains(-2, 24)).toBe(true)
    expect(graphic.hitArea?.contains(36, 24)).toBe(false)
  })
})
