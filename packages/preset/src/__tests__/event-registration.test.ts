import { describe, it, expect, vi } from 'vitest'
import { BehaviorSubject, Subscription } from 'rxjs'
import { applyPreset } from '../preset'
import { PresetEventDefinitions } from '../events'
import type { PresetDependencies } from '../types'

const createDeps = (): PresetDependencies =>
  ({
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
      getMousePosInWorkspace: () => ({ x: 0, y: 0 }),
      zoomTo: () => undefined,
      panTo: () => undefined
    }
  }) as unknown as PresetDependencies

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
        registerSystemProperty: <T>(_: string, defaultValue: T) =>
          new BehaviorSubject<T>(defaultValue)
      },
      createDeps()
    )

    const registeredEvents = registerEvent.mock.calls.map(([event]) => event)
    expect(registeredEvents).toEqual(Object.values(PresetEventDefinitions))
  })
})
