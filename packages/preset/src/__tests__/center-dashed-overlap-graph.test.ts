import { describe, expect, it } from 'vitest'
import {
  buildCenterDashedOverlapGraph,
  extractCenterDashedOverlapComponents,
  type CenterDashedOverlapCandidate,
  type Vec2
} from '../components/stroke-render/center-dashed-overlap-graph'

const rectangle = (
  x: number,
  y: number,
  width: number,
  height: number
): Vec2[] => [
  { x, y },
  { x: x + width, y },
  { x: x + width, y: y + height },
  { x, y: y + height }
]

const trapezoid = (
  x: number,
  y: number,
  topWidth: number,
  bottomWidth: number,
  height: number
): Vec2[] => [
  { x, y },
  { x: x + topWidth, y },
  { x: x + bottomWidth, y: y + height },
  { x, y: y + height }
]

const candidate = (
  candidateId: string,
  intervalId: string,
  polygon: Vec2[]
): CenterDashedOverlapCandidate => ({
  candidateId,
  intervalId,
  strokeId: 'stroke:0',
  authoredVisibleIntervalIndex: 0,
  startDistance: 0,
  endDistance: 1,
  wrapsSeam: false,
  previousVisibleIntervalId: null,
  nextVisibleIntervalId: null,
  polygons: [polygon]
})

describe('center dashed overlap graph', () => {
  it('should run: disjoint candidates do not create overlap edges and stay in singleton components', () => {
    const graph = buildCenterDashedOverlapGraph([
      candidate('candidate:a', 'interval:a', rectangle(0, 0, 10, 10)),
      candidate('candidate:b', 'interval:b', rectangle(30, 0, 10, 10))
    ])

    expect(graph.edges).toEqual([])
    expect(extractCenterDashedOverlapComponents(graph)).toEqual([
      ['candidate:a'],
      ['candidate:b']
    ])
  })

  it('should run: one shared overlap creates one connected component independent of input order', () => {
    const ordered = buildCenterDashedOverlapGraph([
      candidate('candidate:a', 'interval:a', rectangle(0, 0, 10, 10)),
      candidate('candidate:b', 'interval:b', rectangle(8, 0, 10, 10)),
      candidate('candidate:c', 'interval:c', rectangle(40, 0, 10, 10))
    ])

    const reversed = buildCenterDashedOverlapGraph([
      candidate('candidate:c', 'interval:c', rectangle(40, 0, 10, 10)),
      candidate('candidate:b', 'interval:b', rectangle(8, 0, 10, 10)),
      candidate('candidate:a', 'interval:a', rectangle(0, 0, 10, 10))
    ])

    expect(extractCenterDashedOverlapComponents(ordered)).toEqual([
      ['candidate:a', 'candidate:b'],
      ['candidate:c']
    ])
    expect(extractCenterDashedOverlapComponents(reversed)).toEqual([
      ['candidate:a', 'candidate:b'],
      ['candidate:c']
    ])
  })

  it('should run: asymmetric variable-width dashed-overlap probes stay component-stable without rectangular-band assumptions', () => {
    const ordered = buildCenterDashedOverlapGraph([
      candidate(
        'candidate:a',
        'interval:a',
        trapezoid(0, 0, 12, 26, 20)
      ),
      candidate(
        'candidate:b',
        'interval:b',
        trapezoid(16, 6, 18, 30, 20)
      ),
      candidate(
        'candidate:c',
        'interval:c',
        trapezoid(70, 0, 10, 22, 20)
      )
    ])

    const reversed = buildCenterDashedOverlapGraph([
      candidate(
        'candidate:c',
        'interval:c',
        trapezoid(70, 0, 10, 22, 20)
      ),
      candidate(
        'candidate:b',
        'interval:b',
        trapezoid(16, 6, 18, 30, 20)
      ),
      candidate(
        'candidate:a',
        'interval:a',
        trapezoid(0, 0, 12, 26, 20)
      )
    ])

    expect(extractCenterDashedOverlapComponents(ordered)).toEqual([
      ['candidate:a', 'candidate:b'],
      ['candidate:c']
    ])
    expect(extractCenterDashedOverlapComponents(reversed)).toEqual([
      ['candidate:a', 'candidate:b'],
      ['candidate:c']
    ])
    expect(ordered.edges).toEqual([['candidate:a', 'candidate:b']])
  })
})
