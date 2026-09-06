import { expect, it, vi } from 'vitest'
import { PlaybackClock } from '../playback-clock'

function setup() {
  const callbacks = new Map<number, (time: number) => void>()

  let id = 0

  const clock = new PlaybackClock({
    now: () => 100,
    request: (callback) => {
      callbacks.set(++id, callback)

      return id
    },
    cancel: (handle) => {
      callbacks.delete(handle)
    }
  })

  const tick = (time: number) => {
    const entries = [...callbacks.values()]

    callbacks.clear()

    entries.forEach((callback) => callback(time))
  }

  return { clock, callbacks, tick }
}

it('uses elapsed time rather than frame count, owns one pending frame, and stops exactly at the endpoint', () => {
  const { clock, callbacks, tick } = setup()

  const sample = vi.fn()

  const stopped = vi.fn()

  clock.play(2, 4, sample, stopped)

  expect(callbacks.size).toBe(1)

  tick(116)

  expect(sample).toHaveBeenLastCalledWith(2.016)

  tick(1100)

  expect(sample).toHaveBeenLastCalledWith(3)

  expect(callbacks.size).toBe(1)

  tick(3100)

  expect(sample).toHaveBeenLastCalledWith(4)

  expect(stopped).toHaveBeenCalledTimes(1)

  expect(callbacks.size).toBe(0)
})

it('cancels pending and late callbacks and never accumulates loops after repeated play', () => {
  const { clock, callbacks, tick } = setup()

  const sample = vi.fn()

  clock.play(0, 8, sample, vi.fn())

  const late = [...callbacks.values()][0]

  clock.play(3, 8, sample, vi.fn())

  expect(callbacks.size).toBe(1)

  late(1000)

  expect(sample).not.toHaveBeenCalled()

  tick(200)

  expect(sample).toHaveBeenLastCalledWith(3.1)

  clock.pause()

  expect(callbacks.size).toBe(0)

  tick(2000)

  expect(sample).toHaveBeenCalledTimes(1)
})

it('does not schedule a static or invalid interval, and supports cancellation within a sample', () => {
  const { clock, callbacks, tick } = setup()

  for (const from of [8, 9, NaN, Infinity])
    clock.play(from, 8, vi.fn(), vi.fn())

  expect(callbacks.size).toBe(0)

  clock.play(0, 8, () => clock.pause(), vi.fn())

  tick(200)

  expect(callbacks.size).toBe(0)
})
