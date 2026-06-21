import { describe, expect, it } from 'vitest'
import { createDefaultStroke } from '@asyra/utils'
import { buildDashedCenterStrokeResolvedPackets } from '../components/stroke-render/dashed-center-stroke-packets'
import { buildCenterDashedOverlapCandidatesFromResolvedPackets } from '../components/stroke-render/center-dashed-overlap-candidates'
import {
  buildCenterDashedOverlapGraph,
  extractCenterDashedOverlapComponents
} from '../components/stroke-render/center-dashed-overlap-graph'

describe('center dashed overlap integration', () => {
  it('should run: real dashed-center packets from two overlapping strokes produce one overlap component', () => {
    const packets = buildDashedCenterStrokeResolvedPackets(
      'center-dashed-overlap',
      [
        { x: 0, y: 0 },
        { x: 120, y: 0 }
      ],
      false,
      [
        createDefaultStroke({
          visible: true,
          style: 'dashed',
          position: 'center',
          width: 12,
          color: '#ff0000',
          opacity: 1,
          joinType: 'miter',
          capType: 'butt',
          miterAngle: 28.96,
          dashPattern: [30, 12],
          dashOffset: 0
        }),
        createDefaultStroke({
          visible: true,
          style: 'dashed',
          position: 'center',
          width: 12,
          color: '#00ff00',
          opacity: 1,
          joinType: 'miter',
          capType: 'butt',
          miterAngle: 28.96,
          dashPattern: [30, 12],
          dashOffset: 8
        })
      ]
    )

    const candidates =
      buildCenterDashedOverlapCandidatesFromResolvedPackets(packets)
    const graph = buildCenterDashedOverlapGraph(candidates)
    const components = extractCenterDashedOverlapComponents(graph)

    expect(
      candidates.some((candidate) => candidate.strokeId === 'stroke:0')
    ).toBe(true)
    expect(
      candidates.some((candidate) => candidate.strokeId === 'stroke:1')
    ).toBe(true)
    expect(graph.edges.length).toBeGreaterThan(0)
    expect(components.length).toBeLessThan(candidates.length)
    expect(components.some((component) => component.length > 1)).toBe(true)
  })

  it('should run: overlap candidates preserve interval identity from the formal packet geometry ids', () => {
    const packets = buildDashedCenterStrokeResolvedPackets(
      'center-dashed-overlap',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 }
      ],
      false,
      [
        createDefaultStroke({
          visible: true,
          style: 'dashed',
          position: 'center',
          width: 10,
          color: '#ff0000',
          opacity: 1,
          joinType: 'miter',
          capType: 'butt',
          miterAngle: 28.96,
          dashPattern: [20, 10],
          dashOffset: 0
        })
      ],
      {
        metadata: {
          ownerKeyPrefix: 'vector:diagnostic:network-a',
          networkId: 'network-a'
        }
      }
    )

    const candidates =
      buildCenterDashedOverlapCandidatesFromResolvedPackets(packets)

    expect(candidates).not.toEqual([])
    candidates.forEach((candidate) => {
      expect(
        candidate.candidateId.startsWith('center-dashed-overlap:0:interval:')
      ).toBe(true)
      expect(candidate.intervalId.startsWith('interval:')).toBe(true)
      expect(candidate.strokeId).toBe('stroke:0')
      expect(candidate.ownerKey).toBe('vector:diagnostic:network-a:stroke:0')
      expect(candidate.networkId).toBe('network-a')
      expect(candidate.authoredVisibleIntervalIndex).toBeGreaterThanOrEqual(0)
      expect(candidate.endDistance).toBeGreaterThan(candidate.startDistance)
    })
  })
})
