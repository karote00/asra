import { describe, expect, it } from 'vitest'
import {
  buildSolidCenterStrokeExportPackets,
  buildSolidCenterStrokeHitTestPackets,
  createSolidCenterStrokeHitArea
} from '../components/stroke-render/solid-center-stroke-packets'
import { buildConstrainedDashedStrokeResolvedPackets } from '../components/stroke-render/constrained-dashed-stroke-packets'
import {
  FillKinds,
  createDefaultGradientData,
  createDefaultStroke
} from '@asyra/utils'

describe('constrained dashed stroke packets', () => {
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

    const [resolved] = packets
    const [hit] = buildSolidCenterStrokeHitTestPackets(packets)
    const [exportPacket] = buildSolidCenterStrokeExportPackets(packets)

    expect(hit.geometryId).toBe(resolved.geometry.geometryId)
    expect(exportPacket.geometryId).toBe(resolved.geometry.geometryId)
    expect(hit.polygons).toBe(resolved.geometry.polygons)
    expect(exportPacket.polygons).toBe(resolved.geometry.polygons)
    expect(hit.bounds).toEqual(resolved.geometry.bounds)
    expect(exportPacket.bounds).toEqual(resolved.geometry.bounds)

    const hitArea = createSolidCenterStrokeHitArea(packets)
    expect(hitArea?.contains(1, 1)).toBe(true)
    expect(hitArea?.contains(10, 10)).toBe(false)
    expect(hitArea?.contains(-1, -1)).toBe(false)
  })

  it('should run: derive one inside round-join full-loop constrained dashed packet when the first Phase 5 rect slice is opted in', () => {
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
      ],
      {
        allowRectFullLoopInsideRoundJoin: true
      }
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.geometryId).toContain(':constrained-dashed:')
    expect(packets[0]?.geometry.bounds).toEqual({
      minX: 0,
      minY: 0,
      maxX: 80,
      maxY: 40
    })
  })

  it('should run: derive one outside round-join full-loop constrained dashed packet when the next Phase 5 rect outside slice is opted in', () => {
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
      ],
      {
        allowRectFullLoopOutsideRoundJoin: true
      }
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.geometryId).toContain(':constrained-dashed:')
    expect(packets[0]?.geometry.bounds).toEqual({
      minX: -6,
      minY: -6,
      maxX: 86,
      maxY: 46
    })
  })

  it('should run: derive one inside round-join full-loop constrained dashed packet on a rectangle-equivalent vector loop when the next Phase 5 vector slice is opted in', () => {
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
      ],
      {
        allowVectorRectEquivalentFullLoopInsideRoundJoin: true
      }
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.geometryId).toContain(':constrained-dashed:')
    expect(packets[0]?.geometry.bounds).toEqual({
      minX: 0,
      minY: 0,
      maxX: 80,
      maxY: 40
    })
  })

  it('should run: derive one outside round-join full-loop constrained dashed packet on a rectangle-equivalent vector loop when the next Phase 5 vector outside slice is opted in', () => {
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
      ],
      {
        allowVectorRectEquivalentFullLoopOutsideRoundJoin: true
      }
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.geometryId).toContain(':constrained-dashed:')
    expect(packets[0]?.geometry.bounds).toEqual({
      minX: -6,
      minY: -6,
      maxX: 86,
      maxY: 46
    })
  })

  it('should run: derive one outside round-join full-loop constrained dashed packet on the first broader vector loop when the next broader Phase 5 vector outside slice is opted in', () => {
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
      ],
      {
        allowFirstBroaderVectorFullLoopOutsideRoundJoin: true
      }
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.geometryId).toContain(':constrained-dashed:')
    expect(packets[0]?.geometry.bounds.minX).toBe(-6)
    expect(packets[0]?.geometry.bounds.minY).toBe(-6)
    expect(packets[0]?.geometry.bounds.maxX).toBeCloseTo(89.70820393249937, 6)
    expect(packets[0]?.geometry.bounds.maxY).toBe(46)
  })

  it('should run: keep the same constrained dashed full-loop geometry when the first Phase 6 gradient paint slice swaps paint over the promoted rect path', () => {
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

  it('should run: keep the same constrained dashed full-loop outside geometry when the next Phase 6 gradient paint slice swaps paint over the promoted rect path', () => {
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

  it('should not run: reject constrained dashed packets on open paths', () => {
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

    expect(packets).toEqual([])
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
        packet.geometry.geometryId.includes(':constrained-dashed:')
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
    expect(packets[0]?.geometry.geometryId).toContain(':constrained-dashed:')
    expect(packets[0]?.geometry.bounds).toEqual({
      minX: 20,
      minY: 0,
      maxX: 40,
      maxY: 6
    })
  })

  it('should run: keep the same constrained dashed single-edge geometry when the next Phase 6 gradient paint slice swaps paint over the promoted rect path', () => {
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

  it('should run: derive one inside single-edge round-cap constrained dashed packet when the next Phase 5 rect slice is opted in', () => {
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
      ],
      {
        allowRectSingleEdgeInsideRoundCap: true
      }
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.geometryId).toContain(':constrained-dashed:')
    expect(packets[0]?.geometry.bounds.minX).toBeCloseTo(14, 6)
    expect(packets[0]?.geometry.bounds.minY).toBe(0)
    expect(packets[0]?.geometry.bounds.maxX).toBe(46)
    expect(packets[0]?.geometry.bounds.maxY).toBe(6)
  })

  it('should run: derive one outside single-edge round-cap constrained dashed packet when the next Phase 5 rect outside slice is opted in', () => {
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
      ],
      {
        allowRectSingleEdgeOutsideRoundCap: true
      }
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.geometryId).toContain(':constrained-dashed:')
    expect(packets[0]?.geometry.bounds.minX).toBeCloseTo(14, 6)
    expect(packets[0]?.geometry.bounds.minY).toBe(-6)
    expect(packets[0]?.geometry.bounds.maxX).toBeCloseTo(46, 6)
    expect(packets[0]?.geometry.bounds.maxY).toBe(0)
  })

  it('should run: derive one inside single-edge round-cap constrained dashed packet on a rectangle-equivalent vector loop when the next Phase 5 vector slice is opted in', () => {
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
      ],
      {
        allowVectorRectEquivalentSingleEdgeInsideRoundCap: true
      }
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.geometryId).toContain(':constrained-dashed:')
    expect(packets[0]?.geometry.bounds.minX).toBeCloseTo(16, 6)
    expect(packets[0]?.geometry.bounds.minY).toBe(0)
    expect(packets[0]?.geometry.bounds.maxX).toBe(44)
    expect(packets[0]?.geometry.bounds.maxY).toBe(4)
  })

  it('should run: derive one outside single-edge round-cap constrained dashed packet on a rectangle-equivalent vector loop when the next Phase 5 vector outside slice is opted in', () => {
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
      ],
      {
        allowVectorRectEquivalentSingleEdgeOutsideRoundCap: true
      }
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.geometryId).toContain(':constrained-dashed:')
    expect(packets[0]?.geometry.bounds.minX).toBeCloseTo(16, 6)
    expect(packets[0]?.geometry.bounds.minY).toBe(-4)
    expect(packets[0]?.geometry.bounds.maxX).toBeCloseTo(44, 6)
    expect(packets[0]?.geometry.bounds.maxY).toBe(0)
  })

  it('should run: derive one inside single-edge round-cap constrained dashed packet on the first broader vector loop when the next broader Phase 5 vector slice is opted in', () => {
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
      ],
      {
        allowFirstBroaderVectorSingleEdgeInsideRoundCap: true
      }
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.geometryId).toContain(':constrained-dashed:')
    expect(packets[0]?.geometry.bounds.minX).toBeCloseTo(16, 6)
    expect(packets[0]?.geometry.bounds.minY).toBe(0)
    expect(packets[0]?.geometry.bounds.maxX).toBe(44)
    expect(packets[0]?.geometry.bounds.maxY).toBe(4)
  })

  it('should run: derive one outside single-edge round-cap constrained dashed packet on the first broader vector loop when the next broader Phase 5 vector outside slice is opted in', () => {
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
      ],
      {
        allowFirstBroaderVectorSingleEdgeOutsideRoundCap: true
      }
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.geometryId).toContain(':constrained-dashed:')
    expect(packets[0]?.geometry.bounds.minX).toBeCloseTo(16, 6)
    expect(packets[0]?.geometry.bounds.minY).toBeLessThan(-3.5)
    expect(packets[0]?.geometry.bounds.maxX).toBeCloseTo(44, 6)
    expect(packets[0]?.geometry.bounds.maxY).toBeGreaterThan(-0.5)
  })

  it('should run: derive one inside round-join full-loop constrained dashed packet on the first broader vector loop when the next broader Phase 5 vector slice is opted in', () => {
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
      ],
      {
        allowFirstBroaderVectorFullLoopInsideRoundJoin: true
      }
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.geometryId).toContain(':constrained-dashed:')
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
    expect(packets[0]?.geometry.geometryId).toContain(':constrained-dashed:')
    expect(packets[0]?.geometry.bounds).toEqual({
      minX: 20,
      minY: -6,
      maxX: 40,
      maxY: 0
    })
  })

  it('should run: derive one outside bevel corner-spanning constrained dashed packet when the next Family C rect slice is opted in', () => {
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
      ],
      {
        allowRectCornerSpanningOutsideBevel: true
      }
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.geometryId).toContain(':constrained-dashed:')
    expect(packets[0]?.geometry.bounds).toEqual({
      minX: 60,
      minY: -6,
      maxX: 86,
      maxY: 20
    })
  })

  it('should run: keep the same constrained dashed outside bevel corner-spanning geometry when the next Phase 6 corner-spanning outside-gradient slice swaps paint over the promoted rect path', () => {
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
      ],
      {
        allowRectCornerSpanningOutsideBevel: true
      }
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
      ],
      {
        allowRectCornerSpanningOutsideBevel: true
      }
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

  it('should run: derive one outside miter corner-spanning constrained dashed packet when the matching outside Family C slice is opted in', () => {
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
      ],
      {
        allowRectCornerSpanningOutsideBevel: true,
        allowRectCornerSpanningOutsideMiter: true
      }
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.geometryId).toContain(':constrained-dashed:')
    expect(packets[0]?.geometry.bounds).toEqual({
      minX: 60,
      minY: -6,
      maxX: 86,
      maxY: 20
    })
  })

  it('should run: derive one outside round corner-spanning constrained dashed packet on the uniform-width Family C product path', () => {
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
      ],
      {
        allowRectCornerSpanningOutsideBevel: true,
        allowRectCornerSpanningOutsideMiter: true
      }
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.geometryId).toContain(':constrained-dashed:')
    expect(packets[0]?.geometry.bounds).toEqual({
      minX: 60,
      minY: -6,
      maxX: 86,
      maxY: 20
    })
  })

  it('should run: derive one inside bevel corner-spanning constrained dashed packet when the first Family C rect slice is opted in', () => {
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
      ],
      {
        allowRectCornerSpanningInsideBevel: true
      }
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.geometryId).toContain(':constrained-dashed:')
    expect(packets[0]?.geometry.bounds).toEqual({
      minX: 60,
      minY: 0,
      maxX: 80,
      maxY: 20
    })
  })

  it('should run: derive one inside miter corner-spanning constrained dashed packet when the second Family C rect slice is opted in', () => {
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
      ],
      {
        allowRectCornerSpanningInsideBevel: true,
        allowRectCornerSpanningInsideMiter: true
      }
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.geometryId).toContain(':constrained-dashed:')
    expect(packets[0]?.geometry.bounds).toEqual({
      minX: 60,
      minY: 0,
      maxX: 80,
      maxY: 20
    })
  })

  it('should run: derive one inside round corner-spanning constrained dashed packet on the uniform-width Family C product path', () => {
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
      ],
      {
        allowRectCornerSpanningInsideBevel: true,
        allowRectCornerSpanningInsideMiter: true
      }
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.geometryId).toContain(':constrained-dashed:')
    expect(packets[0]?.geometry.bounds).toEqual({
      minX: 60,
      minY: 0,
      maxX: 80,
      maxY: 20
    })
  })

  it('should run: keep the same constrained dashed inside bevel corner-spanning geometry when the first Phase 6 corner-spanning gradient slice swaps paint over the promoted rect path', () => {
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
      ],
      {
        allowRectCornerSpanningInsideBevel: true
      }
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
      ],
      {
        allowRectCornerSpanningInsideBevel: true
      }
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

  it('should run: derive one broader non-rectangle-equivalent inside bevel corner-spanning constrained dashed packet when the first broader vector Family C slice is opted in', () => {
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
      ],
      {
        allowFirstBroaderVectorCornerSpanningInsideBevel: true
      }
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.geometryId).toContain(':constrained-dashed:')
    expect(packets[0]?.geometry.bounds.minY).toBe(0)
    expect(packets[0]?.geometry.bounds.maxX).toBe(80)
    expect(packets[0]?.geometry.bounds.minX).toBeGreaterThan(48)
    expect(packets[0]?.geometry.bounds.minX).toBeLessThan(70)
    expect(packets[0]?.geometry.bounds.maxY).toBeGreaterThan(12)
    expect(packets[0]?.geometry.bounds.maxY).toBeLessThan(28)
  })

  it('should run: derive one broader non-rectangle-equivalent inside miter corner-spanning constrained dashed packet when the matching broader vector Family C slice is opted in', () => {
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
      ],
      {
        allowFirstBroaderVectorCornerSpanningInsideBevel: true,
        allowFirstBroaderVectorCornerSpanningInsideMiter: true
      }
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.geometryId).toContain(':constrained-dashed:')
    expect(packets[0]?.geometry.bounds.minY).toBe(0)
    expect(packets[0]?.geometry.bounds.maxX).toBe(80)
    expect(packets[0]?.geometry.bounds.minX).toBeGreaterThan(48)
    expect(packets[0]?.geometry.bounds.minX).toBeLessThan(70)
    expect(packets[0]?.geometry.bounds.maxY).toBeGreaterThan(12)
    expect(packets[0]?.geometry.bounds.maxY).toBeLessThan(28)
  })

  it('should run: derive one broader non-rectangle-equivalent outside bevel corner-spanning constrained dashed packet when the next broader vector Family C slice is opted in', () => {
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
      ],
      {
        allowFirstBroaderVectorCornerSpanningInsideBevel: true,
        allowFirstBroaderVectorCornerSpanningInsideMiter: true,
        allowFirstBroaderVectorCornerSpanningOutsideBevel: true
      }
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.geometryId).toContain(':constrained-dashed:')
    expect(packets[0]?.geometry.bounds.minY).toBeLessThan(0)
    expect(packets[0]?.geometry.bounds.maxX).toBeGreaterThan(80)
    expect(packets[0]?.geometry.bounds.minX).toBeGreaterThan(48)
    expect(packets[0]?.geometry.bounds.minX).toBeLessThan(70)
    expect(packets[0]?.geometry.bounds.maxY).toBeGreaterThan(16)
    expect(packets[0]?.geometry.bounds.maxY).toBeLessThan(32)
  })

  it('should run: derive one broader non-rectangle-equivalent outside miter corner-spanning constrained dashed packet when the matching broader vector Family C slice is opted in', () => {
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
      ],
      {
        allowFirstBroaderVectorCornerSpanningInsideBevel: true,
        allowFirstBroaderVectorCornerSpanningInsideMiter: true,
        allowFirstBroaderVectorCornerSpanningOutsideBevel: true,
        allowFirstBroaderVectorCornerSpanningOutsideMiter: true
      }
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.geometryId).toContain(':constrained-dashed:')
    expect(packets[0]?.geometry.bounds.minY).toBeLessThan(0)
    expect(packets[0]?.geometry.bounds.maxX).toBeGreaterThan(80)
    expect(packets[0]?.geometry.bounds.minX).toBeGreaterThan(48)
    expect(packets[0]?.geometry.bounds.minX).toBeLessThan(70)
    expect(packets[0]?.geometry.bounds.maxY).toBeGreaterThan(16)
    expect(packets[0]?.geometry.bounds.maxY).toBeLessThan(32)
  })
})
