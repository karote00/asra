import { describe, expect, it, vi } from 'vitest'
import { BehaviorSubject } from 'rxjs'
import { PropertyRegistry } from '../property-registry.js'

const subject = (registry: PropertyRegistry, key: string) => {
  const value = registry.getSubject(key)
  if (!value) throw new Error(`Missing test property: ${key}`)
  return value
}

describe('UI property runtime reset', () => {
  it('releases owned bindings and subjects but leaves caller-owned sources alive', () => {
    const registry = new PropertyRegistry(),
      source = new BehaviorSubject(1)
    registry.register('value', {
      defaultValue: 0,
      source$: source,
      aggregate: true,
      triggers: { onSelectionChange: true }
    })
    const old = subject(registry, 'value')
    const complete = vi.fn(),
      next = vi.fn()
    old.subscribe({ next, complete })
    registry.resetRuntime()
    expect(registry.getAllPropertyKeys()).toEqual([])
    expect(registry.getSelectionTriggeredKeys()).toEqual([])
    expect(registry.getAggregatePropertyKeys()).toEqual([])
    expect(complete).toHaveBeenCalledOnce()
    expect(source.isStopped).toBe(false)
    expect(source.observed).toBe(false)
    registry.resetRuntime()
    registry.register('value', { defaultValue: 9 })
    source.next(2)
    old.next(3)
    expect(registry.get('value')).toBe(9)
    expect(next).toHaveBeenCalledTimes(1)
    registry.resetRuntime()
    source.complete()
  })

  it('attempts other cleanup and retires registrations when source disposal fails', () => {
    const registry = new PropertyRegistry(),
      source = new BehaviorSubject(1)
    const subscribe = source.subscribe.bind(source)
    source.subscribe = ((...args: Parameters<typeof source.subscribe>) => {
      const subscription = subscribe(...args)
      subscription.add(() => {
        throw new Error('source cleanup failed')
      })
      return subscription
    }) as typeof source.subscribe
    registry.register('first', { defaultValue: 0, source$: source })
    registry.register('second', { defaultValue: 0 })
    const firstComplete = vi.fn(),
      secondComplete = vi.fn()
    subject(registry, 'first').subscribe({ complete: firstComplete })
    subject(registry, 'second').subscribe({ complete: secondComplete })
    expect(() => registry.resetRuntime()).toThrow('source cleanup failed')
    expect(firstComplete).toHaveBeenCalledOnce()
    expect(secondComplete).toHaveBeenCalledOnce()
    expect(registry.getAllPropertyKeys()).toEqual([])
    source.complete()
  })

  it('leaves independent registries unchanged', () => {
    const registry = new PropertyRegistry(),
      other = new PropertyRegistry()
    other.register('retained', { defaultValue: 3 })
    registry.resetRuntime()
    expect(other.get('retained')).toBe(3)
    other.resetRuntime()
  })
})
