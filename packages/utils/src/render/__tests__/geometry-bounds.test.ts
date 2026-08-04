import { describe, expect, it, vi } from 'vitest'
import {
  type GeometryBoundsCarrier,
  type GeometryTransformMatrix,
  getElementGeometryLocalBounds,
  getElementGeometryWorldBounds,
  setElementGeometryLocalBounds
} from '../geometry-bounds.js'

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

  it('projects authored bounds through the current transform instead of a stale rendered transform', () => {
    const toGlobal = vi.fn((point: { x: number; y: number }) => ({
      x: point.x + 120,
      y: point.y + 80
    }))
    const element: GeometryBoundsCarrier & {
      toGlobal: typeof toGlobal
      worldTransform: GeometryTransformMatrix
    } = {
      toGlobal,
      worldTransform: {
        a: 1,
        b: 0,
        c: 0,
        d: 1,
        tx: 40,
        ty: 20
      }
    }

    setElementGeometryLocalBounds(element, {
      x: 0,
      y: 0,
      width: 240,
      height: 160
    })

    expect(getElementGeometryWorldBounds(element)).toEqual({
      x: 120,
      y: 80,
      width: 240,
      height: 160
    })
    expect(toGlobal).toHaveBeenCalledTimes(4)
  })
})
