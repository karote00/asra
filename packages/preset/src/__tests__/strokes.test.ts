import { describe, expect, it } from 'vitest'
import type { VectorNetwork, VectorPointNode, VectorSegment } from '@asyra/core'
import {
  StrokePositions,
  StrokeStyles,
  createDefaultStroke
} from '@asyra/utils'
import {
  buildDashedStrokeDebugParts,
  buildStrokeHitSegments,
  getRenderableStrokes,
  renderPolylineStrokes
} from '../components/strokes'

type Instruction =
  | { action: 'beginPath' }
  | { action: 'moveTo' | 'lineTo'; x: number; y: number }
  | { action: 'closePath' }
  | { action: 'stroke'; value: unknown }
  | { action: 'fill'; value: unknown }

class FakeGraphic {
  children: FakeGraphic[] = []
  instructions: Instruction[] = []
  mask: unknown = null
  inverseMask = false
  visible = true
  renderable = true

  clear() {
    this.instructions = []
  }

  beginPath() {
    this.instructions.push({ action: 'beginPath' })
  }

  moveTo(x: number, y: number) {
    this.instructions.push({ action: 'moveTo', x, y })
  }

  lineTo(x: number, y: number) {
    this.instructions.push({ action: 'lineTo', x, y })
  }

  closePath() {
    this.instructions.push({ action: 'closePath' })
  }

  stroke(value: unknown) {
    this.instructions.push({ action: 'stroke', value })
  }

  fill(value?: unknown) {
    this.instructions.push({ action: 'fill', value })
  }

  addChild(child: FakeGraphic) {
    this.children.push(child)
    return child
  }

  setMask(options: { mask: unknown; inverse?: boolean }) {
    this.mask = options.mask
    this.inverseMask = Boolean(options.inverse)
  }
}

const getPathPoints = (instructions: Instruction[]) =>
  instructions
    .filter(
      (
        instruction
      ): instruction is Extract<Instruction, { action: 'moveTo' | 'lineTo' }> =>
        instruction.action === 'moveTo' || instruction.action === 'lineTo'
    )
    .map(({ x, y }) => ({ x, y }))

const cubicBezierPoint = (
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number
) => {
  const u = 1 - t
  const tt = t * t
  const uu = u * u
  const uuu = uu * u
  const ttt = tt * t

  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y
  }
}

const estimateCurveLength = (
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number }
) =>
  Math.hypot(p1.x - p0.x, p1.y - p0.y) +
  Math.hypot(p2.x - p1.x, p2.y - p1.y) +
  Math.hypot(p3.x - p2.x, p3.y - p2.y)

const getFlattenStepsForTarget = (
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  targetSegmentLength: number,
  minSteps: number,
  maxSteps: number
) => {
  const length = estimateCurveLength(p0, p1, p2, p3)
  return Math.max(
    minSteps,
    Math.min(maxSteps, Math.ceil(length / targetSegmentLength))
  )
}

const getStrokeFlattenSteps = (
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number }
) => getFlattenStepsForTarget(p0, p1, p2, p3, 4, 24, 256)

const flattenCubic = (
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  steps: number
) => {
  const points = [p0]
  for (let i = 1; i <= steps; i += 1) {
    points.push(cubicBezierPoint(p0, p1, p2, p3, i / steps))
  }
  return points
}

const getAnchorNode = (
  points: Record<string, VectorPointNode>,
  pointId: string | undefined
) => {
  if (!pointId) {
    return null
  }

  const point = points[pointId]
  if (!point || point.kind !== 'anchor') {
    return null
  }

  return point
}

const getControlNode = (
  points: Record<string, VectorPointNode>,
  pointId?: string | null
) => {
  if (!pointId) {
    return null
  }

  const point = points[pointId]
  if (!point || point.kind !== 'control') {
    return null
  }

  return point
}

const buildVectorNetworkPolyline = (
  network: VectorNetwork,
  points: Record<string, VectorPointNode>,
  segments: Record<string, VectorSegment>
) => {
  const first = getAnchorNode(points, network.pointIds[0])
  if (!first) {
    return []
  }

  const polyline = [{ x: first.x, y: first.y }]

  network.segmentIds.forEach((segmentId) => {
    const segment = segments[segmentId]
    if (!segment) {
      return
    }

    const start = getAnchorNode(points, segment.startId)
    const end = getAnchorNode(points, segment.endId)
    if (!start || !end) {
      return
    }

    const outControl = getControlNode(points, segment.outControlId)
    const inControl = getControlNode(points, segment.inControlId)
    if (!outControl && !inControl) {
      polyline.push({ x: end.x, y: end.y })
      return
    }

    const flattenedCurve = flattenCubic(
      { x: start.x, y: start.y },
      outControl
        ? { x: outControl.x, y: outControl.y }
        : { x: start.x, y: start.y },
      inControl ? { x: inControl.x, y: inControl.y } : { x: end.x, y: end.y },
      { x: end.x, y: end.y },
      getStrokeFlattenSteps(
        { x: start.x, y: start.y },
        outControl
          ? { x: outControl.x, y: outControl.y }
          : { x: start.x, y: start.y },
        inControl ? { x: inControl.x, y: inControl.y } : { x: end.x, y: end.y },
        { x: end.x, y: end.y }
      )
    )

    flattenedCurve.slice(1).forEach((point) => {
      polyline.push(point)
    })
  })

  return polyline
}

describe('stroke renderer', () => {
  it('renders one filled geometry for a straight dashed part', () => {
    const graphic = new FakeGraphic()

    renderPolylineStrokes(
      graphic,
      [
        {
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 0 }
          ],
          closed: false
        }
      ],
      [
        createDefaultStroke({
          style: StrokeStyles.DASHED,
          width: 2,
          dash: 20,
          gap: 100
        })
      ]
    )

    expect(
      graphic.instructions.filter(({ action }) => action === 'stroke')
    ).toEqual([])
    expect(
      graphic.instructions.filter(({ action }) => action === 'fill')
    ).toHaveLength(1)

    const pathPoints = getPathPoints(graphic.instructions)
    expect(pathPoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ x: 0, y: 1 }),
        expect.objectContaining({ x: 10, y: 1 }),
        expect.objectContaining({ x: 10, y: -1 }),
        expect.objectContaining({ x: 0, y: -1 })
      ])
    )
  })

  it('renders one filled geometry for a dashed part spanning a corner', () => {
    const graphic = new FakeGraphic()

    renderPolylineStrokes(
      graphic,
      [
        {
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 }
          ],
          closed: false
        }
      ],
      [
        createDefaultStroke({
          style: StrokeStyles.DASHED,
          width: 2,
          dash: 12,
          gap: 100
        })
      ]
    )

    expect(
      graphic.instructions.filter(({ action }) => action === 'stroke')
    ).toEqual([])
    expect(
      graphic.instructions.filter(({ action }) => action === 'fill')
    ).toHaveLength(1)

    const pathPoints = getPathPoints(graphic.instructions)
    expect(pathPoints.length).toBeGreaterThanOrEqual(8)
    expect(pathPoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ x: 0, y: 1 }),
        expect.objectContaining({ x: 11, y: -1 }),
        expect.objectContaining({ x: 10, y: 5 })
      ])
    )
  })

  it('keeps short dashed parts on bezier curves sampled with intermediate points', () => {
    const network = {
      id: 'tn-curve',
      pointIds: ['p0', 'p1'],
      segmentIds: ['s0'],
      closed: false
    } satisfies VectorNetwork
    const points = {
      p0: { id: 'p0', kind: 'anchor', x: 0, y: 0, anchorType: 'smooth' },
      p1: { id: 'p1', kind: 'anchor', x: 120, y: 0, anchorType: 'smooth' },
      'p0:out': {
        id: 'p0:out',
        kind: 'control',
        x: 30,
        y: 80,
        controlForId: 'p0',
        controlRole: 'out'
      },
      'p1:in': {
        id: 'p1:in',
        kind: 'control',
        x: 90,
        y: -80,
        controlForId: 'p1',
        controlRole: 'in'
      }
    } satisfies Record<string, VectorPointNode>
    const segments = {
      s0: {
        id: 's0',
        startId: 'p0',
        endId: 'p1',
        outControlId: 'p0:out',
        inControlId: 'p1:in'
      }
    } satisfies Record<string, VectorSegment>

    const polyline = buildVectorNetworkPolyline(network, points, segments)
    const [stroke] = getRenderableStrokes([
      createDefaultStroke({
        style: StrokeStyles.DASHED,
        width: 8,
        dash: 4,
        gap: 40
      })
    ])

    const debugParts = buildDashedStrokeDebugParts(polyline, false, stroke)
    expect(debugParts.length).toBeGreaterThan(0)
    expect(debugParts[0].sourcePoints.length).toBeGreaterThan(2)
    expect(debugParts[0].renderPoints.length).toBeGreaterThan(2)
  })

  it('offsets closed stroke centerlines for inside and outside positions', () => {
    const graphic = new FakeGraphic()

    renderPolylineStrokes(
      graphic,
      [
        {
          points: [
            { x: 0, y: 0 },
            { x: 20, y: 0 },
            { x: 20, y: 20 },
            { x: 0, y: 20 }
          ],
          closed: true
        }
      ],
      [
        createDefaultStroke({
          position: StrokePositions.INSIDE,
          width: 10
        }),
        createDefaultStroke({
          position: StrokePositions.OUTSIDE,
          width: 10
        })
      ]
    )

    expect(graphic.instructions).toEqual([
      { action: 'beginPath' },
      { action: 'moveTo', x: -5, y: -5 },
      { action: 'lineTo', x: 25, y: -5 },
      { action: 'lineTo', x: 25, y: 25 },
      { action: 'lineTo', x: -5, y: 25 },
      { action: 'closePath' },
      {
        action: 'stroke',
        value: expect.objectContaining({
          width: 10
        })
      }
    ])
    expect(graphic.children).toHaveLength(3)

    const [maskGraphic, insideGraphic, outsideGraphic] = graphic.children
    expect(
      maskGraphic.instructions[maskGraphic.instructions.length - 1]
    ).toEqual({
      action: 'fill',
      value: 0xffffff
    })
    expect(insideGraphic.mask).toBe(maskGraphic)
    expect(outsideGraphic.inverseMask).toBe(true)
    expect(insideGraphic.instructions).toEqual([
      { action: 'beginPath' },
      { action: 'moveTo', x: 5, y: 5 },
      { action: 'lineTo', x: 15, y: 5 },
      { action: 'lineTo', x: 15, y: 15 },
      { action: 'lineTo', x: 5, y: 15 },
      { action: 'closePath' },
      {
        action: 'stroke',
        value: expect.objectContaining({
          width: 10
        })
      }
    ])
    expect(outsideGraphic.instructions).toEqual([])
  })

  it('splits centered closed strokes across inside and outside overlays', () => {
    const graphic = new FakeGraphic()

    renderPolylineStrokes(
      graphic,
      [
        {
          points: [
            { x: 0, y: 0 },
            { x: 20, y: 0 },
            { x: 20, y: 20 },
            { x: 0, y: 20 }
          ],
          closed: true
        }
      ],
      [
        createDefaultStroke({
          position: StrokePositions.CENTER,
          width: 10
        })
      ]
    )

    expect(graphic.instructions).toEqual([])
    expect(graphic.children).toHaveLength(3)

    const [maskGraphic, insideGraphic, outsideGraphic] = graphic.children
    expect(insideGraphic.mask).toBe(maskGraphic)
    expect(outsideGraphic.inverseMask).toBe(true)
    expect(insideGraphic.instructions).toEqual([
      { action: 'beginPath' },
      { action: 'moveTo', x: 0, y: 0 },
      { action: 'lineTo', x: 20, y: 0 },
      { action: 'lineTo', x: 20, y: 20 },
      { action: 'lineTo', x: 0, y: 20 },
      { action: 'closePath' },
      {
        action: 'stroke',
        value: expect.objectContaining({
          width: 10
        })
      }
    ])
    expect(outsideGraphic.instructions).toEqual(insideGraphic.instructions)
  })

  it('builds hit segments from the rendered outside stroke geometry', () => {
    const hitSegments = buildStrokeHitSegments(
      [
        {
          points: [
            { x: 0, y: 0 },
            { x: 20, y: 0 },
            { x: 20, y: 20 },
            { x: 0, y: 20 }
          ],
          closed: true
        }
      ],
      [
        createDefaultStroke({
          position: StrokePositions.OUTSIDE,
          width: 10
        })
      ]
    )

    expect(hitSegments).toEqual([
      {
        kind: 'segment',
        start: { x: -5, y: -5 },
        end: { x: 25, y: -5 },
        radius: 5
      },
      {
        kind: 'segment',
        start: { x: 25, y: -5 },
        end: { x: 25, y: 25 },
        radius: 5
      },
      {
        kind: 'segment',
        start: { x: 25, y: 25 },
        end: { x: -5, y: 25 },
        radius: 5
      },
      {
        kind: 'segment',
        start: { x: -5, y: 25 },
        end: { x: -5, y: -5 },
        radius: 5
      }
    ])
  })

  it('builds polygon hit geometry for dashed parts', () => {
    const hitSegments = buildStrokeHitSegments(
      [
        {
          points: [
            { x: 0, y: 0 },
            { x: 12, y: 0 }
          ],
          closed: false
        },
        {
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 }
          ],
          closed: false
        }
      ],
      [
        createDefaultStroke({
          style: StrokeStyles.DASHED,
          width: 2,
          dash: 12,
          gap: 100
        })
      ]
    )

    expect(hitSegments).toHaveLength(2)
    hitSegments.forEach((segment) => {
      expect(segment.kind).toBe('polygon')
      expect(segment.points).toBeDefined()
      expect((segment.points ?? []).length).toBeGreaterThanOrEqual(3)
    })
  })

  it('clips inside dashed corner geometry to the true segment wedge', () => {
    const graphic = new FakeGraphic()

    renderPolylineStrokes(
      graphic,
      [
        {
          points: [
            { x: 0, y: 0 },
            { x: 40, y: 0 },
            { x: 0, y: 40 }
          ],
          closed: true
        }
      ],
      [
        createDefaultStroke({
          style: StrokeStyles.DASHED,
          position: StrokePositions.INSIDE,
          width: 10,
          dash: 60,
          gap: 100,
          opacity: 0.5
        })
      ]
    )

    const [maskGraphic, insideGraphic] = graphic.children
    expect(maskGraphic).toBeDefined()
    expect(insideGraphic).toBeDefined()
    expect(
      insideGraphic.instructions.filter(({ action }) => action === 'fill')
    ).toHaveLength(1)
    expect(
      insideGraphic.instructions.filter(({ action }) => action === 'stroke')
    ).toEqual([])

    const polygon = getPathPoints(insideGraphic.instructions)
    expect(polygon.length).toBeGreaterThan(4)

    polygon.forEach((point) => {
      expect(point.y).toBeGreaterThanOrEqual(-1e-4)
      expect(point.x + point.y).toBeLessThanOrEqual(40 + 1e-4)
    })
  })
})
