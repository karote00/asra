import { beforeAll, describe, it, expect, vi } from 'vitest'
import { BehaviorSubject, Subscription } from 'rxjs'
import {
  componentRegistry,
  elementPropertyRegistry,
  renderStrategyRegistry,
  type VectorNetwork,
  type VectorPointNode,
  type VectorSegment
} from '@asyra/core'
import core from '@asyra/core'
import {
  FillColorFormats,
  FillGradientTypes,
  FillKinds,
  PropertyTypes,
  StrokePositions
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
      registerRenderLayer: () => {
        // no-op for this unit test; vector component registration is asserted via registries.
      },
      registerPropertySchema: () => undefined,
      defineSelection: () => undefined,
      getSelection: () => undefined,
      defineUIProperty: () => {
        // no-op for this unit test.
      },
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

const setPathEditingState = (state: {
  vectorId: string | null
  mode: boolean
  dragging: boolean
}) => {
  core.setSystemProperty('pathEditingVectorId', state.vectorId)
  core.setSystemProperty('pathEditingMode', state.mode)
  core.setSystemProperty('mouseDragging', state.dragging)
}

const runRenderStrategy = (
  strategy: unknown,
  graphic: unknown,
  data: unknown
) => {
  ;(strategy as (graphic: unknown, data: unknown) => void)(graphic, data)
}

interface TestAnchorPoint {
  id: string
  x: number
  y: number
  inHandle?: { x: number; y: number } | null
  outHandle?: { x: number; y: number } | null
}

const toVectorData = (anchors: TestAnchorPoint[], closed: boolean) => {
  const points: Record<string, VectorPointNode> = {}
  const segments: Record<string, VectorSegment> = {}
  const networks: Record<string, VectorNetwork> = {
    'tn-0': {
      id: 'tn-0',
      pointIds: anchors.map((anchor) => anchor.id),
      segmentIds: [],
      closed
    }
  }

  anchors.forEach((anchor, index) => {
    points[anchor.id] = {
      id: anchor.id,
      kind: 'anchor',
      anchorType: 'sharp',
      x: anchor.x,
      y: anchor.y
    }

    if (anchor.inHandle) {
      points[`${anchor.id}:in`] = {
        id: `${anchor.id}:in`,
        kind: 'control',
        controlForId: anchor.id,
        controlRole: 'in',
        x: anchor.inHandle.x,
        y: anchor.inHandle.y
      }
    }

    if (anchor.outHandle) {
      points[`${anchor.id}:out`] = {
        id: `${anchor.id}:out`,
        kind: 'control',
        controlForId: anchor.id,
        controlRole: 'out',
        x: anchor.outHandle.x,
        y: anchor.outHandle.y
      }
    }

    if (index === 0) {
      return
    }

    const prev = anchors[index - 1]
    const segmentId = `ts-${index - 1}`
    segments[segmentId] = {
      id: segmentId,
      startId: prev.id,
      endId: anchor.id,
      outControlId: prev.outHandle ? `${prev.id}:out` : null,
      inControlId: anchor.inHandle ? `${anchor.id}:in` : null
    }
    networks['tn-0'].segmentIds.push(segmentId)
  })

  if (closed && anchors.length > 1) {
    const first = anchors[0]
    const last = anchors[anchors.length - 1]
    const segmentId = 'ts-close'
    segments[segmentId] = {
      id: segmentId,
      startId: last.id,
      endId: first.id,
      outControlId: last.outHandle ? `${last.id}:out` : null,
      inControlId: first.inHandle ? `${first.id}:in` : null
    }
    networks['tn-0'].segmentIds.push(segmentId)
  }

  return { points, segments, networks }
}

const createSolidFill = (color: string, opacity = 1) => ({
  kind: FillKinds.SOLID,
  defaultColorFormat: FillColorFormats.HEX,
  colorFormat: FillColorFormats.HEX,
  color,
  opacity,
  visible: true,
  gradient: null
})

describe('Vector Component', () => {
  it('should register vector component in all registries', () => {
    expect(componentRegistry.has('vector')).toBe(true)
    expect(
      elementPropertyRegistry.getPropertiesForComponent('vector').length
    ).toBeGreaterThan(0)
    expect(renderStrategyRegistry.has('vector')).toBe(true)
  })

  it('should register topology properties', () => {
    const properties =
      elementPropertyRegistry.getPropertiesForComponent('vector')
    const pointsProp = properties.find((p) => p.name === 'points')
    const segmentsProp = properties.find((p) => p.name === 'segments')
    const networksProp = properties.find((p) => p.name === 'networks')
    const anchorPointsProp = properties.find((p) => p.name === 'anchorPoints')

    expect(pointsProp?.type).toBe(PropertyTypes.VECTOR_POINTS)
    expect(pointsProp?.defaultValue).toEqual({})
    expect(segmentsProp?.type).toBe(PropertyTypes.VECTOR_SEGMENTS)
    expect(segmentsProp?.defaultValue).toEqual({})
    expect(networksProp?.type).toBe(PropertyTypes.VECTOR_NETWORKS)
    expect(networksProp?.defaultValue).toEqual({})
    expect(anchorPointsProp).toBeUndefined()
  })

  it('should register closed property', () => {
    const properties =
      elementPropertyRegistry.getPropertiesForComponent('vector')
    const closedProp = properties.find((p) => p.name === 'closed')

    expect(closedProp).toBeDefined()
    expect(closedProp?.type).toBe('custom')
    expect(closedProp?.defaultValue).toBe(false)
  })

  it('should register fill properties', () => {
    const properties =
      elementPropertyRegistry.getPropertiesForComponent('vector')
    const fillsProp = properties.find((p) => p.name === 'fills')
    const strokesProp = properties.find((p) => p.name === 'strokes')
    const fillProp = properties.find((p) => p.name === 'fill')
    const strokeStyleProp = properties.find((p) => p.name === 'strokeStyle')

    expect(fillsProp).toBeDefined()
    expect(fillsProp?.type).toBe(PropertyTypes.FILLS)
    expect(Array.isArray(fillsProp?.defaultValue)).toBe(true)

    expect(strokesProp).toBeDefined()
    expect(strokesProp?.type).toBe(PropertyTypes.STROKES)
    expect(Array.isArray(strokesProp?.defaultValue)).toBe(true)

    expect(fillProp).toBeDefined()
    expect(fillProp?.defaultValue).toBe('none')

    expect(strokeStyleProp).toBeDefined()
    expect(strokeStyleProp?.alias).toEqual(['stroke', 'strokeWidth'])
    expect(strokeStyleProp?.defaultValue).toEqual({
      stroke: '#cccccc',
      strokeWidth: 1
    })
  })

  it('should have renderStrategy registered', () => {
    expect(renderStrategyRegistry.has('vector')).toBe(true)
    const renderStrategy = renderStrategyRegistry.get('vector')
    expect(typeof renderStrategy).toBe('function')
  })

  it('should render straight lines for sharp anchor points', () => {
    const renderStrategy = renderStrategyRegistry.get('vector')
    expect(renderStrategy).toBeDefined()

    if (!renderStrategy) return

    const mockGraphic = {
      clear: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      closePath: vi.fn(),
      cut: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn()
    }

    const mockData = {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      ...toVectorData(
        [
          { id: '1', x: 0, y: 0 },
          { id: '2', x: 100, y: 0 },
          { id: '3', x: 100, y: 100 }
        ],
        false
      ),
      closed: false,
      fills: [],
      stroke: '#000000',
      strokeWidth: 2
    }

    runRenderStrategy(renderStrategy, mockGraphic, mockData)

    expect(mockGraphic.clear).toHaveBeenCalled()
    expect(mockGraphic.stroke).toHaveBeenCalledWith(
      expect.objectContaining({
        width: 2,
        color: 0x000000,
        cap: 'round',
        join: 'round'
      })
    )
    expect(mockGraphic.moveTo).toHaveBeenCalledWith(0, 0)
    expect(mockGraphic.lineTo).toHaveBeenCalledWith(100, 0)
    expect(mockGraphic.lineTo).toHaveBeenCalledWith(100, 100)
    expect(mockGraphic.bezierCurveTo).not.toHaveBeenCalled()
  })

  it('should render bezier curves for smooth anchor points', () => {
    const renderStrategy = renderStrategyRegistry.get('vector')
    expect(renderStrategy).toBeDefined()

    if (!renderStrategy) return

    const mockGraphic = {
      clear: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      closePath: vi.fn(),
      cut: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn()
    }

    const mockData = {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      ...toVectorData(
        [
          { id: '1', x: 0, y: 0, outHandle: { x: 25, y: 0 } },
          { id: '2', x: 100, y: 100, inHandle: { x: 75, y: 100 } }
        ],
        false
      ),
      closed: false,
      fills: [],
      stroke: '#000000',
      strokeWidth: 2
    }

    runRenderStrategy(renderStrategy, mockGraphic, mockData)

    expect(mockGraphic.bezierCurveTo).toHaveBeenCalledWith(
      25,
      0,
      75,
      100,
      100,
      100
    )
  })

  it('should render bezier curves when either handle exists', () => {
    const renderStrategy = renderStrategyRegistry.get('vector')
    expect(renderStrategy).toBeDefined()

    if (!renderStrategy) return

    const mockGraphic = {
      clear: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      closePath: vi.fn(),
      cut: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn()
    }

    const mockData = {
      x: 0,
      y: 0,
      width: 200,
      height: 200,
      ...toVectorData(
        [
          { id: '1', x: 0, y: 0, outHandle: { x: 50, y: 0 } },
          { id: '2', x: 100, y: 100 }
        ],
        false
      ),
      closed: false,
      fills: [],
      stroke: '#000000',
      strokeWidth: 2
    }

    runRenderStrategy(renderStrategy, mockGraphic, mockData)

    expect(mockGraphic.bezierCurveTo).toHaveBeenCalledWith(
      50,
      0,
      100,
      100,
      100,
      100
    )
    expect(mockGraphic.lineTo).not.toHaveBeenCalledWith(100, 100)
  })

  it('should close path and fill when closed is true', () => {
    const renderStrategy = renderStrategyRegistry.get('vector')
    expect(renderStrategy).toBeDefined()

    if (!renderStrategy) return

    const mockGraphic = {
      clear: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      closePath: vi.fn(),
      cut: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn()
    }

    const mockData = {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      ...toVectorData(
        [
          { id: '1', x: 0, y: 0 },
          { id: '2', x: 100, y: 0 },
          { id: '3', x: 100, y: 100 },
          { id: '4', x: 0, y: 100 }
        ],
        true
      ),
      closed: true,
      fills: [createSolidFill('#ff0000')],
      stroke: '#000000',
      strokeWidth: 2
    }

    runRenderStrategy(renderStrategy, mockGraphic, mockData)

    expect(mockGraphic.closePath).toHaveBeenCalled()
    expect(mockGraphic.fill).toHaveBeenCalledWith(0xff0000)
  })

  it('should render multiple fills in order', () => {
    const renderStrategy = renderStrategyRegistry.get('vector')
    expect(renderStrategy).toBeDefined()

    if (!renderStrategy) return

    const mockGraphic = {
      clear: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      closePath: vi.fn(),
      cut: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn()
    }

    const mockData = {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      ...toVectorData(
        [
          { id: '1', x: 0, y: 0 },
          { id: '2', x: 100, y: 0 },
          { id: '3', x: 100, y: 100 },
          { id: '4', x: 0, y: 100 }
        ],
        true
      ),
      closed: true,
      fills: [createSolidFill('#ffffff', 0.6), createSolidFill('#ff0000', 0.3)],
      stroke: '#000000',
      strokeWidth: 2
    }

    runRenderStrategy(renderStrategy, mockGraphic, mockData)

    expect(mockGraphic.fill).toHaveBeenCalledTimes(2)
    expect(mockGraphic.fill.mock.calls[0]?.[0]).toEqual({
      color: 0xffffff,
      alpha: 0.6
    })
    expect(mockGraphic.fill.mock.calls[1]?.[0]).toEqual({
      color: 0xff0000,
      alpha: 0.3
    })
  })

  it('should preview fill during path-editing drag for closed paths', () => {
    const renderStrategy = renderStrategyRegistry.get('vector')
    expect(renderStrategy).toBeDefined()

    if (!renderStrategy) return

    setPathEditingState({ vectorId: 'vector-1', mode: true, dragging: true })

    const mockGraphic = {
      clear: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      closePath: vi.fn(),
      cut: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn()
    }

    const mockData = {
      id: 'vector-1',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      ...toVectorData(
        [
          { id: '1', x: 0, y: 0 },
          { id: '2', x: 100, y: 0 },
          { id: '3', x: 100, y: 100 },
          { id: '4', x: 0, y: 100 }
        ],
        true
      ),
      closed: true,
      fills: [createSolidFill('#ff0000')],
      stroke: '#000000',
      strokeWidth: 2
    }

    runRenderStrategy(renderStrategy, mockGraphic, mockData)

    expect(mockGraphic.fill).toHaveBeenCalled()

    setPathEditingState({ vectorId: null, mode: false, dragging: false })
  })

  it('should not preview fill during drag for open paths', () => {
    const renderStrategy = renderStrategyRegistry.get('vector')
    expect(renderStrategy).toBeDefined()

    if (!renderStrategy) return

    setPathEditingState({ vectorId: 'vector-2', mode: true, dragging: true })

    const mockGraphic = {
      clear: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      closePath: vi.fn(),
      cut: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn()
    }

    const mockData = {
      id: 'vector-2',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      ...toVectorData(
        [
          { id: '1', x: 0, y: 0 },
          { id: '2', x: 100, y: 0 },
          { id: '3', x: 100, y: 100 }
        ],
        false
      ),
      closed: false,
      fills: [createSolidFill('#ff0000')],
      stroke: '#000000',
      strokeWidth: 2
    }

    runRenderStrategy(renderStrategy, mockGraphic, mockData)

    expect(mockGraphic.fill).not.toHaveBeenCalled()

    setPathEditingState({ vectorId: null, mode: false, dragging: false })
  })

  it('should not render path segments when only one point exists', () => {
    const renderStrategy = renderStrategyRegistry.get('vector')
    expect(renderStrategy).toBeDefined()

    if (!renderStrategy) return

    const mockGraphic = {
      clear: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      closePath: vi.fn(),
      cut: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn()
    }

    const mockData = {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      ...toVectorData([{ id: '1', x: 0, y: 0 }], false),
      closed: false,
      fills: [],
      stroke: '#000000',
      strokeWidth: 2
    }

    runRenderStrategy(renderStrategy, mockGraphic, mockData)

    expect(mockGraphic.clear).toHaveBeenCalled()
    expect(mockGraphic.moveTo).toHaveBeenCalledWith(0, 0)
    expect(mockGraphic.lineTo).not.toHaveBeenCalled()
    expect(mockGraphic.stroke).toHaveBeenCalled()
  })

  it('should hover-hit outside rendered stroke pixels for gradient-filled vectors', () => {
    const renderStrategy = renderStrategyRegistry.get('vector')
    expect(renderStrategy).toBeDefined()

    if (!renderStrategy) return

    const createEvenOddFillStyleMock = vi
      .spyOn(core, 'createEvenOddFillStyle')
      .mockReturnValue({
        style: {},
        dispose: () => undefined
      } as never)

    const mockGraphic = {
      clear: vi.fn(),
      rect: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      closePath: vi.fn(),
      cut: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      beginPath: vi.fn(),
      hitArea: null as { contains: (x: number, y: number) => boolean } | null
    }

    const mockData = {
      id: 'vector-gradient-stroke',
      x: 0,
      y: 0,
      width: 60,
      height: 60,
      ...toVectorData(
        [
          { id: '1', x: 0, y: 0 },
          { id: '2', x: 60, y: 0 },
          { id: '3', x: 60, y: 60 },
          { id: '4', x: 0, y: 60 }
        ],
        true
      ),
      closed: true,
      fills: [
        {
          ...createSolidFill('#ffffff'),
          kind: FillKinds.GRADIENT,
          gradient: {
            gradientType: FillGradientTypes.LINEAR,
            gradientStops: [
              { position: 0, color: '#ffffff', opacity: 1 },
              { position: 1, color: '#000000', opacity: 1 }
            ],
            gradientHandles: [
              { x: 0.5, y: 0 },
              { x: 0.5, y: 1 }
            ],
            metadata: {}
          }
        }
      ],
      strokes: [
        {
          id: '',
          type: 'stroke',
          style: 'solid',
          position: StrokePositions.OUTSIDE,
          width: 20,
          dash: 20,
          gap: 20,
          defaultColorFormat: FillColorFormats.HEX,
          colorFormat: FillColorFormats.HEX,
          color: '#ff0055',
          opacity: 1,
          visible: true,
          joinType: 'miter',
          miterAngle: 28.96
        }
      ],
      stroke: '#ff0055',
      strokeWidth: 20
    }

    runRenderStrategy(renderStrategy, mockGraphic, mockData)

    expect(mockGraphic.hitArea?.contains(-15, 30)).toBe(true)
    expect(mockGraphic.hitArea?.contains(-25, 30)).toBe(false)

    createEvenOddFillStyleMock.mockRestore()
  })

  it('should use even-odd fill hover logic for self-intersecting gradient vectors', () => {
    const renderStrategy = renderStrategyRegistry.get('vector')
    expect(renderStrategy).toBeDefined()

    if (!renderStrategy) return

    const createEvenOddFillStyleMock = vi
      .spyOn(core, 'createEvenOddFillStyle')
      .mockReturnValue({
        style: {},
        dispose: () => undefined
      } as never)

    const mockGraphic = {
      clear: vi.fn(),
      rect: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      closePath: vi.fn(),
      cut: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      beginPath: vi.fn(),
      hitArea: null as { contains: (x: number, y: number) => boolean } | null
    }

    const mockData = {
      id: 'vector-gradient-evenodd',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      ...toVectorData(
        [
          { id: '1', x: 50, y: 0 },
          { id: '2', x: 79, y: 90 },
          { id: '3', x: 2, y: 35 },
          { id: '4', x: 98, y: 35 },
          { id: '5', x: 21, y: 90 }
        ],
        true
      ),
      closed: true,
      fills: [
        {
          ...createSolidFill('#ffffff'),
          kind: FillKinds.GRADIENT,
          gradient: {
            gradientType: FillGradientTypes.LINEAR,
            gradientStops: [
              { position: 0, color: '#ffffff', opacity: 1 },
              { position: 1, color: '#000000', opacity: 1 }
            ],
            gradientHandles: [
              { x: 0.5, y: 0 },
              { x: 0.5, y: 1 }
            ],
            metadata: {}
          }
        }
      ],
      strokes: [],
      stroke: '#000000',
      strokeWidth: 0
    }

    runRenderStrategy(renderStrategy, mockGraphic, mockData)

    expect(mockGraphic.hitArea?.contains(50, 18)).toBe(true)
    expect(mockGraphic.hitArea?.contains(50, 52)).toBe(false)

    createEvenOddFillStyleMock.mockRestore()
  })

  it('should hover-hit internal self-intersecting star segments on non-gradient vectors', () => {
    const renderStrategy = renderStrategyRegistry.get('vector')
    expect(renderStrategy).toBeDefined()

    if (!renderStrategy) return

    const mockGraphic = {
      clear: vi.fn(),
      rect: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      closePath: vi.fn(),
      cut: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      beginPath: vi.fn(),
      hitArea: null as { contains: (x: number, y: number) => boolean } | null
    }

    const mockData = {
      id: 'vector-star-stroke',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      ...toVectorData(
        [
          { id: '1', x: 50, y: 0 },
          { id: '2', x: 79, y: 90 },
          { id: '3', x: 2, y: 35 },
          { id: '4', x: 98, y: 35 },
          { id: '5', x: 21, y: 90 }
        ],
        true
      ),
      closed: true,
      fills: [],
      strokes: [
        {
          id: '',
          type: 'stroke',
          style: 'solid',
          position: StrokePositions.CENTER,
          width: 12,
          dash: 20,
          gap: 20,
          defaultColorFormat: FillColorFormats.HEX,
          colorFormat: FillColorFormats.HEX,
          color: '#ff0055',
          opacity: 1,
          visible: true,
          joinType: 'round',
          miterAngle: 28.96
        }
      ],
      stroke: '#ff0055',
      strokeWidth: 12
    }

    runRenderStrategy(renderStrategy, mockGraphic, mockData)

    expect(mockGraphic.hitArea?.contains(50, 35)).toBe(true)
    expect(mockGraphic.hitArea?.contains(50, 52)).toBe(false)
  })
})
