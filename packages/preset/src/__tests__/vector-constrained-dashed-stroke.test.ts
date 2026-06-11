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
  FillKinds,
  StrokePositions,
  StrokeStyles,
  createDefaultGradientData,
  createDefaultStroke
} from '@asyra/utils'
import { applyPreset } from '../preset'
import type { PresetDependencies } from '../types'
import type { SolidCenterStrokeExportPacket } from '../components/stroke-render/solid-center-stroke-packets'
import type { ConstrainedSolidOwnershipDiagnostics } from '../components/stroke-render/constrained-solid-ownership-diagnostics'
import {
  DEFAULT_GEOMETRY_BACKEND_COORDINATE_POLICY,
  registerGeometryBackend,
  selectGeometryBackend,
  type ArrangementFace,
  type CandidateRegion,
  type GeometryBackend
} from '../components/stroke-render/geometry-backend'
import {
  createClipper2GeometryBackend,
  type Clipper2Module
} from '../components/stroke-render/clipper2-geometry-backend'
import { buildVectorGeometryModelPath } from '../components/stroke-render/path-geometry'
import { buildPathTopologyModel } from '../components/stroke-render/path-topology-model'
import type { StrokeDiagnosticsMode } from '../components/stroke-render/stroke-diagnostics-mode'

const UNSUPPORTED_BACKEND_ID = 'unsupported-exact-geometry-backend'
const require = createRequire(import.meta.url)
const clipperWasmPath = require.resolve('clipper2-wasm/dist/umd/clipper2z.wasm')

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

const selectClipper2TestBackend = async (backendId: string) => {
  const backend = createClipper2GeometryBackend(await loadClipperModule(), {
    backendId,
    backendVersion: `${backendId}@test`
  })
  registerGeometryBackend({
    backendId,
    load: () => backend
  })
  selectGeometryBackend(backendId)
  return backend
}

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext =
    HTMLCanvasElement.prototype.getContext ?? (() => null)

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
  core.defineSystemProperty<boolean>(
    'strokeDebugDisableVisualOverlapCollapse',
    false
  )

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

beforeEach(() => {
  ;(
    globalThis as StrokeDiagnosticsTestGlobal
  ).__ASYRA_STROKE_DIAGNOSTICS_MODE__ = 'full'
})

afterEach(() => {
  selectGeometryBackend(UNSUPPORTED_BACKEND_ID)
  core.setSystemProperty('strokeDebugDisableVisualOverlapCollapse', false)
  delete (globalThis as StrokeDiagnosticsTestGlobal)
    .__ASYRA_STROKE_DIAGNOSTICS_MODE__
})

class RecordingVectorGraphic extends Container {
  __asyraSolidCenterStrokeExportPackets?: SolidCenterStrokeExportPacket[]
  __asyraConstrainedDashedRuntimeDiagnostics?: {
    entries: {
      sourceId: string
      networkId?: string
      status: string
      reason: string
      sourceTopology: string
      candidatePacketCount: number
    }[]
    acceptedCount: number
    blockedCount: number
    sourceTopologies: string[]
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
    arrangementDiagnostics?: ConstrainedSolidOwnershipDiagnostics
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
  __asyraConstrainedDashedRuntimeDiagnostics?: {
    entries: {
      sourceId: string
      networkId?: string
      status: string
      reason: string
      sourceTopology: string
      candidatePacketCount: number
    }[]
    acceptedCount: number
    blockedCount: number
    sourceTopologies: string[]
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
    arrangementDiagnostics?: ConstrainedSolidOwnershipDiagnostics
  }
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

const createPassthroughArrangementBackend = (
  backendId: string
): GeometryBackend => ({
  backendId,
  backendVersion: `${backendId}@test`,
  capabilities: {
    union: true,
    difference: true,
    intersection: true,
    offset: true,
    buildArrangement: true
  },
  coordinatePolicy: DEFAULT_GEOMETRY_BACKEND_COORDINATE_POLICY,
  union: (regions) => regions,
  difference: (subject) => subject,
  intersection: (subject) => subject,
  offset: () => [],
  buildArrangement: (candidates: CandidateRegion[]): ArrangementFace[] =>
    candidates.map((candidate, index) => ({
      faceId: `${backendId}:face:${index}`,
      geometry: candidate.geometry,
      claimedBy: [candidate],
      legalState: {
        insideFillDomain: true,
        outsideFillDomain: true
      }
    }))
})

const createMergeAllArrangementBackend = (
  backendId: string
): GeometryBackend => ({
  ...createPassthroughArrangementBackend(backendId),
  buildArrangement: (candidates: CandidateRegion[]): ArrangementFace[] =>
    candidates.length === 0
      ? []
      : [
          {
            faceId: `${backendId}:merged-face:0`,
            geometry:
              candidates[0]?.geometry ??
              (() => {
                throw new Error(
                  'Expected at least one candidate for test backend'
                )
              })(),
            claimedBy: candidates,
            legalState: {
              insideFillDomain: true,
              outsideFillDomain: true
            }
          }
        ]
})

const createNormalizedCompoundHoleBackend = (
  backendId: string
): GeometryBackend => ({
  ...createPassthroughArrangementBackend(backendId),
  difference: () => [
    {
      polygons: [
        [
          { x: 0, y: 0 },
          { x: 240, y: 0 },
          { x: 240, y: 160 },
          { x: 0, y: 160 }
        ],
        [
          { x: 45, y: 45 },
          { x: 185, y: 45 },
          { x: 185, y: 115 },
          { x: 45, y: 115 }
        ]
      ]
    }
  ]
})

const buildPacketGeometrySignature = (
  packets: SolidCenterStrokeExportPacket[]
) =>
  packets
    .map((packet) =>
      [
        packet.debugMeta?.strokePosition ?? 'none',
        packet.bounds.minX.toFixed(3),
        packet.bounds.minY.toFixed(3),
        packet.bounds.maxX.toFixed(3),
        packet.bounds.maxY.toFixed(3),
        packet.polygons.length,
        packet.intervalIds.join(',')
      ].join('|')
    )
    .sort()
    .join('||')

const getExportPacketAggregateBounds = (
  packets: SolidCenterStrokeExportPacket[]
) => ({
  minX: Math.min(...packets.map((packet) => packet.bounds.minX)),
  minY: Math.min(...packets.map((packet) => packet.bounds.minY)),
  maxX: Math.max(...packets.map((packet) => packet.bounds.maxX)),
  maxY: Math.max(...packets.map((packet) => packet.bounds.maxY))
})

const isSelfIntersectingInsideDashedSourcePathPacket = (
  packet: SolidCenterStrokeExportPacket
) =>
  packet.debugMeta?.geometryFamily === 'constrained-dashed' &&
  packet.debugMeta?.sourceTopology === 'self-intersecting' &&
  packet.debugMeta?.strokePosition === 'inside' &&
  packet.debugMeta?.runtimeStatus === 'accepted' &&
  packet.debugMeta?.resolutionStatus === 'exact-constrained' &&
  typeof packet.debugMeta.intervalId === 'string' &&
  packet.debugMeta.intervalId.startsWith('interval:') &&
  packet.intervalIds.every((intervalId) => intervalId.startsWith('interval:'))

const isSelfIntersectingOutsideDashedSourcePathPacket = (
  packet: SolidCenterStrokeExportPacket
) =>
  packet.debugMeta?.geometryFamily === 'constrained-dashed' &&
  packet.debugMeta?.sourceTopology === 'self-intersecting' &&
  packet.debugMeta?.strokePosition === 'outside' &&
  packet.debugMeta?.runtimeStatus === 'accepted' &&
  packet.debugMeta?.resolutionStatus === 'exact-constrained' &&
  typeof packet.debugMeta.intervalId === 'string' &&
  packet.debugMeta.intervalId.startsWith('interval:') &&
  packet.intervalIds.every((intervalId) => intervalId.startsWith('interval:'))

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
    if (child instanceof Graphics) {
      return (child as Graphics & { __asyraStrokeGradientMask?: boolean })
        .__asyraStrokeGradientMask
        ? []
        : [child]
    }

    if (!(child instanceof Container)) {
      return []
    }

    return child.children.filter(
      (grandchild): grandchild is Graphics =>
        grandchild instanceof Graphics &&
        !(grandchild as Graphics & { __asyraStrokeGradientMask?: boolean })
          .__asyraStrokeGradientMask
    )
  })

const getStrokeMeshCacheKinds = (host: Container) =>
  Array.from(
    (
      host as typeof host & {
        __asyraStrokeMeshCache?: Map<string, { kind?: string }>
      }
    ).__asyraStrokeMeshCache?.values() ?? []
  ).map((entry) => entry.kind)

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

    const exportPackets = graphic.__asyraSolidCenterStrokeExportPackets ?? []
    expect(getProjectionMeshes(graphic)).toHaveLength(0)
    expect(getProjectionGraphics(graphic).length).toBeGreaterThan(1)
    expect(exportPackets.length).toBeGreaterThan(1)
    expect(
      exportPackets.every(
        (packet) => packet.debugMeta?.geometryFamily === 'constrained-dashed'
      )
    ).toBe(true)
    expect(getExportPacketAggregateBounds(exportPackets)).toEqual({
      minX: 0,
      minY: 0,
      maxX: 40,
      maxY: 40
    })
    expect(graphic.hitArea?.contains(1, 1)).toBe(true)
    expect(graphic.hitArea?.contains(20, 20)).toBe(false)
  })

  it('should run: promote supported constrained dashed one-sided candidates through exact arrangement', () => {
    const backendId = 'vector-constrained-dashed-arrangement-test-backend'
    let buildArrangementCallCount = 0
    registerGeometryBackend({
      backendId,
      load: () => ({
        ...createPassthroughArrangementBackend(backendId),
        buildArrangement: (candidates: CandidateRegion[]) => {
          buildArrangementCallCount += 1
          return createPassthroughArrangementBackend(
            backendId
          ).buildArrangement(candidates)
        }
      })
    })
    selectGeometryBackend(backendId)

    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-exact-arrangement',
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

    const exportPackets = graphic.__asyraSolidCenterStrokeExportPackets ?? []
    expect(exportPackets.length).toBeGreaterThan(1)
    expect(
      exportPackets.every(
        (packet) =>
          packet.debugMeta?.geometryFamily === 'constrained-dashed' &&
          packet.debugMeta.resolutionStatus === 'exact-constrained' &&
          packet.debugMeta.runtimeStatus === 'accepted' &&
          packet.debugMeta.arrangementStatus === 'exact'
      )
    ).toBe(true)
    expect(
      exportPackets.every(
        (packet) =>
          typeof packet.debugMeta?.arrangementFaceId === 'string' &&
          (packet.debugMeta.arrangementCandidateIds?.length ?? 0) > 0
      )
    ).toBe(true)
    expect(exportPackets.every((packet) => packet.ownerSet.length === 1)).toBe(
      true
    )
    expect(buildArrangementCallCount).toBe(1)
    expect(graphic.__asyraConstrainedDashedRuntimeDiagnostics).toMatchObject({
      acceptedCount: 1,
      blockedCount: 0
    })
    expect(
      graphic.__asyraConstrainedDashedRuntimeDiagnostics?.branches[0]
    ).toMatchObject({
      branchId:
        'product:constrained-dashed:vector:vector-constrained-dashed-exact-arrangement:network-0:network-0',
      supportState: 'accepted',
      blockedReason: null,
      ownerProvenance: {
        ownerSet: expect.arrayContaining([expect.stringContaining('network-0')])
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
  })

  it('should run: defer gradient constrained dashed exact arrangement until paint attachment owns paint domains', () => {
    const backendId = 'vector-constrained-dashed-gradient-defer-backend'
    let buildArrangementCallCount = 0
    registerGeometryBackend({
      backendId,
      load: () => ({
        ...createPassthroughArrangementBackend(backendId),
        buildArrangement: (candidates: CandidateRegion[]) => {
          buildArrangementCallCount += 1
          return createPassthroughArrangementBackend(
            backendId
          ).buildArrangement(candidates)
        }
      })
    })
    selectGeometryBackend(backendId)

    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-gradient-defer',
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

    const exportPackets = graphic.__asyraSolidCenterStrokeExportPackets ?? []
    expect(exportPackets.length).toBeGreaterThan(1)
    expect(
      exportPackets.every(
        (packet) =>
          packet.debugMeta?.geometryFamily === 'constrained-dashed' &&
          packet.debugMeta.resolutionStatus === 'exact-constrained' &&
          packet.debugMeta.runtimeStatus === 'accepted' &&
          packet.debugMeta.arrangementStatus === undefined
      )
    ).toBe(true)
    expect(buildArrangementCallCount).toBe(0)
  })

  it('should run: render closed rectangle-equivalent vectors through the first supported paint constrained dashed gradient-paint product path', () => {
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

    const exportPackets = graphic.__asyraSolidCenterStrokeExportPackets ?? []
    expect(getProjectionMeshes(graphic)).toHaveLength(0)
    expect(getProjectionGraphics(graphic).length).toBeGreaterThan(1)
    expect(exportPackets.length).toBeGreaterThan(1)
    expect(
      exportPackets.every(
        (packet) => packet.debugMeta?.geometryFamily === 'constrained-dashed'
      )
    ).toBe(true)
    expect(getExportPacketAggregateBounds(exportPackets)).toEqual({
      minX: 0,
      minY: 0,
      maxX: 80,
      maxY: 40
    })
    expect(graphic.hitArea?.contains(1, 1)).toBe(true)
    expect(graphic.hitArea?.contains(40, 20)).toBe(false)
  })

  it('should run: render closed non-rectangle-equivalent vectors through the next broader supported paint constrained dashed gradient-paint product path', () => {
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

    const exportPackets = graphic.__asyraSolidCenterStrokeExportPackets ?? []
    expect(getProjectionMeshes(graphic)).toHaveLength(0)
    expect(getProjectionGraphics(graphic).length).toBeGreaterThan(1)
    expect(exportPackets.length).toBeGreaterThan(1)
    expect(
      exportPackets.every(
        (packet) => packet.debugMeta?.geometryFamily === 'constrained-dashed'
      )
    ).toBe(true)
    expect(getExportPacketAggregateBounds(exportPackets)).toEqual({
      minX: 0,
      minY: 0,
      maxX: 80,
      maxY: 40
    })
    expect(graphic.hitArea?.contains(1, 1)).toBe(true)
    expect(graphic.hitArea?.contains(30, 20)).toBe(false)
  })

  it('should run: render closed rectangle-equivalent outside vectors through the next supported paint constrained dashed gradient-paint product path', () => {
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

    const exportPackets = graphic.__asyraSolidCenterStrokeExportPackets ?? []
    expect(getProjectionMeshes(graphic)).toHaveLength(0)
    expect(getProjectionGraphics(graphic).length).toBeGreaterThan(1)
    expect(exportPackets.length).toBeGreaterThan(1)
    expect(
      exportPackets.every(
        (packet) => packet.debugMeta?.geometryFamily === 'constrained-dashed'
      )
    ).toBe(true)
    expect(getExportPacketAggregateBounds(exportPackets)).toEqual({
      minX: -6,
      minY: -6,
      maxX: 86,
      maxY: 46
    })
    expect(graphic.hitArea?.contains(-2, 1)).toBe(true)
    expect(graphic.hitArea?.contains(40, 20)).toBe(false)
  })

  it('should run: render closed non-rectangle-equivalent outside vectors through the next broader supported paint constrained dashed gradient-paint product path', () => {
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

    const exportPackets = graphic.__asyraSolidCenterStrokeExportPackets ?? []
    expect(getProjectionMeshes(graphic)).toHaveLength(0)
    expect(getProjectionGraphics(graphic).length).toBeGreaterThan(1)
    expect(exportPackets.length).toBeGreaterThan(1)
    expect(
      exportPackets.every(
        (packet) => packet.debugMeta?.geometryFamily === 'constrained-dashed'
      )
    ).toBe(true)
    const bounds = getExportPacketAggregateBounds(exportPackets)
    expect(bounds.minX).toBeCloseTo(-6, 1)
    expect(bounds.minY).toBeCloseTo(-6, 1)
    expect(bounds.maxX).toBeGreaterThan(89)
    expect(bounds.maxX).toBeLessThan(92)
    expect(bounds.maxY).toBeCloseTo(46, 1)
    expect(graphic.hitArea?.contains(-2, 1)).toBe(true)
    expect(graphic.hitArea?.contains(30, 20)).toBe(false)
  })

  it('should run: render closed rectangle-equivalent vectors through the next supported paint constrained dashed single-edge gradient-paint product path', () => {
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
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.debugMeta
    ).toMatchObject({ geometryFamily: 'constrained-dashed' })
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

  it('should run: render closed outside vectors through the constrained dashed path on the same full-loop topology family product path', () => {
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

    const exportPackets = graphic.__asyraSolidCenterStrokeExportPackets ?? []
    expect(getProjectionMeshes(graphic).length).toBeGreaterThan(1)
    expect(exportPackets.length).toBeGreaterThan(1)
    expect(
      exportPackets.every(
        (packet) => packet.debugMeta?.geometryFamily === 'constrained-dashed'
      )
    ).toBe(true)
    expect(getExportPacketAggregateBounds(exportPackets)).toEqual({
      minX: -4,
      minY: -4,
      maxX: 44,
      maxY: 44
    })
    expect(graphic.hitArea?.contains(-1, 1)).toBe(true)
    expect(graphic.hitArea?.contains(20, 20)).toBe(false)
  })

  it('should run: render closed inside rectangle-equivalent vectors through the first supported join/cap round-join product path', () => {
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

    const exportPackets = graphic.__asyraSolidCenterStrokeExportPackets ?? []
    expect(getProjectionMeshes(graphic)).toHaveLength(0)
    expect(getProjectionGraphics(graphic).length).toBeGreaterThan(1)
    expect(exportPackets.length).toBeGreaterThan(1)
    expect(
      exportPackets.every(
        (packet) => packet.debugMeta?.geometryFamily === 'constrained-dashed'
      )
    ).toBe(true)
    expect(getExportPacketAggregateBounds(exportPackets)).toEqual({
      minX: 0,
      minY: 0,
      maxX: 80,
      maxY: 40
    })
    expect(graphic.hitArea?.contains(1, 1)).toBe(true)
    expect(graphic.hitArea?.contains(40, 20)).toBe(false)
  })

  it('should run: render closed outside rectangle-equivalent vectors through the next supported join/cap outside round-join product path', () => {
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

    const exportPackets = graphic.__asyraSolidCenterStrokeExportPackets ?? []
    expect(getProjectionMeshes(graphic).length).toBeGreaterThan(1)
    expect(exportPackets.length).toBeGreaterThan(1)
    expect(
      exportPackets.every(
        (packet) => packet.debugMeta?.geometryFamily === 'constrained-dashed'
      )
    ).toBe(true)
    expect(getExportPacketAggregateBounds(exportPackets)).toEqual({
      minX: -6,
      minY: -6,
      maxX: 86,
      maxY: 46
    })
    expect(graphic.hitArea?.contains(-2, 1)).toBe(true)
    expect(graphic.hitArea?.contains(1, 1)).toBe(false)
    expect(graphic.hitArea?.contains(40, 20)).toBe(false)
  })

  it('should run: render closed inside rectangle-equivalent vectors through the first single-edge topology family single-edge constrained dashed path', () => {
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
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.debugMeta
    ).toMatchObject({ geometryFamily: 'constrained-dashed' })
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

  it('should run: render closed inside rectangle-equivalent vectors through the next supported join/cap round-cap product path', () => {
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
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.debugMeta
    ).toMatchObject({ geometryFamily: 'constrained-dashed' })
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.minX
    ).toBeCloseTo(18, 6)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.minY
    ).toBe(0)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxX
    ).toBe(42)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxY
    ).toBe(4)
    expect(graphic.hitArea?.contains(20, 2)).toBe(true)
    expect(graphic.hitArea?.contains(41, 2)).toBe(true)
    expect(graphic.hitArea?.contains(30, 20)).toBe(false)
  })

  it('should run: render closed outside rectangle-equivalent vectors through the next supported join/cap outside round-cap product path', () => {
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
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.debugMeta
    ).toMatchObject({ geometryFamily: 'constrained-dashed' })
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.minX
    ).toBeCloseTo(18, 6)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.minY
    ).toBe(-4)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxX
    ).toBeCloseTo(42, 6)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxY
    ).toBe(0)
    expect(graphic.hitArea?.contains(20, -2)).toBe(true)
    expect(graphic.hitArea?.contains(41, -2)).toBe(true)
    expect(graphic.hitArea?.contains(30, 2)).toBe(false)
  })

  it('should run: render closed outside rectangle-equivalent vectors through the same first single-edge topology family single-edge constrained dashed path', () => {
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
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.debugMeta
    ).toMatchObject({ geometryFamily: 'constrained-dashed' })
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

  it('should run: render closed outside rectangle-equivalent vectors through the next supported paint single-edge gradient-paint product path', () => {
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
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.debugMeta
    ).toMatchObject({ geometryFamily: 'constrained-dashed' })
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

  it('should run: render closed inside rectangle-equivalent vectors through the first corner-spanning topology family corner-spanning constrained dashed path', () => {
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
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.debugMeta
    ).toMatchObject({ geometryFamily: 'constrained-dashed' })
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

  it('should run: render closed inside rectangle-equivalent vectors through the first supported paint corner-spanning constrained dashed gradient-paint product path', () => {
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
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.debugMeta
    ).toMatchObject({ geometryFamily: 'constrained-dashed' })
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

  it('should run: render closed inside rectangle-equivalent vectors through the matching corner-spanning topology family corner-spanning constrained dashed miter path', () => {
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
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.debugMeta
    ).toMatchObject({ geometryFamily: 'constrained-dashed' })
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

  it('should run: render closed inside rectangle-equivalent vectors through the uniform-width corner-spanning topology family round corner-spanning path', () => {
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
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.debugMeta
    ).toMatchObject({ geometryFamily: 'constrained-dashed' })
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

  it('should run: render closed outside rectangle-equivalent vectors through the next bounded vector corner-spanning topology family corner-spanning constrained dashed bevel path', () => {
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
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.debugMeta
    ).toMatchObject({ geometryFamily: 'constrained-dashed' })
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

  it('should run: render closed outside rectangle-equivalent vectors through the next supported paint corner-spanning constrained dashed gradient-paint product path', () => {
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
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.debugMeta
    ).toMatchObject({ geometryFamily: 'constrained-dashed' })
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

  it('should run: render closed outside rectangle-equivalent vectors through the matching bounded vector corner-spanning topology family corner-spanning constrained dashed miter path', () => {
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
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.debugMeta
    ).toMatchObject({ geometryFamily: 'constrained-dashed' })
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

  it('should run: render closed outside rectangle-equivalent vectors through the uniform-width corner-spanning topology family round corner-spanning path', () => {
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
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.debugMeta
    ).toMatchObject({ geometryFamily: 'constrained-dashed' })
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

  it('should run: render closed inside non-rectangle-equivalent vectors through the first broader corner-spanning topology family corner-spanning constrained dashed path', () => {
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
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.debugMeta
    ).toMatchObject({ geometryFamily: 'constrained-dashed' })
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.minY
    ).toBe(0)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxX
    ).toBe(80)
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

  it('should run: render closed inside non-rectangle-equivalent vectors through the next broader supported paint corner-spanning constrained dashed gradient-paint product path', () => {
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
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.debugMeta
    ).toMatchObject({ geometryFamily: 'constrained-dashed' })
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.minY
    ).toBe(0)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxX
    ).toBe(80)
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

  it('should run: render closed inside non-rectangle-equivalent vectors through the matching broader corner-spanning topology family corner-spanning constrained dashed miter path', () => {
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
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.debugMeta
    ).toMatchObject({ geometryFamily: 'constrained-dashed' })
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.minY
    ).toBe(0)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxX
    ).toBe(80)
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

  it('should run: render closed outside non-rectangle-equivalent vectors through the next broader corner-spanning topology family corner-spanning constrained dashed bevel path', () => {
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
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.debugMeta
    ).toMatchObject({ geometryFamily: 'constrained-dashed' })
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.minY
    ).toBeLessThan(0)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxX
    ).toBeGreaterThan(80)
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

  it('should run: render closed outside non-rectangle-equivalent vectors through the matching broader corner-spanning topology family corner-spanning constrained dashed miter path', () => {
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
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.debugMeta
    ).toMatchObject({ geometryFamily: 'constrained-dashed' })
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.minY
    ).toBeLessThan(0)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxX
    ).toBeGreaterThan(80)
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

  it('should run: render closed inside non-rectangle-equivalent vectors through the next broader single-edge topology family single-edge constrained dashed path', () => {
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
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.debugMeta
    ).toMatchObject({ geometryFamily: 'constrained-dashed' })
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

  it('should run: render closed inside non-rectangle-equivalent vectors through the next broader supported paint single-edge gradient-paint product path', () => {
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
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.debugMeta
    ).toMatchObject({ geometryFamily: 'constrained-dashed' })
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

  it('should run: render closed inside non-rectangle-equivalent vectors through the next broader supported join/cap round-cap product path', () => {
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
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.debugMeta
    ).toMatchObject({ geometryFamily: 'constrained-dashed' })
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.minX
    ).toBeCloseTo(18, 6)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.minY
    ).toBe(0)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxX
    ).toBe(42)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxY
    ).toBe(4)
    expect(graphic.hitArea?.contains(20, 2)).toBe(true)
    expect(graphic.hitArea?.contains(41, 2)).toBe(true)
    expect(graphic.hitArea?.contains(30, 20)).toBe(false)
  })

  it('should run: render closed outside non-rectangle-equivalent vectors through the next broader supported join/cap outside round-cap product path', () => {
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
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.debugMeta
    ).toMatchObject({ geometryFamily: 'constrained-dashed' })
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.minX
    ).toBeCloseTo(18, 6)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.minY
    ).toBeLessThan(-3.5)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxX
    ).toBeCloseTo(42, 6)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds.maxY
    ).toBeGreaterThan(-0.5)
    expect(graphic.hitArea?.contains(20, -2)).toBe(true)
    expect(graphic.hitArea?.contains(41, -2)).toBe(true)
    expect(graphic.hitArea?.contains(30, 2)).toBe(false)
  })

  it('should run: render closed inside non-rectangle-equivalent vectors through the next broader supported join/cap round-join product path', () => {
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

    const exportPackets = graphic.__asyraSolidCenterStrokeExportPackets ?? []
    expect(getProjectionMeshes(graphic)).toHaveLength(0)
    expect(getProjectionGraphics(graphic).length).toBeGreaterThan(1)
    expect(exportPackets.length).toBeGreaterThan(1)
    expect(
      exportPackets.every(
        (packet) => packet.debugMeta?.geometryFamily === 'constrained-dashed'
      )
    ).toBe(true)
    expect(getExportPacketAggregateBounds(exportPackets)).toEqual({
      minX: 0,
      minY: 0,
      maxX: 80,
      maxY: 40
    })
    expect(graphic.hitArea?.contains(1, 1)).toBe(true)
    expect(graphic.hitArea?.contains(40, 20)).toBe(false)
  })

  it('should run: render closed outside non-rectangle-equivalent vectors through the next broader supported join/cap outside round-join product path', () => {
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

    const exportPackets = graphic.__asyraSolidCenterStrokeExportPackets ?? []
    expect(getProjectionMeshes(graphic).length).toBeGreaterThan(1)
    expect(exportPackets.length).toBeGreaterThan(1)
    expect(
      exportPackets.every(
        (packet) => packet.debugMeta?.geometryFamily === 'constrained-dashed'
      )
    ).toBe(true)
    const bounds = getExportPacketAggregateBounds(exportPackets)
    expect(bounds.minX).toBeCloseTo(-4, 6)
    expect(bounds.minY).toBeCloseTo(-4, 6)
    expect(bounds.maxX).toBeCloseTo(84, 1)
    expect(bounds.maxY).toBeCloseTo(44, 6)
    expect(graphic.hitArea?.contains(-2, 1)).toBe(true)
    expect(graphic.hitArea?.contains(1, 1)).toBe(false)
    expect(graphic.hitArea?.contains(40, 20)).toBe(false)
  })

  it('should run: render closed outside non-rectangle-equivalent vectors through the same broader single-edge topology family single-edge constrained dashed path', () => {
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
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.debugMeta
    ).toMatchObject({ geometryFamily: 'constrained-dashed' })
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

  it('should run: render closed outside non-rectangle-equivalent vectors through the next broader supported paint single-edge gradient-paint product path', () => {
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
      graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.debugMeta
    ).toMatchObject({ geometryFamily: 'constrained-dashed' })
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

    const exportPackets = graphic.__asyraSolidCenterStrokeExportPackets ?? []
    expect(getProjectionMeshes(graphic)).toHaveLength(0)
    expect(getProjectionGraphics(graphic).length).toBeGreaterThan(1)
    expect(exportPackets.length).toBeGreaterThan(1)
    expect(
      exportPackets.every(
        (packet) => packet.debugMeta?.geometryFamily === 'constrained-dashed'
      )
    ).toBe(true)
    expect(getExportPacketAggregateBounds(exportPackets)).toEqual({
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

    const exportPackets = graphic.__asyraSolidCenterStrokeExportPackets ?? []
    expect(getProjectionMeshes(graphic).length).toBeGreaterThan(1)
    expect(exportPackets.length).toBeGreaterThan(1)
    expect(
      exportPackets.every(
        (packet) => packet.debugMeta?.geometryFamily === 'constrained-dashed'
      )
    ).toBe(true)
    const bounds = getExportPacketAggregateBounds(exportPackets)
    expect(bounds.minX).toBeCloseTo(-4, 1)
    expect(bounds.minY).toBeCloseTo(-4, 1)
    expect(bounds.maxX).toBeGreaterThan(84)
    expect(bounds.maxX).toBeLessThan(88)
    expect(bounds.maxY).toBeGreaterThan(43)
    expect(bounds.maxY).toBeLessThan(46)
    expect(graphic.hitArea?.contains(-1, 1)).toBe(true)
    expect(graphic.hitArea?.contains(40, 20)).toBe(false)
  })
  ;[
    { label: 'inside', position: StrokePositions.INSIDE },
    { label: 'outside', position: StrokePositions.OUTSIDE }
  ].forEach(({ label, position }) => {
    it(`should run: render simple open ${label} dashed vectors without bounded domains as center product geometry`, () => {
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
        graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.debugMeta
      ).toMatchObject({ geometryFamily: 'dashed-center' })
      expect(
        graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.bounds
      ).toEqual({
        minX: 0,
        minY: 8,
        maxX: 40,
        maxY: 12
      })
      expect(
        graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.debugMeta
      ).toMatchObject({
        geometryFamily: 'dashed-center',
        resolutionStatus: 'native-center',
        runtimeStatus: 'not-applicable',
        runtimeReason: 'center-stroke',
        sourceTopology: 'open',
        topologyFamily: 'open'
      })
      expect(graphic.hitArea?.contains(20, 9)).toBe(true)
      expect(graphic.hitArea?.contains(20, 11)).toBe(true)
      expect(graphic.hitArea?.contains(20, 7)).toBe(false)
      expect(graphic.hitArea?.contains(20, 13)).toBe(false)
      expect(graphic.__asyraConstrainedDashedRuntimeDiagnostics).toBeUndefined()
    })
  })

  it('should run: keep unsupported open self-intersecting inside dashed vectors off the simple-open center path', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-open-self-intersecting',
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
          style: StrokeStyles.DASHED,
          position: StrokePositions.INSIDE,
          dashPattern: [400, 20],
          dashOffset: 0
        })
      ]
    })

    expect(getProjectionMeshes(graphic)).toHaveLength(0)
    expect(getProjectionGraphics(graphic)).toHaveLength(0)
    expect(graphic.__asyraSolidCenterStrokeExportPackets ?? []).toHaveLength(0)
    expect(graphic.hitArea?.contains(20, 20) ?? false).toBe(false)
    expect(
      graphic.__asyraConstrainedDashedRuntimeDiagnostics?.entries?.some(
        (entry) => entry.reason === 'simple-open-center-product'
      ) ?? false
    ).toBe(false)
  })
  ;[
    { label: 'inside', position: StrokePositions.INSIDE },
    { label: 'outside', position: StrokePositions.OUTSIDE }
  ].forEach(({ label, position }) => {
    it(`should run: keep simple open dashed center product geometry when switching position to ${label}`, () => {
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
        graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.debugMeta
      ).toMatchObject({
        geometryFamily: 'dashed-center',
        resolutionStatus: 'native-center'
      })
      expect(graphic.hitArea?.contains(20, 10)).toBe(true)
      expect(graphic.__asyraConstrainedDashedRuntimeDiagnostics).toBeUndefined()
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
        graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.debugMeta
      ).toMatchObject({
        geometryFamily: 'dashed-center',
        resolutionStatus: 'native-center',
        runtimeStatus: 'not-applicable',
        runtimeReason: 'center-stroke',
        sourceTopology: 'open'
      })
      expect(graphic.__asyraConstrainedDashedRuntimeDiagnostics).toBeUndefined()
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

      expect(graphic.__asyraConstrainedDashedRuntimeDiagnostics).toBeUndefined()
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

      expect(
        graphic.__asyraSolidCenterStrokeExportPackets?.length
      ).toBeGreaterThan(1)
      expect(
        graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.debugMeta
      ).toMatchObject({
        geometryFamily: 'dashed-center',
        resolutionStatus: 'native-center'
      })
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

      expect(
        graphic.__asyraSolidCenterStrokeExportPackets?.length
      ).toBeGreaterThan(1)
      expect(
        graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.debugMeta
      ).toMatchObject({
        geometryFamily: 'constrained-dashed',
        resolutionStatus: 'exact-constrained',
        runtimeStatus: 'accepted'
      })
      const bounds =
        graphic.__asyraSolidCenterStrokeExportPackets?.map(
          (packet) => packet.bounds
        ) ?? []
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
    it(`should run: render closed cubic repeated dashed ${label} strokes as sampled-simple constrained packets`, () => {
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

      expect(
        graphic.__asyraSolidCenterStrokeExportPackets?.length
      ).toBeGreaterThan(1)
      expect(
        graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.debugMeta
      ).toMatchObject({
        geometryFamily: 'dashed-center',
        resolutionStatus: 'native-center'
      })
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

      const constrainedPackets =
        graphic.__asyraSolidCenterStrokeExportPackets?.filter(
          (packet) => packet.debugMeta?.geometryFamily === 'constrained-dashed'
        ) ?? []

      expect(constrainedPackets.length).toBeGreaterThan(0)
      expect(
        constrainedPackets.every(
          (packet) =>
            packet.debugMeta?.resolutionStatus === 'local-side-approximation' &&
            packet.debugMeta?.runtimeStatus === 'accepted' &&
            packet.debugMeta?.sourceTopology === 'sampled-simple-closed'
        )
      ).toBe(true)
      expect(graphic.__asyraConstrainedDashedRuntimeDiagnostics).toMatchObject({
        acceptedCount: 1,
        blockedCount: 0,
        entries: [
          {
            status: 'accepted',
            reason: 'single-owner',
            sourceTopology: 'sampled-simple-closed',
            candidatePacketCount: constrainedPackets.length
          }
        ]
      })
    })
  })

  it('should run: keep high-curvature sampled-simple local-side constrained dashed vectors local when a backend is selected', () => {
    const backendId = 'vector-constrained-dashed-high-curvature-exact-backend'
    let buildArrangementCallCount = 0
    registerGeometryBackend({
      backendId,
      load: () => ({
        ...createPassthroughArrangementBackend(backendId),
        buildArrangement: (candidates: CandidateRegion[]) => {
          buildArrangementCallCount += 1
          return createPassthroughArrangementBackend(
            backendId
          ).buildArrangement(candidates)
        }
      })
    })
    selectGeometryBackend(backendId)

    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-high-curvature-exact',
      x: 0,
      y: 0,
      width: 80,
      height: 80,
      ...toClosedCubicLoopVectorData(),
      closed: true,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 4,
          style: StrokeStyles.DASHED,
          position: StrokePositions.INSIDE,
          dashPattern: [20, 20],
          dashOffset: 0
        })
      ]
    })

    const constrainedPackets =
      graphic.__asyraSolidCenterStrokeExportPackets?.filter(
        (packet) => packet.debugMeta?.geometryFamily === 'constrained-dashed'
      ) ?? []

    expect(constrainedPackets.length).toBeGreaterThan(0)
    expect(
      constrainedPackets.every(
        (packet) =>
          packet.debugMeta?.sourceTopology === 'sampled-simple-closed' &&
          packet.debugMeta?.resolutionStatus === 'local-side-approximation' &&
          packet.debugMeta?.runtimeStatus === 'accepted' &&
          packet.debugMeta?.arrangementStatus === undefined
      )
    ).toBe(true)
    expect(buildArrangementCallCount).toBe(0)
    expect(graphic.__asyraConstrainedDashedRuntimeDiagnostics).toMatchObject({
      acceptedCount: 1,
      blockedCount: 0,
      entries: [
        {
          status: 'accepted',
          sourceTopology: 'sampled-simple-closed'
        }
      ]
    })
  })

  it('should run: keep high-curvature sampled-simple constrained dashed vectors local with the real Clipper2 arrangement backend', async () => {
    await selectClipper2TestBackend(
      'vector-constrained-dashed-high-curvature-clipper2-backend'
    )

    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-high-curvature-clipper2',
      x: 0,
      y: 0,
      width: 80,
      height: 80,
      ...toClosedCubicLoopVectorData(),
      closed: true,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 4,
          style: StrokeStyles.DASHED,
          position: StrokePositions.INSIDE,
          dashPattern: [20, 20],
          dashOffset: 0
        })
      ]
    })

    const constrainedPackets =
      graphic.__asyraSolidCenterStrokeExportPackets?.filter(
        (packet) => packet.debugMeta?.geometryFamily === 'constrained-dashed'
      ) ?? []

    expect(constrainedPackets.length).toBeGreaterThan(0)
    expect(
      constrainedPackets.every(
        (packet) =>
          packet.debugMeta?.sourceTopology === 'sampled-simple-closed' &&
          packet.debugMeta?.resolutionStatus === 'local-side-approximation' &&
          packet.debugMeta?.runtimeStatus === 'accepted' &&
          packet.debugMeta?.arrangementStatus === undefined &&
          packet.debugMeta?.arrangementFaceId === undefined
      )
    ).toBe(true)
    expect(
      constrainedPackets.every((packet) => packet.ownerSet.length > 0)
    ).toBe(true)
  })

  it('should run: keep high-curvature inside and outside local-side Clipper2 paths side-specific', async () => {
    await selectClipper2TestBackend(
      'vector-constrained-dashed-high-curvature-side-specific-clipper2-backend'
    )

    const render = (position: 'inside' | 'outside') =>
      runVectorRenderStrategy({
        id: `vector-constrained-dashed-high-curvature-side-specific-${position}`,
        x: 0,
        y: 0,
        width: 80,
        height: 80,
        ...toClosedCubicLoopVectorData(),
        closed: true,
        fills: [],
        strokes: [
          createDefaultStroke({
            width: 4,
            style: StrokeStyles.DASHED,
            position,
            dashPattern: [20, 20],
            dashOffset: 0
          })
        ]
      }).__asyraSolidCenterStrokeExportPackets ?? []

    const insidePackets = render(StrokePositions.INSIDE)
    const outsidePackets = render(StrokePositions.OUTSIDE)

    expect(insidePackets.length).toBeGreaterThan(0)
    expect(outsidePackets.length).toBeGreaterThan(0)
    expect(
      insidePackets.every(
        (packet) =>
          packet.debugMeta?.resolutionStatus === 'local-side-approximation' &&
          packet.debugMeta?.strokePosition === 'inside'
      )
    ).toBe(true)
    expect(
      outsidePackets.every(
        (packet) =>
          packet.debugMeta?.resolutionStatus === 'local-side-approximation' &&
          packet.debugMeta?.strokePosition === 'outside'
      )
    ).toBe(true)
    expect(buildPacketGeometrySignature(insidePackets)).not.toBe(
      buildPacketGeometrySignature(outsidePackets)
    )
  })
  ;[
    { label: 'inside', position: StrokePositions.INSIDE },
    { label: 'outside', position: StrokePositions.OUTSIDE }
  ].forEach(({ label, position }) => {
    it(`should run: render visible source-path constrained dashed geometry for the reported self-intersecting closed star repeated dashed ${label} stroke`, async () => {
      await selectClipper2TestBackend(
        `vector-constrained-dashed-reported-star-transition-${label}-clipper2-backend`
      )
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

      expect(
        graphic.__asyraSolidCenterStrokeExportPackets?.length
      ).toBeGreaterThan(1)
      expect(
        graphic.__asyraSolidCenterStrokeExportPackets?.[0]?.debugMeta
      ).toMatchObject({
        geometryFamily: 'dashed-center',
        resolutionStatus: 'native-center'
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

      expect(
        graphic.__asyraSolidCenterStrokeExportPackets?.some(
          (packet) => packet.debugMeta?.geometryFamily === 'constrained-dashed'
        )
      ).toBe(true)
      expect(
        graphic.__asyraSolidCenterStrokeExportPackets?.length
      ).toBeGreaterThan(0)
      expect(
        graphic.__asyraSolidCenterStrokeExportPackets?.every(
          (packet) =>
            packet.debugMeta?.geometryFamily === 'constrained-dashed' &&
            packet.debugMeta?.resolutionStatus === 'exact-constrained' &&
            packet.debugMeta?.runtimeStatus === 'accepted'
        )
      ).toBe(true)
      expect(graphic.__asyraConstrainedDashedRuntimeDiagnostics).toMatchObject({
        acceptedCount: 1,
        blockedCount: 0,
        entries: [
          {
            status: 'accepted',
            sourceTopology: 'self-intersecting'
          }
        ]
      })
    })
  })

  it('should run: render constrained dashed stroke packets from authored source-path intervals in the reported self-intersecting star', async () => {
    await selectClipper2TestBackend(
      'vector-constrained-dashed-reported-star-source-path-clipper2-backend'
    )
    const starData = toReportedClosedStarVectorData()
    const network = starData.networks['tn-14']
    expect(network).toBeDefined()
    const sourcePath = buildVectorGeometryModelPath(
      network,
      starData.points,
      starData.segments
    )
    const topology = buildPathTopologyModel({
      pathId: network.id,
      networkId: network.id,
      points: sourcePath.sampledPoints,
      closed: true
    })
    expect(topology.topologyFamily).toBe('self-intersecting')
    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-reported-star-source-path',
      x: 0,
      y: 0,
      width: 423.6353107755326,
      height: 458.34939129152076,
      ...starData,
      closed: true,
      fills: [],
      strokes: [
        createDefaultStroke({
          id: 'pp-312',
          width: 10,
          style: StrokeStyles.DASHED,
          position: StrokePositions.INSIDE,
          capType: 'round',
          dashPattern: [27, 20],
          dashOffset: 0,
          color: '#d51a1a'
        })
      ]
    })

    expect(getProjectionMeshes(graphic)).toHaveLength(0)
    expect(getProjectionGraphics(graphic).length).toBeGreaterThan(0)
    expect(getStrokeMeshCacheKinds(graphic)).toContain('masked-solid')
    expect(getStrokeMeshCacheKinds(graphic)).not.toContain('solid')

    const exportPackets = graphic.__asyraSolidCenterStrokeExportPackets ?? []
    expect(
      exportPackets.every(
        (packet) =>
          packet.debugMeta?.sourceTopology === 'self-intersecting' &&
          (packet.debugMeta?.finalCoverageBuilderStatus === 'debug-raw' ||
            packet.debugMeta?.finalCoverageBuilderStatus === 'product-final') &&
          typeof packet.debugMeta?.intervalId === 'string' &&
          packet.debugMeta.intervalId.startsWith('interval:') &&
          packet.intervalIds.every((intervalId) =>
            intervalId.startsWith('interval:')
          ) &&
          packet.sourceSpanIds.length > 0
      )
    ).toBe(true)
    const coveredSourceIntervalIds = new Set(
      exportPackets.flatMap((packet) => packet.intervalIds)
    )
    expect(coveredSourceIntervalIds.size).toBeGreaterThan(1)
  })

  it('should run: render visible source-path split-range constrained geometry for closed self-intersecting full-loop constrained dashed vectors', async () => {
    await selectClipper2TestBackend(
      'vector-constrained-dashed-self-intersecting-full-loop-clipper2-backend'
    )
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

    expect(
      getProjectionMeshes(graphic).length +
        getProjectionGraphics(graphic).length
    ).toBeGreaterThan(0)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.length
    ).toBeGreaterThan(0)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.every(
        (packet) =>
          packet.debugMeta?.geometryFamily === 'constrained-dashed' &&
          packet.debugMeta?.resolutionStatus === 'exact-constrained' &&
          packet.debugMeta?.runtimeStatus === 'accepted'
      )
    ).toBe(true)
    expect(graphic.hitArea).not.toBeNull()
    expect(graphic.__asyraConstrainedDashedRuntimeDiagnostics).toMatchObject({
      acceptedCount: 1,
      blockedCount: 0,
      entries: [
        {
          status: 'accepted',
          sourceTopology: 'self-intersecting'
        }
      ]
    })
  })

  it('should run: render visible source-path split-range constrained geometry for multiple closed self-intersecting full-loop constrained dashed strokes', async () => {
    await selectClipper2TestBackend(
      'vector-constrained-dashed-self-intersecting-multi-full-loop-clipper2-backend'
    )
    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-self-intersecting-multi',
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
        }),
        createDefaultStroke({
          width: 4,
          style: StrokeStyles.DASHED,
          position: StrokePositions.OUTSIDE,
          dashPattern: [400, 20],
          dashOffset: 0
        })
      ]
    })

    expect(
      getProjectionMeshes(graphic).length +
        getProjectionGraphics(graphic).length
    ).toBeGreaterThan(0)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.length
    ).toBeGreaterThan(0)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.every(
        (packet) =>
          packet.debugMeta?.geometryFamily === 'constrained-dashed' &&
          packet.debugMeta?.resolutionStatus === 'exact-constrained' &&
          packet.debugMeta?.runtimeStatus === 'accepted'
      )
    ).toBe(true)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.every(
        (packet) =>
          packet.polygons.length > 0 &&
          packet.intervalIds.every((intervalId) =>
            intervalId.startsWith('interval:')
          ) &&
          typeof packet.debugMeta?.intervalId === 'string' &&
          packet.debugMeta.intervalId.startsWith('interval:')
      )
    ).toBe(true)
    expect(graphic.__asyraConstrainedDashedRuntimeDiagnostics).toMatchObject({
      acceptedCount: 1,
      blockedCount: 0,
      entries: [
        {
          status: 'accepted',
          sourceTopology: 'self-intersecting'
        }
      ]
    })
  })

  it('should run: render visible source-path split-range constrained geometry for closed self-intersecting round-join full-loop constrained dashed vectors', async () => {
    await selectClipper2TestBackend(
      'vector-constrained-dashed-self-intersecting-round-full-loop-clipper2-backend'
    )
    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-self-intersecting-round',
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
          joinType: 'round',
          dashPattern: [400, 20],
          dashOffset: 0
        })
      ]
    })

    expect(
      getProjectionMeshes(graphic).length +
        getProjectionGraphics(graphic).length
    ).toBeGreaterThan(0)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.length
    ).toBeGreaterThan(0)
    expect(
      graphic.__asyraSolidCenterStrokeExportPackets?.every(
        (packet) =>
          packet.debugMeta?.geometryFamily === 'constrained-dashed' &&
          packet.debugMeta?.resolutionStatus === 'exact-constrained' &&
          packet.debugMeta?.runtimeStatus === 'accepted'
      )
    ).toBe(true)
    expect(graphic.__asyraConstrainedDashedRuntimeDiagnostics).toMatchObject({
      acceptedCount: 1,
      blockedCount: 0,
      entries: [
        {
          status: 'accepted',
          sourceTopology: 'self-intersecting'
        }
      ]
    })
  })

  it('should run: render closed self-intersecting inside constrained dashed vectors from source-path intervals', () => {
    const backendId =
      'vector-constrained-dashed-self-intersecting-exact-backend'
    registerGeometryBackend({
      backendId,
      load: () => createPassthroughArrangementBackend(backendId)
    })
    selectGeometryBackend(backendId)

    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-self-intersecting-exact',
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

    const exportPackets = graphic.__asyraSolidCenterStrokeExportPackets ?? []
    expect(exportPackets.length).toBeGreaterThan(0)
    expect(
      exportPackets.every(isSelfIntersectingInsideDashedSourcePathPacket)
    ).toBe(true)
    expect(graphic.__asyraConstrainedDashedRuntimeDiagnostics).toMatchObject({
      acceptedCount: 1,
      blockedCount: 0,
      entries: [
        {
          status: 'accepted',
          sourceTopology: 'self-intersecting'
        }
      ]
    })
  })

  it('should run: render closed self-intersecting inside constrained dashed vectors from source-path intervals when the real Clipper2 backend is selected', async () => {
    await selectClipper2TestBackend(
      'vector-constrained-dashed-self-intersecting-clipper2-backend'
    )

    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-self-intersecting-clipper2',
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

    const exportPackets = graphic.__asyraSolidCenterStrokeExportPackets ?? []
    expect(exportPackets.length).toBeGreaterThan(0)
    expect(
      exportPackets.every(isSelfIntersectingInsideDashedSourcePathPacket)
    ).toBe(true)
    expect(exportPackets.every((packet) => packet.ownerSet.length > 0)).toBe(
      true
    )
  })

  it('should run: keep self-intersecting inside and outside dashed source-path products side-specific', async () => {
    await selectClipper2TestBackend(
      'vector-constrained-dashed-self-intersecting-side-specific-clipper2-backend'
    )

    const render = (position: 'inside' | 'outside') =>
      runVectorRenderStrategy({
        id: `vector-constrained-dashed-self-intersecting-side-specific-${position}`,
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
            position,
            dashPattern: [400, 20],
            dashOffset: 0
          })
        ]
      }).__asyraSolidCenterStrokeExportPackets ?? []

    const insidePackets = render(StrokePositions.INSIDE)
    const outsidePackets = render(StrokePositions.OUTSIDE)

    expect(insidePackets.length).toBeGreaterThan(0)
    expect(outsidePackets.length).toBeGreaterThan(0)
    expect(
      insidePackets.every(isSelfIntersectingInsideDashedSourcePathPacket)
    ).toBe(true)
    expect(
      outsidePackets.every(isSelfIntersectingOutsideDashedSourcePathPacket)
    ).toBe(true)
    expect(buildPacketGeometrySignature(insidePackets)).not.toBe(
      buildPacketGeometrySignature(outsidePackets)
    )
  })

  it('should run: resolve multi-network constrained dashed vectors per typed network owner without global blocking', () => {
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

    const exportPackets = graphic.__asyraSolidCenterStrokeExportPackets ?? []
    expect(getProjectionMeshes(graphic).length).toBeGreaterThan(2)
    expect(exportPackets.length).toBeGreaterThan(2)
    expect(
      exportPackets.every(
        (packet) => packet.debugMeta?.geometryFamily === 'constrained-dashed'
      )
    ).toBe(true)
    expect(graphic.hitArea?.contains(-2, 20)).toBe(true)
    expect(graphic.hitArea?.contains(58, 20)).toBe(true)
    expect(graphic.hitArea?.contains(20, 20)).toBe(false)
    expect(graphic.__asyraConstrainedDashedRuntimeDiagnostics).toMatchObject({
      acceptedCount: 2,
      blockedCount: 0,
      sourceTopologies: ['rectangle-equivalent'],
      entries: [
        {
          sourceId: 'vector:vector-constrained-dashed-multi-network:network-a',
          networkId: 'network-a',
          status: 'accepted',
          reason: 'single-owner',
          sourceTopology: 'rectangle-equivalent',
          candidatePacketCount: expect.any(Number)
        },
        {
          sourceId: 'vector:vector-constrained-dashed-multi-network:network-b',
          networkId: 'network-b',
          status: 'accepted',
          reason: 'single-owner',
          sourceTopology: 'rectangle-equivalent',
          candidatePacketCount: expect.any(Number)
        }
      ]
    })
    expect(
      graphic.__asyraConstrainedDashedRuntimeDiagnostics?.entries.every(
        (entry) => entry.candidatePacketCount > 1
      )
    ).toBe(true)
    expect(
      graphic.__asyraConstrainedDashedRuntimeDiagnostics?.arrangementDiagnostics
        ?.candidates
    ).toHaveLength(16)
    expect(
      graphic.__asyraConstrainedDashedRuntimeDiagnostics?.arrangementDiagnostics
        ?.edges.length
    ).toBeGreaterThan(0)
  })

  it('should run: resolve overlapping multi-network constrained dashed vectors per typed network owner', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-overlapping-multi-network',
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
          width: 4,
          style: StrokeStyles.DASHED,
          position: StrokePositions.OUTSIDE,
          dashPattern: [400, 20],
          dashOffset: 0
        })
      ]
    })

    const exportPackets = graphic.__asyraSolidCenterStrokeExportPackets ?? []
    expect(getProjectionMeshes(graphic).length).toBeGreaterThan(2)
    expect(exportPackets.length).toBeGreaterThan(2)
    expect(
      exportPackets.every(
        (packet) => packet.debugMeta?.geometryFamily === 'constrained-dashed'
      )
    ).toBe(true)
    expect(graphic.hitArea?.contains(-2, 20)).toBe(true)
    expect(graphic.hitArea?.contains(102, 20)).toBe(true)
    expect(graphic.hitArea?.contains(50, 20)).toBe(false)
    expect(graphic.__asyraConstrainedDashedRuntimeDiagnostics).toMatchObject({
      acceptedCount: 2,
      blockedCount: 0,
      sourceTopologies: ['rectangle-equivalent'],
      entries: [
        {
          sourceId:
            'vector:vector-constrained-dashed-overlapping-multi-network:network-a',
          networkId: 'network-a',
          status: 'accepted',
          reason: 'single-owner',
          sourceTopology: 'rectangle-equivalent',
          candidatePacketCount: expect.any(Number)
        },
        {
          sourceId:
            'vector:vector-constrained-dashed-overlapping-multi-network:network-b',
          networkId: 'network-b',
          status: 'accepted',
          reason: 'single-owner',
          sourceTopology: 'rectangle-equivalent',
          candidatePacketCount: expect.any(Number)
        }
      ]
    })
    expect(
      graphic.__asyraConstrainedDashedRuntimeDiagnostics?.entries.every(
        (entry) => entry.candidatePacketCount > 1
      )
    ).toBe(true)
    expect(
      graphic.__asyraConstrainedDashedRuntimeDiagnostics?.arrangementDiagnostics
        ?.candidates
    ).toHaveLength(16)
    expect(
      graphic.__asyraConstrainedDashedRuntimeDiagnostics?.arrangementDiagnostics
        ?.components.length
    ).toBeGreaterThan(0)
    expect(
      graphic.__asyraConstrainedDashedRuntimeDiagnostics?.arrangementDiagnostics
        ?.edges.length
    ).toBeGreaterThan(0)
  })

  it('should run: preserve multi-network constrained dashed ownerSet through exact arrangement', () => {
    const backendId = 'vector-constrained-dashed-multi-network-merge-backend'
    registerGeometryBackend({
      backendId,
      load: () => createMergeAllArrangementBackend(backendId)
    })
    selectGeometryBackend(backendId)

    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-exact-multi-network-owner-set',
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
          width: 4,
          style: StrokeStyles.DASHED,
          position: StrokePositions.OUTSIDE,
          dashPattern: [400, 20],
          dashOffset: 0
        })
      ]
    })

    const exportPackets = graphic.__asyraSolidCenterStrokeExportPackets ?? []
    expect(
      exportPackets.every(
        (packet) =>
          packet.debugMeta?.geometryFamily === 'constrained-dashed' &&
          packet.debugMeta.resolutionStatus === 'exact-constrained' &&
          packet.debugMeta.runtimeStatus === 'accepted' &&
          packet.debugMeta.arrangementStatus === 'exact' &&
          typeof packet.debugMeta.arrangementFaceId === 'string'
      )
    ).toBe(true)
    expect(
      exportPackets.some(
        (packet) => (packet.debugMeta?.arrangementCandidateIds?.length ?? 0) > 1
      )
    ).toBe(true)
    expect(exportPackets).toHaveLength(1)
    expect(
      Array.from(
        new Set(
          exportPackets.flatMap((packet) =>
            packet.ownerSet.map((owner) => owner.networkId)
          )
        )
      ).sort()
    ).toEqual(['network-a', 'network-b'])
    expect(
      exportPackets.some((packet) => packet.sourceSpanIds.length > 1)
    ).toBe(true)
    expect(graphic.__asyraConstrainedDashedRuntimeDiagnostics).toMatchObject({
      acceptedCount: 2,
      blockedCount: 0
    })
  })

  it('should run: allow debug inspection to bypass same-visual visual overlap collapse', () => {
    const backendId = 'vector-stroke-debug-disable-overlap-collapse-backend'
    registerGeometryBackend({
      backendId,
      load: () => createPassthroughArrangementBackend(backendId)
    })
    selectGeometryBackend(backendId)

    const vectorData = {
      id: 'vector-debug-disable-visual-overlap-collapse',
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
          width: 4,
          style: StrokeStyles.SOLID,
          position: StrokePositions.CENTER
        })
      ]
    }

    const productGraphic = runVectorRenderStrategy(vectorData)
    const debugGraphic = runVectorRenderStrategy({
      ...vectorData,
      strokeDebugOptions: {
        disableVisualOverlapCollapse: true
      }
    })

    const productPackets =
      productGraphic.__asyraSolidCenterStrokeExportPackets ?? []
    const debugPackets =
      debugGraphic.__asyraSolidCenterStrokeExportPackets ?? []

    expect(productPackets).toHaveLength(1)
    expect(productPackets[0]?.debugMeta).toMatchObject({
      visualOverlapCollapseStatus: 'exact-union'
    })
    expect(debugPackets.length).toBeGreaterThan(productPackets.length)
    expect(
      debugPackets.every(
        (packet) => packet.debugMeta?.visualOverlapCollapseStatus === undefined
      )
    ).toBe(true)
  })

  it('should run: allow global stroke debug toggle to bypass same-visual visual overlap collapse', () => {
    const backendId =
      'vector-stroke-global-debug-disable-overlap-collapse-backend'
    registerGeometryBackend({
      backendId,
      load: () => createPassthroughArrangementBackend(backendId)
    })
    selectGeometryBackend(backendId)

    const vectorData = {
      id: 'vector-global-debug-disable-visual-overlap-collapse',
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
          width: 4,
          style: StrokeStyles.SOLID,
          position: StrokePositions.CENTER
        })
      ]
    }

    const productGraphic = runVectorRenderStrategy(vectorData)
    core.setSystemProperty('strokeDebugDisableVisualOverlapCollapse', true)
    const debugGraphic = runVectorRenderStrategy(vectorData)

    const productPackets =
      productGraphic.__asyraSolidCenterStrokeExportPackets ?? []
    const debugPackets =
      debugGraphic.__asyraSolidCenterStrokeExportPackets ?? []

    expect(productPackets).toHaveLength(1)
    expect(productPackets[0]?.debugMeta).toMatchObject({
      visualOverlapCollapseStatus: 'exact-union'
    })
    expect(debugPackets.length).toBeGreaterThan(productPackets.length)
    expect(
      debugPackets.every(
        (packet) => packet.debugMeta?.visualOverlapCollapseStatus === undefined
      )
    ).toBe(true)
  })

  it('should run: render compound-hole constrained dashed vectors with legal-domain side inversion', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-compound-hole',
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
          style: StrokeStyles.DASHED,
          position: StrokePositions.INSIDE,
          dashPattern: [400, 20],
          dashOffset: 0
        })
      ]
    })

    const exportPackets = graphic.__asyraSolidCenterStrokeExportPackets ?? []
    expect(getProjectionMeshes(graphic).length).toBeGreaterThan(2)
    expect(exportPackets.length).toBeGreaterThan(2)
    expect(
      new Set(exportPackets.map((packet) => packet.debugMeta?.legalDomainId))
    ).toEqual(
      new Set([
        'vector:vector-constrained-dashed-compound-hole:compound-legal-domain:0'
      ])
    )
    expect(graphic.hitArea?.contains(2, 2)).toBe(true)
    expect(graphic.hitArea?.contains(23, 50)).toBe(true)
    expect(graphic.hitArea?.contains(50, 50)).toBe(false)
    expect(graphic.__asyraConstrainedDashedRuntimeDiagnostics).toMatchObject({
      acceptedCount: 2,
      blockedCount: 0,
      entries: [
        {
          networkId: 'hole',
          status: 'accepted',
          reason: 'single-owner',
          candidatePacketCount: expect.any(Number)
        },
        {
          networkId: 'outer',
          status: 'accepted',
          reason: 'single-owner',
          candidatePacketCount: expect.any(Number)
        }
      ]
    })
    expect(
      graphic.__asyraConstrainedDashedRuntimeDiagnostics?.entries.every(
        (entry) => entry.candidatePacketCount > 1
      )
    ).toBe(true)
    expect(
      graphic.__asyraConstrainedDashedRuntimeDiagnostics?.arrangementDiagnostics
        ?.candidates
    ).toHaveLength(16)
    expect(
      graphic.__asyraConstrainedDashedRuntimeDiagnostics?.arrangementDiagnostics
        ?.components.length
    ).toBeGreaterThan(0)
  })

  it('should run: keep overlapping compound holes out of shared compound legal-domain support without a boolean backend', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-overlapping-holes',
      x: 0,
      y: 0,
      width: 240,
      height: 160,
      ...toMultiNetworkVectorData([
        {
          networkId: 'outer',
          closed: true,
          anchors: [
            { id: 'outer-0', x: 0, y: 0 },
            { id: 'outer-1', x: 240, y: 0 },
            { id: 'outer-2', x: 240, y: 160 },
            { id: 'outer-3', x: 0, y: 160 }
          ]
        },
        {
          networkId: 'left-hole',
          closed: true,
          anchors: [
            { id: 'left-hole-0', x: 45, y: 45 },
            { id: 'left-hole-1', x: 135, y: 45 },
            { id: 'left-hole-2', x: 135, y: 115 },
            { id: 'left-hole-3', x: 45, y: 115 }
          ]
        },
        {
          networkId: 'right-hole',
          closed: true,
          anchors: [
            { id: 'right-hole-0', x: 95, y: 45 },
            { id: 'right-hole-1', x: 185, y: 45 },
            { id: 'right-hole-2', x: 185, y: 115 },
            { id: 'right-hole-3', x: 95, y: 115 }
          ]
        }
      ]),
      closed: true,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 10,
          style: StrokeStyles.DASHED,
          position: StrokePositions.INSIDE,
          dashPattern: [4000, 20],
          dashOffset: 0
        })
      ]
    })

    const exportPackets = graphic.__asyraSolidCenterStrokeExportPackets ?? []
    expect(exportPackets.length).toBeGreaterThan(0)
    expect(
      exportPackets.some(
        (packet) =>
          packet.debugMeta?.legalDomainId ===
          'vector:vector-constrained-dashed-overlapping-holes:compound-legal-domain:0'
      )
    ).toBe(false)
    expect(
      new Set(exportPackets.map((packet) => packet.debugMeta?.networkId))
    ).toEqual(new Set(['left-hole', 'outer', 'right-hole']))
    expect(graphic.__asyraConstrainedDashedRuntimeDiagnostics).toMatchObject({
      acceptedCount: 3,
      blockedCount: 0
    })
  })

  it('should run: place overlapping compound-hole dashes on normalized legal-domain boundaries when boolean backend exists', () => {
    const backendId = 'vector-constrained-dashed-compound-boolean-backend'
    registerGeometryBackend({
      backendId,
      load: () => createNormalizedCompoundHoleBackend(backendId)
    })
    selectGeometryBackend(backendId)

    const graphic = runVectorRenderStrategy({
      id: 'vector-constrained-dashed-overlapping-holes-exact',
      x: 0,
      y: 0,
      width: 240,
      height: 160,
      ...toMultiNetworkVectorData([
        {
          networkId: 'outer',
          closed: true,
          anchors: [
            { id: 'outer-0', x: 0, y: 0 },
            { id: 'outer-1', x: 240, y: 0 },
            { id: 'outer-2', x: 240, y: 160 },
            { id: 'outer-3', x: 0, y: 160 }
          ]
        },
        {
          networkId: 'left-hole',
          closed: true,
          anchors: [
            { id: 'left-hole-0', x: 45, y: 45 },
            { id: 'left-hole-1', x: 135, y: 45 },
            { id: 'left-hole-2', x: 135, y: 115 },
            { id: 'left-hole-3', x: 45, y: 115 }
          ]
        },
        {
          networkId: 'right-hole',
          closed: true,
          anchors: [
            { id: 'right-hole-0', x: 95, y: 45 },
            { id: 'right-hole-1', x: 185, y: 45 },
            { id: 'right-hole-2', x: 185, y: 115 },
            { id: 'right-hole-3', x: 95, y: 115 }
          ]
        }
      ]),
      closed: true,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 10,
          style: StrokeStyles.DASHED,
          position: StrokePositions.INSIDE,
          dashPattern: [4000, 20],
          dashOffset: 0
        })
      ]
    })

    const exportPackets = graphic.__asyraSolidCenterStrokeExportPackets ?? []
    expect(exportPackets.length).toBeGreaterThan(2)
    expect(
      new Set(exportPackets.map((packet) => packet.debugMeta?.legalDomainId))
    ).toEqual(
      new Set([
        'vector:vector-constrained-dashed-overlapping-holes-exact:compound-legal-domain:0'
      ])
    )
    expect(
      new Set(exportPackets.map((packet) => packet.debugMeta?.networkId))
    ).toEqual(
      new Set([
        'vector:vector-constrained-dashed-overlapping-holes-exact:compound-legal-domain:0:normalized-boundary:0:0',
        'vector:vector-constrained-dashed-overlapping-holes-exact:compound-legal-domain:0:normalized-boundary:0:1'
      ])
    )
    expect(
      exportPackets.every(
        (packet) =>
          packet.sourceContourIds.includes(
            'vector:vector-constrained-dashed-overlapping-holes-exact:outer:contour:0'
          ) &&
          packet.sourceContourIds.includes(
            'vector:vector-constrained-dashed-overlapping-holes-exact:left-hole:contour:0'
          ) &&
          packet.sourceContourIds.includes(
            'vector:vector-constrained-dashed-overlapping-holes-exact:right-hole:contour:0'
          )
      )
    ).toBe(true)
    expect(exportPackets.every((packet) => packet.ownerSet.length === 3)).toBe(
      true
    )
    expect(graphic.__asyraConstrainedDashedRuntimeDiagnostics).toMatchObject({
      acceptedCount: 1,
      blockedCount: 0
    })
  })

  it('should run: shape-generated and vector-generated closed rectangle-equivalent full-loop constrained dashed packets stay equivalent on the supported source-equivalence topology family path', () => {
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
      packets: SolidCenterStrokeExportPacket[] | undefined
    ) =>
      (packets ?? []).map((packet) => ({
        intervalId: packet.debugMeta?.intervalId,
        strokeId: packet.debugMeta?.strokeId,
        geometryFamily: packet.debugMeta?.geometryFamily,
        polygonCount: packet.polygons.length,
        bounds: packet.bounds
      }))

    expect(
      serializePackets(rectGraphic.__asyraSolidCenterStrokeExportPackets)
    ).toEqual(
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
      serializePackets(
        vectorOutsideGraphic.__asyraSolidCenterStrokeExportPackets
      )
    )
  })

  it('should run: shape-generated and vector-generated rectangle-equivalent single-edge constrained dashed packets stay equivalent on the first single-edge topology family and source-equivalence topology family crossover path', () => {
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
      packets: SolidCenterStrokeExportPacket[] | undefined
    ) =>
      (packets ?? []).map((packet) => ({
        intervalId: packet.debugMeta?.intervalId,
        strokeId: packet.debugMeta?.strokeId,
        geometryFamily: packet.debugMeta?.geometryFamily,
        polygonCount: packet.polygons.length,
        bounds: packet.bounds
      }))

    expect(
      serializePackets(rectGraphic.__asyraSolidCenterStrokeExportPackets)
    ).toEqual(
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
      serializePackets(
        vectorOutsideGraphic.__asyraSolidCenterStrokeExportPackets
      )
    )
  })

  it('should run: shape-generated and vector-generated rectangle-equivalent round-join full-loop constrained dashed packets stay equivalent on the first supported join/cap source-equivalence topology family path', () => {
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
      packets: SolidCenterStrokeExportPacket[] | undefined
    ) =>
      (packets ?? []).map((packet) => ({
        intervalId: packet.debugMeta?.intervalId,
        strokeId: packet.debugMeta?.strokeId,
        geometryFamily: packet.debugMeta?.geometryFamily,
        polygonCount: packet.polygons.length,
        bounds: packet.bounds
      }))

    expect(
      serializePackets(rectGraphic.__asyraSolidCenterStrokeExportPackets)
    ).toEqual(
      serializePackets(vectorGraphic.__asyraSolidCenterStrokeExportPackets)
    )
  })

  it('should run: shape-generated and vector-generated rectangle-equivalent outside round-join full-loop constrained dashed packets stay equivalent on the next supported join/cap source-equivalence topology family path', () => {
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
      packets: SolidCenterStrokeExportPacket[] | undefined
    ) =>
      (packets ?? []).map((packet) => ({
        intervalId: packet.debugMeta?.intervalId,
        strokeId: packet.debugMeta?.strokeId,
        geometryFamily: packet.debugMeta?.geometryFamily,
        polygonCount: packet.polygons.length,
        bounds: packet.bounds
      }))

    expect(
      serializePackets(rectGraphic.__asyraSolidCenterStrokeExportPackets)
    ).toEqual(
      serializePackets(vectorGraphic.__asyraSolidCenterStrokeExportPackets)
    )
  })

  it('should run: shape-generated and vector-generated rectangle-equivalent round-cap single-edge constrained dashed packets stay equivalent on the next supported join/cap source-equivalence topology family path', () => {
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
      packets: SolidCenterStrokeExportPacket[] | undefined
    ) =>
      (packets ?? []).map((packet) => ({
        intervalId: packet.debugMeta?.intervalId,
        strokeId: packet.debugMeta?.strokeId,
        geometryFamily: packet.debugMeta?.geometryFamily,
        polygonCount: packet.polygons.length,
        bounds: packet.bounds
      }))

    expect(
      serializePackets(rectGraphic.__asyraSolidCenterStrokeExportPackets)
    ).toEqual(
      serializePackets(vectorGraphic.__asyraSolidCenterStrokeExportPackets)
    )
  })

  it('should run: shape-generated and vector-generated rectangle-equivalent outside round-cap single-edge constrained dashed packets stay equivalent on the next supported join/cap source-equivalence topology family path', () => {
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
      packets: SolidCenterStrokeExportPacket[] | undefined
    ) =>
      (packets ?? []).map((packet) => ({
        intervalId: packet.debugMeta?.intervalId,
        strokeId: packet.debugMeta?.strokeId,
        geometryFamily: packet.debugMeta?.geometryFamily,
        polygonCount: packet.polygons.length,
        bounds: packet.bounds
      }))

    expect(
      serializePackets(rectGraphic.__asyraSolidCenterStrokeExportPackets)
    ).toEqual(
      serializePackets(vectorGraphic.__asyraSolidCenterStrokeExportPackets)
    )
  })

  it('should run: shape-generated and vector-generated rectangle-equivalent gradient full-loop constrained dashed packets stay equivalent on the first supported paint source-equivalence topology family path', () => {
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
      packets: SolidCenterStrokeExportPacket[] | undefined
    ) =>
      (packets ?? []).map((packet) => ({
        intervalId: packet.debugMeta?.intervalId,
        strokeId: packet.debugMeta?.strokeId,
        geometryFamily: packet.debugMeta?.geometryFamily,
        polygonCount: packet.polygons.length,
        bounds: packet.bounds
      }))

    expect(getProjectionMeshes(rectGraphic)).toHaveLength(0)
    expect(getProjectionMeshes(vectorGraphic)).toHaveLength(0)
    expect(getProjectionGraphics(rectGraphic).length).toBeGreaterThan(1)
    expect(getProjectionGraphics(vectorGraphic).length).toBeGreaterThan(1)
    expect(
      serializePackets(rectGraphic.__asyraSolidCenterStrokeExportPackets)
    ).toEqual(
      serializePackets(vectorGraphic.__asyraSolidCenterStrokeExportPackets)
    )
  })
})
