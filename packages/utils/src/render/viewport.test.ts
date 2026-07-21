import { describe, expect, it } from 'vitest'
import { rectFromPoints } from './viewport'

describe('rectFromPoints', () => {
  it('normalizes positive and negative pointer directions into one Rect', () => {
    expect(rectFromPoints({ x: 10, y: 20 }, { x: 35, y: 55 })).toEqual({
      x: 10,
      y: 20,
      width: 25,
      height: 35
    })
    expect(rectFromPoints({ x: 35, y: 55 }, { x: 10, y: 20 })).toEqual({
      x: 10,
      y: 20,
      width: 25,
      height: 35
    })
  })
})
