import { vi } from 'vitest'
import { liveFixture } from '../../../analysis/live/__tests__/fixtures'
import type { LiveSample, LiveState } from '../../../analysis/live/protocol'
import { runOfficialClearanceMethod } from '../../../analysis/methods/official-method'
import {
  sampleSnapshot,
  validateLiveEvidence
} from '../../../analysis/live/sample'
import type { SimRuntime } from '../../../init/bootstrap'
import { LivePreview } from '../live-preview'
import type { PlaybackView } from '../playback-view'

/** UI-owner fixture: numerical correctness belongs to the method's own tests. */
export function seekFixture() {
  const input = liveFixture()
  const template = validateLiveEvidence(
    input,
    0,
    runOfficialClearanceMethod(sampleSnapshot(input, 0))
  )
  const records = new Map<number, LiveSample>()
  let state: LiveState = { status: 'idle', sample: null, error: null }
  let notify: () => void = () => undefined
  const publish = vi.fn<(view: PlaybackView) => void>()
  const create = vi.fn(() => input)
  const sample = vi.fn((time: number) => {
    const known = records.get(time)

    if (known) {
      state = { status: 'ready', sample: known, error: null }
      notify()
    }
  })
  const api = {
    subscribe: (listener: () => void) => {
      notify = listener

      return () => {
        notify = () => undefined
      }
    },
    getState: () => state,
    sample,
    open: (_input: unknown, time: number, options: { signal: AbortSignal }) =>
      new Promise<void>((resolve) => {
        options.signal.addEventListener('abort', () => resolve(), {
          once: true
        })
        sample(time)
      })
  } as unknown as SimRuntime['features']['live']
  const preview = new LivePreview(
    input.workcell,
    input.trajectory,
    input.interval,
    create,
    api,
    publish
  )
  const deliver = (
    time: number,
    kind: 'clear' | 'clearance' | 'collision',
    provisional = false
  ) => {
    const result = structuredClone(template)
    result.time = time
    result.complete = !provisional

    for (const pair of result.pairs)
      for (const leaf of pair.evidence.leaves)
        Object.assign(leaf, {
          start: time,
          end: time,
          witnessTime: time,
          state: 'clear',
          penetration: false
        })

    if (kind !== 'clear')
      Object.assign(result.pairs[0].evidence.leaves[0], {
        state: 'finding',
        penetration: kind === 'collision'
      })

    if (!provisional) records.set(time, result)

    state = {
      status: provisional ? 'checking' : 'ready',
      sample: result,
      error: null
    }
    notify()
  }

  return {
    preview,
    publish,
    create,
    sample,
    input,
    deliver,
    latest: () => {
      const view = publish.mock.lastCall?.[0]

      if (!view) throw new Error('Preview has not published a frame')

      return view
    },
    fail: () => {
      state = { status: 'error', sample: null, error: 'Worker unavailable' }
      notify()
    }
  }
}
