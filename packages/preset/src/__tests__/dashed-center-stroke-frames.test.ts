import { describe, expect, it } from 'vitest'
import { sliceDashedCenterStrokeFrames } from '../components/stroke-render/dashed-center-stroke-frames'

describe('dashed center stroke frame slicing', () => {
  it('should run: preserve non-uniform width probes through interval slicing on the shared runtime helper', () => {
    const frames = sliceDashedCenterStrokeFrames(
      [
        { x: 0, y: 0, widthLeft: 2, widthRight: 3 },
        { x: 50, y: 0, widthLeft: 4, widthRight: 5 },
        { x: 100, y: 0, widthLeft: 6, widthRight: 7 }
      ],
      false,
      25,
      75,
      false
    )

    expect(frames).toEqual([
      { x: 25, y: 0, widthLeft: 3, widthRight: 4 },
      { x: 50, y: 0, widthLeft: 4, widthRight: 5 },
      { x: 75, y: 0, widthLeft: 5, widthRight: 6 }
    ])
  })

  it('should run: keep seam-wrap slicing deterministic while preserving width probes', () => {
    const frames = sliceDashedCenterStrokeFrames(
      [
        { x: 0, y: 0, widthLeft: 2, widthRight: 2 },
        { x: 50, y: 0, widthLeft: 4, widthRight: 4 },
        { x: 50, y: 40, widthLeft: 6, widthRight: 6 },
        { x: 0, y: 40, widthLeft: 8, widthRight: 8 }
      ],
      true,
      110,
      10,
      true
    )

    expect(frames[0]?.widthLeft).toBeGreaterThan(6)
    expect(frames[frames.length - 1]?.widthLeft).toBeLessThan(3)
  })

  it('should run: preserve asymmetric variable-width probe data through seam-wrap slicing without assuming uniform widths', () => {
    const frames = sliceDashedCenterStrokeFrames(
      [
        { x: 0, y: 0, widthLeft: 2, widthRight: 5 },
        { x: 60, y: 0, widthLeft: 4, widthRight: 7 },
        { x: 60, y: 40, widthLeft: 6, widthRight: 9 },
        { x: 0, y: 40, widthLeft: 8, widthRight: 11 }
      ],
      true,
      115,
      15,
      true
    )

    expect(frames[0]?.widthLeft).toBeGreaterThan(6)
    expect(frames[0]?.widthRight).toBeGreaterThan(9)
    expect(frames[frames.length - 1]?.widthLeft).toBeLessThan(3)
    expect(frames[frames.length - 1]?.widthRight).toBeLessThan(6)
    expect(
      frames.some((frame) => Math.abs(frame.widthLeft - frame.widthRight) > 1e-6)
    ).toBe(true)
  })

  it('should run: preserve asymmetric variable-width probe data when one visible interval crosses an acute join', () => {
    const frames = sliceDashedCenterStrokeFrames(
      [
        { x: 0, y: 0, widthLeft: 2, widthRight: 5 },
        { x: 60, y: 0, widthLeft: 4, widthRight: 7 },
        { x: 90, y: 30, widthLeft: 8, widthRight: 11 }
      ],
      false,
      40,
      80,
      false
    )

    expect(frames).toHaveLength(3)
    expect(frames[0]?.x).toBe(40)
    expect(frames[0]?.y).toBe(0)
    expect(frames[0]?.widthLeft).toBeCloseTo(3.333333333333333)
    expect(frames[0]?.widthRight).toBeCloseTo(6.333333333333333)
    expect(frames[1]?.x).toBe(60)
    expect(frames[1]?.y).toBe(0)
    expect(frames[1]?.widthLeft).toBe(4)
    expect(frames[1]?.widthRight).toBe(7)
    expect(frames[2]?.x).toBeGreaterThan(74)
    expect(frames[2]?.y).toBeGreaterThan(14)
    expect(frames[2]?.widthLeft).toBeGreaterThan(5.8)
    expect(frames[2]?.widthRight).toBeGreaterThan(8.8)
    expect(
      frames.every((frame) => Math.abs(frame.widthLeft - frame.widthRight) > 1e-6)
    ).toBe(true)
  })
})
