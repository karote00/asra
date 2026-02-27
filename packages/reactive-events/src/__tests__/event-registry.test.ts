import { beforeEach, describe, expect, it, vi } from 'vitest'
import { eventRegistry } from '../event-registry'

describe('eventRegistry', () => {
  beforeEach(() => {
    eventRegistry.clear()
  })

  it('stores registrations by event name', () => {
    const registration = eventRegistry.register('custom.event')

    expect(eventRegistry.has('custom.event')).toBe(true)
    expect(eventRegistry.get('custom.event')).toBe(registration)
    expect(eventRegistry.getRegisteredEvents()).toEqual(['custom.event'])
  })

  it('reuses existing registration for duplicate register calls', () => {
    const first = eventRegistry.register('custom.event')
    const second = eventRegistry.register('custom.event')

    expect(first).toBe(second)
    expect(eventRegistry.getRegisteredEvents()).toEqual(['custom.event'])
  })

  it('publishes and subscribes using registration helpers', () => {
    const registration = eventRegistry.register('custom.event')
    const handler = vi.fn()
    const subscription = registration.subscribe(handler)

    registration.publish({ id: '123' }, { source: 'test' })

    expect(handler).toHaveBeenCalledWith({ id: '123' }, { source: 'test' })

    subscription.unsubscribe()
  })
})
