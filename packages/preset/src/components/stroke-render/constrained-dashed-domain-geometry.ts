import type { RenderableStroke } from './renderable-stroke'
import {
  buildClosedConstrainedStrokePolygonEntriesForSource,
  buildConstrainedDomainStrokePolygons
} from './constrained-domain-stroke-geometry'

interface Vec2 {
  x: number
  y: number
}

export const buildConstrainedDashedDomainStrokePolygons = (
  points: Vec2[],
  closed: boolean,
  stroke: Pick<
    RenderableStroke,
    'style' | 'position' | 'width' | 'join' | 'miterLimit' | 'cap'
  >,
  options: {
    assumeSimpleOpen?: boolean
    assumeSimpleClosed?: boolean
    assumeNormalizedOpen?: boolean
    roundCapStart?: boolean
    roundCapEnd?: boolean
  } = {}
): Vec2[][] =>
  buildConstrainedDomainStrokePolygons(points, closed, stroke, options)

export const buildSelfIntersectingClosedConstrainedDashedDomainPolygons = (
  points: Vec2[],
  stroke: Pick<
    RenderableStroke,
    'style' | 'position' | 'width' | 'join' | 'miterLimit' | 'cap'
  >
): Vec2[][] =>
  buildClosedConstrainedStrokePolygonEntriesForSource(points, stroke).map(
    (entry) => entry.polygon
  )
