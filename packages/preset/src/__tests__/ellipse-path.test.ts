import { describe, expect, it } from 'vitest'
import { buildEllipseLoop } from '../components/stroke-render/ellipse-path'

describe('ellipse path', () => {
  it('should run: build a dense closed loop for valid ellipse dimensions', () => {
    const loop = buildEllipseLoop(240, 180)

    expect(loop.length).toBeGreaterThanOrEqual(64)
    expect(loop.length % 4).toBe(0)
    expect(loop[0]).toEqual({ x: 240, y: 90 })
    expect(loop[Math.floor(loop.length / 4)].x).toBeCloseTo(120, 6)
    expect(loop[Math.floor(loop.length / 4)].y).toBeCloseTo(180, 6)
  })

  it('should not run: return no ellipse loop for non-positive dimensions', () => {
    expect(buildEllipseLoop(0, 180)).toEqual([])
    expect(buildEllipseLoop(240, 0)).toEqual([])
    expect(buildEllipseLoop(-10, 180)).toEqual([])
  })

  it('should run: increase sampling density for larger ellipse perimeters', () => {
    const smallLoop = buildEllipseLoop(48, 48)
    const largeLoop = buildEllipseLoop(480, 360)

    expect(largeLoop.length).toBeGreaterThan(smallLoop.length)
  })
})
