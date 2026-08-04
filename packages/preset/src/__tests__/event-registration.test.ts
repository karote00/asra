import { describe, expect, it, vi } from 'vitest'
import { PresetEventDefinitions } from '../events/index.js'
import { registerEvents } from '../events/register-events.js'

describe('Preset Event Registration', () => {
  it('registers and reverses the official event definitions', () => {
    const registerEvent = vi.fn()
    const unregisterEvent = vi.fn()

    const dispose = registerEvents({ registerEvent, unregisterEvent } as never)

    const registeredEvents = registerEvent.mock.calls.map(([event]) => event)
    expect(registeredEvents).toEqual(Object.values(PresetEventDefinitions))

    dispose()
    expect(unregisterEvent.mock.calls.map(([eventName]) => eventName)).toEqual(
      Object.values(PresetEventDefinitions)
        .map(({ eventName }) => eventName)
        .reverse()
    )
  })
})
