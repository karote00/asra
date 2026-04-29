import type { StrokeAttrs } from '@asyra/utils'
import type { RenderFillStyle } from '@asyra/core'
import {
  buildStrokeRuntimeRevisionSet,
  updateStrokeRuntimeRevisionSetFromMetadata,
  type StrokeRevisionSet
} from './stroke-dirty-keys'
import {
  buildSolidCenterStrokePolygons,
  supportsSolidCenterStroke
} from './solid-center-stroke-geometry'
import { getRenderableStrokes } from './renderable-stroke'
import {
  buildPathTopologyModel,
  type PathTopologyModel
} from './path-topology-model'

interface Vec2 {
  x: number
  y: number
}

interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface SolidCenterStrokeGeometryPacket {
  geometryId: string
  polygons: Vec2[][]
  bounds: Bounds
  debugMeta?: SolidCenterStrokeGeometryDebugMeta
}

export interface SolidCenterStrokePaintPacket {
  geometryId: string
  kind?: 'solid' | 'gradient'
  color: number
  alpha: number
  gradientStyle?: RenderFillStyle | null
  paintKey?: string
}

export interface SolidCenterStrokeHitTestPacket {
  geometryId: string
  polygons: Vec2[][]
  bounds: Bounds
  debugMeta?: SolidCenterStrokeGeometryDebugMeta
}

export interface SolidCenterStrokeExportPacket {
  geometryId: string
  polygons: Vec2[][]
  bounds: Bounds
  debugMeta?: SolidCenterStrokeGeometryDebugMeta
}

export interface SolidCenterStrokeResolvedPacket {
  geometry: SolidCenterStrokeGeometryPacket
  paint: SolidCenterStrokePaintPacket
}

export type StrokeGeometryFamily =
  | 'solid-center'
  | 'dashed-center'
  | 'constrained-solid'
  | 'constrained-dashed'

export type StrokeGeometryResolutionStatus =
  | 'native-center'
  | 'local-side-approximation'
  | 'exact-constrained'

export type StrokeGeometryRuntimeStatus =
  | 'candidate'
  | 'accepted'
  | 'blocked'
  | 'not-applicable'

export type StrokeGeometryRuntimeReason =
  | 'center-stroke'
  | 'constrained-solid-exact'
  | 'single-owner'
  | 'typed-owners'
  | 'missing-owner-metadata'
  | 'no-packets'
  | 'no-candidate-packets'
  | 'unsupported-open-topology'
  | 'unsupported-overlap-ownership'
  | 'unsupported-topology'

export type StrokeGeometrySourceTopology =
  | 'rectangle-equivalent'
  | 'broader-simple-closed'
  | 'sampled-simple-closed'
  | 'self-intersecting'
  | 'degenerate'
  | 'open'

export type StrokeGeometryIntervalTopology =
  | 'full-loop'
  | 'single-edge'
  | 'corner-spanning'
  | 'seam-wrapping'
  | 'multi-corner'
  | 'other'

export type StrokeGeometryOwnershipStatus = 'accepted' | 'blocked'

export interface SolidCenterStrokeGeometryDebugMeta {
  sourcePathId?: string
  ownerKey?: string
  networkId?: string
  strokeId?: string
  strokeIndex?: number
  contourId?: string
  legalDomainId?: string | null
  intervalId?: string
  authoredVisibleIntervalIndex?: number
  startDistance?: number
  endDistance?: number
  wrapsSeam?: boolean
  previousVisibleIntervalId?: string | null
  nextVisibleIntervalId?: string | null
  geometryFamily?: StrokeGeometryFamily
  resolutionStatus?: StrokeGeometryResolutionStatus
  runtimeStatus?: StrokeGeometryRuntimeStatus
  runtimeReason?: StrokeGeometryRuntimeReason
  sourceTopology?: StrokeGeometrySourceTopology
  topologyFamily?: PathTopologyModel['topologyFamily']
  intervalTopology?: StrokeGeometryIntervalTopology
  ownershipStatus?: StrokeGeometryOwnershipStatus
  ownerCount?: number
  revisionSet?: StrokeRevisionSet
}

export interface SolidCenterStrokeRuntimeGraphic {
  __asyraSolidCenterStrokeExportPackets?: SolidCenterStrokeExportPacket[]
}

interface SolidCenterStrokePacketOptions {
  metadata?: {
    ownerKeyPrefix?: string
    networkId?: string
  }
  topology?: PathTopologyModel
}

const mapCenterTopologyToSourceTopology = (
  topology: PathTopologyModel
): StrokeGeometrySourceTopology => {
  if (topology.topologyFamily === 'open') {
    return 'open'
  }
  if (topology.topologyFamily === 'self-intersecting') {
    return 'self-intersecting'
  }
  if (topology.topologyFamily === 'degenerate') {
    return 'degenerate'
  }
  return 'sampled-simple-closed'
}

const getBounds = (polygons: Vec2[][]): Bounds => {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  polygons.forEach((polygon) =>
    polygon.forEach((point) => {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    })
  )

  return { minX, minY, maxX, maxY }
}

export const hasSolidCenterStrokeIntent = (
  strokes: StrokeAttrs[] | undefined
) =>
  strokes?.some(
    (stroke) =>
      stroke.visible !== false &&
      stroke.style === 'solid' &&
      stroke.position === 'center' &&
      stroke.width > 0
  ) === true

const roundGeometryCoordinate = (value: number) =>
  Math.round(value * 1_000_000) / 1_000_000

const buildPolygonSignature = (polygon: Vec2[]) => {
  const points = polygon.map(
    (point) =>
      `${roundGeometryCoordinate(point.x)},${roundGeometryCoordinate(point.y)}`
  )
  const rotations = points.map((_, index) => [
    ...points.slice(index),
    ...points.slice(0, index)
  ])
  const reversedPoints = [...points].reverse()
  const reversedRotations = reversedPoints.map((_, index) => [
    ...reversedPoints.slice(index),
    ...reversedPoints.slice(0, index)
  ])

  return [...rotations, ...reversedRotations]
    .map((rotation) => rotation.join('|'))
    .sort((left, right) => left.localeCompare(right))[0]
}

const normalizePacketPolygons = (polygons: Vec2[][]) => {
  const seen = new Set<string>()
  const normalized: Vec2[][] = []
  let changed = false

  polygons.forEach((polygon) => {
    if (polygon.length < 3) {
      changed = true
      return
    }

    const signature = buildPolygonSignature(polygon)
    if (seen.has(signature)) {
      changed = true
      return
    }

    seen.add(signature)
    normalized.push(polygon)
  })

  return changed ? normalized : polygons
}

const normalizedResolvedPacketCache = new WeakMap<
  SolidCenterStrokeResolvedPacket[],
  SolidCenterStrokeResolvedPacket[]
>()

export const normalizeResolvedStrokePacketGeometry = (
  packets: SolidCenterStrokeResolvedPacket[]
): SolidCenterStrokeResolvedPacket[] => {
  const cached = normalizedResolvedPacketCache.get(packets)
  if (cached) {
    return cached
  }

  const normalizedPackets = packets.map((packet) => {
    const polygons = normalizePacketPolygons(packet.geometry.polygons)
    if (polygons === packet.geometry.polygons) {
      return packet
    }

    return {
      ...packet,
      geometry: {
        ...packet.geometry,
        polygons,
        bounds: getBounds(polygons)
      }
    }
  })
  normalizedResolvedPacketCache.set(packets, normalizedPackets)
  return normalizedPackets
}

const isPointInsidePolygon = (point: Vec2, polygon: Vec2[]) => {
  let inside = false

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x
    const yi = polygon[i].y
    const xj = polygon[j].x
    const yj = polygon[j].y

    const intersects =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi

    if (intersects) {
      inside = !inside
    }
  }

  return inside
}

export const buildSolidCenterStrokeResolvedPackets = (
  cachePrefix: string,
  points: Vec2[],
  closed: boolean,
  strokes: StrokeAttrs[] | undefined,
  options: SolidCenterStrokePacketOptions = {}
): SolidCenterStrokeResolvedPacket[] => {
  const topology =
    options.topology ??
    buildPathTopologyModel({
      pathId: cachePrefix,
      networkId: options.metadata?.networkId,
      points,
      closed
    })
  const topologyPoints = topology.normalizedPoints
  const sourceTopology = mapCenterTopologyToSourceTopology(topology)

  return getRenderableStrokes(strokes).flatMap((stroke, index) => {
    if (!supportsSolidCenterStroke(stroke)) {
      return []
    }

    const polygons = buildSolidCenterStrokePolygons(
      topologyPoints,
      topology.closed,
      stroke
    )
    if (polygons.length === 0) {
      return []
    }

    const geometryId = `${cachePrefix}:${index}`

    return [
      {
        geometry: {
          geometryId,
          polygons,
          bounds: getBounds(polygons),
          debugMeta: {
            sourcePathId: cachePrefix,
            ownerKey: options.metadata?.ownerKeyPrefix
              ? `${options.metadata.ownerKeyPrefix}:stroke:${index}`
              : undefined,
            networkId: options.metadata?.networkId,
            strokeId: `stroke:${index}`,
            strokeIndex: index,
            geometryFamily: 'solid-center',
            resolutionStatus: 'native-center',
            runtimeStatus: 'not-applicable',
            runtimeReason: 'center-stroke',
            sourceTopology,
            topologyFamily: topology.topologyFamily,
            revisionSet: buildStrokeRuntimeRevisionSet({
              points: topologyPoints,
              closed: topology.closed,
              stroke,
              geometryFamily: 'solid-center',
              resolutionStatus: 'native-center',
              runtimeStatus: 'not-applicable',
              runtimeReason: 'center-stroke',
              sourceTopology,
              ownerKey: options.metadata?.ownerKeyPrefix
                ? `${options.metadata.ownerKeyPrefix}:stroke:${index}`
                : undefined,
              networkId: options.metadata?.networkId,
              strokeId: `stroke:${index}`
            })
          }
        },
        paint: {
          geometryId,
          kind: stroke.kind,
          color: stroke.color,
          alpha: stroke.alpha,
          gradientStyle: stroke.gradientStyle,
          paintKey: stroke.paintKey
        }
      }
    ]
  })
}

export const attachStrokePacketDebugMeta = (
  packets: SolidCenterStrokeResolvedPacket[],
  debugMeta: Partial<SolidCenterStrokeGeometryDebugMeta>
): SolidCenterStrokeResolvedPacket[] =>
  packets.map((packet) => ({
    geometry: (() => {
      const mergedDebugMeta = {
        ...packet.geometry.debugMeta,
        ...debugMeta
      }

      return {
        ...packet.geometry,
        debugMeta: {
          ...mergedDebugMeta,
          revisionSet:
            Object.keys(debugMeta).length === 0
              ? packet.geometry.debugMeta?.revisionSet
              : updateStrokeRuntimeRevisionSetFromMetadata(
                  packet.geometry.debugMeta?.revisionSet,
                  mergedDebugMeta
                )
        }
      }
    })(),
    paint: packet.paint
  }))

export const buildSolidCenterStrokeHitTestPackets = (
  packets: SolidCenterStrokeResolvedPacket[]
): SolidCenterStrokeHitTestPacket[] =>
  normalizeResolvedStrokePacketGeometry(packets).map((packet) => ({
    geometryId: packet.geometry.geometryId,
    polygons: packet.geometry.polygons,
    bounds: packet.geometry.bounds,
    debugMeta: packet.geometry.debugMeta
  }))

export const buildSolidCenterStrokeExportPackets = (
  packets: SolidCenterStrokeResolvedPacket[]
): SolidCenterStrokeExportPacket[] =>
  normalizeResolvedStrokePacketGeometry(packets).map((packet) => ({
    geometryId: packet.geometry.geometryId,
    polygons: packet.geometry.polygons,
    bounds: packet.geometry.bounds,
    debugMeta: packet.geometry.debugMeta
  }))

export const toSolidCenterStrokeRenderEntries = (
  packets: SolidCenterStrokeResolvedPacket[]
) =>
  normalizeResolvedStrokePacketGeometry(packets).map((packet) => ({
    cacheKey: packet.geometry.geometryId,
    stroke: {
      kind: packet.paint.kind,
      color: packet.paint.color,
      alpha: packet.paint.alpha,
      gradientStyle: packet.paint.gradientStyle ?? null,
      paintKey:
        packet.paint.paintKey ??
        `solid:${packet.paint.color}:${packet.paint.alpha}`
    },
    polygons: packet.geometry.polygons,
    debugMeta: packet.geometry.debugMeta,
    revisionSet: packet.geometry.debugMeta?.revisionSet
  }))

export const applySolidCenterStrokeExportPackets = <T extends object>(
  graphic: T,
  packets: SolidCenterStrokeResolvedPacket[]
) => {
  ;(
    graphic as T & SolidCenterStrokeRuntimeGraphic
  ).__asyraSolidCenterStrokeExportPackets =
    buildSolidCenterStrokeExportPackets(packets)
}

export const createSolidCenterStrokeHitArea = (
  packets: SolidCenterStrokeResolvedPacket[]
) => {
  const hitPackets = buildSolidCenterStrokeHitTestPackets(packets)
  if (hitPackets.length === 0) {
    return null
  }

  return {
    contains: (x: number, y: number) =>
      hitPackets.some((packet) => {
        if (
          x < packet.bounds.minX ||
          x > packet.bounds.maxX ||
          y < packet.bounds.minY ||
          y > packet.bounds.maxY
        ) {
          return false
        }

        return packet.polygons.some((polygon) =>
          isPointInsidePolygon({ x, y }, polygon)
        )
      })
  }
}
