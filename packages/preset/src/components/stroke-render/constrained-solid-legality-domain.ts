import {
  EPS,
  isSimpleClosedPolygon,
  normalizeClosed,
  polygonArea,
  type Vec2
} from './solid-stroke-geometry-core'
import {
  normalizePathTopologyFillRule,
  type PathTopologyFillRule
} from './path-topology-model'

export type ConstrainedSolidLegalityMode = 'inside' | 'outside'

export interface ConstrainedSolidLegalityDomain {
  mode: ConstrainedSolidLegalityMode
  fillRule: PathTopologyFillRule
  canonicalPolygonForm: 'simple-closed-polygon'
  boundaryPolygon: Vec2[]
  orientation: 'cw' | 'ccw'
}

const isPointOnSegment = (point: Vec2, start: Vec2, end: Vec2) => {
  const cross =
    (end.x - start.x) * (point.y - start.y) -
    (end.y - start.y) * (point.x - start.x)

  if (Math.abs(cross) > EPS) {
    return false
  }

  return (
    point.x >= Math.min(start.x, end.x) - EPS &&
    point.x <= Math.max(start.x, end.x) + EPS &&
    point.y >= Math.min(start.y, end.y) - EPS &&
    point.y <= Math.max(start.y, end.y) + EPS
  )
}

const isPointInsidePolygon = (point: Vec2, polygon: Vec2[]) => {
  let inside = false

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const current = polygon[i]
    const previous = polygon[j]

    if (isPointOnSegment(point, previous, current)) {
      return true
    }

    const intersects =
      current.y > point.y !== previous.y > point.y &&
      point.x <
        ((previous.x - current.x) * (point.y - current.y)) /
          (previous.y - current.y) +
          current.x

    if (intersects) {
      inside = !inside
    }
  }

  return inside
}

export const buildConstrainedSolidLegalityDomain = (
  points: Vec2[],
  closed: boolean,
  mode: ConstrainedSolidLegalityMode,
  fillRule?: PathTopologyFillRule | null
): ConstrainedSolidLegalityDomain | null => {
  if (!closed) {
    return null
  }

  const source = normalizeClosed(points)
  if (source.length < 3) {
    return null
  }

  if (!isSimpleClosedPolygon(source)) {
    return null
  }

  const area = polygonArea(source)
  if (Math.abs(area) <= EPS) {
    return null
  }

  return {
    mode,
    fillRule: normalizePathTopologyFillRule(fillRule),
    canonicalPolygonForm: 'simple-closed-polygon',
    boundaryPolygon: source,
    orientation: area > 0 ? 'ccw' : 'cw'
  }
}

export const isPointInConstrainedSolidLegalityDomain = (
  domain: ConstrainedSolidLegalityDomain,
  point: Vec2
) => {
  const inside = isPointInsidePolygon(point, domain.boundaryPolygon)
  return domain.mode === 'inside' ? inside : !inside
}
