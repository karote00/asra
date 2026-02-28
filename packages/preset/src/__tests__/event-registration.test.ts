import { describe, it, expect, vi } from 'vitest'
import { Subscription } from 'rxjs'
import { applyPreset } from '../preset'
import { PresetEventDefinitions } from '../events'

const createDeps = () => ({
  sceneTree: {
    getElementById: () => undefined
  },
  systemContext: {
    getManagedProperty: () => undefined,
    getSystemContextSnapshot: () => ({
      primaryTool: 'select',
      mouse: { position: { x: 0, y: 0 } }
    })
  },
  render: {
    getViewportPosition: () => ({ x: 0, y: 0 }),
    getViewportScale: () => 1,
    getMousePosInWorkspace: () => ({ x: 0, y: 0 })
  }
})

describe('Preset Event Registration', () => {
  it('registers preset event definitions through core', () => {
    const registerEvent = vi.fn((event: string | { eventName: string }) => ({
      eventName: typeof event === 'string' ? event : event.eventName,
      publish: vi.fn(),
      subscribe: () => new Subscription()
    }))

    applyPreset(
      {
        registerEvent,
        registerRenderLayer: vi.fn(),
        registerPropertySchema: vi.fn(),
        registerSelection: vi.fn(),
        getSelection: () => undefined,
        registerUIProperty: vi.fn(),
        registerSystemProperty: () => ({})
      },
      createDeps()
    )

    const registeredEvents = registerEvent.mock.calls.map(([event]) => event)
    expect(registeredEvents).toEqual(Object.values(PresetEventDefinitions))
  })
})
