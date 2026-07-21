import { describe, expect, it } from 'vitest'
import { setOwnEnumerableValue } from '../own-property'

describe('setOwnEnumerableValue', () => {
  it('materializes special keys as writable enumerable own values', () => {
    const target: Record<string, unknown> = {}

    setOwnEnumerableValue(target, '__proto__', undefined)

    expect(Object.getPrototypeOf(target)).toBe(Object.prototype)
    expect(Object.prototype.hasOwnProperty.call(target, '__proto__')).toBe(true)
    expect(Object.getOwnPropertyDescriptor(target, '__proto__')).toEqual({
      configurable: true,
      enumerable: true,
      value: undefined,
      writable: true
    })
  })
})
