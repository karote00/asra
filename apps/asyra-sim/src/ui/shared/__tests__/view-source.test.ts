import { expect, it, vi } from 'vitest'
import { ViewSource } from '../view-source'

it('publishes only changed consumed values and exposes the complete current snapshot', () => {
  const source = new ViewSource({ name: 'A', position: { x: 1 }, error: '' })

  const name = vi.fn(() => expect(source.getSnapshot().position.x).toBe(2))

  const x = vi.fn()

  const error = vi.fn()

  source.subscribe((value) => value.name, name)

  source.subscribe((value) => value.position.x, x)

  source.subscribe((value) => value.error, error)

  source.publish({ name: 'A', position: { x: 1 }, error: '' })

  expect(name).not.toHaveBeenCalled()

  expect(x).not.toHaveBeenCalled()

  source.publish({ name: 'B', position: { x: 2 }, error: '' })

  expect(name).toHaveBeenCalledTimes(1)

  expect(x).toHaveBeenCalledTimes(1)

  expect(error).not.toHaveBeenCalled()
})

it('releases subscriptions and never asks callers for a props equality comparator', () => {
  const source = new ViewSource({ value: 1 })

  const listener = vi.fn()

  const stop = source.subscribe((snapshot) => snapshot.value, listener)

  stop()

  stop()

  source.publish({ value: 2 })

  expect(listener).not.toHaveBeenCalled()

  expect(source.getSnapshot()).toEqual({ value: 2 })
})
