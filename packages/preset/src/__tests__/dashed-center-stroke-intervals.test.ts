import { describe, expect, it } from 'vitest'
import { allocateDashedCenterStrokeIntervals } from '../components/stroke-render/dashed-center-stroke-intervals'

describe('dashed center stroke interval allocation', () => {
  it('should run: preserve authored dash pattern through interval allocation on open paths', () => {
    const intervals = allocateDashedCenterStrokeIntervals(100, [20, 10], 0, false)

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

  it('should run: merge seam-wrap visible intervals deterministically on closed paths', () => {
    const intervals = allocateDashedCenterStrokeIntervals(90, [20, 20], 10, true)

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

  it('should not run: produce any intervals for empty or invalid normalized patterns', () => {
    expect(allocateDashedCenterStrokeIntervals(100, [], 0, false)).toEqual([])
    expect(allocateDashedCenterStrokeIntervals(100, [0, -1], 0, false)).toEqual([])
  })
})
