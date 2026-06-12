import { describe, expect, it } from 'vitest'
import {
  StrokeCapTypes,
  StrokeJoinTypes,
  createDefaultStroke
} from '@asyra/utils'
import { buildConstrainedDashedStrokeResolvedPackets } from '../components/stroke-render/constrained-dashed-stroke-packets'
import { buildConstrainedSolidStrokeResolvedPackets } from '../components/stroke-render/constrained-solid-stroke-packets'
import { buildDashedCenterStrokeResolvedPackets } from '../components/stroke-render/dashed-center-stroke-packets'
import { buildPathTopologyModel } from '../components/stroke-render/path-topology-model'
import { buildSolidCenterStrokeResolvedPackets } from '../components/stroke-render/solid-center-stroke-packets'

interface Vec2 {
  x: number
  y: number
}

const FRAME_COUNT = 300
const WARMUP_FRAMES = 20
const TARGET_OPERATIONS_PER_SECOND = 120
const FLOOR_OPERATIONS_PER_SECOND = 60
const FLOOR_OPERATION_MS = 1000 / FLOOR_OPERATIONS_PER_SECOND

const solidStroke = createDefaultStroke({
  width: 4,
  style: 'solid',
  position: 'inside',
  joinType: StrokeJoinTypes.ROUND,
  capType: StrokeCapTypes.ROUND
})

const solidOpenCenterStroke = createDefaultStroke({
  width: 4,
  style: 'solid',
  position: 'center',
  joinType: StrokeJoinTypes.ROUND,
  capType: StrokeCapTypes.ROUND
})

const dashedStroke = createDefaultStroke({
  width: 4,
  style: 'dashed',
  position: 'inside',
  joinType: StrokeJoinTypes.ROUND,
  capType: StrokeCapTypes.ROUND,
  dashPattern: [18, 10],
  dashOffset: 0
})

const dashedOpenCenterStroke = createDefaultStroke({
  width: 4,
  style: 'dashed',
  position: 'center',
  joinType: StrokeJoinTypes.ROUND,
  capType: StrokeCapTypes.ROUND,
  dashPattern: [18, 10],
  dashOffset: 0
})

const q8DashedOpenCenterStroke = createDefaultStroke({
  width: 4,
  style: 'dashed',
  position: 'center',
  joinType: StrokeJoinTypes.ROUND,
  capType: StrokeCapTypes.ROUND,
  dashPattern: [10, 6],
  dashOffset: 0
})

const q8DashedStroke = createDefaultStroke({
  width: 4,
  style: 'dashed',
  position: 'outside',
  joinType: StrokeJoinTypes.ROUND,
  capType: StrokeCapTypes.ROUND,
  dashPattern: [10, 6],
  dashOffset: 0
})

const getPercentile = (values: number[], percentile: number) => {
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * percentile) - 1)
  )
  return sorted[index] ?? 0
}

const measureFrames = (runFrame: (frame: number) => void) => {
  const frameTimes: number[] = []
  const start = performance.now()

  for (let frame = 0; frame < FRAME_COUNT; frame += 1) {
    const frameStart = performance.now()
    runFrame(frame)
    const frameEnd = performance.now()

    if (frame >= WARMUP_FRAMES) {
      frameTimes.push(frameEnd - frameStart)
    }
  }

  const totalMs = performance.now() - start
  const measuredFrameCount = FRAME_COUNT - WARMUP_FRAMES
  const measuredMs = frameTimes.reduce((total, value) => total + value, 0)

  return {
    averageOperationsPerSecond: measuredFrameCount / (measuredMs / 1000),
    totalOperationsPerSecond: FRAME_COUNT / (totalMs / 1000),
    p95OperationMs: getPercentile(frameTimes, 0.95)
  }
}

const buildMovingOpenPoints = (frame: number, count: number): Vec2[] => {
  const phase = frame / 18
  return Array.from({ length: count }, (_, index) => ({
    x: index * 4,
    y: 40 + Math.sin(index * 0.18 + phase) * 8
  }))
}

const sampleCubic = (
  frame: number,
  p0: Vec2,
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  count: number
): Vec2[] => {
  const movingP1 = {
    x: p1.x + Math.sin(frame / 11) * 12,
    y: p1.y + Math.cos(frame / 9) * 10
  }
  const movingP2 = {
    x: p2.x + Math.cos(frame / 13) * 10,
    y: p2.y + Math.sin(frame / 7) * 12
  }

  return Array.from({ length: count }, (_, index) => {
    const t = index / (count - 1)
    const inv = 1 - t
    return {
      x:
        inv ** 3 * p0.x +
        3 * inv ** 2 * t * movingP1.x +
        3 * inv * t ** 2 * movingP2.x +
        t ** 3 * p3.x,
      y:
        inv ** 3 * p0.y +
        3 * inv ** 2 * t * movingP1.y +
        3 * inv * t ** 2 * movingP2.y +
        t ** 3 * p3.y
    }
  })
}

const buildDisjointNetworkPoints = (frame: number, networkIndex: number) => {
  const offsetX = networkIndex * 80 + Math.sin(frame / 20 + networkIndex) * 2
  const offsetY = Math.cos(frame / 18 + networkIndex) * 2
  return [
    { x: offsetX, y: offsetY },
    { x: offsetX + 40, y: offsetY },
    { x: offsetX + 40, y: offsetY + 40 },
    { x: offsetX, y: offsetY + 40 }
  ]
}

const buildSelfIntersectingStarPoints = (
  frame: number,
  index: number
): Vec2[] => {
  const center = {
    x: (index % 4) * 84 + Math.sin(frame / 32 + index) * 0.8,
    y: Math.floor(index / 4) * 84 + Math.cos(frame / 29 + index) * 0.8
  }
  const radius = 34
  const outerPoints = Array.from({ length: 5 }, (_, pointIndex) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * pointIndex) / 5
    return {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius
    }
  })

  return [0, 2, 4, 1, 3].map((pointIndex) => outerPoints[pointIndex])
}

const buildQ8SinePoints = (frame: number, offsetX: number, offsetY: number) => {
  const phase = frame / 24
  return Array.from({ length: 72 }, (_, index) => ({
    x: offsetX + index * 6,
    y: offsetY + Math.sin(index * 0.24 + phase) * 28
  }))
}

const buildQ8RectPoints = (frame: number, index: number) => {
  const x = index * 14 + Math.sin(frame / 30 + index) * 0.6
  const y = 120 + Math.cos(frame / 28 + index) * 0.6
  return [
    { x, y },
    { x: x + 10, y },
    { x: x + 10, y: y + 8 },
    { x, y: y + 8 }
  ]
}

const Q8_POLYGON_TEMPLATES: Vec2[][] = [
  [
    { x: 0, y: 8 },
    { x: 10, y: 0 },
    { x: 24, y: 4 },
    { x: 32, y: 17 },
    { x: 26, y: 30 },
    { x: 12, y: 34 },
    { x: 2, y: 25 }
  ],
  [
    { x: 0, y: 14 },
    { x: 8, y: 2 },
    { x: 22, y: 0 },
    { x: 35, y: 11 },
    { x: 32, y: 27 },
    { x: 17, y: 34 },
    { x: 4, y: 28 }
  ],
  [
    { x: 0, y: 18 },
    { x: 10, y: 6 },
    { x: 18, y: 0 },
    { x: 34, y: 10 },
    { x: 37, y: 26 },
    { x: 20, y: 36 },
    { x: 5, y: 30 }
  ],
  [
    { x: 0, y: 9 },
    { x: 12, y: 0 },
    { x: 28, y: 5 },
    { x: 34, y: 19 },
    { x: 23, y: 34 },
    { x: 8, y: 29 }
  ],
  [
    { x: 0, y: 12 },
    { x: 9, y: 0 },
    { x: 25, y: 3 },
    { x: 35, y: 17 },
    { x: 30, y: 31 },
    { x: 14, y: 35 },
    { x: 3, y: 25 }
  ],
  [
    { x: 0, y: 16 },
    { x: 12, y: 8 },
    { x: 23, y: 0 },
    { x: 36, y: 13 },
    { x: 35, y: 31 },
    { x: 18, y: 37 },
    { x: 3, y: 28 }
  ],
  [
    { x: 0, y: 20 },
    { x: 8, y: 2 },
    { x: 14, y: 0 },
    { x: 17, y: 14 },
    { x: 35, y: 18 },
    { x: 35, y: 32 },
    { x: 15, y: 36 },
    { x: 3, y: 29 }
  ],
  [
    { x: 0, y: 27 },
    { x: 10, y: 6 },
    { x: 24, y: 0 },
    { x: 31, y: 17 },
    { x: 42, y: 31 },
    { x: 23, y: 39 },
    { x: 4, y: 34 }
  ],
  [
    { x: 0, y: 12 },
    { x: 20, y: 0 },
    { x: 22, y: 10 },
    { x: 36, y: 22 },
    { x: 26, y: 32 },
    { x: 15, y: 29 },
    { x: 9, y: 40 },
    { x: 0, y: 34 }
  ],
  [
    { x: 0, y: 19 },
    { x: 18, y: 15 },
    { x: 14, y: 0 },
    { x: 40, y: 0 },
    { x: 40, y: 14 },
    { x: 24, y: 17 },
    { x: 28, y: 33 },
    { x: 10, y: 24 }
  ]
]

const buildQ8PolygonPoints = (frame: number, index: number) => {
  const template = Q8_POLYGON_TEMPLATES[index % Q8_POLYGON_TEMPLATES.length]
  const x = (index % 5) * 52 + Math.sin(frame / 34 + index) * 0.5
  const y =
    160 + Math.floor(index / 5) * 58 + Math.cos(frame / 31 + index) * 0.5
  return template.map((point) => ({ x: x + point.x, y: y + point.y }))
}

const assertPerformanceContract = (metrics: {
  averageOperationsPerSecond: number
  p95OperationMs: number
}) => {
  expect(metrics.averageOperationsPerSecond).toBeGreaterThanOrEqual(
    TARGET_OPERATIONS_PER_SECOND
  )
  expect(metrics.p95OperationMs).toBeLessThanOrEqual(FLOOR_OPERATION_MS)
}

describe('stroke performance contract', () => {
  it('should run: keep 100 moving open points above the declared operation target and floor', () => {
    let invalidFrameCount = 0
    const metrics = measureFrames((frame) => {
      const points = buildMovingOpenPoints(frame, 100)
      const topology = buildPathTopologyModel({
        pathId: 'benchmark:100-point-open',
        sourceId: 'benchmark:100-point-open',
        networkId: 'network-0',
        sourceFamily: 'vector',
        points,
        closed: false
      })

      const solidPackets = buildSolidCenterStrokeResolvedPackets(
        'benchmark:100-point-open:solid',
        points,
        false,
        [solidOpenCenterStroke],
        { topology }
      )
      const dashedPackets = buildDashedCenterStrokeResolvedPackets(
        'benchmark:100-point-open:dashed',
        points,
        false,
        [dashedOpenCenterStroke],
        { topology }
      )

      if (
        topology.topologyFamily !== 'open' ||
        solidPackets.length === 0 ||
        dashedPackets.length === 0
      ) {
        invalidFrameCount += 1
      }
    })

    expect(invalidFrameCount).toBe(0)
    assertPerformanceContract(metrics)
  })

  it('should run: keep a high-curvature cubic edit loop above the declared performance floor', () => {
    let invalidFrameCount = 0
    const metrics = measureFrames((frame) => {
      const points = sampleCubic(
        frame,
        { x: 0, y: 40 },
        { x: 30, y: -40 },
        { x: 90, y: 120 },
        { x: 120, y: 40 },
        48
      )
      const topology = buildPathTopologyModel({
        pathId: 'benchmark:high-curvature-cubic',
        sourceId: 'benchmark:high-curvature-cubic',
        networkId: 'network-0',
        sourceFamily: 'vector',
        points,
        closed: false
      })
      const packets = buildDashedCenterStrokeResolvedPackets(
        'benchmark:high-curvature-cubic:dashed',
        points,
        false,
        [dashedOpenCenterStroke],
        { topology }
      )

      if (topology.topologyFamily !== 'open' || packets.length === 0) {
        invalidFrameCount += 1
      }
    })

    expect(invalidFrameCount).toBe(0)
    assertPerformanceContract(metrics)
  })

  it('should run: build exactly one topology per network on a multi-network animation workload', () => {
    let topologyBuildCount = 0
    let invalidFrameCount = 0
    const networkCount = 3
    const metrics = measureFrames((frame) => {
      for (
        let networkIndex = 0;
        networkIndex < networkCount;
        networkIndex += 1
      ) {
        const points = buildDisjointNetworkPoints(frame, networkIndex)
        const topology = buildPathTopologyModel({
          pathId: `benchmark:multi-network:${networkIndex}`,
          sourceId: 'benchmark:multi-network',
          networkId: `network-${networkIndex}`,
          sourceFamily: 'vector',
          points,
          closed: true
        })
        topologyBuildCount += 1

        const packets = buildConstrainedSolidStrokeResolvedPackets(
          `benchmark:multi-network:${networkIndex}:solid`,
          points,
          true,
          [solidStroke],
          { topology }
        )

        if (
          topology.topologyFamily !== 'rectangle-equivalent' ||
          packets.length !== 1
        ) {
          invalidFrameCount += 1
        }
      }
    })

    expect(topologyBuildCount).toBe(FRAME_COUNT * networkCount)
    expect(invalidFrameCount).toBe(0)
    assertPerformanceContract(metrics)
  })

  it('should run: keep the Q8 reference fixture workload above the declared performance floor', () => {
    let topologyBuildCount = 0
    let invalidFrameCount = 0
    const sourceCount = 32
    const metrics = measureFrames((frame) => {
      const sineSolid = buildQ8SinePoints(frame, 0, 40)
      const sineDashed = buildQ8SinePoints(frame, 540, 40)
      const sineSolidTopology = buildPathTopologyModel({
        pathId: 'q8:sine-solid',
        sourceId: 'q8:sine-solid',
        networkId: 'sine-solid',
        sourceFamily: 'vector',
        points: sineSolid,
        closed: false
      })
      topologyBuildCount += 1
      const sineDashedTopology = buildPathTopologyModel({
        pathId: 'q8:sine-dashed',
        sourceId: 'q8:sine-dashed',
        networkId: 'sine-dashed',
        sourceFamily: 'vector',
        points: sineDashed,
        closed: false
      })
      topologyBuildCount += 1

      const solidPackets = buildSolidCenterStrokeResolvedPackets(
        'q8:sine-solid:solid',
        sineSolid,
        false,
        [solidOpenCenterStroke],
        { topology: sineSolidTopology }
      )
      const dashedPackets = buildDashedCenterStrokeResolvedPackets(
        'q8:sine-dashed:dashed',
        sineDashed,
        false,
        [q8DashedOpenCenterStroke],
        { topology: sineDashedTopology }
      )
      if (solidPackets.length === 0 || dashedPackets.length === 0) {
        invalidFrameCount += 1
      }

      for (let index = 0; index < 20; index += 1) {
        const points = buildQ8RectPoints(frame, index)
        const topology = buildPathTopologyModel({
          pathId: `q8:rect:${index}`,
          sourceId: 'q8:rects',
          networkId: `rect-${index}`,
          sourceFamily: 'vector',
          points,
          closed: true
        })
        topologyBuildCount += 1
        const packets = buildConstrainedDashedStrokeResolvedPackets(
          `q8:rect:${index}:dashed`,
          points,
          true,
          [q8DashedStroke],
          { topology }
        )
        if (
          topology.topologyFamily !== 'rectangle-equivalent' ||
          packets.length === 0
        ) {
          invalidFrameCount += 1
        }
      }

      for (let index = 0; index < 10; index += 1) {
        const points = buildQ8PolygonPoints(frame, index)
        const topology = buildPathTopologyModel({
          pathId: `q8:polygon:${index}`,
          sourceId: 'q8:polygons',
          networkId: `polygon-${index}`,
          sourceFamily: 'vector',
          points,
          closed: true
        })
        topologyBuildCount += 1
        const packets = buildConstrainedDashedStrokeResolvedPackets(
          `q8:polygon:${index}:dashed`,
          points,
          true,
          [q8DashedStroke],
          { topology }
        )
        if (
          topology.topologyFamily === 'degenerate' ||
          topology.topologyFamily === 'self-intersecting' ||
          packets.length === 0
        ) {
          invalidFrameCount += 1
        }
      }
    })

    expect(topologyBuildCount).toBe(FRAME_COUNT * sourceCount)
    expect(invalidFrameCount).toBe(0)
    assertPerformanceContract(metrics)
  })

  it('should run: keep many self-intersecting star networks above the declared performance floor', () => {
    let topologyBuildCount = 0
    let invalidFrameCount = 0
    const starCount = 12
    const metrics = measureFrames((frame) => {
      for (let index = 0; index < starCount; index += 1) {
        const points = buildSelfIntersectingStarPoints(frame, index)
        const topology = buildPathTopologyModel({
          pathId: `benchmark:self-star:${index}`,
          sourceId: 'benchmark:self-stars',
          networkId: `self-star-${index}`,
          sourceFamily: 'vector',
          points,
          closed: true
        })
        topologyBuildCount += 1
        const packets = buildConstrainedDashedStrokeResolvedPackets(
          `benchmark:self-star:${index}:dashed`,
          points,
          true,
          [dashedStroke],
          { topology }
        )

        if (
          topology.topologyFamily !== 'self-intersecting' ||
          packets.length === 0
        ) {
          invalidFrameCount += 1
        }
      }
    })

    expect(topologyBuildCount).toBe(FRAME_COUNT * starCount)
    expect(invalidFrameCount).toBe(0)
    assertPerformanceContract(metrics)
  })
})
