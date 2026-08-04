import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  defineEvent,
  eventRegistry,
  registerEventDefinitions
} from '../event-registry.js'

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

  it('throws on duplicate register calls', () => {
    eventRegistry.register('custom.event')

    expect(() => eventRegistry.register('custom.event')).toThrow(
      'Event "custom.event" is already registered'
    )
  })

  it('publishes and subscribes using registration helpers', () => {
    const registration = eventRegistry.register('custom.event')
    const handler = vi.fn()
    const subscription = registration.subscribe(handler)

    registration.publish({ id: '123' }, { source: 'test' })

    expect(handler).toHaveBeenCalledWith({ id: '123' }, { source: 'test' })

    subscription.unsubscribe()
  })

  it('registers definition maps and returns generated helpers', () => {
    const definitions = {
      CREATED: defineEvent<{ id: string }, { source: string }>('custom.created')
    } as const
    const registrations = registerEventDefinitions(definitions)
    const handler = vi.fn()
    const subscription = registrations.CREATED.subscribe(handler)

    registrations.CREATED.publish({ id: '1' }, { source: 'test' })

    expect(handler).toHaveBeenCalledWith({ id: '1' }, { source: 'test' })

    subscription.unsubscribe()
  })
})
