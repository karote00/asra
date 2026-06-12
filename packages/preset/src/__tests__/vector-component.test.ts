import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  it,
  expect,
  vi
} from 'vitest'
import { BehaviorSubject, Subscription } from 'rxjs'
import { Container, Mesh } from 'pixi.js'
import Clipper2ZFactory from 'clipper2-wasm'
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
  StrokePositions,
  createDefaultStroke
} from '@asyra/utils'
import { applyPreset } from '../preset'
import type { PresetDependencies } from '../types'
import type { SolidCenterStrokeExportPacket } from '../components/stroke-render/solid-center-stroke-packets'
import { createReportedRoundInsideDashedStarVectorData } from './inside-dashed-fixtures'
import {
  registerGeometryBackend,
  selectGeometryBackend
} from '../components/stroke-render/geometry-backend'
import {
  createClipper2GeometryBackend,
  type Clipper2Module
} from '../components/stroke-render/clipper2-geometry-backend'
import type { StrokeDiagnosticsMode } from '../components/stroke-render/stroke-diagnostics-mode'

const require = createRequire(import.meta.url)
const clipperWasmPath = require.resolve('clipper2-wasm/dist/umd/clipper2z.wasm')
const CLIPPER_VECTOR_COMPONENT_TEST_BACKEND_ID =
  'vector-component-clipper2-test'
const DIAGNOSTIC_MISSING_EXACT_BACKEND_ID =
  'diagnostic-missing-exact-geometry-backend'

const loadClipperModule = async () =>
  (await (
    Clipper2ZFactory as (options: {
      wasmBinary: Uint8Array
    }) => Promise<Clipper2Module>
  )({
    wasmBinary: readFileSync(clipperWasmPath)
  })) as Clipper2Module

const selectClipper2VectorComponentBackend = async () => {
  const backend = createClipper2GeometryBackend(await loadClipperModule(), {
    backendId: CLIPPER_VECTOR_COMPONENT_TEST_BACKEND_ID,
    backendVersion: `${CLIPPER_VECTOR_COMPONENT_TEST_BACKEND_ID}@test`
  })

  registerGeometryBackend({
    backendId: CLIPPER_VECTOR_COMPONENT_TEST_BACKEND_ID,
    load: () => backend
  })
  selectGeometryBackend(CLIPPER_VECTOR_COMPONENT_TEST_BACKEND_ID)
}

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
  selectGeometryBackend(DIAGNOSTIC_MISSING_EXACT_BACKEND_ID)
})

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

const createSelfIntersectingStarsVectorData = (starCount: number) => {
  const points: Record<string, VectorPointNode> = {}
  const segments: Record<string, VectorSegment> = {}
  const networks: Record<string, VectorNetwork> = {}
  const starOrder = [0, 2, 4, 1, 3]

  for (let starIndex = 0; starIndex < starCount; starIndex += 1) {
    const networkId = `self-star-network-${starIndex}`
    const centerX = (starIndex % 4) * 84 + 42
    const centerY = Math.floor(starIndex / 4) * 84 + 42
    const radius = 34
    const orderedPointIds: string[] = []

    starOrder.forEach((outerPointIndex, pointIndex) => {
      const angle = -Math.PI / 2 + (outerPointIndex * Math.PI * 2) / 5
      const pointId = `self-star-${starIndex}-p-${pointIndex}`
      points[pointId] = {
        id: pointId,
        kind: 'anchor',
        anchorType: 'sharp',
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius
      }
      orderedPointIds.push(pointId)
    })

    networks[networkId] = {
      id: networkId,
      pointIds: orderedPointIds,
      segmentIds: [],
      closed: true
    }

    orderedPointIds.forEach((startId, pointIndex) => {
      const endId = orderedPointIds[(pointIndex + 1) % orderedPointIds.length]
      const segmentId = `self-star-${starIndex}-s-${pointIndex}`
      segments[segmentId] = {
        id: segmentId,
        startId,
        endId,
        outControlId: null,
        inControlId: null
      }
      networks[networkId].segmentIds.push(segmentId)
    })
  }

  return {
    id: `vector-self-stars-${starCount}`,
    x: 0,
    y: 0,
    width: 340,
    height: 260,
    points,
    segments,
    networks,
    closed: true,
    fills: [createSolidFill('#000000')],
    strokes: [
      createDefaultStroke({
        style: 'dashed',
        position: 'inside',
        width: 6,
        dashPattern: [18, 10],
        dashOffset: 0,
        color: '#000000',
        opacity: 1,
        visible: true,
        joinType: 'round'
      })
    ]
  }
}

class RecordingGraphic extends Container {
  __asyraSolidCenterStrokeExportPackets?: SolidCenterStrokeExportPacket[]
  __asyraCenterPathSolidStrokeRenderCount?: number
  __asyraConstrainedDashedRuntimeDiagnostics?: {
    acceptedCount: number
    blockedCount: number
    entries: {
      status: string
      reason: string
      candidatePacketCount: number
    }[]
  }
  instructions: { action: string; args: unknown[] }[] = []
  hitArea?: { contains: (x: number, y: number) => boolean }

  clear() {
    this.instructions.push({ action: 'clear', args: [] })
    return this
  }

  rect(...args: unknown[]) {
    this.instructions.push({ action: 'rect', args })
    return this
  }

  beginPath() {
    this.instructions.push({ action: 'beginPath', args: [] })
    return this
  }

  moveTo(...args: unknown[]) {
    this.instructions.push({ action: 'moveTo', args })
    return this
  }

  lineTo(...args: unknown[]) {
    this.instructions.push({ action: 'lineTo', args })
    return this
  }

  bezierCurveTo(...args: unknown[]) {
    this.instructions.push({ action: 'bezierCurveTo', args })
    return this
  }

  closePath() {
    this.instructions.push({ action: 'closePath', args: [] })
    return this
  }

  cut() {
    this.instructions.push({ action: 'cut', args: [] })
    return this
  }

  fill(...args: unknown[]) {
    this.instructions.push({ action: 'fill', args })
    return this
  }

  stroke(...args: unknown[]) {
    this.instructions.push({ action: 'stroke', args })
    return this
  }
}

const createMeshMockGraphic = () => new RecordingGraphic()

const getProjectionMeshes = (host: Container) =>
  host.children.flatMap((child) => {
    if (!(child instanceof Container)) {
      return []
    }

    return child.children.filter(
      (grandchild): grandchild is Mesh => grandchild instanceof Mesh
    )
  })

const countInstructions = (graphic: RecordingGraphic, action: string) =>
  graphic.instructions.filter((instruction) => instruction.action === action)

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

    expect(fillsProp).toBeDefined()
    expect(fillsProp?.type).toBe(PropertyTypes.FILLS)
    expect(Array.isArray(fillsProp?.defaultValue)).toBe(true)

    expect(strokesProp).toBeDefined()
    expect(strokesProp?.type).toBe(PropertyTypes.STROKES)
    expect(Array.isArray(strokesProp?.defaultValue)).toBe(true)
  })

  it('should have renderStrategy registered', () => {
    expect(renderStrategyRegistry.has('vector')).toBe(true)
    const renderStrategy = renderStrategyRegistry.get('vector')
    expect(typeof renderStrategy).toBe('function')
  })

  it('should render sharp open paths through final-face projection', () => {
    const renderStrategy = renderStrategyRegistry.get('vector')
    expect(renderStrategy).toBeDefined()

    if (!renderStrategy) return
    const mockGraphic = createMeshMockGraphic()

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
      fills: [createSolidFill('#ffffff')],
      strokes: [
        createDefaultStroke({ color: '#000000', width: 2, joinType: 'round' })
      ]
    }

    runRenderStrategy(renderStrategy, mockGraphic, mockData)

    expect(countInstructions(mockGraphic, 'clear')).toHaveLength(1)
    expect(countInstructions(mockGraphic, 'bezierCurveTo')).toHaveLength(0)
    expect(getProjectionMeshes(mockGraphic)).toHaveLength(1)
    expect(countInstructions(mockGraphic, 'stroke')).toHaveLength(0)
    expect(mockGraphic.__asyraCenterPathSolidStrokeRenderCount).toBe(0)
    expect(mockGraphic.__asyraSolidCenterStrokeExportPackets).toHaveLength(1)
  })

  it('should publish geometry bounds without stroke expansion', () => {
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
      id: 'vector-geometry-bounds',
      x: 24,
      y: 32,
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
      strokes: [
        createDefaultStroke({
          id: 'stroke-1',
          color: '#ff0055',
          width: 24,
          position: StrokePositions.OUTSIDE
        }),
        createDefaultStroke({
          id: 'stroke-2',
          color: '#0055ff',
          width: 40,
          position: StrokePositions.INSIDE
        })
      ]
    }

    runRenderStrategy(renderStrategy, mockGraphic, mockData)
    expect(
      (
        mockGraphic as {
          __asyraGeometryLocalBounds?: {
            x: number
            y: number
            width: number
            height: number
          } | null
        }
      ).__asyraGeometryLocalBounds
    ).toEqual({
      x: 0,
      y: 0,
      width: 100,
      height: 100
    })
  })

  it('should render smooth open paths through final-face projection', () => {
    const renderStrategy = renderStrategyRegistry.get('vector')
    expect(renderStrategy).toBeDefined()

    if (!renderStrategy) return

    const mockGraphic = createMeshMockGraphic()

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
      fills: [createSolidFill('#ffffff')],
      strokes: [createDefaultStroke({ color: '#000000', width: 2 })]
    }

    runRenderStrategy(renderStrategy, mockGraphic, mockData)

    expect(getProjectionMeshes(mockGraphic)).toHaveLength(1)
    expect(mockGraphic.__asyraCenterPathSolidStrokeRenderCount).toBe(0)
    expect(mockGraphic.__asyraSolidCenterStrokeExportPackets).toHaveLength(1)
  })

  it('should render one-handle open paths through final-face projection', () => {
    const renderStrategy = renderStrategyRegistry.get('vector')
    expect(renderStrategy).toBeDefined()

    if (!renderStrategy) return

    const mockGraphic = createMeshMockGraphic()

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
      fills: [createSolidFill('#ffffff')],
      strokes: [createDefaultStroke({ color: '#000000', width: 2 })]
    }

    runRenderStrategy(renderStrategy, mockGraphic, mockData)

    expect(getProjectionMeshes(mockGraphic)).toHaveLength(1)
    expect(mockGraphic.__asyraCenterPathSolidStrokeRenderCount).toBe(0)
    expect(mockGraphic.__asyraSolidCenterStrokeExportPackets).toHaveLength(1)
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
      strokes: [createDefaultStroke({ color: '#000000', width: 2 })]
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
      strokes: [createDefaultStroke({ color: '#000000', width: 2 })]
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
      strokes: [createDefaultStroke({ color: '#000000', width: 2 })]
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
      strokes: [createDefaultStroke({ color: '#000000', width: 2 })]
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
      strokes: [createDefaultStroke({ color: '#000000', width: 2 })]
    }

    runRenderStrategy(renderStrategy, mockGraphic, mockData)

    expect(mockGraphic.clear).toHaveBeenCalled()
    expect(mockGraphic.moveTo).toHaveBeenCalledWith(0, 0)
    expect(mockGraphic.lineTo).not.toHaveBeenCalled()
  })

  it('should run: expand gradient vector hover hit to include supported outside solid stroke', () => {
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
          dashPattern: [20, 20],
          dashOffset: 0,
          defaultColorFormat: FillColorFormats.HEX,
          colorFormat: FillColorFormats.HEX,
          color: '#ff0055',
          opacity: 1,
          visible: true,
          joinType: 'miter',
          miterAngle: 28.96
        }
      ]
    }

    runRenderStrategy(renderStrategy, mockGraphic, mockData)

    expect(mockGraphic.hitArea?.contains(30, 30)).toBe(true)
    expect(mockGraphic.hitArea?.contains(-10, -10)).toBe(true)
    expect(mockGraphic.hitArea?.contains(-25, -25)).toBe(false)

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
      strokes: []
    }

    runRenderStrategy(renderStrategy, mockGraphic, mockData)

    expect(mockGraphic.hitArea?.contains(50, 18)).toBe(true)
    expect(mockGraphic.hitArea?.contains(50, 52)).toBe(false)

    createEvenOddFillStyleMock.mockRestore()
  })

  it('should expose canonical stroke hover hit on non-gradient vectors through stroke packets', () => {
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
        createDefaultStroke({
          style: 'solid',
          position: StrokePositions.CENTER,
          width: 12,
          color: '#ff0055',
          opacity: 1,
          joinType: 'round'
        })
      ]
    }

    runRenderStrategy(renderStrategy, mockGraphic, mockData)

    expect(mockGraphic.hitArea?.contains(50, 6)).toBe(true)
  })

  it('should run: render visible FinalFace-derived constrained dashed split-range geometry for self-intersecting repeated dashed inside stars', async () => {
    await selectClipper2VectorComponentBackend()
    const renderStrategy = renderStrategyRegistry.get('vector')
    expect(renderStrategy).toBeDefined()

    if (!renderStrategy) return
    const mockGraphic = createMeshMockGraphic()

    const mockData = {
      id: 'vector-star-dashed',
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
        createDefaultStroke({
          style: 'dashed',
          position: 'inside',
          width: 12,
          dashPattern: [20, 20],
          dashOffset: 0,
          color: '#ff0055',
          opacity: 1,
          visible: true,
          joinType: 'miter',
          miterAngle: 28.96
        })
      ]
    }

    runRenderStrategy(renderStrategy, mockGraphic, mockData)
    expect(
      mockGraphic.__asyraSolidCenterStrokeExportPackets?.some(
        (packet) => packet.debugMeta?.geometryFamily === 'constrained-dashed'
      ),
      JSON.stringify(
        {
          exportPacketCount:
            mockGraphic.__asyraSolidCenterStrokeExportPackets?.length ?? 0,
          exportPackets:
            mockGraphic.__asyraSolidCenterStrokeExportPackets?.map(
              (packet) => ({
                geometryId: packet.geometryId,
                polygonCount: packet.polygons.length,
                geometryFamily: packet.debugMeta?.geometryFamily,
                resolutionStatus: packet.debugMeta?.resolutionStatus,
                runtimeStatus: packet.debugMeta?.runtimeStatus,
                finalCoverageBuilderStatus:
                  packet.debugMeta?.finalCoverageBuilderStatus,
                sourceTopology: packet.debugMeta?.sourceTopology,
                visualOverlapCollapseStatus:
                  packet.debugMeta?.visualOverlapCollapseStatus
              })
            ) ?? [],
          diagnostics: mockGraphic.__asyraConstrainedDashedRuntimeDiagnostics
        },
        null,
        2
      )
    ).toBe(true)
    expect(
      mockGraphic.__asyraSolidCenterStrokeExportPackets?.every(
        (packet) =>
          packet.debugMeta?.geometryFamily === 'constrained-dashed' &&
          packet.debugMeta?.resolutionStatus === 'exact-constrained' &&
          (packet.debugMeta?.finalCoverageBuilderStatus === 'product-final' ||
            packet.debugMeta?.finalCoverageBuilderStatus === 'debug-raw') &&
          packet.debugMeta?.runtimeStatus === 'accepted'
      )
    ).toBe(true)
    expect(
      mockGraphic.__asyraConstrainedDashedRuntimeDiagnostics
    ).toMatchObject({
      acceptedCount: 1,
      blockedCount: 0,
      entries: [
        {
          status: 'accepted',
          sourceTopology: 'self-intersecting'
        }
      ]
    })
    expect(countInstructions(mockGraphic, 'stroke')).toHaveLength(0)
  })

  it('should run: render many self-intersecting inside dashed stars as source-path product-final geometry without exceeding frame budget', async () => {
    await selectClipper2VectorComponentBackend()
    const renderStrategy = renderStrategyRegistry.get('vector')
    expect(renderStrategy).toBeDefined()

    if (!renderStrategy) return
    runRenderStrategy(
      renderStrategy,
      createMeshMockGraphic(),
      createSelfIntersectingStarsVectorData(12)
    )
    const mockGraphic = createMeshMockGraphic()
    const mockData = createSelfIntersectingStarsVectorData(12)
    const elapsedSamples: number[] = []

    for (let runIndex = 0; runIndex < 3; runIndex += 1) {
      const start = performance.now()
      runRenderStrategy(renderStrategy, mockGraphic, mockData)
      elapsedSamples.push(performance.now() - start)
    }

    const elapsedMs = Math.min(...elapsedSamples)
    if (process.env.ASYRA_STROKE_API_PROFILE === '1') {
      expect(elapsedMs).toBeLessThan(16.7)
    }
    expect(
      mockGraphic.__asyraSolidCenterStrokeExportPackets?.some(
        (packet) => packet.debugMeta?.geometryFamily === 'constrained-dashed'
      ),
      JSON.stringify(
        {
          exportPacketCount:
            mockGraphic.__asyraSolidCenterStrokeExportPackets?.length ?? 0,
          diagnostics: mockGraphic.__asyraConstrainedDashedRuntimeDiagnostics,
          packets: mockGraphic.__asyraSolidCenterStrokeExportPackets?.slice(
            0,
            12
          )
        },
        null,
        2
      )
    ).toBe(true)
    expect(
      mockGraphic.__asyraSolidCenterStrokeExportPackets?.length ?? 0
    ).toBeLessThanOrEqual(720)
    expect(
      mockGraphic.__asyraSolidCenterStrokeExportPackets?.every(
        (packet) =>
          packet.debugMeta?.geometryFamily === 'constrained-dashed' &&
          packet.debugMeta?.resolutionStatus === 'exact-constrained' &&
          (packet.debugMeta?.finalCoverageBuilderStatus === 'product-final' ||
            packet.debugMeta?.finalCoverageBuilderStatus === 'debug-raw') &&
          packet.debugMeta?.runtimeStatus === 'accepted'
      )
    ).toBe(true)
    expect(
      mockGraphic.__asyraConstrainedDashedRuntimeDiagnostics
    ).toMatchObject({
      acceptedCount: 12,
      blockedCount: 0
    })
  })

  it('should run: rebuild self-intersecting vector fill synchronously without deferred timers', () => {
    const renderStrategy = renderStrategyRegistry.get('vector')
    expect(renderStrategy).toBeDefined()

    if (!renderStrategy) return
    const mockGraphic = createMeshMockGraphic()
    const mockData = createSelfIntersectingStarsVectorData(1)

    runRenderStrategy(renderStrategy, mockGraphic, mockData)

    const cache = (
      mockGraphic as typeof mockGraphic & {
        __asyraVectorFillCache?: {
          faces: unknown[]
        }
      }
    ).__asyraVectorFillCache
    expect(cache?.faces.length).toBeGreaterThan(0)
  })

  it('should run: ignore malformed vector topology fields instead of throwing during render', () => {
    const renderStrategy = renderStrategyRegistry.get('vector')
    expect(renderStrategy).toBeDefined()

    if (!renderStrategy) return
    const mockGraphic = createMeshMockGraphic()
    const malformedData = {
      id: 'vector-malformed',
      x: Number.NaN,
      y: null,
      width: undefined,
      height: -20,
      points: {
        badPoint: {
          id: 'badPoint',
          kind: 'anchor',
          x: 'not-a-number',
          y: 0
        }
      },
      segments: null,
      networks: {
        badNetwork: {
          id: 'badNetwork',
          pointIds: null,
          segmentIds: undefined,
          closed: true
        }
      },
      closed: true,
      fills: null,
      strokes: [null]
    }

    expect(() =>
      runRenderStrategy(renderStrategy, mockGraphic, malformedData)
    ).not.toThrow()
    expect(getProjectionMeshes(mockGraphic)).toHaveLength(0)
    expect(mockGraphic.__asyraSolidCenterStrokeExportPackets).toHaveLength(0)
    expect(mockGraphic.x).toBe(0)
    expect(mockGraphic.y).toBe(0)
  })

  it('should run: drop dangling topology references during render normalization without repairing them', () => {
    const renderStrategy = renderStrategyRegistry.get('vector')
    expect(renderStrategy).toBeDefined()

    if (!renderStrategy) return
    const mockGraphic = createMeshMockGraphic()

    expect(() =>
      runRenderStrategy(renderStrategy, mockGraphic, {
        id: 'vector-dangling-topology',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        points: {
          p0: {
            id: 'p0',
            kind: 'anchor',
            x: 0,
            y: 0,
            anchorType: 'sharp'
          }
        },
        segments: {
          s0: {
            id: 's0',
            startId: 'p0',
            endId: 'missing-anchor',
            outControlId: null,
            inControlId: null
          }
        },
        networks: {
          n0: {
            id: 'n0',
            pointIds: ['p0', 'missing-anchor'],
            segmentIds: ['s0'],
            closed: false
          }
        },
        closed: false,
        fills: [],
        strokes: [createDefaultStroke({ color: '#000000', width: 2 })]
      })
    ).not.toThrow()
    expect(getProjectionMeshes(mockGraphic)).toHaveLength(0)
    expect(mockGraphic.__asyraSolidCenterStrokeExportPackets).toHaveLength(0)
  })

  it('should not run: convert removed anchorPoints into renderable topology during normalization', () => {
    const renderStrategy = renderStrategyRegistry.get('vector')
    expect(renderStrategy).toBeDefined()

    if (!renderStrategy) return
    const mockGraphic = createMeshMockGraphic()

    expect(() =>
      runRenderStrategy(renderStrategy, mockGraphic, {
        id: 'vector-removed-anchor-points',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        anchorPoints: [
          { id: 'a', x: 0, y: 0 },
          { id: 'b', x: 100, y: 0 }
        ],
        points: null,
        segments: null,
        networks: null,
        closed: false,
        fills: [],
        strokes: [createDefaultStroke({ color: '#000000', width: 2 })]
      })
    ).not.toThrow()
    expect(getProjectionMeshes(mockGraphic)).toHaveLength(0)
    expect(mockGraphic.__asyraSolidCenterStrokeExportPackets).toHaveLength(0)
  })

  it('should run: treat null vector render data as an empty vector instead of throwing', () => {
    const renderStrategy = renderStrategyRegistry.get('vector')
    expect(renderStrategy).toBeDefined()

    if (!renderStrategy) return
    const mockGraphic = createMeshMockGraphic()

    expect(() =>
      runRenderStrategy(renderStrategy, mockGraphic, null)
    ).not.toThrow()
    expect(getProjectionMeshes(mockGraphic)).toHaveLength(0)
    expect(mockGraphic.__asyraSolidCenterStrokeExportPackets).toHaveLength(0)
    expect(mockGraphic.x).toBe(0)
    expect(mockGraphic.y).toBe(0)
  })

  it('should run: render simple solid-center vectors through final-face projection when renderer path is not needed', () => {
    const renderStrategy = renderStrategyRegistry.get('vector')
    expect(renderStrategy).toBeDefined()

    if (!renderStrategy) return
    const mockGraphic = createMeshMockGraphic()

    const mockData = {
      id: 'vector-solid-center-1',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      ...toVectorData(
        [
          { id: '1', x: 0, y: 0 },
          { id: '2', x: 80, y: 0 },
          { id: '3', x: 80, y: 40 },
          { id: '4', x: 0, y: 40 }
        ],
        true
      ),
      closed: true,
      fills: [],
      strokes: [
        createDefaultStroke({
          style: 'solid',
          position: 'center',
          width: 6,
          color: '#3366ff',
          visible: true,
          joinType: 'miter',
          miterAngle: 28.96
        })
      ]
    }

    runRenderStrategy(renderStrategy, mockGraphic, mockData)

    expect(getProjectionMeshes(mockGraphic)).toHaveLength(1)
    expect(countInstructions(mockGraphic, 'stroke')).toHaveLength(0)
    expect(mockGraphic.__asyraCenterPathSolidStrokeRenderCount).toBe(0)
    expect(mockGraphic.__asyraSolidCenterStrokeExportPackets).toHaveLength(1)
  })

  it('should run: expose stroke hit from the same final geometry family for supported solid-center vectors', () => {
    const renderStrategy = renderStrategyRegistry.get('vector')
    expect(renderStrategy).toBeDefined()

    if (!renderStrategy) return
    const mockGraphic = createMeshMockGraphic()

    const mockData = {
      id: 'vector-solid-center-hit-1',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      ...toVectorData(
        [
          { id: '1', x: 0, y: 0 },
          { id: '2', x: 80, y: 0 },
          { id: '3', x: 80, y: 40 },
          { id: '4', x: 0, y: 40 }
        ],
        true
      ),
      closed: true,
      fills: [],
      strokes: [
        createDefaultStroke({
          style: 'solid',
          position: 'center',
          width: 6,
          color: '#3366ff',
          visible: true,
          joinType: 'miter',
          miterAngle: 28.96
        })
      ]
    }

    runRenderStrategy(renderStrategy, mockGraphic, mockData)

    expect(mockGraphic.hitArea?.contains(1, 1)).toBe(true)
    expect(mockGraphic.hitArea?.contains(40, 20)).toBe(false)
    expect(mockGraphic.hitArea?.contains(-10, -10)).toBe(false)
  })

  it('should run: render visible source-path product-final geometry for the reported self-intersecting inside dashed sample', async () => {
    await selectClipper2VectorComponentBackend()
    const renderStrategy = renderStrategyRegistry.get('vector')
    expect(renderStrategy).toBeDefined()

    if (!renderStrategy) return
    const mockGraphic = createMeshMockGraphic()
    const mockData = createReportedRoundInsideDashedStarVectorData()

    runRenderStrategy(renderStrategy, mockGraphic, mockData)
    expect(
      mockGraphic.__asyraSolidCenterStrokeExportPackets?.length
    ).toBeGreaterThan(0)
    expect(
      mockGraphic.__asyraSolidCenterStrokeExportPackets?.every(
        (packet) =>
          packet.debugMeta?.geometryFamily === 'constrained-dashed' &&
          packet.debugMeta?.resolutionStatus === 'exact-constrained' &&
          (packet.debugMeta?.finalCoverageBuilderStatus === 'product-final' ||
            packet.debugMeta?.finalCoverageBuilderStatus === 'debug-raw') &&
          packet.debugMeta?.runtimeStatus === 'accepted'
      )
    ).toBe(true)
    expect(
      mockGraphic.__asyraConstrainedDashedRuntimeDiagnostics
    ).toMatchObject({
      acceptedCount: 1,
      blockedCount: 0,
      entries: [
        {
          status: 'accepted',
          sourceTopology: 'self-intersecting'
        }
      ]
    })
    expect(countInstructions(mockGraphic, 'stroke')).toHaveLength(0)
  })

  it('should run: replace simple solid-center final-face mesh when rerendered with supported constrained round strokes', () => {
    const renderStrategy = renderStrategyRegistry.get('vector')
    expect(renderStrategy).toBeDefined()

    if (!renderStrategy) return
    const mockGraphic = createMeshMockGraphic()
    const supportedData = {
      id: 'vector-solid-center-2',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      ...toVectorData(
        [
          { id: '1', x: 0, y: 0 },
          { id: '2', x: 80, y: 0 },
          { id: '3', x: 80, y: 40 },
          { id: '4', x: 0, y: 40 }
        ],
        true
      ),
      closed: true,
      fills: [],
      strokes: [
        createDefaultStroke({
          style: 'solid',
          position: 'center',
          width: 6,
          color: '#3366ff',
          visible: true,
          joinType: 'miter',
          miterAngle: 28.96
        })
      ]
    }

    runRenderStrategy(renderStrategy, mockGraphic, supportedData)
    const initialProjectionMeshes = getProjectionMeshes(mockGraphic)
    expect(initialProjectionMeshes).toHaveLength(1)
    expect(countInstructions(mockGraphic, 'stroke')).toHaveLength(0)
    expect(mockGraphic.__asyraCenterPathSolidStrokeRenderCount).toBe(0)

    runRenderStrategy(renderStrategy, mockGraphic, {
      ...supportedData,
      strokes: [
        createDefaultStroke({
          style: 'solid',
          position: 'inside',
          width: 6,
          color: '#3366ff',
          visible: true,
          joinType: 'round',
          miterAngle: 28.96
        })
      ]
    })

    const nextProjectionMeshes = getProjectionMeshes(mockGraphic)
    const exportPackets =
      mockGraphic.__asyraSolidCenterStrokeExportPackets ?? []
    expect(nextProjectionMeshes.length).toBeGreaterThan(0)
    expect(exportPackets.length).toBe(nextProjectionMeshes.length)
    expect(mockGraphic.__asyraCenterPathSolidStrokeRenderCount).toBe(0)
    expect(
      exportPackets.every((packet) =>
        Boolean(
          packet.debugMeta?.geometryFamily === 'constrained-solid' &&
            packet.debugMeta?.resolutionStatus === 'exact-constrained' &&
            packet.debugMeta?.runtimeStatus === 'accepted'
        )
      )
    ).toBe(true)
  })

  it('should keep reported self-intersecting inside dashed FinalFace-derived split-range geometry visible when path editing is toggled', async () => {
    await selectClipper2VectorComponentBackend()
    const renderStrategy = renderStrategyRegistry.get('vector')
    expect(renderStrategy).toBeDefined()

    if (!renderStrategy) return
    const selectedGraphic = createMeshMockGraphic()
    const deselectedGraphic = createMeshMockGraphic()
    const mockData = createReportedRoundInsideDashedStarVectorData()

    setPathEditingState({
      vectorId: mockData.id,
      mode: true,
      dragging: false
    })
    runRenderStrategy(renderStrategy, selectedGraphic, mockData)

    setPathEditingState({
      vectorId: null,
      mode: false,
      dragging: false
    })
    runRenderStrategy(renderStrategy, deselectedGraphic, mockData)

    expect(
      selectedGraphic.__asyraSolidCenterStrokeExportPackets?.length
    ).toBeGreaterThan(0)
    expect(
      deselectedGraphic.__asyraSolidCenterStrokeExportPackets?.length
    ).toBeGreaterThan(0)
    expect(
      selectedGraphic.__asyraConstrainedDashedRuntimeDiagnostics
    ).toMatchObject({ acceptedCount: 1, blockedCount: 0 })
    expect(
      deselectedGraphic.__asyraConstrainedDashedRuntimeDiagnostics
    ).toMatchObject({ acceptedCount: 1, blockedCount: 0 })
  })

  it('should run: render visible source-path product-final geometry for the reported round-join self-intersecting inside dashed star', async () => {
    await selectClipper2VectorComponentBackend()
    const renderStrategy = renderStrategyRegistry.get('vector')
    expect(renderStrategy).toBeDefined()

    if (!renderStrategy) return
    const mockGraphic = createMeshMockGraphic()
    const mockData = createReportedRoundInsideDashedStarVectorData()

    runRenderStrategy(renderStrategy, mockGraphic, mockData)

    expect(
      mockGraphic.__asyraSolidCenterStrokeExportPackets?.length
    ).toBeGreaterThan(0)
    expect(
      mockGraphic.__asyraSolidCenterStrokeExportPackets?.every(
        (packet) =>
          packet.debugMeta?.geometryFamily === 'constrained-dashed' &&
          packet.debugMeta?.resolutionStatus === 'exact-constrained' &&
          (packet.debugMeta?.finalCoverageBuilderStatus === 'product-final' ||
            packet.debugMeta?.finalCoverageBuilderStatus === 'debug-raw') &&
          packet.debugMeta?.runtimeStatus === 'accepted'
      )
    ).toBe(true)
    expect(
      mockGraphic.__asyraSolidCenterStrokeExportPackets?.every(
        (packet) =>
          packet.polygons.length > 0 &&
          packet.intervalIds.every((intervalId) =>
            intervalId.startsWith('interval:')
          ) &&
          typeof packet.debugMeta?.intervalId === 'string' &&
          packet.debugMeta.intervalId.startsWith('interval:')
      )
    ).toBe(true)
    expect(
      mockGraphic.__asyraConstrainedDashedRuntimeDiagnostics
    ).toMatchObject({ acceptedCount: 1, blockedCount: 0 })
    expect(countInstructions(mockGraphic, 'stroke')).toHaveLength(0)
  })

  it('should keep the reported round-join self-intersecting inside dashed source-path product-final geometry visible when path editing is cleared', async () => {
    await selectClipper2VectorComponentBackend()
    const renderStrategy = renderStrategyRegistry.get('vector')
    expect(renderStrategy).toBeDefined()

    if (!renderStrategy) return
    const selectedGraphic = createMeshMockGraphic()
    const deselectedGraphic = createMeshMockGraphic()
    const mockData = createReportedRoundInsideDashedStarVectorData()

    setPathEditingState({
      vectorId: mockData.id,
      mode: true,
      dragging: false
    })
    runRenderStrategy(renderStrategy, selectedGraphic, mockData)

    setPathEditingState({
      vectorId: null,
      mode: false,
      dragging: false
    })
    runRenderStrategy(renderStrategy, deselectedGraphic, mockData)

    expect(
      selectedGraphic.__asyraSolidCenterStrokeExportPackets?.length
    ).toBeGreaterThan(0)
    expect(
      deselectedGraphic.__asyraSolidCenterStrokeExportPackets?.length
    ).toBeGreaterThan(0)
    expect(
      selectedGraphic.__asyraConstrainedDashedRuntimeDiagnostics
    ).toMatchObject({ acceptedCount: 1, blockedCount: 0 })
    expect(
      deselectedGraphic.__asyraConstrainedDashedRuntimeDiagnostics
    ).toMatchObject({ acceptedCount: 1, blockedCount: 0 })
  })
})
