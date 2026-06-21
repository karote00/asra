export interface Vec2 {
  x: number
  y: number
}

export type FillRule = 'evenodd' | 'nonzero'

export type StrokeOffsetJoin = 'miter' | 'round' | 'bevel'

export type StrokeOffsetCap = 'butt' | 'round' | 'square'

export type StrokeArrangementPosition = 'center' | 'inside' | 'outside'

export type GeometryBackendOperation =
  | 'union'
  | 'difference'
  | 'intersection'
  | 'offset'
  | 'buildArrangement'

export type GeometryBackendRoundingMode = 'round'

export interface GeometryBackendCapabilities
  extends Record<GeometryBackendOperation, boolean> {}

export interface GeometryBackendCoordinatePolicy {
  scale: number
  maxAbsCoordinate: number
  rounding: GeometryBackendRoundingMode
  epsilon: number
}

export interface PolygonRegion {
  polygons: Vec2[][]
}

export interface OffsetOptions {
  width: number
  join: StrokeOffsetJoin
  cap: StrokeOffsetCap
  closed?: boolean
  miterLimit: number
  fillRule: FillRule
}

export interface CandidateRegion {
  candidateId: string
  geometry: PolygonRegion
  visualPacketKey: string
  strokePosition: StrokeArrangementPosition
  sourcePathId?: string
  networkId?: string
  strokeId?: string
  strokeIndex?: number
  ownerKey?: string
  intervalId?: string
  contourId?: string
  legalDomainId?: string | null
  paintKey?: string
  strokeSpecKey?: string
  sourceSpanIds: string[]
  sourceContourIds?: string[]
  requiresBoundaryPreservingArrangement?: boolean
}

export interface ArrangementFace {
  faceId: string
  geometry: PolygonRegion
  claimedBy: CandidateRegion[]
  legalState: {
    insideFillDomain: boolean
    outsideFillDomain: boolean
  }
}

export interface GeometryBackend {
  backendId: string
  backendVersion: string
  capabilities: GeometryBackendCapabilities
  coordinatePolicy: GeometryBackendCoordinatePolicy
  union(regions: PolygonRegion[], fillRule: FillRule): PolygonRegion[]
  difference(
    subject: PolygonRegion[],
    clip: PolygonRegion[],
    fillRule: FillRule
  ): PolygonRegion[]
  intersection(
    subject: PolygonRegion[],
    clip: PolygonRegion[],
    fillRule: FillRule
  ): PolygonRegion[]
  offset(
    path: Vec2[] | Vec2[][],
    distance: number,
    options: OffsetOptions
  ): PolygonRegion[]
  buildArrangement(candidates: CandidateRegion[]): ArrangementFace[]
}

export interface GeometryBackendRegistration {
  backendId: string
  load: () => GeometryBackend
}

export interface GeometryBackendRegistry {
  register(registration: GeometryBackendRegistration): void
  select(backendId: string): void
  resolve(backendId?: string): GeometryBackend
  listBackendIds(): string[]
  getActiveBackendId(): string
}

export const ALL_GEOMETRY_BACKEND_OPERATIONS: GeometryBackendOperation[] = [
  'union',
  'difference',
  'intersection',
  'offset',
  'buildArrangement'
]

export const createGeometryBackendCapabilities = (
  enabled: boolean
): GeometryBackendCapabilities => ({
  union: enabled,
  difference: enabled,
  intersection: enabled,
  offset: enabled,
  buildArrangement: enabled
})

export const DEFAULT_GEOMETRY_BACKEND_COORDINATE_POLICY: GeometryBackendCoordinatePolicy =
  {
    scale: 1_000_000,
    maxAbsCoordinate: 9_000_000_000,
    rounding: 'round',
    epsilon: 0.000_001
  }

const validateCoordinatePolicy = (policy: GeometryBackendCoordinatePolicy) => {
  if (!Number.isFinite(policy.scale) || policy.scale <= 0) {
    throw new Error(
      'GeometryBackend coordinate policy requires a positive scale'
    )
  }
  if (
    !Number.isFinite(policy.maxAbsCoordinate) ||
    policy.maxAbsCoordinate <= 0
  ) {
    throw new Error(
      'GeometryBackend coordinate policy requires a positive maxAbsCoordinate'
    )
  }
  if (!Number.isFinite(policy.epsilon) || policy.epsilon <= 0) {
    throw new Error(
      'GeometryBackend coordinate policy requires a positive epsilon'
    )
  }
  if (policy.rounding !== 'round') {
    throw new Error(
      `GeometryBackend coordinate policy rounding "${policy.rounding}" is not recognized`
    )
  }
  if (
    !Number.isSafeInteger(Math.round(policy.maxAbsCoordinate * policy.scale))
  ) {
    throw new Error(
      'GeometryBackend coordinate policy exceeds JavaScript safe integer range'
    )
  }
}

const normalizeSignedZero = (value: number) =>
  Object.is(value, -0) ? 0 : value

const assertFiniteCoordinate = (value: number, label: string) => {
  if (!Number.isFinite(value)) {
    throw new Error(`GeometryBackend coordinate "${label}" must be finite`)
  }
}

const toBackendScalar = (
  value: number,
  label: string,
  policy: GeometryBackendCoordinatePolicy
) => {
  assertFiniteCoordinate(value, label)
  if (Math.abs(value) > policy.maxAbsCoordinate) {
    throw new Error(
      `GeometryBackend coordinate "${label}" exceeds safe scaling range`
    )
  }

  const scaled = normalizeSignedZero(Math.round(value * policy.scale))
  if (!Number.isSafeInteger(scaled)) {
    throw new Error(
      `GeometryBackend coordinate "${label}" exceeds JavaScript safe integer range`
    )
  }

  return scaled
}

const fromBackendScalar = (value: number, label: string, scale: number) => {
  assertFiniteCoordinate(value, label)
  return normalizeSignedZero(value / scale)
}

export const createGeometryBackendCoordinateMapper = (
  policy = DEFAULT_GEOMETRY_BACKEND_COORDINATE_POLICY
) => {
  validateCoordinatePolicy(policy)

  return {
    toBackendPoint: (point: Vec2): Vec2 => ({
      x: toBackendScalar(point.x, 'x', policy),
      y: toBackendScalar(point.y, 'y', policy)
    }),
    fromBackendPoint: (point: Vec2): Vec2 => ({
      x: fromBackendScalar(point.x, 'x', policy.scale),
      y: fromBackendScalar(point.y, 'y', policy.scale)
    }),
    toBackendPolygon: (polygon: Vec2[]): Vec2[] =>
      polygon.map((point) => ({
        x: toBackendScalar(point.x, 'x', policy),
        y: toBackendScalar(point.y, 'y', policy)
      })),
    fromBackendPolygon: (polygon: Vec2[]): Vec2[] =>
      polygon.map((point) => ({
        x: fromBackendScalar(point.x, 'x', policy.scale),
        y: fromBackendScalar(point.y, 'y', policy.scale)
      })),
    toBackendRegion: (region: PolygonRegion): PolygonRegion => ({
      polygons: region.polygons.map((polygon) =>
        polygon.map((point) => ({
          x: toBackendScalar(point.x, 'x', policy),
          y: toBackendScalar(point.y, 'y', policy)
        }))
      )
    }),
    fromBackendRegion: (region: PolygonRegion): PolygonRegion => ({
      polygons: region.polygons.map((polygon) =>
        polygon.map((point) => ({
          x: fromBackendScalar(point.x, 'x', policy.scale),
          y: fromBackendScalar(point.y, 'y', policy.scale)
        }))
      )
    }),
    toBackendDistance: (distance: number): number =>
      toBackendScalar(distance, 'distance', policy),
    fromBackendDistance: (distance: number): number =>
      fromBackendScalar(distance, 'distance', policy.scale),
    getPolicy: () => policy
  }
}

export const getGeometryBackendCacheSignature = (backend: GeometryBackend) =>
  [
    backend.backendId,
    backend.backendVersion,
    `scale:${backend.coordinatePolicy.scale}`,
    `round:${backend.coordinatePolicy.rounding}`,
    `epsilon:${backend.coordinatePolicy.epsilon}`
  ].join('@')

const throwMissingBackend = (operation: string): never => {
  throw new Error(
    `GeometryBackend operation "${operation}" requires an exact geometry backend`
  )
}

export const createMissingGeometryBackend = (
  backendId = 'diagnostic-missing-exact-geometry-backend'
): GeometryBackend => ({
  backendId,
  backendVersion: '0.0.0-diagnostic-missing',
  capabilities: createGeometryBackendCapabilities(false),
  coordinatePolicy: DEFAULT_GEOMETRY_BACKEND_COORDINATE_POLICY,
  union: () => throwMissingBackend('union'),
  difference: () => throwMissingBackend('difference'),
  intersection: () => throwMissingBackend('intersection'),
  offset: () => throwMissingBackend('offset'),
  buildArrangement: () => throwMissingBackend('buildArrangement')
})

const MISSING_BACKEND_ID = 'diagnostic-missing-exact-geometry-backend'

const validateBackendId = (backendId: string) => {
  if (!backendId.trim()) {
    throw new Error(
      'GeometryBackend registration requires a non-empty backendId'
    )
  }
}

const validateBackendMetadata = (backend: GeometryBackend) => {
  validateBackendId(backend.backendId)
  if (!backend.backendVersion.trim()) {
    throw new Error(
      `GeometryBackend "${backend.backendId}" requires a non-empty backendVersion`
    )
  }
  validateCoordinatePolicy(backend.coordinatePolicy)
  for (const operation of ALL_GEOMETRY_BACKEND_OPERATIONS) {
    if (typeof backend.capabilities[operation] !== 'boolean') {
      throw new Error(
        `GeometryBackend "${backend.backendId}" capability "${operation}" must be boolean`
      )
    }
  }
}

const createCachedRegistration = (
  registration: GeometryBackendRegistration
) => {
  validateBackendId(registration.backendId)
  let resolvedBackend: GeometryBackend | null = null

  return {
    backendId: registration.backendId,
    resolve: () => {
      if (!resolvedBackend) {
        resolvedBackend = registration.load()
        validateBackendMetadata(resolvedBackend)
        if (resolvedBackend.backendId !== registration.backendId) {
          throw new Error(
            `GeometryBackend registration "${registration.backendId}" loaded backend "${resolvedBackend.backendId}"`
          )
        }
      }

      return resolvedBackend
    }
  }
}

export const createGeometryBackendRegistry = (
  missingBackendId = MISSING_BACKEND_ID
): GeometryBackendRegistry => {
  const registrations = new Map<
    string,
    ReturnType<typeof createCachedRegistration>
  >()
  let activeBackendId = missingBackendId

  const registry: GeometryBackendRegistry = {
    register: (registration) => {
      validateBackendId(registration.backendId)
      registrations.set(
        registration.backendId,
        createCachedRegistration(registration)
      )
    },
    select: (backendId) => {
      validateBackendId(backendId)
      if (!registrations.has(backendId)) {
        throw new Error(`GeometryBackend "${backendId}" is not registered`)
      }
      activeBackendId = backendId
    },
    resolve: (backendId = activeBackendId) => {
      validateBackendId(backendId)
      const registration = registrations.get(backendId)
      if (!registration) {
        throw new Error(`GeometryBackend "${backendId}" is not registered`)
      }

      return registration.resolve()
    },
    listBackendIds: () => [...registrations.keys()],
    getActiveBackendId: () => activeBackendId
  }

  registry.register({
    backendId: missingBackendId,
    load: () => createMissingGeometryBackend(missingBackendId)
  })

  return registry
}

const defaultGeometryBackendRegistry = createGeometryBackendRegistry()
const geometryBackendSelectionListeners = new Set<(backendId: string) => void>()

const notifyGeometryBackendSelection = (backendId: string) => {
  geometryBackendSelectionListeners.forEach((listener) => {
    listener(backendId)
  })
}

export const subscribeToGeometryBackendSelection = (
  listener: (backendId: string) => void
): (() => void) => {
  geometryBackendSelectionListeners.add(listener)

  return () => {
    geometryBackendSelectionListeners.delete(listener)
  }
}

export const registerGeometryBackend = (
  registration: GeometryBackendRegistration
) => defaultGeometryBackendRegistry.register(registration)

export const selectGeometryBackend = (backendId: string) => {
  const previousBackendId = defaultGeometryBackendRegistry.getActiveBackendId()
  defaultGeometryBackendRegistry.select(backendId)
  if (previousBackendId !== backendId) {
    notifyGeometryBackendSelection(backendId)
  }
}

export const getGeometryBackend = (backendId?: string) =>
  defaultGeometryBackendRegistry.resolve(backendId)

export const listGeometryBackendIds = () =>
  defaultGeometryBackendRegistry.listBackendIds()

export const getActiveGeometryBackendId = () =>
  defaultGeometryBackendRegistry.getActiveBackendId()
