import type { RenderableStroke } from './renderable-stroke'
import {
  ROUND_STROKE_CAP_ARC_SAMPLING,
  buildPairedOffsetSegmentsFromNormalized,
  buildRoundStrokeArcPointsBetween,
  add,
  dedupeAdjacent,
  dedupeClosed,
  extendForCap,
  normalize,
  normalizeClosed,
  scale,
  subtract,
  type Vec2
} from './solid-stroke-geometry-core'
import { buildSourceVertexJoinFootprint } from './source-vertex-join-footprint'

export const supportsSolidCenterStroke = (
  stroke: Pick<
    RenderableStroke,
    'style' | 'position' | 'width' | 'join' | 'miterLimit' | 'cap'
  >
) =>
  stroke.style === 'solid' &&
  stroke.position === 'center' &&
  stroke.width > 0 &&
  (stroke.join === 'miter' ||
    stroke.join === 'bevel' ||
    stroke.join === 'round') &&
  stroke.miterLimit >= 1 &&
  (stroke.cap === 'butt' || stroke.cap === 'square' || stroke.cap === 'round')

const buildRoundCapArcPoints = (
  center: Vec2,
  start: Vec2,
  end: Vec2,
  sweepSign: number
) =>
  buildRoundStrokeArcPointsBetween(
    center,
    start,
    end,
    sweepSign,
    2,
    ROUND_STROKE_CAP_ARC_SAMPLING
  )

const buildRoundCapPolygons = (
  points: Vec2[],
  stroke: Pick<RenderableStroke, 'cap' | 'width'>,
  closed: boolean
) => {
  if (closed || stroke.cap !== 'round' || points.length < 2) {
    return []
  }

  const radius = stroke.width / 2
  const startTangent = normalize(subtract(points[1], points[0]))
  const endTangent = normalize(
    subtract(points[points.length - 1], points[points.length - 2])
  )
  if (!startTangent || !endTangent) {
    return []
  }

  const startNormal = { x: -startTangent.y, y: startTangent.x }
  const endNormal = { x: -endTangent.y, y: endTangent.x }
  const startCenter = points[0]
  const endCenter = points[points.length - 1]

  return [
    dedupeClosed(
      buildRoundCapArcPoints(
        startCenter,
        add(startCenter, scale(startNormal, radius)),
        add(startCenter, scale(startNormal, -radius)),
        1
      )
    ),
    dedupeClosed(
      buildRoundCapArcPoints(
        endCenter,
        add(endCenter, scale(endNormal, -radius)),
        add(endCenter, scale(endNormal, radius)),
        1
      )
    )
  ].filter((polygon) => polygon.length >= 3)
}

const cross = (a: Vec2, b: Vec2) => a.x * b.y - a.y * b.x

const pushPolygon = (polygons: Vec2[][], points: Vec2[]) => {
  const polygon = dedupeClosed(points)
  if (polygon.length >= 3) {
    polygons.push(polygon)
  }
}

const buildSegmentBodyPolygons = (
  source: Vec2[],
  closed: boolean,
  halfWidth: number
) => {
  const { positive: leftSegments, negative: rightSegments } =
    buildPairedOffsetSegmentsFromNormalized(source, closed, halfWidth)
  const polygons: Vec2[][] = []

  leftSegments.forEach((leftSegment, index) => {
    const rightSegment = rightSegments[index]
    if (!leftSegment || !rightSegment) {
      return
    }

    pushPolygon(polygons, [
      leftSegment.start,
      leftSegment.end,
      rightSegment.end,
      rightSegment.start
    ])
  })

  return polygons
}

const buildSourceVertexJoinPolygons = (
  source: Vec2[],
  closed: boolean,
  stroke: Pick<RenderableStroke, 'width' | 'join' | 'miterAngle'>,
  halfWidth: number
) => {
  if (source.length < 3) {
    return []
  }

  const polygons: Vec2[][] = []
  const firstJoinIndex = closed ? 0 : 1
  const lastJoinIndex = closed ? source.length - 1 : source.length - 2

  for (let index = firstJoinIndex; index <= lastJoinIndex; index += 1) {
    const previousIndex = (index - 1 + source.length) % source.length
    const nextIndex = (index + 1) % source.length
    const vertex = source[index]
    const previousPoint = source[previousIndex]
    const nextPoint = source[nextIndex]
    const turn = cross(
      subtract(vertex, previousPoint),
      subtract(nextPoint, vertex)
    )
    if (Math.abs(turn) <= 1e-6) {
      continue
    }

    const outerSide = turn > 0 ? 'right' : 'left'
    ;(['left', 'right'] as const).forEach((side) => {
      const authoredJoin = side === outerSide ? stroke.join : 'bevel'
      const footprint = buildSourceVertexJoinFootprint({
        vertex,
        previousPoint,
        nextPoint,
        strokeWidth: stroke.width,
        offsetDistance: halfWidth,
        side,
        authoredJoin,
        miterAngle: stroke.miterAngle,
        ownerId: `center-solid:source-vertex:${index}:${side}`,
        angleSource: 'AUTHORED_CENTER_PATH_INCIDENT_TANGENTS'
      })
      pushPolygon(polygons, footprint.polygon)
    })
  }

  return polygons
}

export const buildSolidCenterStrokePolygons = (
  points: Vec2[],
  closed: boolean,
  stroke: Pick<
    RenderableStroke,
    'style' | 'position' | 'width' | 'join' | 'miterLimit' | 'miterAngle' | 'cap'
  >
): Vec2[][] => {
  if (!supportsSolidCenterStroke(stroke)) {
    return []
  }

  const source = closed
    ? normalizeClosed(points)
    : extendForCap(dedupeAdjacent(points), stroke)

  if (source.length < 2) {
    return []
  }

  const halfWidth = stroke.width / 2
  const roundCapPolygons = buildRoundCapPolygons(source, stroke, closed)
  return [
    ...buildSegmentBodyPolygons(source, closed, halfWidth),
    ...buildSourceVertexJoinPolygons(source, closed, stroke, halfWidth),
    ...roundCapPolygons
  ]
}
