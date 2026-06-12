import { describe, expect, it } from 'vitest'
import { buildStrokeFinalFacesFromPaintAttachedRegions } from '../components/stroke-render/stroke-final-face'
import { attachStrokePaintPayload } from '../components/stroke-render/stroke-paint-payload'
import type { StrokeRegionPacket } from '../components/stroke-render/stroke-region-packet'

const square = () => [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 }
]

const buildRegion = (
  id: string,
  overrides: Partial<StrokeRegionPacket> = {}
): StrokeRegionPacket => ({
  regionId: id,
  sourceGeometryIds: [`candidate:${id}`],
  polygons: [square()],
  bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
  ownerSet: [{ ownerKey: `owner:${id}`, networkId: `network:${id}` }],
  intervalIds: [`interval:${id}`],
  sourceSpanIds: [`span:${id}`],
  sourceContourIds: [`contour:${id}`],
  legalDomainIds: [`legal:${id}`],
  geometryFamily: 'constrained-solid',
  resolutionStatus: 'exact-constrained',
  runtimeStatus: 'accepted',
  runtimeReason: 'single-owner',
  sourceTopology: 'rectangle-equivalent',
  topologyFamily: 'simple-closed',
  intervalTopology: 'full-loop',
  strokePosition: 'inside',
  arrangementStatus: 'exact',
  arrangementFaceId: `face:${id}`,
  arrangementCandidateIds: [`candidate:${id}`],
  arrangementLegalState: {
    insideFillDomain: true,
    outsideFillDomain: false
  },
  revisionSet: {
    sourcePathRevision: 'source:1',
    strokeSpecRevision: 'stroke:1',
    intervalAllocationRevision: 'interval:1',
    topologyClassificationRevision: 'topology:1',
    ownershipRevision: 'ownership:1',
    legalityRevision: 'legality:1',
    resolvedRegionRevision: 'region:1'
  },
  ...overrides
})

describe('stroke final faces', () => {
  it('should run: build FinalFace records from paint-attached regions without losing metadata', () => {
    const region = buildRegion('a', {
      sourceGeometryIds: ['candidate:a', 'candidate:b']
    })
    const [paintAttached] = attachStrokePaintPayload([region], {
      kind: 'gradient',
      color: 0x000000,
      alpha: 0.8,
      gradientStyle: { type: 'linear' },
      paintKey: 'paint:gradient'
    })
    const [face] = buildStrokeFinalFacesFromPaintAttachedRegions([
      paintAttached
    ])

    expect(face).toMatchObject({
      faceId: 'a',
      sourceGeometryIds: ['candidate:a', 'candidate:b'],
      paintKey: 'paint:gradient',
      strokeSpecKey: 'stroke:1',
      ownerSet: [{ ownerKey: 'owner:a', networkId: 'network:a' }],
      intervalIds: ['interval:a'],
      sourceSpanIds: ['span:a'],
      sourceContourIds: ['contour:a'],
      legalDomainIds: ['legal:a'],
      geometryFamily: 'constrained-solid',
      resolutionStatus: 'exact-constrained',
      runtimeStatus: 'accepted',
      sourceTopology: 'rectangle-equivalent',
      paint: {
        kind: 'gradient',
        color: 0x000000,
        alpha: 0.8,
        paintKey: 'paint:gradient'
      },
      debugMeta: {
        runtimeReason: 'single-owner',
        topologyFamily: 'simple-closed',
        intervalTopology: 'full-loop',
        strokePosition: 'inside',
        arrangementStatus: 'exact',
        arrangementFaceId: 'face:a',
        arrangementCandidateIds: ['candidate:a'],
        arrangementLegalState: {
          insideFillDomain: true,
          outsideFillDomain: false
        },
        revisionSet: {
          sourcePathRevision: 'source:1',
          strokeSpecRevision: 'stroke:1',
          intervalAllocationRevision: 'interval:1',
          topologyClassificationRevision: 'topology:1',
          ownershipRevision: 'ownership:1',
          legalityRevision: 'legality:1',
          resolvedRegionRevision: 'region:1',
          paintRevision: 'paint:gradient'
        }
      }
    })
    expect(face?.polygons).toBe(region.polygons)
    expect(face?.bounds).toBe(region.bounds)
  })

  it('should run: collapse exact duplicate FinalFace geometry while preserving typed provenance', () => {
    const first = buildRegion('a', {
      sourceGeometryIds: ['candidate:a'],
      domainPlanSplitRangeTerminals: [
        {
          intervalId: 'interval:a',
          splitRangeId: 'split-range:shared',
          splitRangeStartDistance: 0,
          splitRangeEndDistance: 30,
          terminalRole: 'start',
          startDistance: 0,
          endDistance: 8
        }
      ]
    })
    const second = buildRegion('b', {
      sourceGeometryIds: ['candidate:b'],
      ownerSet: [{ ownerKey: 'owner:b', networkId: 'network:b' }],
      intervalIds: ['interval:b'],
      sourceSpanIds: ['span:b'],
      sourceContourIds: ['contour:b'],
      legalDomainIds: ['legal:b'],
      arrangementFaceId: 'face:b',
      arrangementCandidateIds: ['candidate:b'],
      domainPlanSplitRangeTerminals: [
        {
          intervalId: 'interval:b',
          splitRangeId: 'split-range:shared',
          splitRangeStartDistance: 0,
          splitRangeEndDistance: 30,
          terminalRole: 'end',
          startDistance: 22,
          endDistance: 30
        }
      ]
    })
    const regions = attachStrokePaintPayload([first, second], {
      color: 0xff0000,
      alpha: 1,
      paintKey: 'paint:red'
    })

    const [face] = buildStrokeFinalFacesFromPaintAttachedRegions(regions, {
      collapseDuplicateFaces: true
    })

    expect(face?.sourceGeometryIds).toEqual(['candidate:a', 'candidate:b'])
    expect(face?.ownerSet).toEqual([
      { ownerKey: 'owner:a', networkId: 'network:a' },
      { ownerKey: 'owner:b', networkId: 'network:b' }
    ])
    expect(face?.intervalIds).toEqual(['interval:a', 'interval:b'])
    expect(face?.sourceSpanIds).toEqual(['span:a', 'span:b'])
    expect(face?.sourceContourIds).toEqual(['contour:a', 'contour:b'])
    expect(face?.legalDomainIds).toEqual(['legal:a', 'legal:b'])
    expect(face?.debugMeta?.domainPlanSplitRangeTerminals).toEqual([
      {
        intervalId: 'interval:a',
        splitRangeId: 'split-range:shared',
        splitRangeStartDistance: 0,
        splitRangeEndDistance: 30,
        terminalRole: 'start',
        startDistance: 0,
        endDistance: 8
      },
      {
        intervalId: 'interval:b',
        splitRangeId: 'split-range:shared',
        splitRangeStartDistance: 0,
        splitRangeEndDistance: 30,
        terminalRole: 'end',
        startDistance: 22,
        endDistance: 30
      }
    ])
    expect(face?.paintKey).toBe('paint:red')
    expect(face?.debugMeta?.revisionSet?.paintRevision).toBe('paint:red')
  })
})
