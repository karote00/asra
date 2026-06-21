import { describe, expect, it } from 'vitest'
import {
  buildPathTopologyModel,
  type PathTopologyModel
} from '../components/stroke-render/path-topology-model'
import { normalizeStrokeSpec } from '../components/stroke-render/renderable-stroke'
import {
  getStrokeProductFamilyMatrix,
  resolveSourceFamily
} from '../components/stroke-render/resolved-source-family'
import {
  StrokePositions,
  StrokeStyles,
  createDefaultStroke
} from '@asyra/utils'

const stroke = (
  style: 'solid' | 'dashed',
  position: 'center' | 'inside' | 'outside'
) =>
  normalizeStrokeSpec([
    createDefaultStroke({
      style,
      position,
      dashPattern: style === StrokeStyles.DASHED ? [12, 6] : []
    })
  ]).strokes[0]

const topology = (points: { x: number; y: number }[], closed: boolean) =>
  buildPathTopologyModel({
    pathId: `topology:${closed ? 'closed' : 'open'}:${points.length}`,
    sourceId: 'vector:source',
    networkId: 'network-0',
    sourceRevision: 'source-revision:test',
    sourceFamily: 'vector',
    points,
    closed
  })

const withCompoundLegalDomains = (
  source: PathTopologyModel
): PathTopologyModel => ({
  ...source,
  contours: [
    ...source.contours,
    {
      ...source.contours[0],
      contourId: `${source.pathId}:contour:hole`,
      role: 'hole',
      nestingDepth: 1
    }
  ],
  legalDomainDescriptors: [
    ...source.legalDomainDescriptors,
    {
      legalDomainId: `${source.pathId}:legal-domain:hole`,
      role: 'hole',
      fillRule: source.fillRule,
      fillRuleBasis: source.fillRuleBasis,
      contourIds: [`${source.pathId}:contour:hole`]
    }
  ]
})

describe('resolved source family', () => {
  it('should run: classify simple open inside and outside strokes as formal unbounded open product evidence', () => {
    const openTopology = topology(
      [
        { x: 0, y: 0 },
        { x: 40, y: 0 }
      ],
      false
    )

    expect(
      resolveSourceFamily({
        topology: openTopology,
        stroke: stroke(StrokeStyles.SOLID, StrokePositions.INSIDE)
      })
    ).toMatchObject({
      topologyFamily: 'open',
      productRuleEvidence: {
        familyScope: 'open',
        status: 'verified-slice',
        requiredForCompletion: true,
        gaps: []
      },
      legalDomainHints: {
        closed: false,
        compound: false,
        selfIntersecting: false
      }
    })
    expect(
      resolveSourceFamily({
        topology: openTopology,
        stroke: stroke(StrokeStyles.DASHED, StrokePositions.OUTSIDE)
      }).legalDomainHints.closed
    ).toBe(false)
  })

  it('should run: classify simple closed solid and dashed constrained strokes as formal with legal-domain hints', () => {
    const closedTopology = topology(
      [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 40, y: 40 },
        { x: 0, y: 40 }
      ],
      true
    )

    expect(
      resolveSourceFamily({
        topology: closedTopology,
        stroke: stroke(StrokeStyles.SOLID, StrokePositions.INSIDE)
      })
    ).toMatchObject({
      topologyFamily: 'rectangle-equivalent',
      productRuleEvidence: {
        familyScope: 'simple-closed',
        status: 'verified-slice',
        requiredForCompletion: true
      },
      legalDomainHints: {
        legalDomainIds: [`${closedTopology.pathId}:legal-domain:0`],
        contourIds: [`${closedTopology.pathId}:contour:0`],
        closed: true
      }
    })
    expect(
      resolveSourceFamily({
        topology: closedTopology,
        stroke: stroke(StrokeStyles.DASHED, StrokePositions.OUTSIDE)
      }).legalDomainHints.legalDomainIds
    ).toHaveLength(1)
  })

  it('should run: classify compound dashed domains as formal implementation slices with parity gaps explicit', () => {
    const compoundTopology = withCompoundLegalDomains(
      topology(
        [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 }
        ],
        true
      )
    )

    expect(
      resolveSourceFamily({
        topology: compoundTopology,
        stroke: stroke(StrokeStyles.DASHED, StrokePositions.INSIDE)
      })
    ).toMatchObject({
      productRuleEvidence: {
        familyScope: 'compound-closed',
        status: 'verified-slice',
        requiredForCompletion: true
      },
      legalDomainHints: {
        compound: true
      }
    })
  })

  it('should run: classify self-intersecting dashed and solid constrained products as implemented slices with parity gaps explicit', () => {
    const selfIntersectingTopology = topology(
      [
        { x: 0, y: 0 },
        { x: 40, y: 40 },
        { x: 0, y: 40 },
        { x: 40, y: 0 }
      ],
      true
    )

    expect(
      resolveSourceFamily({
        topology: selfIntersectingTopology,
        stroke: stroke(StrokeStyles.DASHED, StrokePositions.INSIDE)
      })
    ).toMatchObject({
      topologyFamily: 'self-intersecting',
      productRuleEvidence: {
        familyScope: 'self-intersecting-closed',
        status: 'verified-slice',
        requiredForCompletion: true
      },
      legalDomainHints: {
        selfIntersecting: true
      }
    })
    expect(
      resolveSourceFamily({
        topology: selfIntersectingTopology,
        stroke: stroke(StrokeStyles.SOLID, StrokePositions.INSIDE)
      })
    ).toMatchObject({
      topologyFamily: 'self-intersecting',
      productRuleEvidence: {
        familyScope: 'self-intersecting-closed',
        status: 'verified-slice',
        requiredForCompletion: true
      }
    })
  })

  it('should run: classify center strokes as formal independent of constrained legal-domain policy', () => {
    expect(
      resolveSourceFamily({
        topology: topology([{ x: 0, y: 0 }], false),
        stroke: stroke(StrokeStyles.SOLID, StrokePositions.CENTER)
      })
    ).toMatchObject({
      topologyFamily: 'degenerate',
      productRuleEvidence: {
        familyScope: 'degenerate',
        status: 'not-applicable',
        requiredForCompletion: false
      }
    })
    expect(
      resolveSourceFamily({
        topology: topology(
          [
            { x: 0, y: 0 },
            { x: 20, y: 0 }
          ],
          false
        ),
        stroke: stroke(StrokeStyles.SOLID, StrokePositions.CENTER)
      }).topologyFamily
    ).toBe('open')
  })

  it('should run: expose full Asyra stroke-family matrix instead of hiding parity gaps as complete product evidence', () => {
    const matrix = getStrokeProductFamilyMatrix()

    expect(matrix).toHaveLength(24)
    expect(
      matrix.filter((entry) => entry.status === 'implementation-gap')
    ).toEqual([])
    expect(
      matrix.filter((entry) => entry.status === 'implementation-gap')
    ).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          familyScope: 'self-intersecting-closed',
          strokeStyle: StrokeStyles.SOLID
        })
      ])
    )
    expect(
      matrix.filter((entry) => entry.status === 'unverified-reference')
    ).toEqual([])
    expect(
      matrix
        .filter((entry) => entry.requiredForCompletion)
        .every(
          (entry) =>
            entry.status === 'verified-slice' && entry.gaps.length === 0
        )
    ).toBe(true)
  })
})
