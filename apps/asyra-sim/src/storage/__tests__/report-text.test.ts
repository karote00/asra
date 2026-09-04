import { expect, it } from 'vitest'
import { collectReportText } from '../report-text'

it('counts UTF-8 bytes, including separators, and accepts the exact boundary', () => {
  expect(collectReportText(['é', '\r\n', '界'], 7)).toBe('é\r\n界')
  expect(() => collectReportText(['é', '\r\n', '界'], 6)).toThrow(
    'Report exceeds'
  )
  expect(collectReportText([], 1)).toBe('')
})

it('stops consuming a lazy report as soon as the byte allowance is exceeded', () => {
  let consumed = 0,
    closed = false
  function* parts() {
    try {
      for (let i = 0; i < 1000; i++) {
        consumed++
        yield 'abcd'
      }
    } finally {
      closed = true
    }
  }
  expect(() => collectReportText(parts(), 9)).toThrow('Report exceeds')
  expect(consumed).toBe(3)
  expect(closed).toBe(true)
})

it('never permits a caller to raise or disable the hard report limit', () => {
  for (const limit of [0, -1, 0.5, NaN, Infinity, 64 * 1024 * 1024 + 1])
    expect(() => collectReportText([], limit)).toThrow(
      'Invalid report byte limit'
    )
})
