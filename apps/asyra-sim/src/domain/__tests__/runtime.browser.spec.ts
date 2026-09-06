import { expect, test } from '@playwright/test'

function exactPositive(value: number): readonly [bigint, number] {
  const view = new DataView(new ArrayBuffer(8))
  view.setFloat64(0, value)
  const bits = view.getBigUint64(0),
    exponent = Number((bits >> 52n) & 2047n),
    fraction = bits & ((1n << 52n) - 1n)
  return exponent === 0
    ? [fraction, -1074]
    : [(1n << 52n) + fraction, exponent - 1075]
}
function compareExactSquare(root: number, value: number): number {
  const [r, re] = exactPositive(root),
    [v, ve] = exactPositive(value),
    shift = 2 * re - ve
  const left = shift >= 0 ? (r * r) << BigInt(shift) : r * r,
    right = shift >= 0 ? v : v << BigInt(-shift)
  if (left < right) return -1
  return left > right ? 1 : 0
}

test('Chromium preserves binary64 subnormals and certified interval operations', async ({
  page
}, testInfo) => {
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Local runtime ready')
  const proof = await page.evaluate(async () => {
    const path = '/src/domain/interval.ts'
    const m = (await import(path)) as typeof import('../interval')
    const thirds = m.idiv(m.interval(1), m.interval(3))
    const residual = m.iadd(m.imul(thirds, m.interval(3)), m.interval(-1))
    const underflow = m.imul(m.interval(1e-200), m.interval(1e-150))
    const trig = m.isinCos(m.interval(0))
    return {
      userAgent: navigator.userAgent,
      min: Number.MIN_VALUE,
      nextZero: m.nextUp(0),
      beforeMin: m.nextDown(Number.MIN_VALUE),
      oneUp: m.nextUp(1),
      residual,
      underflow,
      trig,
      roots: [Number.MIN_VALUE, Number.MIN_VALUE * 7, 1e-310, 2, 9].map(
        (value) => ({ value, bounds: m.isqrt(m.interval(value)) })
      )
    }
  })
  expect(proof.min).toBe(5e-324)
  expect(proof.nextZero).toBe(proof.min)
  expect(proof.beforeMin).toBe(0)
  expect(proof.oneUp).toBe(1 + 2 ** -52)
  expect(proof.residual[0]).toBeLessThanOrEqual(0)
  expect(proof.residual[1]).toBeGreaterThanOrEqual(0)
  expect(proof.underflow).toEqual([-Number.MIN_VALUE, Number.MIN_VALUE])
  expect(proof.trig[0][0]).toBeLessThanOrEqual(0)
  expect(proof.trig[0][1]).toBeGreaterThanOrEqual(0)
  expect(proof.trig[1][0]).toBeLessThanOrEqual(1)
  expect(proof.trig[1][1]).toBeGreaterThanOrEqual(1)
  for (const { value, bounds } of proof.roots) {
    expect(compareExactSquare(bounds[0], value)).toBeLessThanOrEqual(0)
    expect(compareExactSquare(bounds[1], value)).toBeGreaterThanOrEqual(0)
  }
  await testInfo.attach('numerical-runtime', {
    contentType: 'application/json',
    body: JSON.stringify(proof)
  })
})

test('Chromium uses the same stable joint direction algebra for preview and interval poses', async ({
  page
}) => {
  await page.goto('/')
  const proof = await page.evaluate(async () => {
    const path = '/src/domain/kinematic-algebra.ts'
    const m = (await import(path)) as typeof import('../kinematic-algebra')
    const ordinary = m
      .poseOperations(m.numberAlgebra)
      .direction([Number.MAX_VALUE, 0, 0])
    const formal = m
      .poseOperations(m.intervalAlgebra)
      .direction([Number.MAX_VALUE, 0, 0])
    return { ordinary, formal }
  })
  expect(proof.ordinary).toEqual([1, 0, 0])
  for (const [index, value] of [1, 0, 0].entries()) {
    expect(proof.formal[index][0]).toBeLessThanOrEqual(value)
    expect(proof.formal[index][1]).toBeGreaterThanOrEqual(value)
  }
})
