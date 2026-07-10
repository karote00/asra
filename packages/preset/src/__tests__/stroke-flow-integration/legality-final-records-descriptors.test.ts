import { describe, expect } from 'vitest'
import { integrationCase } from './stroke-integration-inspector-test-helper'
import { applyStrokeProductLegality } from '../../components/stroke-render/stroke-candidate-arrangement'
import { buildStrokeFinalFacesFromResolvedPackets } from '../../components/stroke-render/stroke-final-face'
import {
  materializeStrokeProductDescriptors,
  selectStrokeDescriptorStrategy
} from '../../components/stroke-render/stroke-render-descriptor'

const visiblePolygon = [
  { x: 0, y: 0 },
  { x: 40, y: 0 },
  { x: 40, y: 10 },
  { x: 0, y: 10 }
]

const evidencePolygon = [
  { x: 100, y: 100 },
  { x: 110, y: 100 },
  { x: 110, y: 110 },
  { x: 100, y: 110 }
]

const bounds = {
  minX: 0,
  minY: 0,
  maxX: 40,
  maxY: 10
}

describe('stroke integration: legality, final records, and descriptors', () => {
  integrationCase('legality-resolved-paint-final-descriptor-chain', 'applies legality per source product and emits explicit deletion records', () => {
    const output = applyStrokeProductLegality({
      productPackets: [
        {
          productId: 'body:visible',
          productMode: 'pre-legality-dash-interval-body',
          ownerStepId: 'build-dash-interval-body-products',
          ownerStage: 'Stroke Geometry dashed interval body assembly',
          polygons: [visiblePolygon]
        },
        {
          productId: 'join:deleted',
          productMode: 'pre-legality-source-vertex-join',
          ownerStepId: 'build-source-vertex-join-products',
          ownerStage: 'Stroke Geometry source-vertex join assembly',
          polygons: [evidencePolygon]
        }
      ],
      legalityRoute: 'outside-exterior-clip',
      legalDomainIds: ['legal:outside'],
      contourIds: ['contour:outside'],
      productResults: [
        {
          sourceProductId: 'body:visible',
          visiblePolygons: [visiblePolygon],
          evidenceChannels: {
            descriptorEvidencePolygons: [evidencePolygon]
          }
        },
        {
          sourceProductId: 'join:deleted',
          visiblePolygons: [],
          deleteReason: 'outside-legal-domain'
        }
      ]
    })

    expect(output.products).toEqual([
      expect.objectContaining({
        productId: 'body:visible:post-legality',
        sourceProductId: 'body:visible',
        ownerStepId: 'apply-legality',
        sourceOwnerStepId: 'build-dash-interval-body-products',
        visiblePolygons: [visiblePolygon],
        evidenceChannels: {
          descriptorEvidencePolygons: [evidencePolygon]
        }
      })
    ])
    expect(output.deletions).toEqual([
      expect.objectContaining({
        sourceProductId: 'join:deleted',
        sourceOwnerStepId: 'build-source-vertex-join-products',
        ownerStepId: 'apply-legality',
        deleteReason: 'outside-legal-domain'
      })
    ])
  })

  integrationCase('legality-resolved-paint-final-descriptor-chain', 'requires post-legality descriptor strategies to declare post-legality artifact consumption evidence', () => {
    const [strategy] = selectStrokeDescriptorStrategy({
      candidates: [
        {
          candidateId: 'outside-dashed-post-legality',
          descriptorRouteKind: 'outside-dashed-visible-band',
          requiredLegalityBasis: 'post-legality-product',
          outputChannelIntent: 'render-and-hit-export',
          productBuilderId: 'build-dash-interval-body-products',
          ownerBoundarySplitProof: {
            ownerBoundaryId: 'owner-boundary:outside',
            splitProofId: 'split-proof:outside',
            complete: true
          }
        }
      ]
    })

    expect(strategy).toMatchObject({
      ownerStage: 'Stroke Geometry descriptor strategy selection',
      status: 'descriptor-eligible',
      requiredLegalityBasis: 'post-legality-product',
      materializationStage: 'after-apply-legality'
    })
    expect(strategy.consumesPostLegalityArtifact).toBe(true)
  })

  integrationCase('legality-resolved-paint-final-descriptor-chain', 'keeps descriptor product polygons in evidence channels when stroke path groups own visible render', () => {
    const [finalFace] = buildStrokeFinalFacesFromResolvedPackets([
      {
        geometry: {
          geometryId: 'geometry:descriptor-channel',
          polygons: [visiblePolygon],
          bounds,
          debugMeta: {
            routeId: 'build-final-faces',
            ownerStage: 'Stroke Geometry final face assembly',
            ownerStepIds: [
              'build-dash-interval-body-products',
              'apply-legality',
              'build-final-faces'
            ],
            ownerKey: 'owner:descriptor-channel',
            strokeId: 'stroke:descriptor-channel',
            productMode: 'post-legality-product',
            productSignature: 'constrained-dashed-post-legality',
            domainMode: 'closed-constrained-domain',
            strokePosition: 'outside',
            visibleContributor: 'dash-interval-body',
            geometryBasis: 'dash-interval-body'
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
                  miterLimit: 4,
                  closed: false
                }
              }
            ],
            descriptorProductPolygons: [evidencePolygon],
            fillClipPolygons: [visiblePolygon],
            fillExcludePolygons: [evidencePolygon]
          }
        },
        paint: {
          geometryId: 'geometry:descriptor-channel',
          kind: 'solid',
          color: 0x777777,
          alpha: 1,
          paintKey: 'solid:777777:1'
        }
      }
    ])

    const [strategy] = selectStrokeDescriptorStrategy({
      candidates: [
        {
          candidateId: 'outside-dashed-channel',
          descriptorRouteKind: 'outside-dashed-visible-band',
          requiredLegalityBasis: 'post-legality-product',
          outputChannelIntent: 'render-and-hit-export',
          productBuilderId: 'build-dash-interval-body-products',
          ownerBoundarySplitProof: {
            ownerBoundaryId: 'owner-boundary:channel',
            splitProofId: 'split-proof:channel',
            complete: true
          }
        }
      ]
    })
    const [descriptor] = materializeStrokeProductDescriptors({
      strategies: [strategy],
      finalFaces: [finalFace]
    })

    expect(descriptor.visibleChannel).toEqual({
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
            miterLimit: 4,
            closed: false
          }
        }
      ]
    })
    expect(descriptor.evidenceChannel).toMatchObject({
      descriptorProductPolygons: [evidencePolygon],
      fillClipPolygons: [visiblePolygon],
      fillExcludePolygons: [evidencePolygon]
    })
    expect(descriptor.ownerMetadata.finalFaceOwnerStepIds).toEqual(
      expect.arrayContaining([
        'build-dash-interval-body-products',
        'apply-legality',
        'build-final-faces'
      ])
    )
  })
})
