import { describe, expect, it } from 'vitest'
import {
  buildStrokeRegionPacketsFromFinalFaces,
  buildStrokeRegionPacketsFromResolvedPackets
} from '../components/stroke-render/stroke-region-packet'
import type { StrokeFinalFace } from '../components/stroke-render/stroke-final-face'

const square = () => [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 }
]

describe('stroke region packets', () => {
  it('should run: build paint-free semantic region packets from resolved packets', () => {
    const [region] = buildStrokeRegionPacketsFromResolvedPackets([
      {
        geometry: {
          geometryId: 'geometry:region-a',
          polygons: [square()],
          bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
          debugMeta: {
            sourcePathId: 'source:region-a',
            ownerKey: 'owner:region-a',
            networkId: 'network-a',
            strokeId: 'stroke:0',
            strokeIndex: 0,
            contourId: 'contour-a',
            legalDomainId: 'legal-a',
            intervalId: 'interval-a',
            sourceSpanIds: ['span-a'],
            sourceContourIds: ['contour-a'],
            legalDomainIds: ['legal-a'],
            productMode: 'closed-constrained-domain',
            productSignature: 'constrained-dashed:inside',
            domainMode: 'closed-constrained-domain',
            topologyFamily: 'simple-closed',
            strokePosition: 'inside',
            domainPlanSplitRangeId: 'split-range:a',
            domainPlanSplitRangeStartDistance: 0,
            domainPlanSplitRangeEndDistance: 20,
            domainPlanTerminalRole: 'start',
            domainPlanSplitRangeSourceSegmentIndex: 1,
            domainPlanSideAuthority: 'implicit-fill-hole-domain',
            domainPlanSelectedSide: 1,
            domainPlanSideResolutionStatus: 'resolved',
            domainPlanSplitRangeTerminals: [
              {
                intervalId: 'interval-a',
                splitRangeId: 'split-range:a',
                splitRangeStartDistance: 0,
                splitRangeEndDistance: 20,
                terminalRole: 'start',
                startDistance: 0,
                endDistance: 10
              }
            ],
            revisionSet: {
              sourcePathRevision: 'source:1',
              strokeSpecRevision: 'stroke:1',
              domainPlanRevision: 'domain-plan:1',
              sharedGeometryRevision: 'shared-geometry:1',
              strokeProductRevision: 'stroke-product:1',
              strokeDomainRevision: 'stroke-domain:1',
              intervalAllocationRevision: 'interval:1',
              ownershipRevision: 'ownership:1',
              legalityRevision: 'legality:1',
              paintRevision: 'paint:must-not-leak',
              smoothContinuityRevision: 'smooth-continuity:1',
              productMaterializationRevision: 'product-materialization:1',
              resolvedRegionRevision: 'region:1'
            }
          }
        },
        paint: {
          geometryId: 'geometry:region-a',
          kind: 'gradient',
          color: 0xff0000,
          alpha: 0.5,
          gradientStyle: { kind: 'linear' },
          paintKey: 'paint:must-not-leak'
        }
      }
    ])

    expect(region).toMatchObject({
      regionId: 'geometry:region-a',
      sourceGeometryIds: ['geometry:region-a'],
      ownerSet: [
        {
          ownerKey: 'owner:region-a',
          sourcePathId: 'source:region-a',
          networkId: 'network-a',
          strokeId: 'stroke:0',
          strokeIndex: 0,
          contourId: 'contour-a',
          intervalId: 'interval-a'
        }
      ],
      intervalIds: ['interval-a'],
      sourceSpanIds: ['span-a'],
      sourceContourIds: ['contour-a'],
      legalDomainIds: ['legal-a'],
      productMode: 'closed-constrained-domain',
      productSignature: 'constrained-dashed:inside',
      domainMode: 'closed-constrained-domain',
      topologyFamily: 'simple-closed',
      strokePosition: 'inside',
      domainPlanSplitRangeId: 'split-range:a',
      domainPlanSplitRangeStartDistance: 0,
      domainPlanSplitRangeEndDistance: 20,
      domainPlanTerminalRole: 'start',
      domainPlanSplitRangeSourceSegmentIndex: 1,
      domainPlanSideAuthority: 'implicit-fill-hole-domain',
      domainPlanSelectedSide: 1,
      domainPlanSideResolutionStatus: 'resolved',
      domainPlanSplitRangeTerminals: [
        {
          intervalId: 'interval-a',
          splitRangeId: 'split-range:a',
          splitRangeStartDistance: 0,
          splitRangeEndDistance: 20,
          terminalRole: 'start',
          startDistance: 0,
          endDistance: 10
        }
      ],
      revisionSet: {
        sourcePathRevision: 'source:1',
        strokeSpecRevision: 'stroke:1',
        domainPlanRevision: 'domain-plan:1',
        sharedGeometryRevision: 'shared-geometry:1',
        strokeProductRevision: 'stroke-product:1',
        strokeDomainRevision: 'stroke-domain:1',
        intervalAllocationRevision: 'interval:1',
        ownershipRevision: 'ownership:1',
        legalityRevision: 'legality:1',
        smoothContinuityRevision: 'smooth-continuity:1',
        productMaterializationRevision: 'product-materialization:1',
        resolvedRegionRevision: 'region:1'
      }
    })
    expect(region).not.toHaveProperty('paint')
    expect(region).not.toHaveProperty('paintKey')
    expect(region).not.toHaveProperty('color')
    expect(region).not.toHaveProperty('alpha')
    expect(region).not.toHaveProperty('gradientStyle')
    expect(region?.revisionSet).not.toHaveProperty('paintRevision')
  })

  it('should run: preserve arrangement, owner, interval, source-span, and legal-domain metadata from final faces', () => {
    const face: StrokeFinalFace = {
      faceId: 'arranged:face-a',
      sourceGeometryIds: ['candidate:a', 'candidate:b'],
      polygons: [square()],
      bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
      visualPacketKey: 'visual:a',
      paintKey: 'paint:must-not-leak',
      strokeSpecKey: 'stroke:spec',
      ownerSet: [
        { ownerKey: 'owner:a', networkId: 'network-a' },
        { ownerKey: 'owner:b', networkId: 'network-b' }
      ],
      intervalIds: ['interval:a', 'interval:b'],
      sourceSpanIds: ['span:a', 'span:b'],
      sourceContourIds: ['contour:a', 'contour:b'],
      legalDomainIds: ['legal:a'],
      debugMeta: {
        productMode: 'closed-constrained-domain',
        productSignature: 'constrained-solid:outside',
        domainMode: 'closed-constrained-domain',
        arrangementStatus: 'exact',
        arrangementFaceId: 'backend:face-a',
        arrangementCandidateIds: ['candidate:a', 'candidate:b'],
        arrangementLegalState: {
          insideFillDomain: true,
          outsideFillDomain: false
        },
        strokePosition: 'outside',
        domainPlanSplitRangeTerminals: [
          {
            intervalId: 'interval:a',
            splitRangeId: 'split-range:face-a',
            splitRangeStartDistance: 0,
            splitRangeEndDistance: 24,
            terminalRole: 'end',
            startDistance: 12,
            endDistance: 24
          }
        ]
      },
      paint: {
        geometryId: 'paint:a',
        color: 0x00ff00,
        alpha: 1,
        paintKey: 'paint:must-not-leak'
      }
    }

    expect(buildStrokeRegionPacketsFromFinalFaces([face])[0]).toMatchObject({
      regionId: 'arranged:face-a',
      sourceGeometryIds: ['candidate:a', 'candidate:b'],
      ownerSet: [
        { ownerKey: 'owner:a', networkId: 'network-a' },
        { ownerKey: 'owner:b', networkId: 'network-b' }
      ],
      intervalIds: ['interval:a', 'interval:b'],
      sourceSpanIds: ['span:a', 'span:b'],
      sourceContourIds: ['contour:a', 'contour:b'],
      legalDomainIds: ['legal:a'],
      productMode: 'closed-constrained-domain',
      productSignature: 'constrained-solid:outside',
      domainMode: 'closed-constrained-domain',
      arrangementStatus: 'exact',
      arrangementFaceId: 'backend:face-a',
      arrangementCandidateIds: ['candidate:a', 'candidate:b'],
      arrangementLegalState: {
        insideFillDomain: true,
        outsideFillDomain: false
      },
      strokePosition: 'outside',
      domainPlanSplitRangeTerminals: [
        {
          intervalId: 'interval:a',
          splitRangeId: 'split-range:face-a',
          splitRangeStartDistance: 0,
          splitRangeEndDistance: 24,
          terminalRole: 'end',
          startDistance: 12,
          endDistance: 24
        }
      ]
    })
  })
})
