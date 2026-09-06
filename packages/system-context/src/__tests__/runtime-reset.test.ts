import { describe, expect, it, vi } from 'vitest'
import { SystemContext } from '../system-context.js'
import { ManagedPropertyState } from '../states/managed-property-state.js'

const create = () =>
  new SystemContext({ managedPropertyState: new ManagedPropertyState() })

describe('System Context runtime reset', () => {
  it('retires state and subscriptions before same-name reconstruction', () => {
    const context = create()
    const old = context.registerProperty('mode', 'old')
    const complete = vi.fn(),
      next = vi.fn()
    old.subscribe({ next, complete })
    context.resetRuntime()
    expect(context.hasManagedProperty('mode')).toBe(false)
    expect(complete).toHaveBeenCalledOnce()
    expect(context.saveManagedProperties()).toEqual({})
    context.resetRuntime()
    const fresh = context.registerProperty('mode', 'fresh')
    old.next('late-old')
    expect(fresh.value).toBe('fresh')
    expect(next).toHaveBeenCalledTimes(1)
    expect(complete).toHaveBeenCalledOnce()
    context.resetRuntime()
  })

  it('rejects old populated and empty validation artifacts', () => {
    const context = create()
    context.registerProperty('scale', 1, { runtime: false })
    const old = context.validateManagedProperties({ scale: 2 })
    const empty = context.validateManagedProperties({})
    context.resetRuntime()
    context.registerProperty('scale', 10, { runtime: false })
    expect(() => context.applyValidatedManagedProperties(old)).toThrow(
      'owner-issued one-shot'
    )
    expect(() => context.applyValidatedManagedProperties(empty)).toThrow(
      'owner-issued one-shot'
    )
    expect(context.getManagedProperty('scale')).toBe(10)
    context.resetRuntime()
  })

  it('attempts every completion and removes state before reporting a failure', () => {
    const context = create(),
      first = context.registerProperty('first', 1),
      second = context.registerProperty('second', 2)
    first.complete = () => {
      throw new Error('completion failed')
    }
    const complete = vi.fn()
    second.subscribe({ complete })
    expect(() => context.resetRuntime()).toThrow('completion failed')
    expect(complete).toHaveBeenCalledOnce()
    expect(context.hasManagedProperty('first')).toBe(false)
    expect(context.hasManagedProperty('second')).toBe(false)
  })

  it('does not affect a context with independent managed state', () => {
    const context = create(),
      other = create()
    other.registerProperty('retained', 3)
    context.resetRuntime()
    expect(other.getManagedProperty('retained')).toBe(3)
    other.resetRuntime()
  })
})
