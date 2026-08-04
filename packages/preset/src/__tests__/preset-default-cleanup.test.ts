import { BaseSelection } from '@asyra/core'
import { PropertyTypes, type RegistrationNodeMetadata } from '@asyra/utils'
import { BehaviorSubject } from 'rxjs'
import { describe, expect, it, vi } from 'vitest'
import { createOwnedStateCleanup } from '../defaults/owned-state.js'
import { installSelectionDefault } from '../defaults/modules/selection.js'
import { installUIContextDefault } from '../defaults/modules/ui-context.js'
import { installVectorEditingDefault } from '../defaults/modules/vector-editing.js'
import { createPrivatePrerequisiteManager } from '../defaults/private-manager.js'
import type { PrivatePrerequisiteInstaller } from '../defaults/types.js'
import { PRESET_REGISTRATION_OWNER } from '../registration.js'
import { PresetSystemPropertyKeys } from '../system-property-keys.js'
import { SelectionChannels } from '../selection/channels.js'
import {
  BASE_PROPERTY_COMPONENT_DEFINITIONS,
  VECTOR_PROPERTY_COMPONENT_DEFINITIONS
} from '../props/components/index.js'
import type { PresetCoreAPIs } from '../types.js'

const appOwner = { packageName: '@app/test', name: 'test' }

describe('Preset default cleanup ownership', () => {
  it('reverses only registrations and system properties acquired by the module', () => {
    const registrations: RegistrationNodeMetadata[] = [
      {
        ref: { kind: 'component', key: 'existing' },
        owner: appOwner
      }
    ]
    const systemProperties = new Set([PresetSystemPropertyKeys.PRIMARY_TOOL])
    const calls: string[] = []
    const removeRegistration = (kind: string, key: string): void => {
      calls.push(`${kind}:${key}`)
      const index = registrations.findIndex(
        ({ ref }) => ref.kind === kind && ref.key === key
      )
      if (index >= 0) registrations.splice(index, 1)
    }
    const core = {
      getRegistrations: () => registrations,
      getRegistration: (ref: { kind: string; key: string }) =>
        registrations.find(
          (registration) =>
            registration.ref.kind === ref.kind &&
            registration.ref.key === ref.key
        ),
      unregisterComponent: (key: string) =>
        removeRegistration('component', key),
      unregisterRenderStrategy: (key: string) =>
        removeRegistration('render-strategy', key),
      hasSystemProperty: (key: string) => systemProperties.has(key),
      unregisterSystemProperty: (key: string) => {
        calls.push(`system-property:${key}`)
        systemProperties.delete(key)
      }
    } as unknown as PresetCoreAPIs
    const cleanup = createOwnedStateCleanup(core)

    registrations.push(
      {
        ref: { kind: 'component', key: 'rectangle' },
        owner: PRESET_REGISTRATION_OWNER
      },
      {
        ref: { kind: 'render-strategy', key: 'rectangle' },
        owner: PRESET_REGISTRATION_OWNER
      },
      {
        ref: { kind: 'component', key: 'app-added' },
        owner: appOwner
      }
    )
    systemProperties.add(PresetSystemPropertyKeys.ZOOM)

    cleanup()

    expect(calls).toEqual([
      'render-strategy:rectangle',
      'component:rectangle',
      `system-property:${PresetSystemPropertyKeys.ZOOM}`
    ])
    expect(registrations.map(({ ref }) => ref.key)).toEqual([
      'existing',
      'app-added'
    ])
    expect(systemProperties).toEqual(
      new Set([PresetSystemPropertyKeys.PRIMARY_TOOL])
    )
  })

  it('retries only cleanup resources that remain pending', () => {
    const registrations: RegistrationNodeMetadata[] = []
    let renderCleanupAttempts = 0
    const componentCleanup = vi.fn(() => {
      registrations.splice(
        registrations.findIndex(({ ref }) => ref.kind === 'component'),
        1
      )
    })
    const renderCleanup = vi.fn(() => {
      renderCleanupAttempts += 1
      if (renderCleanupAttempts === 1) throw new Error('temporary failure')
      registrations.splice(
        registrations.findIndex(({ ref }) => ref.kind === 'render-strategy'),
        1
      )
    })
    const core = {
      getRegistrations: () => registrations,
      getRegistration: (ref: { kind: string; key: string }) =>
        registrations.find(
          (registration) =>
            registration.ref.kind === ref.kind &&
            registration.ref.key === ref.key
        ),
      unregisterComponent: componentCleanup,
      unregisterRenderStrategy: renderCleanup,
      hasSystemProperty: () => false
    } as unknown as PresetCoreAPIs
    const cleanup = createOwnedStateCleanup(core)
    registrations.push(
      {
        ref: { kind: 'component', key: 'rectangle' },
        owner: PRESET_REGISTRATION_OWNER
      },
      {
        ref: { kind: 'render-strategy', key: 'rectangle' },
        owner: PRESET_REGISTRATION_OWNER
      }
    )

    expect(() => cleanup()).toThrow('temporary failure')
    expect(componentCleanup).toHaveBeenCalledOnce()
    expect(renderCleanup).toHaveBeenCalledOnce()

    expect(() => cleanup()).not.toThrow()
    expect(componentCleanup).toHaveBeenCalledOnce()
    expect(renderCleanup).toHaveBeenCalledTimes(2)
  })

  it('makes the element selection runtime an acquired cleanup resource', () => {
    const selections = new Map<string, BaseSelection>()
    let selectionCleanup: (() => void) | undefined
    const acquire = vi.fn(
      (key: string, install: PrivatePrerequisiteInstaller): void => {
        if (key === 'selection:element') {
          selectionCleanup = install() ?? undefined
        }
      }
    )
    const core = {
      getSelection: (type: string) => selections.get(type),
      defineSelection: (type: string, selection: BaseSelection) =>
        selections.set(type, selection),
      unregisterSelection: (type: string) => selections.delete(type),
      defineSystemProperty: vi.fn()
    } as unknown as PresetCoreAPIs

    installSelectionDefault({
      core,
      dependencies: {} as never,
      privatePrerequisites: { acquire }
    })

    expect(selections.has(SelectionChannels.ELEMENT)).toBe(true)
    expect(selectionCleanup).toEqual(expect.any(Function))

    selectionCleanup?.()
    expect(selections.has(SelectionChannels.ELEMENT)).toBe(false)
  })

  it('acquires private base properties for the UI context default', () => {
    const registeredPropertyTypes = new Set<string>()
    const cleanups: (() => void)[] = []
    const core = {
      registerEvent: vi.fn(),
      unregisterEvent: vi.fn(),
      registerPropertySchema: vi.fn(),
      definePropertyComponent: vi.fn((definition: { type: string }) => {
        registeredPropertyTypes.add(definition.type)
        return vi.fn()
      }),
      defineUIProperty: vi.fn(
        (
          _key: string,
          config: {
            registration?: {
              relations?: readonly {
                target: { kind: string; key: string }
              }[]
            }
          }
        ) => {
          config.registration?.relations?.forEach(({ target }) => {
            if (
              target.kind === 'property' &&
              !registeredPropertyTypes.has(target.key)
            ) {
              throw new Error(
                `Missing private property registration "${target.key}"`
              )
            }
          })
        }
      ),
      getSystemPropertyObservable: vi.fn(() => undefined),
      hasSharedDataChannel: vi.fn(() => false),
      createLocalSharedDataChannel: vi.fn(() => ({})),
      registerSharedDataChannel: vi.fn(),
      unregisterSharedDataChannel: vi.fn(),
      registerDataChannelObserver: vi.fn(),
      unregisterDataChannelObserver: vi.fn(),
      getSelection: vi.fn(() => undefined)
    } as unknown as PresetCoreAPIs
    const privatePrerequisites = createPrivatePrerequisiteManager(
      (_key, dispose) => cleanups.push(dispose)
    )

    try {
      expect(() =>
        installUIContextDefault({
          core,
          dependencies: {} as never,
          privatePrerequisites
        })
      ).not.toThrow()
      expect([...registeredPropertyTypes]).toEqual(
        expect.arrayContaining([
          PropertyTypes.POSITION,
          PropertyTypes.DIMENSION,
          PropertyTypes.FILLS,
          PropertyTypes.STROKES
        ])
      )
      expect(registeredPropertyTypes.has(PropertyTypes.CUSTOM)).toBe(false)
    } finally {
      cleanups.reverse().forEach((dispose) => dispose())
    }
  })

  it('keeps the custom property component in the vector-only group', () => {
    expect(
      BASE_PROPERTY_COMPONENT_DEFINITIONS.map(({ type }) => type)
    ).not.toContain(PropertyTypes.CUSTOM)
    expect(
      VECTOR_PROPERTY_COMPONENT_DEFINITIONS.map(({ type }) => type)
    ).toContain(PropertyTypes.CUSTOM)
  })

  it('acquires vector selection projection with the vector-editing module', () => {
    const selections = new Map<string, BaseSelection>()
    const observers = new Map<string, { name: string }>()
    const cleanups: (() => void)[] = []
    const core = {
      getSelection: (type: string) => selections.get(type),
      defineSelection: (type: string, selection: BaseSelection) => {
        selections.set(type, selection)
      },
      unregisterSelection: (type: string) => selections.delete(type),
      defineUIProperty: vi.fn(),
      defineSystemProperty: vi.fn(
        (_key: string, defaultValue: unknown) =>
          new BehaviorSubject(defaultValue)
      ),
      registerRenderLayer: vi.fn(),
      unregisterRenderLayer: vi.fn(),
      hasSharedDataChannel: vi.fn(() => false),
      createLocalSharedDataChannel: vi.fn(() => ({})),
      registerSharedDataChannel: vi.fn(),
      unregisterSharedDataChannel: vi.fn(),
      registerDataChannelObserver: vi.fn((registration: { name: string }) => {
        observers.set(registration.name, registration)
      }),
      unregisterDataChannelObserver: vi.fn((name: string) =>
        observers.delete(name)
      )
    } as unknown as PresetCoreAPIs
    const privatePrerequisites = createPrivatePrerequisiteManager(
      (_key, dispose) => cleanups.push(dispose)
    )

    try {
      installVectorEditingDefault({
        core,
        dependencies: {
          render: {},
          sceneTree: {},
          systemContext: {}
        } as never,
        privatePrerequisites
      })

      expect(observers.has('preset.vectorEditing.selection')).toBe(true)
    } finally {
      cleanups.reverse().forEach((dispose) => dispose())
    }
  })
})
