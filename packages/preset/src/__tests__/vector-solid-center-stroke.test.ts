import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { BehaviorSubject, Subscription } from 'rxjs'
import { Container, Mesh } from 'pixi.js'
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
import type { StrokeDiagnosticsMode } from '../components/stroke-render/stroke-diagnostics-mode'

interface StrokeDiagnosticsGlobal {
  __ASYRA_STROKE_DIAGNOSTICS_MODE__?: StrokeDiagnosticsMode
}

beforeEach(() => {
  ;(globalThis as StrokeDiagnosticsGlobal).__ASYRA_STROKE_DIAGNOSTICS_MODE__ =
    'full'
})

afterEach(() => {
  delete (globalThis as StrokeDiagnosticsGlobal)
    .__ASYRA_STROKE_DIAGNOSTICS_MODE__
})
import type { PresetDependencies } from '../types'
import { buildSolidCenterStrokePolygons } from '../components/stroke-render/solid-center-stroke-geometry'
import type { SolidCenterStrokeExportPacket } from '../components/stroke-render/solid-center-stroke-packets'

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

class RecordingVectorGraphic extends Container {
  __asyraSolidCenterStrokeExportPackets?: SolidCenterStrokeExportPacket[]
  __asyraCenterPathSolidStrokeRenderCount?: number
  hitArea?: { contains: (x: number, y: number) => boolean } | null
  instructions: { action: string; args: unknown[] }[] = []

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

  stroke(...args: unknown[]) {
    this.instructions.push({ action: 'stroke', args })
    return this
  }
}

interface TestAnchorPoint {
  id: string
  x: number
  y: number
}

const toVectorData = (anchors: TestAnchorPoint[], closed: boolean) => {
  const points: Record<string, VectorPointNode> = {}
  const segments: Record<string, VectorSegment> = {}
  const networks: Record<string, VectorNetwork> = {
    'network-0': {
      id: 'network-0',
      pointIds: anchors.map((anchor) => anchor.id),
      segmentIds: [],
      closed
    }
  }

  anchors.forEach((anchor, index) => {
    points[anchor.id] = {
      id: anchor.id,
      kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
      anchorType: 'sharp',
      x: anchor.x,
      y: anchor.y
    }

    if (index === 0) {
      return
    }

    const previous = anchors[index - 1]
    const segmentId = `segment-${index - 1}`
    segments[segmentId] = {
      id: segmentId,
      startId: previous.id,
      endId: anchor.id,
      outControlId: null,
      inControlId: null
    }
    networks['network-0'].segmentIds.push(segmentId)
  })

  if (closed && anchors.length > 1) {
    const first = anchors[0]
    const last = anchors[anchors.length - 1]
    const segmentId = 'segment-close'
    segments[segmentId] = {
      id: segmentId,
      startId: last.id,
      endId: first.id,
      outControlId: null,
      inControlId: null
    }
    networks['network-0'].segmentIds.push(segmentId)
  }

  return {
    points,
    segments,
    networks
  }
}

const runVectorRenderStrategy = (data: Record<string, unknown>) => {
  const strategy = renderStrategyRegistry.get('vector')
  expect(strategy).toBeTypeOf('function')

  const graphic = new RecordingVectorGraphic()
  ;(
    strategy as unknown as (
      graphic: RecordingVectorGraphic,
      data: Record<string, unknown>
    ) => void
  )(graphic, data)

  return graphic
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

const isPointInPolygon = (
  point: { x: number; y: number },
  polygon: { x: number; y: number }[]
) => {
  let inside = false
  for (
    let currentIndex = 0, previousIndex = polygon.length - 1;
    currentIndex < polygon.length;
    previousIndex = currentIndex, currentIndex += 1
  ) {
    const current = polygon[currentIndex]
    const previous = polygon[previousIndex]
    const intersects =
      current.y > point.y !== previous.y > point.y &&
      point.x <
        ((previous.x - current.x) * (point.y - current.y)) /
          (previous.y - current.y) +
          current.x
    if (intersects) {
      inside = !inside
    }
  }

  return inside
}

describe('vector solid-center stroke product wiring', () => {
  it('should run: keep miter coverage across the closed-path seam', () => {
    const polygons = buildSolidCenterStrokePolygons(
      [
        { x: 50, y: 0 },
        { x: 90, y: 100 },
        { x: 10, y: 100 }
      ],
      true,
      {
        style: 'solid',
        position: 'center',
        width: 20,
        join: 'miter',
        miterLimit: 4,
        cap: 'butt'
      }
    )

    expect(polygons.length).toBeGreaterThan(3)
    ;[
      { x: 47, y: 7 },
      { x: 50, y: 9 },
      { x: 53, y: 7 }
    ].forEach((probe) => {
      expect(
        polygons.some((polygon) => isPointInPolygon(probe, polygon)),
        JSON.stringify({ probe, polygons }, null, 2)
      ).toBe(true)
    })
  })

  it('should run: keep reported vector-6 closed seam coverage without covering the top hollow', () => {
    const polygons = buildSolidCenterStrokePolygons(
      [
        { x: 192.42083700791653, y: 0 },
        { x: 11.358174406717296, y: 364.1297089212308 },
        { x: 360.120941483566, y: 144.31562775593738 },
        { x: 0, y: 14.030686031827244 },
        { x: 270.59180204238254, y: 345.42212754546125 }
      ],
      true,
      {
        style: 'solid',
        position: 'center',
        width: 10,
        join: 'miter',
        miterLimit: 4,
        cap: 'butt'
      }
    )

    ;[
      { x: 190, y: 5 },
      { x: 195, y: 5 },
      { x: 192, y: 12 }
    ].forEach((probe) => {
      expect(
        polygons.some((polygon) => isPointInPolygon(probe, polygon)),
        JSON.stringify({ probe, polygons }, null, 2)
      ).toBe(true)
    })
    ;[
      { x: 192, y: 58 },
      { x: 192, y: 68 },
      { x: 198, y: 74 }
    ].forEach((probe) => {
      expect(
        polygons.some((polygon) => isPointInPolygon(probe, polygon)),
        JSON.stringify({ probe, polygons }, null, 2)
      ).toBe(false)
    })
  })
  ;[
    { label: 'inside', position: StrokePositions.INSIDE },
    { label: 'outside', position: StrokePositions.OUTSIDE }
  ].forEach(({ label, position }) => {
    it(`should run: render simple open-vector solid ${label} placement through the unbounded open center product`, () => {
      const graphic = runVectorRenderStrategy({
        id: `vector-solid-open-${label}`,
        x: 0,
        y: 0,
        width: 40,
        height: 20,
        ...toVectorData(
          [
            { id: 'a', x: 0, y: 10 },
            { id: 'b', x: 40, y: 10 }
          ],
          false
        ),
        closed: false,
        fills: [],
        strokes: [
          createDefaultStroke({
            width: 6,
            style: StrokeStyles.SOLID,
            position,
            joinType: StrokeJoinTypes.MITER,
            capType: StrokeCapTypes.BUTT
          })
        ]
      })

      expect(getProjectionMeshes(graphic)).toHaveLength(1)
      expect(graphic.__asyraCenterPathSolidStrokeRenderCount).toBe(0)
      expect(graphic.__asyraSolidCenterStrokeExportPackets).toHaveLength(1)
      expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0].bounds).toEqual(
        {
          minX: 0,
          minY: 7,
          maxX: 40,
          maxY: 13
        }
      )
      expect(
        graphic.__asyraSolidCenterStrokeExportPackets?.[0].debugMeta
      ).toMatchObject({
        geometryFamily: 'solid-center',
        resolutionStatus: 'center-product',
        sourceTopology: 'open'
      })
      expect(graphic.hitArea?.contains(20, 10)).toBe(true)
      expect(graphic.hitArea?.contains(20, 6.9)).toBe(false)
      expect(graphic.hitArea?.contains(20, 13.1)).toBe(false)
    })
  })

  it('should run: apply square cap to open-vector final-face export and hit packets', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-square-cap',
      x: 0,
      y: 0,
      width: 40,
      height: 20,
      ...toVectorData(
        [
          { id: 'a', x: 0, y: 10 },
          { id: 'b', x: 40, y: 10 }
        ],
        false
      ),
      closed: false,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 6,
          style: StrokeStyles.SOLID,
          position: StrokePositions.CENTER,
          joinType: StrokeJoinTypes.MITER,
          capType: StrokeCapTypes.SQUARE
        })
      ]
    })

    expect(getProjectionMeshes(graphic)).toHaveLength(1)
    expect(graphic.__asyraCenterPathSolidStrokeRenderCount).toBe(0)
    expect(graphic.__asyraSolidCenterStrokeExportPackets).toHaveLength(1)
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0].bounds).toEqual({
      minX: -3,
      minY: 7,
      maxX: 43,
      maxY: 13
    })
    expect(graphic.hitArea?.contains(-2, 10)).toBe(true)
    expect(graphic.hitArea?.contains(42, 10)).toBe(true)
    expect(graphic.hitArea?.contains(20, 18)).toBe(false)
  })

  it('should run: apply round cap to open-vector final-face export and hit packets', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-round-cap',
      x: 0,
      y: 0,
      width: 40,
      height: 20,
      ...toVectorData(
        [
          { id: 'a', x: 0, y: 10 },
          { id: 'b', x: 40, y: 10 }
        ],
        false
      ),
      closed: false,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 6,
          style: StrokeStyles.SOLID,
          position: StrokePositions.CENTER,
          joinType: StrokeJoinTypes.MITER,
          capType: StrokeCapTypes.ROUND
        })
      ]
    })

    expect(getProjectionMeshes(graphic)).toHaveLength(1)
    expect(graphic.__asyraCenterPathSolidStrokeRenderCount).toBe(0)
    expect(graphic.__asyraSolidCenterStrokeExportPackets).toHaveLength(1)
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0].bounds).toEqual({
      minX: -3,
      minY: 7,
      maxX: 43,
      maxY: 13
    })
    expect(graphic.hitArea?.contains(-2, 10)).toBe(true)
    expect(graphic.hitArea?.contains(42, 10)).toBe(true)
    expect(graphic.hitArea?.contains(-2, 7)).toBe(false)
    expect(graphic.hitArea?.contains(20, 18)).toBe(false)
  })

  it('should run: keep raw solid-center mesh visible when visual overlap debug is enabled', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-solid-center-debug-overlap',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      ...toVectorData(
        [
          { id: 'a', x: 0, y: 0 },
          { id: 'b', x: 80, y: 0 },
          { id: 'c', x: 80, y: 40 },
          { id: 'd', x: 0, y: 40 }
        ],
        true
      ),
      closed: true,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 6,
          style: StrokeStyles.SOLID,
          position: StrokePositions.CENTER,
          joinType: StrokeJoinTypes.MITER,
          capType: StrokeCapTypes.BUTT
        })
      ],
      strokeDebugOptions: {
        disableVisualOverlapCollapse: true
      }
    })

    expect(getProjectionMeshes(graphic)).toHaveLength(1)
    expect(graphic.__asyraCenterPathSolidStrokeRenderCount).toBe(0)
    expect(graphic.__asyraSolidCenterStrokeExportPackets).toHaveLength(1)
  })
})
