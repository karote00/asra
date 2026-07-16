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
        mousePosition: { x: 0, y: 0 }
      })
    },
    render: {
      setEngineFactory: vi.fn(),
      getViewportPosition: () => ({ x: 0, y: 0 }),
      getViewportScale: () => 1,
      getMousePosInWorkspace: () => ({ x: 0, y: 0 }),
      zoomTo: () => undefined,
      panTo: () => undefined
    }
  }) as unknown as PresetDependencies

describe('Preset Event Registration', () => {
  it('registers preset event definitions through core', () => {
    const systemPropertyMap = new Map<string, BehaviorSubject<unknown>>()
    const registerEvent = vi.fn((event: string | { eventName: string }) => ({
      eventName: typeof event === 'string' ? event : event.eventName,
      publish: vi.fn(),
      subscribe: () => new Subscription()
    }))
    const registerDataChannelObserver = vi.fn()

    applyPreset(
      {
        registerEvent,
        registerDataChannelObserver,
        getPresetDependencies: createDeps,
        registerRenderLayer: vi.fn(),
        registerPropertySchema: vi.fn(),
        definePropertyComponent: vi.fn(),
        unregisterPropertyRegistration: vi.fn(() => ({
          ok: true,
          type: 'test-property',
          removedSchema: true,
          removedComponent: true
        })),
        defineFeature: vi.fn(),
        getFeature: vi.fn(),
        unregisterFeature: vi.fn(),
        defineSelection: vi.fn(),
        getSelection: () => undefined,
        defineUIProperty: vi.fn(),
        defineSystemProperty: <T>(key: string, defaultValue: T) => {
          const existing = systemPropertyMap.get(key)
          if (existing) {
            return existing as BehaviorSubject<T>
          }

          const state = new BehaviorSubject<T>(defaultValue)
          systemPropertyMap.set(key, state as BehaviorSubject<unknown>)
          return state
        },
        getSystemPropertyObservable: <T>(key: string) =>
          systemPropertyMap.get(key) as BehaviorSubject<T> | undefined,
        createRenderGradientFillStyle: () => null as never
      },
      createDeps()
    )

    const registeredEvents = registerEvent.mock.calls.map(([event]) => event)
    expect(registeredEvents).toEqual(Object.values(PresetEventDefinitions))

    const registeredObserverNames = registerDataChannelObserver.mock.calls.map(
      ([registration]) => registration.name
    )
    expect(registeredObserverNames).toEqual([
      'preset.render.sceneTree',
      'preset.selection.runtime',
      'preset.render.selection',
      'preset.uiContext.sceneTree',
      'preset.uiContext.selection'
    ])
  })
})
