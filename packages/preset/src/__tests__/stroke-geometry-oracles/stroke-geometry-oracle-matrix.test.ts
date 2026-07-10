import {
  StrokeCapTypes,
  StrokeJoinTypes,
  StrokePositions,
  StrokeStyles,
  createDefaultStroke
} from '@asyra/utils'
import { describe, expect, it } from 'vitest'
import {
  buildDashIntervalBodyProducts,
  buildTerminalBodyProducts,
  deriveDashBodySeamBoundaryArtifacts
} from '../../components/stroke-render/constrained-dashed-stroke-packets'
import { allocateDashedCenterStrokeIntervals } from '../../components/stroke-render/dashed-center-stroke-intervals'
import { buildDashedCenterStrokeResolvedPackets } from '../../components/stroke-render/dashed-center-stroke-packets'
import { buildSolidCenterStrokeResolvedPackets } from '../../components/stroke-render/solid-center-stroke-packets'
import {
  buildSourceVertexJoinFootprint,
  buildSourceVertexJoinProducts
} from '../../components/stroke-render/source-vertex-join-footprint'
import {
  assertFinitePolygons,
  assertNoForbiddenContributorTokens,
  assertOwnerStage,
  assertPolygonTouchesPoint,
  maxDistanceFromPoint
} from './stroke-geometry-oracle-assertions'
import {
  asVerifiedDashBodySeamBoundaryArtifact,
  getStrokeGeometryOracleFixture,
  requiredStrokeGeometryOracleFixtureScenarioIds,
  strokeGeometryOracleFixtureScenarios
} from './stroke-geometry-oracle-fixtures'

const endpointCapPolicy = {
  terminalRole: 'start' as const,
  startCap: false,
  endCap: false,
  suppressStartCap: true,
  suppressEndCap: true,
  signature: 'cap-policy:oracle-suppressed-butt'
}

const previousSeamBoundary = asVerifiedDashBodySeamBoundaryArtifact(
  {
    seamBoundaryId: 'seam:previous',
    intervalId: 'interval:previous',
    splitRangeId: 'split:previous',
    side: 'previous',
    point: { x: -7, y: 0 },
    outerBodyBoundaryEndpoint: { x: -7, y: 0 },
    outerBodyBoundaryVertices: [
      { x: -7, y: 0 },
      { x: -8, y: 0 }
    ],
    bodySideOutlineSegment: [
      { x: -7, y: 0 },
      { x: -8, y: 0 }
    ],
    bodySideTangent: { x: -1, y: 0 },
    selectedSide: 'left',
    terminalRole: 'start',
    endpointCapPolicySignature: endpointCapPolicy.signature,
    capSuppressed: true,
    sourceSegmentIndex: 0
  },
  'body:matrix:previous'
)

const nextSeamBoundary = asVerifiedDashBodySeamBoundaryArtifact(
  {
    seamBoundaryId: 'seam:next',
    intervalId: 'interval:next',
    splitRangeId: 'split:next',
    side: 'next',
    point: { x: 7, y: 0 },
    outerBodyBoundaryEndpoint: { x: 7, y: 0 },
    outerBodyBoundaryVertices: [
      { x: 7, y: 0 },
      { x: 8, y: 0 }
    ],
    bodySideOutlineSegment: [
      { x: 7, y: 0 },
      { x: 8, y: 0 }
    ],
    bodySideTangent: { x: 1, y: 0 },
    selectedSide: 'left',
    terminalRole: 'end',
    endpointCapPolicySignature: endpointCapPolicy.signature,
    capSuppressed: true,
    sourceSegmentIndex: 1
  },
  'body:matrix:next'
)

describe('formal stroke geometry oracle: parameter and scenario matrix', () => {
  it('declares reusable geometry fixtures for every formal oracle scenario without stale helpers', () => {
    expect(Object.keys(strokeGeometryOracleFixtureScenarios).sort()).toEqual(
      [...requiredStrokeGeometryOracleFixtureScenarioIds].sort()
    )

    for (const scenarioId of requiredStrokeGeometryOracleFixtureScenarioIds) {
      const fixture = getStrokeGeometryOracleFixture(scenarioId)
      expect(fixture.id).toBe(scenarioId)
      expect(fixture.description.length).toBeGreaterThan(0)
      expect(fixture.points.length).toBeGreaterThanOrEqual(
        scenarioId === 'zero-length-degenerate' ||
          scenarioId === 'straight-segment' ||
          scenarioId === 'short-dash-collapse'
          ? 2
          : 3
      )
      for (const point of fixture.points) {
        expect(Number.isFinite(point.x), `${scenarioId}: point.x`).toBe(true)
        expect(Number.isFinite(point.y), `${scenarioId}: point.y`).toBe(true)
      }
    }
  })

  it('asserts center solid and dashed products produce declared artifacts without descriptor or channel repair', () => {
    const centerSolidFixture = getStrokeGeometryOracleFixture(
      'convex-closed-polygon'
    )
    const centerDashFixture = getStrokeGeometryOracleFixture('straight-segment')
    const solidPackets = buildSolidCenterStrokeResolvedPackets(
      'oracle:center-solid',
      centerSolidFixture.points,
      centerSolidFixture.closed,
      [
        createDefaultStroke({
          id: 'stroke:center-solid',
          position: StrokePositions.CENTER,
          style: StrokeStyles.SOLID,
          width: 8,
          joinType: StrokeJoinTypes.ROUND,
          capType: StrokeCapTypes.BUTT
        })
      ]
    )
    const dashedPackets = buildDashedCenterStrokeResolvedPackets(
      'oracle:center-dashed',
      centerDashFixture.points,
      centerDashFixture.closed,
      [
        createDefaultStroke({
          id: 'stroke:center-dashed',
          position: StrokePositions.CENTER,
          style: StrokeStyles.DASHED,
          width: 10,
          joinType: StrokeJoinTypes.BEVEL,
          capType: StrokeCapTypes.ROUND,
          dash: 24,
          gap: 12
        })
      ]
    )

    expect(solidPackets.length).toBeGreaterThan(0)
    expect(dashedPackets.length).toBeGreaterThan(0)
    assertFinitePolygons(solidPackets[0].geometry.polygons, 'center solid')
    assertFinitePolygons(dashedPackets[0].geometry.polygons, 'center dashed')
    expect(solidPackets[0].geometry.debugMeta).toMatchObject({
      productMode: 'center-product',
      productSignature: 'center-product:solid',
      domainMode: 'center-product'
    })
    expect(dashedPackets[0].geometry.debugMeta).toMatchObject({
      productMode: 'center-product',
      productSignature: 'center-product:dashed',
      domainMode: 'center-product'
    })
    expect(
      solidPackets[0].geometry.renderDescriptor?.descriptorProductPolygons
    ).toBeUndefined()
    expect(
      dashedPackets[0].geometry.renderDescriptor?.descriptorProductPolygons
    ).toBeUndefined()
    assertNoForbiddenContributorTokens(
      [solidPackets, dashedPackets],
      ['diagnostic geometry as center product', 'renderer channel repair'],
      'center products'
    )
  })

  it('asserts ordinary acute, high acute, obtuse, near-collinear, and degenerate join envelopes through shared oracle helpers', () => {
    const cases = [
      {
        scenarioId: 'ordinary-acute-vertex' as const,
        authoredJoin: 'miter' as const,
        expectedResolvedJoin: 'miter'
      },
      {
        scenarioId: 'high-acute-vertex' as const,
        authoredJoin: 'miter' as const,
        expectedResolvedJoin: 'bevel-by-miter-angle'
      },
      {
        scenarioId: 'obtuse-vertex' as const,
        authoredJoin: 'round' as const,
        expectedResolvedJoin: 'round'
      },
      {
        scenarioId: 'near-collinear-vertex' as const,
        authoredJoin: 'bevel' as const,
        expectedResolvedJoin: 'bevel'
      },
      {
        scenarioId: 'zero-length-degenerate' as const,
        authoredJoin: 'miter' as const,
        expectedResolvedJoin: 'degenerate-bevel'
      }
    ]

    for (const scenario of cases) {
      const fixture = getStrokeGeometryOracleFixture(scenario.scenarioId)
      const [previousPoint, vertex, nextPoint] = fixture.points
      const join = buildSourceVertexJoinFootprint({
        previousPoint,
        vertex,
        nextPoint,
        strokeWidth: 10,
        side: 'left',
        authoredJoin: scenario.authoredJoin,
        miterAngle: 28.96,
        ownerId: `oracle:${scenario.scenarioId}`,
        angleSource: 'AUTHORED_CENTER_PATH_INCIDENT_TANGENTS'
      })

      expect(join).toMatchObject({
        ownerStage: 'Stroke Geometry source-vertex join assembly',
        visibleContributor: 'source-vertex-join',
        geometryBasis: 'canonical-join-footprint',
        authoredJoin: scenario.authoredJoin,
        resolvedJoin: scenario.expectedResolvedJoin
      })
      if (scenario.expectedResolvedJoin === 'degenerate-bevel') {
        expect(join.polygon).toEqual([])
        expect(join.polygons).toEqual([])
      } else {
        assertFinitePolygons(join.polygons, scenario.scenarioId)
        expect(
          maxDistanceFromPoint(vertex, join.polygon),
          `${scenario.scenarioId}: finite product envelope`
        ).toBeLessThanOrEqual(80)
      }
    }
  })

  it('asserts dash seam, short-span collapse, terminal half-dash, and cap ownership fixtures with contributor guards', () => {
    const collapsed = allocateDashedCenterStrokeIntervals(
      18,
      { dash: 27, gap: 20 },
      false,
      {
        openPathPolicy: 'network-balanced-terminals',
        strokeWidth: 10,
        cap: 'round'
      }
    )
    const visibleCollapsed = collapsed.filter(
      (interval) => interval.kind === 'visible'
    )
    const [join] = buildSourceVertexJoinProducts({
      joins: [
        {
          productId: 'join:matrix-seam',
          productFamilyId: 'constrained-dashed',
          sourceVertexId: 'source-vertex:matrix-seam',
          joinOwnership: 'source-vertex',
          vertex: { x: 0, y: 0 },
          previousPoint: { x: -60, y: 10 },
          nextPoint: { x: 60, y: 10 },
          strokeWidth: 10,
          side: 'left',
          authoredJoin: 'bevel',
          miterAngle: 28.96,
          ownerId: 'owner:matrix-seam',
          angleSource: 'CONTOUR_VISIT_INCIDENT_TANGENTS',
          incidentSeamBoundaries: [previousSeamBoundary, nextSeamBoundary]
        }
      ]
    })
    const [body] = buildDashIntervalBodyProducts({
      productFamilyId: 'constrained-dashed',
      cachePrefix: 'oracle:matrix-body',
      legalSideId: 'legal:matrix',
      intervals: [
        {
          intervalId: 'interval:matrix-body',
          kind: 'visible',
          seamBoundaryId: 'seam:matrix-body',
          terminalRole: 'start',
          endpointCapPolicy,
          bodyPolygons: [
            [
              join.previousOffsetEndpoint,
              { x: -40, y: 10 },
              { x: -40, y: 0 },
              join.nextOffsetEndpoint
            ]
          ]
        }
      ]
    })
    const terminalEndpointCapPolicy = {
      terminalRole: 'start-end' as const,
      startCap: true,
      endCap: true,
      suppressStartCap: false,
      suppressEndCap: false,
      signature: 'cap-policy:matrix-square-start-end'
    }
    const terminalBodyPolygon = [
      { x: 0, y: 0 },
      { x: 18, y: 0 },
      { x: 18, y: 10 },
      { x: 0, y: 10 }
    ]
    const [terminalBody] = buildDashIntervalBodyProducts({
      productFamilyId: 'constrained-dashed',
      cachePrefix: 'oracle:matrix-terminal-body',
      legalSideId: 'legal:matrix',
      intervals: [
        {
          intervalId: 'interval:matrix-terminal',
          kind: 'visible',
          splitRangeId: 'split:matrix-terminal',
          seamBoundaryId: 'seam:matrix-terminal',
          terminalRole: 'start-end',
          endpointCapPolicy: terminalEndpointCapPolicy,
          seamBoundary: {
            seamBoundaryId: 'seam:matrix-terminal',
            intervalId: 'interval:matrix-terminal',
            splitRangeId: 'split:matrix-terminal',
            side: 'previous',
            point: terminalBodyPolygon[0],
            outerBodyBoundaryEndpoint: terminalBodyPolygon[0],
            outerBodyBoundaryVertices: terminalBodyPolygon,
            bodySideOutlineSegment: [
              terminalBodyPolygon[0],
              terminalBodyPolygon[1]
            ],
            bodySideTangent: { x: 1, y: 0 },
            selectedSide: 'left',
            terminalRole: 'start-end',
            endpointCapPolicySignature: terminalEndpointCapPolicy.signature,
            capSuppressed: false
          },
          bodyPolygons: [terminalBodyPolygon]
        }
      ]
    })
    const [terminalSeamBoundary] = deriveDashBodySeamBoundaryArtifacts([
      terminalBody
    ])
    const [terminal] = buildTerminalBodyProducts({
      productFamilyId: 'constrained-dashed',
      cachePrefix: 'oracle:matrix-terminal',
      bindings: [
        {
          bodyProduct: terminalBody,
          seamBoundary: terminalSeamBoundary,
          joinOwnershipSignature: 'join-owner:none'
        }
      ]
    })

    expect(visibleCollapsed).toHaveLength(1)
    expect(visibleCollapsed[0]).toMatchObject({
      startDistance: 0,
      endDistance: 18
    })
    expect(terminal).toMatchObject({
      terminalRole: 'start-end',
      bodyProductId: terminalBody.productId,
      seamBoundaryId: terminalSeamBoundary.seamBoundaryId,
      endpointCapPolicy: terminalEndpointCapPolicy,
      channel: 'evidence',
      visibleContributor: 'none-non-visible-ownership-overlay',
      evidence: {
        zeroVisibleContribution: true
      }
    })
    assertOwnerStage(
      join,
      'Stroke Geometry source-vertex join assembly',
      'source-vertex join'
    )
    assertOwnerStage(
      body,
      'Stroke Geometry dashed interval body assembly',
      'dash interval body'
    )
    assertOwnerStage(
      terminal,
      'Stroke Geometry terminal body ownership binding',
      'terminal ownership overlay'
    )
    assertPolygonTouchesPoint(
      body.polygons[0],
      join.previousOffsetEndpoint,
      0.000001,
      'previous dash seam'
    )
    assertPolygonTouchesPoint(
      body.polygons[0],
      join.nextOffsetEndpoint,
      0.000001,
      'next dash seam'
    )
    expect(terminalBody.capContributors).toEqual([
      {
        side: 'start',
        contribution: 'body-side-cap',
        policySignature: 'cap-policy:matrix-square-start-end'
      },
      {
        side: 'end',
        contribution: 'body-side-cap',
        policySignature: 'cap-policy:matrix-square-start-end'
      }
    ])
    for (const forbiddenField of [
      'productId',
      'polygons',
      'bounds',
      'strokePaths',
      'paint',
      'capContributors'
    ]) {
      expect(terminal).not.toHaveProperty(forbiddenField)
    }
    assertNoForbiddenContributorTokens(
      [join, body, terminalBody, terminal],
      ['join-owned-terminal-body-bridge', 'endpoint cap seam repair'],
      'dash seam matrix'
    )
  })
})
