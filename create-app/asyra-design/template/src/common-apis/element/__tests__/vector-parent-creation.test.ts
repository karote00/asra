import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../contexts', () => ({
  default: {},
  render: null,
  sceneTree: {}
}))

import { vectorApis } from '../vector-apis'

describe('Vector direct parent creation boundary', () => {
  it('does not expose a second plural element creation entry', () => {
    expect(
      Object.prototype.hasOwnProperty.call(
        vectorApis,
        'createVectorElementsInParent'
      )
    ).toBe(false)
  })
})
