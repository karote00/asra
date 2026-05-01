import { describe, expect, it } from 'vitest'
import type {
  ArrangementFace,
  CandidateRegion,
  GeometryBackend,
  PolygonRegion
} from '../components/stroke-render/geometry-backend'
import {
  buildArrangedStrokeFinalFacesFromResolvedPackets,
  buildStrokeArrangementCandidates,
  collapseStrokeFinalFaceVisualOverlaps
} from '../components/stroke-render/stroke-candidate-arrangement'
import { buildStrokeFinalFacesFromResolvedPackets } from '../components/stroke-render/stroke-final-face'
import type {
  SolidCenterStrokeGeometryDebugMeta,
  SolidCenterStrokePaintPacket,
  SolidCenterStrokeResolvedPacket
} from '../components/stroke-render/solid-center-stroke-packets'

const square = (x: number, y: number, size: number) => [
  { x, y },
  { x: x + size, y },
  { x: x + size, y: y + size },
  { x, y: y + size }
]

const getBounds = (polygon: { x: number; y: number }[]) => ({
  minX: Math.min(...polygon.map((point) => point.x)),
  minY: Math.min(...polygon.map((point) => point.y)),
  maxX: Math.max(...polygon.map((point) => point.x)),
  maxY: Math.max(...polygon.map((point) => point.y))
})

const concaveCShape = () => [
  { x: 0, y: 0 },
  { x: 6, y: 0 },
  { x: 6, y: 2 },
  { x: 2, y: 2 },
  { x: 2, y: 4 },
  { x: 6, y: 4 },
  { x: 6, y: 6 },
  { x: 0, y: 6 }
]

const makePacket = (
  id: string,
  options: {
    ownerKey?: string
    networkId?: string
    strokePosition?: 'center' | 'inside' | 'outside'
    paintKey?: string
    color?: number
    alpha?: number
    polygon?: { x: number; y: number }[]
    sourceSpanIds?: string[]
    intervalId?: string
  } = {}
): SolidCenterStrokeResolvedPacket => {
  const polygon = options.polygon ?? square(0, 0, 10)

  return {
    geometry: {
      geometryId: id,
      polygons: [polygon],
      bounds: getBounds(polygon),
      debugMeta: {
        sourcePathId: `source:${id}`,
        ownerKey: options.ownerKey ?? `owner:${id}`,
        networkId: options.networkId ?? `network:${id}`,
        strokeId: 'stroke:0',
        strokeIndex: 0,
        contourId: `contour:${id}`,
        legalDomainId: `legal:${id}`,
        intervalId: options.intervalId ?? `interval:${id}`,
        sourceSpanIds: options.sourceSpanIds ?? [`span:${id}`],
        strokePosition: options.strokePosition ?? 'inside',
        geometryFamily: 'constrained-dashed',
        resolutionStatus: 'local-side-approximation',
        runtimeStatus: 'accepted',
        sourceTopology: 'self-intersecting'
      }
    },
    paint: {
      geometryId: id,
      color: options.color ?? 0xff0000,
      alpha: options.alpha ?? 1,
      paintKey: options.paintKey ?? 'paint:shared'
    }
  }
}

const makeBackend = (
  buildArrangement: (candidates: CandidateRegion[]) => ArrangementFace[]
): Pick<GeometryBackend, 'buildArrangement'> => ({
  buildArrangement
})

const makeUnionBackend = (
  union: GeometryBackend['union']
): Pick<GeometryBackend, 'union'> => ({
  union
})

const buildTestFinalFaces = (packets: SolidCenterStrokeResolvedPacket[]) =>
  buildStrokeFinalFacesFromResolvedPackets<
    SolidCenterStrokeGeometryDebugMeta,
    SolidCenterStrokePaintPacket,
    SolidCenterStrokeResolvedPacket
  >(packets)

describe('stroke candidate arrangement', () => {
  it('should run: build candidate regions with typed owner, interval, and source-span metadata', () => {
    const packet = makePacket('candidate:a', {
      strokePosition: 'outside',
      ownerKey: 'owner:a',
      sourceSpanIds: ['span:a', 'span:b']
    })
    const [candidate] = buildStrokeArrangementCandidates(
      buildStrokeFinalFacesFromResolvedPackets([packet]),
      { strokePosition: 'inside' }
    )

    expect(candidate).toMatchObject({
      candidateId: 'candidate:a',
      strokePosition: 'outside',
      ownerKey: 'owner:a',
      intervalId: 'interval:candidate:a',
      sourceSpanIds: ['span:a', 'span:b'],
      sourceContourIds: ['contour:candidate:a']
    })
  })

  it('should run: reject arrangement candidates without explicit stroke position metadata', () => {
    const packet = makePacket('candidate:missing-position')
    delete packet.geometry.debugMeta!.strokePosition

    expect(() =>
      buildStrokeArrangementCandidates(
        buildStrokeFinalFacesFromResolvedPackets([packet])
      )
    ).toThrow(/without typed strokePosition/)
  })

  it('should run: classify inside and outside faces as distinct exact final face sets', () => {
    const inputRegion: PolygonRegion = { polygons: [square(0, 0, 10)] }
    const insidePacket = makePacket('inside:candidate', {
      strokePosition: 'inside'
    })
    const outsidePacket = makePacket('outside:candidate', {
      strokePosition: 'outside'
    })
    const buildArrangement = (candidates: CandidateRegion[]) => [
      {
        faceId: 'face:inside',
        geometry: inputRegion,
        claimedBy: candidates,
        legalState: {
          insideFillDomain: true,
          outsideFillDomain: false
        }
      },
      {
        faceId: 'face:outside',
        geometry: inputRegion,
        claimedBy: candidates,
        legalState: {
          insideFillDomain: false,
          outsideFillDomain: true
        }
      }
    ]

    const [insideFace] = buildArrangedStrokeFinalFacesFromResolvedPackets(
      [insidePacket],
      { backend: makeBackend(buildArrangement) }
    )
    const [outsideFace] = buildArrangedStrokeFinalFacesFromResolvedPackets(
      [outsidePacket],
      { backend: makeBackend(buildArrangement) }
    )

    expect(insideFace?.debugMeta).toMatchObject({
      arrangementStatus: 'exact',
      arrangementFaceId: 'face:inside',
      arrangementLegalState: {
        insideFillDomain: true,
        outsideFillDomain: false
      },
      resolutionStatus: 'exact-constrained',
      runtimeStatus: 'accepted'
    })
    expect(outsideFace?.debugMeta).toMatchObject({
      arrangementStatus: 'exact',
      arrangementFaceId: 'face:outside',
      arrangementLegalState: {
        insideFillDomain: false,
        outsideFillDomain: true
      },
      resolutionStatus: 'exact-constrained',
      runtimeStatus: 'accepted'
    })
  })

  it('should run: override backend legalState from typed legal-domain geometry', () => {
    const insideRegion: PolygonRegion = { polygons: [square(2, 2, 2)] }
    const outsideRegion: PolygonRegion = { polygons: [square(20, 20, 2)] }
    const insidePacket = makePacket('inside:legal-domain-candidate', {
      strokePosition: 'inside'
    })
    const outsidePacket = makePacket('outside:legal-domain-candidate', {
      strokePosition: 'outside'
    })
    const backend = makeBackend((candidates) => [
      {
        faceId: 'face:inside-domain',
        geometry: insideRegion,
        claimedBy: candidates,
        legalState: {
          insideFillDomain: false,
          outsideFillDomain: true
        }
      },
      {
        faceId: 'face:outside-domain',
        geometry: outsideRegion,
        claimedBy: candidates,
        legalState: {
          insideFillDomain: true,
          outsideFillDomain: false
        }
      }
    ])
    const legalDomains = [
      {
        legalDomainId: 'legal:source-fill',
        fillRule: 'evenodd' as const,
        regions: [{ polygons: [square(0, 0, 10)] }]
      }
    ]

    const [insideFace] = buildArrangedStrokeFinalFacesFromResolvedPackets(
      [insidePacket],
      { backend, legalDomains }
    )
    const [outsideFace] = buildArrangedStrokeFinalFacesFromResolvedPackets(
      [outsidePacket],
      { backend, legalDomains }
    )

    expect(insideFace?.debugMeta).toMatchObject({
      arrangementFaceId: 'face:inside-domain',
      arrangementLegalState: {
        insideFillDomain: true,
        outsideFillDomain: false
      }
    })
    expect(outsideFace?.debugMeta).toMatchObject({
      arrangementFaceId: 'face:outside-domain',
      arrangementLegalState: {
        insideFillDomain: false,
        outsideFillDomain: true
      }
    })
  })

  it('should run: split mixed multi-contour arrangement faces by legal-domain state before filtering', () => {
    const mixedRegion: PolygonRegion = {
      polygons: [square(2, 2, 2), square(20, 20, 2)]
    }
    const insidePacket = makePacket('inside:mixed-multi-contour-candidate', {
      strokePosition: 'inside'
    })
    const outsidePacket = makePacket('outside:mixed-multi-contour-candidate', {
      strokePosition: 'outside'
    })
    const backend = makeBackend((candidates) => [
      {
        faceId: 'face:mixed-multi-contour',
        geometry: mixedRegion,
        claimedBy: candidates,
        legalState: {
          insideFillDomain: true,
          outsideFillDomain: true
        }
      }
    ])
    const legalDomains = [
      {
        legalDomainId: 'legal:source-fill',
        fillRule: 'evenodd' as const,
        regions: [{ polygons: [square(0, 0, 10)] }]
      }
    ]

    const [insideFace] = buildArrangedStrokeFinalFacesFromResolvedPackets(
      [insidePacket],
      { backend, legalDomains }
    )
    const [outsideFace] = buildArrangedStrokeFinalFacesFromResolvedPackets(
      [outsidePacket],
      { backend, legalDomains }
    )

    expect(insideFace?.polygons).toEqual([square(2, 2, 2)])
    expect(insideFace?.debugMeta).toMatchObject({
      arrangementFaceId: 'face:mixed-multi-contour:legal-split:0',
      arrangementLegalState: {
        insideFillDomain: true,
        outsideFillDomain: false
      }
    })
    expect(outsideFace?.polygons).toEqual([square(20, 20, 2)])
    expect(outsideFace?.debugMeta).toMatchObject({
      arrangementFaceId: 'face:mixed-multi-contour:legal-split:1',
      arrangementLegalState: {
        insideFillDomain: false,
        outsideFillDomain: true
      }
    })
  })

  it('should run: classify holed arrangement faces from a filled sample instead of a hole sample', () => {
    const holedRegion: PolygonRegion = {
      polygons: [square(0, 0, 10), square(4, 4, 2)]
    }
    const packet = makePacket('inside:holed-arrangement-candidate', {
      strokePosition: 'inside',
      polygon: square(0, 0, 10)
    })
    const backend = makeBackend((candidates) => [
      {
        faceId: 'face:holed-domain',
        geometry: holedRegion,
        claimedBy: candidates,
        legalState: {
          insideFillDomain: false,
          outsideFillDomain: true
        }
      }
    ])

    const [insideFace] = buildArrangedStrokeFinalFacesFromResolvedPackets(
      [packet],
      {
        backend,
        legalDomains: [
          {
            legalDomainId: 'legal:holed-source-fill',
            fillRule: 'evenodd',
            regions: [holedRegion]
          }
        ]
      }
    )

    expect(insideFace?.polygons).toEqual(holedRegion.polygons)
    expect(insideFace?.debugMeta).toMatchObject({
      arrangementFaceId: 'face:holed-domain',
      arrangementLegalState: {
        insideFillDomain: true,
        outsideFillDomain: false
      }
    })
  })

  it('should run: classify concave arrangement faces using an interior sample, not only the centroid', () => {
    const concaveRegion: PolygonRegion = { polygons: [concaveCShape()] }
    const packet = makePacket('inside:concave-legal-domain-candidate', {
      strokePosition: 'inside',
      polygon: concaveCShape()
    })
    const backend = makeBackend((candidates) => [
      {
        faceId: 'face:concave-domain',
        geometry: concaveRegion,
        claimedBy: candidates,
        legalState: {
          insideFillDomain: false,
          outsideFillDomain: true
        }
      }
    ])

    const [insideFace] = buildArrangedStrokeFinalFacesFromResolvedPackets(
      [packet],
      {
        backend,
        legalDomains: [
          {
            legalDomainId: 'legal:concave-source-fill',
            fillRule: 'evenodd',
            regions: [concaveRegion]
          }
        ]
      }
    )

    expect(insideFace?.debugMeta).toMatchObject({
      arrangementFaceId: 'face:concave-domain',
      arrangementLegalState: {
        insideFillDomain: true,
        outsideFillDomain: false
      }
    })
  })

  it('should run: merge same-visual arrangement claims into one exact face with ownerSet metadata', () => {
    const packets = [
      makePacket('candidate:a', {
        ownerKey: 'owner:a',
        networkId: 'network:a',
        intervalId: 'interval:a',
        sourceSpanIds: ['span:a']
      }),
      makePacket('candidate:b', {
        ownerKey: 'owner:b',
        networkId: 'network:b',
        intervalId: 'interval:b',
        sourceSpanIds: ['span:b']
      })
    ]
    const backend = makeBackend((candidates) => [
      {
        faceId: 'face:shared',
        geometry: {
          polygons: [square(2, 2, 4)]
        },
        claimedBy: candidates,
        legalState: {
          insideFillDomain: true,
          outsideFillDomain: false
        }
      }
    ])

    const faces = buildArrangedStrokeFinalFacesFromResolvedPackets(packets, {
      backend
    })

    expect(faces).toHaveLength(1)
    expect(faces[0]?.ownerSet).toEqual([
      expect.objectContaining({ ownerKey: 'owner:a', networkId: 'network:a' }),
      expect.objectContaining({ ownerKey: 'owner:b', networkId: 'network:b' })
    ])
    expect(faces[0]?.intervalIds).toEqual(['interval:a', 'interval:b'])
    expect(faces[0]?.sourceSpanIds).toEqual(['span:a', 'span:b'])
    expect(faces[0]?.polygons).toEqual([square(2, 2, 4)])
  })

  it('should run: collapse duplicate exact arrangement faces without stacking opacity', () => {
    const packet = makePacket('candidate:a', {
      ownerKey: 'owner:a',
      intervalId: 'interval:a',
      sourceSpanIds: ['span:a']
    })
    const backend = makeBackend((candidates) => [
      {
        faceId: 'face:duplicate:a',
        geometry: {
          polygons: [square(2, 2, 4)]
        },
        claimedBy: candidates,
        legalState: {
          insideFillDomain: true,
          outsideFillDomain: false
        }
      },
      {
        faceId: 'face:duplicate:b',
        geometry: {
          polygons: [square(2, 2, 4)]
        },
        claimedBy: candidates,
        legalState: {
          insideFillDomain: true,
          outsideFillDomain: false
        }
      }
    ])

    const faces = buildArrangedStrokeFinalFacesFromResolvedPackets([packet], {
      backend
    })

    expect(faces).toHaveLength(1)
    expect(faces[0]?.paint.alpha).toBe(1)
    expect(faces[0]?.sourceGeometryIds).toEqual(['candidate:a'])
    expect(faces[0]?.ownerSet).toEqual([
      expect.objectContaining({ ownerKey: 'owner:a' })
    ])
    expect(faces[0]?.intervalIds).toEqual(['interval:a'])
    expect(faces[0]?.sourceSpanIds).toEqual(['span:a'])
  })

  it('should run: keep same arrangement geometry separate when visual packet keys differ', () => {
    const packets = [
      makePacket('candidate:a', {
        ownerKey: 'owner:a',
        paintKey: 'paint:red',
        color: 0xff0000
      }),
      makePacket('candidate:b', {
        ownerKey: 'owner:b',
        paintKey: 'paint:blue',
        color: 0x0000ff
      })
    ]
    const backend = makeBackend((candidates) => [
      {
        faceId: 'face:shared',
        geometry: {
          polygons: [square(0, 0, 5)]
        },
        claimedBy: candidates,
        legalState: {
          insideFillDomain: true,
          outsideFillDomain: false
        }
      }
    ])

    const faces = buildArrangedStrokeFinalFacesFromResolvedPackets(packets, {
      backend
    })

    expect(faces).toHaveLength(2)
    expect(faces.map((face) => face.paintKey).sort()).toEqual([
      'paint:blue',
      'paint:red'
    ])
    expect(faces.map((face) => face.ownerSet[0]?.ownerKey).sort()).toEqual([
      'owner:a',
      'owner:b'
    ])
  })

  it('should run: collapse same-visual overlapping final-face coverage to one visible layer', () => {
    const packets = [
      makePacket('candidate:overlap-a', {
        ownerKey: 'owner:a',
        intervalId: 'interval:a',
        sourceSpanIds: ['span:a'],
        polygon: square(0, 0, 10),
        alpha: 0.5
      }),
      makePacket('candidate:overlap-b', {
        ownerKey: 'owner:b',
        intervalId: 'interval:b',
        sourceSpanIds: ['span:b'],
        polygon: square(5, 0, 10),
        alpha: 0.5
      })
    ]
    const faces = buildTestFinalFaces(packets)
    const unionCalls: PolygonRegion[][] = []
    const backend = makeUnionBackend((regions) => {
      unionCalls.push(regions)
      return [
        {
          polygons: [
            [
              { x: 0, y: 0 },
              { x: 15, y: 0 },
              { x: 15, y: 10 },
              { x: 0, y: 10 }
            ]
          ]
        }
      ]
    })

    const collapsed = collapseStrokeFinalFaceVisualOverlaps(faces, { backend })

    expect(unionCalls).toHaveLength(1)
    expect(unionCalls[0]).toHaveLength(2)
    expect(collapsed).toHaveLength(1)
    expect(collapsed[0]?.polygons).toEqual([
      [
        { x: 0, y: 0 },
        { x: 15, y: 0 },
        { x: 15, y: 10 },
        { x: 0, y: 10 }
      ]
    ])
    expect(collapsed[0]?.paint.alpha).toBe(0.5)
    expect(collapsed[0]?.ownerSet).toEqual([
      expect.objectContaining({ ownerKey: 'owner:a' }),
      expect.objectContaining({ ownerKey: 'owner:b' })
    ])
    expect(collapsed[0]?.intervalIds).toEqual(['interval:a', 'interval:b'])
    expect(collapsed[0]?.sourceSpanIds).toEqual(['span:a', 'span:b'])
    expect(collapsed[0]?.debugMeta).toMatchObject({
      visualOverlapCollapseStatus: 'exact-union',
      visualOverlapSourceGeometryIds: [
        'candidate:overlap-a',
        'candidate:overlap-b'
      ]
    })
  })

  it('should run: keep one same-visual coverage layer when overlapping inputs use opposite winding', () => {
    const packets = [
      makePacket('candidate:winding-a', {
        ownerKey: 'owner:a',
        intervalId: 'interval:a',
        sourceSpanIds: ['span:a'],
        polygon: square(0, 0, 10),
        alpha: 0.5
      }),
      makePacket('candidate:winding-b', {
        ownerKey: 'owner:b',
        intervalId: 'interval:b',
        sourceSpanIds: ['span:b'],
        polygon: [...square(5, 0, 10)].reverse(),
        alpha: 0.5
      })
    ]
    const faces = buildTestFinalFaces(packets)
    const signedAreas: number[] = []

    const collapsed = collapseStrokeFinalFaceVisualOverlaps(faces, {
      backend: makeUnionBackend((regions) => {
        regions.forEach((region) =>
          region.polygons.forEach((polygon) => {
            let area = 0
            for (let index = 0; index < polygon.length; index += 1) {
              const current = polygon[index]
              const next = polygon[(index + 1) % polygon.length]
              area += current.x * next.y - next.x * current.y
            }
            signedAreas.push(area / 2)
          })
        )
        return [
          {
            polygons: [
              [
                { x: 0, y: 0 },
                { x: 15, y: 0 },
                { x: 15, y: 10 },
                { x: 0, y: 10 }
              ]
            ]
          }
        ]
      })
    })

    expect(signedAreas.every((area) => area > 0)).toBe(true)
    expect(collapsed).toHaveLength(1)
    expect(collapsed[0]?.sourceGeometryIds).toEqual([
      'candidate:winding-a',
      'candidate:winding-b'
    ])
  })

  it('should run: fail open instead of deleting same-visual coverage when backend union returns empty', () => {
    const packets = [
      makePacket('candidate:empty-union-a', {
        ownerKey: 'owner:a',
        polygon: square(0, 0, 10),
        alpha: 0.5
      }),
      makePacket('candidate:empty-union-b', {
        ownerKey: 'owner:b',
        polygon: square(5, 0, 10),
        alpha: 0.5
      })
    ]
    const faces = buildTestFinalFaces(packets)

    const collapsed = collapseStrokeFinalFaceVisualOverlaps(faces, {
      backend: makeUnionBackend(() => [])
    })

    expect(collapsed).toHaveLength(2)
    expect(collapsed.map((face) => face.sourceGeometryIds[0]).sort()).toEqual([
      'candidate:empty-union-a',
      'candidate:empty-union-b'
    ])
  })

  it('should run: keep overlapping faces separate when opacity changes visual packet identity', () => {
    const packets = [
      makePacket('candidate:opacity-a', {
        ownerKey: 'owner:a',
        polygon: square(0, 0, 10),
        alpha: 0.5
      }),
      makePacket('candidate:opacity-b', {
        ownerKey: 'owner:b',
        polygon: square(5, 0, 10),
        alpha: 0.75
      })
    ]
    const faces = buildTestFinalFaces(packets)
    let unionCallCount = 0

    const collapsed = collapseStrokeFinalFaceVisualOverlaps(faces, {
      backend: makeUnionBackend((regions) => {
        unionCallCount += 1
        return regions
      })
    })

    expect(unionCallCount).toBe(0)
    expect(collapsed).toHaveLength(2)
    expect(collapsed.map((face) => face.paint.alpha).sort()).toEqual([0.5, 0.75])
  })

  it('should run: skip same-visual union when final-face bounds do not overlap', () => {
    const packets = [
      makePacket('candidate:separate-a', {
        polygon: square(0, 0, 10)
      }),
      makePacket('candidate:separate-b', {
        polygon: square(20, 0, 10)
      })
    ]
    const faces = buildTestFinalFaces(packets)
    let unionCallCount = 0

    const collapsed = collapseStrokeFinalFaceVisualOverlaps(faces, {
      backend: makeUnionBackend((regions) => {
        unionCallCount += 1
        return regions
      })
    })

    expect(unionCallCount).toBe(0)
    expect(collapsed).toHaveLength(2)
  })

  it('should not run: accept arrangement faces that reference unknown candidates', () => {
    const packet = makePacket('candidate:a')
    const backend = makeBackend(() => [
      {
        faceId: 'face:bad',
        geometry: {
          polygons: [square(0, 0, 5)]
        },
        claimedBy: [
          {
            candidateId: 'candidate:missing',
            geometry: {
              polygons: [square(0, 0, 5)]
            },
            visualPacketKey: 'visual:missing',
            strokePosition: 'inside',
            sourceSpanIds: []
          }
        ],
        legalState: {
          insideFillDomain: true,
          outsideFillDomain: false
        }
      }
    ])

    expect(() =>
      buildArrangedStrokeFinalFacesFromResolvedPackets([packet], { backend })
    ).toThrow('Arrangement face references unknown candidate "candidate:missing"')
  })
})
