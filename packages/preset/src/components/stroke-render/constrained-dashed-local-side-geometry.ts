import type { RenderableStroke } from './renderable-stroke'
import {
  buildClosedConstrainedStrokePolygonEntriesForSource,
  buildConstrainedLocalSideStrokePolygons
} from './constrained-local-side-stroke-geometry'

interface Vec2 {
  x: number
  y: number
}

export const buildConstrainedDashedLocalSideStrokePolygons = (
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
  } = {}
): Vec2[][] =>
  buildConstrainedLocalSideStrokePolygons(points, closed, stroke, options)

export const buildSelfIntersectingClosedConstrainedDashedLocalSidePolygons = (
  points: Vec2[],
  stroke: Pick<
    RenderableStroke,
    'style' | 'position' | 'width' | 'join' | 'miterLimit' | 'cap'
  >
): Vec2[][] =>
  buildClosedConstrainedStrokePolygonEntriesForSource(points, stroke).map(
    (entry) => entry.polygon
  )
