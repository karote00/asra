import type { StrokeAttrs } from '@asyra/utils'
import {
  sliceDashedCenterStrokeFrames,
  type DashedCenterStrokeFrame
} from './dashed-center-stroke-frames'
import { getRenderableStrokes, type RenderableStroke } from './renderable-stroke'
import { buildSolidCenterStrokePolygons } from './solid-center-stroke-geometry'
import { allocateDashedCenterStrokeIntervals } from './dashed-center-stroke-intervals'
import type {
  SolidCenterStrokeGeometryDebugMeta,
  SolidCenterStrokeResolvedPacket
} from './solid-center-stroke-packets'

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

const distanceBetween = (a: Vec2, b: Vec2) => Math.hypot(b.x - a.x, b.y - a.y)

const getPathLength = (points: Vec2[], closed: boolean) => {
  if (points.length < 2) {
    return 0
  }

  let length = 0
  for (let index = 1; index < points.length; index += 1) {
    length += distanceBetween(points[index - 1], points[index])
  }

  if (closed) {
    length += distanceBetween(points[points.length - 1], points[0])
  }

  return length
}

const EPSILON = 1e-6

export const supportsDashedCenterStroke = (
  stroke: Pick<
    RenderableStroke,
    'style' | 'position' | 'width' | 'join' | 'miterLimit' | 'cap' | 'dashPattern'
  >
) =>
  stroke.style === 'dashed' &&
  stroke.position === 'center' &&
  stroke.width > 0 &&
  stroke.dashPattern.length > 0 &&
  (stroke.join === 'miter' || stroke.join === 'bevel') &&
  stroke.miterLimit >= 1 &&
  (stroke.cap === 'butt' || stroke.cap === 'square')

export const buildDashedCenterStrokeResolvedPackets = (
  cachePrefix: string,
  points: Vec2[],
  closed: boolean,
  strokes: StrokeAttrs[] | undefined
): SolidCenterStrokeResolvedPacket[] => {
  const totalLength = getPathLength(points, closed)
  const halfWidthFrames = (
    strokeWidth: number
  ): DashedCenterStrokeFrame[] =>
    points.map((point) => ({
      x: point.x,
      y: point.y,
      widthLeft: strokeWidth / 2,
      widthRight: strokeWidth / 2
    }))

  return getRenderableStrokes(strokes).flatMap((stroke, strokeIndex) => {
    if (!supportsDashedCenterStroke(stroke)) {
      return []
    }

    const intervals = allocateDashedCenterStrokeIntervals(
      totalLength,
      stroke.dashPattern,
      stroke.dashOffset,
      closed
    ).filter((interval) => interval.kind === 'visible')

    return intervals.flatMap((interval) => {
      const intervalFrames = sliceDashedCenterStrokeFrames(
        halfWidthFrames(stroke.width),
        closed,
        interval.startDistance,
        interval.endDistance,
        interval.wrapsSeam
      )
      const intervalPoints = intervalFrames.map(({ x, y }) => ({ x, y }))
      const coversFullClosedLoop =
        closed &&
        !interval.wrapsSeam &&
        Math.abs(interval.startDistance) <= EPSILON &&
        Math.abs(interval.endDistance - totalLength) <= EPSILON

      const polygons = buildSolidCenterStrokePolygons(intervalPoints, coversFullClosedLoop, {
        style: 'solid',
        position: 'center',
        width: stroke.width,
        join: stroke.join,
        miterLimit: stroke.miterLimit,
        cap: stroke.cap
      })

      if (polygons.length === 0) {
        return []
      }

      const geometryId = `${cachePrefix}:${strokeIndex}:${interval.intervalId}`
      const debugMeta: SolidCenterStrokeGeometryDebugMeta = {
        strokeId: `stroke:${strokeIndex}`,
        intervalId: interval.intervalId,
        authoredVisibleIntervalIndex: interval.authoredIndex,
        startDistance: interval.startDistance,
        endDistance: interval.endDistance,
        wrapsSeam: interval.wrapsSeam,
        previousVisibleIntervalId: interval.previousVisibleIntervalId,
        nextVisibleIntervalId: interval.nextVisibleIntervalId
      }

      return [
        {
          geometry: {
            geometryId,
            polygons,
            bounds: getBounds(polygons),
            debugMeta
          },
          paint: {
            geometryId,
            color: stroke.color,
            alpha: stroke.alpha
          }
        }
      ]
    })
  })
}
