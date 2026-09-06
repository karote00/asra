import { expect, it, vi } from 'vitest'
import { liveFixture } from '../../../analysis/live/__tests__/fixtures'
import { runOfficialClearanceMethod } from '../../../analysis/methods/official-method'
import { completeAnalysisResult } from '../../../analysis/result'
import type { LiveState } from '../../../analysis/live/protocol'
import type { SimRuntime } from '../../../init/bootstrap'
import { LivePreview } from '../live-preview'
import { RecordedPlaybackEvidence } from '../recorded-playback-evidence'
import type { PlaybackView } from '../playback-view'

function recordedRun(state: 'clear' | 'finding') {
  const snapshot = liveFixture()
  const result = structuredClone(
    completeAnalysisResult(snapshot, runOfficialClearanceMethod(snapshot), {
      runId: 'recorded',
      startedAt: 0,
      endedAt: 1
    })
  )

  for (const pair of result.pairEvidence) {
    Object.assign(pair.evidence, {
      coverage: 'complete',
      leaves: [
        {
          start: 0,
          end: 8,
          lower: state === 'clear' ? 1 : 0,
          upper: 1,
          witnessTime: 4,
          penetration: state === 'finding',
          state,
          reason: 'accepted method evidence'
        }
      ]
    })
  }

  return { snapshot, result }
}

it('reuses all-pair clear evidence throughout playback without preparing live inputs or opening a task', async () => {
  const run = recordedRun('clear')
  const input = run.snapshot
  const create = vi.fn(() => input)
  const open = vi.fn()
  const api = { open } as unknown as SimRuntime['features']['live']
  const publish = vi.fn<(view: PlaybackView) => void>()
  const preview = new LivePreview(
    input.workcell,
    input.trajectory,
    input.interval,
    create,
    api,
    publish,
    Promise.resolve(),
    new RecordedPlaybackEvidence(run)
  )

  for (const time of [0, 1.234, 4.1, 8])
    preview.sample(time, { discontinuity: false })
  await Promise.resolve()

  expect(publish.mock.lastCall?.[0]).toMatchObject({
    time: 8,
    feedback: { origin: 'recorded', kind: 'clear', checkedTime: 8 }
  })
  expect(create).not.toHaveBeenCalled()
  expect(open).not.toHaveBeenCalled()

  preview.dispose()
})

it('checks an unclassified pose before a recorded witness and fences old live delivery when seeking to known evidence', async () => {
  const run = recordedRun('finding')
  const input = run.snapshot
  let notify: () => void = () => undefined
  let signal: AbortSignal | undefined
  const state: LiveState = {
    status: 'error',
    sample: null,
    error: 'Retired response'
  }
  const open = vi.fn(
    (_input: unknown, _time: number, options: { signal: AbortSignal }) =>
      new Promise<void>((resolve) => {
        signal = options.signal
        signal.addEventListener('abort', () => resolve(), { once: true })
      })
  )
  const api = {
    open,
    sample: vi.fn(),
    getState: () => state,
    subscribe: (listener: () => void) => {
      notify = listener
      return () => undefined
    }
  } as unknown as SimRuntime['features']['live']
  const publish = vi.fn<(view: PlaybackView) => void>()
  const preview = new LivePreview(
    input.workcell,
    input.trajectory,
    input.interval,
    () => input,
    api,
    publish,
    Promise.resolve(),
    new RecordedPlaybackEvidence(run)
  )

  preview.sample(3.888, { discontinuity: true })
  await Promise.resolve()

  expect(open).toHaveBeenCalledExactlyOnceWith(input, 3.888, { signal })

  preview.sample(4, { discontinuity: true })
  expect(signal?.aborted).toBe(true)
  expect(publish.mock.lastCall?.[0]).toMatchObject({
    time: 4,
    feedback: { origin: 'recorded', kind: 'collision', checkedTime: 4 }
  })

  const count = publish.mock.calls.length

  notify()
  expect(publish).toHaveBeenCalledTimes(count)
  expect(open).toHaveBeenCalledOnce()

  preview.dispose()
  await preview.completion
})
