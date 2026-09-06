import { expect, it } from 'vitest'
import { runOfficialClearanceMethod } from '../../methods/official-method'
import { sampleSnapshot, validateLiveEvidence } from '../sample'
import { liveFixture } from './fixtures'

it('checks one exact time with unchanged full geometry, scope and numerical settings', () => {
  const input = liveFixture()
  const sampled = sampleSnapshot(input, 4)

  expect(sampled.interval).toEqual([4, 4])
  expect(sampled.workcell).toBe(input.workcell)
  expect(sampled.trajectory).toBe(input.trajectory)
  expect(sampled.pairs).toBe(input.pairs)
  expect(sampled.method).toBe(input.method)
  expect(input.interval).toEqual([0, 8])

  const evidence = runOfficialClearanceMethod(sampled)
  const feedback = validateLiveEvidence(input, 4, evidence)

  expect(feedback.time).toBe(4)
  expect(feedback.pairs).toHaveLength(input.pairs.length)
  expect(feedback.complete).toBe(true)
  expect(feedback).not.toHaveProperty('runId')
  expect(feedback).not.toHaveProperty('verdict')
})

it('rejects wrong source, time and incomplete successful evidence', () => {
  const input = liveFixture()
  const evidence = runOfficialClearanceMethod(sampleSnapshot(input, 4))

  for (const time of [-1, 9, NaN, Infinity])
    expect(() => sampleSnapshot(input, time)).toThrow()

  expect(() => validateLiveEvidence(input, 3, evidence)).toThrow()
  expect(() =>
    validateLiveEvidence(input, 4, { ...evidence, snapshotId: 'other' })
  ).toThrow()
  expect(() =>
    validateLiveEvidence(input, 4, { ...evidence, pairs: [] })
  ).toThrow()
})
