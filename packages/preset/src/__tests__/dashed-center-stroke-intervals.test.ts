import { describe, expect, it } from 'vitest'
import {
  allocateDashedCenterStrokeIntervals,
  allocateDomainPlanSplitRangeDashedIntervals,
  allocateStrokeIntervals,
  allocateStrokeIntervalsForDomainPlan
} from '../components/stroke-render/dashed-center-stroke-intervals'

describe('dashed center stroke interval allocation', () => {
  const expectBalancedDomainPlanSplitRange = (
    intervals: NonNullable<
      ReturnType<typeof allocateDomainPlanSplitRangeDashedIntervals>[number]
    >['intervals'],
    {
      dashLength,
      rangeEnd,
      rangeStart
    }: {
      dashLength: number
      rangeStart: number
      rangeEnd: number
    }
  ) => {
    const visible = intervals.filter((interval) => interval.kind === 'visible')
    const rangeLength = rangeEnd - rangeStart
    if (rangeLength <= dashLength) {
      expect(visible).toHaveLength(1)
      expect(visible[0]?.startDistance).toBeCloseTo(rangeStart, 6)
      expect(visible[0]?.endDistance).toBeCloseTo(rangeEnd, 6)
      expect(visible[0]?.domainPlanTerminalRole).toBe('start-end')
      return
    }

    const halfDash = dashLength / 2
    expect(visible[0]?.startDistance).toBeCloseTo(rangeStart, 6)
    expect(visible[0]?.endDistance).toBeCloseTo(rangeStart + halfDash, 6)
    expect(visible[0]?.domainPlanTerminalRole).toBe('start')
    expect(visible.at(-1)?.startDistance).toBeCloseTo(rangeEnd - halfDash, 6)
    expect(visible.at(-1)?.endDistance).toBeCloseTo(rangeEnd, 6)
    expect(visible.at(-1)?.domainPlanTerminalRole).toBe('end')

    const middle = visible.slice(1, -1)
    for (const interval of middle) {
      expect(interval.domainPlanTerminalRole).toBe('middle')
      expect(interval.endDistance - interval.startDistance).toBeCloseTo(
        dashLength,
        6
      )
    }

    const gaps = visible.slice(0, -1).flatMap((interval, index) => {
      const next = visible[index + 1]
      return next ? [next.startDistance - interval.endDistance] : []
    })
    expect(gaps.length).toBeGreaterThan(0)
    const firstGap = gaps[0]
    expect(firstGap).toBeDefined()
    for (const gap of gaps) {
      expect(gap).toBeGreaterThanOrEqual(0)
      expect(gap).toBeCloseTo(firstGap ?? 0, 6)
    }
  }

  it('should run: allocate open path dashes by true arc length without endpoint balancing', () => {
    const intervals = allocateDashedCenterStrokeIntervals(
      100,
      [20, 10],
      0,
      false
    )

    expect(
      intervals.map((interval) => ({
        kind: interval.kind,
        startDistance: interval.startDistance,
        endDistance: interval.endDistance,
        wrapsSeam: interval.wrapsSeam
      }))
    ).toEqual([
      {
        kind: 'visible',
        startDistance: 0,
        endDistance: 20,
        wrapsSeam: false
      },
      {
        kind: 'gap',
        startDistance: 20,
        endDistance: 30,
        wrapsSeam: false
      },
      {
        kind: 'visible',
        startDistance: 30,
        endDistance: 50,
        wrapsSeam: false
      },
      {
        kind: 'gap',
        startDistance: 50,
        endDistance: 60,
        wrapsSeam: false
      },
      {
        kind: 'visible',
        startDistance: 60,
        endDistance: 80,
        wrapsSeam: false
      },
      {
        kind: 'gap',
        startDistance: 80,
        endDistance: 90,
        wrapsSeam: false
      },
      {
        kind: 'visible',
        startDistance: 90,
        endDistance: 100,
        wrapsSeam: false
      }
    ])
  })

  it('should run: allocate open network product dashes with endpoint half terminals and balanced gaps', () => {
    const intervals = allocateDashedCenterStrokeIntervals(
      90,
      [20, 10],
      0,
      false,
      { openPathPolicy: 'network-balanced-terminals' }
    )

    expect(
      intervals.map((interval) => ({
        kind: interval.kind,
        startDistance: interval.startDistance,
        endDistance: interval.endDistance,
        openPathTerminalRole: interval.openPathTerminalRole
      }))
    ).toEqual([
      {
        kind: 'visible',
        startDistance: 0,
        endDistance: 10,
        openPathTerminalRole: 'path-start'
      },
      {
        kind: 'gap',
        startDistance: 10,
        endDistance: 20,
        openPathTerminalRole: undefined
      },
      {
        kind: 'visible',
        startDistance: 20,
        endDistance: 40,
        openPathTerminalRole: 'middle'
      },
      {
        kind: 'gap',
        startDistance: 40,
        endDistance: 50,
        openPathTerminalRole: undefined
      },
      {
        kind: 'visible',
        startDistance: 50,
        endDistance: 70,
        openPathTerminalRole: 'middle'
      },
      {
        kind: 'gap',
        startDistance: 70,
        endDistance: 80,
        openPathTerminalRole: undefined
      },
      {
        kind: 'visible',
        startDistance: 80,
        endDistance: 90,
        openPathTerminalRole: 'path-end'
      }
    ])
  })

  it('should run: keep round and square cap open network gaps above the visual floor', () => {
    const intervals = allocateDashedCenterStrokeIntervals(
      80,
      [20, 20],
      0,
      false,
      {
        openPathPolicy: 'network-balanced-terminals',
        strokeWidth: 10,
        cap: 'round'
      }
    )
    const visible = intervals.filter((interval) => interval.kind === 'visible')

    expect(visible).toHaveLength(2)
    expect(
      visible.slice(0, -1).map((interval, index) => {
        const next = visible[index + 1]
        return next
          ? next.startDistance - interval.endDistance - 10
          : Number.NaN
      })
    ).toEqual([50])
  })

  it('should run: collapse very short open network dashes instead of squeezing unreadable gaps', () => {
    const intervals = allocateDashedCenterStrokeIntervals(
      25,
      [20, 10],
      0,
      false,
      { openPathPolicy: 'network-balanced-terminals' }
    )

    expect(
      intervals.map((interval) => ({
        kind: interval.kind,
        startDistance: interval.startDistance,
        endDistance: interval.endDistance,
        openPathTerminalRole: interval.openPathTerminalRole
      }))
    ).toEqual([
      {
        kind: 'visible',
        startDistance: 0,
        endDistance: 25,
        openPathTerminalRole: 'start-end'
      }
    ])
  })

  it('should run: merge seam-wrap visible intervals deterministically on closed paths', () => {
    const intervals = allocateDashedCenterStrokeIntervals(
      90,
      [20, 20],
      10,
      true
    )

    expect(
      intervals
        .filter((interval) => interval.kind === 'visible')
        .map((interval) => ({
          startDistance: interval.startDistance,
          endDistance: interval.endDistance,
          intervalLength: interval.intervalLength,
          wrapsSeam: interval.wrapsSeam
        }))
    ).toEqual([
      {
        startDistance: 70,
        endDistance: 10,
        intervalLength: 30,
        wrapsSeam: true
      },
      {
        startDistance: 30,
        endDistance: 50,
        intervalLength: 20,
        wrapsSeam: false
      }
    ])
  })

  it('should run: normalize negative dash offsets into the positive pattern cycle', () => {
    const negativeOffsetIntervals = allocateDashedCenterStrokeIntervals(
      80,
      [20, 10],
      -10,
      false
    )
    const equivalentPositiveOffsetIntervals =
      allocateDashedCenterStrokeIntervals(80, [20, 10], 20, false)

    expect(
      negativeOffsetIntervals.map((interval) => ({
        kind: interval.kind,
        startDistance: interval.startDistance,
        endDistance: interval.endDistance
      }))
    ).toEqual(
      equivalentPositiveOffsetIntervals.map((interval) => ({
        kind: interval.kind,
        startDistance: interval.startDistance,
        endDistance: interval.endDistance
      }))
    )
  })

  it('should run: emit one clipped visible interval for open paths shorter than the first dash', () => {
    expect(
      allocateDashedCenterStrokeIntervals(12, [20, 10], 0, false).map(
        (interval) => ({
          kind: interval.kind,
          startDistance: interval.startDistance,
          endDistance: interval.endDistance
        })
      )
    ).toEqual([{ kind: 'visible', startDistance: 0, endDistance: 12 }])
  })

  it('should not run: produce any intervals for empty or invalid normalized patterns', () => {
    expect(allocateDashedCenterStrokeIntervals(100, [], 0, false)).toEqual([])
    expect(allocateDashedCenterStrokeIntervals(100, [0, -1], 0, false)).toEqual(
      []
    )
  })

  it('should run: allocate solid full-coverage intervals independently per topology domain', () => {
    expect(
      allocateStrokeIntervals({
        domains: [
          { domainId: 'source-path', totalLength: 40, closed: false },
          { domainId: 'secondary-source-domain', totalLength: 24, closed: true }
        ],
        dashPattern: [],
        dashOffset: 0
      })
    ).toEqual([
      {
        domainId: 'source-path',
        intervals: [
          expect.objectContaining({
            intervalId: 'source-path:interval:0',
            kind: 'visible',
            startDistance: 0,
            endDistance: 40
          })
        ]
      },
      {
        domainId: 'secondary-source-domain',
        intervals: [
          expect.objectContaining({
            intervalId: 'secondary-source-domain:interval:0',
            kind: 'visible',
            startDistance: 0,
            endDistance: 24
          })
        ]
      }
    ])
  })

  it('should run: allocate independent topology domains without making them self-intersecting dash product authority', () => {
    const allocations = allocateStrokeIntervals({
      domains: [
        { domainId: 'source-domain', totalLength: 50, closed: true },
        { domainId: 'secondary-domain', totalLength: 18, closed: true }
      ],
      dashPattern: [10, 5],
      dashOffset: 0
    })

    expect(
      allocations.map((allocation) => ({
        domainId: allocation.domainId,
        visible: allocation.intervals
          .filter((interval) => interval.kind === 'visible')
          .map((interval) => ({
            intervalId: interval.intervalId,
            startDistance: interval.startDistance,
            endDistance: interval.endDistance,
            wrapsSeam: interval.wrapsSeam
          }))
      }))
    ).toEqual([
      {
        domainId: 'source-domain',
        visible: [
          {
            intervalId: 'source-domain:interval:0',
            startDistance: 45,
            endDistance: 10,
            wrapsSeam: true
          },
          {
            intervalId: 'source-domain:interval:2',
            startDistance: 15,
            endDistance: 25,
            wrapsSeam: false
          },
          {
            intervalId: 'source-domain:interval:4',
            startDistance: 30,
            endDistance: 40,
            wrapsSeam: false
          }
        ]
      },
      {
        domainId: 'secondary-domain',
        visible: [
          {
            intervalId: 'secondary-domain:interval:0',
            startDistance: 15,
            endDistance: 10,
            wrapsSeam: true
          }
        ]
      }
    ])
  })

  it('should run: allocate Asyra canonical split ranges with half dashes at both ends and balanced interior gaps', () => {
    const [allocation] = allocateDomainPlanSplitRangeDashedIntervals({
      domains: [
        {
          domainId: 'split:0',
          startDistance: 0,
          endDistance: 100,
          sourceSegmentIndex: 0,
          sideAuthority: 'implicit-fill-hole-domain',
          selectedSide: 1,
          sideResolutionStatus: 'resolved'
        }
      ],
      dashPattern: [20, 10]
    })

    expect(allocation?.domainId).toBe('split:0')
    const visible = allocation?.intervals.filter(
      (interval) => interval.kind === 'visible'
    )
    expect(visible).toHaveLength(4)
    expect(visible?.[0]).toMatchObject({
      intervalId: 'split:0:interval:0',
      startDistance: 0,
      endDistance: 10,
      wrapsSeam: false,
      domainPlanSplitRangeId: 'split:0',
      domainPlanSplitRangeStartDistance: 0,
      domainPlanSplitRangeEndDistance: 100,
      domainPlanTerminalRole: 'start',
      domainPlanSplitRangeSourceSegmentIndex: 0,
      domainPlanSideAuthority: 'implicit-fill-hole-domain',
      domainPlanSelectedSide: 1,
      domainPlanSideResolutionStatus: 'resolved'
    })
    expect(visible?.[1]?.startDistance).toBeCloseTo(23.333333, 5)
    expect(visible?.[1]?.endDistance).toBeCloseTo(43.333333, 5)
    expect(visible?.[2]?.startDistance).toBeCloseTo(56.666667, 5)
    expect(visible?.[2]?.endDistance).toBeCloseTo(76.666667, 5)
    expect(visible?.[3]).toMatchObject({
      intervalId: 'split:0:interval:6',
      startDistance: 90,
      endDistance: 100,
      wrapsSeam: false,
      domainPlanSplitRangeId: 'split:0',
      domainPlanSplitRangeStartDistance: 0,
      domainPlanSplitRangeEndDistance: 100,
      domainPlanTerminalRole: 'end',
      domainPlanSplitRangeSourceSegmentIndex: 0,
      domainPlanSideAuthority: 'implicit-fill-hole-domain',
      domainPlanSelectedSide: 1,
      domainPlanSideResolutionStatus: 'resolved'
    })
    expect(visible?.[1]?.domainPlanTerminalRole).toBe('middle')
    expect(visible?.[2]?.domainPlanTerminalRole).toBe('middle')

    const gaps = allocation?.intervals.filter(
      (interval) => interval.kind === 'gap'
    )
    expect(gaps).toHaveLength(3)
    for (const gap of gaps ?? []) {
      expect(gap.intervalLength).toBeCloseTo(13.333333, 5)
    }
    expectBalancedDomainPlanSplitRange(allocation?.intervals ?? [], {
      dashLength: 20,
      rangeStart: 0,
      rangeEnd: 100
    })
  })

  it('should run: distribute every middle dash and gap evenly inside one long Asyra canonical split range', () => {
    const [allocation] = allocateDomainPlanSplitRangeDashedIntervals({
      domains: [
        {
          domainId: 'split:long',
          startDistance: 100,
          endDistance: 340,
          sourceSegmentIndex: 0,
          sideAuthority: 'implicit-fill-hole-domain',
          selectedSide: 1,
          sideResolutionStatus: 'resolved'
        }
      ],
      dashPattern: [27, 20]
    })

    const visible =
      allocation?.intervals.filter((interval) => interval.kind === 'visible') ??
      []
    expect(visible.map((interval) => interval.domainPlanTerminalRole)).toEqual([
      'start',
      'middle',
      'middle',
      'middle',
      'middle',
      'end'
    ])
    expectBalancedDomainPlanSplitRange(allocation?.intervals ?? [], {
      dashLength: 27,
      rangeStart: 100,
      rangeEnd: 340
    })

    const gaps = visible.slice(0, -1).flatMap((interval, index) => {
      const next = visible[index + 1]
      return next ? [next.startDistance - interval.endDistance] : []
    })
    expect(gaps).toEqual([
      expect.closeTo(21, 6),
      expect.closeTo(21, 6),
      expect.closeTo(21, 6),
      expect.closeTo(21, 6),
      expect.closeTo(21, 6)
    ])
  })

  it('should run: precompute one average gap before emitting any split-range dash positions', () => {
    const rangeStart = 12
    const rangeEnd = 185.411
    const dashLength = 27
    const [allocation] = allocateDomainPlanSplitRangeDashedIntervals({
      domains: [
        {
          domainId: 'split:formula',
          startDistance: rangeStart,
          endDistance: rangeEnd,
          sourceSegmentIndex: 0
        }
      ],
      dashPattern: [dashLength, 20]
    })

    const visible =
      allocation?.intervals.filter((interval) => interval.kind === 'visible') ??
      []
    expect(visible.map((interval) => interval.domainPlanTerminalRole)).toEqual([
      'start',
      'middle',
      'middle',
      'middle',
      'end'
    ])

    const rangeLength = rangeEnd - rangeStart
    const middleDashCount = visible.length - 2
    const averageGap =
      (rangeLength - dashLength - middleDashCount * dashLength) /
      (middleDashCount + 1)
    const halfDash = dashLength / 2
    const expectedVisibleRanges = [
      [rangeStart, rangeStart + halfDash],
      ...Array.from({ length: middleDashCount }, (_, middleIndex) => {
        const startDistance =
          rangeStart +
          halfDash +
          averageGap * (middleIndex + 1) +
          dashLength * middleIndex
        return [startDistance, startDistance + dashLength]
      }),
      [rangeEnd - halfDash, rangeEnd]
    ]

    visible.forEach((interval, index) => {
      const [expectedStart, expectedEnd] = expectedVisibleRanges[index] ?? []
      expect(interval.startDistance).toBeCloseTo(expectedStart ?? 0, 6)
      expect(interval.endDistance).toBeCloseTo(expectedEnd ?? 0, 6)
    })

    const gaps =
      allocation?.intervals.filter((interval) => interval.kind === 'gap') ?? []
    expect(gaps).toHaveLength(middleDashCount + 1)
    for (const gap of gaps) {
      expect(gap.intervalLength).toBeCloseTo(averageGap, 6)
    }
  })

  it('should run: choose the middle dash count whose balanced gap is nearest to the authored gap', () => {
    const [allocation] = allocateDomainPlanSplitRangeDashedIntervals({
      domains: [
        {
          domainId: 'split:compressed-gap',
          startDistance: 0,
          endDistance: 186,
          sourceSegmentIndex: 0
        }
      ],
      dashPattern: [27, 20]
    })

    const visible =
      allocation?.intervals.filter((interval) => interval.kind === 'visible') ??
      []
    expect(visible.map((interval) => interval.domainPlanTerminalRole)).toEqual([
      'start',
      'middle',
      'middle',
      'middle',
      'end'
    ])
    expectBalancedDomainPlanSplitRange(allocation?.intervals ?? [], {
      dashLength: 27,
      rangeStart: 0,
      rangeEnd: 186
    })

    const gaps = visible.slice(0, -1).flatMap((interval, index) => {
      const next = visible[index + 1]
      return next ? [next.startDistance - interval.endDistance] : []
    })
    for (const gap of gaps) {
      expect(gap).toBeCloseTo(19.5, 6)
    }
  })

  it('should run: reduce the middle dash when a short split range would over-compress gaps', () => {
    const [allocation] = allocateDomainPlanSplitRangeDashedIntervals({
      domains: [
        {
          domainId: 'split:short-visible-gap',
          startDistance: 0,
          endDistance: 70,
          sourceSegmentIndex: 0
        }
      ],
      dashPattern: [27, 20]
    })

    const visible =
      allocation?.intervals.filter((interval) => interval.kind === 'visible') ??
      []
    expect(visible.map((interval) => interval.domainPlanTerminalRole)).toEqual([
      'start',
      'end'
    ])
    expectBalancedDomainPlanSplitRange(allocation?.intervals ?? [], {
      dashLength: 27,
      rangeStart: 0,
      rangeEnd: 70
    })
    const start = visible[0]
    const end = visible[1]
    expect(start).toBeDefined()
    expect(end).toBeDefined()
    expect((end?.startDistance ?? 0) - (start?.endDistance ?? 0)).toBeCloseTo(
      43,
      6
    )
  })

  it('should run: keep split-range visual gaps from being over-compressed by cap footprint', () => {
    const [allocation] = allocateDomainPlanSplitRangeDashedIntervals({
      domains: [
        {
          domainId: 'split:cap-visual-gap',
          startDistance: 0,
          endDistance: 100,
          sourceSegmentIndex: 0
        }
      ],
      dashPattern: [20, 10],
      visualGap: {
        capExtension: 10
      }
    })

    const visible =
      allocation?.intervals.filter((interval) => interval.kind === 'visible') ??
      []
    expect(visible.map((interval) => interval.domainPlanTerminalRole)).toEqual([
      'start',
      'middle',
      'end'
    ])

    const centerlineGaps = visible.slice(0, -1).flatMap((interval, index) => {
      const next = visible[index + 1]
      return next ? [next.startDistance - interval.endDistance] : []
    })
    expect(centerlineGaps).toEqual([
      expect.closeTo(30, 6),
      expect.closeTo(30, 6)
    ])

    const visualGaps = centerlineGaps.map((gap) => gap - 20)
    for (const visualGap of visualGaps) {
      expect(visualGap).toBeGreaterThanOrEqual(6)
    }
  })

  it('should run: keep configured gap 20 from shrinking below 12 after cap footprint', () => {
    const [allocation] = allocateDomainPlanSplitRangeDashedIntervals({
      domains: [
        {
          domainId: 'split:cap-gap-20',
          startDistance: 0,
          endDistance: 140,
          sourceSegmentIndex: 0
        }
      ],
      dashPattern: [20, 20],
      visualGap: {
        capExtension: 10
      }
    })

    const visible =
      allocation?.intervals.filter((interval) => interval.kind === 'visible') ??
      []
    const centerlineGaps = visible.slice(0, -1).flatMap((interval, index) => {
      const next = visible[index + 1]
      return next ? [next.startDistance - interval.endDistance] : []
    })
    const visualGaps = centerlineGaps.map((gap) => gap - 20)
    expect(visualGaps.length).toBeGreaterThan(0)
    for (const visualGap of visualGaps) {
      expect(visualGap).toBeGreaterThanOrEqual(12)
    }
  })

  it('should run: compare split-range visual gap ratios through explicit interval options', () => {
    const [allocation] = allocateDomainPlanSplitRangeDashedIntervals({
      domains: [
        {
          domainId: 'split:cap-gap-explicit-ratio',
          startDistance: 0,
          endDistance: 140,
          sourceSegmentIndex: 0
        }
      ],
      dashPattern: [20, 20],
      visualGap: {
        capExtension: 10,
        minimumGapRatio: 2
      }
    })

    const visible =
      allocation?.intervals.filter((interval) => interval.kind === 'visible') ??
      []
    const centerlineGaps = visible.slice(0, -1).flatMap((interval, index) => {
      const next = visible[index + 1]
      return next ? [next.startDistance - interval.endDistance] : []
    })
    const visualGaps = centerlineGaps.map((gap) => gap - 20)
    expect(visualGaps).toEqual([expect.closeTo(100, 6)])
  })

  it('should run: collapse very short cap-aware split ranges instead of squeezing terminal gaps', () => {
    const [allocation] = allocateDomainPlanSplitRangeDashedIntervals({
      domains: [
        {
          domainId: 'split:cap-short',
          startDistance: 12,
          endDistance: 52,
          sourceSegmentIndex: 0
        }
      ],
      dashPattern: [20, 10],
      visualGap: {
        capExtension: 10
      }
    })

    const visible =
      allocation?.intervals.filter((interval) => interval.kind === 'visible') ??
      []
    expect(visible).toHaveLength(1)
    expect(visible[0]).toMatchObject({
      startDistance: 12,
      endDistance: 52,
      domainPlanTerminalRole: 'start-end'
    })
  })

  it('should run: use normal split ranges as the reference gap for shorter split ranges', () => {
    const allocations = allocateDomainPlanSplitRangeDashedIntervals({
      domains: [
        {
          domainId: 'split:normal',
          startDistance: 0,
          endDistance: 240,
          sourceSegmentIndex: 0
        },
        {
          domainId: 'split:short',
          startDistance: 240,
          endDistance: 310,
          sourceSegmentIndex: 0
        }
      ],
      dashPattern: [27, 20]
    })

    const normalVisible =
      allocations[0]?.intervals.filter(
        (interval) => interval.kind === 'visible'
      ) ?? []
    const normalGaps = normalVisible.slice(0, -1).flatMap((interval, index) => {
      const next = normalVisible[index + 1]
      return next ? [next.startDistance - interval.endDistance] : []
    })
    expect(normalGaps.every((gap) => Math.abs(gap - 21) <= 1e-6)).toBe(true)

    const shortVisible =
      allocations[1]?.intervals.filter(
        (interval) => interval.kind === 'visible'
      ) ?? []
    expect(
      shortVisible.map((interval) => interval.domainPlanTerminalRole)
    ).toEqual(['start', 'end'])
    expect(shortVisible[0]?.endDistance).toBeCloseTo(253.5, 6)
    expect(shortVisible[1]?.startDistance).toBeCloseTo(296.5, 6)
  })

  it('should run: allocate adjacent Asyra canonical split ranges independently instead of carrying a cumulative schedule across the boundary', () => {
    const allocations = allocateDomainPlanSplitRangeDashedIntervals({
      domains: [
        {
          domainId: 'split:0',
          startDistance: 0,
          endDistance: 50,
          sourceSegmentIndex: 0
        },
        {
          domainId: 'split:1',
          startDistance: 50,
          endDistance: 100,
          sourceSegmentIndex: 0
        }
      ],
      dashPattern: [20, 10]
    })

    const visibleByDomain = allocations.map((allocation) => ({
      domainId: allocation.domainId,
      visible: allocation.intervals
        .filter((interval) => interval.kind === 'visible')
        .map((interval) => ({
          startDistance: interval.startDistance,
          endDistance: interval.endDistance
        }))
    }))

    expect(visibleByDomain).toEqual([
      {
        domainId: 'split:0',
        visible: [
          { startDistance: 0, endDistance: 10 },
          { startDistance: 15, endDistance: 35 },
          { startDistance: 40, endDistance: 50 }
        ]
      },
      {
        domainId: 'split:1',
        visible: [
          { startDistance: 50, endDistance: 60 },
          { startDistance: 65, endDistance: 85 },
          { startDistance: 90, endDistance: 100 }
        ]
      }
    ])

    const visibleIntervals = allocations.flatMap((allocation) =>
      allocation.intervals.filter((interval) => interval.kind === 'visible')
    )
    expect(
      visibleIntervals.filter(
        (interval) => interval.domainPlanTerminalRole === 'start'
      )
    ).toHaveLength(2)
    expect(
      visibleIntervals.filter(
        (interval) => interval.domainPlanTerminalRole === 'middle'
      )
    ).toHaveLength(2)
    expect(
      visibleIntervals.filter(
        (interval) => interval.domainPlanTerminalRole === 'end'
      )
    ).toHaveLength(2)
    allocations.forEach((allocation, index) => {
      expectBalancedDomainPlanSplitRange(allocation.intervals, {
        dashLength: 20,
        rangeStart: index * 50,
        rangeEnd: index * 50 + 50
      })
    })
    expect(
      visibleIntervals.every(
        (interval) =>
          interval.domainPlanSplitRangeId === 'split:0' ||
          interval.domainPlanSplitRangeId === 'split:1'
      )
    ).toBe(true)
  })

  it('should run: collapse an Asyra canonical split range shorter than one dash into one visible range', () => {
    const [allocation] = allocateDomainPlanSplitRangeDashedIntervals({
      domains: [
        {
          domainId: 'split:short',
          startDistance: 25,
          endDistance: 37,
          sourceSegmentIndex: 2
        }
      ],
      dashPattern: [20, 10]
    })

    expect(allocation?.intervals).toEqual([
      expect.objectContaining({
        intervalId: 'split:short:interval:0',
        kind: 'visible',
        startDistance: 25,
        endDistance: 37,
        wrapsSeam: false,
        domainPlanSplitRangeId: 'split:short',
        domainPlanSplitRangeStartDistance: 25,
        domainPlanSplitRangeEndDistance: 37,
        domainPlanTerminalRole: 'start-end',
        domainPlanSplitRangeSourceSegmentIndex: 2
      })
    ])
  })

  it('should run: allocate intervals directly from Step14 split-range domain plans', () => {
    const allocations = allocateStrokeIntervalsForDomainPlan({
      domainPlan: {
        planId: 'plan:self-intersecting',
        intervalDomainKind: 'domain-plan-split-range',
        totalLength: 100,
        closed: true,
        legalBoundaryDomains: [],
        splitRangeDomains: [
          {
            domainId: 'split:0',
            startDistance: 0,
            endDistance: 50,
            sourceSegmentIndex: 0,
            sideAuthority: 'implicit-fill-hole-domain',
            selectedSide: 1,
            sideResolutionStatus: 'resolved'
          },
          {
            domainId: 'split:1',
            startDistance: 50,
            endDistance: 100,
            sourceSegmentIndex: 0,
            sideAuthority: 'implicit-fill-hole-domain',
            selectedSide: -1,
            sideResolutionStatus: 'resolved'
          }
        ]
      },
      dashPattern: [20, 10],
      dashOffset: 0
    })

    expect(allocations).toHaveLength(2)
    expect(
      allocations.flatMap((allocation) =>
        allocation.intervals
          .filter((interval) => interval.kind === 'visible')
          .map((interval) => ({
            domainId: allocation.domainId,
            startDistance: interval.startDistance,
            endDistance: interval.endDistance,
            terminalRole: interval.domainPlanTerminalRole,
            selectedSide: interval.domainPlanSelectedSide
          }))
      )
    ).toEqual([
      {
        domainId: 'split:0',
        startDistance: 0,
        endDistance: 10,
        terminalRole: 'start',
        selectedSide: 1
      },
      {
        domainId: 'split:0',
        startDistance: 15,
        endDistance: 35,
        terminalRole: 'middle',
        selectedSide: 1
      },
      {
        domainId: 'split:0',
        startDistance: 40,
        endDistance: 50,
        terminalRole: 'end',
        selectedSide: 1
      },
      {
        domainId: 'split:1',
        startDistance: 50,
        endDistance: 60,
        terminalRole: 'start',
        selectedSide: -1
      },
      {
        domainId: 'split:1',
        startDistance: 65,
        endDistance: 85,
        terminalRole: 'middle',
        selectedSide: -1
      },
      {
        domainId: 'split:1',
        startDistance: 90,
        endDistance: 100,
        terminalRole: 'end',
        selectedSide: -1
      }
    ])
  })

  it('should run: allocate compound legal-boundary domain intervals without collapsing shell and hole schedules', () => {
    const allocations = allocateStrokeIntervalsForDomainPlan({
      domainPlan: {
        planId: 'plan:compound',
        intervalDomainKind: 'legal-boundary-span',
        totalLength: 0,
        closed: true,
        splitRangeDomains: [],
        legalBoundaryDomains: [
          {
            domainId: 'compound:boundary:shell',
            totalLength: 100,
            closed: true
          },
          {
            domainId: 'compound:boundary:hole',
            totalLength: 60,
            closed: true
          }
        ]
      },
      dashPattern: [20, 10],
      dashOffset: 0
    })

    expect(allocations.map((allocation) => allocation.domainId)).toEqual([
      'compound:boundary:shell',
      'compound:boundary:hole'
    ])
    expect(
      allocations.map((allocation) =>
        allocation.intervals
          .filter((interval) => interval.kind === 'visible')
          .map((interval) => ({
            intervalId: interval.intervalId,
            startDistance: interval.startDistance,
            endDistance: interval.endDistance
          }))
      )
    ).toEqual([
      [
        {
          intervalId: 'compound:boundary:shell:interval:0',
          startDistance: 90,
          endDistance: 20
        },
        {
          intervalId: 'compound:boundary:shell:interval:2',
          startDistance: 30,
          endDistance: 50
        },
        {
          intervalId: 'compound:boundary:shell:interval:4',
          startDistance: 60,
          endDistance: 80
        }
      ],
      [
        {
          intervalId: 'compound:boundary:hole:interval:0',
          startDistance: 0,
          endDistance: 20
        },
        {
          intervalId: 'compound:boundary:hole:interval:2',
          startDistance: 30,
          endDistance: 50
        }
      ]
    ])
  })
})
