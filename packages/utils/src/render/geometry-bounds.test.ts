import { describe, expect, it, vi } from 'vitest'
import {
  type GeometryBoundsCarrier,
  type GeometryTransformMatrix,
  getElementGeometryLocalBounds,
  getElementGeometryWorldBounds,
  setElementGeometryLocalBounds
} from './geometry-bounds'

describe('geometry bounds helpers', () => {
  it('prefers authored geometry bounds over rendered local bounds', () => {
    const getLocalBounds = vi.fn(() => ({
      x: -20,
      y: -20,
      width: 140,
      height: 90
    }))
    const element: GeometryBoundsCarrier & {
      getLocalBounds: typeof getLocalBounds
    } = { getLocalBounds }

    setElementGeometryLocalBounds(element, {
      x: 0,
      y: 0,
      width: 100,
      height: 50
    })

    expect(getElementGeometryLocalBounds(element)).toEqual({
      x: 0,
      y: 0,
      width: 100,
      height: 50
    })
    expect(getLocalBounds).not.toHaveBeenCalled()
  })

  it('converts local geometry bounds into world axis-aligned bounds', () => {
    const getBounds = vi.fn(() => ({
      x: -30,
      y: -30,
      width: 160,
      height: 120
    }))
    const element: GeometryBoundsCarrier & {
      getBounds: typeof getBounds
      worldTransform: GeometryTransformMatrix
    } = {
      getBounds,
      worldTransform: {
        a: 0,
        b: 1,
        c: -1,
        d: 0,
        tx: 20,
        ty: 10
      }
    }

    setElementGeometryLocalBounds(element, {
      x: 0,
      y: 0,
      width: 100,
      height: 50
    })

    expect(getElementGeometryWorldBounds(element)).toEqual({
      x: -30,
      y: 10,
      width: 50,
      height: 100
    })
    expect(getBounds).not.toHaveBeenCalled()
  })
})
