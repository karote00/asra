import type { StrokeAttrs } from '@asyra/utils'
import type { RenderFillStyle } from '@asyra/core'
import {
  buildSolidCenterStrokePolygons,
  supportsSolidCenterStroke
} from './solid-center-stroke-geometry'
import { getRenderableStrokes } from './renderable-stroke'

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
}

export interface SolidCenterStrokeExportPacket {
  geometryId: string
  polygons: Vec2[][]
  bounds: Bounds
}

export interface SolidCenterStrokeResolvedPacket {
  geometry: SolidCenterStrokeGeometryPacket
  paint: SolidCenterStrokePaintPacket
}

export interface SolidCenterStrokeGeometryDebugMeta {
  strokeId?: string
  intervalId?: string
  authoredVisibleIntervalIndex?: number
  startDistance?: number
  endDistance?: number
  wrapsSeam?: boolean
  previousVisibleIntervalId?: string | null
  nextVisibleIntervalId?: string | null
}

export interface SolidCenterStrokeRuntimeGraphic {
  __asyraSolidCenterStrokeExportPackets?: SolidCenterStrokeExportPacket[]
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
  strokes: StrokeAttrs[] | undefined
): SolidCenterStrokeResolvedPacket[] =>
  getRenderableStrokes(strokes).flatMap((stroke, index) => {
    if (!supportsSolidCenterStroke(stroke)) {
      return []
    }

    const polygons = buildSolidCenterStrokePolygons(points, closed, stroke)
    if (polygons.length === 0) {
      return []
    }

    const geometryId = `${cachePrefix}:${index}`

    return [
      {
        geometry: {
          geometryId,
          polygons,
          bounds: getBounds(polygons)
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

export const buildSolidCenterStrokeHitTestPackets = (
  packets: SolidCenterStrokeResolvedPacket[]
): SolidCenterStrokeHitTestPacket[] =>
  packets.map((packet) => ({
    geometryId: packet.geometry.geometryId,
    polygons: packet.geometry.polygons,
    bounds: packet.geometry.bounds
  }))

export const buildSolidCenterStrokeExportPackets = (
  packets: SolidCenterStrokeResolvedPacket[]
): SolidCenterStrokeExportPacket[] =>
  packets.map((packet) => ({
    geometryId: packet.geometry.geometryId,
    polygons: packet.geometry.polygons,
    bounds: packet.geometry.bounds
  }))

export const toSolidCenterStrokeRenderEntries = (
  packets: SolidCenterStrokeResolvedPacket[]
) =>
  packets.map((packet) => ({
    cacheKey: packet.geometry.geometryId,
    stroke: {
      kind: packet.paint.kind,
      color: packet.paint.color,
      alpha: packet.paint.alpha,
      gradientStyle: packet.paint.gradientStyle ?? null,
      paintKey: packet.paint.paintKey ?? `solid:${packet.paint.color}:${packet.paint.alpha}`
    },
    polygons: packet.geometry.polygons
  }))

export const applySolidCenterStrokeExportPackets = <T extends object>(
  graphic: T,
  packets: SolidCenterStrokeResolvedPacket[]
) => {
  ;(graphic as T & SolidCenterStrokeRuntimeGraphic).__asyraSolidCenterStrokeExportPackets =
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
