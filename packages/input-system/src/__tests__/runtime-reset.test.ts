import { afterEach, describe, expect, it, vi } from 'vitest'
import { InputType } from '@asyra/utils'
import { InputSystem } from '../input-system.js'
import keyMap from '../keymap.js'

const bind = (input: InputSystem) =>
  input.registry.register('command', [
    { type: InputType.KEYBOARD, keys: [keyMap.keys.KeyA], modifiers: [] }
  ])
const keyboardEvent = () =>
  ({
    code: 'KeyA',
    target: document.createElement('div'),
    preventDefault: vi.fn()
  }) as unknown as KeyboardEvent
const host = () => ({ addEventListener: vi.fn(), removeEventListener: vi.fn() })

describe('Input full runtime reset', () => {
  afterEach(() => vi.useRealTimers())

  it('removes all owned listeners, mappings and pending timers', () => {
    vi.useFakeTimers()
    const input = new InputSystem(),
      browser = host(),
      target = host()
    input.attachBrowserHost(
      browser as unknown as Window,
      target as unknown as HTMLElement
    )
    bind(input)
    const callback = browser.addEventListener.mock.calls.find(
      ([name]) => name === 'keydown'
    )?.[1] as EventListener
    callback(keyboardEvent())
    expect(vi.getTimerCount()).toBe(1)
    input.resetRuntime()
    expect(browser.removeEventListener).toHaveBeenCalledTimes(2)
    expect(target.removeEventListener).toHaveBeenCalledTimes(5)
    expect(input.registry.getEventNames()).toEqual([])
    expect(vi.getTimerCount()).toBe(0)
    input.resetRuntime()
    expect(browser.removeEventListener).toHaveBeenCalledTimes(2)
    expect(target.removeEventListener).toHaveBeenCalledTimes(5)
  })

  it('ignores retained old browser callbacks after new mappings and listeners exist', () => {
    vi.useFakeTimers()
    const input = new InputSystem(),
      browser = host()
    input.attachBrowserHost(browser as unknown as Window)
    const old = browser.addEventListener.mock.calls.find(
      ([name]) => name === 'keydown'
    )?.[1] as EventListener
    input.resetRuntime()
    bind(input)
    const receive = vi.fn()
    input.on('command', receive)
    input.attachBrowserHost(browser as unknown as Window)
    old(keyboardEvent())
    expect(receive).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
    const current = browser.addEventListener.mock.calls
      .filter(([name]) => name === 'keydown')
      .at(-1)?.[1] as EventListener
    current(keyboardEvent())
    expect(receive).toHaveBeenCalledOnce()
    input.resetRuntime()
  })

  it('attempts every listener removal and clears mappings even when removal fails', () => {
    const input = new InputSystem(),
      browser = host(),
      target = host()
    input.attachBrowserHost(
      browser as unknown as Window,
      target as unknown as HTMLElement
    )
    bind(input)
    target.removeEventListener.mockImplementationOnce(() => {
      throw new Error('detach failed')
    })
    expect(() => input.resetRuntime()).toThrow('detach failed')
    expect(target.removeEventListener).toHaveBeenCalledTimes(5)
    expect(browser.removeEventListener).toHaveBeenCalledTimes(2)
    expect(input.registry.getEventNames()).toEqual([])
  })

  it('does not clear another instance mappings', () => {
    const input = new InputSystem(),
      other = new InputSystem()
    bind(other)
    input.resetRuntime()
    expect(other.registry.hasEvent('command')).toBe(true)
    other.resetRuntime()
  })
})
