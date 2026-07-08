import {
  EPS,
  add,
  buildRoundStrokeArcPointsBetween,
  dedupeClosed,
  distance,
  normalize,
  polygonArea,
  scale,
  subtract,
  type Vec2
} from './solid-stroke-geometry-core'

export type SourceVertexJoinAuthoredJoin = 'miter' | 'bevel' | 'round'
export type SourceVertexJoinResolvedJoin =
  | 'miter'
  | 'bevel-by-miter-angle'
  | 'bevel'
  | 'round'
  | 'degenerate-bevel'
export type SourceVertexJoinSide = 'left' | 'right'
export type SourceVertexJoinAngleSource =
  | 'AUTHORED_CENTER_PATH_INCIDENT_TANGENTS'
  | 'CONTOUR_VISIT_INCIDENT_TANGENTS'

export interface SourceVertexJoinFootprintInput {
  vertex: Vec2
  previousPoint: Vec2
  nextPoint: Vec2
  strokeWidth: number
  offsetDistance?: number
  side: SourceVertexJoinSide
  authoredJoin: SourceVertexJoinAuthoredJoin
  miterAngle: number
  ownerId: string
  angleSource: SourceVertexJoinAngleSource
  seamTolerance?: number
  incidentSeamBoundaries?: SourceVertexJoinIncidentSeamBoundary[]
}

export interface SourceVertexJoinAngleComparison {
  operator: '<=' | '>'
  result: boolean
  epsilon: number
}

export interface SourceVertexJoinFootprint {
  polygon: Vec2[]
  polygons: Vec2[][]
  ownerId: string
  ownerStage: 'Stroke Geometry source-vertex join assembly'
  visibleContributor: 'source-vertex-join'
  geometryBasis: 'canonical-join-footprint'
  side: SourceVertexJoinSide
  authoredJoin: SourceVertexJoinAuthoredJoin
  resolvedJoin: SourceVertexJoinResolvedJoin
  vertexAngle: number
  miterAngle: number
  angleSource: SourceVertexJoinAngleSource
  angleComparison: SourceVertexJoinAngleComparison
  previousTangent: Vec2
  nextTangent: Vec2
  previousOffsetEndpoint: Vec2
  nextOffsetEndpoint: Vec2
}

const ANGLE_EPSILON = 1e-6
const FOOTPRINT_AREA_EPSILON = EPS * EPS

const radiansToDegrees = (radians: number) => (radians * 180) / Math.PI

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const cross = (first: Vec2, second: Vec2) =>
  first.x * second.y - first.y * second.x

const dot = (first: Vec2, second: Vec2) =>
  first.x * second.x + first.y * second.y

const normalForSide = (direction: Vec2, side: SourceVertexJoinSide): Vec2 =>
  side === 'left'
    ? { x: -direction.y, y: direction.x }
    : { x: direction.y, y: -direction.x }

const lineIntersection = (
  firstStart: Vec2,
  firstEnd: Vec2,
  secondStart: Vec2,
  secondEnd: Vec2
): Vec2 | null => {
  const firstDelta = subtract(firstEnd, firstStart)
  const secondDelta = subtract(secondEnd, secondStart)
  const denominator = cross(firstDelta, secondDelta)
  if (Math.abs(denominator) <= EPS) {
    return null
  }

  const delta = subtract(secondStart, firstStart)
  const t = cross(delta, secondDelta) / denominator
  return {
    x: firstStart.x + firstDelta.x * t,
    y: firstStart.y + firstDelta.y * t
  }
}

const buildAngleComparison = (
  vertexAngle: number,
  miterAngle: number
): SourceVertexJoinAngleComparison =>
  vertexAngle <= miterAngle + ANGLE_EPSILON
    ? { operator: '<=', result: true, epsilon: ANGLE_EPSILON }
    : { operator: '>', result: true, epsilon: ANGLE_EPSILON }

const cleanFootprintPolygon = (polygon: Vec2[]) => {
  const cleaned = dedupeClosed(polygon)
  return cleaned.length >= 3 &&
    Math.abs(polygonArea(cleaned)) > FOOTPRINT_AREA_EPSILON
    ? cleaned
    : []
}

const isFinitePoint = (point: Vec2 | undefined): point is Vec2 =>
  point !== undefined && Number.isFinite(point.x) && Number.isFinite(point.y)

const getDistinctIncidentInnerEndpoint = (
  boundary: SourceVertexJoinIncidentSeamBoundary | undefined
) => {
  if (!boundary) {
    return undefined
  }
  if (
    isFinitePoint(boundary.point) &&
    distance(boundary.point, boundary.outerBodyBoundaryEndpoint) > EPS
  ) {
    return boundary.point
  }
  const bodySideEndpoint = boundary.bodySideOutlineSegment[1]
  if (isFinitePoint(bodySideEndpoint)) {
    return bodySideEndpoint
  }
  return undefined
}

const getIncidentProductBoundary = (
  input: Pick<SourceVertexJoinFootprintInput, 'incidentSeamBoundaries'>,
  side: SourceVertexJoinIncidentSeamBoundary['side']
) =>
  input.incidentSeamBoundaries?.find(
    (boundary) =>
      boundary.side === side &&
      isFinitePoint(boundary.outerBodyBoundaryEndpoint)
  )

const getIncidentProductBoundaryEndpoint = (
  input: Pick<SourceVertexJoinFootprintInput, 'incidentSeamBoundaries'>,
  side: SourceVertexJoinIncidentSeamBoundary['side']
) => getIncidentProductBoundary(input, side)?.outerBodyBoundaryEndpoint

const pointsMatch = (first: Vec2, second: Vec2) =>
  distance(first, second) <= EPS

const polygonHasEdge = (polygon: Vec2[], first: Vec2, second: Vec2) =>
  polygon.some((point, index) => {
    const nextPoint = polygon[(index + 1) % polygon.length]
    if (!nextPoint) {
      return false
    }
    return (
      (pointsMatch(point, first) && pointsMatch(nextPoint, second)) ||
      (pointsMatch(point, second) && pointsMatch(nextPoint, first))
    )
  })

const preserveIncidentSeamEdges = (
  polygon: Vec2[],
  previousBoundary: SourceVertexJoinIncidentSeamBoundary | undefined,
  nextBoundary: SourceVertexJoinIncidentSeamBoundary | undefined
) => {
  if (
    polygon.length === 0 ||
    !previousBoundary ||
    !nextBoundary ||
    (!pointsMatch(previousBoundary.point, nextBoundary.point) &&
      polygonHasEdge(
        polygon,
        previousBoundary.outerBodyBoundaryEndpoint,
        nextBoundary.outerBodyBoundaryEndpoint
      )) ||
    (polygonHasEdge(
      polygon,
      previousBoundary.point,
      previousBoundary.outerBodyBoundaryEndpoint
    ) &&
      polygonHasEdge(
        polygon,
        nextBoundary.point,
        nextBoundary.outerBodyBoundaryEndpoint
      ))
  ) {
    return polygon
  }

  const seamPoints = [
    previousBoundary.point,
    previousBoundary.outerBodyBoundaryEndpoint,
    nextBoundary.outerBodyBoundaryEndpoint,
    nextBoundary.point
  ]
  const interiorBoundary = polygon.filter(
    (point) => !seamPoints.some((seamPoint) => pointsMatch(point, seamPoint))
  )
  const seamPreservedPolygon = cleanFootprintPolygon([
    previousBoundary.point,
    previousBoundary.outerBodyBoundaryEndpoint,
    ...interiorBoundary,
    nextBoundary.outerBodyBoundaryEndpoint,
    nextBoundary.point
  ])
  return seamPreservedPolygon.length > 0 ? seamPreservedPolygon : polygon
}

export const getSourceVertexJoinLocalSeamTolerance = (
  strokeWidth: number,
  seamTolerance?: number
) =>
  seamTolerance !== undefined && Number.isFinite(seamTolerance)
    ? Math.max(0, seamTolerance)
    : Math.max(0.5, strokeWidth * 0.05)

export const getSourceVertexJoinProtectedContinuityOverlapDistance = (
  strokeWidth: number,
  seamTolerance?: number
) => getSourceVertexJoinLocalSeamTolerance(strokeWidth, seamTolerance) * 3

export const measureSourceVertexAngle = (
  previousPoint: Vec2,
  vertex: Vec2,
  nextPoint: Vec2
) => {
  const previousTangent = normalize(subtract(previousPoint, vertex))
  const nextTangent = normalize(subtract(nextPoint, vertex))
  if (!previousTangent || !nextTangent) {
    return null
  }

  return {
    vertexAngle: radiansToDegrees(
      Math.acos(clamp(dot(previousTangent, nextTangent), -1, 1))
    ),
    previousTangent,
    nextTangent
  }
}

export const buildSourceVertexJoinFootprint = (
  input: SourceVertexJoinFootprintInput
): SourceVertexJoinFootprint => {
  const previousDirection = normalize(
    subtract(input.vertex, input.previousPoint)
  )
  const nextDirection = normalize(subtract(input.nextPoint, input.vertex))
  const angleEvidence = measureSourceVertexAngle(
    input.previousPoint,
    input.vertex,
    input.nextPoint
  )
  if (!previousDirection || !nextDirection || !angleEvidence) {
    return {
      polygon: [],
      polygons: [],
      ownerId: input.ownerId,
      ownerStage: 'Stroke Geometry source-vertex join assembly',
      visibleContributor: 'source-vertex-join',
      geometryBasis: 'canonical-join-footprint',
      side: input.side,
      authoredJoin: input.authoredJoin,
      resolvedJoin: 'degenerate-bevel',
      vertexAngle: 0,
      miterAngle: input.miterAngle,
      angleSource: input.angleSource,
      angleComparison: buildAngleComparison(0, input.miterAngle),
      previousTangent: { x: 0, y: 0 },
      nextTangent: { x: 0, y: 0 },
      previousOffsetEndpoint: input.vertex,
      nextOffsetEndpoint: input.vertex
    }
  }

  const offsetDistance = Math.max(
    0,
    Math.abs(input.offsetDistance ?? input.strokeWidth)
  )
  const previousNormal = normalForSide(previousDirection, input.side)
  const nextNormal = normalForSide(nextDirection, input.side)
  const previousOffsetStart = add(
    input.previousPoint,
    scale(previousNormal, offsetDistance)
  )
  const previousOffsetEndpoint = add(
    input.vertex,
    scale(previousNormal, offsetDistance)
  )
  const nextOffsetEndpoint = add(
    input.vertex,
    scale(nextNormal, offsetDistance)
  )
  const nextOffsetEnd = add(input.nextPoint, scale(nextNormal, offsetDistance))
  const previousJoinEndpoint =
    getIncidentProductBoundaryEndpoint(input, 'previous') ??
    previousOffsetEndpoint
  const nextJoinEndpoint =
    getIncidentProductBoundaryEndpoint(input, 'next') ?? nextOffsetEndpoint
  const previousIncidentBoundary = getIncidentProductBoundary(input, 'previous')
  const nextIncidentBoundary = getIncidentProductBoundary(input, 'next')
  const angleComparison = buildAngleComparison(
    angleEvidence.vertexAngle,
    input.miterAngle
  )
  const bevelPolygon = () => {
    const previousInnerEndpoint = getDistinctIncidentInnerEndpoint(
      previousIncidentBoundary
    )
    const nextInnerEndpoint =
      getDistinctIncidentInnerEndpoint(nextIncidentBoundary)
    const productBoundaryPolygon =
      previousInnerEndpoint && nextInnerEndpoint
        ? cleanFootprintPolygon([
            previousJoinEndpoint,
            nextJoinEndpoint,
            nextInnerEndpoint,
            previousInnerEndpoint
          ])
        : []
    return productBoundaryPolygon.length > 0
      ? productBoundaryPolygon
      : cleanFootprintPolygon([
          input.vertex,
          previousJoinEndpoint,
          nextJoinEndpoint
        ])
  }

  let resolvedJoin: SourceVertexJoinResolvedJoin
  let polygon: Vec2[]

  if (input.authoredJoin === 'bevel') {
    resolvedJoin = 'bevel'
    polygon = bevelPolygon()
  } else if (input.authoredJoin === 'round') {
    resolvedJoin = 'round'
    const previousInnerEndpoint = getDistinctIncidentInnerEndpoint(
      previousIncidentBoundary
    )
    const nextInnerEndpoint =
      getDistinctIncidentInnerEndpoint(nextIncidentBoundary)
    const incidentArcDirection = normalize(
      add(
        subtract(previousJoinEndpoint, input.vertex),
        subtract(nextJoinEndpoint, input.vertex)
      )
    )
    const selectedArcDirection =
      incidentArcDirection ?? normalize(add(previousNormal, nextNormal))
    const scoreRoundSweep = (sweepSign: 1 | -1) => {
      const arcPoints = buildRoundStrokeArcPointsBetween(
        input.vertex,
        previousJoinEndpoint,
        nextJoinEndpoint,
        sweepSign
      )
      const productBoundaryPolygon =
        previousInnerEndpoint && nextInnerEndpoint
          ? cleanFootprintPolygon([
              previousJoinEndpoint,
              ...arcPoints,
              nextJoinEndpoint,
              nextInnerEndpoint,
              previousInnerEndpoint
            ])
          : []
      const candidatePolygon =
        productBoundaryPolygon.length > 0
          ? productBoundaryPolygon
          : cleanFootprintPolygon([
              input.vertex,
              previousJoinEndpoint,
              ...arcPoints,
              nextJoinEndpoint
            ])
      const midpoint = arcPoints[Math.floor(arcPoints.length / 2)]
      const midpointDirection = midpoint
        ? normalize(subtract(midpoint, input.vertex))
        : null
      const selectedScore =
        selectedArcDirection && midpointDirection
          ? dot(selectedArcDirection, midpointDirection)
          : Number.NEGATIVE_INFINITY
      return {
        polygon: candidatePolygon,
        selectedScore,
        valid: candidatePolygon.length >= 3
      }
    }
    const selectedRoundSweep = [scoreRoundSweep(1), scoreRoundSweep(-1)].sort(
      (left, right) =>
        Number(right.valid) - Number(left.valid) ||
        right.selectedScore - left.selectedScore
    )[0]
    polygon =
      selectedRoundSweep?.polygon ??
      cleanFootprintPolygon([
        input.vertex,
        previousJoinEndpoint,
        nextJoinEndpoint
      ])
  } else if (angleEvidence.vertexAngle <= input.miterAngle + ANGLE_EPSILON) {
    resolvedJoin = 'bevel-by-miter-angle'
    polygon = bevelPolygon()
  } else {
    const miterPoint = lineIntersection(
      previousOffsetStart,
      previousOffsetEndpoint,
      nextOffsetEndpoint,
      nextOffsetEnd
    )
    if (miterPoint) {
      const previousInnerEndpoint = getDistinctIncidentInnerEndpoint(
        previousIncidentBoundary
      )
      const nextInnerEndpoint =
        getDistinctIncidentInnerEndpoint(nextIncidentBoundary)
      const productBoundaryPolygon =
        previousInnerEndpoint && nextInnerEndpoint
          ? cleanFootprintPolygon([
              previousInnerEndpoint,
              previousJoinEndpoint,
              miterPoint,
              nextJoinEndpoint,
              nextInnerEndpoint
            ])
          : []
      resolvedJoin = 'miter'
      polygon =
        productBoundaryPolygon.length > 0
          ? productBoundaryPolygon
          : cleanFootprintPolygon([
              previousJoinEndpoint,
              miterPoint,
              nextJoinEndpoint
            ])
    } else {
      resolvedJoin = 'degenerate-bevel'
      polygon = []
    }
  }

  polygon = preserveIncidentSeamEdges(
    polygon,
    previousIncidentBoundary,
    nextIncidentBoundary
  )

  const polygons = polygon.length > 0 ? [polygon] : []

  return {
    polygon,
    polygons,
    ownerId: input.ownerId,
    ownerStage: 'Stroke Geometry source-vertex join assembly',
    visibleContributor: 'source-vertex-join',
    geometryBasis: 'canonical-join-footprint',
    side: input.side,
    authoredJoin: input.authoredJoin,
    resolvedJoin,
    vertexAngle: angleEvidence.vertexAngle,
    miterAngle: input.miterAngle,
    angleSource: input.angleSource,
    angleComparison,
    previousTangent: angleEvidence.previousTangent,
    nextTangent: angleEvidence.nextTangent,
    previousOffsetEndpoint: previousJoinEndpoint,
    nextOffsetEndpoint: nextJoinEndpoint
  }
}

export interface SourceVertexJoinIncidentSeamBoundary {
  seamBoundaryId: string
  intervalId: string
  splitRangeId?: string
  splitRangeAliasIds?: string[]
  side: 'previous' | 'next'
  point: Vec2
  pointId?: string
  outerBodyBoundaryEndpoint: Vec2
  outerBodyBoundaryEndpointId?: string
  outerBodyBoundaryVertices: Vec2[]
  bodySideOutlineSegment: [Vec2, Vec2]
  bodySideOutlineSegmentId?: string
  bodySideTangent: Vec2
  selectedSide: SourceVertexJoinSide
  terminalRole: 'middle' | 'start' | 'end' | 'start-end'
  endpointCapPolicySignature: string
  capSuppressed: boolean
  sourceSegmentIndex?: number
}

export interface SourceVertexJoinProductInput
  extends SourceVertexJoinFootprintInput {
  productId: string
  productFamilyId: string
  sourceVertexId: string
  joinOwnership: 'source-vertex' | 'split-terminal' | 'smooth-continuity'
  smoothContinuity?: boolean
  highCurvatureSmooth?: boolean
  seamTolerance?: number
  incidentSeamBoundaries?: SourceVertexJoinIncidentSeamBoundary[]
}

export interface SourceVertexJoinProductUnit {
  productId: string
  productFamilyId: string
  productMode: 'pre-legality-source-vertex-join'
  sourceVertexId: string
  joinOwnership: 'source-vertex' | 'split-terminal'
  polygon: Vec2[]
  polygons: Vec2[][]
  bounds: {
    minX: number
    minY: number
    maxX: number
    maxY: number
  }
  ownerId: string
  ownerStage: 'Stroke Geometry source-vertex join assembly'
  visibleContributor: 'source-vertex-join'
  geometryBasis: 'canonical-join-footprint'
  authoredJoin: SourceVertexJoinAuthoredJoin
  resolvedJoin: SourceVertexJoinResolvedJoin
  vertexAngle: number
  miterAngle: number
  angleSource: SourceVertexJoinAngleSource
  angleComparison: SourceVertexJoinAngleComparison
  previousTangent: Vec2
  nextTangent: Vec2
  previousOffsetEndpoint: Vec2
  nextOffsetEndpoint: Vec2
  seamEvidence: {
    seamCoveragePolicy: 'shared-step-27-endpoint-identity'
    incidentSeamBoundaries: SourceVertexJoinIncidentSeamBoundary[]
  }
}

export interface BuildSourceVertexJoinProductsInput {
  joins: SourceVertexJoinProductInput[]
}

const getSourceVertexJoinBounds = (polygons: Vec2[][]) => {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  polygons.forEach((polygon) => {
    polygon.forEach((point) => {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    })
  })

  return {
    minX: Number.isFinite(minX) ? minX : 0,
    minY: Number.isFinite(minY) ? minY : 0,
    maxX: Number.isFinite(maxX) ? maxX : 0,
    maxY: Number.isFinite(maxY) ? maxY : 0
  }
}

export const buildSourceVertexJoinProducts = (
  input: BuildSourceVertexJoinProductsInput
): SourceVertexJoinProductUnit[] =>
  input.joins.flatMap((join): SourceVertexJoinProductUnit[] => {
    if (
      join.joinOwnership === 'smooth-continuity' ||
      join.smoothContinuity === true ||
      join.highCurvatureSmooth === true
    ) {
      return []
    }

    const footprint = buildSourceVertexJoinFootprint(join)
    const polygons =
      footprint.polygons.length > 0
        ? footprint.polygons
        : footprint.polygon.length > 0
          ? [footprint.polygon]
          : []
    return [
      {
        productId: join.productId,
        productFamilyId: join.productFamilyId,
        productMode: 'pre-legality-source-vertex-join',
        sourceVertexId: join.sourceVertexId,
        joinOwnership: join.joinOwnership,
        polygon: footprint.polygon,
        polygons,
        bounds: getSourceVertexJoinBounds(polygons),
        ownerId: footprint.ownerId,
        ownerStage: footprint.ownerStage,
        visibleContributor: footprint.visibleContributor,
        geometryBasis: footprint.geometryBasis,
        authoredJoin: footprint.authoredJoin,
        resolvedJoin: footprint.resolvedJoin,
        vertexAngle: footprint.vertexAngle,
        miterAngle: footprint.miterAngle,
        angleSource: footprint.angleSource,
        angleComparison: footprint.angleComparison,
        previousTangent: footprint.previousTangent,
        nextTangent: footprint.nextTangent,
        previousOffsetEndpoint: footprint.previousOffsetEndpoint,
        nextOffsetEndpoint: footprint.nextOffsetEndpoint,
        seamEvidence: {
          seamCoveragePolicy: 'shared-step-27-endpoint-identity',
          incidentSeamBoundaries: join.incidentSeamBoundaries ?? []
        }
      }
    ]
  })
