import { describe, expect, it } from 'vitest'
import {
  attachStrokePacketDebugMeta,
  buildSolidCenterStrokeExportPackets,
  buildSolidCenterStrokeHitTestPackets,
  createSolidCenterStrokeHitArea
} from '../components/stroke-render/solid-center-stroke-packets'
import { buildConstrainedDashedStrokeResolvedPackets } from '../components/stroke-render/constrained-dashed-stroke-packets'
import {
  classifyConstrainedDashedInterval,
  classifyConstrainedDashedOwnership,
  classifyConstrainedDashedRuntimeStatus,
  classifyConstrainedDashedSource,
  hasConstrainedDashedStrokeIntent
} from '../components/stroke-render/constrained-dashed-stroke-packets'
import { getRenderableStrokes } from '../components/stroke-render/renderable-stroke'
import { buildEllipseLoop } from '../components/stroke-render/ellipse-path'
import {
  FillKinds,
  createDefaultGradientData,
  createDefaultStroke
} from '@asyra/utils'

const getOnlyRenderableStroke = (
  strokes: Parameters<typeof getRenderableStrokes>[0]
) => {
  const [stroke] = getRenderableStrokes(strokes)
  if (!stroke) {
    throw new Error('Expected one renderable stroke')
  }
  return stroke
}

describe('constrained dashed stroke packets', () => {
  it('should detect constrained dashed intent only for positive-width inside/outside dashed strokes', () => {
    expect(
      hasConstrainedDashedStrokeIntent([
        createDefaultStroke({
          width: 4,
          style: 'dashed',
          position: 'inside',
          dashPattern: [20, 20]
        })
      ])
    ).toBe(true)

    expect(
      hasConstrainedDashedStrokeIntent([
        createDefaultStroke({
          width: 4,
          style: 'dashed',
          position: 'center',
          dashPattern: [20, 20]
        })
      ])
    ).toBe(false)

    expect(
      hasConstrainedDashedStrokeIntent([
        createDefaultStroke({
          width: 0,
          style: 'dashed',
          position: 'outside',
          dashPattern: [20, 20]
        })
      ])
    ).toBe(false)

    expect(
      hasConstrainedDashedStrokeIntent([
        createDefaultStroke({
          width: 4,
          style: 'dashed',
          position: 'outside',
          dashPattern: [0, -1]
        })
      ])
    ).toBe(false)

    expect(
      hasConstrainedDashedStrokeIntent([
        createDefaultStroke({
          visible: false,
          width: 4,
          style: 'dashed',
          position: 'inside',
          dashPattern: [20, 20]
        })
      ])
    ).toBe(false)

    const missingDashPatternStroke = createDefaultStroke({
      width: 4,
      style: 'dashed',
      position: 'inside',
      dashPattern: [20, 20]
    })
    delete (missingDashPatternStroke as Partial<typeof missingDashPatternStroke>)
      .dashPattern

    expect(hasConstrainedDashedStrokeIntent([missingDashPatternStroke])).toBe(
      false
    )
  })

  it('should run: ignore legacy dash and gap fields when dashPattern is missing', () => {
    const legacyOnlyStroke = {
      ...createDefaultStroke({
        width: 4,
        style: 'dashed',
        position: 'inside'
      }),
      dash: 20,
      gap: 10
    }
    delete (legacyOnlyStroke as Partial<typeof legacyOnlyStroke>).dashPattern

    expect(hasConstrainedDashedStrokeIntent([legacyOnlyStroke])).toBe(false)
    expect(getRenderableStrokes([legacyOnlyStroke])[0]?.dashPattern).toEqual([])
    expect(
      buildConstrainedDashedStrokeResolvedPackets(
        'legacy-dash-gap:test',
        [
          { x: 0, y: 0 },
          { x: 80, y: 0 },
          { x: 80, y: 40 },
          { x: 0, y: 40 }
        ],
        true,
        [legacyOnlyStroke]
      )
    ).toEqual([])
  })

  it('should run: emit local-side constrained dashed packets for self-intersecting paths without claiming exact arrangement', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:self-intersecting-inside-dashed',
      [
        { x: 192.42083700791653, y: 0 },
        { x: 11.358174406717296, y: 364.1297089212308 },
        { x: 360.120941483566, y: 144.31562775593738 },
        { x: 0, y: 14.030686031827244 },
        { x: 270.59180204238254, y: 345.42212754546125 }
      ],
      true,
      [
        createDefaultStroke({
          width: 10,
          style: 'dashed',
          position: 'inside',
          joinType: 'miter',
          capType: 'butt',
          dashPattern: [27, 20],
          dashOffset: 0
        })
      ]
    )

    expect(packets.length).toBeGreaterThan(0)
    expect(
      packets.every(
        (packet) =>
          packet.geometry.debugMeta?.geometryFamily ===
            'constrained-dashed' &&
          packet.geometry.debugMeta?.resolutionStatus ===
            'local-side-approximation' &&
          packet.geometry.debugMeta?.sourceTopology === 'self-intersecting'
      )
    ).toBe(true)
  })

  it('should classify constrained dashed source topology without relying on shape-specific runtime branches', () => {
    expect(
      classifyConstrainedDashedSource(
        [
          { x: 0, y: 0 },
          { x: 80, y: 0 },
          { x: 80, y: 40 },
          { x: 0, y: 40 }
        ],
        true
      )
    ).toBe('rectangle-equivalent')

    expect(
      classifyConstrainedDashedSource(
        [
          { x: 0, y: 0 },
          { x: 80, y: 0 },
          { x: 60, y: 40 },
          { x: 0, y: 40 }
        ],
        true
      )
    ).toBe('broader-simple-closed')

    expect(
      classifyConstrainedDashedSource(
        [
          { x: 0, y: 0 },
          { x: 80, y: 0 }
        ],
        false
      )
    ).toBe('open')
  })

  it('should classify full-loop round-join support through the constrained dashed interval classifier', () => {
    const stroke = getOnlyRenderableStroke([
      createDefaultStroke({
        width: 6,
        style: 'dashed',
        position: 'outside',
        joinType: 'round',
        dashPattern: [400, 20],
        dashOffset: 0
      })
    ])

    const classification = classifyConstrainedDashedInterval(
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 60, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      {
        startDistance: 0,
        endDistance: 209.4427190999916,
        totalLength: 209.4427190999916,
        wrapsSeam: false
      },
      stroke
    )

    expect(classification.sourceTopology).toBe('broader-simple-closed')
    expect(classification.intervalTopology).toBe('full-loop')
    expect(classification.acceptsFullLoopRoundJoin).toBe(true)
    expect(classification.acceptsSingleEdgeRoundCap).toBe(false)
  })

  it('should classify sampled smooth closed full-loop round joins as accepted without widening sharp vector gates', () => {
    const stroke = getOnlyRenderableStroke([
      createDefaultStroke({
        width: 6,
        style: 'dashed',
        position: 'inside',
        joinType: 'round',
        dashPattern: [400, 20],
        dashOffset: 0
      })
    ])

    const ellipsePoints = buildEllipseLoop(72, 48)
    const totalLength = ellipsePoints.reduce((sum, point, index) => {
      const next = ellipsePoints[(index + 1) % ellipsePoints.length]
      return sum + Math.hypot(next.x - point.x, next.y - point.y)
    }, 0)

    const ellipseClassification = classifyConstrainedDashedInterval(
      ellipsePoints,
      true,
      {
        startDistance: 0,
        endDistance: totalLength,
        totalLength,
        wrapsSeam: false
      },
      stroke
    )

    expect(ellipseClassification.sourceTopology).toBe('sampled-simple-closed')
    expect(ellipseClassification.intervalTopology).toBe('full-loop')
    expect(ellipseClassification.acceptsFullLoopRoundJoin).toBe(true)

    const sharpPolygon = [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 50, y: 20 },
      { x: 30, y: 40 },
      { x: 0, y: 30 }
    ]
    const sharpLength = sharpPolygon.reduce((sum, point, index) => {
      const next = sharpPolygon[(index + 1) % sharpPolygon.length]
      return sum + Math.hypot(next.x - point.x, next.y - point.y)
    }, 0)

    expect(
      classifyConstrainedDashedInterval(
        sharpPolygon,
        true,
        {
          startDistance: 0,
          endDistance: sharpLength,
          totalLength: sharpLength,
          wrapsSeam: false
        },
        stroke
      )
    ).toMatchObject({
      sourceTopology: 'sampled-simple-closed',
      intervalTopology: 'full-loop',
      acceptsFullLoopRoundJoin: false
    })
  })

  it('should run: keep sharp sampled full-loop round joins visible on the constrained dashed path', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 50, y: 20 },
        { x: 30, y: 40 },
        { x: 0, y: 30 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'inside',
          joinType: 'round',
          dashPattern: [400, 20],
          dashOffset: 0
        })
      ]
    )

    expect(packets.length).toBeGreaterThan(0)
    expect(
      packets.every(
        (packet) =>
          packet.geometry.debugMeta?.geometryFamily ===
            'constrained-dashed' &&
          packet.geometry.debugMeta?.sourceTopology ===
            'sampled-simple-closed' &&
          packet.geometry.debugMeta?.intervalTopology === 'full-loop'
      )
    ).toBe(true)
  })

  it('should run: keep seam-wrapping constrained dashed intervals visible instead of dropping the authored dash', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:test:constrained-dashed-seam-wrap',
      [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 40, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'inside',
          joinType: 'miter',
          dashPattern: [20, 20],
          dashOffset: 10
        })
      ]
    )

    expect(
      packets.some((packet) => packet.geometry.debugMeta?.wrapsSeam === true)
    ).toBe(true)
    expect(
      packets.every(
        (packet) =>
          packet.geometry.debugMeta?.geometryFamily === 'constrained-dashed'
      )
    ).toBe(true)
  })

  it('should run: keep repeated self-intersecting closed intervals visible as local-side constrained dashed geometry', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:test:constrained-dashed',
      [
        { x: 50, y: 0 },
        { x: 79, y: 90 },
        { x: 2, y: 35 },
        { x: 98, y: 35 },
        { x: 21, y: 90 }
      ],
      true,
      [
        createDefaultStroke({
          width: 12,
          style: 'dashed',
          position: 'inside',
          joinType: 'miter',
          dashPattern: [20, 20],
          dashOffset: 0
        })
      ]
    )

    expect(packets.length).toBeGreaterThan(0)
    expect(
      packets.every(
        (packet) =>
          packet.geometry.debugMeta?.geometryFamily ===
            'constrained-dashed' &&
          packet.geometry.debugMeta?.resolutionStatus ===
            'local-side-approximation' &&
          packet.geometry.debugMeta?.sourceTopology === 'self-intersecting'
      )
    ).toBe(true)
  })

  it('should classify single-edge round-cap support through the constrained dashed interval classifier', () => {
    const stroke = getOnlyRenderableStroke([
      createDefaultStroke({
        width: 4,
        style: 'dashed',
        position: 'inside',
        capType: 'round',
        dashPattern: [20, 220],
        dashOffset: 220
      })
    ])

    const classification = classifyConstrainedDashedInterval(
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      {
        startDistance: 20,
        endDistance: 40,
        totalLength: 240,
        wrapsSeam: false
      },
      stroke
    )

    expect(classification.sourceTopology).toBe('rectangle-equivalent')
    expect(classification.intervalTopology).toBe('single-edge')
    expect(classification.acceptsSingleEdgeRoundCap).toBe(true)
    expect(classification.acceptsCornerSpanningJoin).toBe(false)
  })

  it('should classify corner-spanning join support without accepting unrelated multi-corner intervals', () => {
    const stroke = getOnlyRenderableStroke([
      createDefaultStroke({
        width: 6,
        style: 'dashed',
        position: 'outside',
        joinType: 'miter',
        dashPattern: [40, 200],
        dashOffset: 180
      })
    ])

    const points = [
      { x: 0, y: 0 },
      { x: 80, y: 0 },
      { x: 80, y: 40 },
      { x: 0, y: 40 }
    ]

    expect(
      classifyConstrainedDashedInterval(
        points,
        true,
        {
          startDistance: 60,
          endDistance: 100,
          totalLength: 240,
          wrapsSeam: false
        },
        stroke
      )
    ).toMatchObject({
      intervalTopology: 'corner-spanning',
      acceptsCornerSpanningJoin: true
    })

    expect(
      classifyConstrainedDashedInterval(
        points,
        true,
        {
          startDistance: 20,
          endDistance: 140,
          totalLength: 240,
          wrapsSeam: false
        },
        stroke
      )
    ).toMatchObject({
      intervalTopology: 'multi-corner',
      acceptsCornerSpanningJoin: false
    })
  })

  it('should classify multiple constrained dashed packets from one stroke as one accepted owner', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 }
      ],
      true,
      [
        createDefaultStroke({
          width: 4,
          style: 'dashed',
          position: 'outside',
          dashPattern: [20, 20],
          dashOffset: 0
        })
      ],
      {
        metadata: {
          ownerKeyPrefix: 'rect:test'
        }
      }
    )

    expect(packets).toHaveLength(2)
    expect(classifyConstrainedDashedOwnership(packets)).toEqual({
      status: 'accepted',
      reason: 'single-owner',
      ownerKeys: ['rect:test:stroke:0'],
      packetCount: 2
    })
  })

  it('should classify constrained dashed ownership from typed metadata, not geometry id parsing', () => {
    expect(
      classifyConstrainedDashedOwnership([
        {
          geometry: {
            geometryId: 'opaque-id-a',
            polygons: [],
            bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
            debugMeta: {
              ownerKey: 'typed-owner:stroke:0'
            }
          }
        },
        {
          geometry: {
            geometryId: 'opaque-id-b',
            polygons: [],
            bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
            debugMeta: {
              ownerKey: 'typed-owner:stroke:0'
            }
          }
        }
      ])
    ).toEqual({
      status: 'accepted',
      reason: 'single-owner',
      ownerKeys: ['typed-owner:stroke:0'],
      packetCount: 2
    })
  })

  it('should not run: classify missing constrained dashed owner metadata as an explicit blocked state', () => {
    expect(
      classifyConstrainedDashedOwnership([
        {
          geometry: {
            geometryId: 'opaque-id-without-owner',
            polygons: [],
            bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
            debugMeta: {
              strokeId: 'stroke:0'
            }
          }
        }
      ])
    ).toEqual({
      status: 'blocked',
      reason: 'missing-owner-metadata',
      ownerKeys: [],
      packetCount: 1
    })
  })

  it('should run: attach typed owner and network metadata to constrained dashed packets', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'opaque-cache-key',
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 }
      ],
      true,
      [
        createDefaultStroke({
          width: 4,
          style: 'dashed',
          position: 'inside',
          dashPattern: [200, 20],
          dashOffset: 0
        })
      ],
      {
        metadata: {
          ownerKeyPrefix: 'typed-vector:network-a',
          networkId: 'network-a'
        }
      }
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({
      sourcePathId: 'opaque-cache-key',
      ownerKey: 'typed-vector:network-a:stroke:0',
      networkId: 'network-a',
      strokeId: 'stroke:0',
      strokeIndex: 0,
      geometryFamily: 'constrained-dashed',
      resolutionStatus: 'exact-constrained',
      runtimeStatus: 'candidate',
      sourceTopology: 'rectangle-equivalent',
      intervalTopology: 'full-loop'
    })
  })

  it('should classify multiple constrained dashed strokes as accepted typed ownership', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 }
      ],
      true,
      [
        createDefaultStroke({
          width: 4,
          style: 'dashed',
          position: 'inside',
          dashPattern: [200, 20],
          dashOffset: 0
        }),
        createDefaultStroke({
          width: 4,
          style: 'dashed',
          position: 'outside',
          dashPattern: [200, 20],
          dashOffset: 0
        })
      ],
      {
        metadata: {
          ownerKeyPrefix: 'rect:test'
        }
      }
    )

    expect(packets).toHaveLength(2)
    expect(classifyConstrainedDashedOwnership(packets)).toEqual({
      status: 'accepted',
      reason: 'typed-owners',
      ownerKeys: ['rect:test:stroke:0', 'rect:test:stroke:1'],
      packetCount: 2
    })
  })

  it('should classify multi-network constrained dashed packets as accepted typed ownership', () => {
    const strokes = [
      createDefaultStroke({
        width: 4,
        style: 'dashed',
        position: 'outside',
        dashPattern: [200, 20],
        dashOffset: 0
      })
    ]

    const packets = [
      ...buildConstrainedDashedStrokeResolvedPackets(
        'vector:test:network-a:constrained-dashed',
        [
          { x: 0, y: 0 },
          { x: 40, y: 0 },
          { x: 40, y: 40 },
          { x: 0, y: 40 }
        ],
        true,
        strokes,
        {
          metadata: {
            ownerKeyPrefix: 'vector:test:network-a',
            networkId: 'network-a'
          }
        }
      ),
      ...buildConstrainedDashedStrokeResolvedPackets(
        'vector:test:network-b:constrained-dashed',
        [
          { x: 60, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 40 },
          { x: 60, y: 40 }
        ],
        true,
        strokes,
        {
          metadata: {
            ownerKeyPrefix: 'vector:test:network-b',
            networkId: 'network-b'
          }
        }
      )
    ]

    expect(packets).toHaveLength(2)
    expect(classifyConstrainedDashedOwnership(packets)).toEqual({
      status: 'accepted',
      reason: 'typed-owners',
      ownerKeys: [
        'vector:test:network-a:stroke:0',
        'vector:test:network-b:stroke:0'
      ],
      packetCount: 2
    })
  })

  it('should classify constrained dashed runtime status as accepted for one owner', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 }
      ],
      true,
      [
        createDefaultStroke({
          width: 4,
          style: 'dashed',
          position: 'outside',
          dashPattern: [20, 20],
          dashOffset: 0
        })
      ]
    )

    expect(
      classifyConstrainedDashedRuntimeStatus({
        points: [
          { x: 0, y: 0 },
          { x: 20, y: 0 },
          { x: 20, y: 20 },
          { x: 0, y: 20 }
        ],
        closed: true,
        candidatePackets: packets
      })
    ).toMatchObject({
      status: 'accepted',
      reason: 'single-owner',
      sourceTopology: 'rectangle-equivalent'
    })
  })

  it('should run: build open constrained dashed packets through interval-local one-sided geometry', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:test:network-0:constrained-dashed',
      [
        { x: 0, y: 10 },
        { x: 40, y: 10 }
      ],
      false,
      [
        createDefaultStroke({
          width: 4,
          style: 'dashed',
          position: 'inside',
          dashPattern: [400, 20],
          dashOffset: 0
        })
      ],
      {
        metadata: {
          ownerKeyPrefix: 'vector:test:network-0',
          networkId: 'network-0'
        }
      }
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.bounds).toEqual({
      minX: 0,
      minY: 10,
      maxX: 40,
      maxY: 14
    })
    expect(packets[0]?.geometry.debugMeta).toMatchObject({
      sourcePathId: 'vector:test:network-0:constrained-dashed',
      ownerKey: 'vector:test:network-0:stroke:0',
      networkId: 'network-0',
      strokeIndex: 0,
      intervalId: 'interval:0',
      geometryFamily: 'constrained-dashed',
      resolutionStatus: 'exact-constrained',
      runtimeStatus: 'candidate',
      sourceTopology: 'open'
    })

    expect(
      classifyConstrainedDashedRuntimeStatus({
        points: [
          { x: 0, y: 10 },
          { x: 40, y: 10 }
        ],
        closed: false,
        candidatePackets: packets
      })
    ).toMatchObject({
      status: 'accepted',
      reason: 'single-owner',
      sourceTopology: 'open',
      ownership: {
        status: 'accepted',
        reason: 'single-owner'
      }
    })
  })

  it('should keep open constrained dashed runtime status blocked when candidate geometry cannot be built', () => {
    expect(
      classifyConstrainedDashedRuntimeStatus({
        points: [
          { x: 0, y: 0 },
          { x: 80, y: 0 }
        ],
        closed: false,
        candidatePackets: []
      })
    ).toMatchObject({
      status: 'blocked',
      reason: 'no-candidate-packets',
      sourceTopology: 'open',
      ownership: {
        status: 'blocked',
        reason: 'no-packets'
      }
    })
  })

  it('should classify unsupported closed constrained dashed runtime status as blocked without substitute geometry', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 80, y: 0 },
      { x: 80, y: 40 },
      { x: 0, y: 40 }
    ]

    expect(
      classifyConstrainedDashedRuntimeStatus({
        points,
        closed: true,
        candidatePackets: []
      })
    ).toMatchObject({
      status: 'blocked',
      reason: 'no-packets',
      sourceTopology: 'rectangle-equivalent'
    })

    expect(
      classifyConstrainedDashedRuntimeStatus({
        points,
        closed: true,
        candidatePackets: []
      })
    ).toMatchObject({
      status: 'blocked',
      reason: 'no-packets',
      sourceTopology: 'rectangle-equivalent'
    })
  })

  it('should run: derive render, hit, and export packets from the same constrained dashed full-loop geometry source', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 }
      ],
      true,
      [
        createDefaultStroke({
          width: 4,
          style: 'dashed',
          position: 'inside',
          dashPattern: [200, 20],
          dashOffset: 0
        })
      ]
    )

    expect(packets).toHaveLength(1)

    const acceptedPackets = attachStrokePacketDebugMeta(packets, {
      runtimeStatus: 'accepted',
      runtimeReason: 'single-owner',
      ownershipStatus: 'accepted',
      ownerCount: 1
    })
    const [resolved] = acceptedPackets
    const [hit] = buildSolidCenterStrokeHitTestPackets(acceptedPackets)
    const [exportPacket] = buildSolidCenterStrokeExportPackets(acceptedPackets)

    expect(hit.geometryId).toBe(resolved.geometry.geometryId)
    expect(exportPacket.geometryId).toBe(resolved.geometry.geometryId)
    expect(hit.polygons).toBe(resolved.geometry.polygons)
    expect(exportPacket.polygons).toBe(resolved.geometry.polygons)
    expect(hit.bounds).toEqual(resolved.geometry.bounds)
    expect(exportPacket.bounds).toEqual(resolved.geometry.bounds)
    expect(hit.debugMeta).toBe(resolved.geometry.debugMeta)
    expect(exportPacket.debugMeta).toBe(resolved.geometry.debugMeta)
    expect(exportPacket.debugMeta).toMatchObject({
      ownerKey: 'anonymous-constrained-dashed-source:stroke:0',
      strokeId: 'stroke:0',
      contourId: 'rect:test:constrained-dashed:contour:0',
      legalDomainId: 'rect:test:constrained-dashed:legal-domain:0',
      geometryFamily: 'constrained-dashed',
      resolutionStatus: 'exact-constrained',
      runtimeStatus: 'accepted',
      runtimeReason: 'single-owner',
      ownershipStatus: 'accepted',
      ownerCount: 1,
      sourceTopology: 'rectangle-equivalent',
      topologyFamily: 'rectangle-equivalent',
      intervalTopology: 'full-loop'
    })

    const hitArea = createSolidCenterStrokeHitArea(acceptedPackets)
    expect(hitArea?.contains(1, 1)).toBe(true)
    expect(hitArea?.contains(10, 10)).toBe(false)
    expect(hitArea?.contains(-1, -1)).toBe(false)
  })

  it('should run: attach topology and legal-domain metadata to interval-local constrained dashed packets', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:interval-local',
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 }
      ],
      true,
      [
        createDefaultStroke({
          width: 4,
          style: 'dashed',
          position: 'inside',
          dashPattern: [10, 100],
          dashOffset: 0
        })
      ]
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({
      ownerKey: 'anonymous-constrained-dashed-source:stroke:0',
      strokeId: 'stroke:0',
      contourId: 'rect:test:interval-local:contour:0',
      legalDomainId: 'rect:test:interval-local:legal-domain:0',
      geometryFamily: 'constrained-dashed',
      resolutionStatus: 'exact-constrained',
      runtimeStatus: 'candidate',
      sourceTopology: 'rectangle-equivalent',
      topologyFamily: 'rectangle-equivalent',
      intervalTopology: 'single-edge'
    })
    expect(packets[0]?.geometry.bounds).toEqual({
      minX: 0,
      minY: 0,
      maxX: 10,
      maxY: 4
    })
  })

  it('should run: derive one inside round-join full-loop constrained dashed packet from topology classification', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'inside',
          joinType: 'round',
          dashPattern: [400, 20],
          dashOffset: 0
        })
      ]
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({ geometryFamily: 'constrained-dashed' })
    expect(packets[0]?.geometry.bounds).toEqual({
      minX: 0,
      minY: 0,
      maxX: 80,
      maxY: 40
    })
  })

  it('should run: derive one outside round-join full-loop constrained dashed packet from topology classification', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'outside',
          joinType: 'round',
          dashPattern: [400, 20],
          dashOffset: 0
        })
      ]
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({ geometryFamily: 'constrained-dashed' })
    expect(packets[0]?.geometry.bounds).toEqual({
      minX: -6,
      minY: -6,
      maxX: 86,
      maxY: 46
    })
  })

  it('should run: derive one inside round-join full-loop constrained dashed packet on a rectangle-equivalent vector loop from topology classification', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 },
        { x: 0, y: 0 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'inside',
          joinType: 'round',
          dashPattern: [400, 20],
          dashOffset: 0
        })
      ]
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({ geometryFamily: 'constrained-dashed' })
    expect(packets[0]?.geometry.bounds).toEqual({
      minX: 0,
      minY: 0,
      maxX: 80,
      maxY: 40
    })
  })

  it('should run: derive one outside round-join full-loop constrained dashed packet on a rectangle-equivalent vector loop from topology classification', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 },
        { x: 0, y: 0 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'outside',
          joinType: 'round',
          dashPattern: [400, 20],
          dashOffset: 0
        })
      ]
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({ geometryFamily: 'constrained-dashed' })
    expect(packets[0]?.geometry.bounds).toEqual({
      minX: -6,
      minY: -6,
      maxX: 86,
      maxY: 46
    })
  })

  it('should run: derive one outside round-join full-loop constrained dashed packet on a broader vector loop from topology classification', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 60, y: 40 },
        { x: 0, y: 40 },
        { x: 0, y: 0 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'outside',
          joinType: 'round',
          dashPattern: [400, 20],
          dashOffset: 0
        })
      ]
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({ geometryFamily: 'constrained-dashed' })
    expect(packets[0]?.geometry.bounds.minX).toBe(-6)
    expect(packets[0]?.geometry.bounds.minY).toBe(-6)
    expect(packets[0]?.geometry.bounds.maxX).toBeCloseTo(85.99393590649383, 6)
    expect(packets[0]?.geometry.bounds.maxY).toBe(46)
  })

  it('should run: keep the same constrained dashed full-loop geometry when the first supported paint gradient paint slice swaps paint over the supported rect path', () => {
    const solidPackets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'inside',
          dashPattern: [400, 20],
          dashOffset: 0
        })
      ]
    )

    const gradientPackets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed-gradient',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'inside',
          dashPattern: [400, 20],
          dashOffset: 0,
          kind: FillKinds.GRADIENT,
          gradient: {
            ...createDefaultGradientData(),
            gradientHandles: [
              { x: 0, y: 0.5 },
              { x: 1, y: 0.5 }
            ]
          }
        })
      ]
    )

    expect(solidPackets).toHaveLength(1)
    expect(gradientPackets).toHaveLength(1)
    expect(gradientPackets[0]?.paint.kind).toBe('gradient')
    expect(gradientPackets[0]?.paint.gradientStyle).toBeTruthy()
    expect(gradientPackets[0]?.geometry.bounds).toEqual(
      solidPackets[0]?.geometry.bounds
    )
    expect(gradientPackets[0]?.geometry.polygons).toEqual(
      solidPackets[0]?.geometry.polygons
    )
  })

  it('should run: keep the same constrained dashed full-loop outside geometry when the next supported paint gradient paint slice swaps paint over the supported rect path', () => {
    const solidPackets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed-outside',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'outside',
          dashPattern: [400, 20],
          dashOffset: 0
        })
      ]
    )

    const gradientPackets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed-outside-gradient',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'outside',
          dashPattern: [400, 20],
          dashOffset: 0,
          kind: FillKinds.GRADIENT,
          gradient: {
            ...createDefaultGradientData(),
            gradientHandles: [
              { x: 0, y: 0.5 },
              { x: 1, y: 0.5 }
            ]
          }
        })
      ]
    )

    expect(solidPackets).toHaveLength(1)
    expect(gradientPackets).toHaveLength(1)
    expect(gradientPackets[0]?.paint.kind).toBe('gradient')
    expect(gradientPackets[0]?.paint.gradientStyle).toBeTruthy()
    expect(gradientPackets[0]?.geometry.bounds).toEqual(
      solidPackets[0]?.geometry.bounds
    )
    expect(gradientPackets[0]?.geometry.polygons).toEqual(
      solidPackets[0]?.geometry.polygons
    )
  })

  it('should run: derive constrained dashed packets on simple open paths', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'line:test',
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 }
      ],
      false,
      [
        createDefaultStroke({
          width: 4,
          style: 'dashed',
          position: 'inside',
          dashPattern: [200, 20],
          dashOffset: 0
        })
      ]
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.bounds).toEqual({
      minX: 0,
      minY: 0,
      maxX: 20,
      maxY: 4
    })
  })

  it('should run: derive constrained dashed packets for repeated non-full-loop intervals on a closed path', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 }
      ],
      true,
      [
        createDefaultStroke({
          width: 4,
          style: 'dashed',
          position: 'outside',
          dashPattern: [20, 20],
          dashOffset: 0
        })
      ]
    )

    expect(packets).toHaveLength(2)
    expect(
      packets.every((packet) =>
        packet.geometry.debugMeta?.geometryFamily === 'constrained-dashed'
      )
    ).toBe(true)
    expect(
      packets.some(
        (packet) =>
          packet.geometry.bounds.minY < 0 || packet.geometry.bounds.maxY > 20
      )
    ).toBe(true)
  })

  it('should run: derive one inside single-edge constrained dashed packet when the visible interval stays within one edge', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'inside',
          dashPattern: [20, 220],
          dashOffset: 220
        })
      ]
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({ geometryFamily: 'constrained-dashed' })
    expect(packets[0]?.geometry.bounds).toEqual({
      minX: 20,
      minY: 0,
      maxX: 40,
      maxY: 6
    })
  })

  it('should run: keep the same constrained dashed single-edge geometry when the next supported paint gradient paint slice swaps paint over the supported rect path', () => {
    const solidPackets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed-single-edge',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'inside',
          dashPattern: [20, 220],
          dashOffset: 220
        })
      ]
    )

    const gradientPackets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed-single-edge-gradient',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'inside',
          dashPattern: [20, 220],
          dashOffset: 220,
          kind: FillKinds.GRADIENT,
          gradient: {
            ...createDefaultGradientData(),
            gradientHandles: [
              { x: 0, y: 0.5 },
              { x: 1, y: 0.5 }
            ]
          }
        })
      ]
    )

    expect(solidPackets).toHaveLength(1)
    expect(gradientPackets).toHaveLength(1)
    expect(gradientPackets[0]?.paint.kind).toBe('gradient')
    expect(gradientPackets[0]?.paint.gradientStyle).toBeTruthy()
    expect(gradientPackets[0]?.geometry.bounds).toEqual(
      solidPackets[0]?.geometry.bounds
    )
    expect(gradientPackets[0]?.geometry.polygons).toEqual(
      solidPackets[0]?.geometry.polygons
    )
  })

  it('should run: derive one inside single-edge round-cap constrained dashed packet from topology classification', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'inside',
          capType: 'round',
          dashPattern: [20, 220],
          dashOffset: 220
        })
      ]
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({ geometryFamily: 'constrained-dashed' })
    expect(packets[0]?.geometry.bounds.minX).toBeCloseTo(17, 6)
    expect(packets[0]?.geometry.bounds.minY).toBe(0)
    expect(packets[0]?.geometry.bounds.maxX).toBe(40)
    expect(packets[0]?.geometry.bounds.maxY).toBe(6)
  })

  it('should run: derive one outside single-edge round-cap constrained dashed packet from topology classification', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'outside',
          capType: 'round',
          dashPattern: [20, 220],
          dashOffset: 220
        })
      ]
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({ geometryFamily: 'constrained-dashed' })
    expect(packets[0]?.geometry.bounds.minX).toBeCloseTo(17, 6)
    expect(packets[0]?.geometry.bounds.minY).toBe(-6)
    expect(packets[0]?.geometry.bounds.maxX).toBeCloseTo(40, 6)
    expect(packets[0]?.geometry.bounds.maxY).toBe(0)
  })

  it('should run: derive one inside single-edge round-cap constrained dashed packet on a rectangle-equivalent vector loop from topology classification', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 4,
          style: 'dashed',
          position: 'inside',
          capType: 'round',
          dashPattern: [20, 220],
          dashOffset: 220
        })
      ]
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({ geometryFamily: 'constrained-dashed' })
    expect(packets[0]?.geometry.bounds.minX).toBeCloseTo(18, 6)
    expect(packets[0]?.geometry.bounds.minY).toBe(0)
    expect(packets[0]?.geometry.bounds.maxX).toBe(40)
    expect(packets[0]?.geometry.bounds.maxY).toBe(4)
  })

  it('should run: derive one outside single-edge round-cap constrained dashed packet on a rectangle-equivalent vector loop from topology classification', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 4,
          style: 'dashed',
          position: 'outside',
          capType: 'round',
          dashPattern: [20, 220],
          dashOffset: 220
        })
      ]
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({ geometryFamily: 'constrained-dashed' })
    expect(packets[0]?.geometry.bounds.minX).toBeCloseTo(18, 6)
    expect(packets[0]?.geometry.bounds.minY).toBe(-4)
    expect(packets[0]?.geometry.bounds.maxX).toBeCloseTo(40, 6)
    expect(packets[0]?.geometry.bounds.maxY).toBe(0)
  })

  it('should run: derive one inside single-edge round-cap constrained dashed packet on a broader vector loop from topology classification', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 60, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 4,
          style: 'dashed',
          position: 'inside',
          capType: 'round',
          dashPattern: [20, 220],
          dashOffset: 220
        })
      ]
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({ geometryFamily: 'constrained-dashed' })
    expect(packets[0]?.geometry.bounds.minX).toBeCloseTo(18, 6)
    expect(packets[0]?.geometry.bounds.minY).toBe(0)
    expect(packets[0]?.geometry.bounds.maxX).toBe(40)
    expect(packets[0]?.geometry.bounds.maxY).toBe(4)
  })

  it('should run: derive one outside single-edge round-cap constrained dashed packet on a broader vector loop from topology classification', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 60, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 4,
          style: 'dashed',
          position: 'outside',
          capType: 'round',
          dashPattern: [20, 220],
          dashOffset: 220
        })
      ]
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({ geometryFamily: 'constrained-dashed' })
    expect(packets[0]?.geometry.bounds.minX).toBeCloseTo(18, 6)
    expect(packets[0]?.geometry.bounds.minY).toBeLessThan(-3.5)
    expect(packets[0]?.geometry.bounds.maxX).toBeCloseTo(40, 6)
    expect(packets[0]?.geometry.bounds.maxY).toBeGreaterThan(-0.5)
  })

  it('should run: derive one inside round-join full-loop constrained dashed packet on a broader vector loop from topology classification', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 60, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 4,
          style: 'dashed',
          position: 'inside',
          joinType: 'round',
          dashPattern: [400, 20],
          dashOffset: 0
        })
      ]
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({ geometryFamily: 'constrained-dashed' })
    expect(packets[0]?.geometry.bounds).toEqual({
      minX: 0,
      minY: 0,
      maxX: 80,
      maxY: 40
    })
  })

  it('should run: derive one outside single-edge constrained dashed packet when the visible interval stays within one edge', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'outside',
          dashPattern: [20, 220],
          dashOffset: 220
        })
      ]
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({ geometryFamily: 'constrained-dashed' })
    expect(packets[0]?.geometry.bounds).toEqual({
      minX: 20,
      minY: -6,
      maxX: 40,
      maxY: 0
    })
  })

  it('should run: derive one outside bevel corner-spanning constrained dashed packet from topology classification', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'outside',
          joinType: 'bevel',
          dashPattern: [40, 200],
          dashOffset: 180
        })
      ]
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({ geometryFamily: 'constrained-dashed' })
    expect(packets[0]?.geometry.bounds).toEqual({
      minX: 60,
      minY: -6,
      maxX: 86,
      maxY: 20
    })
  })

  it('should run: keep the same constrained dashed outside bevel corner-spanning geometry when the next supported paint corner-spanning outside-gradient slice swaps paint over the supported rect path', () => {
    const solidPackets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed-corner-spanning-outside',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'outside',
          joinType: 'bevel',
          dashPattern: [40, 200],
          dashOffset: 180
        })
      ]
    )

    const gradientPackets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed-corner-spanning-outside-gradient',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'outside',
          joinType: 'bevel',
          dashPattern: [40, 200],
          dashOffset: 180,
          kind: FillKinds.GRADIENT,
          gradient: {
            ...createDefaultGradientData(),
            gradientHandles: [
              { x: 0, y: 0.5 },
              { x: 1, y: 0.5 }
            ]
          }
        })
      ]
    )

    expect(solidPackets).toHaveLength(1)
    expect(gradientPackets).toHaveLength(1)
    expect(gradientPackets[0]?.paint.kind).toBe('gradient')
    expect(gradientPackets[0]?.paint.gradientStyle).toBeTruthy()
    expect(gradientPackets[0]?.geometry.bounds).toEqual(
      solidPackets[0]?.geometry.bounds
    )
    expect(gradientPackets[0]?.geometry.polygons).toEqual(
      solidPackets[0]?.geometry.polygons
    )
  })

  it('should run: derive one outside miter corner-spanning constrained dashed packet from topology classification', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'outside',
          joinType: 'miter',
          dashPattern: [40, 200],
          dashOffset: 180
        })
      ]
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({ geometryFamily: 'constrained-dashed' })
    expect(packets[0]?.geometry.bounds).toEqual({
      minX: 60,
      minY: -6,
      maxX: 86,
      maxY: 20
    })
  })

  it('should run: derive one outside round corner-spanning constrained dashed packet on the uniform-width corner-spanning topology family product path', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'outside',
          joinType: 'round',
          dashPattern: [40, 200],
          dashOffset: 180
        })
      ]
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({ geometryFamily: 'constrained-dashed' })
    expect(packets[0]?.geometry.bounds).toEqual({
      minX: 60,
      minY: -6,
      maxX: 86,
      maxY: 20
    })
  })

  it('should run: derive one inside bevel corner-spanning constrained dashed packet from topology classification', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'inside',
          joinType: 'bevel',
          dashPattern: [40, 200],
          dashOffset: 180
        })
      ]
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({ geometryFamily: 'constrained-dashed' })
    expect(packets[0]?.geometry.bounds).toEqual({
      minX: 60,
      minY: 0,
      maxX: 80,
      maxY: 20
    })
  })

  it('should run: derive one inside miter corner-spanning constrained dashed packet from topology classification', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'inside',
          joinType: 'miter',
          dashPattern: [40, 200],
          dashOffset: 180
        })
      ]
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({ geometryFamily: 'constrained-dashed' })
    expect(packets[0]?.geometry.bounds).toEqual({
      minX: 60,
      minY: 0,
      maxX: 80,
      maxY: 20
    })
  })

  it('should run: derive one inside round corner-spanning constrained dashed packet on the uniform-width corner-spanning topology family product path', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'inside',
          joinType: 'round',
          dashPattern: [40, 200],
          dashOffset: 180
        })
      ]
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({ geometryFamily: 'constrained-dashed' })
    expect(packets[0]?.geometry.bounds).toEqual({
      minX: 60,
      minY: 0,
      maxX: 80,
      maxY: 20
    })
  })

  it('should run: keep the same constrained dashed inside bevel corner-spanning geometry when the first supported paint corner-spanning gradient slice swaps paint over the supported rect path', () => {
    const solidPackets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed-corner-spanning',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'inside',
          joinType: 'bevel',
          dashPattern: [40, 200],
          dashOffset: 180
        })
      ]
    )

    const gradientPackets = buildConstrainedDashedStrokeResolvedPackets(
      'rect:test:constrained-dashed-corner-spanning-gradient',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'inside',
          joinType: 'bevel',
          dashPattern: [40, 200],
          dashOffset: 180,
          kind: FillKinds.GRADIENT,
          gradient: {
            ...createDefaultGradientData(),
            gradientHandles: [
              { x: 0, y: 0.5 },
              { x: 1, y: 0.5 }
            ]
          }
        })
      ]
    )

    expect(solidPackets).toHaveLength(1)
    expect(gradientPackets).toHaveLength(1)
    expect(gradientPackets[0]?.paint.kind).toBe('gradient')
    expect(gradientPackets[0]?.paint.gradientStyle).toBeTruthy()
    expect(gradientPackets[0]?.geometry.bounds).toEqual(
      solidPackets[0]?.geometry.bounds
    )
    expect(gradientPackets[0]?.geometry.polygons).toEqual(
      solidPackets[0]?.geometry.polygons
    )
  })

  it('should run: derive one broader non-rectangle-equivalent inside bevel corner-spanning constrained dashed packet from topology classification', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 60, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'inside',
          joinType: 'bevel',
          dashPattern: [40, 200],
          dashOffset: 180
        })
      ]
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({ geometryFamily: 'constrained-dashed' })
    expect(packets[0]?.geometry.bounds.minY).toBe(0)
    expect(packets[0]?.geometry.bounds.maxX).toBe(80)
    expect(packets[0]?.geometry.bounds.minX).toBeGreaterThan(48)
    expect(packets[0]?.geometry.bounds.minX).toBeLessThan(70)
    expect(packets[0]?.geometry.bounds.maxY).toBeGreaterThan(12)
    expect(packets[0]?.geometry.bounds.maxY).toBeLessThan(28)
  })

  it('should run: derive one broader non-rectangle-equivalent inside miter corner-spanning constrained dashed packet from topology classification', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 60, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'inside',
          joinType: 'miter',
          dashPattern: [40, 200],
          dashOffset: 180
        })
      ]
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({ geometryFamily: 'constrained-dashed' })
    expect(packets[0]?.geometry.bounds.minY).toBe(0)
    expect(packets[0]?.geometry.bounds.maxX).toBe(80)
    expect(packets[0]?.geometry.bounds.minX).toBeGreaterThan(48)
    expect(packets[0]?.geometry.bounds.minX).toBeLessThan(70)
    expect(packets[0]?.geometry.bounds.maxY).toBeGreaterThan(12)
    expect(packets[0]?.geometry.bounds.maxY).toBeLessThan(28)
  })

  it('should run: derive one broader non-rectangle-equivalent outside bevel corner-spanning constrained dashed packet from topology classification', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 60, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'outside',
          joinType: 'bevel',
          dashPattern: [40, 200],
          dashOffset: 180
        })
      ]
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({ geometryFamily: 'constrained-dashed' })
    expect(packets[0]?.geometry.bounds.minY).toBeLessThan(0)
    expect(packets[0]?.geometry.bounds.maxX).toBeGreaterThan(80)
    expect(packets[0]?.geometry.bounds.minX).toBeGreaterThan(48)
    expect(packets[0]?.geometry.bounds.minX).toBeLessThan(70)
    expect(packets[0]?.geometry.bounds.maxY).toBeGreaterThan(16)
    expect(packets[0]?.geometry.bounds.maxY).toBeLessThan(32)
  })

  it('should run: derive one broader non-rectangle-equivalent outside miter corner-spanning constrained dashed packet from topology classification', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:test:constrained-dashed',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 60, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'outside',
          joinType: 'miter',
          dashPattern: [40, 200],
          dashOffset: 180
        })
      ]
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({ geometryFamily: 'constrained-dashed' })
    expect(packets[0]?.geometry.bounds.minY).toBeLessThan(0)
    expect(packets[0]?.geometry.bounds.maxX).toBeGreaterThan(80)
    expect(packets[0]?.geometry.bounds.minX).toBeGreaterThan(48)
    expect(packets[0]?.geometry.bounds.minX).toBeLessThan(70)
    expect(packets[0]?.geometry.bounds.maxY).toBeGreaterThan(16)
    expect(packets[0]?.geometry.bounds.maxY).toBeLessThan(32)
  })

  it('should run: sampled simple closed inside dashed paths emit interval-local one-sided packets instead of disappearing', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:test:sampled-simple-closed-inside',
      [
        { x: 0, y: 20 },
        { x: 12, y: 4 },
        { x: 32, y: 0 },
        { x: 54, y: 8 },
        { x: 66, y: 26 },
        { x: 58, y: 44 },
        { x: 36, y: 54 },
        { x: 14, y: 48 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'inside',
          joinType: 'miter',
          capType: 'butt',
          dashPattern: [14, 8],
          dashOffset: 0
        })
      ]
    )

    expect(packets.length).toBeGreaterThan(0)
    expect(
      packets.every(
        (packet) =>
          packet.geometry.debugMeta?.geometryFamily ===
            'constrained-dashed' &&
          packet.geometry.debugMeta?.sourceTopology ===
            'sampled-simple-closed' &&
          packet.geometry.debugMeta?.resolutionStatus === 'exact-constrained'
      )
    ).toBe(true)
    expect(
      packets.every((packet) => packet.geometry.bounds.minX >= -0.001)
    ).toBe(true)
  })

  it('should run: sampled simple closed outside dashed paths emit visible selected-side packets', () => {
    const packets = buildConstrainedDashedStrokeResolvedPackets(
      'vector:test:sampled-simple-closed-outside',
      [
        { x: 0, y: 20 },
        { x: 12, y: 4 },
        { x: 32, y: 0 },
        { x: 54, y: 8 },
        { x: 66, y: 26 },
        { x: 58, y: 44 },
        { x: 36, y: 54 },
        { x: 14, y: 48 }
      ],
      true,
      [
        createDefaultStroke({
          width: 6,
          style: 'dashed',
          position: 'outside',
          joinType: 'miter',
          capType: 'butt',
          dashPattern: [14, 8],
          dashOffset: 0
        })
      ]
    )

    expect(packets.length).toBeGreaterThan(0)
    expect(
      packets.some(
        (packet) =>
          packet.geometry.bounds.minX < 0 || packet.geometry.bounds.minY < 0
      )
    ).toBe(true)
    expect(
      packets.every(
        (packet) =>
          packet.geometry.debugMeta?.sourceTopology ===
          'sampled-simple-closed'
      )
    ).toBe(true)
  })
})
