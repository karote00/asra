import { describe, expect, it, vi } from 'vitest'
import { RenderGraphics } from '../types/render-object'
import {
  createOverlayLayerRegistration,
  sampleOverlayBezierPoints
} from '../layers/overlay-layer'

describe('overlay layer', () => {
  it('samples bezier overlay curves into a dense polyline including both endpoints', () => {
    const points = sampleOverlayBezierPoints(
      { x: 0, y: 0 },
      { x: 0, y: 120 },
      { x: 120, y: 120 },
      { x: 120, y: 0 }
    )

    expect(points.length).toBeGreaterThan(MIN_EXPECTED_BEZIER_POINTS)
    expect(points[0]).toEqual({ x: 0, y: 0 })
    expect(points.at(-1)).toEqual({ x: 120, y: 0 })
  })

  it('renders overlay beziers through sampled line segments instead of direct bezierCurveTo calls', () => {
    const moveToSpy = vi.spyOn(RenderGraphics.prototype, 'moveTo')
    const lineToSpy = vi.spyOn(RenderGraphics.prototype, 'lineTo')
    const bezierSpy = vi.spyOn(RenderGraphics.prototype, 'bezierCurveTo')

    const registration = createOverlayLayerRegistration({
      name: 'test-overlay',
      update: (canvas) => {
        canvas.bezierCurve(
          { x: 0, y: 0 },
          { x: 0, y: 120 },
          { x: 120, y: 120 },
          { x: 120, y: 0 },
          { width: 2, color: 0xffffff }
        )
      }
    })

    registration.update()

    expect(moveToSpy).toHaveBeenCalledTimes(1)
    expect(lineToSpy.mock.calls.length).toBeGreaterThan(10)
    expect(bezierSpy).not.toHaveBeenCalled()

    moveToSpy.mockRestore()
    lineToSpy.mockRestore()
    bezierSpy.mockRestore()
  })
})

const MIN_EXPECTED_BEZIER_POINTS = 12
