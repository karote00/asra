import { beforeAll, describe, expect, it } from 'vitest'
import { BehaviorSubject, Subscription } from 'rxjs'
import { Container, Graphics, Mesh } from 'pixi.js'
import core, {
  VECTOR_TOKENS,
  renderStrategyRegistry,
  type VectorNetwork,
  type VectorPointNode,
  type VectorSegment
} from '@asyra/core'
import {
  FillKinds,
  StrokePositions,
  StrokeStyles,
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
      createRenderGradientFillStyle: () => null as never
    },
    presetDeps
  )
})

class RecordingVectorGraphic extends Container {
  __asyraSolidCenterStrokeExportPackets?: {
    geometryId: string
    polygons: { x: number; y: number }[][]
    bounds: { minX: number; minY: number; maxX: number; maxY: number }
  }[]
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

class RecordingShapeGraphic extends Container {
  __asyraSolidCenterStrokeExportPackets?: {
    geometryId: string
    polygons: { x: number; y: number }[][]
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

const toClosedCubicLoopVectorData = () => ({
  points: {
    a: {
      id: 'a',
      kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
      anchorType: 'smooth',
      x: 40,
      y: 0
    },
    b: {
      id: 'b',
      kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
      anchorType: 'smooth',
      x: 80,
      y: 40
    },
    c: {
      id: 'c',
      kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
      anchorType: 'smooth',
      x: 40,
      y: 80
    },
    d: {
      id: 'd',
      kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
      anchorType: 'smooth',
      x: 0,
      y: 40
    },
    aIn: {
      id: 'aIn',
      kind: VECTOR_TOKENS.POINT.KIND.CONTROL,
      controlRole: VECTOR_TOKENS.CONTROL.ROLE.IN,
      x: 18,
      y: 0
    },
    aOut: {
      id: 'aOut',
      kind: VECTOR_TOKENS.POINT.KIND.CONTROL,
      controlRole: VECTOR_TOKENS.CONTROL.ROLE.OUT,
      x: 62,
      y: 0
    },
    bIn: {
      id: 'bIn',
      kind: VECTOR_TOKENS.POINT.KIND.CONTROL,
      controlRole: VECTOR_TOKENS.CONTROL.ROLE.IN,
      x: 80,
      y: 18
    },
    bOut: {
      id: 'bOut',
      kind: VECTOR_TOKENS.POINT.KIND.CONTROL,
      controlRole: VECTOR_TOKENS.CONTROL.ROLE.OUT,
      x: 80,
      y: 62
    },
    cIn: {
      id: 'cIn',
      kind: VECTOR_TOKENS.POINT.KIND.CONTROL,
      controlRole: VECTOR_TOKENS.CONTROL.ROLE.IN,
      x: 62,
      y: 80
    },
    cOut: {
      id: 'cOut',
      kind: VECTOR_TOKENS.POINT.KIND.CONTROL,
      controlRole: VECTOR_TOKENS.CONTROL.ROLE.OUT,
      x: 18,
      y: 80
    },
    dIn: {
      id: 'dIn',
      kind: VECTOR_TOKENS.POINT.KIND.CONTROL,
      controlRole: VECTOR_TOKENS.CONTROL.ROLE.IN,
      x: 0,
      y: 62
    },
    dOut: {
      id: 'dOut',
      kind: VECTOR_TOKENS.POINT.KIND.CONTROL,
      controlRole: VECTOR_TOKENS.CONTROL.ROLE.OUT,
      x: 0,
      y: 18
    }
  } satisfies Record<string, VectorPointNode>,
  segments: {
    ab: {
      id: 'ab',
      startId: 'a',
      endId: 'b',
      outControlId: 'aOut',
      inControlId: 'bIn'
    },
    bc: {
      id: 'bc',
      startId: 'b',
      endId: 'c',
      outControlId: 'bOut',
      inControlId: 'cIn'
    },
    cd: {
      id: 'cd',
      startId: 'c',
      endId: 'd',
      outControlId: 'cOut',
      inControlId: 'dIn'
    },
    da: {
      id: 'da',
      startId: 'd',
      endId: 'a',
      outControlId: 'dOut',
      inControlId: 'aIn'
    }
  } satisfies Record<string, VectorSegment>,
  networks: {
    'network-0': {
      id: 'network-0',
      pointIds: ['a', 'b', 'c', 'd'],
      segmentIds: ['ab', 'bc', 'cd', 'da'],
      closed: true
    }
  } satisfies Record<string, VectorNetwork>
})

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

const toMultiNetworkVectorData = (
  networksInput: { networkId: string; anchors: TestAnchorPoint[]; closed: boolean }[]
) => {
  const points: Record<string, VectorPointNode> = {}
  const segments: Record<string, VectorSegment> = {}
  const networks: Record<string, VectorNetwork> = {}

  networksInput.forEach(({ networkId, anchors, closed }) => {
    networks[networkId] = {
      id: networkId,
      pointIds: anchors.map((anchor) => anchor.id),
      segmentIds: [],
      closed
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
      const segmentId = `${networkId}-segment-${index - 1}`
      segments[segmentId] = {
        id: segmentId,
        startId: previous.id,
        endId: anchor.id,
        outControlId: null,
        inControlId: null
      }
      networks[networkId].segmentIds.push(segmentId)
    })

    if (closed && anchors.length > 1) {
      const first = anchors[0]
      const last = anchors[anchors.length - 1]
      const segmentId = `${networkId}-segment-close`
      segments[segmentId] = {
        id: segmentId,
        startId: last.id,
        endId: first.id,
        outControlId: null,
        inControlId: null
      }
      networks[networkId].segmentIds.push(segmentId)
    }
  })

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

const runShapeRenderStrategy = (
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

const getProjectionGraphics = (host: Container) =>
  host.children.flatMap((child) => {
    if (!(child instanceof Container)) {
      return []
    }

    return child.children.filter(
      (grandchild): grandchild is Graphics => grandchild instanceof Graphics
    )
  })

describe('vector constrained dashed stroke product wiring', () => {
  it('should run: render closed inside vectors through the constrained dashed path on the main render path', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-inside',
      x: 0,
      y: 0,
      width: 40,
      height: 40,
      ...toVectorData(
        [
          { id: 'a', x: 0, y: 0 },
          { id: 'b', x: 40, y: 0 },
          { id: 'c', x: 40, y: 40 },
          { id: 'd', x: 0, y: 40 }
        ],
        true
      ),
      closed: true,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 4,
          style: StrokeStyles.DASHED,
          position: StrokePositions.INSIDE,
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
      maxX: 40,
      maxY: 40
    })
    expect(graphic.hitArea?.contains(1, 1)).toBe(true)
    expect(graphic.hitArea?.contains(20, 20)).toBe(false)
  })

  it('should run: render closed rectangle-equivalent vectors through the first Phase 6 constrained dashed gradient-paint product path', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-gradient-inside',
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
          style: StrokeStyles.DASHED,
          position: StrokePositions.INSIDE,
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

  it('should run: render closed non-rectangle-equivalent vectors through the next broader Phase 6 constrained dashed gradient-paint product path', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-trapezoid-gradient-inside',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      ...toVectorData(
        [
          { id: 'a', x: 0, y: 0 },
          { id: 'b', x: 80, y: 0 },
          { id: 'c', x: 60, y: 40 },
          { id: 'd', x: 0, y: 40 }
        ],
        true
      ),
      closed: true,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 6,
          style: StrokeStyles.DASHED,
          position: StrokePositions.INSIDE,
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
    expect(graphic.hitArea?.contains(30, 20)).toBe(false)
  })

  it('should run: render closed rectangle-equivalent outside vectors through the next Phase 6 constrained dashed gradient-paint product path', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-gradient-outside',
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
          style: StrokeStyles.DASHED,
          position: StrokePositions.OUTSIDE,
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

  it('should run: render closed non-rectangle-equivalent outside vectors through the next broader Phase 6 constrained dashed gradient-paint product path', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-trapezoid-gradient-outside',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      ...toVectorData(
        [
          { id: 'a', x: 0, y: 0 },
          { id: 'b', x: 80, y: 0 },
          { id: 'c', x: 60, y: 40 },
          { id: 'd', x: 0, y: 40 }
        ],
        true
      ),
      closed: true,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 6,
          style: StrokeStyles.DASHED,
          position: StrokePositions.OUTSIDE,
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
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.minX).toBeCloseTo(
      -6,
      1
    )
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.minY).toBeCloseTo(
      -6,
      1
    )
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxX
    ).toBeGreaterThan(89)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxX
    ).toBeLessThan(92)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxY
    ).toBeCloseTo(46, 1)
    expect(graphic.hitArea?.contains(-2, 1)).toBe(true)
    expect(graphic.hitArea?.contains(30, 20)).toBe(false)
  })

  it('should run: render closed rectangle-equivalent vectors through the next Phase 6 constrained dashed single-edge gradient-paint product path', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-single-edge-gradient-inside',
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
          style: StrokeStyles.DASHED,
          position: StrokePositions.INSIDE,
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

  it('should run: render closed outside vectors through the constrained dashed path on the same Family A product path', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-outside',
      x: 0,
      y: 0,
      width: 40,
      height: 40,
      ...toVectorData(
        [
          { id: 'a', x: 0, y: 0 },
          { id: 'b', x: 40, y: 0 },
          { id: 'c', x: 40, y: 40 },
          { id: 'd', x: 0, y: 40 }
        ],
        true
      ),
      closed: true,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 4,
          style: StrokeStyles.DASHED,
          position: StrokePositions.OUTSIDE,
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
      minX: -4,
      minY: -4,
      maxX: 44,
      maxY: 44
    })
    expect(graphic.hitArea?.contains(-1, 1)).toBe(true)
    expect(graphic.hitArea?.contains(20, 20)).toBe(false)
  })

  it('should run: render closed inside rectangle-equivalent vectors through the first Phase 5 round-join product path', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-round-join-inside',
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
          style: StrokeStyles.DASHED,
          position: StrokePositions.INSIDE,
          joinType: 'round',
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

  it('should run: render closed outside rectangle-equivalent vectors through the next Phase 5 outside round-join product path', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-round-join-outside',
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
          style: StrokeStyles.DASHED,
          position: StrokePositions.OUTSIDE,
          joinType: 'round',
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
    expect(graphic.hitArea?.contains(1, 1)).toBe(false)
    expect(graphic.hitArea?.contains(40, 20)).toBe(false)
  })

  it('should run: render closed inside rectangle-equivalent vectors through the first Family B single-edge constrained dashed path', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-single-edge-inside',
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
          width: 4,
          style: StrokeStyles.DASHED,
          position: StrokePositions.INSIDE,
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
      maxY: 4
    })
    expect(graphic.hitArea?.contains(30, 1)).toBe(true)
    expect(graphic.hitArea?.contains(60, 1)).toBe(false)
    expect(graphic.hitArea?.contains(30, 20)).toBe(false)
  })

  it('should run: render closed inside rectangle-equivalent vectors through the next Phase 5 round-cap product path', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-single-edge-round-cap',
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
          width: 4,
          style: StrokeStyles.DASHED,
          position: StrokePositions.INSIDE,
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
    ).toBeCloseTo(16, 6)
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.minY).toBe(0)
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxX).toBe(44)
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxY).toBe(4)
    expect(graphic.hitArea?.contains(18, 2)).toBe(true)
    expect(graphic.hitArea?.contains(46, 2)).toBe(false)
    expect(graphic.hitArea?.contains(30, 20)).toBe(false)
  })

  it('should run: render closed outside rectangle-equivalent vectors through the next Phase 5 outside round-cap product path', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-single-edge-round-cap-outside',
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
          width: 4,
          style: StrokeStyles.DASHED,
          position: StrokePositions.OUTSIDE,
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
    ).toBeCloseTo(16, 6)
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.minY).toBe(-4)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxX
    ).toBeCloseTo(44, 6)
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxY).toBe(0)
    expect(graphic.hitArea?.contains(18, -2)).toBe(true)
    expect(graphic.hitArea?.contains(46, -2)).toBe(false)
    expect(graphic.hitArea?.contains(30, 2)).toBe(false)
  })

  it('should run: render closed outside rectangle-equivalent vectors through the same first Family B single-edge constrained dashed path', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-single-edge-outside',
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
          width: 4,
          style: StrokeStyles.DASHED,
          position: StrokePositions.OUTSIDE,
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
      minY: -4,
      maxX: 40,
      maxY: 0
    })
    expect(graphic.hitArea?.contains(30, -1)).toBe(true)
    expect(graphic.hitArea?.contains(30, 1)).toBe(false)
    expect(graphic.hitArea?.contains(60, -1)).toBe(false)
  })

  it('should run: render closed outside rectangle-equivalent vectors through the next Phase 6 single-edge gradient-paint product path', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-single-edge-gradient-outside',
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
          style: StrokeStyles.DASHED,
          position: StrokePositions.OUTSIDE,
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

  it('should run: render closed inside rectangle-equivalent vectors through the first Family C corner-spanning constrained dashed path', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-corner-spanning-inside-bevel',
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
          width: 4,
          style: StrokeStyles.DASHED,
          position: StrokePositions.INSIDE,
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

  it('should run: render closed inside rectangle-equivalent vectors through the first Phase 6 corner-spanning constrained dashed gradient-paint product path', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-corner-spanning-inside-bevel-gradient',
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
          width: 4,
          style: StrokeStyles.DASHED,
          position: StrokePositions.INSIDE,
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

  it('should run: render closed inside rectangle-equivalent vectors through the matching Family C corner-spanning constrained dashed miter path', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-corner-spanning-inside-miter',
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
          width: 4,
          style: StrokeStyles.DASHED,
          position: StrokePositions.INSIDE,
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

  it('should run: render closed inside rectangle-equivalent vectors through the uniform-width Family C round corner-spanning path', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-corner-spanning-inside-round',
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
          width: 4,
          style: StrokeStyles.DASHED,
          position: StrokePositions.INSIDE,
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

  it('should run: render closed outside rectangle-equivalent vectors through the next bounded vector Family C corner-spanning constrained dashed bevel path', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-corner-spanning-outside-bevel',
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
          width: 10,
          style: StrokeStyles.DASHED,
          position: StrokePositions.OUTSIDE,
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
      minY: -10,
      maxX: 90,
      maxY: 20
    })
    expect(graphic.hitArea?.contains(70, -4)).toBe(true)
    expect(graphic.hitArea?.contains(84, 10)).toBe(true)
    expect(graphic.hitArea?.contains(20, -4)).toBe(false)
    expect(graphic.hitArea?.contains(30, 20)).toBe(false)
  })

  it('should run: render closed outside rectangle-equivalent vectors through the next Phase 6 corner-spanning constrained dashed gradient-paint product path', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-corner-spanning-outside-bevel-gradient',
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
          width: 10,
          style: StrokeStyles.DASHED,
          position: StrokePositions.OUTSIDE,
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
      minY: -10,
      maxX: 90,
      maxY: 20
    })
    expect(graphic.hitArea?.contains(70, -4)).toBe(true)
    expect(graphic.hitArea?.contains(84, 10)).toBe(true)
    expect(graphic.hitArea?.contains(20, -4)).toBe(false)
    expect(graphic.hitArea?.contains(30, 20)).toBe(false)
  })

  it('should run: render closed outside rectangle-equivalent vectors through the matching bounded vector Family C corner-spanning constrained dashed miter path', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-corner-spanning-outside-miter',
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
          width: 10,
          style: StrokeStyles.DASHED,
          position: StrokePositions.OUTSIDE,
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
      minY: -10,
      maxX: 90,
      maxY: 20
    })
    expect(graphic.hitArea?.contains(70, -4)).toBe(true)
    expect(graphic.hitArea?.contains(84, 10)).toBe(true)
    expect(graphic.hitArea?.contains(20, -4)).toBe(false)
    expect(graphic.hitArea?.contains(30, 20)).toBe(false)
  })

  it('should run: render closed outside rectangle-equivalent vectors through the uniform-width Family C round corner-spanning path', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-corner-spanning-outside-round',
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
          width: 10,
          style: StrokeStyles.DASHED,
          position: StrokePositions.OUTSIDE,
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
      minY: -10,
      maxX: 90,
      maxY: 20
    })
    expect(graphic.hitArea?.contains(70, -4)).toBe(true)
    expect(graphic.hitArea?.contains(84, 10)).toBe(true)
    expect(graphic.hitArea?.contains(20, -4)).toBe(false)
    expect(graphic.hitArea?.contains(30, 20)).toBe(false)
  })

  it('should run: render closed inside non-rectangle-equivalent vectors through the first broader Family C corner-spanning constrained dashed path', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-trapezoid-corner-spanning-inside-bevel',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      ...toVectorData(
        [
          { id: 'a', x: 0, y: 0 },
          { id: 'b', x: 80, y: 0 },
          { id: 'c', x: 60, y: 40 },
          { id: 'd', x: 0, y: 40 }
        ],
        true
      ),
      closed: true,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 4,
          style: StrokeStyles.DASHED,
          position: StrokePositions.INSIDE,
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
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.minY).toBe(0)
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxX).toBe(80)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.minX
    ).toBeGreaterThan(48)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.minX
    ).toBeLessThan(70)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxY
    ).toBeGreaterThan(12)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxY
    ).toBeLessThan(28)
    expect(graphic.hitArea?.contains(70, 1)).toBe(true)
    expect(graphic.hitArea?.contains(72, 12)).toBe(true)
    expect(graphic.hitArea?.contains(20, 1)).toBe(false)
    expect(graphic.hitArea?.contains(30, 20)).toBe(false)
  })

  it('should run: render closed inside non-rectangle-equivalent vectors through the next broader Phase 6 corner-spanning constrained dashed gradient-paint product path', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-trapezoid-corner-spanning-inside-bevel-gradient',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      ...toVectorData(
        [
          { id: 'a', x: 0, y: 0 },
          { id: 'b', x: 80, y: 0 },
          { id: 'c', x: 60, y: 40 },
          { id: 'd', x: 0, y: 40 }
        ],
        true
      ),
      closed: true,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 4,
          style: StrokeStyles.DASHED,
          position: StrokePositions.INSIDE,
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
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.minY).toBe(0)
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxX).toBe(80)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.minX
    ).toBeGreaterThan(48)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.minX
    ).toBeLessThan(70)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxY
    ).toBeGreaterThan(12)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxY
    ).toBeLessThan(28)
    expect(graphic.hitArea?.contains(70, 1)).toBe(true)
    expect(graphic.hitArea?.contains(72, 12)).toBe(true)
    expect(graphic.hitArea?.contains(20, 1)).toBe(false)
    expect(graphic.hitArea?.contains(30, 20)).toBe(false)
  })

  it('should run: render closed inside non-rectangle-equivalent vectors through the matching broader Family C corner-spanning constrained dashed miter path', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-trapezoid-corner-spanning-inside-miter',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      ...toVectorData(
        [
          { id: 'a', x: 0, y: 0 },
          { id: 'b', x: 80, y: 0 },
          { id: 'c', x: 60, y: 40 },
          { id: 'd', x: 0, y: 40 }
        ],
        true
      ),
      closed: true,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 4,
          style: StrokeStyles.DASHED,
          position: StrokePositions.INSIDE,
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
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.minY).toBe(0)
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxX).toBe(80)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.minX
    ).toBeGreaterThan(48)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.minX
    ).toBeLessThan(70)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxY
    ).toBeGreaterThan(12)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxY
    ).toBeLessThan(28)
    expect(graphic.hitArea?.contains(70, 1)).toBe(true)
    expect(graphic.hitArea?.contains(72, 12)).toBe(true)
    expect(graphic.hitArea?.contains(20, 1)).toBe(false)
    expect(graphic.hitArea?.contains(30, 20)).toBe(false)
  })

  it('should run: render closed outside non-rectangle-equivalent vectors through the next broader Family C corner-spanning constrained dashed bevel path', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-trapezoid-corner-spanning-outside-bevel',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      ...toVectorData(
        [
          { id: 'a', x: 0, y: 0 },
          { id: 'b', x: 80, y: 0 },
          { id: 'c', x: 60, y: 40 },
          { id: 'd', x: 0, y: 40 }
        ],
        true
      ),
      closed: true,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 4,
          style: StrokeStyles.DASHED,
          position: StrokePositions.OUTSIDE,
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
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.minY).toBeLessThan(0)
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxX).toBeGreaterThan(80)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.minX
    ).toBeGreaterThan(48)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.minX
    ).toBeLessThan(70)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxY
    ).toBeGreaterThan(16)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxY
    ).toBeLessThan(32)
    expect(graphic.hitArea?.contains(70, -3)).toBe(true)
    expect(graphic.hitArea?.contains(77, 10)).toBe(true)
    expect(graphic.hitArea?.contains(20, -3)).toBe(false)
    expect(graphic.hitArea?.contains(30, 20)).toBe(false)
  })

  it('should run: render closed outside non-rectangle-equivalent vectors through the matching broader Family C corner-spanning constrained dashed miter path', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-trapezoid-corner-spanning-outside-miter',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      ...toVectorData(
        [
          { id: 'a', x: 0, y: 0 },
          { id: 'b', x: 80, y: 0 },
          { id: 'c', x: 60, y: 40 },
          { id: 'd', x: 0, y: 40 }
        ],
        true
      ),
      closed: true,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 4,
          style: StrokeStyles.DASHED,
          position: StrokePositions.OUTSIDE,
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
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.minY).toBeLessThan(0)
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxX).toBeGreaterThan(80)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.minX
    ).toBeGreaterThan(48)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.minX
    ).toBeLessThan(70)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxY
    ).toBeGreaterThan(16)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxY
    ).toBeLessThan(32)
    expect(graphic.hitArea?.contains(70, -3)).toBe(true)
    expect(graphic.hitArea?.contains(77, 10)).toBe(true)
    expect(graphic.hitArea?.contains(20, -3)).toBe(false)
    expect(graphic.hitArea?.contains(30, 20)).toBe(false)
  })

  it('should run: render closed inside non-rectangle-equivalent vectors through the next broader Family B single-edge constrained dashed path', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-trapezoid-single-edge-inside',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      ...toVectorData(
        [
          { id: 'a', x: 0, y: 0 },
          { id: 'b', x: 80, y: 0 },
          { id: 'c', x: 60, y: 40 },
          { id: 'd', x: 0, y: 40 }
        ],
        true
      ),
      closed: true,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 4,
          style: StrokeStyles.DASHED,
          position: StrokePositions.INSIDE,
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
      maxY: 4
    })
    expect(graphic.hitArea?.contains(30, 1)).toBe(true)
    expect(graphic.hitArea?.contains(60, 1)).toBe(false)
    expect(graphic.hitArea?.contains(30, 20)).toBe(false)
  })

  it('should run: render closed inside non-rectangle-equivalent vectors through the next broader Phase 6 single-edge gradient-paint product path', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-trapezoid-single-edge-gradient-inside',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      ...toVectorData(
        [
          { id: 'a', x: 0, y: 0 },
          { id: 'b', x: 80, y: 0 },
          { id: 'c', x: 60, y: 40 },
          { id: 'd', x: 0, y: 40 }
        ],
        true
      ),
      closed: true,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 6,
          style: StrokeStyles.DASHED,
          position: StrokePositions.INSIDE,
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

  it('should run: render closed inside non-rectangle-equivalent vectors through the next broader Phase 5 round-cap product path', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-trapezoid-single-edge-round-cap',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      ...toVectorData(
        [
          { id: 'a', x: 0, y: 0 },
          { id: 'b', x: 80, y: 0 },
          { id: 'c', x: 60, y: 40 },
          { id: 'd', x: 0, y: 40 }
        ],
        true
      ),
      closed: true,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 4,
          style: StrokeStyles.DASHED,
          position: StrokePositions.INSIDE,
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
    ).toBeCloseTo(16, 6)
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.minY).toBe(0)
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxX).toBe(44)
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxY).toBe(4)
    expect(graphic.hitArea?.contains(18, 2)).toBe(true)
    expect(graphic.hitArea?.contains(46, 2)).toBe(false)
    expect(graphic.hitArea?.contains(30, 20)).toBe(false)
  })

  it('should run: render closed outside non-rectangle-equivalent vectors through the next broader Phase 5 outside round-cap product path', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-trapezoid-single-edge-round-cap-outside',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      ...toVectorData(
        [
          { id: 'a', x: 0, y: 0 },
          { id: 'b', x: 80, y: 0 },
          { id: 'c', x: 60, y: 40 },
          { id: 'd', x: 0, y: 40 }
        ],
        true
      ),
      closed: true,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 4,
          style: StrokeStyles.DASHED,
          position: StrokePositions.OUTSIDE,
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
    ).toBeCloseTo(16, 6)
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.minY).toBeLessThan(
      -3.5
    )
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxX
    ).toBeCloseTo(44, 6)
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxY).toBeGreaterThan(
      -0.5
    )
    expect(graphic.hitArea?.contains(18, -2)).toBe(true)
    expect(graphic.hitArea?.contains(46, -2)).toBe(false)
    expect(graphic.hitArea?.contains(30, 2)).toBe(false)
  })

  it('should run: render closed inside non-rectangle-equivalent vectors through the next broader Phase 5 round-join product path', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-trapezoid-round-join-inside',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      ...toVectorData(
        [
          { id: 'a', x: 0, y: 0 },
          { id: 'b', x: 80, y: 0 },
          { id: 'c', x: 60, y: 40 },
          { id: 'd', x: 0, y: 40 }
        ],
        true
      ),
      closed: true,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 4,
          style: StrokeStyles.DASHED,
          position: StrokePositions.INSIDE,
          joinType: 'round',
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

  it('should run: render closed outside non-rectangle-equivalent vectors through the next broader Phase 5 outside round-join product path', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-trapezoid-round-join-outside',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      ...toVectorData(
        [
          { id: 'a', x: 0, y: 0 },
          { id: 'b', x: 80, y: 0 },
          { id: 'c', x: 60, y: 40 },
          { id: 'd', x: 0, y: 40 }
        ],
        true
      ),
      closed: true,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 4,
          style: StrokeStyles.DASHED,
          position: StrokePositions.OUTSIDE,
          joinType: 'round',
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
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.minX
    ).toBeCloseTo(-4, 6)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.minY
    ).toBeCloseTo(-4, 6)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxX
    ).toBeCloseTo(86.4721359549996, 6)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxY
    ).toBeCloseTo(44, 6)
    expect(graphic.hitArea?.contains(-2, 1)).toBe(true)
    expect(graphic.hitArea?.contains(1, 1)).toBe(false)
    expect(graphic.hitArea?.contains(40, 20)).toBe(false)
  })

  it('should run: render closed outside non-rectangle-equivalent vectors through the same broader Family B single-edge constrained dashed path', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-trapezoid-single-edge-outside',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      ...toVectorData(
        [
          { id: 'a', x: 0, y: 0 },
          { id: 'b', x: 80, y: 0 },
          { id: 'c', x: 60, y: 40 },
          { id: 'd', x: 0, y: 40 }
        ],
        true
      ),
      closed: true,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 4,
          style: StrokeStyles.DASHED,
          position: StrokePositions.OUTSIDE,
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
      minY: -4,
      maxX: 40,
      maxY: 0
    })
    expect(graphic.hitArea?.contains(30, -1)).toBe(true)
    expect(graphic.hitArea?.contains(30, 1)).toBe(false)
    expect(graphic.hitArea?.contains(60, -1)).toBe(false)
  })

  it('should run: render closed outside non-rectangle-equivalent vectors through the next broader Phase 6 single-edge gradient-paint product path', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-trapezoid-single-edge-gradient-outside',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      ...toVectorData(
        [
          { id: 'a', x: 0, y: 0 },
          { id: 'b', x: 80, y: 0 },
          { id: 'c', x: 60, y: 40 },
          { id: 'd', x: 0, y: 40 }
        ],
        true
      ),
      closed: true,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 6,
          style: StrokeStyles.DASHED,
          position: StrokePositions.OUTSIDE,
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

  it('should run: render closed inside non-rectangle-equivalent vectors through the same full-loop constrained dashed path', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-trapezoid-inside',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      ...toVectorData(
        [
          { id: 'a', x: 0, y: 0 },
          { id: 'b', x: 80, y: 0 },
          { id: 'c', x: 60, y: 40 },
          { id: 'd', x: 0, y: 40 }
        ],
        true
      ),
      closed: true,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 4,
          style: StrokeStyles.DASHED,
          position: StrokePositions.INSIDE,
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

  it('should run: render closed outside non-rectangle-equivalent vectors through the same full-loop constrained dashed path', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-trapezoid-outside',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      ...toVectorData(
        [
          { id: 'a', x: 0, y: 0 },
          { id: 'b', x: 80, y: 0 },
          { id: 'c', x: 60, y: 40 },
          { id: 'd', x: 0, y: 40 }
        ],
        true
      ),
      closed: true,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 4,
          style: StrokeStyles.DASHED,
          position: StrokePositions.OUTSIDE,
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
      -4,
      1
    )
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.minY).toBeCloseTo(
      -4,
      1
    )
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxX
    ).toBeGreaterThan(84)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxX
    ).toBeLessThan(88)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxY
    ).toBeGreaterThan(43)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxY
    ).toBeLessThan(46)
    expect(graphic.hitArea?.contains(-1, 1)).toBe(true)
    expect(graphic.hitArea?.contains(40, 20)).toBe(false)
  })

  ;[
    { label: 'inside', position: StrokePositions.INSIDE },
    { label: 'outside', position: StrokePositions.OUTSIDE }
  ].forEach(({ label, position }) => {
    it(`should run: render open-path ${label} constrained dashed vectors as centered fallback on the main render path`, () => {
      const graphic = runVectorRenderStrategy({
        id: `vector-constrained-dashed-open-${label}`,
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
            width: 4,
            style: StrokeStyles.DASHED,
            position,
            dashPattern: [400, 20],
            dashOffset: 0
          })
        ]
      })

      expect(getProjectionMeshes(graphic)).toHaveLength(1)
      expect(graphic.__asyraSolidCenterStrokeExportPackets).toHaveLength(1)
      expect(
        graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.geometryId
      ).toContain(':dashed-center:')
      expect(
        graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.minY
      ).toBeGreaterThanOrEqual(8)
      expect(
        graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxY
      ).toBeLessThanOrEqual(12)
      expect(graphic.hitArea?.contains(20, 10)).toBe(true)
      expect(graphic.hitArea?.contains(20, 4)).toBe(false)
    })
  })

  ;[
    { label: 'inside', position: StrokePositions.INSIDE },
    { label: 'outside', position: StrokePositions.OUTSIDE }
  ].forEach(({ label, position }) => {
    it(`should run: keep open-path dashed vectors visible when switching from center to ${label}`, () => {
      const strategy = renderStrategyRegistry.get('vector')
      expect(strategy).toBeTypeOf('function')

      const graphic = new RecordingVectorGraphic()
      const baseData = {
        id: `vector-constrained-dashed-open-transition-${label}`,
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
        fills: []
      }

      ;(
        strategy as unknown as (
          graphic: RecordingVectorGraphic,
          data: Record<string, unknown>
        ) => void
      )(graphic, {
        ...baseData,
        strokes: [
          createDefaultStroke({
            width: 4,
            style: StrokeStyles.DASHED,
            position: StrokePositions.CENTER,
            dashPattern: [400, 20],
            dashOffset: 0
          })
        ]
      })

      expect(graphic.__asyraSolidCenterStrokeExportPackets).toHaveLength(1)
      expect(
        graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.geometryId
      ).toContain(':dashed-center:')
      expect(graphic.hitArea?.contains(20, 10)).toBe(true)

      ;(
        strategy as unknown as (
          graphic: RecordingVectorGraphic,
          data: Record<string, unknown>
        ) => void
      )(graphic, {
        ...baseData,
        strokes: [
          createDefaultStroke({
            width: 4,
            style: StrokeStyles.DASHED,
            position,
            dashPattern: [400, 20],
            dashOffset: 0
          })
        ]
      })

      expect(graphic.__asyraSolidCenterStrokeExportPackets).toHaveLength(1)
      expect(
        graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.geometryId
      ).toContain(':dashed-center:')
      expect(graphic.hitArea?.contains(20, 10)).toBe(true)
      expect(graphic.hitArea?.contains(20, 4)).toBe(false)
    })
  })

  ;[
    { label: 'inside', position: StrokePositions.INSIDE },
    { label: 'outside', position: StrokePositions.OUTSIDE }
  ].forEach(({ label, position }) => {
    it(`should run: route closed vector repeated dashed stroke through constrained placement when switching from center to ${label}`, () => {
      const strategy = renderStrategyRegistry.get('vector')
      expect(strategy).toBeTypeOf('function')

      const graphic = new RecordingVectorGraphic()
      const baseData = {
        id: `vector-constrained-dashed-closed-transition-${label}`,
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
        fills: []
      }

      ;(
        strategy as unknown as (
          graphic: RecordingVectorGraphic,
          data: Record<string, unknown>
        ) => void
      )(graphic, {
        ...baseData,
        strokes: [
          createDefaultStroke({
            width: 4,
            style: StrokeStyles.DASHED,
            position: StrokePositions.CENTER,
            dashPattern: [20, 20],
            dashOffset: 0
          })
        ]
      })

      expect(graphic.__asyraSolidCenterStrokeExportPackets?.length).toBeGreaterThan(1)
      expect(
        graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.geometryId
      ).toContain(':dashed-center:')
      expect(graphic.hitArea?.contains(10, 0)).toBe(true)

      ;(
        strategy as unknown as (
          graphic: RecordingVectorGraphic,
          data: Record<string, unknown>
        ) => void
      )(graphic, {
        ...baseData,
        strokes: [
          createDefaultStroke({
            width: 4,
            style: StrokeStyles.DASHED,
            position,
            dashPattern: [20, 20],
            dashOffset: 0
          })
        ]
      })

      expect(graphic.__asyraSolidCenterStrokeExportPackets?.length).toBeGreaterThan(1)
      expect(
        graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.geometryId
      ).toContain(':constrained-dashed:')
      const bounds =
        graphic.__asyraSolidCenterStrokeExportPackets?.map((packet) => packet.bounds) ??
        []
      if (position === StrokePositions.INSIDE) {
        expect(
          bounds.every(
            (bound) =>
              bound.minX >= -0.001 &&
              bound.minY >= -0.001 &&
              bound.maxX <= 80.001 &&
              bound.maxY <= 40.001
          )
        ).toBe(true)
      } else {
        expect(
          bounds.some(
            (bound) =>
              bound.minX < -0.001 ||
              bound.minY < -0.001 ||
              bound.maxX > 80.001 ||
              bound.maxY > 40.001
          )
        ).toBe(true)
      }
    })
  })

  ;[
    { label: 'inside', position: StrokePositions.INSIDE },
    { label: 'outside', position: StrokePositions.OUTSIDE }
  ].forEach(({ label, position }) => {
    it(`should run: route closed cubic vector repeated dashed stroke through constrained placement when switching from center to ${label}`, () => {
      const strategy = renderStrategyRegistry.get('vector')
      expect(strategy).toBeTypeOf('function')

      const graphic = new RecordingVectorGraphic()
      const baseData = {
        id: `vector-constrained-dashed-closed-cubic-transition-${label}`,
        x: 0,
        y: 0,
        width: 80,
        height: 80,
        ...toClosedCubicLoopVectorData(),
        closed: true,
        fills: []
      }

      ;(
        strategy as unknown as (
          graphic: RecordingVectorGraphic,
          data: Record<string, unknown>
        ) => void
      )(graphic, {
        ...baseData,
        strokes: [
          createDefaultStroke({
            width: 4,
            style: StrokeStyles.DASHED,
            position: StrokePositions.CENTER,
            dashPattern: [20, 20],
            dashOffset: 0
          })
        ]
      })

      expect(graphic.__asyraSolidCenterStrokeExportPackets?.length).toBeGreaterThan(1)
      expect(
        graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.geometryId
      ).toContain(':dashed-center:')
      expect(graphic.hitArea?.contains(40, 0)).toBe(true)

      ;(
        strategy as unknown as (
          graphic: RecordingVectorGraphic,
          data: Record<string, unknown>
        ) => void
      )(graphic, {
        ...baseData,
        strokes: [
          createDefaultStroke({
            width: 4,
            style: StrokeStyles.DASHED,
            position,
            dashPattern: [20, 20],
            dashOffset: 0
          })
        ]
      })

      expect(graphic.__asyraSolidCenterStrokeExportPackets?.length).toBeGreaterThan(1)
      expect(
        graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.geometryId
      ).toContain(':constrained-dashed:')
    })
  })

  ;[
    { label: 'inside', position: StrokePositions.INSIDE },
    { label: 'outside', position: StrokePositions.OUTSIDE }
  ].forEach(({ label, position }) => {
    it(`should run: route the reported closed star vector repeated dashed stroke through constrained placement when switching from center to ${label}`, () => {
      const strategy = renderStrategyRegistry.get('vector')
      expect(strategy).toBeTypeOf('function')

      const graphic = new RecordingVectorGraphic()
      const baseData = {
        id: `vector-constrained-dashed-reported-star-transition-${label}`,
        x: 2395.5238285133596,
        y: 1832.0182325853355,
        width: 423.6353107755326,
        height: 458.34939129152076,
        ...toReportedClosedStarVectorData(),
        closed: true,
        fills: []
      }

      ;(
        strategy as unknown as (
          graphic: RecordingVectorGraphic,
          data: Record<string, unknown>
        ) => void
      )(graphic, {
        ...baseData,
        strokes: [
          createDefaultStroke({
            id: 'pp-312',
            width: 10,
            style: StrokeStyles.DASHED,
            position: StrokePositions.CENTER,
            dashPattern: [20, 20],
            dashOffset: 0,
            color: '#d51a1a'
          })
        ]
      })

      expect(graphic.__asyraSolidCenterStrokeExportPackets?.length).toBeGreaterThan(1)
      expect(
        graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.geometryId
      ).toContain(':dashed-center:')

      ;(
        strategy as unknown as (
          graphic: RecordingVectorGraphic,
          data: Record<string, unknown>
        ) => void
      )(graphic, {
        ...baseData,
        strokes: [
          createDefaultStroke({
            id: 'pp-312',
            width: 10,
            style: StrokeStyles.DASHED,
            position,
            dashPattern: [20, 20],
            dashOffset: 0,
            color: '#d51a1a'
          })
        ]
      })

      expect(graphic.__asyraSolidCenterStrokeExportPackets?.length).toBeGreaterThan(1)
      expect(
        graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.geometryId
      ).toContain(':constrained-dashed:')
    })
  })

  it('should not run: reject self-intersecting constrained dashed vectors deterministically on the main render path', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-self-intersecting',
      x: 0,
      y: 0,
      width: 40,
      height: 40,
      ...toVectorData(
        [
          { id: 'a', x: 0, y: 0 },
          { id: 'b', x: 40, y: 40 },
          { id: 'c', x: 0, y: 40 },
          { id: 'd', x: 40, y: 0 }
        ],
        true
      ),
      closed: true,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 4,
          style: StrokeStyles.DASHED,
          position: StrokePositions.INSIDE,
          dashPattern: [400, 20],
          dashOffset: 0
        })
      ]
    })

    expect(getProjectionMeshes(graphic)).toHaveLength(0)
    expect(graphic.__asyraSolidCenterStrokeExportPackets).toEqual([])
    expect(graphic.hitArea).toBeNull()
  })

  it('should not run: keep multi-network constrained dashed vectors blocked until the vector ownership path is promoted', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-multi-network',
      x: 0,
      y: 0,
      width: 100,
      height: 40,
      ...toMultiNetworkVectorData([
        {
          networkId: 'network-a',
          closed: true,
          anchors: [
            { id: 'a0', x: 0, y: 0 },
            { id: 'a1', x: 40, y: 0 },
            { id: 'a2', x: 40, y: 40 },
            { id: 'a3', x: 0, y: 40 }
          ]
        },
        {
          networkId: 'network-b',
          closed: true,
          anchors: [
            { id: 'b0', x: 60, y: 0 },
            { id: 'b1', x: 100, y: 0 },
            { id: 'b2', x: 100, y: 40 },
            { id: 'b3', x: 60, y: 40 }
          ]
        }
      ]),
      closed: true,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 4,
          style: StrokeStyles.DASHED,
          position: StrokePositions.OUTSIDE,
          dashPattern: [400, 20],
          dashOffset: 0
        })
      ]
    })

    expect(getProjectionMeshes(graphic)).toHaveLength(0)
    expect(graphic.__asyraSolidCenterStrokeExportPackets).toEqual([])
    expect(graphic.hitArea).toBeNull()
  })

  it('should run: shape-generated and vector-generated closed rectangle-equivalent full-loop constrained dashed packets stay equivalent on the promoted Family D path', () => {
    const insideStroke = createDefaultStroke({
      width: 4,
      style: StrokeStyles.DASHED,
      position: StrokePositions.INSIDE,
      dashPattern: [400, 20],
      dashOffset: 0
    })
    const outsideStroke = createDefaultStroke({
      width: 4,
      style: StrokeStyles.DASHED,
      position: StrokePositions.OUTSIDE,
      dashPattern: [400, 20],
      dashOffset: 0
    })

    const rectGraphic = runShapeRenderStrategy('rect', {
      id: 'rect-constrained-dashed-equivalent',
      x: 0,
      y: 0,
      width: 40,
      height: 40,
      fills: [],
      strokes: [insideStroke]
    })

    const vectorGraphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-equivalent',
      x: 0,
      y: 0,
      width: 40,
      height: 40,
      ...toVectorData(
        [
          { id: 'a', x: 0, y: 0 },
          { id: 'b', x: 40, y: 0 },
          { id: 'c', x: 40, y: 40 },
          { id: 'd', x: 0, y: 40 }
        ],
        true
      ),
      closed: true,
      fills: [],
      strokes: [insideStroke]
    })

    const serializePackets = (
      packets:
        | {
            geometryId: string
            polygons: { x: number; y: number }[][]
            bounds: { minX: number; minY: number; maxX: number; maxY: number }
          }[]
        | undefined
    ) =>
      (packets ?? []).map((packet) => ({
        geometryId: packet.geometryId.split(':').slice(-2).join(':'),
        polygonCount: packet.polygons.length,
        bounds: packet.bounds
      }))

    expect(serializePackets(rectGraphic.__asyraSolidCenterStrokeExportPackets)).toEqual(
      serializePackets(vectorGraphic.__asyraSolidCenterStrokeExportPackets)
    )

    const rectOutsideGraphic = runShapeRenderStrategy('rect', {
      id: 'rect-constrained-dashed-equivalent-outside',
      x: 0,
      y: 0,
      width: 40,
      height: 40,
      fills: [],
      strokes: [outsideStroke]
    })

    const vectorOutsideGraphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-equivalent-outside',
      x: 0,
      y: 0,
      width: 40,
      height: 40,
      ...toVectorData(
        [
          { id: 'a', x: 0, y: 0 },
          { id: 'b', x: 40, y: 0 },
          { id: 'c', x: 40, y: 40 },
          { id: 'd', x: 0, y: 40 }
        ],
        true
      ),
      closed: true,
      fills: [],
      strokes: [outsideStroke]
    })

    expect(
      serializePackets(rectOutsideGraphic.__asyraSolidCenterStrokeExportPackets)
    ).toEqual(
      serializePackets(vectorOutsideGraphic.__asyraSolidCenterStrokeExportPackets)
    )
  })

  it('should run: shape-generated and vector-generated rectangle-equivalent single-edge constrained dashed packets stay equivalent on the first Family B and Family D crossover path', () => {
    const insideStroke = createDefaultStroke({
      width: 4,
      style: StrokeStyles.DASHED,
      position: StrokePositions.INSIDE,
      dashPattern: [20, 220],
      dashOffset: 220
    })
    const outsideStroke = createDefaultStroke({
      width: 4,
      style: StrokeStyles.DASHED,
      position: StrokePositions.OUTSIDE,
      dashPattern: [20, 220],
      dashOffset: 220
    })

    const rectGraphic = runShapeRenderStrategy('rect', {
      id: 'rect-constrained-dashed-single-edge-equivalent',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      fills: [],
      strokes: [insideStroke]
    })

    const vectorGraphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-single-edge-equivalent',
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
      strokes: [insideStroke]
    })

    const serializePackets = (
      packets:
        | {
            geometryId: string
            polygons: { x: number; y: number }[][]
            bounds: { minX: number; minY: number; maxX: number; maxY: number }
          }[]
        | undefined
    ) =>
      (packets ?? []).map((packet) => ({
        geometryId: packet.geometryId.split(':').slice(-2).join(':'),
        polygonCount: packet.polygons.length,
        bounds: packet.bounds
      }))

    expect(serializePackets(rectGraphic.__asyraSolidCenterStrokeExportPackets)).toEqual(
      serializePackets(vectorGraphic.__asyraSolidCenterStrokeExportPackets)
    )

    const rectOutsideGraphic = runShapeRenderStrategy('rect', {
      id: 'rect-constrained-dashed-single-edge-equivalent-outside',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      fills: [],
      strokes: [outsideStroke]
    })

    const vectorOutsideGraphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-single-edge-equivalent-outside',
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
      strokes: [outsideStroke]
    })

    expect(
      serializePackets(rectOutsideGraphic.__asyraSolidCenterStrokeExportPackets)
    ).toEqual(
      serializePackets(vectorOutsideGraphic.__asyraSolidCenterStrokeExportPackets)
    )
  })

  it('should run: shape-generated and vector-generated rectangle-equivalent round-join full-loop constrained dashed packets stay equivalent on the first Phase 5 Family D path', () => {
    const insideStroke = createDefaultStroke({
      width: 6,
      style: StrokeStyles.DASHED,
      position: StrokePositions.INSIDE,
      joinType: 'round',
      dashPattern: [400, 20],
      dashOffset: 0
    })

    const rectGraphic = runShapeRenderStrategy('rect', {
      id: 'rect-constrained-dashed-round-join-equivalent',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      fills: [],
      strokes: [insideStroke]
    })

    const vectorGraphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-round-join-equivalent',
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
      strokes: [insideStroke]
    })

    const serializePackets = (
      packets:
        | {
            geometryId: string
            polygons: { x: number; y: number }[][]
            bounds: { minX: number; minY: number; maxX: number; maxY: number }
          }[]
        | undefined
    ) =>
      (packets ?? []).map((packet) => ({
        geometryId: packet.geometryId.split(':').slice(-2).join(':'),
        polygonCount: packet.polygons.length,
        bounds: packet.bounds
      }))

    expect(serializePackets(rectGraphic.__asyraSolidCenterStrokeExportPackets)).toEqual(
      serializePackets(vectorGraphic.__asyraSolidCenterStrokeExportPackets)
    )
  })

  it('should run: shape-generated and vector-generated rectangle-equivalent outside round-join full-loop constrained dashed packets stay equivalent on the next Phase 5 Family D path', () => {
    const outsideStroke = createDefaultStroke({
      width: 6,
      style: StrokeStyles.DASHED,
      position: StrokePositions.OUTSIDE,
      joinType: 'round',
      dashPattern: [400, 20],
      dashOffset: 0
    })

    const rectGraphic = runShapeRenderStrategy('rect', {
      id: 'rect-constrained-dashed-outside-round-join-equivalent',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      fills: [],
      strokes: [outsideStroke]
    })

    const vectorGraphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-outside-round-join-equivalent',
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
      strokes: [outsideStroke]
    })

    const serializePackets = (
      packets:
        | {
            geometryId: string
            polygons: { x: number; y: number }[][]
            bounds: { minX: number; minY: number; maxX: number; maxY: number }
          }[]
        | undefined
    ) =>
      (packets ?? []).map((packet) => ({
        geometryId: packet.geometryId.split(':').slice(-2).join(':'),
        polygonCount: packet.polygons.length,
        bounds: packet.bounds
      }))

    expect(serializePackets(rectGraphic.__asyraSolidCenterStrokeExportPackets)).toEqual(
      serializePackets(vectorGraphic.__asyraSolidCenterStrokeExportPackets)
    )
  })

  it('should run: shape-generated and vector-generated rectangle-equivalent round-cap single-edge constrained dashed packets stay equivalent on the next Phase 5 Family D path', () => {
    const insideStroke = createDefaultStroke({
      width: 4,
      style: StrokeStyles.DASHED,
      position: StrokePositions.INSIDE,
      capType: 'round',
      dashPattern: [20, 220],
      dashOffset: 220
    })

    const rectGraphic = runShapeRenderStrategy('rect', {
      id: 'rect-constrained-dashed-round-cap-equivalent',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      fills: [],
      strokes: [insideStroke]
    })

    const vectorGraphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-round-cap-equivalent',
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
      strokes: [insideStroke]
    })

    const serializePackets = (
      packets:
        | {
            geometryId: string
            polygons: { x: number; y: number }[][]
            bounds: { minX: number; minY: number; maxX: number; maxY: number }
          }[]
        | undefined
    ) =>
      (packets ?? []).map((packet) => ({
        geometryId: packet.geometryId.split(':').slice(-2).join(':'),
        polygonCount: packet.polygons.length,
        bounds: packet.bounds
      }))

    expect(serializePackets(rectGraphic.__asyraSolidCenterStrokeExportPackets)).toEqual(
      serializePackets(vectorGraphic.__asyraSolidCenterStrokeExportPackets)
    )
  })

  it('should run: shape-generated and vector-generated rectangle-equivalent outside round-cap single-edge constrained dashed packets stay equivalent on the next Phase 5 Family D path', () => {
    const outsideStroke = createDefaultStroke({
      width: 4,
      style: StrokeStyles.DASHED,
      position: StrokePositions.OUTSIDE,
      capType: 'round',
      dashPattern: [20, 220],
      dashOffset: 220
    })

    const rectGraphic = runShapeRenderStrategy('rect', {
      id: 'rect-constrained-dashed-outside-round-cap-equivalent',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      fills: [],
      strokes: [outsideStroke]
    })

    const vectorGraphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-outside-round-cap-equivalent',
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
      strokes: [outsideStroke]
    })

    const serializePackets = (
      packets:
        | {
            geometryId: string
            polygons: { x: number; y: number }[][]
            bounds: { minX: number; minY: number; maxX: number; maxY: number }
          }[]
        | undefined
    ) =>
      (packets ?? []).map((packet) => ({
        geometryId: packet.geometryId.split(':').slice(-2).join(':'),
        polygonCount: packet.polygons.length,
        bounds: packet.bounds
      }))

    expect(serializePackets(rectGraphic.__asyraSolidCenterStrokeExportPackets)).toEqual(
      serializePackets(vectorGraphic.__asyraSolidCenterStrokeExportPackets)
    )
  })

  it('should run: shape-generated and vector-generated rectangle-equivalent gradient full-loop constrained dashed packets stay equivalent on the first Phase 6 Family D path', () => {
    const insideStroke = createDefaultStroke({
      width: 6,
      style: StrokeStyles.DASHED,
      position: StrokePositions.INSIDE,
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

    const rectGraphic = runShapeRenderStrategy('rect', {
      id: 'rect-constrained-dashed-gradient-equivalent',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      fills: [],
      strokes: [insideStroke]
    })

    const vectorGraphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-gradient-equivalent',
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
      strokes: [insideStroke]
    })

    const serializePackets = (
      packets:
        | {
            geometryId: string
            polygons: { x: number; y: number }[][]
            bounds: { minX: number; minY: number; maxX: number; maxY: number }
          }[]
        | undefined
    ) =>
      (packets ?? []).map((packet) => ({
        geometryId: packet.geometryId.split(':').slice(-2).join(':'),
        polygonCount: packet.polygons.length,
        bounds: packet.bounds
      }))

    expect(getProjectionMeshes(rectGraphic)).toHaveLength(0)
    expect(getProjectionMeshes(vectorGraphic)).toHaveLength(0)
    expect(getProjectionGraphics(rectGraphic)).toHaveLength(1)
    expect(getProjectionGraphics(vectorGraphic)).toHaveLength(1)
    expect(serializePackets(rectGraphic.__asyraSolidCenterStrokeExportPackets)).toEqual(
      serializePackets(vectorGraphic.__asyraSolidCenterStrokeExportPackets)
    )
  })
})
