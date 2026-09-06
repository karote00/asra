import { expect, it } from 'vitest'
import { playbackHighlight } from '../playback-highlight'
import type { PlaybackView } from '../playback-view'
import { liveFixture } from '../../../analysis/live/__tests__/fixtures'
import { runOfficialClearanceMethod } from '../../../analysis/methods/official-method'
import {
  sampleSnapshot,
  validateLiveEvidence
} from '../../../analysis/live/sample'
import { playbackFeedback } from '../playback-feedback'

it('does not mark clearance-only pairs red when another pair collides', () => {
  const input = liveFixture()
  const sample = structuredClone(
    validateLiveEvidence(
      input,
      4,
      runOfficialClearanceMethod(sampleSnapshot(input, 4))
    )
  )
  const pairs = sample.pairs.slice(0, 2)

  pairs.forEach((pair, index) =>
    Object.assign(pair.evidence, {
      leaves: [
        {
          start: 4,
          end: 4,
          lower: 0,
          upper: 0,
          witnessTime: 4,
          penetration: index === 0,
          state: 'finding',
          reason: 'observed'
        }
      ]
    })
  )

  const feedback = playbackFeedback(input, { ...sample, pairs })
  const source = input.pairs[0]

  expect(feedback.kind).toBe('collision')
  expect(feedback.bodyIds).toEqual([source.a.bodyId, source.b.bodyId])
  expect(feedback.pairNames).toHaveLength(1)
})

it('highlights both confirmed parts only at the checked pose and never colors unknown geometry as clear', () => {
  const input = liveFixture()
  const view: PlaybackView = {
    workcell: input.workcell,
    joints: {},
    time: 4,
    historical: false,
    bodyIds: [],
    feedback: {
      kind: 'collision',
      checkedTime: 4,
      bodyIds: ['a', 'b'],
      pairNames: [],
      complete: true,
      totalPairCount: 1,
      message: ''
    }
  }

  expect(playbackHighlight(view)).toEqual({
    bodyIds: ['a', 'b'],
    color: 0xff625e
  })
  expect(playbackHighlight({ ...view, time: 4.01 })).toBeUndefined()

  if (!view.feedback) throw new Error('Missing fixture feedback')
  expect(
    playbackHighlight({
      ...view,
      feedback: { ...view.feedback, kind: 'unresolved' }
    })
  ).toBeUndefined()
  expect(
    playbackHighlight({
      ...view,
      feedback: { ...view.feedback, kind: 'clearance' }
    })?.color
  ).toBe(0xffbd59)
  expect(playbackHighlight(null)).toBeUndefined()
})
