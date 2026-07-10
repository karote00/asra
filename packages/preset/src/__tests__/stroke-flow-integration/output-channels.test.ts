import { describe, expect } from 'vitest'
import { integrationCase } from './stroke-integration-inspector-test-helper'
import {
  buildSolidCenterStrokeRenderEntriesFromRenderPackets,
  emitSolidCenterStrokeProductOutputPacketsFromFinalFaces
} from '../../components/stroke-render/solid-center-stroke-packets'
import { projectSolidCenterStrokeRenderEntries } from '../../components/stroke-render/solid-center-stroke-render'
import { buildStrokeFinalFacesFromResolvedPackets } from '../../components/stroke-render/stroke-final-face'

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

const bounds = { minX: 0, minY: 0, maxX: 40, maxY: 10 }

describe('stroke integration: output channels', () => {
  integrationCase('render-hit-export-output-channel-chain', 'projects canonical final faces to render, hit, and export sibling channels', () => {
    const [finalFace] = buildStrokeFinalFacesFromResolvedPackets([
      {
        geometry: {
          geometryId: 'geometry:canonical-output',
          polygons: [visiblePolygon],
          bounds,
          debugMeta: {
            routeId: 'emit-render-hit-export-packets',
            ownerStepIds: [
              'build-source-vertex-join-products',
              'apply-legality',
              'build-final-faces'
            ],
            ownerKey: 'owner:canonical-output',
            strokeId: 'stroke:canonical-output',
            productMode: 'post-legality-product',
            productSignature: 'source-vertex-join',
            visibleContributor: 'source-vertex-join',
            geometryBasis: 'canonical-join-footprint',
            legalDomainIds: ['legal:outside']
          }
        },
        paint: {
          geometryId: 'geometry:canonical-output',
          color: 0x777777,
          alpha: 1,
          paintKey: 'paint:canonical-output'
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

    expect(packets.renderPackets[0]).toMatchObject({
      channel: 'render',
      visibility: 'visible',
      polygons: [visiblePolygon]
    })
    expect(packets.hitTestPackets[0]).toMatchObject({
      channel: 'hit-test',
      visibility: 'hit-export',
      geometryId: 'geometry:canonical-output'
    })
    expect(packets.exportPackets[0]).toMatchObject({
      channel: 'export',
      visibility: 'hit-export',
      geometryId: 'geometry:canonical-output'
    })
    expect(renderEntries[0]).toMatchObject({
      channel: 'render-entry',
      visibility: 'visible',
      evidenceChannel: {
        descriptorProductPolygonsVisible: false,
        reason: 'canonical-visible-product'
      }
    })
    expect(projection[0]).toMatchObject({
      channel: 'renderer-projection',
      visibility: 'visible-pixels',
      drawRouteType: 'masked-solid',
      strokeMaskPolygons: [visiblePolygon],
      metadataMutation: false
    })
    expect(JSON.stringify(packets.hitTestPackets)).not.toContain(
      'renderer-projection'
    )
    expect(JSON.stringify(packets.exportPackets)).not.toContain(
      'renderer-projection'
    )
  })

  integrationCase('render-entry-descriptor-and-canonical-output-chain', 'keeps descriptor evidence and optional diagnostics outside visible projection', () => {
    const [finalFace] = buildStrokeFinalFacesFromResolvedPackets([
      {
        geometry: {
          geometryId: 'geometry:descriptor-output',
          polygons: [visiblePolygon],
          bounds,
          debugMeta: {
            routeId: 'build-final-faces',
            ownerStepIds: [
              'build-dash-interval-body-products',
              'apply-legality',
              'build-final-faces'
            ],
            ownerKey: 'owner:descriptor-output',
            strokeId: 'stroke:descriptor-output',
            productMode: 'post-legality-product',
            productSignature: 'constrained-dashed-post-legality',
            domainMode: 'closed-constrained-domain',
            strokePosition: 'outside' as const,
            strokeWidth: 14,
            strokeJoin: 'round',
            strokeCap: 'square',
            miterAngle: 42,
            legalDomainIds: ['legal:outside']
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
                  width: 14,
                  cap: 'square',
                  join: 'round',
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
          geometryId: 'geometry:descriptor-output',
          kind: 'solid',
          color: 0x778899,
          alpha: 0.6,
          paintKey: 'solid:7833753:0.6'
        }
      }
    ])
    const packets = emitSolidCenterStrokeProductOutputPacketsFromFinalFaces(
      [finalFace],
      { includeDiagnostics: true }
    )
    const renderEntries = buildSolidCenterStrokeRenderEntriesFromRenderPackets(
      packets.renderPackets
    )
    const projection = projectSolidCenterStrokeRenderEntries(renderEntries)

    expect(packets.renderPackets[0]).toMatchObject({
      channel: 'render',
      visibility: 'visible',
      descriptorRouteMode: 'descriptor-visible-route'
    })
    expect(packets.hitTestPackets[0]).toMatchObject({
      channel: 'hit-test',
      visibility: 'hit-export',
      equivalenceReason: 'descriptor-evidence-projection'
    })
    expect(packets.exportPackets[0]).toMatchObject({
      channel: 'export',
      visibility: 'hit-export',
      equivalenceReason: 'descriptor-evidence-projection'
    })
    expect(packets.diagnosticPackets[0]).toMatchObject({
      channel: 'diagnostic',
      visibility: 'non-visible',
      evidenceChannel: {
        descriptorProductPolygons: [evidencePolygon]
      }
    })
    expect(renderEntries[0]).not.toHaveProperty('strokeMaskPolygons')
    expect(renderEntries[0]).not.toHaveProperty('descriptorProductPolygons')
    expect(projection[0]).toMatchObject({
      channel: 'renderer-projection',
      visibility: 'visible-pixels',
      drawRouteType: 'stroke-path-groups',
      metadataMutation: false
    })
    expect(JSON.stringify(projection[0])).not.toContain(
      'descriptorProductPolygons'
    )
  })
})
