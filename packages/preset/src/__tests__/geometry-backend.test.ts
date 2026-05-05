import { describe, expect, it } from 'vitest'
import {
  DEFAULT_GEOMETRY_BACKEND_COORDINATE_POLICY,
  createGeometryBackendCapabilities,
  createGeometryBackendCoordinateMapper,
  createGeometryBackendRegistry,
  createUnsupportedGeometryBackend,
  getGeometryBackendCacheSignature,
  registerGeometryBackend,
  selectGeometryBackend,
  subscribeToGeometryBackendSelection,
  type ArrangementFace,
  type CandidateRegion,
  type FillRule,
  type GeometryBackend,
  type OffsetOptions,
  type PolygonRegion,
  type Vec2
} from '../components/stroke-render/geometry-backend'

describe('geometry backend contract', () => {
  it('should not run: hide missing exact boolean support behind silent empty output', () => {
    const backend = createUnsupportedGeometryBackend('test-backend')

    expect(backend.backendId).toBe('test-backend')
    expect(backend.backendVersion).toBe('0.0.0-unsupported')
    expect(backend.capabilities).toEqual({
      union: false,
      difference: false,
      intersection: false,
      offset: false,
      buildArrangement: false
    })
    expect(() => backend.union([], 'evenodd')).toThrow(
      'GeometryBackend operation "union" requires an exact geometry backend'
    )
    expect(() => backend.difference([], [], 'evenodd')).toThrow(
      'GeometryBackend operation "difference" requires an exact geometry backend'
    )
    expect(() => backend.intersection([], [], 'evenodd')).toThrow(
      'GeometryBackend operation "intersection" requires an exact geometry backend'
    )
    expect(() =>
      backend.offset([], 1, {
        width: 2,
        join: 'miter',
        cap: 'butt',
        miterLimit: 4,
        fillRule: 'evenodd'
      })
    ).toThrow(
      'GeometryBackend operation "offset" requires an exact geometry backend'
    )
    expect(() => backend.buildArrangement([])).toThrow(
      'GeometryBackend operation "buildArrangement" requires an exact geometry backend'
    )
  })

  it('should run: register, lazily resolve, and select an exact backend through the registry', () => {
    const calls: string[] = []
    const inputRegion: PolygonRegion = {
      polygons: [
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 }
        ]
      ]
    }
    const outputRegion: PolygonRegion = {
      polygons: [
        [
          { x: 1, y: 1 },
          { x: 9, y: 1 },
          { x: 9, y: 9 }
        ]
      ]
    }
    const candidate: CandidateRegion = {
      candidateId: 'candidate:1',
      geometry: inputRegion,
      visualPacketKey: 'visual:1',
      strokePosition: 'inside',
      ownerKey: 'owner:1',
      intervalId: 'interval:1',
      sourceSpanIds: ['span:1']
    }
    const face: ArrangementFace = {
      faceId: 'face:1',
      geometry: outputRegion,
      claimedBy: [candidate],
      legalState: {
        insideFillDomain: true,
        outsideFillDomain: false
      }
    }
    const mockBackend: GeometryBackend = {
      backendId: 'mock-exact',
      backendVersion: '1.0.0-test',
      capabilities: createGeometryBackendCapabilities(true),
      coordinatePolicy: DEFAULT_GEOMETRY_BACKEND_COORDINATE_POLICY,
      union: (regions: PolygonRegion[], fillRule: FillRule) => {
        calls.push(`union:${regions.length}:${fillRule}`)
        return [outputRegion]
      },
      difference: (
        subject: PolygonRegion[],
        clip: PolygonRegion[],
        fillRule: FillRule
      ) => {
        calls.push(`difference:${subject.length}:${clip.length}:${fillRule}`)
        return [outputRegion]
      },
      intersection: (
        subject: PolygonRegion[],
        clip: PolygonRegion[],
        fillRule: FillRule
      ) => {
        calls.push(`intersection:${subject.length}:${clip.length}:${fillRule}`)
        return [outputRegion]
      },
      offset: (
        path: Vec2[] | Vec2[][],
        distance: number,
        options: OffsetOptions
      ) => {
        calls.push(
          `offset:${Array.isArray(path[0]) ? 'multi' : 'single'}:${distance}:${options.fillRule}`
        )
        return [outputRegion]
      },
      buildArrangement: (candidates: CandidateRegion[]) => {
        calls.push(`buildArrangement:${candidates.length}`)
        return [face]
      }
    }
    const registry = createGeometryBackendRegistry()
    let loadCount = 0

    registry.register({
      backendId: 'mock-exact',
      load: () => {
        loadCount += 1
        return mockBackend
      }
    })

    expect(registry.listBackendIds()).toEqual([
      'unsupported-exact-geometry-backend',
      'mock-exact'
    ])
    expect(loadCount).toBe(0)

    registry.select('mock-exact')
    const resolved = registry.resolve()
    expect(registry.getActiveBackendId()).toBe('mock-exact')
    expect(resolved.backendId).toBe('mock-exact')
    expect(getGeometryBackendCacheSignature(resolved)).toBe(
      'mock-exact@1.0.0-test@scale:1000000@round:round@epsilon:0.000001'
    )
    expect(registry.resolve()).toBe(resolved)
    expect(loadCount).toBe(1)

    expect(resolved.union([inputRegion], 'evenodd')).toEqual([outputRegion])
    expect(
      resolved.difference([inputRegion], [outputRegion], 'nonzero')
    ).toEqual([outputRegion])
    expect(
      resolved.intersection([inputRegion], [outputRegion], 'evenodd')
    ).toEqual([outputRegion])
    expect(
      resolved.offset([{ x: 0, y: 0 }], 4, {
        width: 8,
        join: 'miter',
        cap: 'butt',
        miterLimit: 4,
        fillRule: 'nonzero'
      })
    ).toEqual([outputRegion])
    expect(resolved.buildArrangement([candidate])).toEqual([face])
    expect(calls).toEqual([
      'union:1:evenodd',
      'difference:1:1:nonzero',
      'intersection:1:1:evenodd',
      'offset:single:4:nonzero',
      'buildArrangement:1'
    ])
  })

  it('should run: notify render owners only when the selected exact backend changes', () => {
    const selectedBackendIds: string[] = []
    const unsubscribe = subscribeToGeometryBackendSelection((backendId) => {
      selectedBackendIds.push(backendId)
    })

    registerGeometryBackend({
      backendId: 'selection-listener-exact',
      load: () => createUnsupportedGeometryBackend('selection-listener-exact')
    })

    selectGeometryBackend('selection-listener-exact')
    selectGeometryBackend('selection-listener-exact')
    selectGeometryBackend('unsupported-exact-geometry-backend')
    unsubscribe()
    selectGeometryBackend('selection-listener-exact')
    selectGeometryBackend('unsupported-exact-geometry-backend')

    expect(selectedBackendIds).toEqual([
      'selection-listener-exact',
      'unsupported-exact-geometry-backend'
    ])
  })

  it('should not run: select an unregistered backend or accept mismatched lazy backend identity', () => {
    const registry = createGeometryBackendRegistry()

    expect(() => registry.select('missing')).toThrow(
      'GeometryBackend "missing" is not registered'
    )

    registry.register({
      backendId: 'declared',
      load: () => createUnsupportedGeometryBackend('actual')
    })
    registry.select('declared')

    expect(() => registry.resolve()).toThrow(
      'GeometryBackend registration "declared" loaded backend "actual"'
    )
  })

  it('should run: map model-space coordinates through a deterministic integer backend policy', () => {
    const mapper = createGeometryBackendCoordinateMapper()
    const backendPoint = mapper.toBackendPoint({
      x: 1.234_567_4,
      y: -0.000_000_4
    })
    const backendRegion = mapper.toBackendRegion({
      polygons: [
        [
          { x: 0.1, y: 0.2 },
          { x: 1.25, y: 2.5 }
        ]
      ]
    })

    expect(backendPoint).toEqual({ x: 1_234_567, y: 0 })
    expect(mapper.fromBackendPoint(backendPoint)).toEqual({
      x: 1.234_567,
      y: 0
    })
    expect(backendRegion).toEqual({
      polygons: [
        [
          { x: 100_000, y: 200_000 },
          { x: 1_250_000, y: 2_500_000 }
        ]
      ]
    })
    expect(mapper.fromBackendRegion(backendRegion)).toEqual({
      polygons: [
        [
          { x: 0.1, y: 0.2 },
          { x: 1.25, y: 2.5 }
        ]
      ]
    })
    expect(mapper.toBackendDistance(2.5)).toBe(2_500_000)
    expect(mapper.fromBackendDistance(2_500_000)).toBe(2.5)
  })

  it('should not run: accept non-finite or unsafe backend coordinate mapping inputs', () => {
    const mapper = createGeometryBackendCoordinateMapper()

    expect(() => mapper.toBackendPoint({ x: Number.NaN, y: 0 })).toThrow(
      'GeometryBackend coordinate "x" must be finite'
    )
    expect(() =>
      mapper.toBackendPoint({
        x: DEFAULT_GEOMETRY_BACKEND_COORDINATE_POLICY.maxAbsCoordinate + 1,
        y: 0
      })
    ).toThrow('GeometryBackend coordinate "x" exceeds safe scaling range')
    expect(() =>
      createGeometryBackendCoordinateMapper({
        ...DEFAULT_GEOMETRY_BACKEND_COORDINATE_POLICY,
        scale: 0
      })
    ).toThrow('GeometryBackend coordinate policy requires a positive scale')
  })
})
