import {
  createDefaultStroke,
  type StrokeAttrs
} from '@asyra/utils'
import { getRenderableStrokes, type RenderableStroke } from './renderable-stroke'
import { allocateDashedCenterStrokeIntervals } from './dashed-center-stroke-intervals'
import { sliceDashedCenterStrokeFrames } from './dashed-center-stroke-frames'
import { buildConstrainedSolidLegalityClippingResult } from './constrained-solid-legality-clipping'
import { buildConstrainedSolidStrokePolygons } from './constrained-solid-stroke-geometry'
import { buildSolidCenterStrokePolygons } from './solid-center-stroke-geometry'
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

export interface ConstrainedDashedStrokePromotionOptions {
  allowRectFullLoopInsideRoundJoin?: boolean
  allowRectFullLoopOutsideRoundJoin?: boolean
  allowVectorRectEquivalentFullLoopInsideRoundJoin?: boolean
  allowVectorRectEquivalentFullLoopOutsideRoundJoin?: boolean
  allowFirstBroaderVectorFullLoopInsideRoundJoin?: boolean
  allowFirstBroaderVectorFullLoopOutsideRoundJoin?: boolean
  allowRectSingleEdgeInsideRoundCap?: boolean
  allowRectSingleEdgeOutsideRoundCap?: boolean
  allowVectorRectEquivalentSingleEdgeInsideRoundCap?: boolean
  allowVectorRectEquivalentSingleEdgeOutsideRoundCap?: boolean
  allowFirstBroaderVectorSingleEdgeInsideRoundCap?: boolean
  allowFirstBroaderVectorSingleEdgeOutsideRoundCap?: boolean
  allowRectCornerSpanningInsideBevel?: boolean
  allowRectCornerSpanningInsideMiter?: boolean
  allowRectCornerSpanningOutsideBevel?: boolean
  allowRectCornerSpanningOutsideMiter?: boolean
  allowFirstBroaderVectorCornerSpanningInsideBevel?: boolean
  allowFirstBroaderVectorCornerSpanningInsideMiter?: boolean
  allowFirstBroaderVectorCornerSpanningOutsideBevel?: boolean
  allowFirstBroaderVectorCornerSpanningOutsideMiter?: boolean
}

const EPSILON = 1e-6

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

export const supportsConstrainedDashedStroke = (
  stroke: Pick<
    RenderableStroke,
    'style' | 'position' | 'width' | 'join' | 'miterLimit' | 'cap' | 'dashPattern'
  >,
  closed: boolean
) =>
  closed &&
  stroke.style === 'dashed' &&
  (stroke.position === 'inside' || stroke.position === 'outside') &&
  stroke.width > 0 &&
  stroke.dashPattern.length > 0 &&
  (stroke.join === 'miter' || stroke.join === 'bevel' || stroke.join === 'round') &&
  stroke.miterLimit >= 1 &&
  (stroke.cap === 'butt' || stroke.cap === 'square' || stroke.cap === 'round')

const isFullLoopVisibleInterval = (
  startDistance: number,
  endDistance: number,
  totalLength: number,
  wrapsSeam: boolean
) =>
  !wrapsSeam &&
  Math.abs(startDistance) <= EPSILON &&
  Math.abs(endDistance - totalLength) <= EPSILON

const getClosedSegmentRanges = (points: Vec2[], closed: boolean) => {
  if (!closed || points.length < 2) {
    return []
  }

  const segments = []
  let cursor = 0

  for (let index = 0; index < points.length; index += 1) {
    const start = points[index]
    const end = points[(index + 1) % points.length]
    const length = distanceBetween(start, end)
    const startDistance = cursor
    const endDistance = cursor + length
    cursor = endDistance
    segments.push({
      index,
      startDistance,
      endDistance
    })
  }

  return segments
}

const findClosedSegmentIndexForDistance = (
  segmentRanges: ReturnType<typeof getClosedSegmentRanges>,
  distance: number
) =>
  segmentRanges.findIndex(
    (segment) =>
      distance > segment.startDistance + EPSILON &&
      distance < segment.endDistance - EPSILON
  )

const isSingleEdgeVisibleInterval = (
  points: Vec2[],
  closed: boolean,
  startDistance: number,
  endDistance: number
) => {
  const segmentRanges = getClosedSegmentRanges(points, closed)
  if (segmentRanges.length === 0) {
    return false
  }

  const startSegmentIndex = findClosedSegmentIndexForDistance(
    segmentRanges,
    startDistance
  )
  const endSegmentIndex = findClosedSegmentIndexForDistance(
    segmentRanges,
    endDistance
  )

  return startSegmentIndex >= 0 && startSegmentIndex === endSegmentIndex
}

const getCanonicalClosedLoopPoints = (points: Vec2[], closed: boolean) => {
  if (!closed || points.length < 2) {
    return points
  }

  const first = points[0]
  const last = points[points.length - 1]
  if (
    first &&
    last &&
    Math.abs(first.x - last.x) <= EPSILON &&
    Math.abs(first.y - last.y) <= EPSILON
  ) {
    return points.slice(0, -1)
  }

  return points
}

const isOrthogonalRectLoop = (points: Vec2[], closed: boolean) =>
  (() => {
    const loopPoints = getCanonicalClosedLoopPoints(points, closed)
    return (
      closed &&
      loopPoints.length === 4 &&
      loopPoints.every((point, index) => {
        const next = loopPoints[(index + 1) % loopPoints.length]
        return (
          Math.abs(point.x - next.x) <= EPSILON ||
          Math.abs(point.y - next.y) <= EPSILON
        )
      })
    )
  })()

const isSingleObliqueQuadrilateralLoop = (points: Vec2[], closed: boolean) =>
  (() => {
    const loopPoints = getCanonicalClosedLoopPoints(points, closed)
    if (!closed || loopPoints.length !== 4) {
      return false
    }

    let horizontalEdges = 0
    let verticalEdges = 0
    let obliqueEdges = 0

    loopPoints.forEach((point, index) => {
      const next = loopPoints[(index + 1) % loopPoints.length]
      const dx = Math.abs(point.x - next.x)
      const dy = Math.abs(point.y - next.y)

      if (dx <= EPSILON && dy <= EPSILON) {
        return
      }

      if (dy <= EPSILON) {
        horizontalEdges += 1
        return
      }

      if (dx <= EPSILON) {
        verticalEdges += 1
        return
      }

      obliqueEdges += 1
    })

    return horizontalEdges === 2 && verticalEdges === 1 && obliqueEdges === 1
  })()

const isSingleCornerSpanningVisibleInterval = (
  points: Vec2[],
  closed: boolean,
  startDistance: number,
  endDistance: number,
  wrapsSeam: boolean
) => {
  if (wrapsSeam) {
    return false
  }

  const segmentRanges = getClosedSegmentRanges(points, closed)
  if (segmentRanges.length === 0) {
    return false
  }

  const startSegmentIndex = findClosedSegmentIndexForDistance(
    segmentRanges,
    startDistance
  )
  const endSegmentIndex = findClosedSegmentIndexForDistance(
    segmentRanges,
    endDistance
  )

  return (
    startSegmentIndex >= 0 &&
    endSegmentIndex >= 0 &&
    endSegmentIndex === startSegmentIndex + 1
  )
}

const toSyntheticStrokeAttrs = (
  stroke: RenderableStroke,
  overrides: Partial<StrokeAttrs> = {}
): StrokeAttrs => createDefaultStroke({
  color: `#${stroke.color.toString(16).padStart(6, '0')}`,
  opacity: stroke.alpha,
  width: stroke.width,
  style: stroke.style,
  position: stroke.position,
  dashPattern: stroke.dashPattern,
  dashOffset: stroke.dashOffset,
  ...overrides
})

const normalizeVector = (point: Vec2) => {
  const length = Math.hypot(point.x, point.y)
  if (length <= EPSILON) {
    return null
  }

  return {
    x: point.x / length,
    y: point.y / length
  }
}

const sampleArcPoints = (
  center: Vec2,
  radius: number,
  startAngle: number,
  endAngle: number,
  steps: number
) => {
  const points: Vec2[] = []

  for (let index = 1; index < steps; index += 1) {
    const t = index / steps
    const angle = startAngle + (endAngle - startAngle) * t
    points.push({
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius
    })
  }

  return points
}

const buildRoundCapSingleSegmentPolygons = (
  points: Vec2[],
  radius: number
): Vec2[][] => {
  if (points.length !== 2 || radius <= EPSILON) {
    return []
  }

  const [start, end] = points
  const direction = normalizeVector({
    x: end.x - start.x,
    y: end.y - start.y
  })

  if (!direction) {
    return []
  }

  const normal = {
    x: -direction.y,
    y: direction.x
  }

  const leftStart = {
    x: start.x + normal.x * radius,
    y: start.y + normal.y * radius
  }
  const leftEnd = {
    x: end.x + normal.x * radius,
    y: end.y + normal.y * radius
  }
  const rightEnd = {
    x: end.x - normal.x * radius,
    y: end.y - normal.y * radius
  }
  const rightStart = {
    x: start.x - normal.x * radius,
    y: start.y - normal.y * radius
  }

  const directionAngle = Math.atan2(direction.y, direction.x)
  const arcSteps = 8
  const endArc = sampleArcPoints(
    end,
    radius,
    directionAngle + Math.PI / 2,
    directionAngle - Math.PI / 2,
    arcSteps
  )
  const startArc = sampleArcPoints(
    start,
    radius,
    directionAngle - Math.PI / 2,
    directionAngle + Math.PI / 2 - Math.PI * 2,
    arcSteps
  )

  const polygon = [
    leftStart,
    leftEnd,
    ...endArc,
    rightEnd,
    rightStart,
    ...startArc
  ]

  return [polygon]
}

export const buildConstrainedDashedStrokeResolvedPackets = (
  cachePrefix: string,
  points: Vec2[],
  closed: boolean,
  strokes: StrokeAttrs[] | undefined,
  options: ConstrainedDashedStrokePromotionOptions = {}
): SolidCenterStrokeResolvedPacket[] => {
  const totalLength = getPathLength(points, closed)

  return getRenderableStrokes(strokes).flatMap((stroke, strokeIndex) => {
    if (!supportsConstrainedDashedStroke(stroke, closed)) {
      return []
    }

    const visibleIntervals = allocateDashedCenterStrokeIntervals(
      totalLength,
      stroke.dashPattern,
      stroke.dashOffset,
      closed
    ).filter((interval) => interval.kind === 'visible')

    if (visibleIntervals.length === 0) {
      return []
    }

    const [fullLoopInterval] =
      visibleIntervals.length === 1 ? visibleIntervals : []

    if (
      fullLoopInterval &&
      isFullLoopVisibleInterval(
        fullLoopInterval.startDistance,
        fullLoopInterval.endDistance,
        totalLength,
        fullLoopInterval.wrapsSeam
      )
    ) {
      const promotedFullLoopInsideRoundJoin =
        options.allowRectFullLoopInsideRoundJoin === true &&
        stroke.position === 'inside' &&
        stroke.join === 'round' &&
        isOrthogonalRectLoop(points, closed)
      const promotedFullLoopOutsideRoundJoin =
        options.allowRectFullLoopOutsideRoundJoin === true &&
        stroke.position === 'outside' &&
        stroke.join === 'round' &&
        isOrthogonalRectLoop(points, closed)
      const promotedVectorRectEquivalentFullLoopInsideRoundJoin =
        options.allowVectorRectEquivalentFullLoopInsideRoundJoin === true &&
        stroke.position === 'inside' &&
        stroke.join === 'round' &&
        isOrthogonalRectLoop(points, closed)
      const promotedVectorRectEquivalentFullLoopOutsideRoundJoin =
        options.allowVectorRectEquivalentFullLoopOutsideRoundJoin === true &&
        stroke.position === 'outside' &&
        stroke.join === 'round' &&
        isOrthogonalRectLoop(points, closed)
      const promotedBroaderVectorFullLoopInsideRoundJoin =
        options.allowFirstBroaderVectorFullLoopInsideRoundJoin === true &&
        stroke.position === 'inside' &&
        stroke.join === 'round' &&
        isSingleObliqueQuadrilateralLoop(points, closed)
      const promotedBroaderVectorFullLoopOutsideRoundJoin =
        options.allowFirstBroaderVectorFullLoopOutsideRoundJoin === true &&
        stroke.position === 'outside' &&
        stroke.join === 'round' &&
        isSingleObliqueQuadrilateralLoop(points, closed)

      const polygons = buildConstrainedSolidStrokePolygons(points, true, {
        ...stroke,
        style: 'solid',
        join:
          promotedFullLoopInsideRoundJoin ||
          promotedFullLoopOutsideRoundJoin ||
          promotedVectorRectEquivalentFullLoopInsideRoundJoin ||
          promotedVectorRectEquivalentFullLoopOutsideRoundJoin ||
          promotedBroaderVectorFullLoopInsideRoundJoin ||
          promotedBroaderVectorFullLoopOutsideRoundJoin
            ? 'miter'
            : stroke.join
      })

      if (polygons.length === 0) {
        return []
      }

      const geometryId = `${cachePrefix}:${strokeIndex}:${fullLoopInterval.intervalId}`
      const debugMeta: SolidCenterStrokeGeometryDebugMeta = {
        strokeId: `stroke:${strokeIndex}`,
        intervalId: fullLoopInterval.intervalId,
        authoredVisibleIntervalIndex: fullLoopInterval.authoredIndex,
        startDistance: fullLoopInterval.startDistance,
        endDistance: fullLoopInterval.endDistance,
        wrapsSeam: fullLoopInterval.wrapsSeam,
        previousVisibleIntervalId: fullLoopInterval.previousVisibleIntervalId,
        nextVisibleIntervalId: fullLoopInterval.nextVisibleIntervalId
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
            kind: stroke.kind,
            color: stroke.color,
            alpha: stroke.alpha,
            gradientStyle: stroke.gradientStyle,
            paintKey: stroke.paintKey
          }
        }
      ]
    }

    return visibleIntervals.flatMap((interval) => {
      const promotedSingleEdge = isSingleEdgeVisibleInterval(
        points,
        closed,
        interval.startDistance,
        interval.endDistance
      )
      const promotedRectCornerSpanning =
        ((stroke.position === 'inside' &&
          ((options.allowRectCornerSpanningInsideBevel === true &&
            (stroke.join === 'bevel' || stroke.join === 'round')) ||
            (options.allowRectCornerSpanningInsideMiter === true &&
              stroke.join === 'miter'))) ||
          (stroke.position === 'outside' &&
            ((options.allowRectCornerSpanningOutsideBevel === true &&
              (stroke.join === 'bevel' || stroke.join === 'round')) ||
              (options.allowRectCornerSpanningOutsideMiter === true &&
                stroke.join === 'miter')))) &&
        isOrthogonalRectLoop(points, closed) &&
        isSingleCornerSpanningVisibleInterval(
          points,
          closed,
          interval.startDistance,
          interval.endDistance,
          interval.wrapsSeam
        )

      const promotedBroaderVectorCornerSpanning =
        ((stroke.position === 'inside' &&
          ((options.allowFirstBroaderVectorCornerSpanningInsideBevel === true &&
            (stroke.join === 'bevel' || stroke.join === 'round')) ||
            (options.allowFirstBroaderVectorCornerSpanningInsideMiter === true &&
              stroke.join === 'miter'))) ||
          (stroke.position === 'outside' &&
            ((options.allowFirstBroaderVectorCornerSpanningOutsideBevel === true &&
              (stroke.join === 'bevel' || stroke.join === 'round')) ||
              (options.allowFirstBroaderVectorCornerSpanningOutsideMiter ===
                true &&
                stroke.join === 'miter')))) &&
        isSingleObliqueQuadrilateralLoop(points, closed) &&
        isSingleCornerSpanningVisibleInterval(
          points,
          closed,
          interval.startDistance,
          interval.endDistance,
          interval.wrapsSeam
        )

      const promotedRectSingleEdgeInsideRoundCap =
        promotedSingleEdge &&
        options.allowRectSingleEdgeInsideRoundCap === true &&
        stroke.position === 'inside' &&
        stroke.cap === 'round' &&
        isOrthogonalRectLoop(points, closed)
      const promotedRectSingleEdgeOutsideRoundCap =
        promotedSingleEdge &&
        options.allowRectSingleEdgeOutsideRoundCap === true &&
        stroke.position === 'outside' &&
        stroke.cap === 'round' &&
        isOrthogonalRectLoop(points, closed)
      const promotedVectorRectEquivalentSingleEdgeInsideRoundCap =
        promotedSingleEdge &&
        options.allowVectorRectEquivalentSingleEdgeInsideRoundCap === true &&
        stroke.position === 'inside' &&
        stroke.cap === 'round' &&
        isOrthogonalRectLoop(points, closed)
      const promotedVectorRectEquivalentSingleEdgeOutsideRoundCap =
        promotedSingleEdge &&
        options.allowVectorRectEquivalentSingleEdgeOutsideRoundCap === true &&
        stroke.position === 'outside' &&
        stroke.cap === 'round' &&
        isOrthogonalRectLoop(points, closed)
      const promotedBroaderVectorSingleEdgeInsideRoundCap =
        promotedSingleEdge &&
        options.allowFirstBroaderVectorSingleEdgeInsideRoundCap === true &&
        stroke.position === 'inside' &&
        stroke.cap === 'round' &&
        isSingleObliqueQuadrilateralLoop(points, closed)
      const promotedBroaderVectorSingleEdgeOutsideRoundCap =
        promotedSingleEdge &&
        options.allowFirstBroaderVectorSingleEdgeOutsideRoundCap === true &&
        stroke.position === 'outside' &&
        stroke.cap === 'round' &&
        isSingleObliqueQuadrilateralLoop(points, closed)

      if (
        promotedRectSingleEdgeInsideRoundCap ||
        promotedRectSingleEdgeOutsideRoundCap ||
        promotedVectorRectEquivalentSingleEdgeInsideRoundCap ||
        promotedVectorRectEquivalentSingleEdgeOutsideRoundCap ||
        promotedBroaderVectorSingleEdgeInsideRoundCap ||
        promotedBroaderVectorSingleEdgeOutsideRoundCap
      ) {
        const centerWidth = stroke.width * 2
        const halfWidthFrames = points.map((point) => ({
          x: point.x,
          y: point.y,
          widthLeft: centerWidth / 2,
          widthRight: centerWidth / 2
        }))
        const intervalFrames = sliceDashedCenterStrokeFrames(
          halfWidthFrames,
          closed,
          interval.startDistance,
          interval.endDistance,
          interval.wrapsSeam
        )
        const intervalPoints = intervalFrames.map(({ x, y }) => ({ x, y }))
        const centerPolygons = buildRoundCapSingleSegmentPolygons(
          intervalPoints,
          centerWidth / 2
        )

        if (centerPolygons.length === 0) {
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

        return buildConstrainedSolidLegalityClippingResult(
          [{ points, closed }],
          [
            toSyntheticStrokeAttrs(stroke, {
              style: 'solid'
            })
          ],
          [
            {
              geometry: {
                geometryId,
                polygons: centerPolygons,
                bounds: getBounds(centerPolygons),
                debugMeta
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
        ).packets
      }

      const centerWidth = stroke.width * 2
      const halfWidthFrames = points.map((point) => ({
        x: point.x,
        y: point.y,
        widthLeft: centerWidth / 2,
        widthRight: centerWidth / 2
      }))
      const intervalFrames = sliceDashedCenterStrokeFrames(
        halfWidthFrames,
        closed,
        interval.startDistance,
        interval.endDistance,
        interval.wrapsSeam
      )
      const intervalPoints = intervalFrames.map(({ x, y }) => ({ x, y }))
      const centerPolygons = buildSolidCenterStrokePolygons(intervalPoints, false, {
        style: 'solid',
        position: 'center',
        width: centerWidth,
        join: stroke.join,
        miterLimit: stroke.miterLimit,
        cap: stroke.cap
      })

      if (centerPolygons.length === 0) {
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

      return buildConstrainedSolidLegalityClippingResult(
        [{ points, closed }],
        [
          toSyntheticStrokeAttrs(stroke, {
            style: 'solid'
          })
        ],
        [
          {
            geometry: {
              geometryId,
              polygons: centerPolygons,
              bounds: getBounds(centerPolygons),
              debugMeta
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
      ).packets
    })
  })
}
