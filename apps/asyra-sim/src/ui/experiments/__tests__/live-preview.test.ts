import { expect, it, vi } from 'vitest'
import { liveFixture } from '../../../analysis/live/__tests__/fixtures'
import { runOfficialClearanceMethod } from '../../../analysis/methods/official-method'
import {
  sampleSnapshot,
  validateLiveEvidence
} from '../../../analysis/live/sample'
import type { LiveState } from '../../../analysis/live/protocol'
import type { SimRuntime } from '../../../init/bootstrap'
import { LivePreview } from '../live-preview'
import type { PlaybackView } from '../playback-view'
import { playbackHighlight } from '../playback-highlight'

it('publishes a delayed collision without stopping or rewinding the current playhead', async () => {
  const input = liveFixture()
  const sample = structuredClone(
    validateLiveEvidence(
      input,
      3.2,
      runOfficialClearanceMethod(sampleSnapshot(input, 3.2))
    )
  )

  Object.assign(sample.pairs[0].evidence.leaves[0], {
    state: 'finding',
    penetration: true,
    witnessTime: 3.2
  })

  let state: LiveState = { status: 'idle', sample: null, error: null }
  let notify: () => void = () => undefined
  let signal: AbortSignal | undefined
  const api = {
    subscribe: (listener: () => void) => {
      notify = listener
      return () => {
        notify = () => undefined
      }
    },
    getState: () => state,
    open: (_input: unknown, _time: number, options: { signal: AbortSignal }) =>
      new Promise<void>((resolve) => {
        signal = options.signal
        signal.addEventListener('abort', () => resolve(), { once: true })
      }),
    sample: vi.fn()
  } as unknown as SimRuntime['features']['live']
  const publish = vi.fn<(value: PlaybackView) => void>()
  const preview = new LivePreview(
    input.workcell,
    input.trajectory,
    input.interval,
    () => input,
    api,
    publish
  )
  const options = { discontinuity: false, onCollision: vi.fn(() => true) }

  preview.sample(3.2, options)
  await Promise.resolve()
  preview.sample(3.37, options)

  state = { status: 'ready', sample, error: null }
  notify()

  expect(publish.mock.lastCall?.[0].time).toBe(3.37)
  expect(publish.mock.lastCall?.[0].feedback?.checkedTime).toBe(3.2)
  expect(
    playbackHighlight(publish.mock.lastCall?.[0] ?? null)?.bodyIds
  ).toHaveLength(2)
  expect(signal?.aborted).toBe(false)
  expect(options.onCollision).not.toHaveBeenCalled()

  preview.sample(3.51, options)
  expect(publish.mock.lastCall?.[0].time).toBe(3.51)

  preview.sample(1, { ...options, discontinuity: true })
  expect(playbackHighlight(publish.mock.lastCall?.[0] ?? null)).toBeUndefined()

  preview.dispose()
  await preview.completion
})

it('presents the same cached sample again after seeking without stale checking feedback', async () => {
  const input = liveFixture()
  const sample = validateLiveEvidence(
    input,
    0,
    runOfficialClearanceMethod(sampleSnapshot(input, 0))
  )
  let state: LiveState = { status: 'idle', sample: null, error: null }
  let notify: () => void = () => undefined
  const deliver = () => {
    state = { status: 'ready', sample, error: null }
    notify()
  }
  const api = {
    subscribe: (listener: () => void) => {
      notify = listener
      return () => {
        notify = () => undefined
      }
    },
    getState: () => state,
    open: (_input: unknown, _time: number, options: { signal: AbortSignal }) =>
      new Promise<void>((resolve) => {
        options.signal.addEventListener('abort', () => resolve(), {
          once: true
        })
        deliver()
      }),
    sample: deliver
  } as unknown as SimRuntime['features']['live']
  const publish = vi.fn<(value: PlaybackView) => void>()
  const preview = new LivePreview(
    input.workcell,
    input.trajectory,
    input.interval,
    () => input,
    api,
    publish
  )
  const options = { discontinuity: true, onCollision: () => false }

  preview.sample(0, options)
  await Promise.resolve()

  expect(publish.mock.lastCall?.[0].feedback?.checkedTime).toBe(0)

  preview.sample(0, options)

  expect(publish.mock.lastCall?.[0].feedback?.checkedTime).toBe(0)

  preview.dispose()
  await preview.completion

  const count = publish.mock.calls.length

  deliver()
  expect(publish).toHaveBeenCalledTimes(count)
})

it('does not coalesce a crossed trajectory keyframe when animation jumps ahead of the worker', async () => {
  const input = liveFixture()
  const initial = validateLiveEvidence(
    input,
    0,
    runOfficialClearanceMethod(sampleSnapshot(input, 0))
  )
  let state: LiveState = { status: 'idle', sample: null, error: null }
  let notify: () => void = () => undefined
  const request = vi.fn()
  const api = {
    subscribe: (listener: () => void) => {
      notify = listener
      return () => undefined
    },
    getState: () => state,
    open: (_input: unknown, _time: number, options: { signal: AbortSignal }) =>
      new Promise<void>((resolve) => {
        options.signal.addEventListener('abort', () => resolve(), {
          once: true
        })
      }),
    sample: request
  } as unknown as SimRuntime['features']['live']
  const preview = new LivePreview(
    input.workcell,
    input.trajectory,
    input.interval,
    () => input,
    api,
    () => undefined
  )

  preview.sample(0, { discontinuity: false })
  await Promise.resolve()
  preview.sample(8, { discontinuity: false })

  state = { status: 'ready', sample: initial, error: null }
  notify()
  await Promise.resolve()

  expect(request).toHaveBeenLastCalledWith(4, false)

  preview.dispose()
  await preview.completion
})
