import { describe, expect, it } from 'vitest'
import { resolveSyntheticVectorHandlePosition } from '../vector/synthetic-handle'

describe('resolveSyntheticVectorHandlePosition', () => {
  it('preserves an existing visible handle', () => {
    expect(
      resolveSyntheticVectorHandlePosition(
        { x: 0, y: 0 },
        { x: 10, y: 5 },
        { x: 30, y: 0 },
        null
      )
    ).toEqual({ x: 10, y: 5 })
  })

  it('derives a bounded handle toward the neighboring anchor', () => {
    expect(
      resolveSyntheticVectorHandlePosition(
        { x: 0, y: 0 },
        null,
        { x: 90, y: 0 },
        null
      )
    ).toEqual({ x: 30, y: 0 })
  })

  it('does not invent a handle without a usable neighboring anchor', () => {
    expect(
      resolveSyntheticVectorHandlePosition({ x: 0, y: 0 }, null, null, null)
    ).toBeNull()
  })
})
