import { expect, it } from 'vitest'
import { LiveEvidenceRecords } from '../records'
import { LIVE_LIMITS } from '../protocol'
import { liveFixture } from './fixtures'

it('bounds exact-time observations, rejects retired owners and does not leak another experiment records', () => {
  const records = new LiveEvidenceRecords()
  const input = liveFixture()

  records.replace(input, 'current')

  for (let time = 0; time <= LIVE_LIMITS.maxRecordedSamples; time++)
    records.record(input, {
      time,
      pairs: [],
      totalPairCount: input.pairs.length,
      complete: false,
      error: 'not checked'
    })

  expect(records.getAll()).toHaveLength(LIVE_LIMITS.maxRecordedSamples)
  expect(records.get(0)).toBeUndefined()
  expect(records.getAll('other')).toBe(records.getAll('other'))
  expect(records.getAll('other')).toHaveLength(0)

  records.replace(null)

  expect(records.getAll()).toHaveLength(0)
  expect(() =>
    records.record(input, {
      time: 0,
      pairs: [],
      totalPairCount: 1,
      complete: false,
      error: null
    })
  ).toThrow('Retired')
})
