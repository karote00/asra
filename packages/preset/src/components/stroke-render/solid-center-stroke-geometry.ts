import type { RenderableStroke } from './renderable-stroke'
import {
  buildOffsetSegments,
  dedupeAdjacent,
  dedupeClosed,
  extendForCap,
  normalizeClosed,
  offsetPath,
  subtract,
  polygonArea,
  type Vec2
} from './solid-stroke-geometry-core'

export const supportsSolidCenterStroke = (
  stroke: Pick<
    RenderableStroke,
    'style' | 'position' | 'width' | 'join' | 'miterLimit' | 'cap'
  >
) =>
  stroke.style === 'solid' &&
  stroke.position === 'center' &&
  stroke.width > 0 &&
  (stroke.join === 'miter' || stroke.join === 'bevel') &&
  stroke.miterLimit >= 1 &&
  (stroke.cap === 'butt' || stroke.cap === 'square')

export const buildSolidCenterStrokePolygons = (
  points: Vec2[],
  closed: boolean,
  stroke: Pick<
    RenderableStroke,
    'style' | 'position' | 'width' | 'join' | 'miterLimit' | 'cap'
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

  if (!closed && stroke.join === 'bevel') {
    const leftSegments = buildOffsetSegments(source, false, halfWidth)
    const rightSegments = buildOffsetSegments(source, false, -halfWidth)
    if (leftSegments.length === 0 || rightSegments.length === 0) {
      return []
    }

    const flattenSegmentPath = (
      segments: Array<{ start: Vec2; end: Vec2 } | null>
    ) => {
      const path: Vec2[] = []

      segments.forEach((segment, index) => {
        if (!segment) {
          return
        }

        if (path.length === 0) {
          path.push(segment.start)
        }

        path.push(segment.end)

        const nextSegment = segments[index + 1]
        if (nextSegment) {
          path.push(nextSegment.start)
        }
      })

      return path
    }

    const polygon = dedupeClosed([
      ...flattenSegmentPath(leftSegments),
      ...flattenSegmentPath(rightSegments).reverse()
    ])
    return polygon.length >= 3 ? [polygon] : []
  }

  if (!closed && stroke.join === 'miter') {
    const leftSegments = buildOffsetSegments(source, false, halfWidth)
    const rightSegments = buildOffsetSegments(source, false, -halfWidth)
    const leftPath = offsetPath(source, false, halfWidth, stroke)
    const rightPath = offsetPath(source, false, -halfWidth, stroke)
    if (
      leftSegments.length === 0 ||
      rightSegments.length === 0 ||
      leftPath.length === 0 ||
      rightPath.length === 0
    ) {
      return []
    }

    const polygons: Vec2[][] = []
    const pushPolygon = (points: Vec2[]) => {
      const polygon = dedupeClosed(points)
      return polygon.length >= 3 ? polygons.push(polygon) : undefined
    }
    const cross = (a: Vec2, b: Vec2) => a.x * b.y - a.y * b.x

    leftSegments.forEach((leftSegment, index) => {
      const rightSegment = rightSegments[index]
      if (!leftSegment || !rightSegment) {
        return
      }

      pushPolygon([
        leftSegment.start,
        leftSegment.end,
        rightSegment.end,
        rightSegment.start
      ])
    })

    for (let index = 1; index < source.length - 1; index += 1) {
      const point = source[index]
      const previousPoint = source[index - 1]
      const nextPoint = source[index + 1]
      const turn = cross(subtract(point, previousPoint), subtract(nextPoint, point))
      if (Math.abs(turn) <= 1e-6) {
        continue
      }

      const outerSegments = turn > 0 ? rightSegments : leftSegments
      const innerSegments = turn > 0 ? leftSegments : rightSegments
      const outerPath = turn > 0 ? rightPath : leftPath
      const previousOuter = outerSegments[index - 1]
      const nextOuter = outerSegments[index]
      const previousInner = innerSegments[index - 1]
      const nextInner = innerSegments[index]
      const outerJoinPoint = outerPath[index]

      if (previousInner && nextInner) {
        pushPolygon([previousInner.end, point, nextInner.start])
      }

      if (previousOuter && nextOuter && outerJoinPoint) {
        pushPolygon([previousOuter.end, outerJoinPoint, nextOuter.start, point])
      }
    }

    return polygons
  }

  if (closed) {
    if (stroke.join === 'bevel') {
      const leftSegments = buildOffsetSegments(source, true, halfWidth)
      const rightSegments = buildOffsetSegments(source, true, -halfWidth)
      if (leftSegments.length === 0 || rightSegments.length === 0) {
        return []
      }

      const isCounterClockwise = polygonArea(source) >= 0
      const innerSegments = isCounterClockwise ? leftSegments : rightSegments
      const outerSegments = isCounterClockwise ? rightSegments : leftSegments
      const polygons: Vec2[][] = []
      const pushPolygon = (points: Vec2[]) => {
        const polygon = dedupeClosed(points)
        return polygon.length >= 3 ? polygons.push(polygon) : undefined
      }

      source.forEach((point, index) => {
        const innerSegment = innerSegments[index]
        const outerSegment = outerSegments[index]
        if (!innerSegment || !outerSegment) {
          return []
        }

        pushPolygon([
          innerSegment.start,
          innerSegment.end,
          outerSegment.end,
          outerSegment.start
        ])
      })

      source.forEach((point, index) => {
        const previousIndex = (index - 1 + source.length) % source.length
        const previousInner = innerSegments[previousIndex]
        const nextInner = innerSegments[index]
        const previousOuter = outerSegments[previousIndex]
        const nextOuter = outerSegments[index]
        if (!previousInner || !nextInner || !previousOuter || !nextOuter) {
          return []
        }

        pushPolygon([previousInner.end, point, nextInner.start])
        pushPolygon([previousOuter.end, nextOuter.start, point])
      })

      return polygons
    }

    const left = offsetPath(source, true, halfWidth, stroke)
    const right = offsetPath(source, true, -halfWidth, stroke)
    if (left.length === 0 || right.length === 0) {
      return []
    }

    return source.flatMap((_, index) => {
      const nextIndex = (index + 1) % source.length
      const polygon = dedupeClosed([
        left[index],
        left[nextIndex],
        right[nextIndex],
        right[index]
      ])
      return polygon.length >= 3 ? [polygon] : []
    })
  }

  const left = offsetPath(source, false, halfWidth, stroke)
  const right = offsetPath(source, false, -halfWidth, stroke)
  if (left.length === 0 || right.length === 0) {
    return []
  }

  const polygon = dedupeClosed([...left, ...[...right].reverse()])
  return polygon.length >= 3 ? [polygon] : []
}
