import { describe, expect, it } from 'vitest'
import { allocateDashedCenterStrokeIntervals } from '../components/stroke-render/dashed-center-stroke-intervals'
import {
  buildSourceSpanGraph,
  getSourceSpanIdsForInterval
} from '../components/stroke-render/source-span-graph'
import { buildPathTopologyModel } from '../components/stroke-render/path-topology-model'

describe('source span graph', () => {
  it('should run: split source spans at vertices and dash interval boundaries', () => {
    const topology = buildPathTopologyModel({
      pathId: 'span:rect',
      points: [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      closed: true
    })
    const intervals = allocateDashedCenterStrokeIntervals(
      topology.totalLength,
      [30, 10],
      0,
      topology.closed
    ).filter((interval) => interval.kind === 'visible')
    const graph = buildSourceSpanGraph(topology, intervals)

    expect(graph.cuts.map((cut) => cut.kind)).toContain('dash-boundary')
    expect(graph.cuts.map((cut) => cut.kind)).toContain('vertex')
    const firstInterval = intervals[0]
    const secondInterval = intervals[1]
    expect(firstInterval).toBeDefined()
    expect(secondInterval).toBeDefined()
    if (!firstInterval || !secondInterval) {
      throw new Error(
        'Expected two visible intervals for source span graph test'
      )
    }

    expect(getSourceSpanIdsForInterval(graph, firstInterval)).toEqual([
      'span:rect:contour:0:source-span:0'
    ])
    expect(getSourceSpanIdsForInterval(graph, secondInterval)).toEqual([
      'span:rect:contour:0:source-span:2'
    ])
  })

  it('should run: split a self-intersecting interval at the crossing before face ownership', () => {
    const topology = buildPathTopologyModel({
      pathId: 'span:self-crossing',
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
        { x: 100, y: 0 }
      ],
      closed: true
    })
    const [firstInterval] = allocateDashedCenterStrokeIntervals(
      topology.totalLength,
      [200, 20],
      0,
      topology.closed
    ).filter((interval) => interval.kind === 'visible')
    const graph = buildSourceSpanGraph(
      topology,
      firstInterval ? [firstInterval] : []
    )

    expect(graph.cuts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'self-intersection' })
      ])
    )
    const selfIntersectionCuts = graph.cuts.filter(
      (cut) => cut.kind === 'self-intersection'
    )
    expect(selfIntersectionCuts).toHaveLength(2)
    expect(
      new Set(selfIntersectionCuts.map((cut) => cut.crossingId)).size
    ).toBe(1)
    expect(selfIntersectionCuts[0]?.distance).toBeCloseTo(70.710678, 5)
    expect(selfIntersectionCuts[1]?.distance).toBeCloseTo(312.132034, 5)
    const sourceSpanIds = firstInterval
      ? getSourceSpanIdsForInterval(graph, firstInterval)
      : []
    expect(sourceSpanIds).toEqual(
      expect.arrayContaining([
        'span:self-crossing:contour:0:source-span:0',
        'span:self-crossing:contour:0:source-span:1',
        'span:self-crossing:contour:0:source-span:2'
      ])
    )
    expect(sourceSpanIds.length).toBeGreaterThanOrEqual(3)
  })
})
