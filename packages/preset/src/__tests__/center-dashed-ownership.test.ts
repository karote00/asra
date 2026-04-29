import { describe, expect, it } from 'vitest'
import {
  resolveCenterDashedOwnershipForComponent,
  type CenterDashedOwnershipCandidate,
  type Vec2
} from '../components/stroke-render/center-dashed-ownership'

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

const ownershipCandidate = (
  overrides: Partial<CenterDashedOwnershipCandidate> & {
    candidateId: string
    intervalId: string
    primitiveKind: 'body' | 'join' | 'cap'
  }
): CenterDashedOwnershipCandidate => ({
  candidateId: overrides.candidateId,
  intervalId: overrides.intervalId,
  strokeId: overrides.strokeId ?? 'stroke:0',
  primitiveKind: overrides.primitiveKind,
  normalDistanceToSource: overrides.normalDistanceToSource ?? 0,
  startDistance: overrides.startDistance ?? 0,
  authoredVisibleIntervalIndex: overrides.authoredVisibleIntervalIndex ?? 0,
  stableIntervalId: overrides.stableIntervalId ?? overrides.intervalId,
  polygons: overrides.polygons ?? [rectangle(0, 0, 10, 10)],
  continuityPreserving: overrides.continuityPreserving ?? false,
  regionInsideTerminalEnvelope: overrides.regionInsideTerminalEnvelope ?? false
})

describe('center dashed ownership', () => {
  it('should run: body beats join on the same atomic region', () => {
    const result = resolveCenterDashedOwnershipForComponent({
      componentId: 'component:0',
      regions: [
        {
          regionId: 'region:0',
          polygon: rectangle(0, 0, 10, 10),
          candidates: [
            ownershipCandidate({
              candidateId: 'candidate:join',
              intervalId: 'interval:join',
              primitiveKind: 'join'
            }),
            ownershipCandidate({
              candidateId: 'candidate:body',
              intervalId: 'interval:body',
              primitiveKind: 'body'
            })
          ]
        }
      ]
    })

    expect(result.ownedRegions).toHaveLength(1)
    expect(result.ownedRegions[0]).toMatchObject({
      regionId: 'region:0',
      ownerIntervalId: 'interval:body',
      ownerPrimitiveKind: 'body'
    })
    expect(result.unresolvedBailouts).toEqual([])
  })

  it('should run: join beats cap and a foreign cap cannot steal body outside its terminal envelope', () => {
    const result = resolveCenterDashedOwnershipForComponent({
      componentId: 'component:1',
      regions: [
        {
          regionId: 'region:join-vs-cap',
          polygon: rectangle(0, 0, 10, 10),
          candidates: [
            ownershipCandidate({
              candidateId: 'candidate:cap',
              intervalId: 'interval:cap',
              primitiveKind: 'cap',
              regionInsideTerminalEnvelope: true
            }),
            ownershipCandidate({
              candidateId: 'candidate:join',
              intervalId: 'interval:join',
              primitiveKind: 'join'
            })
          ]
        },
        {
          regionId: 'region:foreign-cap-vs-body',
          polygon: rectangle(20, 0, 10, 10),
          candidates: [
            ownershipCandidate({
              candidateId: 'candidate:cap',
              intervalId: 'interval:cap',
              primitiveKind: 'cap',
              regionInsideTerminalEnvelope: false
            }),
            ownershipCandidate({
              candidateId: 'candidate:body',
              intervalId: 'interval:body',
              primitiveKind: 'body'
            })
          ]
        }
      ]
    })

    expect(result.ownedRegions).toEqual([
      expect.objectContaining({
        regionId: 'region:foreign-cap-vs-body',
        ownerIntervalId: 'interval:body',
        ownerPrimitiveKind: 'body'
      }),
      expect.objectContaining({
        regionId: 'region:join-vs-cap',
        ownerIntervalId: 'interval:join',
        ownerPrimitiveKind: 'join'
      })
    ])
  })

  it('should run: interval priority stays deterministic under candidate reorder', () => {
    const ordered = resolveCenterDashedOwnershipForComponent({
      componentId: 'component:2',
      regions: [
        {
          regionId: 'region:0',
          polygon: rectangle(0, 0, 10, 10),
          candidates: [
            ownershipCandidate({
              candidateId: 'candidate:b',
              intervalId: 'interval:b',
              primitiveKind: 'body',
              normalDistanceToSource: 2,
              startDistance: 5,
              authoredVisibleIntervalIndex: 1,
              stableIntervalId: 'interval:b'
            }),
            ownershipCandidate({
              candidateId: 'candidate:a',
              intervalId: 'interval:a',
              primitiveKind: 'body',
              normalDistanceToSource: 2,
              startDistance: 5,
              authoredVisibleIntervalIndex: 0,
              stableIntervalId: 'interval:a'
            })
          ]
        }
      ]
    })

    const reversed = resolveCenterDashedOwnershipForComponent({
      componentId: 'component:2',
      regions: [
        {
          regionId: 'region:0',
          polygon: rectangle(0, 0, 10, 10),
          candidates: [
            ownershipCandidate({
              candidateId: 'candidate:a',
              intervalId: 'interval:a',
              primitiveKind: 'body',
              normalDistanceToSource: 2,
              startDistance: 5,
              authoredVisibleIntervalIndex: 0,
              stableIntervalId: 'interval:a'
            }),
            ownershipCandidate({
              candidateId: 'candidate:b',
              intervalId: 'interval:b',
              primitiveKind: 'body',
              normalDistanceToSource: 2,
              startDistance: 5,
              authoredVisibleIntervalIndex: 1,
              stableIntervalId: 'interval:b'
            })
          ]
        }
      ]
    })

    expect(ordered.ownedRegions[0].ownerIntervalId).toBe('interval:a')
    expect(reversed.ownedRegions[0].ownerIntervalId).toBe('interval:a')
  })

  it('should run: bailout stays component-local and preserves preview geometry', () => {
    const result = resolveCenterDashedOwnershipForComponent({
      componentId: 'component:3',
      forceBailoutReason: 'owner-tie-unresolved',
      regions: [
        {
          regionId: 'region:0',
          polygon: rectangle(0, 0, 10, 10),
          candidates: [
            ownershipCandidate({
              candidateId: 'candidate:a',
              intervalId: 'interval:a',
              primitiveKind: 'body',
              polygons: [rectangle(0, 0, 10, 10)]
            }),
            ownershipCandidate({
              candidateId: 'candidate:b',
              intervalId: 'interval:b',
              primitiveKind: 'body',
              polygons: [rectangle(1, 1, 8, 8)]
            })
          ]
        }
      ],
      unaffectedPassthroughIntervals: ['interval:unaffected']
    })

    expect(result.ownedRegions).toEqual([])
    expect(result.passthroughIntervals).toEqual(['interval:unaffected'])
    expect(result.unresolvedBailouts).toEqual([
      {
        componentId: 'component:3',
        reason: 'owner-tie-unresolved',
        preservedOwnerKeys: [],
        preservedPreviewIntervalIds: ['interval:a', 'interval:b'],
        preservedPreviewPolygons: [
          rectangle(0, 0, 10, 10),
          rectangle(1, 1, 8, 8)
        ]
      }
    ])
  })
})
