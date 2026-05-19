import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'
import type { VectorTopology } from '@asyra/core'
import {
  assertVectorTopologyConsistency,
  buildVectorComputedPatch
} from '../../../../apps/asyra-design/src/common-apis/element/vector-consistency'

const vectorConsistencySource = () =>
  readFileSync(
    '../../apps/asyra-design/src/common-apis/element/vector-consistency.ts',
    'utf8'
  )

const createOpenTopology = (): VectorTopology => ({
  points: {
    a: {
      id: 'a',
      kind: 'anchor',
      anchorType: 'sharp',
      x: 10,
      y: 20
    },
    b: {
      id: 'b',
      kind: 'anchor',
      anchorType: 'sharp',
      x: 40,
      y: 20
    }
  },
  segments: {
    s0: {
      id: 's0',
      startId: 'a',
      endId: 'b',
      outControlId: null,
      inControlId: null
    }
  },
  networks: {
    n0: {
      id: 'n0',
      pointIds: ['a', 'b'],
      segmentIds: ['s0'],
      closed: false
    }
  }
})

const createSelfIntersectingClosedTopology = (): VectorTopology => {
  const pointIds = ['p0', 'p1', 'p2', 'p3', 'p4']
  const coordinates = [
    { x: 50, y: 0 },
    { x: 79, y: 90 },
    { x: 2, y: 35 },
    { x: 98, y: 35 },
    { x: 21, y: 90 }
  ]

  return {
    points: Object.fromEntries(
      pointIds.map((pointId, index) => [
        pointId,
        {
          id: pointId,
          kind: 'anchor',
          anchorType: 'sharp',
          ...coordinates[index]
        }
      ])
    ),
    segments: Object.fromEntries(
      pointIds.map((pointId, index) => {
        const nextPointId = pointIds[(index + 1) % pointIds.length]
        return [
          `s${index}`,
          {
            id: `s${index}`,
            startId: pointId,
            endId: nextPointId,
            outControlId: null,
            inControlId: null
          }
        ]
      })
    ),
    networks: {
      n0: {
        id: 'n0',
        pointIds,
        segmentIds: pointIds.map((_, index) => `s${index}`),
        closed: true
      }
    }
  }
}

describe('vector topology validation', () => {
  it('accepts coherent topology and builds a complete normalized computed-data patch', () => {
    const topology = createOpenTopology()

    expect(() =>
      assertVectorTopologyConsistency(topology, 'valid-open')
    ).not.toThrow()

    const patch = buildVectorComputedPatch(topology)

    expect(patch).toMatchObject({
      x: 10,
      y: 20,
      width: 30,
      height: 0.1,
      closed: false,
      segments: topology.segments,
      networks: topology.networks
    })
    expect(patch.points).toMatchObject({
      a: { x: 0, y: 0 },
      b: { x: 30, y: 0 }
    })
    expect(patch).not.toHaveProperty('anchorPoints')
  })

  it('rejects topology that has anchors without a network before patch creation', () => {
    const topology = createOpenTopology()
    topology.networks = {}

    expect(() => buildVectorComputedPatch(topology)).toThrow(
      /missing network entries/
    )
  })

  it('rejects segments that point at missing anchors before patch creation', () => {
    const topology = createOpenTopology()
    topology.segments.s0.endId = 'missing'

    expect(() => buildVectorComputedPatch(topology)).toThrow(
      /endId missing is not an anchor/
    )
  })

  it('rejects networks whose segment order does not match point order', () => {
    const topology = createOpenTopology()
    topology.networks.n0.pointIds = ['b', 'a']

    expect(() => buildVectorComputedPatch(topology)).toThrow(
      /does not match point order/
    )
  })

  it('does not reject self-intersecting but structurally valid topology at write-time validation', () => {
    const topology = createSelfIntersectingClosedTopology()

    expect(() =>
      assertVectorTopologyConsistency(topology, 'self-intersecting-valid')
    ).not.toThrow()
    expect(buildVectorComputedPatch(topology).closed).toBe(true)
  })

  it('keeps product stroke support classification out of write-time topology validation', () => {
    const source = vectorConsistencySource()
    const validationBlock = source.match(
      /export const assertVectorTopologyConsistency = \([\s\S]*?\n}\n\nexport const translateAnchorAndHandles/
    )?.[0]

    expect(validationBlock).toBeDefined()
    expect(validationBlock).not.toMatch(/\bstrokes?\b/)
    expect(validationBlock).not.toMatch(/\b(?:inside|outside|dashed)\b/)
    expect(validationBlock).not.toMatch(/\b(?:fill|hole|legal-domain)\b/)
  })
})
