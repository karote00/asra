import { describe, expect, it } from 'vitest'
import {
  buildSolidCenterStrokeRenderEntriesFromRenderPackets,
  emitSolidCenterStrokeProductOutputPacketsFromFinalFaces
} from '../../components/stroke-render/solid-center-stroke-packets'
import { projectSolidCenterStrokeRenderEntries } from '../../components/stroke-render/solid-center-stroke-render'
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

describe('new stroke flow integration: descriptor legality and channel boundaries', () => {
  it('requires post-legality descriptor strategies to declare post-legality artifact consumption evidence', () => {
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

  it('keeps descriptor product polygons in evidence channels when stroke path groups own visible render', () => {
    const [finalFace] = buildStrokeFinalFacesFromResolvedPackets([
      {
        geometry: {
          geometryId: 'geometry:descriptor-channel',
          polygons: [visiblePolygon],
          bounds,
          debugMeta: {
            routeId: 'build-final-faces',
            ownerStage: 'Stroke Geometry final face assembly',
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
    const outputPackets =
      emitSolidCenterStrokeProductOutputPacketsFromFinalFaces([finalFace])
    const renderEntries = buildSolidCenterStrokeRenderEntriesFromRenderPackets(
      outputPackets.renderPackets
    )
    const projections = projectSolidCenterStrokeRenderEntries(renderEntries)

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
    expect(outputPackets.renderPackets[0]).toMatchObject({
      channel: 'render',
      visibility: 'visible',
      descriptorRouteMode: 'descriptor-visible-route'
    })
    expect(outputPackets.diagnosticPackets[0]).toMatchObject({
      channel: 'diagnostic',
      visibility: 'non-visible',
      evidenceChannel: {
        descriptorProductPolygons: [evidencePolygon]
      }
    })
    expect(renderEntries[0]).toMatchObject({
      channel: 'render-entry',
      visibility: 'visible',
      evidenceChannel: {
        descriptorProductPolygonsVisible: false,
        reason: 'descriptor-visible-route'
      }
    })
    expect(renderEntries[0]).not.toHaveProperty('strokeMaskPolygons')
    expect(renderEntries[0]).not.toHaveProperty('descriptorProductPolygons')
    expect(projections[0]).toMatchObject({
      channel: 'renderer-projection',
      visibility: 'visible-pixels',
      drawRouteType: 'stroke-path-groups',
      metadataMutation: false
    })
    expect(JSON.stringify(projections[0])).not.toContain(
      'descriptorProductPolygons'
    )
  })
})
