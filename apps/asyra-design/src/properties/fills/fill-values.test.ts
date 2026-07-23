import { describe, expect, it } from 'vitest'
import { createDefaultFill } from '@asyra/utils'
import { applyFillPatch, getChangedFillPatch, hasFillPatch } from './fill-patch'
import { sortGradientStopsForPreview } from './gradient-stops'

describe('fill values', () => {
  it('applies and derives only changed fill fields', () => {
    const source = createDefaultFill({ color: '#000000', opacity: 1 })
    const next = applyFillPatch(source, { color: '#FFFFFF' })

    expect(next).toEqual({ ...source, color: '#FFFFFF' })
    expect(getChangedFillPatch(source, next)).toEqual({ color: '#FFFFFF' })
    expect(hasFillPatch({ color: '#FFFFFF' })).toBe(true)
    expect(hasFillPatch({})).toBe(false)
  })

  it('orders preview stops without changing their source indexes', () => {
    expect(
      sortGradientStopsForPreview([
        { position: 1, color: '#FFFFFF', opacity: 1 },
        { position: 0, color: '#000000', opacity: 1 }
      ])
    ).toEqual([
      {
        index: 1,
        stop: { position: 0, color: '#000000', opacity: 1 }
      },
      {
        index: 0,
        stop: { position: 1, color: '#FFFFFF', opacity: 1 }
      }
    ])
  })
})
