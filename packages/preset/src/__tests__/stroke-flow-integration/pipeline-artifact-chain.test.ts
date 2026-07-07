import {
  StrokePositions,
  StrokeStyles,
  createDefaultStroke
} from '@asyra/utils'
import { describe, expect, it } from 'vitest'
import {
  buildDashIntervalBodyProducts,
  buildSmoothContinuityProducts,
  buildTerminalBodyProducts
} from '../../components/stroke-render/constrained-dashed-stroke-packets'
import { normalizeStrokeSpec } from '../../components/stroke-render/renderable-stroke'
import {
  buildSolidCenterStrokeRenderEntriesFromRenderPackets,
  emitSolidCenterStrokeProductOutputPacketsFromFinalFaces
} from '../../components/stroke-render/solid-center-stroke-packets'
import { projectSolidCenterStrokeRenderEntries } from '../../components/stroke-render/solid-center-stroke-render'
import { buildSourceVertexJoinProducts } from '../../components/stroke-render/source-vertex-join-footprint'
import { applyStrokeProductLegality } from '../../components/stroke-render/stroke-candidate-arrangement'
import { buildStrokeFinalFacesFromResolvedPackets } from '../../components/stroke-render/stroke-final-face'
import {
  materializeStrokeProductDescriptors,
  selectStrokeDescriptorStrategy
} from '../../components/stroke-render/stroke-render-descriptor'
import { selectStrokeProductFamily } from '../../components/stroke-render/stroke-product-family'
import type { Vec2 } from '../../components/stroke-render/solid-stroke-geometry-core'

const bodyPolygon: Vec2[] = [
  { x: 0, y: 0 },
  { x: 40, y: 0 },
  { x: 40, y: 10 },
  { x: 0, y: 10 }
]

const clippedPolygon: Vec2[] = [
  { x: 5, y: 0 },
  { x: 35, y: 0 },
  { x: 35, y: 10 },
  { x: 5, y: 10 }
]

const evidencePolygon: Vec2[] = [
  { x: 100, y: 100 },
  { x: 110, y: 100 },
  { x: 110, y: 110 },
  { x: 100, y: 110 }
]

const endpointCapPolicy = {
  terminalRole: 'start' as const,
  startCap: false,
  endCap: false,
  suppressStartCap: true,
  suppressEndCap: true,
  signature: 'cap-policy:join-owned'
}

const bounds = {
  minX: 5,
  minY: 0,
  maxX: 35,
  maxY: 10
}

describe('new stroke flow integration artifact chain', () => {
  it('connects steps 18-24 from normalized stroke spec to constrained dashed product family selection', () => {
    const normalized = normalizeStrokeSpec([
      createDefaultStroke({
        id: 'stroke:flow',
        style: StrokeStyles.DASHED,
        position: StrokePositions.OUTSIDE,
        width: 10,
        dash: 24,
        gap: 12,
        visible: true,
        color: '#777777',
        opacity: 1
      })
    ])

    expect(normalized.diagnostics).toEqual([])
    expect(normalized.strokes).toHaveLength(1)

    const [stroke] = normalized.strokes
    const family = selectStrokeProductFamily({
      stroke,
      sourceFamily: { familyScope: 'self-intersecting-closed' },
      domainPlan: {
        planId: 'domain:flow',
        sourceId: 'source:flow',
        networkId: 'network:flow',
        domainMode: 'closed-constrained-domain',
        intervalDomainKind: 'domain-plan-split-range'
      },
      dashSignature: 'dash:24-12'
    })

    expect(family).toEqual(
      expect.objectContaining({
        productFamilyId: 'constrained-dashed',
        selectedRouteIds: [],
        coExecutionRouteIds: [
          'build-dash-interval-body-products',
          'build-source-vertex-join-products',
          'build-terminal-body-products',
          'build-smooth-continuity-products'
        ],
        predicateInputs: expect.objectContaining({
          strokeStyle: 'dashed',
          strokePosition: 'outside',
          domainMode: 'closed-constrained-domain',
          intervalDomainKind: 'domain-plan-split-range',
          sourceFamilyScope: 'self-intersecting-closed'
        })
      })
    )
  })

  it('connects steps 25-36 from product units through legality, paint, final faces, and descriptor materialization', () => {
    const [body] = buildDashIntervalBodyProducts({
      productFamilyId: 'constrained-dashed',
      cachePrefix: 'flow',
      legalSideId: 'legal:outside',
      intervals: [
        {
          intervalId: 'interval:1',
          kind: 'visible',
          seamBoundaryId: 'seam:1',
          terminalRole: 'start',
          endpointCapPolicy,
          bodyPolygons: [bodyPolygon]
        }
      ]
    })
    const [join] = buildSourceVertexJoinProducts({
      joins: [
        {
          productId: 'flow:join:1',
          productFamilyId: 'constrained-dashed',
          sourceVertexId: 'source-vertex:1',
          joinOwnership: 'source-vertex',
          vertex: { x: 40, y: 0 },
          previousPoint: { x: 0, y: 0 },
          nextPoint: { x: 80, y: 20 },
          strokeWidth: 10,
          side: 'left',
          authoredJoin: 'bevel',
          miterAngle: 28.96,
          ownerId: 'owner:join',
          angleSource: 'CONTOUR_VISIT_INCIDENT_TANGENTS',
          incidentSeamBoundaries: [
            {
              seamBoundaryId: 'seam:1',
              intervalId: 'interval:1',
              side: 'previous',
              point: { x: 40, y: 10 },
              outerBodyBoundaryEndpoint: { x: 40, y: 10 },
              outerBodyBoundaryVertices: bodyPolygon,
              bodySideOutlineSegment: [
                { x: 40, y: 0 },
                { x: 40, y: 10 }
              ],
              bodySideTangent: { x: -1, y: 0 },
              selectedSide: 'left',
              terminalRole: 'start',
              endpointCapPolicySignature: endpointCapPolicy.signature,
              capSuppressed: true,
              sourceSegmentIndex: 0
            }
          ]
        }
      ]
    })
    const [terminal] = buildTerminalBodyProducts({
      productFamilyId: 'constrained-dashed',
      cachePrefix: 'flow',
      legalSideId: 'legal:outside',
      intervals: [
        {
          intervalId: 'interval:terminal',
          kind: 'visible',
          seamBoundaryId: 'seam:terminal',
          terminalRole: 'end',
          endpointCapPolicy: {
            ...endpointCapPolicy,
            terminalRole: 'end',
            signature: 'cap-policy:end'
          },
          joinOwnershipSignature: 'join-owner:source-vertex',
          bodyPolygons: [bodyPolygon]
        }
      ]
    })
    const [smooth] = buildSmoothContinuityProducts({
      cachePrefix: 'flow',
      legalSideId: 'legal:outside',
      groups: [
        {
          smoothContinuityGroupId: 'smooth:1',
          dashIntervalIds: ['interval:2'],
          splitRangeIds: ['split:2'],
          tangentContinuityProof: {
            continuous: true,
            previousTangent: { x: 1, y: 0 },
            nextTangent: { x: 1, y: 0 },
            tolerance: 0.000001
          },
          footprintPolygons: [bodyPolygon]
        }
      ]
    })

    expect([body, join, terminal, smooth]).toEqual([
      expect.objectContaining({
        ownerStage: 'Stroke Geometry dashed interval body assembly',
        visibleContributor: 'dash-interval-body'
      }),
      expect.objectContaining({
        ownerStage: 'Stroke Geometry source-vertex join assembly',
        visibleContributor: 'source-vertex-join',
        geometryBasis: 'canonical-join-footprint'
      }),
      expect.objectContaining({
        ownerStage: 'Stroke Geometry terminal body assembly',
        materializationKind: 'terminal-body'
      }),
      expect.objectContaining({
        ownerStage: 'Stroke Geometry smooth-continuity product assembly',
        visibleContributor: 'smooth-continuity-dash-body'
      })
    ])

    const postLegality = applyStrokeProductLegality({
      productPackets: [
        {
          productId: body.productId,
          productMode: body.productMode,
          ownerStage: body.ownerStage,
          polygons: body.polygons
        },
        {
          productId: join.productId,
          productMode: join.productMode,
          ownerStage: join.ownerStage,
          polygons: [join.polygon]
        }
      ],
      legalityRoute: 'outside-exterior-clip',
      legalDomainIds: ['legal:outside'],
      contourIds: ['contour:outside'],
      clippedProductPolygons: [clippedPolygon],
      descriptorEvidencePolygons: [evidencePolygon]
    })

    expect(
      postLegality.every(
        (packet) => packet.productMode === 'post-legality-product'
      )
    ).toBe(true)
    expect(postLegality[0].visiblePolygons).toEqual([clippedPolygon])
    expect(postLegality[0].evidenceChannels).toEqual({
      descriptorEvidencePolygons: [evidencePolygon]
    })

    const finalFaces = buildStrokeFinalFacesFromResolvedPackets([
      {
        geometry: {
          geometryId: 'geometry:flow',
          polygons: postLegality[0].visiblePolygons,
          bounds,
          debugMeta: {
            routeId: 'build-final-faces',
            ownerKey: 'owner:flow',
            strokeId: 'stroke:flow',
            productMode: postLegality[0].productMode,
            productSignature: 'constrained-dashed-post-legality',
            legalDomainIds: postLegality[0].legalDomainIds
          },
          renderDescriptor: {
            strokePathGroups: [
              {
                strokePaths: [
                  [
                    { x: 0, y: 0 },
                    { x: 40, y: 0 }
                  ]
                ],
                strokePathStyle: {
                  width: 10,
                  cap: 'butt',
                  join: 'miter',
                  miterLimit: 4
                }
              }
            ],
            descriptorProductPolygons: [evidencePolygon]
          }
        },
        paint: {
          geometryId: 'geometry:flow',
          color: 0x777777,
          alpha: 1,
          paintKey: 'paint:flow'
        }
      }
    ])
    const strategies = selectStrokeDescriptorStrategy({
      candidates: [
        {
          candidateId: 'candidate:flow',
          descriptorRouteKind: 'outside-dashed-visible-band',
          requiredLegalityBasis: 'post-legality-product',
          outputChannelIntent: 'render-and-hit-export',
          productBuilderId: 'build-dash-interval-body-products',
          ownerBoundarySplitProof: {
            ownerBoundaryId: 'owner-boundary:flow',
            splitProofId: 'split-proof:flow',
            complete: true
          }
        }
      ]
    })
    const descriptors = materializeStrokeProductDescriptors({
      finalFaces: finalFaces.map((face) => ({
        faceId: face.faceId,
        renderDescriptor: face.renderDescriptor,
        debugMeta: face.debugMeta
      })),
      strategies
    })

    expect(finalFaces[0]).toEqual(
      expect.objectContaining({
        faceId: 'geometry:flow',
        polygons: [clippedPolygon],
        productMode: 'post-legality-product'
      })
    )
    expect(descriptors).toEqual([
      expect.objectContaining({
        ownerStage: 'Product Output descriptor materialization',
        visibleChannel: {
          strokePathGroups: finalFaces[0].renderDescriptor?.strokePathGroups
        },
        evidenceChannel: {
          descriptorProductPolygons: [evidencePolygon]
        }
      })
    ])
  })

  it('connects steps 37-42 without making renderer projection a hit/export source of truth', () => {
    const [finalFace] = buildStrokeFinalFacesFromResolvedPackets([
      {
        geometry: {
          geometryId: 'geometry:output',
          polygons: [clippedPolygon],
          bounds,
          debugMeta: {
            routeId: 'emit-render-hit-export-packets',
            ownerKey: 'owner:output',
            strokeId: 'stroke:output',
            productMode: 'post-legality-product',
            productSignature: 'source-vertex-join',
            visibleContributor: 'source-vertex-join',
            geometryBasis: 'canonical-join-footprint',
            legalDomainIds: ['legal:outside']
          }
        },
        paint: {
          geometryId: 'geometry:output',
          color: 0x777777,
          alpha: 1,
          paintKey: 'paint:output'
        }
      }
    ])
    const packets = emitSolidCenterStrokeProductOutputPacketsFromFinalFaces([
      finalFace
    ])
    const renderEntries = buildSolidCenterStrokeRenderEntriesFromRenderPackets(
      packets.renderPackets
    )
    const projection = projectSolidCenterStrokeRenderEntries(renderEntries)

    expect(packets.renderPackets[0]).toEqual(
      expect.objectContaining({
        channel: 'render',
        visibility: 'visible',
        polygons: [clippedPolygon]
      })
    )
    expect(packets.hitTestPackets[0]).toEqual(
      expect.objectContaining({
        channel: 'hit-test',
        visibility: 'hit-export',
        geometryId: 'geometry:output'
      })
    )
    expect(packets.exportPackets[0]).toEqual(
      expect.objectContaining({
        channel: 'export',
        visibility: 'hit-export',
        geometryId: 'geometry:output'
      })
    )
    expect(renderEntries[0]).toEqual(
      expect.objectContaining({
        channel: 'render-entry',
        visibility: 'visible',
        evidenceChannel: {
          descriptorProductPolygonsVisible: false,
          reason: 'canonical-visible-product'
        }
      })
    )
    expect(projection[0]).toEqual(
      expect.objectContaining({
        channel: 'renderer-projection',
        visibility: 'visible-pixels',
        drawRouteType: 'masked-solid',
        strokeMaskPolygons: [clippedPolygon],
        metadataMutation: false
      })
    )
    expect(JSON.stringify(packets.hitTestPackets)).not.toContain(
      'renderer-projection'
    )
    expect(JSON.stringify(packets.exportPackets)).not.toContain(
      'renderer-projection'
    )
  })
})
