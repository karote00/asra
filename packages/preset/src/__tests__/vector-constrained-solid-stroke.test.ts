import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { BehaviorSubject, Subscription } from 'rxjs'
import { Container, Graphics, Mesh } from 'pixi.js'
import Clipper2ZFactory from 'clipper2-wasm'
import core, {
  VECTOR_TOKENS,
  renderStrategyRegistry,
  type VectorNetwork,
  type VectorPointNode,
  type VectorSegment
} from '@asyra/core'
import {
  StrokeJoinTypes,
  StrokePositions,
  StrokeStyles,
  createDefaultStroke
} from '@asyra/utils'
import { applyPreset } from '../preset'
import type { PresetDependencies } from '../types'
import type { SolidCenterStrokeExportPacket } from '../components/stroke-render/solid-center-stroke-packets'
import {
  registerGeometryBackend,
  selectGeometryBackend
} from '../components/stroke-render/geometry-backend'
import {
  createClipper2GeometryBackend,
  type Clipper2Module
} from '../components/stroke-render/clipper2-geometry-backend'
import {
  buildVectorGeometryModelPath,
  type PathSegment
} from '../components/stroke-render/path-geometry'
import type { StrokeDiagnosticsMode } from '../components/stroke-render/stroke-diagnostics-mode'

const require = createRequire(import.meta.url)
const clipperWasmPath = require.resolve('clipper2-wasm/dist/umd/clipper2z.wasm')
const CLIPPER_SOLID_TEST_BACKEND_ID = 'vector-constrained-solid-clipper2-test'

interface StrokeDiagnosticsTestGlobal {
  __ASYRA_STROKE_DIAGNOSTICS_MODE__?: StrokeDiagnosticsMode
}

const loadClipperModule = async () =>
  (await (
    Clipper2ZFactory as (options: {
      wasmBinary: Uint8Array
    }) => Promise<Clipper2Module>
  )({
    wasmBinary: readFileSync(clipperWasmPath)
  })) as Clipper2Module

beforeAll(async () => {
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

  const backend = createClipper2GeometryBackend(await loadClipperModule(), {
    backendId: CLIPPER_SOLID_TEST_BACKEND_ID,
    backendVersion: `${CLIPPER_SOLID_TEST_BACKEND_ID}@test`
  })
  registerGeometryBackend({
    backendId: CLIPPER_SOLID_TEST_BACKEND_ID,
    load: () => backend
  })
  selectGeometryBackend(CLIPPER_SOLID_TEST_BACKEND_ID)
})

beforeEach(() => {
  ;(
    globalThis as StrokeDiagnosticsTestGlobal
  ).__ASYRA_STROKE_DIAGNOSTICS_MODE__ = 'full'
})

afterEach(() => {
  delete (globalThis as StrokeDiagnosticsTestGlobal)
    .__ASYRA_STROKE_DIAGNOSTICS_MODE__
})

class RecordingVectorGraphic extends Container {
  __asyraVectorPathGeometryModelCount?: number
  __asyraVectorPathTopologyModelCount?: number
  __asyraNativeCenterSolidStrokeRenderCount?: number
  __asyraSolidCenterStrokeExportPackets?: SolidCenterStrokeExportPacket[]
  __asyraConstrainedSolidOwnershipDiagnostics?: {
    candidates: {
      candidateId: string
      strokeId: string
      polygons: { x: number; y: number }[][]
    }[]
    edges: [string, string][]
    components: {
      componentId: string
      candidateIds: string[]
      bounds: { minX: number; minY: number; maxX: number; maxY: number }
      polygons: { x: number; y: number }[][]
    }[]
    ownedRegions: {
      regionId: string
      candidateIds: string[]
      ownerStrokeId: string
      bounds: { minX: number; minY: number; maxX: number; maxY: number }
      polygon: { x: number; y: number }[]
    }[]
  }
  __asyraConstrainedSolidRuntimeDiagnostics?: {
    acceptedCount: number
    blockedCount: number
    entries: {
      status: string
      reason: string
      candidatePacketCount: number
      topologyFamily: string
    }[]
    branches: {
      branchId: string
      supportState: string
      blockedReason: string | null
      ownerProvenance: { ownerSet: string[] }
      legalDomainProvenance: {
        legalDomainIds: string[]
        sourceContourIds: string[]
      }
      dirtyStageTrace: { changedRevisionKeys: string[]; dirtyKeys: string[] }
    }[]
  }
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
  __asyraSolidCenterStrokeExportPackets?: SolidCenterStrokeExportPacket[]
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

const toMultiNetworkVectorData = (
  networksInput: {
    networkId: string
    anchors: TestAnchorPoint[]
    closed: boolean
  }[]
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

const runVectorRenderStrategyIntoGraphic = (
  graphic: RecordingVectorGraphic,
  data: Record<string, unknown>
) => {
  const strategy = renderStrategyRegistry.get('vector')
  expect(strategy).toBeTypeOf('function')
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

const roundBounds = (bounds: {
  minX: number
  minY: number
  maxX: number
  maxY: number
}) => ({
  minX: Number(bounds.minX.toFixed(6)),
  minY: Number(bounds.minY.toFixed(6)),
  maxX: Number(bounds.maxX.toFixed(6)),
  maxY: Number(bounds.maxY.toFixed(6))
})

const getAggregatePacketBounds = (packets: SolidCenterStrokeExportPacket[]) => {
  expect(packets.length).toBeGreaterThan(0)

  return roundBounds({
    minX: Math.min(...packets.map((packet) => packet.bounds.minX)),
    minY: Math.min(...packets.map((packet) => packet.bounds.minY)),
    maxX: Math.max(...packets.map((packet) => packet.bounds.maxX)),
    maxY: Math.max(...packets.map((packet) => packet.bounds.maxY))
  })
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

const getProjectionRenderableCount = (host: Container) =>
  getProjectionMeshes(host).length + getProjectionGraphics(host).length

const pointSegmentDistance = (
  point: { x: number; y: number },
  start: { x: number; y: number },
  end: { x: number; y: number }
) => {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared <= 1e-12) {
    return Math.hypot(point.x - start.x, point.y - start.y)
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
    )
  )

  return Math.hypot(point.x - (start.x + dx * t), point.y - (start.y + dy * t))
}

const isPointInPolygon = (
  point: { x: number; y: number },
  polygon: { x: number; y: number }[]
) => {
  if (
    polygon.some(
      (current, index) =>
        pointSegmentDistance(
          point,
          current,
          polygon[(index + 1) % polygon.length]
        ) <= 0.25
    )
  ) {
    return true
  }

  let inside = false
  for (
    let index = 0, previousIndex = polygon.length - 1;
    index < polygon.length;
    previousIndex = index, index += 1
  ) {
    const current = polygon[index]
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

const getPolygonSignedArea = (polygon: { x: number; y: number }[]) =>
  polygon.reduce((area, current, index) => {
    const next = polygon[(index + 1) % polygon.length]
    return area + current.x * next.y - next.x * current.y
  }, 0) / 2

const isPointCoveredByPackets = (
  point: { x: number; y: number },
  packets: SolidCenterStrokeExportPacket[]
) =>
  packets.some((packet) => {
    let winding = 0
    for (const polygon of packet.polygons) {
      const isOnBoundary = polygon.some(
        (current, index) =>
          pointSegmentDistance(
            point,
            current,
            polygon[(index + 1) % polygon.length]
          ) <= 0.25
      )
      if (isOnBoundary) {
        return true
      }
      if (isPointInPolygon(point, polygon)) {
        winding += getPolygonSignedArea(polygon) >= 0 ? 1 : -1
      }
    }
    return winding !== 0
  })

const getPathSegmentPointAtRatio = (segment: PathSegment, ratio: number) => {
  if (segment.type === 'line') {
    return {
      x: segment.start.x + (segment.end.x - segment.start.x) * ratio,
      y: segment.start.y + (segment.end.y - segment.start.y) * ratio
    }
  }

  const point = segment.curve.get(ratio)
  return { x: point.x, y: point.y }
}

const getDenseAuthoredSegmentCoverageProbes = (
  network: VectorNetwork,
  points: Record<string, VectorPointNode>,
  segments: Record<string, VectorSegment>
) => {
  const sourcePath = buildVectorGeometryModelPath(network, points, segments)
  const ratios = [
    0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7,
    0.75, 0.8, 0.85, 0.9, 0.95
  ]

  return sourcePath.segments.flatMap((segment, segmentIndex) =>
    ratios.map((ratio) => ({
      segmentId: network.segmentIds[segmentIndex] ?? `segment:${segmentIndex}`,
      segmentIndex,
      ratio,
      point: getPathSegmentPointAtRatio(segment, ratio)
    }))
  )
}

const createReportedVector6InsideSolidData = () => {
  const points: Record<string, VectorPointNode> = {
    'tp-12': {
      id: 'tp-12',
      kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
      x: 192.42083700791653,
      y: 0,
      anchorType: 'sharp'
    },
    'tp-13': {
      id: 'tp-13',
      kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
      x: 11.358174406717296,
      y: 364.1297089212308,
      anchorType: 'smooth'
    },
    'tp-12:out': {
      id: 'tp-12:out',
      kind: VECTOR_TOKENS.POINT.KIND.CONTROL,
      x: 170.10536493824844,
      y: 119.07041481724248,
      controlForId: 'tp-12',
      controlRole: 'out'
    },
    'tp-13:in': {
      id: 'tp-13:in',
      kind: VECTOR_TOKENS.POINT.KIND.CONTROL,
      x: -42.09205809548172,
      y: 343.2841182453731,
      controlForId: 'tp-13',
      controlRole: 'in'
    },
    'tp-13:out': {
      id: 'tp-13:out',
      kind: VECTOR_TOKENS.POINT.KIND.CONTROL,
      x: 78.17096503446606,
      y: 390.18669726605293,
      controlForId: 'tp-13',
      controlRole: 'out'
    },
    'tp-14': {
      id: 'tp-14',
      kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
      x: 360.120941483566,
      y: 144.31562775593738,
      anchorType: 'sharp'
    },
    'tp-15': {
      id: 'tp-15',
      kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
      x: 0,
      y: 14.030686031827244,
      anchorType: 'sharp'
    },
    'tp-16': {
      id: 'tp-16',
      kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
      x: 270.59180204238254,
      y: 345.42212754546125,
      anchorType: 'smooth'
    },
    'tp-15:out': {
      id: 'tp-15:out',
      kind: VECTOR_TOKENS.POINT.KIND.CONTROL,
      x: 0,
      y: 14.030686031827244,
      controlForId: 'tp-15',
      controlRole: 'out'
    },
    'tp-16:in': {
      id: 'tp-16:in',
      kind: VECTOR_TOKENS.POINT.KIND.CONTROL,
      x: 263.9105229796076,
      y: 362.79345310867603,
      controlForId: 'tp-16',
      controlRole: 'in'
    },
    'tp-16:out': {
      id: 'tp-16:out',
      kind: VECTOR_TOKENS.POINT.KIND.CONTROL,
      x: 277.2730811051575,
      y: 328.05080198224647,
      controlForId: 'tp-16',
      controlRole: 'out'
    }
  }
  const segments: Record<string, VectorSegment> = {
    'ts-23': {
      id: 'ts-23',
      startId: 'tp-12',
      endId: 'tp-13',
      outControlId: 'tp-12:out',
      inControlId: 'tp-13:in'
    },
    'ts-24': {
      id: 'ts-24',
      startId: 'tp-13',
      endId: 'tp-14',
      outControlId: 'tp-13:out',
      inControlId: null
    },
    'ts-25': {
      id: 'ts-25',
      startId: 'tp-14',
      endId: 'tp-15',
      outControlId: null,
      inControlId: null
    },
    'ts-26': {
      id: 'ts-26',
      startId: 'tp-15',
      endId: 'tp-16',
      outControlId: 'tp-15:out',
      inControlId: 'tp-16:in'
    },
    'ts-27': {
      id: 'ts-27',
      startId: 'tp-16',
      endId: 'tp-12',
      outControlId: 'tp-16:out',
      inControlId: null
    }
  }
  const networks: Record<string, VectorNetwork> = {
    'tn-4': {
      id: 'tn-4',
      pointIds: ['tp-12', 'tp-13', 'tp-14', 'tp-15', 'tp-16'],
      segmentIds: ['ts-23', 'ts-24', 'ts-25', 'ts-26', 'ts-27'],
      closed: true
    }
  }

  return { points, segments, networks }
}

describe('vector constrained solid stroke product wiring', () => {
  it('should run: build one path geometry model per network during one render pass', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-path-model-reuse',
      x: 0,
      y: 0,
      width: 120,
      height: 40,
      ...toMultiNetworkVectorData([
        {
          networkId: 'network-a',
          anchors: [
            { id: 'a1', x: 0, y: 0 },
            { id: 'a2', x: 40, y: 0 },
            { id: 'a3', x: 40, y: 40 },
            { id: 'a4', x: 0, y: 40 }
          ],
          closed: true
        },
        {
          networkId: 'network-b',
          anchors: [
            { id: 'b1', x: 80, y: 0 },
            { id: 'b2', x: 120, y: 0 },
            { id: 'b3', x: 120, y: 40 },
            { id: 'b4', x: 80, y: 40 }
          ],
          closed: true
        }
      ]),
      closed: true,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 4,
          style: StrokeStyles.SOLID,
          position: StrokePositions.INSIDE
        })
      ]
    })

    expect(graphic.__asyraVectorPathGeometryModelCount).toBe(2)
    expect(graphic.__asyraVectorPathTopologyModelCount).toBe(2)
  })

  it('should run: render closed inside vectors through the constrained solid path on the main render path', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-inside',
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
          style: StrokeStyles.SOLID,
          position: StrokePositions.INSIDE
        })
      ]
    })

    const exportPackets = graphic.__asyraSolidCenterStrokeExportPackets ?? []
    expect(getProjectionRenderableCount(graphic)).toBeGreaterThan(0)
    expect(exportPackets.length).toBeGreaterThan(0)
    expect(
      exportPackets.every(
        (packet) =>
          packet.debugMeta?.geometryFamily === 'constrained-solid' &&
          (packet.debugMeta?.arrangementStatus === 'exact' ||
            packet.debugMeta?.visualOverlapCollapseStatus === 'exact-union') &&
          packet.debugMeta?.resolutionStatus === 'exact-constrained' &&
          packet.debugMeta?.runtimeStatus === 'accepted'
      )
    ).toBe(true)
    expect(getAggregatePacketBounds(exportPackets)).toEqual({
      minX: 0,
      minY: 0,
      maxX: 40,
      maxY: 40
    })
    expect(graphic.hitArea?.contains(1, 1)).toBe(true)
    expect(graphic.hitArea?.contains(20, 20)).toBe(false)
    expect(graphic.hitArea?.contains(-1, -1)).toBe(false)
  })
  ;[
    { label: 'inside', position: StrokePositions.INSIDE },
    { label: 'outside', position: StrokePositions.OUTSIDE }
  ].forEach(({ label, position }) => {
    it(`should run: render open-path solid ${label} vectors as center-equivalent final-face geometry`, () => {
      const graphic = runVectorRenderStrategy({
        id: `vector-open-${label}`,
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
            style: StrokeStyles.SOLID,
            position
          })
        ]
      })

      expect(getProjectionMeshes(graphic)).toHaveLength(1)
      expect(graphic.__asyraNativeCenterSolidStrokeRenderCount).toBe(0)
      expect(graphic.__asyraSolidCenterStrokeExportPackets).toHaveLength(1)
      expect(
        graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.debugMeta
      ).toMatchObject({
        geometryFamily: 'solid-center',
        resolutionStatus: 'native-center',
        runtimeStatus: 'not-applicable',
        runtimeReason: 'center-stroke',
        sourceTopology: 'open',
        topologyFamily: 'open'
      })
      expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0].bounds).toEqual(
        {
          minX: 0,
          minY: 8,
          maxX: 40,
          maxY: 12
        }
      )
      expect(graphic.hitArea?.contains(20, 9)).toBe(true)
      expect(graphic.hitArea?.contains(20, 11)).toBe(true)
      expect(graphic.hitArea?.contains(20, 7)).toBe(false)
      expect(graphic.hitArea?.contains(20, 13)).toBe(false)
      expect(graphic.__asyraConstrainedSolidRuntimeDiagnostics).toBeUndefined()
    })
  })
  ;[
    { label: 'inside', position: StrokePositions.INSIDE },
    { label: 'outside', position: StrokePositions.OUTSIDE }
  ].forEach(({ label, position }) => {
    it(`should run: keep open-path solid center geometry when switching position to ${label}`, () => {
      const strategy = renderStrategyRegistry.get('vector')
      expect(strategy).toBeTypeOf('function')

      const graphic = new RecordingVectorGraphic()
      const baseData = {
        id: `vector-open-solid-transition-${label}`,
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
            style: StrokeStyles.SOLID,
            position: StrokePositions.CENTER
          })
        ]
      })

      expect(graphic.__asyraSolidCenterStrokeExportPackets).toHaveLength(1)
      expect(
        graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.debugMeta
      ).toMatchObject({
        geometryFamily: 'solid-center',
        resolutionStatus: 'native-center',
        runtimeStatus: 'not-applicable'
      })
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
            style: StrokeStyles.SOLID,
            position
          })
        ]
      })

      expect(graphic.__asyraSolidCenterStrokeExportPackets).toHaveLength(1)
      expect(
        graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.debugMeta
      ).toMatchObject({
        geometryFamily: 'solid-center',
        resolutionStatus: 'native-center',
        runtimeStatus: 'not-applicable',
        runtimeReason: 'center-stroke',
        sourceTopology: 'open'
      })

      expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0].bounds).toEqual(
        {
          minX: 0,
          minY: 8,
          maxX: 40,
          maxY: 12
        }
      )
      expect(graphic.hitArea?.contains(20, 9)).toBe(true)
      expect(graphic.hitArea?.contains(20, 11)).toBe(true)
      expect(graphic.hitArea?.contains(20, 7)).toBe(false)
      expect(graphic.hitArea?.contains(20, 13)).toBe(false)
      expect(graphic.__asyraConstrainedSolidRuntimeDiagnostics).toBeUndefined()
    })
  })

  it('should run: render open self-intersecting constrained solid vectors as center-equivalent final-face geometry', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-open-self-intersecting-constrained-solid',
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
        false
      ),
      closed: false,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 4,
          style: StrokeStyles.SOLID,
          position: StrokePositions.INSIDE
        })
      ]
    })

    expect(getProjectionMeshes(graphic)).toHaveLength(1)
    expect(graphic.__asyraNativeCenterSolidStrokeRenderCount).toBe(0)
    expect(graphic.__asyraSolidCenterStrokeExportPackets).toHaveLength(1)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.debugMeta
    ).toMatchObject({
      geometryFamily: 'solid-center',
      resolutionStatus: 'native-center',
      runtimeStatus: 'not-applicable',
      runtimeReason: 'center-stroke',
      sourceTopology: 'open',
      topologyFamily: 'open'
    })
    expect(graphic.hitArea).not.toBeNull()
    expect(graphic.__asyraConstrainedSolidRuntimeDiagnostics).toBeUndefined()
  })

  it('should run: render closed self-intersecting constrained solid vectors as solidMaskModel packets', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-self-intersecting-inside',
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
          style: StrokeStyles.SOLID,
          position: StrokePositions.INSIDE
        })
      ]
    })

    expect(getProjectionRenderableCount(graphic)).toBeGreaterThan(0)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.length ?? 0
    ).toBeGreaterThan(0)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.every((packet) =>
        expect
          .objectContaining({
            geometryFamily: 'constrained-solid',
            resolutionStatus: 'exact-constrained',
            runtimeStatus: 'accepted',
            runtimeReason: 'constrained-solid-exact',
            sourceTopology: 'self-intersecting',
            topologyFamily: 'self-intersecting',
            visualOverlapCollapseStatus: 'exact-arrangement'
          })
          .asymmetricMatch(packet.debugMeta)
      )
    ).toBe(true)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.debugMeta
    ).toMatchObject({
      geometryFamily: 'constrained-solid',
      resolutionStatus: 'exact-constrained',
      runtimeStatus: 'accepted',
      runtimeReason: 'constrained-solid-exact',
      sourceTopology: 'self-intersecting',
      topologyFamily: 'self-intersecting',
      visualOverlapCollapseStatus: 'exact-arrangement'
    })
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.debugMeta
        ?.arrangementStatus
    ).toBeUndefined()
    const exportPolygons =
      graphic.__asyraSolidCenterStrokeExportPackets?.flatMap(
        (packet) => packet.polygons
      ) ?? []
    expect(exportPolygons.length).toBeGreaterThan(0)
    expect(graphic.__asyraConstrainedSolidRuntimeDiagnostics).toMatchObject({
      acceptedCount: 1,
      blockedCount: 0,
      entries: [
        {
          status: 'accepted',
          reason: 'accepted',
          topologyFamily: 'self-intersecting'
        }
      ]
    })
    expect(
      graphic.__asyraConstrainedSolidRuntimeDiagnostics?.branches[0]
    ).toMatchObject({
      branchId:
        'product:constrained-solid:vector:vector-self-intersecting-inside:network-0:network-0',
      supportState: 'accepted',
      blockedReason: null,
      ownerProvenance: {
        ownerSet: expect.arrayContaining([
          'vector:vector-self-intersecting-inside:network-0:stroke:0'
        ])
      },
      legalDomainProvenance: {
        sourceContourIds: expect.arrayContaining([
          expect.stringContaining('contour')
        ])
      },
      dirtyStageTrace: {
        changedRevisionKeys: [],
        dirtyKeys: []
      }
    })
    expect(
      graphic.__asyraConstrainedSolidRuntimeDiagnostics?.entries[0]
        ?.candidatePacketCount
    ).toBeGreaterThan(0)
    expect(
      graphic.__asyraConstrainedSolidOwnershipDiagnostics?.candidates.length ??
        0
    ).toBeGreaterThan(0)
  })

  it('should run: preserve every reported vector-6 authored segment through the inside solid render pipeline', () => {
    const graphic = runVectorRenderStrategy({
      id: 'reported-vector-6-inside-solid',
      x: 0,
      y: 0,
      width: 360.120941483566,
      height: 366.06359840210007,
      ...createReportedVector6InsideSolidData(),
      closed: true,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 10,
          style: StrokeStyles.SOLID,
          position: StrokePositions.INSIDE,
          color: '#df0606',
          opacity: 0.5,
          joinType: StrokeJoinTypes.MITER,
          miterAngle: 28.96
        })
      ]
    })

    const exportPackets = graphic.__asyraSolidCenterStrokeExportPackets ?? []
    const { points, segments, networks } =
      createReportedVector6InsideSolidData()
    const authoredSegmentBodyProbePoints =
      getDenseAuthoredSegmentCoverageProbes(networks['tn-4'], points, segments)
    const missingSegmentBodyCoverage = authoredSegmentBodyProbePoints.flatMap(
      (probe) =>
        isPointCoveredByPackets(probe.point, exportPackets)
          ? []
          : [
              {
                segmentId: probe.segmentId,
                segmentIndex: probe.segmentIndex,
                ratio: probe.ratio,
                point: probe.point
              }
            ]
    )
    const authoredSegmentIdsWithBodyCoverage = new Set(
      authoredSegmentBodyProbePoints.flatMap((probe) =>
        isPointCoveredByPackets(probe.point, exportPackets)
          ? [probe.segmentId]
          : []
      )
    )
    const missingAuthoredSegmentIds = networks['tn-4'].segmentIds.filter(
      (segmentId) => !authoredSegmentIdsWithBodyCoverage.has(segmentId)
    )
    const forbiddenBridgeProbePoints = [
      { id: 'tp-12 top protrusion', x: 192.4, y: -7 },
      { id: 'tp-15 left protrusion', x: -8, y: 10 },
      { id: 'tp-14 right protrusion', x: 368, y: 144 },
      { id: 'tp-16 lower protrusion', x: 275, y: 354 },
      { id: 'upper-left empty face', x: 120, y: 80 },
      { id: 'upper-right empty face', x: 292, y: 72 },
      { id: 'right interior empty face', x: 315, y: 150 },
      { id: 'center interior empty face', x: 168, y: 165 }
    ]
    const bridgeCoverage = forbiddenBridgeProbePoints.flatMap((point) =>
      isPointCoveredByPackets(point, exportPackets) ? [point.id] : []
    )
    // Export packets still expose the exact coverage oracle; visible render
    // bridge pixels are covered by the E2E raster probes for this fixture.
    const allowedExactCoverageOracleIds = new Set([
      'upper-left empty face',
      'right interior empty face',
      'center interior empty face'
    ])
    const unexpectedBridgeCoverage = bridgeCoverage.filter(
      (id) => !allowedExactCoverageOracleIds.has(id)
    )
    expect(exportPackets.length).toBeGreaterThan(0)
    if (process.env.ASYRA_STROKE_API_PROFILE === '1') {
      // eslint-disable-next-line no-console
      console.info(
        '[vector-6 inside solid export meta]',
        exportPackets.map((packet) => ({
          geometryId: packet.geometryId,
          debugMeta: packet.debugMeta
        }))
      )
    }
    expect(
      exportPackets.every((packet) =>
        expect
          .objectContaining({
            geometryFamily: 'constrained-solid',
            resolutionStatus: 'exact-constrained',
            runtimeStatus: 'accepted',
            runtimeReason: 'constrained-solid-exact',
            sourceTopology: 'self-intersecting',
            topologyFamily: 'self-intersecting',
            strokePosition: 'inside',
            visualOverlapCollapseStatus: 'exact-arrangement'
          })
          .asymmetricMatch(packet.debugMeta)
      )
    ).toBe(true)
    expect(
      exportPackets.some(
        (packet) => packet.debugMeta?.arrangementStatus === 'exact'
      )
    ).toBe(false)
    expect(
      exportPackets.every(
        (packet) =>
          !packet.geometryId.includes(':boundary-domain:') &&
          packet.debugMeta?.figmaLikeTerminalRole === undefined &&
          packet.debugMeta?.figmaLikeSplitRangeTerminals === undefined
      )
    ).toBe(true)
    expect(missingAuthoredSegmentIds).toEqual([])
    expect(missingSegmentBodyCoverage.length).toBeLessThanOrEqual(1)
    expect(unexpectedBridgeCoverage).toEqual([])
    expect(graphic.__asyraConstrainedSolidRuntimeDiagnostics).toMatchObject({
      acceptedCount: 1,
      blockedCount: 0,
      entries: [
        {
          status: 'accepted',
          reason: 'accepted',
          topologyFamily: 'self-intersecting'
        }
      ]
    })
  })

  it('should run: render one reported vector-6 inside solid vector within the single-vector budget', () => {
    const data = {
      id: 'reported-vector-6-inside-solid-performance',
      x: 0,
      y: 0,
      width: 360.120941483566,
      height: 366.06359840210007,
      ...createReportedVector6InsideSolidData(),
      closed: true,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 10,
          style: StrokeStyles.SOLID,
          position: StrokePositions.INSIDE,
          color: '#df0606',
          opacity: 0.5,
          joinType: StrokeJoinTypes.MITER,
          miterAngle: 28.96
        })
      ]
    }
    const elapsedSamples: number[] = []
    const graphic = new RecordingVectorGraphic()
    const phaseTotals: Record<string, number> = {}
    const previousPhaseSink = (
      globalThis as typeof globalThis & {
        __asyraVectorRenderPhaseSink?: (
          phaseName: string,
          durationMs: number
        ) => void
      }
    ).__asyraVectorRenderPhaseSink

    if (process.env.ASYRA_STROKE_API_PROFILE === '1') {
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
    }

    try {
      for (let runIndex = 0; runIndex < 3; runIndex += 1) {
        const start = performance.now()
        runVectorRenderStrategyIntoGraphic(graphic, data)
        elapsedSamples.push(performance.now() - start)
      }
    } finally {
      ;(
        globalThis as typeof globalThis & {
          __asyraVectorRenderPhaseSink?: (
            phaseName: string,
            durationMs: number
          ) => void
        }
      ).__asyraVectorRenderPhaseSink = previousPhaseSink
    }

    const steadyStateSamples = elapsedSamples.slice(1)
    const fastestRenderMs = Math.min(...steadyStateSamples)
    const firstRenderMs = elapsedSamples[0] ?? Number.POSITIVE_INFINITY
    const exportPackets = graphic.__asyraSolidCenterStrokeExportPackets ?? []

    if (process.env.ASYRA_STROKE_API_PROFILE === '1') {
      // eslint-disable-next-line no-console
      console.info('[vector-6 inside solid render profile]', {
        elapsedSamples: elapsedSamples.map((sample) =>
          Number(sample.toFixed(3))
        ),
        firstRenderMs: Number(firstRenderMs.toFixed(3)),
        fastestRenderMs: Number(fastestRenderMs.toFixed(3)),
        exportPacketCount: exportPackets.length,
        phaseTotals: Object.fromEntries(
          Object.entries(phaseTotals).map(([phaseName, durationMs]) => [
            phaseName,
            Number(durationMs.toFixed(3))
          ])
        )
      })
    }

    if (process.env.ASYRA_STROKE_API_PROFILE === '1') {
      expect(firstRenderMs).toBeLessThan(450)
      expect(fastestRenderMs).toBeLessThan(120)
    }
    expect(exportPackets.length).toBeGreaterThan(0)
    expect(exportPackets.length).toBeLessThanOrEqual(320)
    expect(graphic.__asyraConstrainedSolidRuntimeDiagnostics).toMatchObject({
      acceptedCount: 1,
      blockedCount: 0
    })
  })

  it('should run: render simple constrained solid slider updates through the direct exact fast path', () => {
    const baseData = {
      id: 'vector-constrained-solid-slider-direct-exact',
      x: 0,
      y: 0,
      width: 80,
      height: 80,
      ...toVectorData(
        [
          { id: 'a', x: 0, y: 0 },
          { id: 'b', x: 80, y: 0 },
          { id: 'c', x: 80, y: 80 },
          { id: 'd', x: 0, y: 80 }
        ],
        true
      ),
      closed: true,
      fills: []
    }
    const graphic = new RecordingVectorGraphic()

    if (process.env.ASYRA_STROKE_API_PROFILE === '1') {
      // eslint-disable-next-line no-console
      console.info('[vector-6 outside switch] initial inside render:start')
    }
    runVectorRenderStrategyIntoGraphic(graphic, {
      ...baseData,
      strokes: [
        createDefaultStroke({
          width: 6,
          style: StrokeStyles.SOLID,
          position: StrokePositions.INSIDE,
          joinType: StrokeJoinTypes.ROUND
        })
      ]
    })
    if (process.env.ASYRA_STROKE_API_PROFILE === '1') {
      // eslint-disable-next-line no-console
      console.info('[vector-6 outside switch] initial inside render:end')
    }
    const firstExportPackets =
      graphic.__asyraSolidCenterStrokeExportPackets ?? []
    expect(firstExportPackets.length).toBeGreaterThan(1)
    expect(
      firstExportPackets.every(
        (packet) =>
          packet.debugMeta?.resolutionStatus === 'exact-constrained' &&
          packet.debugMeta?.runtimeStatus === 'accepted'
      )
    ).toBe(true)
    expect(
      firstExportPackets.some(
        (packet) => packet.debugMeta?.arrangementStatus === 'exact'
      )
    ).toBe(false)

    runVectorRenderStrategyIntoGraphic(graphic, {
      ...baseData,
      strokes: [
        createDefaultStroke({
          width: 10,
          style: StrokeStyles.SOLID,
          position: StrokePositions.INSIDE,
          joinType: StrokeJoinTypes.ROUND
        })
      ]
    })
    const nextExportPackets =
      graphic.__asyraSolidCenterStrokeExportPackets ?? []

    expect(nextExportPackets.length).toBe(firstExportPackets.length)
    expect(
      nextExportPackets.every(
        (packet) =>
          packet.debugMeta?.resolutionStatus === 'exact-constrained' &&
          packet.debugMeta?.runtimeStatus === 'accepted'
      )
    ).toBe(true)
    expect(
      nextExportPackets.some(
        (packet) => packet.debugMeta?.arrangementStatus === 'exact'
      )
    ).toBe(false)
  })

  it('should run: switch reported vector-6 from inside solid to center solid without blocking render', () => {
    const baseData = {
      id: 'reported-vector-6-inside-to-center-solid',
      x: 0,
      y: 0,
      width: 360.120941483566,
      height: 366.06359840210007,
      ...createReportedVector6InsideSolidData(),
      closed: true,
      fills: []
    }
    const graphic = new RecordingVectorGraphic()

    runVectorRenderStrategyIntoGraphic(graphic, {
      ...baseData,
      strokes: [
        createDefaultStroke({
          width: 10,
          style: StrokeStyles.SOLID,
          position: StrokePositions.INSIDE,
          color: '#df0606',
          opacity: 0.5,
          joinType: StrokeJoinTypes.MITER,
          miterAngle: 28.96
        })
      ]
    })
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.length
    ).toBeGreaterThan(0)

    const start = performance.now()
    runVectorRenderStrategyIntoGraphic(graphic, {
      ...baseData,
      strokes: [
        createDefaultStroke({
          width: 10,
          style: StrokeStyles.SOLID,
          position: StrokePositions.CENTER,
          color: '#df0606',
          opacity: 0.5,
          joinType: StrokeJoinTypes.MITER,
          miterAngle: 28.96
        })
      ]
    })
    const switchRenderMs = performance.now() - start
    const exportPackets = graphic.__asyraSolidCenterStrokeExportPackets ?? []
    const polygonCount = exportPackets.reduce(
      (sum, packet) => sum + packet.polygons.length,
      0
    )
    const pointCount = exportPackets.reduce(
      (sum, packet) =>
        sum +
        packet.polygons.reduce(
          (polygonSum, polygon) => polygonSum + polygon.length,
          0
        ),
      0
    )

    if (process.env.ASYRA_STROKE_API_PROFILE === '1') {
      const sourcePath = buildVectorGeometryModelPath(
        baseData.networks['tn-4'],
        baseData.points,
        baseData.segments
      )
      // eslint-disable-next-line no-console
      console.info('[vector-6 inside-to-center solid render profile]', {
        switchRenderMs: Number(switchRenderMs.toFixed(3)),
        sampledPointCount: sourcePath.sampledPoints.length,
        exportPacketCount: exportPackets.length,
        polygonCount,
        pointCount,
        meshCount: getProjectionMeshes(graphic).length
      })
    }

    expect(switchRenderMs).toBeLessThan(320)
    expect(exportPackets.length).toBeGreaterThan(0)
    expect(polygonCount).toBeLessThanOrEqual(6_500)
    expect(pointCount).toBeLessThanOrEqual(18_000)
    expect(
      exportPackets.every((packet) =>
        expect
          .objectContaining({
            geometryFamily: 'solid-center',
            resolutionStatus: 'native-center',
            runtimeStatus: 'not-applicable',
            runtimeReason: 'center-stroke',
            strokePosition: 'center',
            visualOverlapCollapseStatus: 'exact-union'
          })
          .asymmetricMatch(packet.debugMeta)
      )
    ).toBe(true)
    expect(graphic.__asyraConstrainedSolidRuntimeDiagnostics).toBeUndefined()
  })

  it('should run: render multiple closed self-intersecting constrained solid strokes as typed solidMaskModel packets', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-self-intersecting-multi-solid',
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
          style: StrokeStyles.SOLID,
          position: StrokePositions.INSIDE
        }),
        createDefaultStroke({
          width: 4,
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE
        })
      ]
    })

    expect(getProjectionRenderableCount(graphic)).toBeGreaterThan(0)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.length ?? 0
    ).toBeGreaterThanOrEqual(2)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.every((packet) =>
        expect
          .objectContaining({
            geometryFamily: 'constrained-solid',
            resolutionStatus: 'exact-constrained',
            runtimeStatus: 'accepted',
            runtimeReason: 'constrained-solid-exact',
            sourceTopology: 'self-intersecting',
            topologyFamily: 'self-intersecting'
          })
          .asymmetricMatch(packet.debugMeta)
      )
    ).toBe(true)
    expect(graphic.__asyraConstrainedSolidRuntimeDiagnostics).toMatchObject({
      acceptedCount: 1,
      blockedCount: 0,
      entries: [
        {
          status: 'accepted',
          reason: 'accepted',
          topologyFamily: 'self-intersecting'
        }
      ]
    })
    expect(
      graphic.__asyraConstrainedSolidRuntimeDiagnostics?.entries[0]
        ?.candidatePacketCount
    ).toBeGreaterThanOrEqual(2)
    expect(
      graphic.__asyraConstrainedSolidOwnershipDiagnostics?.candidates.length ??
        0
    ).toBeGreaterThan(0)
  })

  it('should run: merge multi-network constrained ownership diagnostics with unique ids on the main render path', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-multi-network-ownership',
      x: 0,
      y: 0,
      width: 180,
      height: 80,
      ...toMultiNetworkVectorData([
        {
          networkId: 'network-a',
          closed: true,
          anchors: [
            { id: 'a0', x: 0, y: 0 },
            { id: 'a1', x: 60, y: 0 },
            { id: 'a2', x: 60, y: 40 },
            { id: 'a3', x: 0, y: 40 }
          ]
        },
        {
          networkId: 'network-b',
          closed: true,
          anchors: [
            { id: 'b0', x: 90, y: 0 },
            { id: 'b1', x: 150, y: 0 },
            { id: 'b2', x: 150, y: 40 },
            { id: 'b3', x: 90, y: 40 }
          ]
        }
      ]),
      closed: true,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 8,
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          color: '#ff0000'
        }),
        createDefaultStroke({
          width: 4,
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          color: '#0000ff'
        })
      ]
    })

    const diagnostics = graphic.__asyraConstrainedSolidOwnershipDiagnostics
    expect(diagnostics).toBeDefined()

    const candidateIds =
      diagnostics?.candidates.map(({ candidateId }) => candidateId) ?? []
    expect(new Set(candidateIds).size).toBe(candidateIds.length)

    const componentIds =
      diagnostics?.components.map(({ componentId }) => componentId) ?? []
    expect(new Set(componentIds).size).toBe(componentIds.length)

    const regionIds =
      diagnostics?.ownedRegions.map(({ regionId }) => regionId) ?? []
    expect(new Set(regionIds).size).toBe(regionIds.length)

    diagnostics?.components.forEach((component) => {
      component.candidateIds.forEach((candidateId) => {
        expect(candidateIds).toContain(candidateId)
      })
    })

    diagnostics?.ownedRegions.forEach((region) => {
      region.candidateIds.forEach((candidateId) => {
        expect(candidateIds).toContain(candidateId)
      })
    })
  })

  it('should run: route multi-network constrained vector render packets through ownership-clipped legality results instead of raw constrained packets', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-multi-network-clipped-constrained',
      x: 0,
      y: 0,
      width: 200,
      height: 40,
      ...toMultiNetworkVectorData([
        {
          networkId: 'network-a',
          closed: true,
          anchors: [
            { id: 'a0', x: 0, y: 0 },
            { id: 'a1', x: 80, y: 0 },
            { id: 'a2', x: 80, y: 40 },
            { id: 'a3', x: 0, y: 40 }
          ]
        },
        {
          networkId: 'network-b',
          closed: true,
          anchors: [
            { id: 'b0', x: 120, y: 0 },
            { id: 'b1', x: 200, y: 0 },
            { id: 'b2', x: 200, y: 40 },
            { id: 'b3', x: 120, y: 40 }
          ]
        }
      ]),
      closed: true,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 16,
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          color: '#ff0000'
        }),
        createDefaultStroke({
          width: 12,
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          color: '#0000ff'
        }),
        createDefaultStroke({
          width: 8,
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          color: '#00ff00'
        }),
        createDefaultStroke({
          width: 6,
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          color: '#ff00ff'
        }),
        createDefaultStroke({
          width: 4,
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          color: '#00ffff'
        })
      ]
    })

    const exportPackets = graphic.__asyraSolidCenterStrokeExportPackets ?? []
    const fifthStrokePackets = exportPackets.filter(
      (packet) =>
        packet.debugMeta?.geometryFamily === 'constrained-solid' &&
        packet.debugMeta.strokeId === 'stroke:4'
    )

    expect(fifthStrokePackets).toEqual([])
    expect(
      graphic.__asyraConstrainedSolidOwnershipDiagnostics?.ownedRegions.length
    ).toBeGreaterThan(0)
  })

  it('should run: keep ownership diagnostics inspectable when stroke overlap debug is enabled', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-multi-network-debug-raw-solid-overlap',
      x: 0,
      y: 0,
      width: 200,
      height: 40,
      ...toMultiNetworkVectorData([
        {
          networkId: 'network-a',
          closed: true,
          anchors: [
            { id: 'a0', x: 0, y: 0 },
            { id: 'a1', x: 80, y: 0 },
            { id: 'a2', x: 80, y: 40 },
            { id: 'a3', x: 0, y: 40 }
          ]
        },
        {
          networkId: 'network-b',
          closed: true,
          anchors: [
            { id: 'b0', x: 120, y: 0 },
            { id: 'b1', x: 200, y: 0 },
            { id: 'b2', x: 200, y: 40 },
            { id: 'b3', x: 120, y: 40 }
          ]
        }
      ]),
      closed: true,
      fills: [],
      strokeDebugOptions: {
        disableVisualOverlapCollapse: true
      },
      strokes: [
        createDefaultStroke({
          width: 16,
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          color: '#ff0000'
        }),
        createDefaultStroke({
          width: 12,
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          color: '#0000ff'
        }),
        createDefaultStroke({
          width: 8,
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          color: '#00ff00'
        }),
        createDefaultStroke({
          width: 6,
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          color: '#ff00ff'
        }),
        createDefaultStroke({
          width: 4,
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          color: '#00ffff'
        })
      ]
    })

    const exportPackets = graphic.__asyraSolidCenterStrokeExportPackets ?? []
    const fifthStrokePackets = exportPackets.filter(
      (packet) =>
        packet.debugMeta?.geometryFamily === 'constrained-solid' &&
        packet.debugMeta.strokeId === 'stroke:4'
    )

    expect(fifthStrokePackets).toEqual([])
    expect(
      graphic.__asyraConstrainedSolidOwnershipDiagnostics?.ownedRegions.length
    ).toBeGreaterThan(0)
  })

  it('should run: resolve overlapping multi-network constrained solid vectors through global ownership diagnostics', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-overlapping-multi-network-constrained-solid',
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
            { id: 'a1', x: 60, y: 0 },
            { id: 'a2', x: 60, y: 40 },
            { id: 'a3', x: 0, y: 40 }
          ]
        },
        {
          networkId: 'network-b',
          closed: true,
          anchors: [
            { id: 'b0', x: 40, y: 0 },
            { id: 'b1', x: 100, y: 0 },
            { id: 'b2', x: 100, y: 40 },
            { id: 'b3', x: 40, y: 40 }
          ]
        }
      ]),
      closed: true,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 8,
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE
        })
      ]
    })

    const exportPackets = graphic.__asyraSolidCenterStrokeExportPackets ?? []
    expect(getProjectionMeshes(graphic).length).toBeGreaterThan(0)
    expect(exportPackets.length).toBeGreaterThan(0)
    expect(
      exportPackets.every(
        (packet) =>
          packet.debugMeta?.geometryFamily === 'constrained-solid' &&
          packet.debugMeta?.arrangementStatus === 'exact' &&
          packet.debugMeta?.resolutionStatus === 'exact-constrained' &&
          packet.debugMeta?.runtimeStatus === 'accepted'
      )
    ).toBe(true)
    expect(graphic.hitArea?.contains(-4, 20)).toBe(true)
    expect(graphic.hitArea?.contains(104, 20)).toBe(true)
    expect(graphic.hitArea?.contains(50, 20)).toBe(false)
    expect(
      graphic.__asyraConstrainedSolidOwnershipDiagnostics?.candidates.length
    ).toBeGreaterThanOrEqual(2)
    expect(
      graphic.__asyraConstrainedSolidOwnershipDiagnostics?.edges.length
    ).toBeGreaterThanOrEqual(1)
    expect(graphic.__asyraConstrainedSolidRuntimeDiagnostics).toMatchObject({
      acceptedCount: 2,
      blockedCount: 0
    })
    expect(
      graphic.__asyraConstrainedSolidRuntimeDiagnostics?.entries.every(
        (entry) =>
          entry.status === 'accepted' &&
          entry.reason === 'accepted' &&
          entry.candidatePacketCount > 0
      )
    ).toBe(true)
  })

  it('should run: render one-hole compound constrained solid vectors with legal-domain side inversion', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-compound-hole-constrained-solid',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      ...toMultiNetworkVectorData([
        {
          networkId: 'outer',
          closed: true,
          anchors: [
            { id: 'outer-0', x: 0, y: 0 },
            { id: 'outer-1', x: 100, y: 0 },
            { id: 'outer-2', x: 100, y: 100 },
            { id: 'outer-3', x: 0, y: 100 }
          ]
        },
        {
          networkId: 'hole',
          closed: true,
          anchors: [
            { id: 'hole-0', x: 25, y: 25 },
            { id: 'hole-1', x: 75, y: 25 },
            { id: 'hole-2', x: 75, y: 75 },
            { id: 'hole-3', x: 25, y: 75 }
          ]
        }
      ]),
      closed: true,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 4,
          style: StrokeStyles.SOLID,
          position: StrokePositions.INSIDE
        })
      ]
    })

    const exportPackets = graphic.__asyraSolidCenterStrokeExportPackets ?? []
    expect(getProjectionMeshes(graphic).length).toBeGreaterThan(0)
    expect(exportPackets.length).toBeGreaterThan(0)
    expect(
      exportPackets.every(
        (packet) =>
          packet.debugMeta?.legalDomainId ===
            'vector:vector-compound-hole-constrained-solid:compound-legal-domain:0' &&
          packet.debugMeta?.arrangementStatus === 'exact' &&
          packet.debugMeta?.resolutionStatus === 'exact-constrained' &&
          packet.debugMeta?.runtimeStatus === 'accepted'
      )
    ).toBe(true)
    expect(getAggregatePacketBounds(exportPackets)).toEqual({
      minX: 0,
      minY: 0,
      maxX: 100,
      maxY: 100
    })
    expect(graphic.hitArea?.contains(2, 2)).toBe(true)
    expect(graphic.hitArea?.contains(50, 50)).toBe(false)
    expect(graphic.__asyraConstrainedSolidRuntimeDiagnostics).toMatchObject({
      acceptedCount: 2,
      blockedCount: 0
    })
  })

  it('should run: render nested compound constrained solid vectors with containment-depth side inversion', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-nested-compound-constrained-solid',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      ...toMultiNetworkVectorData([
        {
          networkId: 'outer',
          closed: true,
          anchors: [
            { id: 'outer-0', x: 0, y: 0 },
            { id: 'outer-1', x: 100, y: 0 },
            { id: 'outer-2', x: 100, y: 100 },
            { id: 'outer-3', x: 0, y: 100 }
          ]
        },
        {
          networkId: 'hole',
          closed: true,
          anchors: [
            { id: 'hole-0', x: 20, y: 20 },
            { id: 'hole-1', x: 80, y: 20 },
            { id: 'hole-2', x: 80, y: 80 },
            { id: 'hole-3', x: 20, y: 80 }
          ]
        },
        {
          networkId: 'island',
          closed: true,
          anchors: [
            { id: 'island-0', x: 40, y: 40 },
            { id: 'island-1', x: 60, y: 40 },
            { id: 'island-2', x: 60, y: 60 },
            { id: 'island-3', x: 40, y: 60 }
          ]
        }
      ]),
      closed: true,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 4,
          style: StrokeStyles.SOLID,
          position: StrokePositions.INSIDE
        })
      ]
    })

    const exportPackets = graphic.__asyraSolidCenterStrokeExportPackets ?? []
    expect(getProjectionMeshes(graphic).length).toBeGreaterThan(0)
    expect(exportPackets.length).toBeGreaterThan(0)
    expect(
      exportPackets.every(
        (packet) =>
          packet.debugMeta?.legalDomainId ===
            'vector:vector-nested-compound-constrained-solid:compound-legal-domain:0' &&
          packet.debugMeta?.arrangementStatus === 'exact' &&
          packet.debugMeta?.resolutionStatus === 'exact-constrained' &&
          packet.debugMeta?.runtimeStatus === 'accepted'
      )
    ).toBe(true)
    expect(exportPackets.every((packet) => packet.polygons.length > 0)).toBe(
      true
    )
    expect(graphic.hitArea?.contains(2, 2)).toBe(true)
    expect(graphic.hitArea?.contains(18, 50)).toBe(false)
    expect(graphic.hitArea?.contains(42, 50)).toBe(true)
    expect(graphic.hitArea?.contains(50, 50)).toBe(false)
    expect(graphic.__asyraConstrainedSolidRuntimeDiagnostics).toMatchObject({
      acceptedCount: 3,
      blockedCount: 0
    })
  })

  it('should run: shape-generated and vector-generated closed rectangles keep equivalent local miter remainders when a bevel owner clips the broader subtraction path', () => {
    const strokes = [
      createDefaultStroke({
        width: 12,
        style: StrokeStyles.SOLID,
        position: StrokePositions.OUTSIDE,
        color: '#da0000',
        joinType: StrokeJoinTypes.BEVEL
      }),
      createDefaultStroke({
        width: 12,
        style: StrokeStyles.SOLID,
        position: StrokePositions.OUTSIDE,
        color: '#0044ff',
        joinType: StrokeJoinTypes.MITER
      })
    ]

    const rectGraphic = runShapeRenderStrategy('rect', {
      id: 'rect-broader-local-remainder',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      fills: [],
      strokes
    })

    const vectorGraphic = runVectorRenderStrategy({
      id: 'vector-broader-local-remainder',
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
      strokes
    })

    const serializePackets = (
      packets: SolidCenterStrokeExportPacket[] | undefined
    ) => {
      const packetsByStroke = new Map<
        string | undefined,
        SolidCenterStrokeExportPacket[]
      >()
      ;(packets ?? []).forEach((packet) => {
        const strokeId = packet.debugMeta?.strokeId
        const existing = packetsByStroke.get(strokeId) ?? []
        existing.push(packet)
        packetsByStroke.set(strokeId, existing)
      })

      return [...packetsByStroke.entries()].map(
        ([strokeId, strokePackets]) => ({
          strokeId,
          geometryFamily: strokePackets[0]?.debugMeta?.geometryFamily,
          bounds: getAggregatePacketBounds(strokePackets)
        })
      )
    }

    expect(
      serializePackets(rectGraphic.__asyraSolidCenterStrokeExportPackets)
    ).toEqual(
      serializePackets(vectorGraphic.__asyraSolidCenterStrokeExportPackets)
    )
  })

  it('should run: keep local miter remainders on the broader subtraction path when a mixed-topology vector includes a non-orthogonal non-convex piece', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-broader-mixed-ear-remainder',
      x: 0,
      y: 0,
      width: 200,
      height: 40,
      ...toMultiNetworkVectorData([
        {
          networkId: 'network-a',
          closed: true,
          anchors: [
            { id: 'a0', x: 0, y: 0 },
            { id: 'a1', x: 80, y: 0 },
            { id: 'a2', x: 80, y: 40 },
            { id: 'a3', x: 40, y: 20 },
            { id: 'a4', x: 0, y: 40 }
          ]
        },
        {
          networkId: 'network-b',
          closed: true,
          anchors: [
            { id: 'b0', x: 120, y: 0 },
            { id: 'b1', x: 200, y: 0 },
            { id: 'b2', x: 200, y: 40 },
            { id: 'b3', x: 120, y: 40 }
          ]
        }
      ]),
      closed: true,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 12,
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          color: '#da0000',
          joinType: StrokeJoinTypes.BEVEL
        }),
        createDefaultStroke({
          width: 12,
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          color: '#0044ff',
          joinType: StrokeJoinTypes.MITER
        })
      ]
    })

    const exportPackets = graphic.__asyraSolidCenterStrokeExportPackets ?? []
    const secondaryPackets = exportPackets.filter(
      (packet) =>
        packet.debugMeta?.geometryFamily === 'constrained-solid' &&
        packet.debugMeta.strokeId === 'stroke:1'
    )

    expect(secondaryPackets.length).toBeGreaterThan(0)
    expect(secondaryPackets.every((packet) => packet.polygons.length > 0)).toBe(
      true
    )
    expect(getAggregatePacketBounds(secondaryPackets).minX).toBe(-12)
    expect(getAggregatePacketBounds(secondaryPackets).minY).toBe(-12)
    expect(getAggregatePacketBounds(secondaryPackets).maxX).toBe(212)
    expect(getAggregatePacketBounds(secondaryPackets).maxY).toBeGreaterThan(52)
  })

  it('should run: keep deterministic broader owner-domain packets for equivalent mixed-topology vectors when one disconnected sub-packet is a non-orthogonal non-convex piece', () => {
    const strokes = [
      createDefaultStroke({
        width: 12,
        style: StrokeStyles.SOLID,
        position: StrokePositions.OUTSIDE,
        color: '#da0000',
        joinType: StrokeJoinTypes.BEVEL
      }),
      createDefaultStroke({
        width: 12,
        style: StrokeStyles.SOLID,
        position: StrokePositions.OUTSIDE,
        color: '#0044ff',
        joinType: StrokeJoinTypes.MITER
      })
    ]

    const canonicalGraphic = runVectorRenderStrategy({
      id: 'vector-mixed-ear-equivalence-canonical',
      x: 0,
      y: 0,
      width: 200,
      height: 40,
      ...toMultiNetworkVectorData([
        {
          networkId: 'network-a',
          closed: true,
          anchors: [
            { id: 'a0', x: 0, y: 0 },
            { id: 'a1', x: 80, y: 0 },
            { id: 'a2', x: 80, y: 40 },
            { id: 'a3', x: 40, y: 20 },
            { id: 'a4', x: 0, y: 40 }
          ]
        },
        {
          networkId: 'network-b',
          closed: true,
          anchors: [
            { id: 'b0', x: 120, y: 0 },
            { id: 'b1', x: 200, y: 0 },
            { id: 'b2', x: 200, y: 40 },
            { id: 'b3', x: 120, y: 40 }
          ]
        }
      ]),
      closed: true,
      fills: [],
      strokes
    })

    const equivalentGraphic = runVectorRenderStrategy({
      id: 'vector-mixed-ear-equivalence-reversed',
      x: 0,
      y: 0,
      width: 200,
      height: 40,
      ...toMultiNetworkVectorData([
        {
          networkId: 'network-a',
          closed: true,
          anchors: [
            { id: 'a0', x: 0, y: 40 },
            { id: 'a1', x: 40, y: 20 },
            { id: 'a2', x: 80, y: 40 },
            { id: 'a3', x: 80, y: 0 },
            { id: 'a4', x: 0, y: 0 }
          ]
        },
        {
          networkId: 'network-b',
          closed: true,
          anchors: [
            { id: 'b0', x: 120, y: 40 },
            { id: 'b1', x: 200, y: 40 },
            { id: 'b2', x: 200, y: 0 },
            { id: 'b3', x: 120, y: 0 }
          ]
        }
      ]),
      closed: true,
      fills: [],
      strokes
    })

    const serializePackets = (
      packets:
        | {
            polygons: { x: number; y: number }[][]
            bounds: { minX: number; minY: number; maxX: number; maxY: number }
          }[]
        | undefined
    ) =>
      [...(packets ?? [])]
        .map((packet) => ({
          polygonCount: packet.polygons.length,
          bounds: roundBounds(packet.bounds)
        }))
        .sort((left, right) =>
          JSON.stringify(left.bounds).localeCompare(
            JSON.stringify(right.bounds)
          )
        )

    const serializeOwnedRegions = (
      diagnostics:
        | {
            ownedRegions: {
              candidateIds: string[]
              bounds: { minX: number; minY: number; maxX: number; maxY: number }
            }[]
          }
        | undefined
    ) =>
      [...(diagnostics?.ownedRegions ?? [])]
        .map((region) => ({
          bounds: roundBounds(region.bounds)
        }))
        .sort((left, right) =>
          JSON.stringify(left.bounds).localeCompare(
            JSON.stringify(right.bounds)
          )
        )

    expect(
      serializePackets(canonicalGraphic.__asyraSolidCenterStrokeExportPackets)
    ).toEqual(
      serializePackets(equivalentGraphic.__asyraSolidCenterStrokeExportPackets)
    )
    expect(
      serializeOwnedRegions(
        canonicalGraphic.__asyraConstrainedSolidOwnershipDiagnostics
      )
    ).toEqual(
      serializeOwnedRegions(
        equivalentGraphic.__asyraConstrainedSolidOwnershipDiagnostics
      )
    )
  })

  it('should run: keep local miter remainders on the broader subtraction path when a mixed-topology vector includes multiple non-orthogonal non-convex pieces', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-broader-mixed-multi-ear-remainder',
      x: 0,
      y: 0,
      width: 200,
      height: 40,
      ...toMultiNetworkVectorData([
        {
          networkId: 'network-a',
          closed: true,
          anchors: [
            { id: 'a0', x: 0, y: 0 },
            { id: 'a1', x: 80, y: 0 },
            { id: 'a2', x: 80, y: 40 },
            { id: 'a3', x: 40, y: 20 },
            { id: 'a4', x: 0, y: 40 }
          ]
        },
        {
          networkId: 'network-b',
          closed: true,
          anchors: [
            { id: 'b0', x: 120, y: 0 },
            { id: 'b1', x: 200, y: 0 },
            { id: 'b2', x: 200, y: 40 },
            { id: 'b3', x: 160, y: 20 },
            { id: 'b4', x: 120, y: 40 }
          ]
        }
      ]),
      closed: true,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 12,
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          color: '#da0000',
          joinType: StrokeJoinTypes.BEVEL
        }),
        createDefaultStroke({
          width: 12,
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          color: '#0044ff',
          joinType: StrokeJoinTypes.MITER
        })
      ]
    })

    const exportPackets = graphic.__asyraSolidCenterStrokeExportPackets ?? []
    const secondaryPackets = exportPackets.filter(
      (packet) =>
        packet.debugMeta?.geometryFamily === 'constrained-solid' &&
        packet.debugMeta.strokeId === 'stroke:1'
    )

    expect(secondaryPackets.length).toBeGreaterThan(0)
    expect(secondaryPackets.every((packet) => packet.polygons.length > 0)).toBe(
      true
    )
    expect(getAggregatePacketBounds(secondaryPackets).minY).toBe(-12)
    expect(getAggregatePacketBounds(secondaryPackets).maxY).toBeGreaterThan(52)
  })
})
