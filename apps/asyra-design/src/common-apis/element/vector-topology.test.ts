import { describe, expect, it } from 'vitest'
import { isVectorTopology } from './vector-topology'

describe('isVectorTopology', () => {
  it('rejects array-backed topology collections', () => {
    expect(
      isVectorTopology({
        points: [],
        segments: [],
        networks: []
      })
    ).toBe(false)
  })

  it('accepts record-backed topology collections', () => {
    expect(
      isVectorTopology({
        points: {},
        segments: {},
        networks: {}
      })
    ).toBe(true)
  })
})
