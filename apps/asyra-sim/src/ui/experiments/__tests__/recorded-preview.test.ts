import { expect, it, vi } from 'vitest'
import { liveFixture } from '../../../analysis/live/__tests__/fixtures'
import { runOfficialClearanceMethod } from '../../../analysis/methods/official-method'
import { completeAnalysisResult } from '../../../analysis/result'
import { RecordedPreview } from '../recorded-preview'
import { playbackHighlight } from '../playback-highlight'
import type { PlaybackView } from '../playback-view'

it('replays a recorded witness without treating its entire finding interval as continuous collision', () => {
  const snapshot = liveFixture()
  const result = structuredClone(
    completeAnalysisResult(snapshot, runOfficialClearanceMethod(snapshot), {
      runId: 'recorded',
      startedAt: 0,
      endedAt: 1
    })
  )
  const pair = result.pairEvidence[0]

  // Accepted finding semantics: one observed witness in an enclosing interval.
  Object.assign(pair.evidence, {
    lower: 0,
    upper: 0,
    coverage: 'complete',
    leaves: [
      {
        start: 0,
        end: 8,
        lower: 0,
        upper: 0,
        witnessTime: 4,
        penetration: true,
        state: 'finding',
        reason: 'observed contact'
      }
    ]
  })
  Object.assign(result, { summary: 'issue-found', findingPairCount: 1 })

  Object.assign(result.pairEvidence[1].evidence, {
    lower: 0,
    upper: 0.01,
    coverage: 'complete',
    leaves: [
      {
        start: 0,
        end: 8,
        lower: 0,
        upper: 0.01,
        witnessTime: 4,
        penetration: false,
        state: 'finding',
        reason: 'clearance only'
      }
    ]
  })

  const publish = vi.fn<(view: PlaybackView) => void>()
  const preview = new RecordedPreview(
    snapshot.workcell,
    { snapshot, result },
    publish
  )
  const onCollision = vi.fn(() => true)
  const lastView = () => {
    const value = publish.mock.lastCall?.[0]

    if (!value) throw new Error('Missing playback projection')

    return value
  }

  preview.sample(0, { discontinuity: false, onCollision })
  expect(playbackHighlight(lastView())).toBeUndefined()

  preview.sample(4.1, { discontinuity: false, onCollision })
  expect(onCollision).toHaveBeenCalledExactlyOnceWith(4)
  expect(lastView()).toMatchObject({
    time: 4,
    feedback: { origin: 'recorded', kind: 'collision' }
  })
  expect(playbackHighlight(lastView())?.bodyIds).toHaveLength(2)

  preview.sample(5, { discontinuity: true, onCollision })
  expect(playbackHighlight(lastView())).toBeUndefined()

  preview.dispose()
  preview.sample(4, { discontinuity: true, onCollision })
  expect(publish).toHaveBeenCalledTimes(3)
})
