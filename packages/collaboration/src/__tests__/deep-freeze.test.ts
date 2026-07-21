import { describe, expect, it } from 'vitest'
import { deepFreeze } from '../deep-freeze'

describe('deepFreeze', () => {
  it('freezes nested records and arrays while preserving circular identity', () => {
    const value: {
      nested: { values: string[] }
      self?: unknown
    } = {
      nested: { values: ['value'] }
    }
    value.self = value

    const frozen = deepFreeze(value)

    expect(frozen).toBe(value)
    expect(frozen.self).toBe(frozen)
    expect(Object.isFrozen(frozen)).toBe(true)
    expect(Object.isFrozen(frozen.nested)).toBe(true)
    expect(Object.isFrozen(frozen.nested.values)).toBe(true)
  })
})
