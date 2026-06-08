import { describe, expect, it } from 'vitest'
import {
  StrokeCapTypes,
  StrokeJoinTypes,
  createDefaultStroke
} from '@asyra/utils'
import { allocateDashedCenterStrokeIntervals } from '../components/stroke-render/dashed-center-stroke-intervals'
import { buildDashedCenterStrokeResolvedPackets } from '../components/stroke-render/dashed-center-stroke-packets'

interface Vec2 {
  x: number
  y: number
}

const isPointInPolygon = (point: Vec2, polygon: Vec2[]) => {
  let inside = false

  for (
    let index = 0, previous = polygon.length - 1;
    index < polygon.length;
    previous = index, index += 1
  ) {
    const current = polygon[index]
    const prior = polygon[previous]
    const intersects =
      current.y > point.y !== prior.y > point.y &&
      point.x <
        ((prior.x - current.x) * (point.y - current.y)) /
          (prior.y - current.y) +
          current.x

    if (intersects) {
      inside = !inside
    }
  }

  return inside
}

const isPointInPolygons = (point: Vec2, polygons: Vec2[][]) =>
  polygons.some((polygon) => isPointInPolygon(point, polygon))

describe('dashed center stroke scenarios', () => {
  it('should run: right-angle turn on a closed rectangle keeps corner-spanning miter dash continuity', () => {
    const packets = buildDashedCenterStrokeResolvedPackets(
      'scenario:right-angle:miter',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          style: 'dashed',
          position: 'center',
          width: 10,
          joinType: StrokeJoinTypes.MITER,
          dashPattern: [87, 20],
          dashOffset: 0
        })
      ]
    )

    expect(packets).toHaveLength(2)
    expect(
      isPointInPolygons({ x: 83, y: -3 }, packets[0]?.geometry.polygons ?? [])
    ).toBe(true)
  })

  it('should run: right-angle turn on a closed rectangle keeps bevel diagonal while cutting the outer square', () => {
    const packets = buildDashedCenterStrokeResolvedPackets(
      'scenario:right-angle:bevel',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          style: 'dashed',
          position: 'center',
          width: 10,
          joinType: StrokeJoinTypes.BEVEL,
          dashPattern: [87, 20],
          dashOffset: 0
        })
      ]
    )

    const polygons = packets[0]?.geometry.polygons ?? []
    expect(packets).toHaveLength(2)
    expect(isPointInPolygons({ x: 84, y: -4 }, polygons)).toBe(false)
    expect(isPointInPolygons({ x: 81, y: -3 }, polygons)).toBe(true)
  })

  it('should run: right-angle turn on a closed rectangle cuts away the outer-corner square beyond the bevel diagonal', () => {
    const packets = buildDashedCenterStrokeResolvedPackets(
      'scenario:right-angle:bevel-step',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          style: 'dashed',
          position: 'center',
          width: 10,
          joinType: StrokeJoinTypes.BEVEL,
          dashPattern: [87, 20],
          dashOffset: 0
        })
      ]
    )

    const polygons = packets[0]?.geometry.polygons ?? []
    expect(isPointInPolygons({ x: 84, y: -2 }, polygons)).toBe(false)
  })

  it('should run: right-angle turn on a closed rectangle keeps round join curvature without miter corner fill', () => {
    const packets = buildDashedCenterStrokeResolvedPackets(
      'scenario:right-angle:round',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          style: 'dashed',
          position: 'center',
          width: 10,
          joinType: StrokeJoinTypes.ROUND,
          dashPattern: [87, 20],
          dashOffset: 0
        })
      ]
    )

    const polygons = packets[0]?.geometry.polygons ?? []
    expect(packets).toHaveLength(2)
    expect(isPointInPolygons({ x: 83, y: -3 }, polygons)).toBe(true)
    expect(isPointInPolygons({ x: 84, y: -4 }, polygons)).toBe(false)
  })

  it('should run: open vector center dashed round caps extend each visible dash terminal without square corners', () => {
    const packets = buildDashedCenterStrokeResolvedPackets(
      'scenario:open:round-cap',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 }
      ],
      false,
      [
        createDefaultStroke({
          style: 'dashed',
          position: 'center',
          width: 10,
          capType: StrokeCapTypes.ROUND,
          dashPattern: [20, 20],
          dashOffset: 0
        })
      ]
    )

    const polygons = packets[0]?.geometry.polygons ?? []
    expect(packets).toHaveLength(2)
    expect(isPointInPolygons({ x: -4, y: 0 }, polygons)).toBe(true)
    expect(isPointInPolygons({ x: -4, y: -4 }, polygons)).toBe(false)
    expect(isPointInPolygons({ x: 14, y: 0 }, polygons)).toBe(true)
    expect(isPointInPolygons({ x: 14, y: 4 }, polygons)).toBe(false)
  })

  it('should run: right-angle turn on a vector-generated rectangle matches the shape-generated bevel corner topology', () => {
    const shapePackets = buildDashedCenterStrokeResolvedPackets(
      'scenario:right-angle:shape-bevel',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          style: 'dashed',
          position: 'center',
          width: 10,
          joinType: StrokeJoinTypes.BEVEL,
          dashPattern: [87, 20],
          dashOffset: 0
        })
      ]
    )

    const vectorPackets = buildDashedCenterStrokeResolvedPackets(
      'scenario:right-angle:vector-bevel',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          style: 'dashed',
          position: 'center',
          width: 10,
          joinType: StrokeJoinTypes.BEVEL,
          dashPattern: [87, 20],
          dashOffset: 0
        })
      ]
    )

    const probePoints = [
      { x: 84, y: -4 },
      { x: 81, y: -3 },
      { x: 84, y: 2 }
    ]

    probePoints.forEach((point) => {
      expect(
        isPointInPolygons(point, shapePackets[0]?.geometry.polygons ?? [])
      ).toBe(
        isPointInPolygons(point, vectorPackets[0]?.geometry.polygons ?? [])
      )
    })
  })

  it('should run: one canonical closed orthogonal path keeps each corner consistent with its interval relation', () => {
    const packets = buildDashedCenterStrokeResolvedPackets(
      'scenario:orthogonal:corner-relations',
      [
        { x: 0, y: 0 },
        { x: 350, y: 0 },
        { x: 350, y: 280 },
        { x: 0, y: 280 }
      ],
      true,
      [
        createDefaultStroke({
          style: 'dashed',
          position: 'center',
          width: 10,
          joinType: StrokeJoinTypes.MITER,
          dashPattern: [27, 20],
          dashOffset: 0
        })
      ]
    )

    const polygons = packets.flatMap((packet) => packet.geometry.polygons)

    expect(isPointInPolygons({ x: 353, y: 3 }, polygons)).toBe(true)
    expect(isPointInPolygons({ x: 347, y: 278 }, polygons)).toBe(true)
    expect(isPointInPolygons({ x: 3, y: 278 }, polygons)).toBe(false)
    expect(isPointInPolygons({ x: 3, y: 3 }, polygons)).toBe(true)
  })

  it('should run: one canonical closed orthogonal path keeps a short-carryover miter turn corridor visibly continuous', () => {
    const packets = buildDashedCenterStrokeResolvedPackets(
      'scenario:orthogonal:short-carryover-miter',
      [
        { x: 0, y: 0 },
        { x: 353.09, y: 0 },
        { x: 353.09, y: 276.59 },
        { x: 0, y: 276.59 }
      ],
      true,
      [
        createDefaultStroke({
          style: 'dashed',
          position: 'center',
          width: 10,
          joinType: StrokeJoinTypes.MITER,
          dashPattern: [27, 20],
          dashOffset: 0
        })
      ]
    )

    const polygons = packets.flatMap((packet) => packet.geometry.polygons)

    expect(isPointInPolygons({ x: 349, y: 4 }, polygons)).toBe(true)
    expect(isPointInPolygons({ x: 353, y: 4 }, polygons)).toBe(true)
  })

  it('should run: short post-turn dash segment produces correct miter geometry with proportionally sized body band', () => {
    const packets = buildDashedCenterStrokeResolvedPackets(
      'scenario:orthogonal:short-post-turn-miter',
      [
        { x: 0, y: 0 },
        { x: 353.09, y: 0 },
        { x: 353.09, y: 276.59 },
        { x: 0, y: 276.59 }
      ],
      true,
      [
        createDefaultStroke({
          style: 'dashed',
          position: 'center',
          width: 10,
          joinType: StrokeJoinTypes.MITER,
          dashPattern: [27, 20],
          dashOffset: 0
        })
      ]
    )

    const polygons = packets.flatMap((packet) => packet.geometry.polygons)

    // Top-right corner: miter triangle fills the outer corner area
    expect(isPointInPolygons({ x: 356, y: -2 }, polygons)).toBe(true)
    // Top-right corner: body quad covers the short post-turn segment (2.91px)
    expect(isPointInPolygons({ x: 356, y: 1 }, polygons)).toBe(true)
    // Top-right corner: inner fill triangle closes the inner corner gap
    expect(isPointInPolygons({ x: 350, y: 2 }, polygons)).toBe(true)
    // Top-right corner: y=4 is correctly absent because the dash only extends
    // 2.91px past the corner — the body band does not reach this far
    expect(isPointInPolygons({ x: 356, y: 4 }, polygons)).toBe(false)

    // Bottom-right corner: same geometry invariants hold with longer post-turn
    expect(isPointInPolygons({ x: 356, y: 274 }, polygons)).toBe(true)
    expect(isPointInPolygons({ x: 350, y: 275 }, polygons)).toBe(true)
  })

  it('should run: acute-angle open path with [20,10] uses endpoint half dashes without resetting at the corner', () => {
    const intervals = allocateDashedCenterStrokeIntervals(
      60,
      [20, 10],
      0,
      false,
      { openPathPolicy: 'network-balanced-terminals' }
    )
    const visible = intervals.filter((interval) => interval.kind === 'visible')
    const cornerDistance = 40

    expect(visible).toHaveLength(3)
    expect(visible[0]?.startDistance).toBe(0)
    expect(visible[0]?.endDistance).toBe(10)
    expect(visible[0]?.openPathTerminalRole).toBe('path-start')
    expect(visible[1]?.startDistance).toBe(20)
    expect(visible[1]?.endDistance).toBe(40)
    expect(visible[1]?.openPathTerminalRole).toBe('middle')
    expect(visible[2]?.startDistance).toBe(50)
    expect(visible[2]?.endDistance).toBe(60)
    expect(visible[2]?.openPathTerminalRole).toBe('path-end')
    expect(visible[1]?.startDistance).toBeLessThan(cornerDistance)
    expect(visible[1]?.endDistance).toBeGreaterThanOrEqual(cornerDistance)
  })

  it('should run: acute-angle open path with [27,13] keeps the balanced gap spanning the corner across the whole network', () => {
    const intervals = allocateDashedCenterStrokeIntervals(
      60,
      [27, 13],
      1,
      false,
      { openPathPolicy: 'network-balanced-terminals' }
    )
    const visible = intervals.filter((interval) => interval.kind === 'visible')
    const gap = intervals.find(
      (interval) =>
        interval.kind === 'gap' &&
        interval.startDistance === 13.5 &&
        interval.endDistance === 46.5
    )

    expect(visible).toHaveLength(2)
    expect(gap).toBeTruthy()
    expect(gap?.startDistance).toBeLessThan(30)
    expect(gap?.endDistance).toBeGreaterThan(30)
    expect(visible[1]?.startDistance).toBe(46.5)
  })

  it('should run: acute-angle open path with [40,10] keeps miter endpoint dashes separated by the network-level gap', () => {
    const packets = buildDashedCenterStrokeResolvedPackets(
      'scenario:acute:miter',
      [
        { x: 0, y: 0 },
        { x: 30, y: 0 },
        { x: 15, y: 25.980762 }
      ],
      false,
      [
        createDefaultStroke({
          style: 'dashed',
          position: 'center',
          width: 10,
          joinType: StrokeJoinTypes.MITER,
          dashPattern: [40, 10],
          dashOffset: 5
        })
      ]
    )

    const polygons = packets[0]?.geometry.polygons ?? []
    expect(packets).toHaveLength(2)
    expect(isPointInPolygons({ x: 29, y: 1 }, polygons)).toBe(false)
  })

  it('should run: acute-angle open path with [40,10] keeps bevel endpoint dashes separated by the network-level gap', () => {
    const packets = buildDashedCenterStrokeResolvedPackets(
      'scenario:acute:bevel',
      [
        { x: 0, y: 0 },
        { x: 30, y: 0 },
        { x: 15, y: 25.980762 }
      ],
      false,
      [
        createDefaultStroke({
          style: 'dashed',
          position: 'center',
          width: 10,
          joinType: StrokeJoinTypes.BEVEL,
          dashPattern: [40, 10],
          dashOffset: 5
        })
      ]
    )

    const polygons = packets[0]?.geometry.polygons ?? []
    expect(packets).toHaveLength(2)
    expect(isPointInPolygons({ x: 31, y: 2 }, polygons)).toBe(false)
  })

  it('should run: acute-angle open path with [27,13] and explicit offset keeps the corner absent when the gap spans the turn', () => {
    const packets = buildDashedCenterStrokeResolvedPackets(
      'scenario:acute:gap-span',
      [
        { x: 0, y: 0 },
        { x: 30, y: 0 },
        { x: 15, y: 25.980762 }
      ],
      false,
      [
        createDefaultStroke({
          style: 'dashed',
          position: 'center',
          width: 10,
          joinType: StrokeJoinTypes.MITER,
          dashPattern: [27, 13],
          dashOffset: 1
        })
      ]
    )

    const firstPolygons = packets[0]?.geometry.polygons ?? []
    const secondPolygons = packets[1]?.geometry.polygons ?? []

    expect(isPointInPolygons({ x: 29, y: 1 }, firstPolygons)).toBe(false)
    expect(isPointInPolygons({ x: 29, y: 1 }, secondPolygons)).toBe(false)
  })
})
