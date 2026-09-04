import { describe, expect, it, vi } from 'vitest'
import { DataChannelObserverRegistry } from '../data-channel-observer.js'

describe('Core observer runtime reset', () => {
  it('cannot reactivate during an acquired cleanup callback', () => {
    let failure: unknown
    const registry = new DataChannelObserverRegistry({
      observeSharedDataChannel: () => () => {
        try {
          registry.init()
        } catch (error) {
          failure = error
        }
      },
      observeSharedDataChannelBatch: vi.fn()
    })
    registry.register({
      name: 'observer',
      channel: 'channel',
      onChange: vi.fn()
    })
    registry.init()
    registry.resetRuntime()
    expect(failure).toBeInstanceOf(Error)
  })

  it('preserves the handler bound at activation until explicit retirement', () => {
    let notify: (value: unknown) => void = () => undefined
    const first = vi.fn(),
      replacement = vi.fn()
    const registry = new DataChannelObserverRegistry({
      observeSharedDataChannel: (_channel, callback) => {
        notify = callback as (value: unknown) => void
        return () => undefined
      },
      observeSharedDataChannelBatch: vi.fn()
    })
    const registration = {
      name: 'observer',
      channel: 'channel',
      onChange: first
    }
    registry.register(registration)
    registry.init()
    registration.onChange = replacement
    notify('active')
    expect(first).toHaveBeenCalledExactlyOnceWith('active')
    expect(replacement).not.toHaveBeenCalled()
    registry.resetRuntime()
    notify('retired')
    expect(first).toHaveBeenCalledOnce()
  })

  it('retires definitions and stale callbacks while preserving channel ownership', () => {
    const handlers: ((value: unknown) => void)[] = [],
      cleanup = vi.fn(),
      handler = vi.fn()
    const registry = new DataChannelObserverRegistry({
      observeSharedDataChannel: (_channel, callback) => {
        handlers.push(callback as (value: unknown) => void)
        return cleanup
      },
      observeSharedDataChannelBatch: vi.fn()
    })
    registry.register({
      name: 'observer',
      channel: 'channel',
      onChange: handler
    })
    registry.init()
    handlers[0]('before')
    registry.resetRuntime()
    registry.register({
      name: 'observer',
      channel: 'channel',
      onChange: handler
    })
    registry.init()
    handlers[0]('stale')
    handlers[1]('new')
    expect(handler.mock.calls).toEqual([['before'], ['new']])
    expect(cleanup).toHaveBeenCalledOnce()
    registry.resetRuntime()
  })

  it('attempts all acquired cleanup after partial initialization and reports failure', () => {
    const cause = new Error('cleanup failed'),
      first = vi.fn(() => {
        throw cause
      }),
      second = vi.fn()
    const registry = new DataChannelObserverRegistry({
      observeSharedDataChannel: vi
        .fn()
        .mockReturnValueOnce(first)
        .mockReturnValueOnce(second)
        .mockImplementationOnce(() => {
          throw new Error('acquisition failed')
        }),
      observeSharedDataChannelBatch: vi.fn()
    })
    for (const name of ['first', 'second', 'third']) {
      registry.register({ name, channel: 'channel', onChange: vi.fn() })
    }
    expect(() => registry.init()).toThrow('acquisition failed')
    expect(() => registry.resetRuntime()).toThrow(cause)
    expect(first).toHaveBeenCalledOnce()
    expect(second).toHaveBeenCalledOnce()
    expect(registry.unregister('first')).toBe(false)
    registry.resetRuntime()
    expect(first).toHaveBeenCalledOnce()
  })

  it('rejects reentrant acquisition reset without losing its acquired binding', () => {
    const cleanup = vi.fn()
    let failure: unknown
    const registry = new DataChannelObserverRegistry({
      observeSharedDataChannel: () => {
        try {
          registry.resetRuntime()
        } catch (error) {
          failure = error
        }
        return cleanup
      },
      observeSharedDataChannelBatch: vi.fn()
    })
    registry.register({
      name: 'observer',
      channel: 'channel',
      onChange: vi.fn()
    })
    registry.init()
    expect(failure).toBeInstanceOf(Error)
    expect(cleanup).not.toHaveBeenCalled()
    registry.resetRuntime()
    expect(cleanup).toHaveBeenCalledOnce()
  })
})
