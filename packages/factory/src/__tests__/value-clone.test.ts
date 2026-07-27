import { describe, expect, it } from 'vitest'
import { deepFreezeValue } from '../value-clone'

describe('Factory owned deep-freeze evidence', () => {
  it('does not traverse the same immutable graph again at later handoff layers', () => {
    const nested = { value: 1 }
    let nestedReads = 0
    const evidence = {}
    Object.defineProperty(evidence, 'nested', {
      enumerable: true,
      get: () => {
        nestedReads += 1
        return nested
      }
    })

    expect(deepFreezeValue(evidence)).toBe(evidence)
    expect(nestedReads).toBe(1)
    expect(Object.isFrozen(evidence)).toBe(true)
    expect(Object.isFrozen(nested)).toBe(true)

    expect(deepFreezeValue(evidence)).toBe(evidence)
    expect(nestedReads).toBe(1)
  })
})
