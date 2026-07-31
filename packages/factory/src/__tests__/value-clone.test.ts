import { describe, expect, it } from 'vitest'
import { deepFreezeValue, isDeeplyFrozenValue } from '../value-clone'

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

  it('recognizes Factory-owned frozen evidence without a recursive scan', () => {
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

    deepFreezeValue(evidence)
    const readsAfterOwnerFreeze = nestedReads

    expect(isDeeplyFrozenValue(evidence)).toBe(true)
    expect(nestedReads).toBe(readsAfterOwnerFreeze)
  })

  it('does not trust an externally shallow-frozen container as owner evidence', () => {
    const nested = { value: 1 }
    const external = Object.freeze({ nested })

    expect(isDeeplyFrozenValue(external)).toBe(false)
    expect(Object.isFrozen(nested)).toBe(false)
  })
})
