import { describe, expect, it } from 'vitest'
import {
  buildDashIntervalBodyProducts,
  buildSmoothContinuityProducts,
  buildTerminalBodyProducts
} from '../../components/stroke-render/constrained-dashed-stroke-packets'
import {
  buildSourceVertexJoinFootprint,
  buildSourceVertexJoinProducts,
  measureSourceVertexAngle
} from '../../components/stroke-render/source-vertex-join-footprint'
import { materializeStrokeProductDescriptors } from '../../components/stroke-render/stroke-render-descriptor'
import type { Vec2 } from '../../components/stroke-render/solid-stroke-geometry-core'

const vector34SharpAcute = {
  previousPoint: { x: 1736.9285752346282, y: 1637.0696495055142 },
  vertex: { x: 1524.996880430307, y: 2084.8608111081926 },
  nextPoint: { x: 1878.7860806278431, y: 1801.1458003217629 }
}

const endpointCapPolicy = {
  terminalRole: 'start' as const,
  startCap: false,
  endCap: false,
  suppressStartCap: true,
  suppressEndCap: true,
  signature: 'cap-policy:join-owned'
}

const distance = (first: Vec2, second: Vec2) =>
  Math.hypot(first.x - second.x, first.y - second.y)

const maxDistanceFrom = (origin: Vec2, polygon: Vec2[]) =>
  Math.max(...polygon.map((point) => distance(origin, point)))

const minDistanceToPolygonPoints = (point: Vec2, polygon: Vec2[]) =>
  Math.min(...polygon.map((candidate) => distance(point, candidate)))

const buildVector34Join = (authoredJoin: 'miter' | 'bevel' | 'round') =>
  buildSourceVertexJoinFootprint({
    ...vector34SharpAcute,
    strokeWidth: 10,
    side: 'left',
    authoredJoin,
    miterAngle: 28.96,
    ownerId: `owner:vector34:${authoredJoin}`,
    angleSource: 'CONTOUR_VISIT_INCIDENT_TANGENTS'
  })

describe('formal stroke geometry oracle: join and dash product semantics', () => {
  it('keeps vector-34 high-acute miter local and preserves bevel-by-miter-angle provenance', () => {
    const angle = measureSourceVertexAngle(
      vector34SharpAcute.previousPoint,
      vector34SharpAcute.vertex,
      vector34SharpAcute.nextPoint
    )
    const miter = buildVector34Join('miter')
    const bevel = buildVector34Join('bevel')
    const round = buildVector34Join('round')

    expect(angle?.vertexAngle).toBeLessThanOrEqual(28.96)
    expect(miter).toEqual(
      expect.objectContaining({
        ownerStage: 'Stroke Geometry source-vertex join assembly',
        visibleContributor: 'source-vertex-join',
        geometryBasis: 'canonical-join-footprint',
        authoredJoin: 'miter',
        resolvedJoin: 'bevel-by-miter-angle',
        angleSource: 'CONTOUR_VISIT_INCIDENT_TANGENTS',
        angleComparison: {
          operator: '<=',
          result: true,
          epsilon: 0.000001
        }
      })
    )
    expect(miter.polygon).toHaveLength(3)
    expect(
      maxDistanceFrom(vector34SharpAcute.vertex, miter.polygon)
    ).toBeLessThanOrEqual(20.5)
    expect(bevel.polygon).toHaveLength(3)
    expect(round.resolvedJoin).toBe('round')
    expect(round.polygon.length).toBeGreaterThan(3)
    expect(
      maxDistanceFrom(vector34SharpAcute.vertex, round.polygon)
    ).toBeLessThanOrEqual(20.5)
  })

  it('resolves miter-angle equality and epsilon-band cases to bevel-by-miter-angle only from source-domain evidence', () => {
    const previousPoint = { x: -100, y: 0 }
    const vertex = { x: 0, y: 0 }
    const nextPoint = {
      x: -Math.cos(Math.PI / 6) * 100,
      y: Math.sin(Math.PI / 6) * 100
    }
    const angle = measureSourceVertexAngle(previousPoint, vertex, nextPoint)
    expect(angle).not.toBeNull()
    const vertexAngle = angle?.vertexAngle ?? 0
    const common = {
      previousPoint,
      vertex,
      nextPoint,
      strokeWidth: 10,
      side: 'left' as const,
      authoredJoin: 'miter' as const,
      ownerId: 'owner:miter-epsilon',
      angleSource: 'AUTHORED_CENTER_PATH_INCIDENT_TANGENTS' as const
    }

    const exactEquality = buildSourceVertexJoinFootprint({
      ...common,
      miterAngle: vertexAngle
    })
    const epsilonBand = buildSourceVertexJoinFootprint({
      ...common,
      miterAngle: vertexAngle - 0.000001
    })
    const aboveEpsilon = buildSourceVertexJoinFootprint({
      ...common,
      miterAngle: vertexAngle - 0.000002
    })

    expect(exactEquality).toMatchObject({
      authoredJoin: 'miter',
      resolvedJoin: 'bevel-by-miter-angle',
      vertexAngle,
      miterAngle: vertexAngle,
      angleSource: 'AUTHORED_CENTER_PATH_INCIDENT_TANGENTS',
      angleComparison: {
        operator: '<=',
        result: true,
        epsilon: 0.000001
      }
    })
    expect(epsilonBand).toMatchObject({
      resolvedJoin: 'bevel-by-miter-angle',
      angleComparison: {
        operator: '<=',
        result: true,
        epsilon: 0.000001
      }
    })
    expect(aboveEpsilon).toMatchObject({
      resolvedJoin: 'miter',
      angleComparison: {
        operator: '>',
        result: true,
        epsilon: 0.000001
      }
    })
  })

  it('distinguishes miter, bevel, and round footprints on ordinary acute joins while keeping seam endpoints on the canonical footprint', () => {
    const common = {
      vertex: { x: 0, y: 0 },
      previousPoint: { x: -100, y: 50 },
      nextPoint: { x: 100, y: 50 },
      strokeWidth: 10,
      miterAngle: 28.96,
      ownerId: 'owner:ordinary-acute',
      angleSource: 'AUTHORED_CENTER_PATH_INCIDENT_TANGENTS' as const
    }
    const miter = buildSourceVertexJoinFootprint({
      ...common,
      side: 'left',
      authoredJoin: 'miter'
    })
    const bevel = buildSourceVertexJoinFootprint({
      ...common,
      side: 'left',
      authoredJoin: 'bevel'
    })
    const round = buildSourceVertexJoinFootprint({
      ...common,
      side: 'left',
      authoredJoin: 'round'
    })
    const rightSideMiter = buildSourceVertexJoinFootprint({
      ...common,
      side: 'right',
      authoredJoin: 'miter'
    })

    expect(miter.resolvedJoin).toBe('miter')
    expect(maxDistanceFrom(common.vertex, miter.polygon)).toBeGreaterThan(
      maxDistanceFrom(common.vertex, bevel.polygon)
    )
    expect(round.polygon.length).toBeGreaterThan(bevel.polygon.length)
    expect(rightSideMiter.previousOffsetEndpoint).not.toEqual(
      miter.previousOffsetEndpoint
    )
    expect(
      minDistanceToPolygonPoints(miter.previousOffsetEndpoint, miter.polygon)
    ).toBeLessThanOrEqual(0.000001)
    expect(
      minDistanceToPolygonPoints(miter.nextOffsetEndpoint, miter.polygon)
    ).toBeLessThanOrEqual(0.000001)
  })

  it('keeps dash bodies and source-vertex joins seam-compatible without duplicate interval paint', () => {
    const [join] = buildSourceVertexJoinProducts({
      joins: [
        {
          productId: 'join:seam',
          productFamilyId: 'constrained-dashed',
          sourceVertexId: 'source-vertex:seam',
          joinOwnership: 'source-vertex',
          vertex: { x: 0, y: 0 },
          previousPoint: { x: -100, y: 0 },
          nextPoint: { x: 80, y: 40 },
          strokeWidth: 10,
          side: 'left',
          authoredJoin: 'bevel',
          miterAngle: 28.96,
          ownerId: 'owner:seam',
          angleSource: 'CONTOUR_VISIT_INCIDENT_TANGENTS'
        }
      ]
    })
    const [body] = buildDashIntervalBodyProducts({
      productFamilyId: 'constrained-dashed',
      cachePrefix: 'oracle',
      legalSideId: 'legal:seam',
      intervals: [
        {
          intervalId: 'interval:seam',
          kind: 'visible',
          seamBoundaryId: 'seam:join',
          terminalRole: 'start',
          endpointCapPolicy,
          bodyPolygons: [
            [
              join.previousOffsetEndpoint,
              { x: -40, y: 10 },
              { x: -40, y: 0 },
              { x: 0, y: 0 },
              join.nextOffsetEndpoint
            ]
          ]
        },
        {
          intervalId: 'interval:seam',
          kind: 'visible',
          seamBoundaryId: 'seam:duplicate',
          terminalRole: 'start',
          endpointCapPolicy,
          bodyPolygons: [
            [
              { x: 0, y: 0 },
              { x: 1, y: 0 },
              { x: 1, y: 1 }
            ]
          ]
        },
        {
          intervalId: 'interval:gap',
          kind: 'gap',
          seamBoundaryId: 'seam:gap',
          terminalRole: 'middle',
          endpointCapPolicy,
          bodyPolygons: [
            [
              { x: 0, y: 0 },
              { x: 1, y: 0 },
              { x: 1, y: 1 }
            ]
          ]
        }
      ]
    })

    expect(body).toEqual(
      expect.objectContaining({
        visibleContributor: 'dash-interval-body',
        materializationKind: 'body',
        intervalId: 'interval:seam'
      })
    )
    expect(
      buildDashIntervalBodyProducts({
        productFamilyId: 'constrained-dashed',
        cachePrefix: 'oracle',
        legalSideId: 'legal:seam',
        intervals: []
      })
    ).toEqual([])
    expect(join.seamEvidence.seamCoveragePolicy).toBe(
      'shared-step-27-endpoint-identity'
    )
    expect(
      minDistanceToPolygonPoints(join.previousOffsetEndpoint, body.polygons[0])
    ).toBeLessThanOrEqual(0.000001)
    expect(
      minDistanceToPolygonPoints(join.nextOffsetEndpoint, body.polygons[0])
    ).toBeLessThanOrEqual(0.000001)
  })

  it('routes high-curvature smooth continuity away from source-vertex join products', () => {
    const joins = buildSourceVertexJoinProducts({
      joins: [
        {
          productId: 'join:curvature',
          productFamilyId: 'constrained-dashed',
          sourceVertexId: 'source-vertex:curvature',
          joinOwnership: 'smooth-continuity',
          highCurvatureSmooth: true,
          vertex: { x: 0, y: 0 },
          previousPoint: { x: -10, y: 0 },
          nextPoint: { x: 10, y: 0 },
          strokeWidth: 10,
          side: 'left',
          authoredJoin: 'round',
          miterAngle: 28.96,
          ownerId: 'owner:curvature',
          angleSource: 'CONTOUR_VISIT_INCIDENT_TANGENTS'
        }
      ]
    })
    const [smooth] = buildSmoothContinuityProducts({
      cachePrefix: 'oracle',
      legalSideId: 'legal:curvature',
      groups: [
        {
          smoothContinuityGroupId: 'smooth:curvature',
          dashIntervalIds: ['interval:a', 'interval:b'],
          splitRangeIds: ['split:a', 'split:b'],
          highCurvatureSmooth: true,
          tangentContinuityProof: {
            continuous: true,
            previousTangent: { x: 1, y: 0 },
            nextTangent: { x: 1, y: 0 },
            tolerance: 0.000001
          },
          descriptorId: 'descriptor:smooth',
          descriptorPath: [
            { x: -10, y: 0 },
            { x: 0, y: 0 },
            { x: 10, y: 0 }
          ]
        }
      ]
    })

    expect(joins).toEqual([])
    expect(smooth).toEqual(
      expect.objectContaining({
        productMode: 'pre-legality-smooth-span-descriptor',
        visibleContributor: 'same-owner-smooth-span-descriptor',
        geometryBasis: 'declared-smooth-span-descriptor',
        materializationKind: 'smooth-span-descriptor'
      })
    )
  })

  it('keeps terminal bodies and descriptor evidence from becoming join or visible-render repair', () => {
    const [terminal] = buildTerminalBodyProducts({
      productFamilyId: 'constrained-dashed',
      cachePrefix: 'oracle',
      legalSideId: 'legal:terminal',
      intervals: [
        {
          intervalId: 'interval:terminal',
          kind: 'visible',
          seamBoundaryId: 'seam:terminal',
          terminalRole: 'start-end',
          endpointCapPolicy: {
            ...endpointCapPolicy,
            terminalRole: 'start-end',
            signature: 'cap-policy:start-end'
          },
          joinOwnershipSignature: 'join-owner:source-vertex',
          bodyPolygons: [
            [
              { x: 0, y: 0 },
              { x: 20, y: 0 },
              { x: 20, y: 10 },
              { x: 0, y: 10 }
            ]
          ]
        }
      ]
    })
    const [descriptor] = materializeStrokeProductDescriptors({
      strategies: [
        {
          strategyId: 'strategy:oracle',
          ownerStage: 'Stroke Geometry descriptor strategy selection',
          status: 'descriptor-eligible',
          descriptorRouteKind: 'outside-dashed-visible-band',
          requiredLegalityBasis: 'post-legality-product',
          outputChannelIntent: 'render-and-hit-export',
          productBuilderId: 'build-dash-interval-body-products',
          materializationStage: 'after-apply-legality',
          consumesPostLegalityArtifact: true,
          ownerBoundarySplitProof: {
            ownerBoundaryId: 'owner-boundary:oracle',
            splitProofId: 'split-proof:oracle',
            complete: true
          }
        }
      ],
      finalFaces: [
        {
          faceId: 'face:oracle',
          renderDescriptor: {
            strokePathGroups: [{ strokePaths: [[{ x: 0, y: 0 }]] }],
            descriptorProductPolygons: [
              [
                { x: 100, y: 100 },
                { x: 110, y: 100 },
                { x: 110, y: 110 }
              ]
            ]
          },
          debugMeta: {
            ownerStage: 'Stroke Geometry final face assembly'
          }
        }
      ]
    })

    expect(terminal).toEqual(
      expect.objectContaining({
        visibleContributor: 'terminal-interval-body',
        materializationKind: 'terminal-body',
        ownerStage: 'Stroke Geometry terminal body assembly'
      })
    )
    expect(JSON.stringify(terminal)).not.toContain('bridge')
    expect(descriptor.visibleChannel).toEqual({
      strokePathGroups: [{ strokePaths: [[{ x: 0, y: 0 }]] }]
    })
    expect(descriptor.evidenceChannel).toHaveProperty(
      'descriptorProductPolygons'
    )
    expect(JSON.stringify(descriptor.visibleChannel)).not.toContain(
      'descriptorProductPolygons'
    )
  })
})
