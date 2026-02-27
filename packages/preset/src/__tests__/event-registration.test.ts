import { describe, it, expect, vi } from 'vitest'
import { Subscription } from 'rxjs'
import { applyPreset } from '../preset'
import { PresetEventNames } from '../events'

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
  it('registers preset event namespaces through core', () => {
    const registerEvent = vi.fn((eventName: string) => ({
      eventName,
      publish: () => {},
      subscribe: () => new Subscription()
    }))

    applyPreset(
      {
        registerEvent,
        registerRenderLayer: () => {},
        registerPropertySchema: () => {},
        registerSelection: () => {},
        getSelection: () => undefined,
        registerUIProperty: () => {},
        registerSystemProperty: () => ({})
      },
      createDeps()
    )

    const registeredEvents = registerEvent.mock.calls.map(([event]) => event)
    expect(registeredEvents).toEqual(Object.values(PresetEventNames))
  })
})
