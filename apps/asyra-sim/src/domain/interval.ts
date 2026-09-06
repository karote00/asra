/** Closed real intervals. Every arithmetic result encloses binary64 rounding. */
export type Interval = readonly [number, number]
const bits = new DataView(new ArrayBuffer(8))

export function nextUp(value: number): number {
  if (Number.isNaN(value) || value === Infinity) return value
  if (value === 0) return Number.MIN_VALUE
  bits.setFloat64(0, value)
  bits.setBigUint64(0, bits.getBigUint64(0) + (value > 0 ? 1n : -1n))
  return bits.getFloat64(0)
}
export const nextDown = (value: number): number => -nextUp(-value)
export function interval(lo: number, hi = lo): Interval {
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo > hi)
    throw new Error('Invalid numerical interval')
  return [lo, hi]
}
const outward = (lo: number, hi: number): Interval =>
  interval(nextDown(lo), nextUp(hi))
export const iadd = (a: Interval, b: Interval): Interval =>
  outward(a[0] + b[0], a[1] + b[1])
export const ineg = (a: Interval): Interval => [-a[1], -a[0]]
export const isub = (a: Interval, b: Interval): Interval => iadd(a, ineg(b))
export function imul(a: Interval, b: Interval): Interval {
  const products = [a[0] * b[0], a[0] * b[1], a[1] * b[0], a[1] * b[1]]
  return outward(Math.min(...products), Math.max(...products))
}
export function idiv(a: Interval, b: Interval): Interval {
  if (b[0] <= 0 && b[1] >= 0) throw new Error('Interval division crosses zero')
  return imul(a, outward(1 / b[1], 1 / b[0]))
}
export function isquare(a: Interval): Interval {
  const hi = Math.max(a[0] * a[0], a[1] * a[1])
  const lo = a[0] <= 0 && a[1] >= 0 ? 0 : Math.min(a[0] * a[0], a[1] * a[1])
  return [Math.max(0, nextDown(lo)), nextUp(hi)]
}
export function iabs(a: Interval): Interval {
  if (a[0] >= 0) return a
  if (a[1] <= 0) return ineg(a)
  return [0, Math.max(-a[0], a[1])]
}
export const imid = (a: Interval): number => a[0] / 2 + a[1] / 2

function sqrtEndpoint(value: number, upper: boolean): number {
  if (value === 0) return 0
  if (value < 2 ** -1022) {
    // Scaling is exact for binary64 subnormals; certify in the normal range.
    const scaled = sqrtEndpoint(value * 2 ** 1022, upper) * 2 ** -511
    return upper ? nextUp(scaled) : nextDown(scaled)
  }
  let guess = Math.sqrt(value)
  for (let index = 0; index < 128; index++) {
    const squared = isquare(interval(guess))
    if (upper ? squared[0] >= value : squared[1] <= value) return guess
    guess = upper ? nextUp(guess) : nextDown(guess)
  }
  throw new Error('Runtime square root failed enclosure validation')
}
export function isqrt(a: Interval): Interval {
  if (a[0] < 0) throw new Error('Negative square-root interval')
  return interval(sqrtEndpoint(a[0], false), sqrtEndpoint(a[1], true))
}

export function isinCos(input: Interval): readonly [Interval, Interval] {
  if (Math.max(Math.abs(input[0]), Math.abs(input[1])) > 100)
    throw new Error('Trigonometric envelope exceeded')
  let x = input,
    halvings = 0
  while (Math.max(Math.abs(x[0]), Math.abs(x[1])) > 0.25) {
    x = imul(x, interval(0.5))
    halvings++
  }
  const square = isquare(x)
  let sin = x,
    cos: Interval = interval(1),
    sinTerm = x,
    cosTerm: Interval = interval(1)
  for (let n = 1; n <= 12; n++) {
    sinTerm = ineg(idiv(imul(sinTerm, square), interval(2 * n * (2 * n + 1))))
    cosTerm = ineg(idiv(imul(cosTerm, square), interval((2 * n - 1) * 2 * n)))
    sin = iadd(sin, sinTerm)
    cos = iadd(cos, cosTerm)
  }
  const sinNext = iabs(idiv(imul(sinTerm, square), interval(26 * 27)))[1]
  const cosNext = iabs(idiv(imul(cosTerm, square), interval(25 * 26)))[1]
  sin = iadd(sin, interval(-sinNext, sinNext))
  cos = iadd(cos, interval(-cosNext, cosNext))
  for (let n = 0; n < halvings; n++) {
    const nextSin = imul(interval(2), imul(sin, cos))
    cos = isub(interval(1), imul(interval(2), isquare(sin)))
    sin = nextSin
    sin = interval(Math.max(-1, sin[0]), Math.min(1, sin[1]))
    cos = interval(Math.max(-1, cos[0]), Math.min(1, cos[1]))
  }
  return [sin, cos]
}
