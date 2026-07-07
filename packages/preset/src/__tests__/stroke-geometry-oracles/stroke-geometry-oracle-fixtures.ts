import type { Vec2 } from '../../components/stroke-render/solid-stroke-geometry-core'

export type StrokeGeometryOracleFixtureScenarioId =
  | 'straight-segment'
  | 'convex-closed-polygon'
  | 'concave-closed-polygon'
  | 'ordinary-acute-vertex'
  | 'high-acute-vertex'
  | 'obtuse-vertex'
  | 'near-collinear-vertex'
  | 'zero-length-degenerate'
  | 'smooth-cubic-high-curvature'
  | 'closed-self-intersecting'
  | 'open-dangling-self-intersecting'
  | 'tiny-sliver-domain'
  | 'short-dash-collapse'

export interface StrokeGeometryOracleFixtureScenario {
  id: StrokeGeometryOracleFixtureScenarioId
  closed: boolean
  points: Vec2[]
  description: string
}

export const requiredStrokeGeometryOracleFixtureScenarioIds: readonly StrokeGeometryOracleFixtureScenarioId[] =
  [
    'straight-segment',
    'convex-closed-polygon',
    'concave-closed-polygon',
    'ordinary-acute-vertex',
    'high-acute-vertex',
    'obtuse-vertex',
    'near-collinear-vertex',
    'zero-length-degenerate',
    'smooth-cubic-high-curvature',
    'closed-self-intersecting',
    'open-dangling-self-intersecting',
    'tiny-sliver-domain',
    'short-dash-collapse'
  ]

export const strokeGeometryOracleFixtureScenarios: Record<
  StrokeGeometryOracleFixtureScenarioId,
  StrokeGeometryOracleFixtureScenario
> = {
  'straight-segment': {
    id: 'straight-segment',
    closed: false,
    points: [
      { x: 0, y: 0 },
      { x: 120, y: 0 }
    ],
    description: 'Open straight span used for center body, cap, and dash cases.'
  },
  'convex-closed-polygon': {
    id: 'convex-closed-polygon',
    closed: true,
    points: [
      { x: 0, y: 0 },
      { x: 80, y: 0 },
      { x: 80, y: 70 },
      { x: 0, y: 70 }
    ],
    description: 'Closed convex contour used for inside/outside baseline.'
  },
  'concave-closed-polygon': {
    id: 'concave-closed-polygon',
    closed: true,
    points: [
      { x: 0, y: 0 },
      { x: 90, y: 0 },
      { x: 52, y: 34 },
      { x: 90, y: 80 },
      { x: 0, y: 80 }
    ],
    description: 'Closed concave contour used for constrained legality routing.'
  },
  'ordinary-acute-vertex': {
    id: 'ordinary-acute-vertex',
    closed: false,
    points: [
      { x: -100, y: 50 },
      { x: 0, y: 0 },
      { x: 100, y: 50 }
    ],
    description: 'Sharp ordinary acute source vertex with legal miter output.'
  },
  'high-acute-vertex': {
    id: 'high-acute-vertex',
    closed: false,
    points: [
      { x: -110, y: 12 },
      { x: 0, y: 0 },
      { x: -110, y: -12 }
    ],
    description: 'High acute source vertex that exercises miter thresholding.'
  },
  'obtuse-vertex': {
    id: 'obtuse-vertex',
    closed: false,
    points: [
      { x: -80, y: 0 },
      { x: 0, y: 0 },
      { x: 50, y: 70 }
    ],
    description: 'Obtuse source vertex used to prove non-acute join envelopes.'
  },
  'near-collinear-vertex': {
    id: 'near-collinear-vertex',
    closed: false,
    points: [
      { x: -80, y: 0 },
      { x: 0, y: 0 },
      { x: 80, y: 0.00001 }
    ],
    description: 'Near-collinear vertex used for local envelope stability.'
  },
  'zero-length-degenerate': {
    id: 'zero-length-degenerate',
    closed: false,
    points: [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 40, y: 0 }
    ],
    description: 'Degenerate source tangent used for degenerate join output.'
  },
  'smooth-cubic-high-curvature': {
    id: 'smooth-cubic-high-curvature',
    closed: false,
    points: [
      { x: 0, y: 90 },
      { x: 35, y: 15 },
      { x: 120, y: 0 },
      { x: 205, y: 15 },
      { x: 240, y: 90 }
    ],
    description:
      'Tangent-continuous high-curvature span used for non-join ownership.'
  },
  'closed-self-intersecting': {
    id: 'closed-self-intersecting',
    closed: true,
    points: [
      { x: 0, y: 0 },
      { x: 96, y: 96 },
      { x: 0, y: 96 },
      { x: 96, y: 0 }
    ],
    description: 'Closed bow-tie source used for self-intersection routing.'
  },
  'open-dangling-self-intersecting': {
    id: 'open-dangling-self-intersecting',
    closed: false,
    points: [
      { x: 0, y: 0 },
      { x: 80, y: 80 },
      { x: 0, y: 80 },
      { x: 80, y: 0 },
      { x: 116, y: -30 }
    ],
    description: 'Open self-intersecting network with a dangling branch.'
  },
  'tiny-sliver-domain': {
    id: 'tiny-sliver-domain',
    closed: true,
    points: [
      { x: 0, y: 0 },
      { x: 80, y: 0 },
      { x: 80.001, y: 0.25 },
      { x: 0, y: 0.25 }
    ],
    description: 'Numerically stable but visually tiny constrained domain.'
  },
  'short-dash-collapse': {
    id: 'short-dash-collapse',
    closed: false,
    points: [
      { x: 0, y: 0 },
      { x: 18, y: 0 }
    ],
    description: 'Short open span used for cap-aware dash collapse behavior.'
  }
}

export const getStrokeGeometryOracleFixture = (
  id: StrokeGeometryOracleFixtureScenarioId
) => strokeGeometryOracleFixtureScenarios[id]
