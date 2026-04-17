import type { RenderableStroke } from './renderable-stroke'
import {
  buildOffsetSegments,
  EPS,
  dedupeClosed,
  isSimpleClosedPolygon,
  normalizeClosed,
  offsetPath,
  polygonArea,
  type Vec2
} from './solid-stroke-geometry-core'

export const supportsConstrainedSolidStroke = (
  stroke: Pick<
    RenderableStroke,
    'style' | 'position' | 'width' | 'join' | 'miterLimit' | 'cap'
  >,
  closed: boolean
) =>
  closed &&
  stroke.style === 'solid' &&
  (stroke.position === 'inside' || stroke.position === 'outside') &&
  stroke.width > 0 &&
  (stroke.join === 'miter' || stroke.join === 'bevel') &&
  stroke.miterLimit >= 1 &&
  (stroke.cap === 'butt' || stroke.cap === 'square')

export const buildConstrainedSolidStrokePolygons = (
  points: Vec2[],
  closed: boolean,
  stroke: Pick<
    RenderableStroke,
    'style' | 'position' | 'width' | 'join' | 'miterLimit' | 'cap'
  >
): Vec2[][] => {
  if (!supportsConstrainedSolidStroke(stroke, closed)) {
    return []
  }

  const source = normalizeClosed(points)
  if (source.length < 3) {
    return []
  }

  if (!isSimpleClosedPolygon(source)) {
    return []
  }

  const orientationArea = polygonArea(source)
  if (Math.abs(orientationArea) <= EPS) {
    return []
  }

  const orientation = orientationArea > 0 ? 1 : -1
  const interiorOffset = orientation > 0 ? stroke.width : -stroke.width
  const constrainedOffset =
    stroke.position === 'inside' ? interiorOffset : -interiorOffset

  const constrainedBoundaryStroke =
    stroke.position === 'inside' && stroke.join === 'bevel'
      ? { ...stroke, join: 'miter' as const }
      : stroke
  const constrainedBoundary = offsetPath(
    source,
    true,
    constrainedOffset,
    constrainedBoundaryStroke
  )
  if (constrainedBoundary.length !== source.length) {
    return []
  }

  const constrainedSegments =
    stroke.position === 'outside' && stroke.join === 'bevel'
      ? buildOffsetSegments(source, true, constrainedOffset)
      : null

  return source.flatMap((_, index) => {
    const nextIndex = (index + 1) % source.length
    const segment = constrainedSegments?.[index] ?? null
    const polygon =
      stroke.position === 'inside'
        ? dedupeClosed([
            source[index],
            source[nextIndex],
            constrainedBoundary[nextIndex],
            constrainedBoundary[index]
          ])
        : segment
          ? dedupeClosed([
              segment.start,
              segment.end,
              source[nextIndex],
              source[index]
            ])
        : dedupeClosed([
            constrainedBoundary[index],
            constrainedBoundary[nextIndex],
            source[nextIndex],
            source[index]
          ])

    return polygon.length >= 3 ? [polygon] : []
  })
}
