import { describe, expect } from 'vitest'
import { integrationCase } from './stroke-integration-inspector-test-helper'
import {
  buildDashIntervalBodyProducts,
  buildSmoothContinuityProducts,
  buildTerminalBodyProducts,
  deriveDashBodySeamBoundaryArtifacts,
  type DashIntervalBodyEndpointCapPolicy
} from '../../components/stroke-render/constrained-dashed-stroke-packets'
import { buildSourceVertexJoinProducts } from '../../components/stroke-render/source-vertex-join-footprint'

const previousPolicy: DashIntervalBodyEndpointCapPolicy = {
  terminalRole: 'end',
  startCap: false,
  endCap: false,
  suppressStartCap: true,
  suppressEndCap: true,
  signature: 'cap-policy:previous'
}

const nextPolicy: DashIntervalBodyEndpointCapPolicy = {
  ...previousPolicy,
  terminalRole: 'start',
  signature: 'cap-policy:next'
}

const smoothPolicy: DashIntervalBodyEndpointCapPolicy = {
  terminalRole: 'middle',
  startCap: false,
  endCap: false,
  suppressStartCap: true,
  suppressEndCap: true,
  signature: 'cap-policy:smooth'
}

const previousPolygon = [
  { x: -4, y: 16 },
  { x: -2, y: 20 },
  { x: -2, y: 10 },
  { x: -6, y: 10 }
]

const nextPolygon = [
  { x: 2, y: 20 },
  { x: 4, y: 16 },
  { x: 6, y: 10 },
  { x: 2, y: 10 }
]

const previousBoundary = {
  seamBoundaryId: 'seam:previous',
  intervalId: 'interval:previous',
  splitRangeId: 'split:previous',
  side: 'previous' as const,
  point: { x: -2, y: 20 },
  outerBodyBoundaryEndpoint: { x: -2, y: 20 },
  outerBodyBoundaryVertices: previousPolygon,
  bodySideOutlineSegment: [
    { x: -4, y: 16 },
    { x: -2, y: 20 }
  ] as [{ x: number; y: number }, { x: number; y: number }],
  bodySideTangent: { x: -0.1, y: 0.995 },
  selectedSide: 'left' as const,
  terminalRole: 'end' as const,
  endpointCapPolicySignature: previousPolicy.signature,
  capSuppressed: true,
  sourceSegmentIndex: 3
}

const nextBoundary = {
  seamBoundaryId: 'seam:next',
  intervalId: 'interval:next',
  splitRangeId: 'split:next',
  side: 'next' as const,
  point: { x: 2, y: 20 },
  outerBodyBoundaryEndpoint: { x: 2, y: 20 },
  outerBodyBoundaryVertices: nextPolygon,
  bodySideOutlineSegment: [
    { x: 2, y: 20 },
    { x: 4, y: 16 }
  ] as [{ x: number; y: number }, { x: number; y: number }],
  bodySideTangent: { x: 0.1, y: 0.995 },
  selectedSide: 'left' as const,
  terminalRole: 'start' as const,
  endpointCapPolicySignature: nextPolicy.signature,
  capSuppressed: true,
  sourceSegmentIndex: 4
}

describe('stroke integration: product family co-execution', () => {
  integrationCase('constrained-dashed-product-coexecution-chain', 'derives seam artifacts from emitted dash bodies before join and terminal assembly', () => {
    const bodies = buildDashIntervalBodyProducts({
      productFamilyId: 'constrained-dashed',
      cachePrefix: 'integration',
      legalSideId: 'legal:outside',
      intervals: [
        {
          intervalId: previousBoundary.intervalId,
          splitRangeId: previousBoundary.splitRangeId,
          seamBoundaryId: previousBoundary.seamBoundaryId,
          seamBoundary: previousBoundary,
          terminalRole: 'end',
          endpointCapPolicy: previousPolicy,
          bodyPolygons: [previousPolygon]
        },
        {
          intervalId: nextBoundary.intervalId,
          splitRangeId: nextBoundary.splitRangeId,
          seamBoundaryId: nextBoundary.seamBoundaryId,
          seamBoundary: nextBoundary,
          terminalRole: 'start',
          endpointCapPolicy: nextPolicy,
          bodyPolygons: [nextPolygon]
        }
      ]
    })
    const seamArtifacts = deriveDashBodySeamBoundaryArtifacts(bodies)
    const joins = buildSourceVertexJoinProducts({
      joins: [
        {
          productId: 'join:acute',
          productFamilyId: 'constrained-dashed',
          sourceVertexId: 'source-vertex:acute',
          joinOwnership: 'source-vertex',
          vertex: { x: 0, y: 0 },
          previousPoint: { x: -10, y: 100 },
          nextPoint: { x: 10, y: 100 },
          strokeWidth: 20,
          side: 'left',
          authoredJoin: 'miter',
          miterAngle: 30,
          ownerId: 'owner:join:acute',
          angleSource: 'AUTHORED_CENTER_PATH_INCIDENT_TANGENTS',
          incidentSeamBoundaries: seamArtifacts
        }
      ]
    })
    const previousBody = bodies.find(
      (body) => body.intervalId === previousBoundary.intervalId
    )
    const previousSeamArtifact = seamArtifacts.find(
      (artifact) => artifact.intervalId === previousBoundary.intervalId
    )
    expect(previousBody).toBeDefined()
    expect(previousSeamArtifact).toBeDefined()
    if (!previousBody || !previousSeamArtifact) {
      throw new Error('Expected Step 27 body and Step 28 seam evidence')
    }
    const terminals = buildTerminalBodyProducts({
      productFamilyId: 'constrained-dashed',
      cachePrefix: 'integration',
      bindings: [
        {
          bodyProduct: previousBody,
          seamBoundary: previousSeamArtifact,
          joinOwnershipSignature: 'join-owner:acute'
        }
      ]
    })

    expect(bodies).toHaveLength(2)
    expect(seamArtifacts).toHaveLength(2)
    expect(seamArtifacts).toEqual(
      bodies.map((body) =>
        expect.objectContaining({
          bodyProductId: body.productId,
          ownerStepId: 'derive-dash-body-seam-boundaries',
          emitted: false
        })
      )
    )
    expect(joins).toEqual([
      expect.objectContaining({
        ownerStepId: 'build-source-vertex-join-products',
        visibleContributor: 'source-vertex-join',
        geometryBasis: 'canonical-join-footprint'
      })
    ])
    expect(terminals).toEqual([
      expect.objectContaining({
        ownerStepId: 'build-terminal-body-products',
        recordKind: 'terminal-body-ownership-overlay',
        channel: 'evidence',
        visibleContributor: 'none-non-visible-ownership-overlay',
        bodyProductId: previousBody.productId,
        seamBoundary: previousSeamArtifact,
        evidence: expect.objectContaining({
          zeroVisibleContribution: true
        })
      })
    ])
    expect(JSON.stringify(terminals)).not.toContain('polygons')
  })

  integrationCase('constrained-dashed-product-coexecution-chain', 'records smooth-continuity ownership only with tangent, curve-offset, and body proof', () => {
    const [smoothBody] = buildDashIntervalBodyProducts({
      productFamilyId: 'constrained-dashed',
      cachePrefix: 'integration',
      legalSideId: 'legal:outside',
      intervals: [
        {
          intervalId: 'interval:smooth',
          splitRangeId: 'split:smooth',
          seamBoundaryId: 'seam:smooth',
          terminalRole: 'middle',
          endpointCapPolicy: smoothPolicy,
          bodyPolygons: [previousPolygon]
        }
      ]
    })
    expect(smoothBody).toBeDefined()
    if (!smoothBody) {
      throw new Error('Expected Step 27 smooth body product')
    }
    const products = buildSmoothContinuityProducts({
      productFamilyId: 'constrained-dashed',
      cachePrefix: 'integration',
      groups: [
        {
          smoothContinuityGroupId: 'smooth:1',
          dashIntervalIds: ['interval:smooth'],
          splitRangeIds: ['split:smooth'],
          tangentContinuityProof: {
            continuous: true,
            previousTangent: { x: 1, y: 0 },
            nextTangent: { x: 1, y: 0.001 },
            tolerance: 0.01
          },
          curveOffsetOuterBoundaryProof: {
            evidenceId: 'curve-offset-proof:integration',
            basis: 'authored-source-curve-offset-at-stroke-width',
            strokeWidth: 20,
            verified: true
          },
          highCurvatureSmooth: true,
          referencedBodyProducts: [
            {
              bodyProductId: smoothBody.productId,
              intervalId: smoothBody.intervalId,
              splitRangeId: smoothBody.splitRangeId,
              ownerStepId: smoothBody.ownerStepId
            }
          ]
        }
      ]
    })

    expect(products).toEqual([
      expect.objectContaining({
        ownerStepId: 'build-smooth-continuity-products',
        recordKind: 'smooth-continuity-ownership-overlay',
        channel: 'evidence',
        visibleContributor: 'none-non-visible-ownership-overlay',
        geometryBasis: 'smooth-continuity-ownership-overlay',
        bodyProductIds: [smoothBody.productId],
        singleContinuousFootprintProof: {
          referencedBodyProductCount: 1,
          continuous: true
        },
        evidence: expect.objectContaining({
          zeroVisibleContribution: true
        })
      })
    ])
    expect(JSON.stringify(products)).not.toContain('polygons')
  })
})
