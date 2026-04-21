import { describe, expect, it } from 'vitest'
import {
  createDefaultStroke,
  StrokeJoinTypes,
  StrokePositions,
  StrokeStyles
} from '@asyra/utils'
import { buildConstrainedSolidLegalityClippingResult } from '../components/stroke-render/constrained-solid-legality-clipping'
import { buildConstrainedSolidStrokeResolvedPackets } from '../components/stroke-render/constrained-solid-stroke-packets'
import type { SolidCenterStrokeResolvedPacket } from '../components/stroke-render/solid-center-stroke-packets'

const getPolygonBounds = (polygon: { x: number; y: number }[]) => ({
  minX: Math.min(...polygon.map((point) => point.x)),
  minY: Math.min(...polygon.map((point) => point.y)),
  maxX: Math.max(...polygon.map((point) => point.x)),
  maxY: Math.max(...polygon.map((point) => point.y))
})

const createSyntheticPacket = (
  geometryId: string,
  strokeId: string,
  polygon: Array<{ x: number; y: number }>
): SolidCenterStrokeResolvedPacket => ({
  geometry: {
    geometryId,
    polygons: [polygon],
    bounds: getPolygonBounds(polygon),
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

describe('constrained solid legality clipping', () => {
  it('should run: preserve supported inside packets byte-for-byte when no overflow is eligible for clipping', () => {
    const strokes = [
      createDefaultStroke({
        style: StrokeStyles.SOLID,
        position: StrokePositions.INSIDE,
        width: 6
      })
    ]
    const packets = buildConstrainedSolidStrokeResolvedPackets(
      'rect:inside',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      strokes
    )

    const result = buildConstrainedSolidLegalityClippingResult(
      [
        {
          points: [
            { x: 0, y: 0 },
            { x: 80, y: 0 },
            { x: 80, y: 40 },
            { x: 0, y: 40 }
          ],
          closed: true
        }
      ],
      strokes,
      packets
    )

    expect(result.eligibleOverflowGeometryIds).toEqual([])
    expect(result.preservedGeometryIds).toEqual(
      packets.map((packet) => packet.geometry.geometryId)
    )
    expect(result.packets[0]).toBe(packets[0])
    expect(result.packets[0]?.geometry.polygons).toBe(packets[0]?.geometry.polygons)
  })

  it('should run: drop exact foreign-owned outside polygons while ownership-aware legality diagnostics remain available', () => {
    const strokes = [
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
    const packets = buildConstrainedSolidStrokeResolvedPackets(
      'rect:outside',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      strokes
    )

    const result = buildConstrainedSolidLegalityClippingResult(
      [
        {
          points: [
            { x: 0, y: 0 },
            { x: 80, y: 0 },
            { x: 80, y: 40 },
            { x: 0, y: 40 }
          ],
          closed: true
        }
      ],
      strokes,
      packets
    )

    expect(result.eligibleOverflowGeometryIds).toEqual([])
    expect(result.ownershipDiagnostics.ownedRegions.length).toBeGreaterThan(0)
    expect(result.legalityDiagnostics.domains).toHaveLength(2)
    expect(result.packets[0]).toBe(packets[0])
    expect(result.packets[1]).not.toBe(packets[1])
    expect(result.packets[1]?.geometry.geometryId).toBe('rect:outside:1')
    expect(result.packets[1]?.geometry.polygons).toEqual([])
  })

  it('should run: preserve mixed-topology local remainders when a bevel owner clips a miter non-owner across disconnected sub-packets', () => {
    const strokes = [
      createDefaultStroke({
        style: StrokeStyles.SOLID,
        position: StrokePositions.OUTSIDE,
        width: 12,
        color: '#ff0000',
        joinType: StrokeJoinTypes.BEVEL
      }),
      createDefaultStroke({
        style: StrokeStyles.SOLID,
        position: StrokePositions.OUTSIDE,
        width: 12,
        color: '#0000ff',
        joinType: StrokeJoinTypes.MITER
      })
    ]
    const groups = [
      {
        points: [
          { x: 0, y: 0 },
          { x: 80, y: 0 },
          { x: 80, y: 40 },
          { x: 0, y: 40 }
        ],
        closed: true
      },
      {
        points: [
          { x: 120, y: 0 },
          { x: 200, y: 0 },
          { x: 200, y: 40 },
          { x: 120, y: 40 }
        ],
        closed: true
      }
    ] as const

    const packets = groups.flatMap((group, groupIndex) =>
      buildConstrainedSolidStrokeResolvedPackets(
        `mixed-remainder:${groupIndex}`,
        [...group.points],
        group.closed,
        strokes
      )
    )

    const result = buildConstrainedSolidLegalityClippingResult(groups, strokes, packets)
    const strokeOnePackets = result.packets.filter(
      (packet) => packet.geometry.debugMeta?.strokeId === 'stroke:1'
    )

    expect(result.ownershipDiagnostics.ownedRegions).toHaveLength(8)
    expect(strokeOnePackets).toHaveLength(2)
    expect(strokeOnePackets.map((packet) => packet.geometry.polygons.length)).toEqual([
      8,
      8
    ])
    expect(strokeOnePackets.map((packet) => packet.geometry.bounds)).toEqual([
      { minX: -12, minY: -12, maxX: 92, maxY: 52 },
      { minX: 108, minY: -12, maxX: 212, maxY: 52 }
    ])
  })

  it('should run: drop outside polygons when foreign-owned exact regions cover the whole non-owner packet', () => {
    const strokes = [
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
    const packets = buildConstrainedSolidStrokeResolvedPackets(
      'rect:outside:nested',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      strokes
    )

    const result = buildConstrainedSolidLegalityClippingResult(
      [
        {
          points: [
            { x: 0, y: 0 },
            { x: 80, y: 0 },
            { x: 80, y: 40 },
            { x: 0, y: 40 }
          ],
          closed: true
        }
      ],
      strokes,
      packets
    )

    expect(result.eligibleOverflowGeometryIds).toEqual([])
    expect(result.ownershipDiagnostics.ownedRegions).toHaveLength(8)
    expect(result.packets[0]).toBe(packets[0])
    expect(result.packets[1]?.geometry.geometryId).toBe('rect:outside:nested:1')
    expect(result.packets[1]?.geometry.polygons).toEqual([])
    expect(result.packets[2]?.geometry.geometryId).toBe('rect:outside:nested:2')
    expect(result.packets[2]?.geometry.polygons).toEqual([])
  })

  it('should run: drop non-orthogonal non-convex outside packets when foreign-owned exact regions cover the whole non-owner packet on the bounded ear-decomposition path', () => {
    const polygon = [
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 6, y: 4 },
      { x: 3, y: 2 },
      { x: 0, y: 4 }
    ]

    const result = buildConstrainedSolidLegalityClippingResult(
      [
        {
          points: [
            { x: 2.5, y: 1.5 },
            { x: 3.5, y: 1.5 },
            { x: 3.5, y: 2.5 },
            { x: 2.5, y: 2.5 }
          ],
          closed: true
        }
      ],
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
        })
      ],
      [
        createSyntheticPacket('ear-drop:0', 'stroke:0', polygon),
        createSyntheticPacket('ear-drop:1', 'stroke:1', polygon)
      ]
    )

    expect(result.ownershipDiagnostics.ownedRegions).toHaveLength(4)
    expect(
      result.ownershipDiagnostics.ownedRegions.map((region) => region.candidateIds)
    ).toEqual([
      ['candidate:0', 'candidate:1'],
      ['candidate:0', 'candidate:1'],
      ['candidate:0', 'candidate:1'],
      ['candidate:0', 'candidate:1']
    ])
    expect(result.packets[0]?.geometry.polygons.length).toBeGreaterThan(0)
    expect(result.packets[1]?.geometry.polygons).toEqual([])
  })

  it('should run: drop mixed-topology outside packets that include non-orthogonal non-convex pieces when foreign-owned exact regions cover the whole non-owner packet on the bounded ear-decomposition path', () => {
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

    const result = buildConstrainedSolidLegalityClippingResult(
      [
        {
          points: [
            { x: 2.5, y: 1.5 },
            { x: 3.5, y: 1.5 },
            { x: 3.5, y: 2.5 },
            { x: 2.5, y: 2.5 }
          ],
          closed: true
        }
      ],
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
        })
      ],
      [
        {
          geometry: {
            geometryId: 'mixed-ear-drop:0',
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
            geometryId: 'mixed-ear-drop:0',
            color: 0xff0000,
            alpha: 1
          }
        },
        {
          geometry: {
            geometryId: 'mixed-ear-drop:1',
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
            geometryId: 'mixed-ear-drop:1',
            color: 0x0000ff,
            alpha: 1
          }
        }
      ]
    )

    expect(result.ownershipDiagnostics.ownedRegions.length).toBeGreaterThanOrEqual(5)
    expect(
      result.ownershipDiagnostics.ownedRegions.map((region) => region.candidateIds)
    ).toEqual(
      result.ownershipDiagnostics.ownedRegions.map(() => [
        'candidate:0',
        'candidate:1'
      ])
    )
    expect(result.packets[0]?.geometry.polygons.length).toBeGreaterThan(0)
    expect(result.packets[1]?.geometry.polygons).toEqual([])
  })

  it('should run: subtract foreign-owned regions across mixed-topology packets when the non-owner packet includes a non-orthogonal non-convex piece', () => {
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

    const result = buildConstrainedSolidLegalityClippingResult(
      [
        {
          points: [
            { x: 2.5, y: 1.5 },
            { x: 3.5, y: 1.5 },
            { x: 3.5, y: 2.5 },
            { x: 2.5, y: 2.5 }
          ],
          closed: true
        }
      ],
      [
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
          color: '#ff0000'
        })
      ],
      [
        {
          geometry: {
            geometryId: 'mixed-ear-partial:0',
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
            geometryId: 'mixed-ear-partial:0',
            color: 0x0000ff,
            alpha: 1
          }
        },
        {
          geometry: {
            geometryId: 'mixed-ear-partial:1',
            polygons: [
              [
                { x: 0, y: 0 },
                { x: 4, y: 0 },
                { x: 4, y: 3 },
                { x: 2, y: 2 },
                { x: 0, y: 3 }
              ],
              [
                { x: 11, y: 0 },
                { x: 13, y: 0 },
                { x: 13, y: 4 },
                { x: 11, y: 4 }
              ]
            ],
            bounds: {
              minX: 0,
              minY: 0,
              maxX: 13,
              maxY: 4
            },
            debugMeta: {
              strokeId: 'stroke:0'
            }
          },
          paint: {
            geometryId: 'mixed-ear-partial:1',
            color: 0xff0000,
            alpha: 1
          }
        }
      ]
    )

    expect(result.ownershipDiagnostics.ownedRegions.length).toBeGreaterThanOrEqual(4)
    expect(
      result.ownershipDiagnostics.ownedRegions.map((region) => region.candidateIds)
    ).toEqual(
      result.ownershipDiagnostics.ownedRegions.map(() => [
        'candidate:0',
        'candidate:1'
      ])
    )
    expect(result.packets[0]?.geometry.polygons.length).toBeGreaterThan(0)
    expect(result.packets[1]?.geometry.polygons.length).toBeGreaterThan(0)
    expect(result.packets[0]?.geometry.polygons.length).toBeGreaterThan(2)
  })

  it('should run: subtract foreign-owned regions across mixed-topology packets when the non-owner packet includes multiple non-orthogonal non-convex pieces', () => {
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

    const result = buildConstrainedSolidLegalityClippingResult(
      [
        {
          points: [
            { x: 2.5, y: 1.5 },
            { x: 3.5, y: 1.5 },
            { x: 3.5, y: 2.5 },
            { x: 2.5, y: 2.5 }
          ],
          closed: true
        }
      ],
      [
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
          color: '#ff0000'
        })
      ],
      [
        {
          geometry: {
            geometryId: 'mixed-multi-ear-partial:0',
            polygons: [firstNonOrthogonalPiece, secondNonOrthogonalPiece, convexPiece],
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
            geometryId: 'mixed-multi-ear-partial:0',
            color: 0x0000ff,
            alpha: 1
          }
        },
        {
          geometry: {
            geometryId: 'mixed-multi-ear-partial:1',
            polygons: [
              [
                { x: 0, y: 0 },
                { x: 4, y: 0 },
                { x: 4, y: 3 },
                { x: 2, y: 2 },
                { x: 0, y: 3 }
              ],
              [
                { x: 11, y: 0 },
                { x: 15, y: 0 },
                { x: 15, y: 3 },
                { x: 13, y: 2 },
                { x: 11, y: 3 }
              ],
              [
                { x: 21, y: 0 },
                { x: 23, y: 0 },
                { x: 23, y: 4 },
                { x: 21, y: 4 }
              ]
            ],
            bounds: {
              minX: 0,
              minY: 0,
              maxX: 23,
              maxY: 4
            },
            debugMeta: {
              strokeId: 'stroke:0'
            }
          },
          paint: {
            geometryId: 'mixed-multi-ear-partial:1',
            color: 0xff0000,
            alpha: 1
          }
        }
      ]
    )

    expect(result.ownershipDiagnostics.ownedRegions).toHaveLength(20)
    expect(
      result.ownershipDiagnostics.ownedRegions.map((region) => region.candidateIds)
    ).toEqual(
      result.ownershipDiagnostics.ownedRegions.map(() => [
        'candidate:0',
        'candidate:1'
      ])
    )
    expect(result.packets[0]?.geometry.polygons.length).toBeGreaterThan(10)
    expect(result.packets[1]?.geometry.polygons.length).toBe(3)
  })

  it('should run: subtract partial foreign-owned outside regions from non-owner packets while preserving owner-domain remainder', () => {
    const strokes = [
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

    const result = buildConstrainedSolidLegalityClippingResult(
      [
        {
          points: [
            { x: 0, y: 0 },
            { x: 18, y: 0 },
            { x: 18, y: 6 },
            { x: 0, y: 6 }
          ],
          closed: true
        }
      ],
      strokes,
      [
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
      ]
    )

    expect(result.eligibleOverflowGeometryIds).toEqual([])
    expect(result.ownershipDiagnostics.ownedRegions.map((region) => region.candidateIds)).toEqual([
      ['candidate:0', 'candidate:1'],
      ['candidate:1', 'candidate:2']
    ])
    expect(result.packets[0]).toBeDefined()
    expect(result.packets[0]?.geometry.polygons).toEqual([
      [
        { x: 0, y: 0 },
        { x: 7, y: 0 },
        { x: 7, y: 6 },
        { x: 0, y: 6 }
      ]
    ])
    expect(result.packets[1]?.geometry.polygons).toEqual([
      [
        { x: 7, y: 0 },
        { x: 13, y: 0 },
        { x: 13, y: 6 },
        { x: 7, y: 6 }
      ]
    ])
    expect(result.packets[2]?.geometry.polygons).toEqual([
      [
        { x: 13, y: 0 },
        { x: 18, y: 0 },
        { x: 18, y: 6 },
        { x: 13, y: 6 }
      ]
    ])
  })

  it('should run: subtract foreign-owned regions across a four-candidate partial-overlap chain while keeping local owner-domain remainders', () => {
    const strokes = [
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
        width: 6,
        color: '#00ff00'
      }),
      createDefaultStroke({
        style: StrokeStyles.SOLID,
        position: StrokePositions.OUTSIDE,
        width: 4,
        color: '#ff00ff'
      })
    ]

    const result = buildConstrainedSolidLegalityClippingResult(
      [
        {
          points: [
            { x: 0, y: 0 },
            { x: 24, y: 0 },
            { x: 24, y: 6 },
            { x: 0, y: 6 }
          ],
          closed: true
        }
      ],
      strokes,
      [
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
      ]
    )

    expect(result.ownershipDiagnostics.ownedRegions.map((region) => region.candidateIds)).toEqual([
      ['candidate:0', 'candidate:1'],
      ['candidate:1', 'candidate:2'],
      ['candidate:2', 'candidate:3']
    ])
    expect(result.packets[0]?.geometry.polygons).toEqual([
      [
        { x: 0, y: 0 },
        { x: 7, y: 0 },
        { x: 7, y: 6 },
        { x: 0, y: 6 }
      ]
    ])
    expect(result.packets[1]?.geometry.polygons).toEqual([
      [
        { x: 7, y: 0 },
        { x: 13, y: 0 },
        { x: 13, y: 6 },
        { x: 7, y: 6 }
      ]
    ])
    expect(result.packets[2]?.geometry.polygons).toEqual([
      [
        { x: 13, y: 0 },
        { x: 18, y: 0 },
        { x: 18, y: 6 },
        { x: 13, y: 6 }
      ]
    ])
    expect(result.packets[3]?.geometry.polygons).toEqual([
      [
        { x: 18, y: 0 },
        { x: 24, y: 0 },
        { x: 24, y: 6 },
        { x: 18, y: 6 }
      ]
    ])
  })

  it('should run: subtract foreign-owned regions across a four-candidate branch component while preserving branch-local owner-domain remainders', () => {
    const strokes = [
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
        width: 6,
        color: '#00ff00'
      }),
      createDefaultStroke({
        style: StrokeStyles.SOLID,
        position: StrokePositions.OUTSIDE,
        width: 4,
        color: '#ff00ff'
      })
    ]

    const result = buildConstrainedSolidLegalityClippingResult(
      [
        {
          points: [
            { x: 7, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 2 },
            { x: 7, y: 2 }
          ],
          closed: true
        }
      ],
      strokes,
      [
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
      ]
    )

    expect(result.ownershipDiagnostics.ownedRegions.map((region) => region.candidateIds)).toEqual([
      ['candidate:0', 'candidate:1', 'candidate:3'],
      ['candidate:0', 'candidate:1'],
      ['candidate:1', 'candidate:2', 'candidate:3'],
      ['candidate:1', 'candidate:2'],
      ['candidate:1', 'candidate:3']
    ])
    expect(result.packets[0]?.geometry.polygons).toEqual([
      [
        { x: 0, y: 0 },
        { x: 7, y: 0 },
        { x: 7, y: 6 },
        { x: 0, y: 6 }
      ]
    ])
    expect(result.packets[1]?.geometry.polygons).toEqual([
      [
        { x: 7, y: 0 },
        { x: 13, y: 0 },
        { x: 13, y: 6 },
        { x: 7, y: 6 }
      ]
    ])
    expect(result.packets[2]?.geometry.polygons).toEqual([
      [
        { x: 13, y: 0 },
        { x: 18, y: 0 },
        { x: 18, y: 6 },
        { x: 13, y: 6 }
      ]
    ])
    expect(result.packets[3]?.geometry.polygons).toHaveLength(1)
    expect(getPolygonBounds(result.packets[3]?.geometry.polygons[0] ?? [])).toEqual({
      minX: 4,
      minY: -6,
      maxX: 13,
      maxY: 0
    })
  })

  it('should run: subtract foreign-owned regions for mixed-topology multi-polygon candidates while preserving disconnected owner-domain remainders', () => {
    const strokes = [
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
        width: 6,
        color: '#00ff00'
      })
    ]

    const result = buildConstrainedSolidLegalityClippingResult(
      [
        {
          points: [
            { x: 8, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 6 },
            { x: 8, y: 6 }
          ],
          closed: true
        }
      ],
      strokes,
      [
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
      ]
    )

    expect(result.ownershipDiagnostics.ownedRegions.map((region) => region.candidateIds)).toEqual([
      ['candidate:0', 'candidate:1'],
      ['candidate:1', 'candidate:2']
    ])
    expect(result.packets[0]?.geometry.polygons).toEqual([
      [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 6 },
        { x: 0, y: 6 }
      ]
    ])
    expect(result.packets[1]?.geometry.polygons).toEqual([
      [
        { x: 5, y: 0 },
        { x: 8, y: 0 },
        { x: 8, y: 6 },
        { x: 5, y: 6 }
      ],
      [
        { x: 10, y: 0 },
        { x: 15, y: 0 },
        { x: 15, y: 6 },
        { x: 10, y: 6 }
      ]
    ])
    expect(result.packets[2]?.geometry.polygons).toEqual([
      [
        { x: 15, y: 0 },
        { x: 18, y: 0 },
        { x: 18, y: 6 },
        { x: 15, y: 6 }
      ]
    ])
  })

  it('should run: subtract foreign-owned regions for orthogonal non-convex owner packets while preserving convex packet remainders', () => {
    const strokes = [
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
      })
    ]

    const result = buildConstrainedSolidLegalityClippingResult(
      [
        {
          points: [
            { x: 2, y: 2 },
            { x: 5, y: 2 },
            { x: 5, y: 5 },
            { x: 2, y: 5 }
          ],
          closed: true
        }
      ],
      strokes,
      [
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
      ]
    )

    expect(result.ownershipDiagnostics.ownedRegions.map((region) => region.candidateIds)).toEqual([
      ['candidate:0', 'candidate:1'],
      ['candidate:0', 'candidate:1']
    ])
    expect(result.packets[0]?.geometry.polygons).toEqual([
      [
        { x: 0, y: 0 },
        { x: 8, y: 0 },
        { x: 8, y: 2 },
        { x: 2, y: 2 },
        { x: 2, y: 8 },
        { x: 0, y: 8 }
      ]
    ])
    expect(result.packets[1]?.geometry.polygons).toEqual([
      [
        { x: 2, y: 2 },
        { x: 5, y: 2 },
        { x: 5, y: 5 },
        { x: 2, y: 5 }
      ]
    ])
  })

  it('should run: subtract foreign-owned regions from orthogonal non-convex packets while preserving disconnected local remainders', () => {
    const strokes = [
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
      })
    ]

    const result = buildConstrainedSolidLegalityClippingResult(
      [
        {
          points: [
            { x: 0, y: 0 },
            { x: 2, y: 0 },
            { x: 2, y: 6 },
            { x: 0, y: 6 }
          ],
          closed: true
        }
      ],
      strokes,
      [
        createSyntheticPacket('orthogonal-owner:0', 'stroke:0', [
          { x: 0, y: 0 },
          { x: 2, y: 0 },
          { x: 2, y: 6 },
          { x: 0, y: 6 }
        ]),
        createSyntheticPacket('orthogonal-owner:1', 'stroke:1', [
          { x: 0, y: 0 },
          { x: 8, y: 0 },
          { x: 8, y: 2 },
          { x: 2, y: 2 },
          { x: 2, y: 8 },
          { x: 0, y: 8 }
        ])
      ]
    )

    expect(result.ownershipDiagnostics.ownedRegions.map((region) => region.candidateIds)).toEqual([
      ['candidate:0', 'candidate:1'],
      ['candidate:0', 'candidate:1']
    ])
    expect(result.ownershipDiagnostics.ownedRegions.map((region) => region.bounds)).toEqual([
      { minX: 0, minY: 0, maxX: 2, maxY: 2 },
      { minX: 0, minY: 2, maxX: 2, maxY: 6 }
    ])
    expect(result.packets[0]?.geometry.polygons).toEqual([
      [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 6 },
        { x: 0, y: 6 }
      ]
    ])
    expect(result.packets[1]?.geometry.polygons).toEqual([
      [
        { x: 2, y: 0 },
        { x: 8, y: 0 },
        { x: 8, y: 2 },
        { x: 2, y: 2 }
      ],
      [
        { x: 0, y: 6 },
        { x: 2, y: 6 },
        { x: 2, y: 8 },
        { x: 0, y: 8 }
      ]
    ])
  })

  it('should run: subtract foreign-owned regions across mixed-topology packets when the non-owner packet includes an orthogonal non-convex piece', () => {
    const strokes = [
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
      })
    ]

    const result = buildConstrainedSolidLegalityClippingResult(
      [
        {
          points: [
            { x: 0, y: 0 },
            { x: 2, y: 0 },
            { x: 2, y: 6 },
            { x: 0, y: 6 }
          ],
          closed: true
        }
      ],
      strokes,
      [
        {
          geometry: {
            geometryId: 'mixed-owner:0',
            polygons: [
              [
                { x: 0, y: 0 },
                { x: 2, y: 0 },
                { x: 2, y: 6 },
                { x: 0, y: 6 }
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
              maxY: 6
            },
            debugMeta: {
              strokeId: 'stroke:0'
            }
          },
          paint: {
            geometryId: 'mixed-owner:0',
            color: 0xff0000,
            alpha: 1
          }
        },
        {
          geometry: {
            geometryId: 'mixed-owner:1',
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
                { x: 12, y: 1 },
                { x: 16, y: 1 },
                { x: 16, y: 3 },
                { x: 12, y: 3 }
              ]
            ],
            bounds: {
              minX: 0,
              minY: 0,
              maxX: 16,
              maxY: 8
            },
            debugMeta: {
              strokeId: 'stroke:1'
            }
          },
          paint: {
            geometryId: 'mixed-owner:1',
            color: 0x0000ff,
            alpha: 1
          }
        }
      ]
    )

    expect(result.ownershipDiagnostics.ownedRegions.map((region) => region.candidateIds)).toEqual([
      ['candidate:0', 'candidate:1'],
      ['candidate:0', 'candidate:1'],
      ['candidate:0', 'candidate:1']
    ])
    expect(result.ownershipDiagnostics.ownedRegions.map((region) => region.bounds)).toEqual([
      { minX: 0, minY: 0, maxX: 2, maxY: 2 },
      { minX: 0, minY: 2, maxX: 2, maxY: 6 },
      { minX: 12, minY: 1, maxX: 14, maxY: 3 }
    ])
    expect(result.packets[0]?.geometry.polygons).toEqual([
      [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 6 },
        { x: 0, y: 6 }
      ],
      [
        { x: 10, y: 0 },
        { x: 14, y: 0 },
        { x: 14, y: 4 },
        { x: 10, y: 4 }
      ]
    ])
    expect(result.packets[1]?.geometry.polygons).toEqual([
      [
        { x: 2, y: 0 },
        { x: 8, y: 0 },
        { x: 8, y: 2 },
        { x: 2, y: 2 }
      ],
      [
        { x: 0, y: 6 },
        { x: 2, y: 6 },
        { x: 2, y: 8 },
        { x: 0, y: 8 }
      ],
      [
        { x: 14, y: 1 },
        { x: 16, y: 1 },
        { x: 16, y: 3 },
        { x: 14, y: 3 }
      ]
    ])
  })

  it('should run: drop non-owner multi-polygon packets composed entirely of orthogonal non-convex pieces when exact foreign-owned regions cover the whole packet', () => {
    const strokes = [
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
      })
    ]

    const result = buildConstrainedSolidLegalityClippingResult(
      [
        {
          points: [
            { x: 0, y: 0 },
            { x: 2, y: 0 },
            { x: 2, y: 6 },
            { x: 0, y: 6 }
          ],
          closed: true
        },
        {
          points: [
            { x: 10, y: 0 },
            { x: 12, y: 0 },
            { x: 12, y: 6 },
            { x: 10, y: 6 }
          ],
          closed: true
        }
      ],
      strokes,
      [
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
              strokeId: 'stroke:1'
            }
          },
          paint: {
            geometryId: 'orthogonal-nonconvex-multi:1',
            color: 0x0000ff,
            alpha: 1
          }
        }
      ]
    )

    expect(result.ownershipDiagnostics.ownedRegions.map((region) => region.candidateIds)).toEqual([
      ['candidate:0', 'candidate:1'],
      ['candidate:0', 'candidate:1'],
      ['candidate:0', 'candidate:1'],
      ['candidate:0', 'candidate:1']
    ])
    expect(result.packets[0]?.geometry.polygons).toEqual([
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
    ])
    expect(result.packets[1]?.geometry.polygons).toEqual([])
  })


  it('should run: clip true inside overflow against the canonical legality boundary while preserving geometry identity', () => {
    const overflowPacket: SolidCenterStrokeResolvedPacket = {
      geometry: {
        geometryId: 'overflow:0',
        polygons: [
          [
            { x: -4, y: 8 },
            { x: 12, y: 8 },
            { x: 12, y: 20 },
            { x: -4, y: 20 }
          ]
        ],
        bounds: {
          minX: -4,
          minY: 8,
          maxX: 12,
          maxY: 20
        },
        debugMeta: {
          strokeId: 'stroke:0'
        }
      },
      paint: {
        geometryId: 'overflow:0',
        color: 0xff0000,
        alpha: 1
      }
    }

    const result = buildConstrainedSolidLegalityClippingResult(
      [
        {
          points: [
            { x: 0, y: 0 },
            { x: 40, y: 0 },
            { x: 40, y: 30 },
            { x: 0, y: 30 }
          ],
          closed: true
        }
      ],
      [
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.INSIDE,
          width: 6,
          color: '#ff0000'
        })
      ],
      [overflowPacket]
    )

    expect(result.eligibleOverflowGeometryIds).toEqual(['overflow:0'])
    expect(result.packets[0]).not.toBe(overflowPacket)
    expect(result.packets[0]?.geometry.geometryId).toBe('overflow:0')
    expect(result.packets[0]?.geometry.polygons).toEqual([
      [
        { x: 0, y: 8 },
        { x: 12, y: 8 },
        { x: 12, y: 20 },
        { x: 0, y: 20 }
      ]
    ])
  })

  it('should run: clip single-edge outside overflow against the canonical legality boundary while preserving geometry identity', () => {
    const overflowPacket: SolidCenterStrokeResolvedPacket = {
      geometry: {
        geometryId: 'overflow:outside:0',
        polygons: [
          [
            { x: -6, y: 8 },
            { x: 12, y: 8 },
            { x: 12, y: 20 },
            { x: -6, y: 20 }
          ]
        ],
        bounds: {
          minX: -6,
          minY: 8,
          maxX: 12,
          maxY: 20
        },
        debugMeta: {
          strokeId: 'stroke:0'
        }
      },
      paint: {
        geometryId: 'overflow:outside:0',
        color: 0xff0000,
        alpha: 1
      }
    }

    const result = buildConstrainedSolidLegalityClippingResult(
      [
        {
          points: [
            { x: 0, y: 0 },
            { x: 40, y: 0 },
            { x: 40, y: 30 },
            { x: 0, y: 30 }
          ],
          closed: true
        }
      ],
      [
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 6,
          color: '#ff0000'
        })
      ],
      [overflowPacket]
    )

    expect(result.eligibleOverflowGeometryIds).toEqual(['overflow:outside:0'])
    expect(result.packets[0]).not.toBe(overflowPacket)
    expect(result.packets[0]?.geometry.geometryId).toBe('overflow:outside:0')
    expect(result.packets[0]?.geometry.polygons).toEqual([
      [
        { x: -6, y: 8 },
        { x: 0, y: 8 },
        { x: 0, y: 20 },
        { x: -6, y: 20 }
      ]
    ])
  })

  it('should run: partition corner outside overflow into disjoint complement sectors instead of overlapping polygons', () => {
    const overflowPacket: SolidCenterStrokeResolvedPacket = {
      geometry: {
        geometryId: 'overflow:outside:corner',
        polygons: [
          [
            { x: -6, y: -6 },
            { x: 12, y: -6 },
            { x: 12, y: 12 },
            { x: -6, y: 12 }
          ]
        ],
        bounds: {
          minX: -6,
          minY: -6,
          maxX: 12,
          maxY: 12
        },
        debugMeta: {
          strokeId: 'stroke:0'
        }
      },
      paint: {
        geometryId: 'overflow:outside:corner',
        color: 0xff0000,
        alpha: 1
      }
    }

    const result = buildConstrainedSolidLegalityClippingResult(
      [
        {
          points: [
            { x: 0, y: 0 },
            { x: 40, y: 0 },
            { x: 40, y: 30 },
            { x: 0, y: 30 }
          ],
          closed: true
        }
      ],
      [
        createDefaultStroke({
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          width: 6,
          color: '#ff0000'
        })
      ],
      [overflowPacket]
    )

    expect(result.eligibleOverflowGeometryIds).toEqual(['overflow:outside:corner'])
    expect(result.packets[0]?.geometry.polygons).toHaveLength(2)

    const [firstPolygon, secondPolygon] = result.packets[0]?.geometry.polygons ?? []
    const firstBounds = getPolygonBounds(firstPolygon)
    const secondBounds = getPolygonBounds(secondPolygon)

    expect(firstBounds).toEqual({
      minX: -6,
      minY: -6,
      maxX: 12,
      maxY: 0
    })
    expect(secondBounds).toEqual({
      minX: -6,
      minY: 0,
      maxX: 0,
      maxY: 12
    })
  })

})
