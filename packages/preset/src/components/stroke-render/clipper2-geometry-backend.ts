import {
  DEFAULT_GEOMETRY_BACKEND_COORDINATE_POLICY,
  createGeometryBackendCapabilities,
  createGeometryBackendCoordinateMapper,
  registerGeometryBackend,
  selectGeometryBackend,
  type ArrangementFace,
  type CandidateRegion,
  type FillRule,
  type GeometryBackend,
  type GeometryBackendRegistration,
  type GeometryBackendCoordinatePolicy,
  type OffsetOptions,
  type PolygonRegion,
  type StrokeOffsetCap,
  type StrokeOffsetJoin,
  type Vec2
} from './geometry-backend'
import clipper2WasmUrl from 'clipper2-wasm/dist/es/clipper2z.wasm?url'

interface ClipperEnumValue {
  value: number
}

interface ClipperPoint64 {
  x: bigint
  y: bigint
  delete(): void
}

interface ClipperPath64 {
  push_back(point: ClipperPoint64): void
  size(): number
  get(index: number): ClipperPoint64
  delete(): void
}

interface ClipperPaths64 {
  push_back(path: ClipperPath64): void
  size(): number
  get(index: number): ClipperPath64
  delete(): void
}

export interface Clipper2Module {
  FillRule: {
    EvenOdd: ClipperEnumValue
    NonZero: ClipperEnumValue
  }
  ClipType: {
    Intersection: ClipperEnumValue
    Union: ClipperEnumValue
    Difference: ClipperEnumValue
  }
  JoinType: {
    Square: ClipperEnumValue
    Round: ClipperEnumValue
    Miter: ClipperEnumValue
  }
  EndType: {
    Polygon: ClipperEnumValue
    Butt: ClipperEnumValue
    Square: ClipperEnumValue
    Round: ClipperEnumValue
  }
  Point64: new (x: bigint, y: bigint, z: bigint) => ClipperPoint64
  Path64: new () => ClipperPath64
  Paths64: new () => ClipperPaths64
  UnionSelf64(paths: ClipperPaths64, fillRule: ClipperEnumValue): ClipperPaths64
  Union64(
    subject: ClipperPaths64,
    clip: ClipperPaths64,
    fillRule: ClipperEnumValue
  ): ClipperPaths64
  Difference64(
    subject: ClipperPaths64,
    clip: ClipperPaths64,
    fillRule: ClipperEnumValue
  ): ClipperPaths64
  Intersect64(
    subject: ClipperPaths64,
    clip: ClipperPaths64,
    fillRule: ClipperEnumValue
  ): ClipperPaths64
  InflatePaths64(
    paths: ClipperPaths64,
    delta: number,
    joinType: ClipperEnumValue,
    endType: ClipperEnumValue,
    miterLimit: number,
    arcTolerance: number
  ): ClipperPaths64
}

export interface Clipper2GeometryBackendOptions {
  backendId?: string
  backendVersion?: string
  coordinatePolicy?: GeometryBackendCoordinatePolicy
}

export interface LoadClipper2GeometryBackendOptions
  extends Clipper2GeometryBackendOptions {
  factoryOptions?: unknown
}

const DEFAULT_OPERATION_CACHE_LIMIT = 256
const OFFSET_ARC_TOLERANCE = 0.1

const toClipperFillRule = (module: Clipper2Module, fillRule: FillRule) =>
  fillRule === 'evenodd' ? module.FillRule.EvenOdd : module.FillRule.NonZero

const toClipperJoinType = (module: Clipper2Module, join: StrokeOffsetJoin) => {
  if (join === 'round') {
    return module.JoinType.Round
  }
  if (join === 'miter') {
    return module.JoinType.Miter
  }

  return module.JoinType.Square
}

const toClipperEndType = (
  module: Clipper2Module,
  cap: StrokeOffsetCap,
  closed: boolean
) => {
  if (closed) {
    return module.EndType.Polygon
  }
  if (cap === 'round') {
    return module.EndType.Round
  }
  if (cap === 'square') {
    return module.EndType.Square
  }

  return module.EndType.Butt
}

const isPointArray = (path: Vec2[] | Vec2[][]): path is Vec2[] =>
  path.length === 0 || !Array.isArray(path[0])

const hasRegionGeometry = (region: PolygonRegion) =>
  region.polygons.some((polygon) => polygon.length >= 3)

const cloneRegions = (regions: PolygonRegion[]): PolygonRegion[] =>
  regions.map((region) => ({
    polygons: region.polygons.map((polygon) =>
      polygon.map((point) => ({ x: point.x, y: point.y }))
    )
  }))

const cloneArrangementFaces = (
  faces: ArrangementFace[],
  candidateById: Map<string, CandidateRegion>
): ArrangementFace[] =>
  faces.map((face) => ({
    faceId: face.faceId,
    geometry: cloneRegions([face.geometry])[0] ?? { polygons: [] },
    claimedBy: face.claimedBy
      .map((candidate) => candidateById.get(candidate.candidateId))
      .filter((candidate): candidate is CandidateRegion => Boolean(candidate)),
    legalState: { ...face.legalState }
  }))

const pointKey = (point: Vec2) => `${point.x},${point.y}`

const regionsKey = (regions: PolygonRegion[]) =>
  regions
    .map((region) =>
      region.polygons
        .map((polygon) => polygon.map(pointKey).join(';'))
        .join('||')
    )
    .join('|||')

const pathKey = (path: Vec2[] | Vec2[][]) =>
  isPointArray(path)
    ? path.map(pointKey).join(';')
    : path.map((polygon) => polygon.map(pointKey).join(';')).join('||')

const candidateKey = (candidates: CandidateRegion[]) =>
  candidates
    .map((candidate) =>
      [
        candidate.candidateId,
        candidate.visualPacketKey,
        candidate.strokePosition,
        candidate.paintKey ?? '',
        candidate.strokeSpecKey ?? '',
        regionsKey([candidate.geometry])
      ].join('|')
    )
    .join('|||')

const createBoundedCache = <T>(limit = DEFAULT_OPERATION_CACHE_LIMIT) => {
  const cache = new Map<string, T>()

  return {
    get(key: string) {
      const value = cache.get(key)
      if (value === undefined) {
        return undefined
      }

      cache.delete(key)
      cache.set(key, value)
      return value
    },
    set(key: string, value: T) {
      if (cache.has(key)) {
        cache.delete(key)
      }
      cache.set(key, value)
      if (cache.size > limit) {
        const oldestKey = cache.keys().next().value as string | undefined
        if (oldestKey !== undefined) {
          cache.delete(oldestKey)
        }
      }
    }
  }
}

export const createClipper2GeometryBackend = (
  module: Clipper2Module,
  options: Clipper2GeometryBackendOptions = {}
): GeometryBackend => {
  const coordinatePolicy =
    options.coordinatePolicy ?? DEFAULT_GEOMETRY_BACKEND_COORDINATE_POLICY
  const mapper = createGeometryBackendCoordinateMapper(coordinatePolicy)
  const regionCache = createBoundedCache<PolygonRegion[]>()
  const arrangementCache = createBoundedCache<ArrangementFace[]>()

  const pathToClipperPath = (points: Vec2[]) => {
    const backendPoints = mapper.toBackendPolygon(points)
    const path = new module.Path64()

    backendPoints.forEach((point) => {
      const clipperPoint = new module.Point64(
        BigInt(point.x),
        BigInt(point.y),
        0n
      )
      path.push_back(clipperPoint)
      clipperPoint.delete()
    })

    return path
  }

  const regionsToClipperPaths = (regions: PolygonRegion[]) => {
    const paths = new module.Paths64()
    const ownedPaths: ClipperPath64[] = []

    regions.forEach((region) => {
      region.polygons.forEach((polygon) => {
        if (polygon.length < 2) {
          return
        }
        const path = pathToClipperPath(polygon)
        paths.push_back(path)
        ownedPaths.push(path)
      })
    })

    return {
      paths,
      delete: () => {
        ownedPaths.forEach((path) => path.delete())
        paths.delete()
      }
    }
  }

  const vectorPathToClipperPaths = (path: Vec2[] | Vec2[][]) => {
    const polygons = isPointArray(path) ? [path] : path
    return regionsToClipperPaths([{ polygons }])
  }

  const clipperPathsToRegions = (paths: ClipperPaths64): PolygonRegion[] => {
    const polygons: Vec2[][] = []

    for (let pathIndex = 0; pathIndex < paths.size(); pathIndex += 1) {
      const path = paths.get(pathIndex)
      const polygon: Vec2[] = []

      for (let pointIndex = 0; pointIndex < path.size(); pointIndex += 1) {
        const point = path.get(pointIndex)
        polygon.push(
          mapper.fromBackendPoint({
            x: Number(point.x),
            y: Number(point.y)
          })
        )
      }

      if (polygon.length >= 2) {
        polygons.push(polygon)
      }
    }

    return polygons.length > 0 ? [{ polygons }] : []
  }

  const runBinaryOperation = (
    cachePrefix: string,
    operation: (
      subject: ClipperPaths64,
      clip: ClipperPaths64,
      fillRule: ClipperEnumValue
    ) => ClipperPaths64,
    subject: PolygonRegion[],
    clip: PolygonRegion[],
    fillRule: FillRule
  ) => {
    const cacheKey = `${cachePrefix}|${fillRule}|${regionsKey(subject)}|${regionsKey(clip)}`
    const cached = regionCache.get(cacheKey)
    if (cached) {
      return cloneRegions(cached)
    }

    const subjectPaths = regionsToClipperPaths(subject)
    const clipPaths = regionsToClipperPaths(clip)
    let outputPaths: ClipperPaths64 | null = null

    try {
      outputPaths = operation(
        subjectPaths.paths,
        clipPaths.paths,
        toClipperFillRule(module, fillRule)
      )
      const result = clipperPathsToRegions(outputPaths)
      regionCache.set(cacheKey, cloneRegions(result))
      return result
    } finally {
      outputPaths?.delete()
      subjectPaths.delete()
      clipPaths.delete()
    }
  }

  const unionRegions = (
    regions: PolygonRegion[],
    fillRule: FillRule
  ): PolygonRegion[] => {
    const cacheKey = `union|${fillRule}|${regionsKey(regions)}`
    const cached = regionCache.get(cacheKey)
    if (cached) {
      return cloneRegions(cached)
    }

    const paths = regionsToClipperPaths(regions)
    let outputPaths: ClipperPaths64 | null = null

    try {
      outputPaths = module.UnionSelf64(
        paths.paths,
        toClipperFillRule(module, fillRule)
      )
      const result = clipperPathsToRegions(outputPaths)
      regionCache.set(cacheKey, cloneRegions(result))
      return result
    } finally {
      outputPaths?.delete()
      paths.delete()
    }
  }

  const differenceRegions = (
    subject: PolygonRegion[],
    clip: PolygonRegion[],
    fillRule: FillRule
  ) =>
    runBinaryOperation(
      'difference',
      module.Difference64.bind(module),
      subject,
      clip,
      fillRule
    )

  const intersectionRegions = (
    subject: PolygonRegion[],
    clip: PolygonRegion[],
    fillRule: FillRule
  ) =>
    runBinaryOperation(
      'intersection',
      module.Intersect64.bind(module),
      subject,
      clip,
      fillRule
    )

  const buildArrangement = (
    candidates: CandidateRegion[]
  ): ArrangementFace[] => {
    const cacheKey = `arrangement|${candidateKey(candidates)}`
    const candidateById = new Map(
      candidates.map((candidate) => [candidate.candidateId, candidate])
    )
    const cached = arrangementCache.get(cacheKey)
    if (cached) {
      return cloneArrangementFaces(cached, candidateById)
    }

    interface Atom {
      geometry: PolygonRegion
      claimedBy: CandidateRegion[]
    }

    let atoms: Atom[] = []

    candidates.forEach((candidate) => {
      if (!hasRegionGeometry(candidate.geometry)) {
        return
      }

      const candidateRegions = unionRegions([candidate.geometry], 'nonzero')
      if (candidateRegions.length === 0) {
        return
      }
      const normalizedCandidate: CandidateRegion = {
        ...candidate,
        geometry: {
          polygons: candidateRegions.flatMap((region) => region.polygons)
        }
      }

      const nextAtoms: Atom[] = []
      let remaining: PolygonRegion[] = candidateRegions

      atoms.forEach((atom) => {
        const overlap = intersectionRegions(
          [atom.geometry],
          candidateRegions,
          'nonzero'
        )
        if (overlap.length === 0) {
          nextAtoms.push(atom)
        } else {
          const atomOnly = differenceRegions(
            [atom.geometry],
            [candidate.geometry],
            'nonzero'
          )
          atomOnly.forEach((geometry) =>
            nextAtoms.push({
              geometry,
              claimedBy: atom.claimedBy
            })
          )
          overlap.forEach((geometry) =>
            nextAtoms.push({
              geometry,
              claimedBy: [...atom.claimedBy, normalizedCandidate]
            })
          )
        }

        remaining = differenceRegions(remaining, [atom.geometry], 'nonzero')
      })

      remaining.forEach((geometry) =>
        nextAtoms.push({
          geometry,
          claimedBy: [normalizedCandidate]
        })
      )
      atoms = nextAtoms
    })

    const result = atoms
      .filter((atom) => hasRegionGeometry(atom.geometry))
      .map((atom, index) => ({
        faceId: `clipper2-arrangement-face:${index}`,
        geometry: atom.geometry,
        claimedBy: atom.claimedBy,
        legalState: {
          insideFillDomain: true,
          outsideFillDomain: true
        }
      }))

    arrangementCache.set(cacheKey, cloneArrangementFaces(result, candidateById))
    return result
  }

  return {
    backendId: options.backendId ?? 'clipper2-wasm',
    backendVersion: options.backendVersion ?? 'clipper2-wasm@0.2.1',
    capabilities: {
      ...createGeometryBackendCapabilities(true),
      buildArrangement: true
    },
    coordinatePolicy,
    union: unionRegions,
    difference: differenceRegions,
    intersection: intersectionRegions,
    offset: (path, distance, offsetOptions: OffsetOptions) => {
      const closed = offsetOptions.closed ?? !isPointArray(path)
      const cacheKey = [
        'offset',
        distance,
        offsetOptions.join,
        offsetOptions.cap,
        offsetOptions.miterLimit,
        OFFSET_ARC_TOLERANCE,
        closed,
        pathKey(path)
      ].join('|')
      const cached = regionCache.get(cacheKey)
      if (cached) {
        return cloneRegions(cached)
      }

      const sourcePaths = vectorPathToClipperPaths(path)
      const backendDistance = mapper.toBackendDistance(distance)
      let outputPaths: ClipperPaths64 | null = null

      try {
        outputPaths = module.InflatePaths64(
          sourcePaths.paths,
          backendDistance,
          toClipperJoinType(module, offsetOptions.join),
          toClipperEndType(module, offsetOptions.cap, closed),
          offsetOptions.miterLimit,
          mapper.toBackendDistance(OFFSET_ARC_TOLERANCE)
        )
        const result = clipperPathsToRegions(outputPaths)
        regionCache.set(cacheKey, cloneRegions(result))
        return result
      } finally {
        outputPaths?.delete()
        sourcePaths.delete()
      }
    },
    buildArrangement
  }
}

export const loadClipper2GeometryBackend = async (
  options: LoadClipper2GeometryBackendOptions = {}
): Promise<GeometryBackend> => {
  const factoryModule = await import('clipper2-wasm')
  const createClipper2Module = factoryModule.default as (
    factoryOptions?: unknown
  ) => Promise<Clipper2Module>
  const factoryOptions =
    typeof options.factoryOptions === 'object' &&
    options.factoryOptions !== null
      ? {
          locateFile: (path: string) =>
            path.endsWith('.wasm') ? clipper2WasmUrl : path,
          ...options.factoryOptions
        }
      : {
          locateFile: (path: string) =>
            path.endsWith('.wasm') ? clipper2WasmUrl : path
        }
  const module = await createClipper2Module(factoryOptions)

  return createClipper2GeometryBackend(module, options)
}

export const createClipper2GeometryBackendRegistration = (
  backend: GeometryBackend
): GeometryBackendRegistration => ({
  backendId: backend.backendId,
  load: () => backend
})

export const loadAndRegisterClipper2GeometryBackend = async (
  options: LoadClipper2GeometryBackendOptions & { select?: boolean } = {}
): Promise<GeometryBackend> => {
  const backend = await loadClipper2GeometryBackend(options)

  registerGeometryBackend(createClipper2GeometryBackendRegistration(backend))
  if (options.select ?? true) {
    selectGeometryBackend(backend.backendId)
  }

  return backend
}
