import { describe, expect, it } from 'vitest'
import {
  isPointInStrokeFillDomain,
  resolveSourcePathOrientationStrokeSide,
  resolveSourcePathStrokeSide,
  type SourcePathSideRange
} from '../components/stroke-render/stroke-side-resolution'
import type { PathGeometry } from '../components/stroke-render/path-geometry'

const distance = (
  from: { x: number; y: number },
  to: { x: number; y: number }
) => Math.hypot(to.x - from.x, to.y - from.y)

const buildLinePath = (
  points: { x: number; y: number }[],
  closed = true
): PathGeometry => {
  const segments = points.map((point, index) => {
    const next = points[(index + 1) % points.length]
    return {
      type: 'line' as const,
      start: point,
      end: next,
      length: distance(point, next)
    }
  })
  return {
    segments,
    closed,
    totalLength: segments.reduce((sum, segment) => sum + segment.length, 0),
    sampledPoints: points
  }
}

const getRanges = (path: PathGeometry): SourcePathSideRange[] => {
  let cursor = 0
  return path.segments.map((segment, segmentIndex) => {
    const range = {
      segmentIndex,
      startDistance: cursor,
      endDistance: cursor + segment.length
    }
    cursor = range.endDistance
    return range
  })
}

const getMidpointOffsetProbe = (
  path: PathGeometry,
  range: SourcePathSideRange,
  offsetDistance: number
) => {
  const segment = path.segments[range.segmentIndex]
  if (!segment || segment.type !== 'line') {
    throw new Error('Expected line segment')
  }

  const length = segment.length || 1
  const tangent = {
    x: (segment.end.x - segment.start.x) / length,
    y: (segment.end.y - segment.start.y) / length
  }
  const point = {
    x: (segment.start.x + segment.end.x) / 2,
    y: (segment.start.y + segment.end.y) / 2
  }
  return {
    x: point.x - tangent.y * offsetDistance,
    y: point.y + tangent.x * offsetDistance
  }
}

describe('stroke side resolution', () => {
  it('should run: resolve simple closed inside/outside sides from source path orientation', () => {
    const clockwisePoints = [
      { x: 10, y: 0 },
      { x: 0, y: 20 },
      { x: 30, y: 20 }
    ]
    const counterClockwisePoints = [...clockwisePoints].reverse()

    const clockwisePath = buildLinePath(clockwisePoints)
    const counterClockwisePath = buildLinePath(counterClockwisePoints)

    expect(
      resolveSourcePathOrientationStrokeSide({
        sourcePath: clockwisePath,
        topologyPoints: clockwisePoints,
        position: 'inside',
        width: 10
      })
    ).toMatchObject({
      status: 'resolved',
      selectedSide: -1,
      offsetDistance: -10
    })

    expect(
      resolveSourcePathOrientationStrokeSide({
        sourcePath: clockwisePath,
        topologyPoints: clockwisePoints,
        position: 'outside',
        width: 10
      })
    ).toMatchObject({
      status: 'resolved',
      selectedSide: 1,
      offsetDistance: 10
    })

    expect(
      resolveSourcePathOrientationStrokeSide({
        sourcePath: counterClockwisePath,
        topologyPoints: counterClockwisePoints,
        position: 'inside',
        width: 10
      })
    ).toMatchObject({
      status: 'resolved',
      selectedSide: 1,
      offsetDistance: 10
    })
  })

  it('should run: resolve self-intersecting inside dashed ranges to the fill side', () => {
    const points = [
      { x: 100, y: 0 },
      { x: 130, y: 80 },
      { x: 215, y: 85 },
      { x: 145, y: 135 },
      { x: 165, y: 220 },
      { x: 100, y: 170 },
      { x: 35, y: 220 },
      { x: 55, y: 135 },
      { x: -15, y: 85 },
      { x: 70, y: 80 }
    ]
    const path = buildLinePath(points)

    for (const range of getRanges(path)) {
      const result = resolveSourcePathStrokeSide({
        sourcePath: path,
        topologyPoints: points,
        fillRule: 'evenodd',
        position: 'inside',
        width: 10,
        range
      })

      expect(result.status, `range ${range.segmentIndex}`).toBe('resolved')
      if (result.status !== 'resolved') {
        continue
      }

      const selectedProbe = getMidpointOffsetProbe(
        path,
        range,
        result.offsetDistance
      )
      const oppositeProbe = getMidpointOffsetProbe(
        path,
        range,
        -result.offsetDistance
      )

      expect(
        isPointInStrokeFillDomain(selectedProbe, points, 'evenodd'),
        `range ${range.segmentIndex} selected side`
      ).toBe(true)
      expect(
        isPointInStrokeFillDomain(oppositeProbe, points, 'evenodd'),
        `range ${range.segmentIndex} opposite side`
      ).toBe(false)
    }
  })

  it('should run: resolve self-intersecting outside dashed ranges away from the fill side', () => {
    const points = [
      { x: 100, y: 0 },
      { x: 130, y: 80 },
      { x: 215, y: 85 },
      { x: 145, y: 135 },
      { x: 165, y: 220 },
      { x: 100, y: 170 },
      { x: 35, y: 220 },
      { x: 55, y: 135 },
      { x: -15, y: 85 },
      { x: 70, y: 80 }
    ]
    const path = buildLinePath(points)

    for (const range of getRanges(path)) {
      const result = resolveSourcePathStrokeSide({
        sourcePath: path,
        topologyPoints: points,
        fillRule: 'evenodd',
        position: 'outside',
        width: 10,
        range
      })

      expect(result.status, `range ${range.segmentIndex}`).toBe('resolved')
      if (result.status !== 'resolved') {
        continue
      }

      const selectedProbe = getMidpointOffsetProbe(
        path,
        range,
        result.offsetDistance
      )
      const oppositeProbe = getMidpointOffsetProbe(
        path,
        range,
        -result.offsetDistance
      )

      expect(
        isPointInStrokeFillDomain(selectedProbe, points, 'evenodd'),
        `range ${range.segmentIndex} selected side`
      ).toBe(false)
      expect(
        isPointInStrokeFillDomain(oppositeProbe, points, 'evenodd'),
        `range ${range.segmentIndex} opposite side`
      ).toBe(true)
    }
  })
})
