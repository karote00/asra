import { describe, expect, it } from 'vitest'
import {
  buildDashIntervalBodyProducts,
  buildTerminalBodyProducts
} from '../../components/stroke-render/constrained-dashed-stroke-packets'
import {
  buildSourceVertexJoinProducts,
  type SourceVertexJoinIncidentSeamBoundary
} from '../../components/stroke-render/source-vertex-join-footprint'
import { buildStrokeFinalFacesFromResolvedPackets } from '../../components/stroke-render/stroke-final-face'
import { materializeStrokeProductDescriptors } from '../../components/stroke-render/stroke-render-descriptor'
import type { Vec2 } from '../../components/stroke-render/solid-stroke-geometry-core'

const bodyPolygon: Vec2[] = [
  { x: 0, y: 0 },
  { x: 24, y: 0 },
  { x: 24, y: 8 },
  { x: 0, y: 8 }
]

const bounds = {
  minX: 0,
  minY: 0,
  maxX: 24,
  maxY: 8
}

const roundStartCapPolicy = {
  terminalRole: 'start' as const,
  startCap: true,
  endCap: false,
  suppressStartCap: false,
  suppressEndCap: true,
  signature: 'cap-policy:round-start'
}

const squareStartEndCapPolicy = {
  terminalRole: 'start-end' as const,
  startCap: true,
  endCap: true,
  suppressStartCap: false,
  suppressEndCap: false,
  signature: 'cap-policy:square-start-end'
}

const suppressedButtJoinPolicy = {
  terminalRole: 'start' as const,
  startCap: false,
  endCap: false,
  suppressStartCap: true,
  suppressEndCap: true,
  signature: 'cap-policy:butt-suppressed-at-join'
}

const previousSeamBoundary: SourceVertexJoinIncidentSeamBoundary = {
  seamBoundaryId: 'seam:previous',
  intervalId: 'interval:previous',
  splitRangeId: 'split:previous',
  side: 'previous',
  point: { x: -8, y: 0 },
  outerBodyBoundaryEndpoint: { x: -8, y: 0 },
  outerBodyBoundaryVertices: [
    { x: -8, y: 0 },
    { x: -9, y: 0 }
  ],
  bodySideOutlineSegment: [
    { x: -8, y: 0 },
    { x: -9, y: 0 }
  ],
  bodySideTangent: { x: -1, y: 0 },
  selectedSide: 'left',
  terminalRole: 'start',
  endpointCapPolicySignature: suppressedButtJoinPolicy.signature,
  capSuppressed: true,
  sourceSegmentIndex: 0
}

const nextSeamBoundary: SourceVertexJoinIncidentSeamBoundary = {
  seamBoundaryId: 'seam:next',
  intervalId: 'interval:next',
  splitRangeId: 'split:next',
  side: 'next',
  point: { x: 8, y: 0 },
  outerBodyBoundaryEndpoint: { x: 8, y: 0 },
  outerBodyBoundaryVertices: [
    { x: 8, y: 0 },
    { x: 9, y: 0 }
  ],
  bodySideOutlineSegment: [
    { x: 8, y: 0 },
    { x: 9, y: 0 }
  ],
  bodySideTangent: { x: 1, y: 0 },
  selectedSide: 'left',
  terminalRole: 'end',
  endpointCapPolicySignature: suppressedButtJoinPolicy.signature,
  capSuppressed: true,
  sourceSegmentIndex: 1
}

describe('formal stroke geometry oracle: caps, terminals, and channel separation', () => {
  it('declares cap ownership on dash and terminal products without turning caps into join repair', () => {
    const [dashBody] = buildDashIntervalBodyProducts({
      productFamilyId: 'constrained-dashed',
      cachePrefix: 'oracle:cap',
      legalSideId: 'legal:outside',
      intervals: [
        {
          intervalId: 'interval:round-start',
          kind: 'visible',
          seamBoundaryId: 'seam:round-start',
          terminalRole: 'start',
          endpointCapPolicy: roundStartCapPolicy,
          bodyPolygons: [bodyPolygon]
        }
      ]
    })
    const [terminalBody] = buildTerminalBodyProducts({
      productFamilyId: 'constrained-dashed',
      cachePrefix: 'oracle:terminal-cap',
      legalSideId: 'legal:outside',
      intervals: [
        {
          intervalId: 'interval:square-terminal',
          kind: 'visible',
          seamBoundaryId: 'seam:square-terminal',
          terminalRole: 'start-end',
          endpointCapPolicy: squareStartEndCapPolicy,
          joinOwnershipSignature: 'join-owner:none',
          bodyPolygons: [bodyPolygon]
        }
      ]
    })
    const [join] = buildSourceVertexJoinProducts({
      joins: [
        {
          productId: 'join:cap-boundary',
          productFamilyId: 'constrained-dashed',
          sourceVertexId: 'source-vertex:cap-boundary',
          joinOwnership: 'source-vertex',
          vertex: { x: 0, y: 0 },
          previousPoint: { x: -40, y: 0 },
          nextPoint: { x: 40, y: 16 },
          strokeWidth: 8,
          side: 'left',
          authoredJoin: 'round',
          miterAngle: 28.96,
          ownerId: 'owner:source-vertex-cap-boundary',
          angleSource: 'CONTOUR_VISIT_INCIDENT_TANGENTS',
          incidentSeamBoundaries: [previousSeamBoundary, nextSeamBoundary]
        }
      ]
    })

    expect(dashBody).toMatchObject({
      visibleContributor: 'dash-interval-body',
      materializationKind: 'body',
      endpointCapPolicy: roundStartCapPolicy,
      capContributors: [
        {
          side: 'start',
          contribution: 'body-side-cap',
          policySignature: roundStartCapPolicy.signature
        }
      ]
    })
    expect(terminalBody).toMatchObject({
      visibleContributor: 'terminal-interval-body',
      materializationKind: 'terminal-body',
      endpointCapPolicy: squareStartEndCapPolicy,
      capContributors: [
        {
          side: 'start',
          contribution: 'body-side-cap',
          policySignature: squareStartEndCapPolicy.signature
        },
        {
          side: 'end',
          contribution: 'body-side-cap',
          policySignature: squareStartEndCapPolicy.signature
        }
      ]
    })
    expect(join).toMatchObject({
      visibleContributor: 'source-vertex-join',
      geometryBasis: 'canonical-join-footprint',
      seamEvidence: {
        seamCoveragePolicy: 'shared-step-27-endpoint-identity',
        incidentSeamBoundaries: [
          previousSeamBoundary,
          nextSeamBoundary
        ]
      }
    })
    expect(join).not.toHaveProperty('capContributors')
    expect(JSON.stringify(join)).not.toContain('body-side-cap')
    expect(JSON.stringify(join)).not.toContain('join-owned-terminal-body-bridge')
  })

  it('keeps degenerate joins local and non-renderer-owned', () => {
    const [join] = buildSourceVertexJoinProducts({
      joins: [
        {
          productId: 'join:degenerate',
          productFamilyId: 'constrained-dashed',
          sourceVertexId: 'source-vertex:degenerate',
          joinOwnership: 'source-vertex',
          vertex: { x: 0, y: 0 },
          previousPoint: { x: 0, y: 0 },
          nextPoint: { x: 24, y: 0 },
          strokeWidth: 8,
          side: 'left',
          authoredJoin: 'miter',
          miterAngle: 28.96,
          ownerId: 'owner:degenerate',
          angleSource: 'AUTHORED_CENTER_PATH_INCIDENT_TANGENTS'
        }
      ]
    })

    expect(join).toMatchObject({
      ownerStage: 'Stroke Geometry source-vertex join assembly',
      visibleContributor: 'source-vertex-join',
      geometryBasis: 'canonical-join-footprint',
      authoredJoin: 'miter',
      resolvedJoin: 'degenerate-bevel',
      vertexAngle: 0,
      angleSource: 'AUTHORED_CENTER_PATH_INCIDENT_TANGENTS'
    })
    expect(join.polygon).toEqual([])
    expect(join.polygons).toEqual([])
    expect(join.seamEvidence.incidentSeamBoundaries).toEqual([])
    expect(JSON.stringify(join)).not.toContain('renderer')
    expect(JSON.stringify(join)).not.toContain('cap')
    expect(JSON.stringify(join)).not.toContain('bridge')
  })

  it('keeps descriptor evidence and final-face channels separated from visible product ownership', () => {
    const [face] = buildStrokeFinalFacesFromResolvedPackets([
      {
        geometry: {
          geometryId: 'geometry:channel',
          polygons: [bodyPolygon],
          bounds,
          debugMeta: {
            ownerStage: 'Stroke Geometry final face assembly',
            productMode: 'post-legality-canonical-product',
            productSignature: 'product:channel',
            visibleContributor: 'dash-interval-body',
            geometryBasis: 'dash-interval-body'
          }
        },
        paint: {
          geometryId: 'geometry:channel',
          color: 0x777777,
          alpha: 1,
          paintKey: 'paint:solid:channel'
        }
      }
    ])
    const [descriptor] = materializeStrokeProductDescriptors({
      strategies: [
        {
          strategyId: 'strategy:channel',
          ownerStage: 'Stroke Geometry descriptor strategy selection',
          status: 'descriptor-eligible',
          descriptorRouteKind: 'outside-dashed-visible-band',
          requiredLegalityBasis: 'post-legality-product',
          outputChannelIntent: 'render-and-hit-export',
          productBuilderId: 'build-dash-interval-body-products',
          materializationStage: 'after-apply-legality',
          consumesPostLegalityArtifact: true,
          ownerBoundarySplitProof: {
            ownerBoundaryId: 'owner-boundary:channel',
            splitProofId: 'split-proof:channel',
            complete: true
          }
        }
      ],
      finalFaces: [
        {
          faceId: face.faceId,
          debugMeta: face.debugMeta,
          renderDescriptor: {
            strokePathGroups: [
              {
                strokePaths: [[{ x: 0, y: 0 }, { x: 24, y: 0 }]],
                strokePathStyle: {
                  cap: 'butt',
                  join: 'miter',
                  width: 8
                }
              }
            ],
            descriptorProductPolygons: [
              [
                { x: 100, y: 100 },
                { x: 110, y: 100 },
                { x: 110, y: 110 }
              ]
            ],
            fillClipPolygons: [bodyPolygon],
            fillExcludePolygons: []
          }
        }
      ]
    })

    expect(face).toMatchObject({
      faceId: 'geometry:channel',
      polygons: [bodyPolygon],
      productMode: 'post-legality-canonical-product',
      productSignature: 'product:channel',
      debugMeta: {
        ownerStage: 'Stroke Geometry final face assembly',
        visibleContributor: 'dash-interval-body',
        geometryBasis: 'dash-interval-body'
      }
    })
    expect(descriptor).toMatchObject({
      ownerStage: 'Product Output descriptor materialization',
      finalFaceId: face.faceId,
      descriptorRouteKind: 'outside-dashed-visible-band',
      outputChannelIntent: 'render-and-hit-export',
      visibleChannel: {
        strokePathGroups: expect.any(Array)
      },
      evidenceChannel: {
        descriptorProductPolygons: expect.any(Array),
        fillClipPolygons: expect.any(Array),
        fillExcludePolygons: []
      },
      ownerMetadata: {
        finalFaceOwnerStage: 'Stroke Geometry final face assembly',
        strategyOwnerStage: 'Stroke Geometry descriptor strategy selection'
      }
    })
    expect(descriptor.visibleChannel).not.toHaveProperty(
      'descriptorProductPolygons'
    )
    expect(descriptor.visibleChannel).not.toHaveProperty('fillClipPolygons')
    expect(descriptor.visibleChannel).not.toHaveProperty('fillExcludePolygons')
  })
})
