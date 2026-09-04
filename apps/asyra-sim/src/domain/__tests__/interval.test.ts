import { describe, expect, it } from 'vitest'
import {
  iadd,
  idiv,
  imul,
  interval,
  isinCos,
  isqrt,
  isquare,
  nextDown,
  nextUp
} from '../interval'

describe('outward arithmetic', () => {
  it('steps through adjacent binary64 values including subnormals and signs', () => {
    expect(nextUp(0)).toBe(Number.MIN_VALUE)
    expect(nextDown(0)).toBe(-Number.MIN_VALUE)
    expect(nextUp(-Number.MIN_VALUE)).toBe(-0)
    expect(nextDown(Number.MIN_VALUE)).toBe(0)
    for (const value of [-1000, -1, -0.1, 0.1, 1, 1000]) {
      expect(nextDown(nextUp(value))).toBe(value)
      expect(nextUp(value)).toBeGreaterThan(value)
      expect(nextDown(value)).toBeLessThan(value)
    }
  })
  it('encloses rational addition, multiplication and division', () => {
    const third = idiv(interval(1), interval(3))
    expect(third[0] * 3).toBeLessThan(1)
    expect(third[1] * 3).toBeGreaterThan(1)
    const result = iadd(imul(third, interval(3)), interval(-1))
    expect(result[0]).toBeLessThanOrEqual(0)
    expect(result[1]).toBeGreaterThanOrEqual(0)
    expect(() => idiv(interval(1), interval(-1, 1))).toThrow('zero')
    expect(() => interval(NaN)).toThrow()
    expect(() => imul(interval(1e308), interval(1e308))).toThrow()
  })
  it('verifies square-root endpoints, including values near zero', () => {
    for (const value of [0, 1e-16, 0.0001, 2, 9, 1e12]) {
      const root = isqrt(interval(value))
      expect(isquare(interval(root[0]))[1]).toBeLessThanOrEqual(
        value === 0 ? Number.MIN_VALUE : value
      )
      expect(isquare(interval(root[1]))[0]).toBeGreaterThanOrEqual(value)
      expect(root[1] - root[0]).toBeLessThan(1e-8 * Math.max(1, root[1]))
    }
  })
  it('encloses subnormal square roots with exact integer-square comparisons', () => {
    const decode = (value: number): readonly [bigint, number] => {
      const view = new DataView(new ArrayBuffer(8))
      view.setFloat64(0, value)
      const bits = view.getBigUint64(0),
        exponent = Number((bits >> 52n) & 2047n),
        fraction = bits & ((1n << 52n) - 1n)
      return exponent === 0
        ? [fraction, -1074]
        : [(1n << 52n) + fraction, exponent - 1075]
    }
    const compareSquare = (root: number, value: number): number => {
      const [r, re] = decode(root),
        [v, ve] = decode(value),
        shift = 2 * re - ve
      const left = shift >= 0 ? (r * r) << BigInt(shift) : r * r,
        right = shift >= 0 ? v : v << BigInt(-shift)
      if (left < right) return -1
      return left > right ? 1 : 0
    }
    for (const value of [Number.MIN_VALUE, Number.MIN_VALUE * 7, 1e-310]) {
      const [lo, hi] = isqrt(interval(value))
      expect(compareSquare(lo, value)).toBeLessThanOrEqual(0)
      expect(compareSquare(hi, value)).toBeGreaterThanOrEqual(0)
    }
  })
  it('encloses independent exact-angle values and the supported native reference grid', () => {
    const check = (angle: number, sine: number, cosine: number) => {
      const [s, c] = isinCos(interval(angle))
      expect(s[0]).toBeLessThanOrEqual(sine)
      expect(s[1]).toBeGreaterThanOrEqual(sine)
      expect(c[0]).toBeLessThanOrEqual(cosine)
      expect(c[1]).toBeGreaterThanOrEqual(cosine)
      expect(s[1] - s[0]).toBeLessThan(1e-7)
      expect(c[1] - c[0]).toBeLessThan(1e-7)
    }
    check(0, 0, 1)
    // Math.PI is a binary64 approximation: these checks use a covering interval.
    const [s, c] = isinCos(interval(nextDown(Math.PI / 2), nextUp(Math.PI / 2)))
    expect(s[0]).toBeLessThanOrEqual(1)
    expect(s[1]).toBeGreaterThanOrEqual(1)
    expect(c[0]).toBeLessThanOrEqual(0)
    expect(c[1]).toBeGreaterThanOrEqual(0)
    for (let n = -1000; n <= 1000; n++)
      check(n / 10, Math.sin(n / 10), Math.cos(n / 10))
  })
  it('encloses all phases of a wide input interval', () => {
    const [s, c] = isinCos(interval(-100, 100))
    expect(s).toEqual([-1, 1])
    expect(c).toEqual([-1, 1])
  })
})
