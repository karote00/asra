import { describe, expect, it } from 'vitest'
import {
  clonePropertyDefinitionRecord,
  clonePropertyDefinitionValue
} from '../registries/property-definition-value'

describe('property definition value cloning', () => {
  it('detaches nested record and array values', () => {
    const source = { nested: { values: [1, { key: 'value' }] } }
    const clone = clonePropertyDefinitionRecord(source)

    expect(clone).toEqual(source)
    expect(clone).not.toBe(source)
    expect(clone.nested).not.toBe(source.nested)
  })

  it('preserves non-record definition values by identity', () => {
    const validate = () => true

    expect(clonePropertyDefinitionValue(validate)).toBe(validate)
    expect(clonePropertyDefinitionRecord(undefined)).toBeUndefined()
  })
})
