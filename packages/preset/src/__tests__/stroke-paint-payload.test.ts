import { describe, expect, it } from 'vitest'
import { attachStrokePaintPayload } from '../components/stroke-render/stroke-paint-payload'
import type { StrokeRegionPacket } from '../components/stroke-render/stroke-region-packet'

const buildRegion = (): StrokeRegionPacket => ({
  regionId: 'region:a',
  sourceGeometryIds: ['candidate:a'],
  polygons: [
    [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 }
    ]
  ],
  bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
  ownerSet: [{ ownerKey: 'owner:a', networkId: 'network:a' }],
  intervalIds: ['interval:a'],
  sourceSpanIds: ['span:a'],
  sourceContourIds: ['contour:a'],
  legalDomainIds: ['legal:a'],
  productMode: 'closed-constrained-domain',
  productSignature: 'constrained-solid:inside',
  domainMode: 'closed-constrained-domain',
  topologyFamily: 'simple-closed',
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
    domainPlanRevision: 'domain-plan:1',
    ownershipRevision: 'ownership:1',
    legalityRevision: 'legality:1',
    sharedGeometryRevision: 'shared:1',
    strokeDomainRevision: 'stroke-domain:1',
    strokeProductRevision: 'stroke-product:1',
    resolvedRegionRevision: 'region:1'
  }
})

describe('stroke paint payload attachment', () => {
  it('should run: attach paint after region geometry without changing region data', () => {
    const region = buildRegion()
    const [attached] = attachStrokePaintPayload([region], {
      kind: 'solid',
      color: 0xff0000,
      alpha: 0.75,
      paintKey: 'paint:red'
    })

    expect(attached).toMatchObject({
      regionId: 'region:a',
      sourceGeometryIds: ['candidate:a'],
      ownerSet: [{ ownerKey: 'owner:a', networkId: 'network:a' }],
      intervalIds: ['interval:a'],
      sourceSpanIds: ['span:a'],
      sourceContourIds: ['contour:a'],
      legalDomainIds: ['legal:a'],
      productMode: 'closed-constrained-domain',
      productSignature: 'constrained-solid:inside',
      domainMode: 'closed-constrained-domain',
      arrangementStatus: 'exact',
      arrangementFaceId: 'face:a',
      arrangementCandidateIds: ['candidate:a'],
      revisionSet: region.revisionSet,
      paintKey: 'paint:red',
      paint: {
        kind: 'solid',
        color: 0xff0000,
        alpha: 0.75,
        paintKey: 'paint:red',
        paintBounds: region.bounds
      }
    })
    expect(attached?.polygons).toBe(region.polygons)
    expect(attached?.bounds).toBe(region.bounds)
    expect(attached?.paint.paintBounds).not.toBe(region.bounds)
    expect(attached?.paint.paintBounds).toEqual(region.bounds)
    expect(region).not.toHaveProperty('paint')
    expect(region).not.toHaveProperty('paintKey')
  })

  it('should run: use declared paint space instead of mutating region bounds', () => {
    const region = buildRegion()
    const declaredPaintBounds = {
      minX: -5,
      minY: -5,
      maxX: 15,
      maxY: 15
    }
    const [attached] = attachStrokePaintPayload([region], {
      kind: 'gradient',
      color: 0x000000,
      alpha: 1,
      gradientStyle: { type: 'linear' },
      paintBounds: declaredPaintBounds,
      paintTransform: { rotation: 45 }
    })

    expect(attached?.paint.paintBounds).toEqual(declaredPaintBounds)
    expect(attached?.paint.paintBounds).not.toBe(declaredPaintBounds)
    expect(attached?.bounds).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 10 })
    expect(attached?.paint.gradientStyle).toEqual({ type: 'linear' })
    expect(attached?.paint.paintTransform).toEqual({ rotation: 45 })
  })

  it('should run: keep geometry identity stable across paint-only changes', () => {
    const region = buildRegion()
    const [red] = attachStrokePaintPayload([region], {
      color: 0xff0000,
      alpha: 1,
      paintKey: 'paint:red'
    })
    const [blue] = attachStrokePaintPayload([region], {
      color: 0x0000ff,
      alpha: 0.5,
      paintKey: 'paint:blue'
    })

    expect(red?.paintKey).toBe('paint:red')
    expect(blue?.paintKey).toBe('paint:blue')
    expect(red?.polygons).toBe(blue?.polygons)
    expect(red?.bounds).toBe(blue?.bounds)
    expect(red?.ownerSet).toBe(blue?.ownerSet)
    expect(red?.sourceSpanIds).toBe(blue?.sourceSpanIds)
    expect(red?.legalDomainIds).toBe(blue?.legalDomainIds)
    expect(red?.revisionSet).toBe(blue?.revisionSet)
  })
})
