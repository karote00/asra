import type { RenderableStroke } from './renderable-stroke'
import {
  buildOffsetSegments,
  distance,
  add,
  dedupeAdjacent,
  dedupeClosed,
  extendForCap,
  normalize,
  normalizeClosed,
  offsetPath,
  scale,
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
  (stroke.join === 'miter' || stroke.join === 'bevel' || stroke.join === 'round') &&
  stroke.miterLimit >= 1 &&
  (stroke.cap === 'butt' || stroke.cap === 'square' || stroke.cap === 'round')

const buildArcPoints = (
  center: Vec2,
  start: Vec2,
  end: Vec2,
  sweepSign: number
) => {
  const startAngle = Math.atan2(start.y - center.y, start.x - center.x)
  const endAngle = Math.atan2(end.y - center.y, end.x - center.x)
  let sweep = endAngle - startAngle

  if (sweepSign >= 0) {
    while (sweep < 0) {
      sweep += Math.PI * 2
    }
  } else {
    while (sweep > 0) {
      sweep -= Math.PI * 2
    }
  }

  const segmentCount = Math.max(2, Math.ceil(Math.abs(sweep) / (Math.PI / 12)))
  const radius = distance(center, start)

  return Array.from({ length: segmentCount + 1 }, (_, index) => {
    const angle = startAngle + (sweep * index) / segmentCount
    return {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius
    }
  })
}

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
      buildArcPoints(
        startCenter,
        add(startCenter, scale(startNormal, radius)),
        add(startCenter, scale(startNormal, -radius)),
        1
      )
    ),
    dedupeClosed(
      buildArcPoints(
        endCenter,
        add(endCenter, scale(endNormal, -radius)),
        add(endCenter, scale(endNormal, radius)),
        1
      )
    )
  ].filter((polygon) => polygon.length >= 3)
}

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
  const roundCapPolygons = buildRoundCapPolygons(source, stroke, closed)

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
    return polygon.length >= 3 ? [polygon, ...roundCapPolygons] : []
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

    return [...polygons, ...roundCapPolygons]
  }

  if (!closed && stroke.join === 'round') {
    const leftSegments = buildOffsetSegments(source, false, halfWidth)
    const rightSegments = buildOffsetSegments(source, false, -halfWidth)
    if (leftSegments.length === 0 || rightSegments.length === 0) {
      return []
    }

    const polygons: Vec2[][] = []
    const pushPolygon = (points: Vec2[]) => {
      const polygon = dedupeClosed(points)
      return polygon.length >= 3 ? polygons.push(polygon) : undefined
    }
    const cross = (a: Vec2, b: Vec2) => a.x * b.y - a.y * b.x
    const normalizeSweep = (start: number, end: number, turn: number) => {
      let sweep = end - start
      if (turn > 0) {
        while (sweep < 0) {
          sweep += Math.PI * 2
        }
        return sweep
      }

      while (sweep > 0) {
        sweep -= Math.PI * 2
      }
      return sweep
    }
    const buildArcFan = (center: Vec2, start: Vec2, end: Vec2, turn: number) => {
      const startAngle = Math.atan2(start.y - center.y, start.x - center.x)
      const endAngle = Math.atan2(end.y - center.y, end.x - center.x)
      const sweep = normalizeSweep(startAngle, endAngle, turn)
      const segmentCount = Math.max(2, Math.ceil(Math.abs(sweep) / (Math.PI / 12)))
      const radius = distance(center, start)

      return Array.from({ length: segmentCount + 1 }, (_, index) => {
        const angle = startAngle + (sweep * index) / segmentCount
        return {
          x: center.x + Math.cos(angle) * radius,
          y: center.y + Math.sin(angle) * radius
        }
      })
    }

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
      const previousOuter = outerSegments[index - 1]
      const nextOuter = outerSegments[index]
      const previousInner = innerSegments[index - 1]
      const nextInner = innerSegments[index]

      if (previousInner && nextInner) {
        pushPolygon([previousInner.end, point, nextInner.start])
      }

      if (previousOuter && nextOuter) {
        pushPolygon([
          point,
          ...buildArcFan(point, previousOuter.end, nextOuter.start, turn)
        ])
      }
    }

    return [...polygons, ...roundCapPolygons]
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

    if (stroke.join === 'round') {
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
      const cross = (a: Vec2, b: Vec2) => a.x * b.y - a.y * b.x

      source.forEach((point, index) => {
        const innerSegment = innerSegments[index]
        const outerSegment = outerSegments[index]
        if (!innerSegment || !outerSegment) {
          return
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
        const nextIndex = (index + 1) % source.length
        const previousInner = innerSegments[previousIndex]
        const nextInner = innerSegments[index]
        const previousOuter = outerSegments[previousIndex]
        const nextOuter = outerSegments[index]
        if (!previousInner || !nextInner || !previousOuter || !nextOuter) {
          return
        }

        pushPolygon([previousInner.end, point, nextInner.start])

        const turn = cross(
          subtract(point, source[previousIndex]),
          subtract(source[nextIndex], point)
        )
        pushPolygon([
          point,
          ...buildArcPoints(point, previousOuter.end, nextOuter.start, turn)
        ])
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
  return polygon.length >= 3 ? [polygon, ...roundCapPolygons] : []
}
