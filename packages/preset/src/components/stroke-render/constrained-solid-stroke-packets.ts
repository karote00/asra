import type { StrokeAttrs } from '@asyra/utils'
import { getRenderableStrokes } from './renderable-stroke'
import {
  buildConstrainedSolidStrokePolygons,
  supportsConstrainedSolidStroke
} from './constrained-solid-stroke-geometry'
import type { SolidCenterStrokeResolvedPacket } from './solid-center-stroke-packets'

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

export const buildConstrainedSolidStrokeResolvedPackets = (
  cachePrefix: string,
  points: Vec2[],
  closed: boolean,
  strokes: StrokeAttrs[] | undefined
): SolidCenterStrokeResolvedPacket[] =>
  getRenderableStrokes(strokes).flatMap((stroke, index) => {
    if (!supportsConstrainedSolidStroke(stroke, closed)) {
      return []
    }

    const polygons = buildConstrainedSolidStrokePolygons(points, closed, stroke)
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
            strokeId: `stroke:${index}`
          }
        },
        paint: {
          geometryId,
          color: stroke.color,
          alpha: stroke.alpha
        }
      }
    ]
  })
