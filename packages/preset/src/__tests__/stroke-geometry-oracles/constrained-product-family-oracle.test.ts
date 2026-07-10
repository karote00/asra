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
  buildSmoothContinuityProducts,
  buildTerminalBodyProducts,
  deriveDashBodySeamBoundaryArtifacts
} from '../../components/stroke-render/constrained-dashed-stroke-packets'
import { buildConstrainedSolidDoubledCenterProductUnits } from '../../components/stroke-render/constrained-solid-stroke-packets'
import { allocateStrokeIntervalsForDomainPlan } from '../../components/stroke-render/dashed-center-stroke-intervals'

const squarePoints = [
  { x: 0, y: 0 },
  { x: 80, y: 0 },
  { x: 80, y: 80 },
  { x: 0, y: 80 }
]

const starPoints = [
  { x: 0, y: 48 },
  { x: 78, y: 48 },
  { x: 14, y: 0 },
  { x: 40, y: 86 },
  { x: 66, y: 0 }
]

const bodyPolygon = [
  { x: 0, y: 0 },
  { x: 30, y: 0 },
  { x: 30, y: 8 },
  { x: 0, y: 8 }
]

const endpointCapPolicy = {
  terminalRole: 'middle' as const,
  startCap: false,
  endCap: false,
  suppressStartCap: true,
  suppressEndCap: true,
  signature: 'cap-policy:middle-no-cap'
}

const polygonSignature = (polygons: { x: number; y: number }[][]) =>
  JSON.stringify(
    polygons.map((polygon) =>
      polygon.map((point) => [
        Number(point.x.toFixed(3)),
        Number(point.y.toFixed(3))
      ])
    )
  )

describe('formal stroke geometry oracle: constrained product families', () => {
  it('builds constrained solid products from doubled authored center stroke before legality clipping', () => {
    const [unit] = buildConstrainedSolidDoubledCenterProductUnits({
      cachePrefix: 'oracle:solid',
      points: squarePoints,
      closed: true,
      productFamilyId: 'constrained-solid',
      legalSideId: 'legal:inside',
      strokes: [
        createDefaultStroke({
          id: 'stroke:solid-inside',
          style: StrokeStyles.SOLID,
          position: StrokePositions.INSIDE,
          width: 8,
          joinType: StrokeJoinTypes.ROUND,
          capType: StrokeCapTypes.BUTT,
          miterAngle: 28.96
        })
      ],
      metadata: {
        ownerKeyPrefix: 'owner:solid',
        networkId: 'network:solid'
      }
    })

    expect(unit).toMatchObject({
      productFamilyId: 'constrained-solid',
      productMode: 'pre-legality-constrained-solid-doubled-center',
      geometryBasis: 'doubled-authored-center-stroke',
      legalSideId: 'legal:inside',
      strokePosition: 'inside',
      sourceStrokeWidth: 8,
      doubledCenterStrokeWidth: 16,
      ownerStage: 'Stroke Geometry constrained solid product assembly'
    })
    expect(unit.polygons.length).toBeGreaterThan(0)
    expect(JSON.stringify(unit)).not.toContain('strokePathGroups')
    expect(JSON.stringify(unit)).not.toContain('descriptorProductPolygons')
    expect(JSON.stringify(unit)).not.toContain('strokeMaskPolygons')
  })

  it('covers inside and outside constrained solid products across authored joins before legality clipping', () => {
    const cases = [
      {
        id: 'inside-miter',
        position: StrokePositions.INSIDE,
        join: StrokeJoinTypes.MITER
      },
      {
        id: 'inside-bevel',
        position: StrokePositions.INSIDE,
        join: StrokeJoinTypes.BEVEL
      },
      {
        id: 'inside-round',
        position: StrokePositions.INSIDE,
        join: StrokeJoinTypes.ROUND
      },
      {
        id: 'outside-miter',
        position: StrokePositions.OUTSIDE,
        join: StrokeJoinTypes.MITER
      },
      {
        id: 'outside-bevel',
        position: StrokePositions.OUTSIDE,
        join: StrokeJoinTypes.BEVEL
      },
      {
        id: 'outside-round',
        position: StrokePositions.OUTSIDE,
        join: StrokeJoinTypes.ROUND
      }
    ] as const

    const signaturesByPosition = new Map<StrokePositions, string[]>()
    for (const testCase of cases) {
      const [unit] = buildConstrainedSolidDoubledCenterProductUnits({
        cachePrefix: `oracle:solid:${testCase.id}`,
        points: squarePoints,
        closed: true,
        productFamilyId: 'constrained-solid',
        legalSideId: `legal:${testCase.position}`,
        strokes: [
          createDefaultStroke({
            id: `stroke:${testCase.id}`,
            style: StrokeStyles.SOLID,
            position: testCase.position,
            width: 8,
            joinType: testCase.join,
            capType: StrokeCapTypes.BUTT,
            miterAngle: 28.96
          })
        ],
        metadata: {
          ownerKeyPrefix: `owner:${testCase.id}`,
          networkId: 'network:solid-join-matrix'
        }
      })

      expect(unit, testCase.id).toMatchObject({
        productFamilyId: 'constrained-solid',
        productMode: 'pre-legality-constrained-solid-doubled-center',
        geometryBasis: 'doubled-authored-center-stroke',
        legalSideId: `legal:${testCase.position}`,
        strokePosition: testCase.position,
        sourceStrokeWidth: 8,
        doubledCenterStrokeWidth: 16,
        ownerStage: 'Stroke Geometry constrained solid product assembly'
      })
      expect(unit.polygons.length, testCase.id).toBeGreaterThan(0)
      expect(JSON.stringify(unit), testCase.id).not.toContain(
        'strokeMaskPolygons'
      )
      const signatures = signaturesByPosition.get(testCase.position) ?? []
      signatures.push(polygonSignature(unit.polygons))
      signaturesByPosition.set(testCase.position, signatures)
    }

    expect(new Set(signaturesByPosition.get(StrokePositions.INSIDE)).size).toBe(
      3
    )
    expect(
      new Set(signaturesByPosition.get(StrokePositions.OUTSIDE)).size
    ).toBe(3)
  })

  it('keeps self-intersecting constrained solid products on doubled authored center geometry before legality clipping', () => {
    const [unit] = buildConstrainedSolidDoubledCenterProductUnits({
      cachePrefix: 'oracle:solid:self-intersecting',
      points: starPoints,
      closed: true,
      productFamilyId: 'constrained-solid',
      legalSideId: 'legal:self-intersecting-inside',
      strokes: [
        createDefaultStroke({
          id: 'stroke:self-intersecting-inside',
          style: StrokeStyles.SOLID,
          position: StrokePositions.INSIDE,
          width: 9,
          joinType: StrokeJoinTypes.MITER,
          capType: StrokeCapTypes.BUTT,
          miterAngle: 28.96
        })
      ],
      metadata: {
        ownerKeyPrefix: 'owner:self-intersecting',
        networkId: 'network:self-intersecting'
      }
    })

    expect(unit).toMatchObject({
      productFamilyId: 'constrained-solid',
      productMode: 'pre-legality-constrained-solid-doubled-center',
      geometryBasis: 'doubled-authored-center-stroke',
      legalSideId: 'legal:self-intersecting-inside',
      strokePosition: 'inside',
      sourceStrokeWidth: 9,
      doubledCenterStrokeWidth: 18,
      ownerStage: 'Stroke Geometry constrained solid product assembly'
    })
    expect(unit.polygons.length).toBeGreaterThan(0)
    expect(JSON.stringify(unit)).not.toContain('faceStrip')
    expect(JSON.stringify(unit)).not.toContain('renderCover')
    expect(JSON.stringify(unit)).not.toContain('strokeMaskPolygons')
  })

  it('keeps constrained dashed body, terminal, and smooth ownership in separate visible and evidence classes', () => {
    const [body] = buildDashIntervalBodyProducts({
      productFamilyId: 'constrained-dashed',
      cachePrefix: 'oracle:dash-body',
      legalSideId: 'legal:outside',
      intervals: [
        {
          intervalId: 'interval:visible',
          kind: 'visible',
          seamBoundaryId: 'seam:visible',
          terminalRole: 'middle',
          endpointCapPolicy,
          bodyPolygons: [bodyPolygon]
        },
        {
          intervalId: 'interval:visible',
          kind: 'visible',
          seamBoundaryId: 'seam:duplicate',
          terminalRole: 'middle',
          endpointCapPolicy,
          bodyPolygons: [bodyPolygon]
        },
        {
          intervalId: 'interval:gap',
          kind: 'gap',
          seamBoundaryId: 'seam:gap',
          terminalRole: 'middle',
          endpointCapPolicy,
          bodyPolygons: [bodyPolygon]
        }
      ]
    })
    const terminalPolicy = {
      ...endpointCapPolicy,
      terminalRole: 'start' as const,
      signature: 'cap-policy:start-join-owned'
    }
    const [terminalBody] = buildDashIntervalBodyProducts({
      productFamilyId: 'constrained-dashed',
      cachePrefix: 'oracle:terminal-body',
      legalSideId: 'legal:outside',
      intervals: [
        {
          intervalId: 'interval:terminal',
          kind: 'visible',
          splitRangeId: 'split:terminal',
          seamBoundaryId: 'seam:terminal',
          terminalRole: 'start',
          endpointCapPolicy: terminalPolicy,
          seamBoundary: {
            seamBoundaryId: 'seam:terminal',
            intervalId: 'interval:terminal',
            splitRangeId: 'split:terminal',
            side: 'previous',
            point: bodyPolygon[0],
            outerBodyBoundaryEndpoint: bodyPolygon[0],
            outerBodyBoundaryVertices: bodyPolygon,
            bodySideOutlineSegment: [bodyPolygon[0], bodyPolygon[1]],
            bodySideTangent: { x: 1, y: 0 },
            selectedSide: 'left',
            terminalRole: 'start',
            endpointCapPolicySignature: terminalPolicy.signature,
            capSuppressed: true
          },
          bodyPolygons: [bodyPolygon]
        }
      ]
    })
    const [terminalSeamBoundary] = deriveDashBodySeamBoundaryArtifacts([
      terminalBody
    ])
    const [terminal] = buildTerminalBodyProducts({
      productFamilyId: 'constrained-dashed',
      cachePrefix: 'oracle:terminal',
      bindings: [
        {
          bodyProduct: terminalBody,
          seamBoundary: terminalSeamBoundary,
          joinOwnershipSignature: 'join-owner:source-vertex'
        }
      ]
    })
    const [smooth] = buildSmoothContinuityProducts({
      productFamilyId: 'constrained-dashed',
      cachePrefix: 'oracle:smooth',
      groups: [
        {
          smoothContinuityGroupId: 'smooth:continuous',
          dashIntervalIds: [body.intervalId],
          splitRangeIds: [],
          referencedBodyProducts: [
            {
              bodyProductId: body.productId,
              intervalId: body.intervalId,
              ownerStepId: 'build-dash-interval-body-products'
            }
          ],
          tangentContinuityProof: {
            continuous: true,
            previousTangent: { x: 1, y: 0 },
            nextTangent: { x: 1, y: 0 },
            tolerance: 0.000001
          },
          curveOffsetOuterBoundaryProof: {
            evidenceId: 'curve-offset-proof:constrained-owner-classes',
            basis: 'authored-source-curve-offset-at-stroke-width',
            strokeWidth: 8,
            verified: true
          }
        }
      ]
    })

    expect(body).toMatchObject({
      productMode: 'pre-legality-dash-interval-body',
      visibleContributor: 'dash-interval-body',
      materializationKind: 'body',
      ownerStage: 'Stroke Geometry dashed interval body assembly'
    })
    expect(terminal).toMatchObject({
      recordKind: 'terminal-body-ownership-overlay',
      channel: 'evidence',
      visibleContributor: 'none-non-visible-ownership-overlay',
      geometryBasis: 'terminal-body-ownership-overlay',
      bodyProductId: terminalBody.productId,
      joinOwnershipSignature: 'join-owner:source-vertex',
      ownerStage: 'Stroke Geometry terminal body ownership binding',
      evidence: {
        zeroVisibleContribution: true
      }
    })
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
    expect(smooth).toMatchObject({
      recordKind: 'smooth-continuity-ownership-overlay',
      channel: 'evidence',
      visibleContributor: 'none-non-visible-ownership-overlay',
      geometryBasis: 'smooth-continuity-ownership-overlay',
      bodyProductIds: [body.productId],
      ownerStage: 'Stroke Geometry smooth-continuity ownership binding',
      evidence: {
        zeroVisibleContribution: true
      }
    })
    for (const overlay of [terminal, smooth]) {
      for (const forbiddenField of [
        'productId',
        'polygons',
        'bounds',
        'strokePaths',
        'paint'
      ]) {
        expect(overlay).not.toHaveProperty(forbiddenField)
      }
    }
    expect(
      JSON.stringify([body, terminalBody, terminal, smooth])
    ).not.toContain('bridge')
    expect(JSON.stringify([body, terminalBody, terminal, smooth])).not.toContain(
      'source-vertex-join'
    )
  })

  it('keeps collapsed constrained dashed spans as dashed interval provenance instead of solid substitute output', () => {
    const [allocation] = allocateStrokeIntervalsForDomainPlan({
      domainPlan: {
        planId: 'plan:inside-collapse',
        intervalDomainKind: 'domain-plan-split-range',
        totalLength: 31,
        closed: true,
        legalBoundaryDomains: [],
        splitRangeDomains: [
          {
            domainId: 'split:inside-collapse',
            startDistance: 0,
            endDistance: 31,
            sourceStartDistance: 4,
            sourceEndDistance: 35,
            sourceSegmentIndex: 2,
            domainMode: 'closed-constrained-domain',
            selectedSide: 1,
            filledSide: 1,
            unfilledSide: -1
          }
        ]
      },
      dash: 20,
      gap: 20,
      visualGap: { capExtension: 0 }
    })
    const [collapsedInterval] = allocation?.intervals ?? []

    expect(collapsedInterval).toMatchObject({
      kind: 'visible',
      startDistance: 0,
      endDistance: 31,
      intervalLength: 31,
      domainPlanTerminalRole: 'start-end',
      domainPlanSplitRangeId: 'split:inside-collapse',
      domainPlanSplitRangeStartDistance: 0,
      domainPlanSplitRangeEndDistance: 31,
      domainPlanSplitRangeSourceStartDistance: 4,
      domainPlanSplitRangeSourceEndDistance: 35,
      domainPlanSplitRangeSourceSegmentIndex: 2,
      domainPlanDomainMode: 'closed-constrained-domain',
      domainPlanSelectedSide: 1,
      domainPlanFilledSide: 1,
      domainPlanUnfilledSide: -1
    })

    const [body] = buildDashIntervalBodyProducts({
      productFamilyId: 'constrained-dashed',
      cachePrefix: 'oracle:inside-collapse',
      legalSideId: 'legal:inside-collapse',
      intervals: [
        {
          intervalId: collapsedInterval?.intervalId ?? 'interval:missing',
          kind: collapsedInterval?.kind,
          splitRangeId: collapsedInterval?.domainPlanSplitRangeId,
          seamBoundaryId:
            collapsedInterval?.domainPlanSplitRangeId ??
            'split:inside-collapse',
          terminalRole: collapsedInterval?.domainPlanTerminalRole,
          endpointCapPolicy: {
            terminalRole: 'start-end',
            startCap: true,
            endCap: true,
            suppressStartCap: true,
            suppressEndCap: true,
            signature: 'cap-policy:inside-collapse-start-end'
          },
          bodyPolygons: [bodyPolygon]
        }
      ]
    })

    expect(body).toMatchObject({
      productFamilyId: 'constrained-dashed',
      productMode: 'pre-legality-dash-interval-body',
      visibleContributor: 'dash-interval-body',
      intervalId: collapsedInterval?.intervalId,
      splitRangeId: 'split:inside-collapse',
      terminalRole: 'start-end',
      ownerStage: 'Stroke Geometry dashed interval body assembly'
    })
    expect(JSON.stringify([collapsedInterval, body])).not.toContain(
      'solid substitute'
    )
    expect(JSON.stringify([collapsedInterval, body])).not.toContain(
      'generic canonical'
    )
  })
})
