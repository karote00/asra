import { describe, expect, it } from 'vitest'
import {
  createDefaultStroke,
  StrokeJoinTypes,
  StrokePositions,
  StrokeStyles
} from '@asyra/utils'
import { buildConstrainedSolidStrokeResolvedPackets } from '../components/stroke-render/constrained-solid-stroke-packets'
import { buildConstrainedSolidOwnershipDiagnostics } from '../components/stroke-render/constrained-solid-ownership-diagnostics'
import type { SolidCenterStrokeResolvedPacket } from '../components/stroke-render/solid-center-stroke-packets'

const createSyntheticPacket = (
  geometryId: string,
  strokeId: string,
  polygon: { x: number; y: number }[]
): SolidCenterStrokeResolvedPacket => ({
  geometry: {
    geometryId,
    polygons: [polygon],
    bounds: {
      minX: Math.min(...polygon.map((point) => point.x)),
      minY: Math.min(...polygon.map((point) => point.y)),
      maxX: Math.max(...polygon.map((point) => point.x)),
      maxY: Math.max(...polygon.map((point) => point.y))
    },
    debugMeta: {
      strokeId
    }
  },
  paint: {
    geometryId,
    color: 0xff0000,
    alpha: 1
  }
})

const createSyntheticMultiPolygonPacket = (
  geometryId: string,
  strokeId: string,
  polygons: { x: number; y: number }[][]
): SolidCenterStrokeResolvedPacket => ({
  geometry: {
    geometryId,
    polygons,
    bounds: {
      minX: Math.min(
        ...polygons.flatMap((polygon) => polygon.map((point) => point.x))
      ),
      minY: Math.min(
        ...polygons.flatMap((polygon) => polygon.map((point) => point.y))
      ),
      maxX: Math.max(
        ...polygons.flatMap((polygon) => polygon.map((point) => point.x))
      ),
      maxY: Math.max(
        ...polygons.flatMap((polygon) => polygon.map((point) => point.y))
      )
    },
    debugMeta: {
      strokeId
    }
  },
  paint: {
    geometryId,
    color: 0xff0000,
    alpha: 1
  }
})

const getSubsetSizeCounts = (
  regions: { candidateIds: string[] }[]
): Record<number, number> =>
  regions.reduce<Record<number, number>>((counts, region) => {
    const size = region.candidateIds.length
    counts[size] = (counts[size] ?? 0) + 1
    return counts
  }, {})

const buildExpectedNestedSubsetSizeCounts = (candidateCount: number) =>
  Array.from({ length: candidateCount - 1 }, (_, index) => index + 2).reduce<
    Record<number, number>
  >((counts, size) => {
    counts[size] = (candidateCount - size + 2) * 4
    return counts
  }, {})

const expectExactNestedOwnershipPartition = (
  diagnostics: ReturnType<typeof buildConstrainedSolidOwnershipDiagnostics>,
  candidateCount: number
) => {
  expect(diagnostics.ownedRegions).toHaveLength(
    (candidateCount * (candidateCount + 1) - 2) * 2
  )
  expect(getSubsetSizeCounts(diagnostics.ownedRegions)).toEqual(
    buildExpectedNestedSubsetSizeCounts(candidateCount)
  )
  expect(
    new Set(diagnostics.ownedRegions.map((region) => region.ownerStrokeId))
  ).toEqual(new Set(['stroke:0']))
}

describe('constrained solid ownership diagnostics', () => {
  it('should run: single multi-polygon candidate emits intra-candidate arrangement faces for self-overlap', () => {
    const diagnostics = buildConstrainedSolidOwnershipDiagnostics([
      createSyntheticMultiPolygonPacket('self-overlap:0', 'stroke:0', [
        [
          { x: 0, y: 0 },
          { x: 20, y: 0 },
          { x: 20, y: 20 },
          { x: 0, y: 20 }
        ],
        [
          { x: 10, y: 10 },
          { x: 30, y: 10 },
          { x: 30, y: 30 },
          { x: 10, y: 30 }
        ]
      ])
    ])

    expect(diagnostics.candidates).toHaveLength(1)
    expect(diagnostics.edges).toEqual([])
    expect(diagnostics.arrangementFaces).toHaveLength(1)
    expect(diagnostics.arrangementFaces[0]).toMatchObject({
      candidateIds: ['candidate:0'],
      ownerStrokeId: 'stroke:0',
      partitionMethod: 'intra-candidate-intersection',
      bounds: { minX: 10, minY: 10, maxX: 20, maxY: 20 }
    })
    expect(diagnostics.ownedRegions).toHaveLength(1)
    expect(diagnostics.ownedRegions[0]).toMatchObject({
      candidateIds: ['candidate:0'],
      ownerStrokeId: 'stroke:0',
      bounds: { minX: 10, minY: 10, maxX: 20, maxY: 20 }
    })
  })

  it('should run: overlapping supported constrained solid packets build deterministic ownership regions', () => {
    const packets = buildConstrainedSolidStrokeResolvedPackets(
      'rect:ownership',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 12,
          color: '#ff0000'
        }),
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 6,
          color: '#0000ff'
        })
      ]
    )

    const diagnostics = buildConstrainedSolidOwnershipDiagnostics(packets)

    expect(diagnostics.arrangementPolicy).toEqual({
      strategy: 'bounded-convex-subset-arrangement',
      epsilon: 0.000001,
      roundingFactor: 1000,
      maxExactSubsetCount: 4096,
      zeroAreaThreshold: 0.000001,
      tangentialTouchPolicy: 'boundary-overlap-without-zero-area-face',
      coincidentEdgePolicy: 'dedupe-rotated-polygon-signatures'
    })
    expect(diagnostics.candidates).toHaveLength(2)
    expect(diagnostics.edges).toEqual([['candidate:0', 'candidate:1']])
    expect(diagnostics.components).toHaveLength(1)
    expect(diagnostics.arrangementFaces).toHaveLength(
      diagnostics.ownedRegions.length
    )
    expect(
      diagnostics.arrangementFaces.every(
        (face) => face.partitionMethod === 'exact-subset-intersection'
      )
    ).toBe(true)
    expect(diagnostics.ownedRegions.length).toBeGreaterThan(0)
    expect(
      new Set(diagnostics.ownedRegions.map((region) => region.ownerStrokeId))
    ).toEqual(new Set(['stroke:0']))
    expect(
      new Set(diagnostics.ownedRegions.map((region) => region.ownerStrokeIndex))
    ).toEqual(new Set([0]))
  })

  it('should run: disjoint constrained packets do not create ownership regions', () => {
    const leftPackets = buildConstrainedSolidStrokeResolvedPackets(
      'rect:left',
      [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 40, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 6,
          color: '#ff0000'
        })
      ]
    )
    const rightPackets = buildConstrainedSolidStrokeResolvedPackets(
      'rect:right',
      [
        { x: 120, y: 0 },
        { x: 160, y: 0 },
        { x: 160, y: 40 },
        { x: 120, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 6,
          color: '#0000ff'
        })
      ]
    )

    const diagnostics = buildConstrainedSolidOwnershipDiagnostics([
      ...leftPackets,
      ...rightPackets
    ])

    expect(diagnostics.edges).toEqual([])
    expect(diagnostics.arrangementFaces).toEqual([])
    expect(diagnostics.ownedRegions).toEqual([])
  })

  it('should run: tangential edge touch records adjacency without emitting zero-area ownership faces', () => {
    const diagnostics = buildConstrainedSolidOwnershipDiagnostics([
      createSyntheticPacket('tangent-edge:0', 'stroke:0', [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 }
      ]),
      createSyntheticPacket('tangent-edge:1', 'stroke:1', [
        { x: 10, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 10 },
        { x: 10, y: 10 }
      ])
    ])

    expect(diagnostics.arrangementPolicy.tangentialTouchPolicy).toBe(
      'boundary-overlap-without-zero-area-face'
    )
    expect(diagnostics.edges).toEqual([['candidate:0', 'candidate:1']])
    expect(diagnostics.components).toHaveLength(1)
    expect(diagnostics.arrangementFaces).toEqual([])
    expect(diagnostics.ownedRegions).toEqual([])
  })

  it('should run: tangential point touch records adjacency without emitting zero-area ownership faces', () => {
    const diagnostics = buildConstrainedSolidOwnershipDiagnostics([
      createSyntheticPacket('tangent-point:0', 'stroke:0', [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 }
      ]),
      createSyntheticPacket('tangent-point:1', 'stroke:1', [
        { x: 10, y: 10 },
        { x: 20, y: 10 },
        { x: 20, y: 20 },
        { x: 10, y: 20 }
      ])
    ])

    expect(diagnostics.arrangementPolicy.tangentialTouchPolicy).toBe(
      'boundary-overlap-without-zero-area-face'
    )
    expect(diagnostics.edges).toEqual([['candidate:0', 'candidate:1']])
    expect(diagnostics.components).toHaveLength(1)
    expect(diagnostics.arrangementFaces).toEqual([])
    expect(diagnostics.ownedRegions).toEqual([])
  })

  it('should run: coincident reversed polygons dedupe into one ownership face', () => {
    const polygon = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
      { x: 0, y: 20 }
    ]
    const diagnostics = buildConstrainedSolidOwnershipDiagnostics([
      createSyntheticPacket('coincident:0', 'stroke:0', polygon),
      createSyntheticPacket('coincident:1', 'stroke:1', [...polygon].reverse())
    ])

    expect(diagnostics.arrangementPolicy.coincidentEdgePolicy).toBe(
      'dedupe-rotated-polygon-signatures'
    )
    expect(diagnostics.edges).toEqual([['candidate:0', 'candidate:1']])
    expect(diagnostics.arrangementFaces).toHaveLength(1)
    expect(diagnostics.ownedRegions).toHaveLength(1)
    expect(diagnostics.ownedRegions[0]).toMatchObject({
      candidateIds: ['candidate:0', 'candidate:1'],
      ownerStrokeId: 'stroke:0',
      bounds: { minX: 0, minY: 0, maxX: 20, maxY: 20 }
    })
  })

  it('should run: two-candidate constrained overlap emits canonical shared regions instead of full surrogate owner polygons', () => {
    const packets = buildConstrainedSolidStrokeResolvedPackets(
      'rect:ownership:join-diff',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 12,
          color: '#ff0000',
          joinType: StrokeJoinTypes.MITER
        }),
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 12,
          color: '#0000ff',
          joinType: StrokeJoinTypes.BEVEL
        })
      ]
    )

    const diagnostics = buildConstrainedSolidOwnershipDiagnostics(packets)

    expectExactNestedOwnershipPartition(diagnostics, 2)
  })

  it('should run: nested three-candidate constrained overlap emits exact candidate-set ownership regions', () => {
    const packets = buildConstrainedSolidStrokeResolvedPackets(
      'rect:ownership:nested',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 12,
          color: '#ff0000'
        }),
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 8,
          color: '#0000ff'
        }),
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 4,
          color: '#00ff00'
        })
      ]
    )

    const diagnostics = buildConstrainedSolidOwnershipDiagnostics(packets)

    expectExactNestedOwnershipPartition(diagnostics, 3)
  })

  it('should run: partial-overlap three-candidate components emit exact pairwise ownership regions without a shared all-candidate region', () => {
    const diagnostics = buildConstrainedSolidOwnershipDiagnostics([
      createSyntheticPacket('partial:0', 'stroke:0', [
        { x: 0, y: 0 },
        { x: 7, y: 0 },
        { x: 7, y: 6 },
        { x: 0, y: 6 }
      ]),
      createSyntheticPacket('partial:1', 'stroke:1', [
        { x: 4, y: 0 },
        { x: 13, y: 0 },
        { x: 13, y: 6 },
        { x: 4, y: 6 }
      ]),
      createSyntheticPacket('partial:2', 'stroke:2', [
        { x: 10, y: 0 },
        { x: 18, y: 0 },
        { x: 18, y: 6 },
        { x: 10, y: 6 }
      ])
    ])

    expect(diagnostics.edges).toEqual([
      ['candidate:0', 'candidate:1'],
      ['candidate:1', 'candidate:2']
    ])
    expect(
      diagnostics.ownedRegions.map((region) => region.candidateIds)
    ).toEqual([
      ['candidate:0', 'candidate:1'],
      ['candidate:1', 'candidate:2']
    ])
    expect(
      diagnostics.arrangementFaces.map((face) => ({
        candidateIds: face.candidateIds,
        ownerStrokeId: face.ownerStrokeId,
        partitionMethod: face.partitionMethod,
        bounds: face.bounds
      }))
    ).toEqual([
      {
        candidateIds: ['candidate:0', 'candidate:1'],
        ownerStrokeId: 'stroke:0',
        partitionMethod: 'exact-subset-intersection',
        bounds: { minX: 4, minY: 0, maxX: 7, maxY: 6 }
      },
      {
        candidateIds: ['candidate:1', 'candidate:2'],
        ownerStrokeId: 'stroke:1',
        partitionMethod: 'exact-subset-intersection',
        bounds: { minX: 10, minY: 0, maxX: 13, maxY: 6 }
      }
    ])
    expect(diagnostics.ownedRegions.map((region) => region.bounds)).toEqual([
      { minX: 4, minY: 0, maxX: 7, maxY: 6 },
      { minX: 10, minY: 0, maxX: 13, maxY: 6 }
    ])
    expect(
      new Set(diagnostics.ownedRegions.map((region) => region.ownerStrokeId))
    ).toEqual(new Set(['stroke:0', 'stroke:1']))
  })

  it('should run: four-candidate partial-overlap chains emit deterministic exact pairwise ownership regions', () => {
    const diagnostics = buildConstrainedSolidOwnershipDiagnostics([
      createSyntheticPacket('chain:0', 'stroke:0', [
        { x: 0, y: 0 },
        { x: 7, y: 0 },
        { x: 7, y: 6 },
        { x: 0, y: 6 }
      ]),
      createSyntheticPacket('chain:1', 'stroke:1', [
        { x: 4, y: 0 },
        { x: 13, y: 0 },
        { x: 13, y: 6 },
        { x: 4, y: 6 }
      ]),
      createSyntheticPacket('chain:2', 'stroke:2', [
        { x: 10, y: 0 },
        { x: 18, y: 0 },
        { x: 18, y: 6 },
        { x: 10, y: 6 }
      ]),
      createSyntheticPacket('chain:3', 'stroke:3', [
        { x: 15, y: 0 },
        { x: 24, y: 0 },
        { x: 24, y: 6 },
        { x: 15, y: 6 }
      ])
    ])

    expect(diagnostics.edges).toEqual([
      ['candidate:0', 'candidate:1'],
      ['candidate:1', 'candidate:2'],
      ['candidate:2', 'candidate:3']
    ])
    expect(
      diagnostics.ownedRegions.map((region) => region.candidateIds)
    ).toEqual([
      ['candidate:0', 'candidate:1'],
      ['candidate:1', 'candidate:2'],
      ['candidate:2', 'candidate:3']
    ])
    expect(diagnostics.ownedRegions.map((region) => region.bounds)).toEqual([
      { minX: 4, minY: 0, maxX: 7, maxY: 6 },
      { minX: 10, minY: 0, maxX: 13, maxY: 6 },
      { minX: 15, minY: 0, maxX: 18, maxY: 6 }
    ])
    expect(
      new Set(diagnostics.ownedRegions.map((region) => region.ownerStrokeId))
    ).toEqual(new Set(['stroke:0', 'stroke:1', 'stroke:2']))
  })

  it('should run: four-candidate branch components emit exact candidate-set ownership regions for branch and triple-overlap subsets', () => {
    const diagnostics = buildConstrainedSolidOwnershipDiagnostics([
      createSyntheticPacket('branch:0', 'stroke:0', [
        { x: 0, y: 0 },
        { x: 7, y: 0 },
        { x: 7, y: 6 },
        { x: 0, y: 6 }
      ]),
      createSyntheticPacket('branch:1', 'stroke:1', [
        { x: 4, y: 0 },
        { x: 13, y: 0 },
        { x: 13, y: 6 },
        { x: 4, y: 6 }
      ]),
      createSyntheticPacket('branch:2', 'stroke:2', [
        { x: 10, y: 0 },
        { x: 18, y: 0 },
        { x: 18, y: 6 },
        { x: 10, y: 6 }
      ]),
      createSyntheticPacket('branch:3', 'stroke:3', [
        { x: 4, y: -6 },
        { x: 13, y: -6 },
        { x: 13, y: 2 },
        { x: 4, y: 2 }
      ])
    ])

    expect(diagnostics.edges).toEqual([
      ['candidate:0', 'candidate:1'],
      ['candidate:0', 'candidate:3'],
      ['candidate:1', 'candidate:2'],
      ['candidate:1', 'candidate:3'],
      ['candidate:2', 'candidate:3']
    ])
    expect(
      diagnostics.ownedRegions.map((region) => region.candidateIds)
    ).toEqual([
      ['candidate:0', 'candidate:1', 'candidate:3'],
      ['candidate:0', 'candidate:1'],
      ['candidate:1', 'candidate:2', 'candidate:3'],
      ['candidate:1', 'candidate:2'],
      ['candidate:1', 'candidate:3']
    ])
    expect(diagnostics.ownedRegions.map((region) => region.bounds)).toEqual([
      { minX: 4, minY: 0, maxX: 7, maxY: 2 },
      { minX: 4, minY: 2, maxX: 7, maxY: 6 },
      { minX: 10, minY: 0, maxX: 13, maxY: 2 },
      { minX: 10, minY: 2, maxX: 13, maxY: 6 },
      { minX: 7, minY: 0, maxX: 10, maxY: 2 }
    ])
    expect(
      new Set(diagnostics.ownedRegions.map((region) => region.ownerStrokeId))
    ).toEqual(new Set(['stroke:0', 'stroke:1']))
  })

  it('should run: nested five-candidate constrained overlap emits deterministic exact candidate-set ownership regions beyond the former four-candidate cap', () => {
    const packets = buildConstrainedSolidStrokeResolvedPackets(
      'rect:ownership:nested-five',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 16,
          color: '#ff0000'
        }),
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 12,
          color: '#0000ff'
        }),
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 8,
          color: '#00ff00'
        }),
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 6,
          color: '#ff00ff'
        }),
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 4,
          color: '#00ffff'
        })
      ]
    )

    const diagnostics = buildConstrainedSolidOwnershipDiagnostics(packets)

    expectExactNestedOwnershipPartition(diagnostics, 5)
    return undefined

    expect(diagnostics.ownedRegions).toHaveLength(16)
    expect(
      diagnostics.ownedRegions.map((region) => region.candidateIds)
    ).toEqual([
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4'
      ],
      ['candidate:0', 'candidate:1', 'candidate:2', 'candidate:3'],
      ['candidate:0', 'candidate:1', 'candidate:2', 'candidate:3'],
      ['candidate:0', 'candidate:1', 'candidate:2', 'candidate:3'],
      ['candidate:0', 'candidate:1', 'candidate:2', 'candidate:3'],
      ['candidate:0', 'candidate:1', 'candidate:2'],
      ['candidate:0', 'candidate:1', 'candidate:2'],
      ['candidate:0', 'candidate:1', 'candidate:2'],
      ['candidate:0', 'candidate:1', 'candidate:2'],
      ['candidate:0', 'candidate:1'],
      ['candidate:0', 'candidate:1'],
      ['candidate:0', 'candidate:1'],
      ['candidate:0', 'candidate:1']
    ])
    expect(diagnostics.ownedRegions.map((region) => region.bounds)).toEqual([
      { minX: -4, minY: -4, maxX: 84, maxY: 0 },
      { minX: 80, minY: -4, maxX: 84, maxY: 44 },
      { minX: -4, minY: 40, maxX: 84, maxY: 44 },
      { minX: -4, minY: -4, maxX: 0, maxY: 44 },
      { minX: -6, minY: -6, maxX: 86, maxY: -4 },
      { minX: 84, minY: -6, maxX: 86, maxY: 46 },
      { minX: -6, minY: 44, maxX: 86, maxY: 46 },
      { minX: -6, minY: -6, maxX: -4, maxY: 46 },
      { minX: -8, minY: -8, maxX: 88, maxY: -6 },
      { minX: 86, minY: -8, maxX: 88, maxY: 48 },
      { minX: -8, minY: 46, maxX: 88, maxY: 48 },
      { minX: -8, minY: -8, maxX: -6, maxY: 48 },
      { minX: -12, minY: -12, maxX: 92, maxY: -8 },
      { minX: 88, minY: -12, maxX: 92, maxY: 52 },
      { minX: -12, minY: 48, maxX: 92, maxY: 52 },
      { minX: -12, minY: -12, maxX: -8, maxY: 52 }
    ])
    expect(
      new Set(diagnostics.ownedRegions.map((region) => region.ownerStrokeId))
    ).toEqual(new Set(['stroke:0']))
  })

  it('should run: nested six-candidate constrained overlap emits deterministic exact candidate-set ownership regions beyond the former five-candidate cap', () => {
    const packets = buildConstrainedSolidStrokeResolvedPackets(
      'rect:ownership:nested-six',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 20,
          color: '#ff0000'
        }),
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 16,
          color: '#0000ff'
        }),
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 12,
          color: '#00ff00'
        }),
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 8,
          color: '#ff00ff'
        }),
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 6,
          color: '#00ffff'
        }),
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 4,
          color: '#ffaa00'
        })
      ]
    )

    const diagnostics = buildConstrainedSolidOwnershipDiagnostics(packets)

    expectExactNestedOwnershipPartition(diagnostics, 6)
    return undefined

    expect(diagnostics.ownedRegions).toHaveLength(20)
    expect(
      diagnostics.ownedRegions.map((region) => region.candidateIds)
    ).toEqual([
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4',
        'candidate:5'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4',
        'candidate:5'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4',
        'candidate:5'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4',
        'candidate:5'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4'
      ],
      ['candidate:0', 'candidate:1', 'candidate:2', 'candidate:3'],
      ['candidate:0', 'candidate:1', 'candidate:2', 'candidate:3'],
      ['candidate:0', 'candidate:1', 'candidate:2', 'candidate:3'],
      ['candidate:0', 'candidate:1', 'candidate:2', 'candidate:3'],
      ['candidate:0', 'candidate:1', 'candidate:2'],
      ['candidate:0', 'candidate:1', 'candidate:2'],
      ['candidate:0', 'candidate:1', 'candidate:2'],
      ['candidate:0', 'candidate:1', 'candidate:2'],
      ['candidate:0', 'candidate:1'],
      ['candidate:0', 'candidate:1'],
      ['candidate:0', 'candidate:1'],
      ['candidate:0', 'candidate:1']
    ])
    expect(diagnostics.ownedRegions.map((region) => region.bounds)).toEqual([
      { minX: -4, minY: -4, maxX: 84, maxY: 0 },
      { minX: 80, minY: -4, maxX: 84, maxY: 44 },
      { minX: -4, minY: 40, maxX: 84, maxY: 44 },
      { minX: -4, minY: -4, maxX: 0, maxY: 44 },
      { minX: -6, minY: -6, maxX: 86, maxY: -4 },
      { minX: 84, minY: -6, maxX: 86, maxY: 46 },
      { minX: -6, minY: 44, maxX: 86, maxY: 46 },
      { minX: -6, minY: -6, maxX: -4, maxY: 46 },
      { minX: -8, minY: -8, maxX: 88, maxY: -6 },
      { minX: 86, minY: -8, maxX: 88, maxY: 48 },
      { minX: -8, minY: 46, maxX: 88, maxY: 48 },
      { minX: -8, minY: -8, maxX: -6, maxY: 48 },
      { minX: -12, minY: -12, maxX: 92, maxY: -8 },
      { minX: 88, minY: -12, maxX: 92, maxY: 52 },
      { minX: -12, minY: 48, maxX: 92, maxY: 52 },
      { minX: -12, minY: -12, maxX: -8, maxY: 52 },
      { minX: -16, minY: -16, maxX: 96, maxY: -12 },
      { minX: 92, minY: -16, maxX: 96, maxY: 56 },
      { minX: -16, minY: 52, maxX: 96, maxY: 56 },
      { minX: -16, minY: -16, maxX: -12, maxY: 56 }
    ])
    expect(
      new Set(diagnostics.ownedRegions.map((region) => region.ownerStrokeId))
    ).toEqual(new Set(['stroke:0']))
  })

  it('should run: nested seven-candidate constrained overlap emits deterministic exact candidate-set ownership regions beyond the former six-candidate cap', () => {
    const packets = buildConstrainedSolidStrokeResolvedPackets(
      'rect:ownership:nested-seven',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 24,
          color: '#ff0000'
        }),
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 20,
          color: '#0000ff'
        }),
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 16,
          color: '#00ff00'
        }),
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 12,
          color: '#ff00ff'
        }),
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 8,
          color: '#00ffff'
        }),
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 6,
          color: '#ffaa00'
        }),
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 4,
          color: '#8855ff'
        })
      ]
    )

    const diagnostics = buildConstrainedSolidOwnershipDiagnostics(packets)

    expectExactNestedOwnershipPartition(diagnostics, 7)
    return undefined

    expect(diagnostics.ownedRegions).toHaveLength(24)
    expect(
      diagnostics.ownedRegions.map((region) => region.candidateIds)
    ).toEqual([
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4',
        'candidate:5',
        'candidate:6'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4',
        'candidate:5',
        'candidate:6'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4',
        'candidate:5',
        'candidate:6'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4',
        'candidate:5',
        'candidate:6'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4',
        'candidate:5'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4',
        'candidate:5'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4',
        'candidate:5'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4',
        'candidate:5'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4'
      ],
      ['candidate:0', 'candidate:1', 'candidate:2', 'candidate:3'],
      ['candidate:0', 'candidate:1', 'candidate:2', 'candidate:3'],
      ['candidate:0', 'candidate:1', 'candidate:2', 'candidate:3'],
      ['candidate:0', 'candidate:1', 'candidate:2', 'candidate:3'],
      ['candidate:0', 'candidate:1', 'candidate:2'],
      ['candidate:0', 'candidate:1', 'candidate:2'],
      ['candidate:0', 'candidate:1', 'candidate:2'],
      ['candidate:0', 'candidate:1', 'candidate:2'],
      ['candidate:0', 'candidate:1'],
      ['candidate:0', 'candidate:1'],
      ['candidate:0', 'candidate:1'],
      ['candidate:0', 'candidate:1']
    ])
    expect(diagnostics.ownedRegions.map((region) => region.bounds)).toEqual([
      { minX: -4, minY: -4, maxX: 84, maxY: 0 },
      { minX: 80, minY: -4, maxX: 84, maxY: 44 },
      { minX: -4, minY: 40, maxX: 84, maxY: 44 },
      { minX: -4, minY: -4, maxX: 0, maxY: 44 },
      { minX: -6, minY: -6, maxX: 86, maxY: -4 },
      { minX: 84, minY: -6, maxX: 86, maxY: 46 },
      { minX: -6, minY: 44, maxX: 86, maxY: 46 },
      { minX: -6, minY: -6, maxX: -4, maxY: 46 },
      { minX: -8, minY: -8, maxX: 88, maxY: -6 },
      { minX: 86, minY: -8, maxX: 88, maxY: 48 },
      { minX: -8, minY: 46, maxX: 88, maxY: 48 },
      { minX: -8, minY: -8, maxX: -6, maxY: 48 },
      { minX: -12, minY: -12, maxX: 92, maxY: -8 },
      { minX: 88, minY: -12, maxX: 92, maxY: 52 },
      { minX: -12, minY: 48, maxX: 92, maxY: 52 },
      { minX: -12, minY: -12, maxX: -8, maxY: 52 },
      { minX: -16, minY: -16, maxX: 96, maxY: -12 },
      { minX: 92, minY: -16, maxX: 96, maxY: 56 },
      { minX: -16, minY: 52, maxX: 96, maxY: 56 },
      { minX: -16, minY: -16, maxX: -12, maxY: 56 },
      { minX: -20, minY: -20, maxX: 100, maxY: -16 },
      { minX: 96, minY: -20, maxX: 100, maxY: 60 },
      { minX: -20, minY: 56, maxX: 100, maxY: 60 },
      { minX: -20, minY: -20, maxX: -16, maxY: 60 }
    ])
    expect(
      new Set(diagnostics.ownedRegions.map((region) => region.ownerStrokeId))
    ).toEqual(new Set(['stroke:0']))
  })

  it('should run: nested eight-candidate constrained overlap emits deterministic exact candidate-set ownership regions beyond the former seven-candidate cap', () => {
    const packets = buildConstrainedSolidStrokeResolvedPackets(
      'rect:ownership:nested-eight',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 28,
          color: '#ff0000'
        }),
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 24,
          color: '#0000ff'
        }),
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 20,
          color: '#00ff00'
        }),
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 16,
          color: '#ff00ff'
        }),
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 12,
          color: '#00ffff'
        }),
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 8,
          color: '#ffaa00'
        }),
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 6,
          color: '#8855ff'
        }),
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 4,
          color: '#44aa88'
        })
      ]
    )

    const diagnostics = buildConstrainedSolidOwnershipDiagnostics(packets)

    expectExactNestedOwnershipPartition(diagnostics, 8)
    return undefined

    expect(diagnostics.ownedRegions).toHaveLength(28)
    expect(
      diagnostics.ownedRegions.map((region) => region.candidateIds)
    ).toEqual([
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4',
        'candidate:5',
        'candidate:6',
        'candidate:7'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4',
        'candidate:5',
        'candidate:6',
        'candidate:7'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4',
        'candidate:5',
        'candidate:6',
        'candidate:7'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4',
        'candidate:5',
        'candidate:6',
        'candidate:7'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4',
        'candidate:5',
        'candidate:6'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4',
        'candidate:5',
        'candidate:6'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4',
        'candidate:5',
        'candidate:6'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4',
        'candidate:5',
        'candidate:6'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4',
        'candidate:5'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4',
        'candidate:5'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4',
        'candidate:5'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4',
        'candidate:5'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4'
      ],
      ['candidate:0', 'candidate:1', 'candidate:2', 'candidate:3'],
      ['candidate:0', 'candidate:1', 'candidate:2', 'candidate:3'],
      ['candidate:0', 'candidate:1', 'candidate:2', 'candidate:3'],
      ['candidate:0', 'candidate:1', 'candidate:2', 'candidate:3'],
      ['candidate:0', 'candidate:1', 'candidate:2'],
      ['candidate:0', 'candidate:1', 'candidate:2'],
      ['candidate:0', 'candidate:1', 'candidate:2'],
      ['candidate:0', 'candidate:1', 'candidate:2'],
      ['candidate:0', 'candidate:1'],
      ['candidate:0', 'candidate:1'],
      ['candidate:0', 'candidate:1'],
      ['candidate:0', 'candidate:1']
    ])
    expect(diagnostics.ownedRegions.map((region) => region.bounds)).toEqual([
      { minX: -4, minY: -4, maxX: 84, maxY: 0 },
      { minX: 80, minY: -4, maxX: 84, maxY: 44 },
      { minX: -4, minY: 40, maxX: 84, maxY: 44 },
      { minX: -4, minY: -4, maxX: 0, maxY: 44 },
      { minX: -6, minY: -6, maxX: 86, maxY: -4 },
      { minX: 84, minY: -6, maxX: 86, maxY: 46 },
      { minX: -6, minY: 44, maxX: 86, maxY: 46 },
      { minX: -6, minY: -6, maxX: -4, maxY: 46 },
      { minX: -8, minY: -8, maxX: 88, maxY: -6 },
      { minX: 86, minY: -8, maxX: 88, maxY: 48 },
      { minX: -8, minY: 46, maxX: 88, maxY: 48 },
      { minX: -8, minY: -8, maxX: -6, maxY: 48 },
      { minX: -12, minY: -12, maxX: 92, maxY: -8 },
      { minX: 88, minY: -12, maxX: 92, maxY: 52 },
      { minX: -12, minY: 48, maxX: 92, maxY: 52 },
      { minX: -12, minY: -12, maxX: -8, maxY: 52 },
      { minX: -16, minY: -16, maxX: 96, maxY: -12 },
      { minX: 92, minY: -16, maxX: 96, maxY: 56 },
      { minX: -16, minY: 52, maxX: 96, maxY: 56 },
      { minX: -16, minY: -16, maxX: -12, maxY: 56 },
      { minX: -20, minY: -20, maxX: 100, maxY: -16 },
      { minX: 96, minY: -20, maxX: 100, maxY: 60 },
      { minX: -20, minY: 56, maxX: 100, maxY: 60 },
      { minX: -20, minY: -20, maxX: -16, maxY: 60 },
      { minX: -24, minY: -24, maxX: 104, maxY: -20 },
      { minX: 100, minY: -24, maxX: 104, maxY: 64 },
      { minX: -24, minY: 60, maxX: 104, maxY: 64 },
      { minX: -24, minY: -24, maxX: -20, maxY: 64 }
    ])
    expect(
      new Set(diagnostics.ownedRegions.map((region) => region.ownerStrokeId))
    ).toEqual(new Set(['stroke:0']))
  })

  it('should run: nested nine-candidate constrained overlap emits deterministic exact candidate-set ownership regions beyond the former eight-candidate cap', () => {
    const packets = buildConstrainedSolidStrokeResolvedPackets(
      'rect:ownership:nested-nine',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 32,
          color: '#ff0000'
        }),
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 28,
          color: '#0000ff'
        }),
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 24,
          color: '#00ff00'
        }),
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 20,
          color: '#ff00ff'
        }),
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 16,
          color: '#00ffff'
        }),
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 12,
          color: '#ffaa00'
        }),
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 8,
          color: '#8855ff'
        }),
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 6,
          color: '#44aa88'
        }),
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 4,
          color: '#aa8844'
        })
      ]
    )

    const diagnostics = buildConstrainedSolidOwnershipDiagnostics(packets)

    expectExactNestedOwnershipPartition(diagnostics, 9)
    return undefined

    expect(diagnostics.ownedRegions).toHaveLength(32)
    expect(
      diagnostics.ownedRegions.map((region) => region.candidateIds)
    ).toEqual([
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4',
        'candidate:5',
        'candidate:6',
        'candidate:7',
        'candidate:8'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4',
        'candidate:5',
        'candidate:6',
        'candidate:7',
        'candidate:8'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4',
        'candidate:5',
        'candidate:6',
        'candidate:7',
        'candidate:8'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4',
        'candidate:5',
        'candidate:6',
        'candidate:7',
        'candidate:8'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4',
        'candidate:5',
        'candidate:6',
        'candidate:7'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4',
        'candidate:5',
        'candidate:6',
        'candidate:7'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4',
        'candidate:5',
        'candidate:6',
        'candidate:7'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4',
        'candidate:5',
        'candidate:6',
        'candidate:7'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4',
        'candidate:5',
        'candidate:6'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4',
        'candidate:5',
        'candidate:6'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4',
        'candidate:5',
        'candidate:6'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4',
        'candidate:5',
        'candidate:6'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4',
        'candidate:5'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4',
        'candidate:5'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4',
        'candidate:5'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4',
        'candidate:5'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4'
      ],
      [
        'candidate:0',
        'candidate:1',
        'candidate:2',
        'candidate:3',
        'candidate:4'
      ],
      ['candidate:0', 'candidate:1', 'candidate:2', 'candidate:3'],
      ['candidate:0', 'candidate:1', 'candidate:2', 'candidate:3'],
      ['candidate:0', 'candidate:1', 'candidate:2', 'candidate:3'],
      ['candidate:0', 'candidate:1', 'candidate:2', 'candidate:3'],
      ['candidate:0', 'candidate:1', 'candidate:2'],
      ['candidate:0', 'candidate:1', 'candidate:2'],
      ['candidate:0', 'candidate:1', 'candidate:2'],
      ['candidate:0', 'candidate:1', 'candidate:2'],
      ['candidate:0', 'candidate:1'],
      ['candidate:0', 'candidate:1'],
      ['candidate:0', 'candidate:1'],
      ['candidate:0', 'candidate:1']
    ])
    expect(diagnostics.ownedRegions.map((region) => region.bounds)).toEqual([
      { minX: -4, minY: -4, maxX: 84, maxY: 0 },
      { minX: 80, minY: -4, maxX: 84, maxY: 44 },
      { minX: -4, minY: 40, maxX: 84, maxY: 44 },
      { minX: -4, minY: -4, maxX: 0, maxY: 44 },
      { minX: -6, minY: -6, maxX: 86, maxY: -4 },
      { minX: 84, minY: -6, maxX: 86, maxY: 46 },
      { minX: -6, minY: 44, maxX: 86, maxY: 46 },
      { minX: -6, minY: -6, maxX: -4, maxY: 46 },
      { minX: -8, minY: -8, maxX: 88, maxY: -6 },
      { minX: 86, minY: -8, maxX: 88, maxY: 48 },
      { minX: -8, minY: 46, maxX: 88, maxY: 48 },
      { minX: -8, minY: -8, maxX: -6, maxY: 48 },
      { minX: -12, minY: -12, maxX: 92, maxY: -8 },
      { minX: 88, minY: -12, maxX: 92, maxY: 52 },
      { minX: -12, minY: 48, maxX: 92, maxY: 52 },
      { minX: -12, minY: -12, maxX: -8, maxY: 52 },
      { minX: -16, minY: -16, maxX: 96, maxY: -12 },
      { minX: 92, minY: -16, maxX: 96, maxY: 56 },
      { minX: -16, minY: 52, maxX: 96, maxY: 56 },
      { minX: -16, minY: -16, maxX: -12, maxY: 56 },
      { minX: -20, minY: -20, maxX: 100, maxY: -16 },
      { minX: 96, minY: -20, maxX: 100, maxY: 60 },
      { minX: -20, minY: 56, maxX: 100, maxY: 60 },
      { minX: -20, minY: -20, maxX: -16, maxY: 60 },
      { minX: -24, minY: -24, maxX: 104, maxY: -20 },
      { minX: 100, minY: -24, maxX: 104, maxY: 64 },
      { minX: -24, minY: 60, maxX: 104, maxY: 64 },
      { minX: -24, minY: -24, maxX: -20, maxY: 64 },
      { minX: -28, minY: -28, maxX: 108, maxY: -24 },
      { minX: 104, minY: -28, maxX: 108, maxY: 68 },
      { minX: -28, minY: 64, maxX: 108, maxY: 68 },
      { minX: -28, minY: -28, maxX: -24, maxY: 68 }
    ])
    expect(
      new Set(diagnostics.ownedRegions.map((region) => region.ownerStrokeId))
    ).toEqual(new Set(['stroke:0']))
  })

  it('should run: nested ten-candidate constrained overlap stays on the exact candidate-set path under the subset-budget gate', () => {
    const packets = buildConstrainedSolidStrokeResolvedPackets(
      'rect:ownership:nested-ten',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 36,
          color: '#ff0000'
        }),
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 32,
          color: '#0000ff'
        }),
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 28,
          color: '#00ff00'
        }),
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 24,
          color: '#ff00ff'
        }),
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 20,
          color: '#00ffff'
        }),
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 16,
          color: '#ffaa00'
        }),
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 12,
          color: '#8855ff'
        }),
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 8,
          color: '#44aa88'
        }),
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 6,
          color: '#aa8844'
        }),
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 4,
          color: '#cc6677'
        })
      ]
    )

    const diagnostics = buildConstrainedSolidOwnershipDiagnostics(packets)
    expectExactNestedOwnershipPartition(diagnostics, 10)
    return undefined

    const subsetSizeCounts = diagnostics.ownedRegions.reduce<
      Record<number, number>
    >((counts, region) => {
      const size = region.candidateIds.length
      counts[size] = (counts[size] ?? 0) + 1
      return counts
    }, {})

    expect(diagnostics.ownedRegions).toHaveLength(36)
    expect(subsetSizeCounts).toEqual({
      2: 4,
      3: 4,
      4: 4,
      5: 4,
      6: 4,
      7: 4,
      8: 4,
      9: 4,
      10: 4
    })
    expect(
      new Set(diagnostics.ownedRegions.map((region) => region.ownerStrokeId))
    ).toEqual(new Set(['stroke:0']))
  })

  it('should run: mixed-topology five-candidate constrained overlap emits deterministic exact candidate-set ownership regions across disconnected sub-packets', () => {
    const createNestedMixedPacket = (
      geometryId: string,
      strokeId: string,
      inset: number
    ) =>
      createSyntheticMultiPolygonPacket(geometryId, strokeId, [
        [
          { x: -16 + inset, y: -16 + inset },
          { x: 96 - inset, y: -16 + inset },
          { x: 96 - inset, y: 56 - inset },
          { x: -16 + inset, y: 56 - inset }
        ],
        [
          { x: 104 + inset, y: -16 + inset },
          { x: 216 - inset, y: -16 + inset },
          { x: 216 - inset, y: 56 - inset },
          { x: 104 + inset, y: 56 - inset }
        ]
      ])

    const diagnostics = buildConstrainedSolidOwnershipDiagnostics([
      createNestedMixedPacket('mixed-nested:0', 'stroke:0', 0),
      createNestedMixedPacket('mixed-nested:1', 'stroke:1', 4),
      createNestedMixedPacket('mixed-nested:2', 'stroke:2', 8),
      createNestedMixedPacket('mixed-nested:3', 'stroke:3', 12),
      createNestedMixedPacket('mixed-nested:4', 'stroke:4', 16)
    ])

    expect(diagnostics.ownedRegions).toHaveLength(50)
    expect(
      diagnostics.ownedRegions.reduce<Record<string, number>>(
        (result, region) => {
          const key = region.candidateIds.join('|')
          result[key] = (result[key] ?? 0) + 1
          return result
        },
        {}
      )
    ).toEqual({
      'candidate:0|candidate:1': 24,
      'candidate:0|candidate:1|candidate:2': 16,
      'candidate:0|candidate:1|candidate:2|candidate:3': 8,
      'candidate:0|candidate:1|candidate:2|candidate:3|candidate:4': 2
    })
    expect(
      diagnostics.ownedRegions
        .filter((region) => region.candidateIds.length === 5)
        .map((region) => region.bounds)
    ).toEqual([
      { minX: 0, minY: 0, maxX: 80, maxY: 40 },
      { minX: 120, minY: 0, maxX: 200, maxY: 40 }
    ])
    expect(
      new Set(diagnostics.ownedRegions.map((region) => region.ownerStrokeId))
    ).toEqual(new Set(['stroke:0']))
  })

  it('should run: mixed-topology six-candidate constrained overlap emits deterministic exact candidate-set ownership regions across disconnected sub-packets', () => {
    const createNestedMixedPacket = (
      geometryId: string,
      strokeId: string,
      inset: number
    ) =>
      createSyntheticMultiPolygonPacket(geometryId, strokeId, [
        [
          { x: -20 + inset, y: -20 + inset },
          { x: 100 - inset, y: -20 + inset },
          { x: 100 - inset, y: 60 - inset },
          { x: -20 + inset, y: 60 - inset }
        ],
        [
          { x: 100 + inset, y: -20 + inset },
          { x: 220 - inset, y: -20 + inset },
          { x: 220 - inset, y: 60 - inset },
          { x: 100 + inset, y: 60 - inset }
        ]
      ])

    const diagnostics = buildConstrainedSolidOwnershipDiagnostics([
      createNestedMixedPacket('mixed-nested-six:0', 'stroke:0', 0),
      createNestedMixedPacket('mixed-nested-six:1', 'stroke:1', 4),
      createNestedMixedPacket('mixed-nested-six:2', 'stroke:2', 8),
      createNestedMixedPacket('mixed-nested-six:3', 'stroke:3', 12),
      createNestedMixedPacket('mixed-nested-six:4', 'stroke:4', 16),
      createNestedMixedPacket('mixed-nested-six:5', 'stroke:5', 20)
    ])

    expect(diagnostics.ownedRegions).toHaveLength(82)
    expect(
      diagnostics.ownedRegions.reduce<Record<string, number>>(
        (result, region) => {
          const key = region.candidateIds.join('|')
          result[key] = (result[key] ?? 0) + 1
          return result
        },
        {}
      )
    ).toEqual({
      'candidate:0|candidate:1': 32,
      'candidate:0|candidate:1|candidate:2': 24,
      'candidate:0|candidate:1|candidate:2|candidate:3': 16,
      'candidate:0|candidate:1|candidate:2|candidate:3|candidate:4': 8,
      'candidate:0|candidate:1|candidate:2|candidate:3|candidate:4|candidate:5': 2
    })
    expect(
      diagnostics.ownedRegions
        .filter((region) => region.candidateIds.length === 6)
        .map((region) => region.bounds)
    ).toEqual([
      { minX: 0, minY: 0, maxX: 80, maxY: 40 },
      { minX: 120, minY: 0, maxX: 200, maxY: 40 }
    ])
    expect(
      new Set(diagnostics.ownedRegions.map((region) => region.ownerStrokeId))
    ).toEqual(new Set(['stroke:0']))
  })

  it('should run: mixed-topology multi-polygon candidates keep deterministic exact ownership regions across disconnected sub-packets', () => {
    const diagnostics = buildConstrainedSolidOwnershipDiagnostics([
      createSyntheticPacket('mixed:0', 'stroke:0', [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 6 },
        { x: 0, y: 6 }
      ]),
      {
        geometry: {
          geometryId: 'mixed:1',
          polygons: [
            [
              { x: 3, y: 0 },
              { x: 8, y: 0 },
              { x: 8, y: 6 },
              { x: 3, y: 6 }
            ],
            [
              { x: 10, y: 0 },
              { x: 15, y: 0 },
              { x: 15, y: 6 },
              { x: 10, y: 6 }
            ]
          ],
          bounds: {
            minX: 3,
            minY: 0,
            maxX: 15,
            maxY: 6
          },
          debugMeta: {
            strokeId: 'stroke:1'
          }
        },
        paint: {
          geometryId: 'mixed:1',
          color: 0x0000ff,
          alpha: 1
        }
      },
      createSyntheticPacket('mixed:2', 'stroke:2', [
        { x: 13, y: 0 },
        { x: 18, y: 0 },
        { x: 18, y: 6 },
        { x: 13, y: 6 }
      ])
    ])

    expect(diagnostics.edges).toEqual([
      ['candidate:0', 'candidate:1'],
      ['candidate:1', 'candidate:2']
    ])
    expect(
      diagnostics.ownedRegions.map((region) => region.candidateIds)
    ).toEqual([
      ['candidate:0', 'candidate:1'],
      ['candidate:1', 'candidate:2']
    ])
    expect(diagnostics.ownedRegions.map((region) => region.bounds)).toEqual([
      { minX: 3, minY: 0, maxX: 5, maxY: 6 },
      { minX: 13, minY: 0, maxX: 15, maxY: 6 }
    ])
    expect(
      new Set(diagnostics.ownedRegions.map((region) => region.ownerStrokeId))
    ).toEqual(new Set(['stroke:0', 'stroke:1']))
  })

  it('should run: orthogonal non-convex single-polygon candidates emit deterministic exact ownership regions against convex packets', () => {
    const diagnostics = buildConstrainedSolidOwnershipDiagnostics([
      createSyntheticPacket('nonconvex:0', 'stroke:0', [
        { x: 0, y: 0 },
        { x: 8, y: 0 },
        { x: 8, y: 2 },
        { x: 2, y: 2 },
        { x: 2, y: 8 },
        { x: 0, y: 8 }
      ]),
      createSyntheticPacket('nonconvex:1', 'stroke:1', [
        { x: 1, y: 1 },
        { x: 5, y: 1 },
        { x: 5, y: 5 },
        { x: 1, y: 5 }
      ])
    ])

    expect(diagnostics.edges).toEqual([['candidate:0', 'candidate:1']])
    expect(
      diagnostics.ownedRegions.map((region) => region.candidateIds)
    ).toEqual([
      ['candidate:0', 'candidate:1'],
      ['candidate:0', 'candidate:1']
    ])
    expect(diagnostics.ownedRegions.map((region) => region.bounds)).toEqual([
      { minX: 1, minY: 1, maxX: 5, maxY: 2 },
      { minX: 1, minY: 2, maxX: 2, maxY: 5 }
    ])
    expect(
      new Set(diagnostics.ownedRegions.map((region) => region.ownerStrokeId))
    ).toEqual(new Set(['stroke:0']))
  })

  it('should run: mixed-topology candidates containing orthogonal non-convex pieces keep deterministic exact ownership regions across all packet pieces', () => {
    const diagnostics = buildConstrainedSolidOwnershipDiagnostics([
      {
        geometry: {
          geometryId: 'mixed-nonconvex:0',
          polygons: [
            [
              { x: 0, y: 0 },
              { x: 8, y: 0 },
              { x: 8, y: 2 },
              { x: 2, y: 2 },
              { x: 2, y: 8 },
              { x: 0, y: 8 }
            ],
            [
              { x: 10, y: 0 },
              { x: 14, y: 0 },
              { x: 14, y: 4 },
              { x: 10, y: 4 }
            ]
          ],
          bounds: {
            minX: 0,
            minY: 0,
            maxX: 14,
            maxY: 8
          },
          debugMeta: {
            strokeId: 'stroke:0'
          }
        },
        paint: {
          geometryId: 'mixed-nonconvex:0',
          color: 0xff0000,
          alpha: 1
        }
      },
      {
        geometry: {
          geometryId: 'mixed-nonconvex:1',
          polygons: [
            [
              { x: 1, y: 1 },
              { x: 5, y: 1 },
              { x: 5, y: 5 },
              { x: 1, y: 5 }
            ],
            [
              { x: 12, y: 1 },
              { x: 16, y: 1 },
              { x: 16, y: 3 },
              { x: 12, y: 3 }
            ]
          ],
          bounds: {
            minX: 1,
            minY: 1,
            maxX: 16,
            maxY: 5
          },
          debugMeta: {
            strokeId: 'stroke:1'
          }
        },
        paint: {
          geometryId: 'mixed-nonconvex:1',
          color: 0x0000ff,
          alpha: 1
        }
      }
    ])

    expect(diagnostics.edges).toEqual([['candidate:0', 'candidate:1']])
    expect(
      diagnostics.ownedRegions.map((region) => region.candidateIds)
    ).toEqual([
      ['candidate:0', 'candidate:1'],
      ['candidate:0', 'candidate:1'],
      ['candidate:0', 'candidate:1']
    ])
    expect(diagnostics.ownedRegions.map((region) => region.bounds)).toEqual([
      { minX: 1, minY: 1, maxX: 5, maxY: 2 },
      { minX: 1, minY: 2, maxX: 2, maxY: 5 },
      { minX: 12, minY: 1, maxX: 14, maxY: 3 }
    ])
    expect(
      new Set(diagnostics.ownedRegions.map((region) => region.ownerStrokeId))
    ).toEqual(new Set(['stroke:0']))
  })

  it('should run: multi-polygon candidates composed entirely of orthogonal non-convex pieces keep deterministic exact ownership regions across all pieces', () => {
    const diagnostics = buildConstrainedSolidOwnershipDiagnostics([
      {
        geometry: {
          geometryId: 'orthogonal-nonconvex-multi:0',
          polygons: [
            [
              { x: 0, y: 0 },
              { x: 8, y: 0 },
              { x: 8, y: 2 },
              { x: 2, y: 2 },
              { x: 2, y: 8 },
              { x: 0, y: 8 }
            ],
            [
              { x: 10, y: 0 },
              { x: 18, y: 0 },
              { x: 18, y: 2 },
              { x: 12, y: 2 },
              { x: 12, y: 8 },
              { x: 10, y: 8 }
            ]
          ],
          bounds: {
            minX: 0,
            minY: 0,
            maxX: 18,
            maxY: 8
          },
          debugMeta: {
            strokeId: 'stroke:0'
          }
        },
        paint: {
          geometryId: 'orthogonal-nonconvex-multi:0',
          color: 0xff0000,
          alpha: 1
        }
      },
      {
        geometry: {
          geometryId: 'orthogonal-nonconvex-multi:1',
          polygons: [
            [
              { x: 1, y: 1 },
              { x: 5, y: 1 },
              { x: 5, y: 5 },
              { x: 1, y: 5 }
            ],
            [
              { x: 11, y: 1 },
              { x: 15, y: 1 },
              { x: 15, y: 5 },
              { x: 11, y: 5 }
            ]
          ],
          bounds: {
            minX: 1,
            minY: 1,
            maxX: 15,
            maxY: 5
          },
          debugMeta: {
            strokeId: 'stroke:1'
          }
        },
        paint: {
          geometryId: 'orthogonal-nonconvex-multi:1',
          color: 0x0000ff,
          alpha: 1
        }
      }
    ])

    expect(diagnostics.edges).toEqual([['candidate:0', 'candidate:1']])
    expect(
      diagnostics.ownedRegions.map((region) => region.candidateIds)
    ).toEqual([
      ['candidate:0', 'candidate:1'],
      ['candidate:0', 'candidate:1'],
      ['candidate:0', 'candidate:1'],
      ['candidate:0', 'candidate:1']
    ])
    expect(diagnostics.ownedRegions.map((region) => region.bounds)).toEqual([
      { minX: 1, minY: 1, maxX: 5, maxY: 2 },
      { minX: 1, minY: 2, maxX: 2, maxY: 5 },
      { minX: 11, minY: 1, maxX: 15, maxY: 2 },
      { minX: 11, minY: 2, maxX: 12, maxY: 5 }
    ])
    expect(
      new Set(diagnostics.ownedRegions.map((region) => region.ownerStrokeId))
    ).toEqual(new Set(['stroke:0']))
  })

  it('should run: non-orthogonal non-convex single-polygon candidates emit deterministic exact ownership regions after bounded ear decomposition', () => {
    const polygon = [
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 6, y: 4 },
      { x: 3, y: 2 },
      { x: 0, y: 4 }
    ]

    const diagnostics = buildConstrainedSolidOwnershipDiagnostics([
      createSyntheticPacket('ear:0', 'stroke:0', polygon),
      createSyntheticPacket('ear:1', 'stroke:1', polygon)
    ])

    expect(diagnostics.edges).toEqual([['candidate:0', 'candidate:1']])
    expect(diagnostics.ownedRegions).toHaveLength(3)
    expect(
      diagnostics.ownedRegions.map((region) => region.candidateIds)
    ).toEqual([
      ['candidate:0', 'candidate:1'],
      ['candidate:0', 'candidate:1'],
      ['candidate:0', 'candidate:1']
    ])
    expect(
      new Set(diagnostics.ownedRegions.map((region) => region.ownerStrokeId))
    ).toEqual(new Set(['stroke:0']))
  })

  it('should run: mixed-topology candidates containing non-orthogonal non-convex pieces keep deterministic exact ownership regions across all packet pieces', () => {
    const nonOrthogonalPiece = [
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 6, y: 4 },
      { x: 3, y: 2 },
      { x: 0, y: 4 }
    ]
    const convexPiece = [
      { x: 10, y: 0 },
      { x: 14, y: 0 },
      { x: 14, y: 4 },
      { x: 10, y: 4 }
    ]

    const diagnostics = buildConstrainedSolidOwnershipDiagnostics([
      {
        geometry: {
          geometryId: 'mixed-ear:0',
          polygons: [nonOrthogonalPiece, convexPiece],
          bounds: {
            minX: 0,
            minY: 0,
            maxX: 14,
            maxY: 4
          },
          debugMeta: {
            strokeId: 'stroke:0'
          }
        },
        paint: {
          geometryId: 'mixed-ear:0',
          color: 0xff0000,
          alpha: 1
        }
      },
      {
        geometry: {
          geometryId: 'mixed-ear:1',
          polygons: [nonOrthogonalPiece, convexPiece],
          bounds: {
            minX: 0,
            minY: 0,
            maxX: 14,
            maxY: 4
          },
          debugMeta: {
            strokeId: 'stroke:1'
          }
        },
        paint: {
          geometryId: 'mixed-ear:1',
          color: 0x0000ff,
          alpha: 1
        }
      }
    ])

    expect(diagnostics.edges).toEqual([['candidate:0', 'candidate:1']])
    expect(diagnostics.ownedRegions).toHaveLength(4)
    expect(
      diagnostics.ownedRegions.map((region) => region.candidateIds)
    ).toEqual([
      ['candidate:0', 'candidate:1'],
      ['candidate:0', 'candidate:1'],
      ['candidate:0', 'candidate:1'],
      ['candidate:0', 'candidate:1']
    ])
    expect(
      new Set(diagnostics.ownedRegions.map((region) => region.ownerStrokeId))
    ).toEqual(new Set(['stroke:0']))
  })

  it('should run: mixed-topology candidates containing multiple non-orthogonal non-convex pieces keep deterministic exact ownership regions across all packet pieces', () => {
    const firstNonOrthogonalPiece = [
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 6, y: 4 },
      { x: 3, y: 2 },
      { x: 0, y: 4 }
    ]
    const secondNonOrthogonalPiece = [
      { x: 10, y: 0 },
      { x: 16, y: 0 },
      { x: 16, y: 4 },
      { x: 13, y: 2 },
      { x: 10, y: 4 }
    ]
    const convexPiece = [
      { x: 20, y: 0 },
      { x: 24, y: 0 },
      { x: 24, y: 4 },
      { x: 20, y: 4 }
    ]

    const diagnostics = buildConstrainedSolidOwnershipDiagnostics([
      {
        geometry: {
          geometryId: 'mixed-multi-ear:0',
          polygons: [
            firstNonOrthogonalPiece,
            secondNonOrthogonalPiece,
            convexPiece
          ],
          bounds: {
            minX: 0,
            minY: 0,
            maxX: 24,
            maxY: 4
          },
          debugMeta: {
            strokeId: 'stroke:0'
          }
        },
        paint: {
          geometryId: 'mixed-multi-ear:0',
          color: 0xff0000,
          alpha: 1
        }
      },
      {
        geometry: {
          geometryId: 'mixed-multi-ear:1',
          polygons: [
            firstNonOrthogonalPiece,
            secondNonOrthogonalPiece,
            convexPiece
          ],
          bounds: {
            minX: 0,
            minY: 0,
            maxX: 24,
            maxY: 4
          },
          debugMeta: {
            strokeId: 'stroke:1'
          }
        },
        paint: {
          geometryId: 'mixed-multi-ear:1',
          color: 0x0000ff,
          alpha: 1
        }
      }
    ])

    expect(diagnostics.edges).toEqual([['candidate:0', 'candidate:1']])
    expect(diagnostics.ownedRegions).toHaveLength(7)
    expect(
      diagnostics.ownedRegions.map((region) => region.candidateIds)
    ).toEqual([
      ['candidate:0', 'candidate:1'],
      ['candidate:0', 'candidate:1'],
      ['candidate:0', 'candidate:1'],
      ['candidate:0', 'candidate:1'],
      ['candidate:0', 'candidate:1'],
      ['candidate:0', 'candidate:1'],
      ['candidate:0', 'candidate:1']
    ])
    expect(
      new Set(diagnostics.ownedRegions.map((region) => region.ownerStrokeId))
    ).toEqual(new Set(['stroke:0']))
  })
})
