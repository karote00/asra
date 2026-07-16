import { BehaviorSubject, Subscription } from 'rxjs'
import { describe, expect, it, vi } from 'vitest'
import defaultCore, {
  componentRegistry as defaultComponentRegistry
} from '@asyra/core'
import type {
  ComponentDefinition,
  PropertyComponentDefinition
} from '@asyra/core'
import {
  PropertyTypes,
  RegistrationRelationError,
  type PropertySchema,
  type RegistrationNodeMetadata,
  type RegistrationOwnerMetadata,
  type RegistrationRef
} from '@asyra/utils'
import * as publicPreset from '../index'
import { applyPreset } from '../preset'
import type { PresetCoreAPIs, PresetDependencies } from '../types'

const PRESET_OWNER: RegistrationOwnerMetadata = {
  packageName: '@asyra/preset',
  name: 'default-preset'
}

const refKey = (ref: RegistrationRef): string => `${ref.kind}:${ref.key}`

const createComposition = () => {
  const schemas = new Map<string, PropertySchema>()
  const propertyComponents = new Map<string, PropertyComponentDefinition>()
  const components = new Map<string, ComponentDefinition>()
  const renderStrategies = new Set<string>()
  const uiProperties = new Set<string>()
  const features = new Set<string>()
  const events = new Set<string>()
  const dataChannelObservers = new Set<string>()
  const renderLayers = new Set<string>()
  const selections = new Map<string, unknown>()
  const sharedChannels = new Set<string>()
  const registrations = new Map<string, RegistrationNodeMetadata>()
  const systemProperties = new Map<string, BehaviorSubject<unknown>>()
  const zoomTo = vi.fn()
  const panTo = vi.fn()

  const dependencies = {
    sceneTree: {
      getElementById: () => undefined,
      getAllElements: () => new Map(),
      currentWorkspace: undefined
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
      zoomTo,
      panTo
    }
  } as unknown as PresetDependencies

  const addRegistration = (
    ref: RegistrationRef,
    owner: RegistrationOwnerMetadata = { packageName: 'app', name: ref.key }
  ) => {
    registrations.set(refKey(ref), { ref, owner })
  }
  const removeRegistration = (ref: RegistrationRef): boolean =>
    registrations.delete(refKey(ref))

  const unregisterComponent = vi.fn((type: string) => {
    components.delete(type)
    removeRegistration({ kind: 'component', key: type })
    return { ok: true, removed: [type], skipped: [] }
  })
  const unregisterRenderStrategy = vi.fn((type: string) => {
    renderStrategies.delete(type)
    return removeRegistration({ kind: 'render-strategy', key: type })
  })
  const unregisterUIProperty = vi.fn((key: string) => {
    uiProperties.delete(key)
    return removeRegistration({ kind: 'ui-property', key })
  })
  const unregisterFeature = vi.fn((name: string) => {
    features.delete(name)
    return removeRegistration({ kind: 'feature', key: name })
  })
  const unregisterPropertyType = vi.fn((type: string) => {
    schemas.delete(type)
    propertyComponents.delete(type)
    removeRegistration({ kind: 'property', key: type })
    return {
      ok: true as const,
      operation: 'unregister-registration' as const,
      root: { kind: 'property', key: type },
      removedRelations: [],
      detachedSources: [],
      recursivelyUnregisteredSources: [],
      removedOwnedRegistrations: [`property:${type}`],
      cleanupFailures: [],
      pendingCleanup: []
    }
  })

  const core = {
    getPresetDependencies: () => dependencies,
    registerEvent: vi.fn((event: string | { eventName: string }) => {
      const eventName = typeof event === 'string' ? event : event.eventName
      events.add(eventName)
      return {
        eventName,
        publish: vi.fn(),
        subscribe: () => new Subscription()
      }
    }),
    unregisterEvent: vi.fn((event: string | { eventName: string }) =>
      events.delete(typeof event === 'string' ? event : event.eventName)
    ),
    registerDataChannelObserver: vi.fn((registration: { name: string }) => {
      dataChannelObservers.add(registration.name)
    }),
    unregisterDataChannelObserver: vi.fn((name: string) =>
      dataChannelObservers.delete(name)
    ),
    hasSharedDataChannel: vi.fn((name: string) => sharedChannels.has(name)),
    getYjsDataChannel: vi.fn((name: string) => ({ name })),
    registerSharedDataChannel: vi.fn((name: string) => {
      if (sharedChannels.has(name)) {
        throw new Error(`Shared channel "${name}" is already registered`)
      }
      sharedChannels.add(name)
    }),
    unregisterSharedDataChannel: vi.fn((name: string) =>
      sharedChannels.delete(name)
    ),
    registerRenderLayer: vi.fn((registration: { name: string }) => {
      renderLayers.add(registration.name)
    }),
    unregisterRenderLayer: vi.fn((name: string) => renderLayers.delete(name)),
    registerPropertySchema: vi.fn(
      (
        schema: PropertySchema,
        _options?: unknown,
        registration?: { owner?: RegistrationOwnerMetadata }
      ) => {
        schemas.set(schema.type, schema)
        addRegistration(
          { kind: 'property', key: schema.type },
          registration?.owner
        )
      }
    ),
    definePropertyComponent: vi.fn(
      (
        definition: PropertyComponentDefinition & {
          registration?: { owner?: RegistrationOwnerMetadata }
        }
      ) => {
        propertyComponents.set(definition.type, definition)
        addRegistration(
          { kind: 'property', key: definition.type },
          definition.registration?.owner
        )
        return class PresetTestPropertyComponent {
          readonly type = definition.type
        } as never
      }
    ),
    unregisterPropertyRegistration: vi.fn(),
    unregisterPropertyType,
    definePropertyChildRelation: vi.fn(),
    removePropertyChildRelation: vi.fn(),
    getPropertyChildRelations: vi.fn(() => []),
    defineComponent: vi.fn(
      (
        definition: ComponentDefinition & {
          registration?: { owner?: RegistrationOwnerMetadata }
        }
      ) => {
        components.set(definition.type, definition)
        addRegistration(
          { kind: 'component', key: definition.type },
          definition.registration?.owner
        )
      }
    ),
    unregisterComponent,
    defineComponentPropertyRelation: vi.fn(),
    removeComponentPropertyRelation: vi.fn(),
    getComponentPropertyRelations: vi.fn(() => []),
    registerRenderStrategy: vi.fn(
      (
        type: string,
        _strategy: unknown,
        registration?: { owner?: RegistrationOwnerMetadata }
      ) => {
        renderStrategies.add(type)
        addRegistration(
          { kind: 'render-strategy', key: type },
          registration?.owner
        )
      }
    ),
    unregisterRenderStrategy,
    defineFeature: vi.fn(
      (
        name: string,
        _keyConfig: unknown,
        definition: { registration?: { owner?: RegistrationOwnerMetadata } }
      ) => {
        features.add(name)
        addRegistration(
          { kind: 'feature', key: name },
          definition.registration?.owner
        )
        return { api: {}, dispose: () => unregisterFeature(name) }
      }
    ),
    getFeature: vi.fn(),
    unregisterFeature,
    defineSelection: vi.fn((type: string, selection: unknown) => {
      selections.set(type, selection)
    }),
    unregisterSelection: vi.fn((type: string) => selections.delete(type)),
    getSelection: (type: string) => selections.get(type),
    defineUIProperty: vi.fn(
      (
        key: string,
        config: { registration?: { owner?: RegistrationOwnerMetadata } }
      ) => {
        uiProperties.add(key)
        addRegistration(
          { kind: 'ui-property', key },
          config.registration?.owner
        )
      }
    ),
    unregisterUIProperty,
    defineSystemProperty: <T>(key: string, defaultValue: T) => {
      const existing = systemProperties.get(key)
      if (existing) return existing as BehaviorSubject<T>
      const state = new BehaviorSubject(defaultValue)
      systemProperties.set(key, state as BehaviorSubject<unknown>)
      return state
    },
    getSystemPropertyObservable: <T>(key: string) =>
      systemProperties.get(key) as BehaviorSubject<T> | undefined,
    createRenderGradientFillStyle: vi.fn(),
    getRegistration: vi.fn((ref: RegistrationRef) =>
      registrations.get(refKey(ref))
    ),
    getRegistrations: () => [...registrations.values()],
    getRegistrationRelations: () => []
  } as unknown as PresetCoreAPIs

  return {
    core,
    schemas,
    propertyComponents,
    components,
    renderStrategies,
    uiProperties,
    features,
    events,
    dataChannelObservers,
    renderLayers,
    selections,
    sharedChannels,
    registrations,
    systemProperties,
    zoomTo,
    panTo,
    unregisterComponent,
    unregisterRenderStrategy,
    unregisterUIProperty,
    unregisterFeature,
    unregisterPropertyType
  }
}

describe('preset startup composition contract', () => {
  it('does not publish preset extension targets or a replace contract', () => {
    expect(publicPreset).not.toHaveProperty('PRESET_EXTENSION_TARGETS')
    expect(publicPreset).not.toHaveProperty('PRESET_EXTENSION_OWNER')
    expect(publicPreset).not.toHaveProperty('getPresetExtensionTarget')
    expect(publicPreset).not.toHaveProperty('EXTENSION_STRATEGIES')
    expect(publicPreset).not.toHaveProperty('EXTENSION_ERROR_CODES')
  })

  it('does not register components merely by importing preset component definitions', async () => {
    vi.resetModules()
    const { componentRegistry } = await import('@asyra/core')
    ;['rect', 'oval', 'vector', 'frame', 'group'].forEach((type) =>
      componentRegistry.unregister(type)
    )

    await import('../components')

    expect(
      ['rect', 'oval', 'vector', 'frame', 'group'].filter((type) =>
        componentRegistry.has(type)
      )
    ).toEqual([])
  })

  it('installs exported defaults explicitly through the supplied Core in deterministic order', () => {
    const { core, components, renderStrategies, registrations } =
      createComposition()

    applyPreset(core)

    expect([...components.keys()]).toEqual([
      'rect',
      'oval',
      'vector',
      'frame',
      'group'
    ])
    expect([...renderStrategies]).toEqual([
      'rect',
      'oval',
      'vector',
      'frame',
      'group'
    ])
    expect(
      [...components.values()].every(
        (definition) => definition.renderStrategy === undefined
      )
    ).toBe(true)
    expect(publicPreset).toHaveProperty('RECTANGLE_COMPONENT_DEFINITION')
    expect(publicPreset).toHaveProperty('OVAL_COMPONENT_DEFINITION')
    expect(
      [...registrations.values()].every(
        ({ owner }) =>
          owner.packageName === PRESET_OWNER.packageName &&
          owner.name === PRESET_OWNER.name
      )
    ).toBe(true)
  })

  it('lets an app define an ordinary feature after applying the preset', () => {
    const { core, features } = createComposition()

    applyPreset(core)
    core.defineFeature('whiteboard-selection', undefined, { api: {} })

    expect(features.has('whiteboard-selection')).toBe(true)
  })

  it('does not clean a node twice when the app already unregistered it through Core', () => {
    const { core, unregisterComponent } = createComposition()
    const application = applyPreset(core)

    core.unregisterComponent('rect')
    unregisterComponent.mockClear()

    expect(application.dispose()).toMatchObject({ ok: true })
    expect(unregisterComponent).not.toHaveBeenCalledWith('rect')
  })

  it('rolls back graph-owned defaults when later preset wiring fails', () => {
    const {
      core,
      schemas,
      propertyComponents,
      components,
      renderStrategies,
      registrations
    } = createComposition()
    vi.mocked(core.defineUIProperty).mockImplementationOnce(() => {
      throw new Error('later preset wiring failed')
    })

    expect(() => applyPreset(core)).toThrow('later preset wiring failed')
    expect(schemas.size).toBe(0)
    expect(propertyComponents.size).toBe(0)
    expect(components.size).toBe(0)
    expect(renderStrategies.size).toBe(0)
    expect(registrations.size).toBe(0)
  })

  it('rolls back runtime wiring after a late failure and permits a clean retry', async () => {
    vi.resetModules()
    const { applyPreset: isolatedApplyPreset } = await import('../preset')
    const {
      core,
      events,
      dataChannelObservers,
      renderLayers,
      selections,
      sharedChannels,
      systemProperties,
      zoomTo
    } = createComposition()
    const zoom = new BehaviorSubject(1)
    systemProperties.set('zoom', zoom as BehaviorSubject<unknown>)

    let renderLayerRegistrationCount = 0
    vi.mocked(core.registerRenderLayer).mockImplementation(
      (registration: { name: string }) => {
        renderLayerRegistrationCount += 1
        if (renderLayerRegistrationCount === 2) {
          throw new Error('second render layer failed')
        }
        renderLayers.add(registration.name)
      }
    )

    expect(() => isolatedApplyPreset(core)).toThrow(
      'second render layer failed'
    )
    expect(events.size).toBe(0)
    expect(dataChannelObservers.size).toBe(0)
    expect(renderLayers.size).toBe(0)
    expect(selections.size).toBe(0)

    zoomTo.mockClear()
    zoom.next(2)
    expect(zoomTo).not.toHaveBeenCalled()

    vi.mocked(core.registerRenderLayer).mockImplementation(
      (registration: { name: string }) => {
        renderLayers.add(registration.name)
      }
    )
    const application = isolatedApplyPreset(core)
    expect(events.size).toBeGreaterThan(0)
    expect(dataChannelObservers.size).toBeGreaterThan(0)
    expect(renderLayers.size).toBe(2)
    expect(selections.size).toBeGreaterThan(0)
    expect(sharedChannels.size).toBe(3)

    expect(application.dispose()).toMatchObject({ ok: true })
    expect(events.size).toBe(0)
    expect(dataChannelObservers.size).toBe(0)
    expect(renderLayers.size).toBe(0)
    expect(selections.size).toBe(0)
    expect(sharedChannels.size).toBe(0)

    const reappliedApplication = isolatedApplyPreset(core)
    expect(reappliedApplication.dispose()).toMatchObject({ ok: true })
  })

  it('retries failed apply rollback cleanup before installing the next preset lifetime', () => {
    const { core, renderLayers } = createComposition()
    let renderLayerRegistrationCount = 0
    let failLateRegistration = true
    let failRollbackCleanup = true

    vi.mocked(core.registerRenderLayer).mockImplementation(
      (registration: { name: string }) => {
        renderLayerRegistrationCount += 1
        if (failLateRegistration && renderLayerRegistrationCount === 2) {
          throw new Error('late preset layer registration failed')
        }
        if (renderLayers.has(registration.name)) {
          throw new Error(`Render layer "${registration.name}" is stale`)
        }
        renderLayers.add(registration.name)
      }
    )
    vi.mocked(core.unregisterRenderLayer).mockImplementation((name: string) => {
      if (failRollbackCleanup) {
        failRollbackCleanup = false
        throw new Error('preset layer rollback cleanup failed')
      }
      return renderLayers.delete(name)
    })

    let rollbackError: unknown
    try {
      applyPreset(core)
    } catch (error) {
      rollbackError = error
    }
    expect(rollbackError).toBeInstanceOf(RegistrationRelationError)
    expect((rollbackError as RegistrationRelationError).result).toMatchObject({
      code: 'UNREGISTER_FAILED',
      pendingCleanup: ['render-layer:selection-overlay']
    })
    expect(renderLayers.size).toBe(1)

    failLateRegistration = false
    const application = applyPreset(core)
    expect(renderLayers.size).toBe(2)
    expect(application.dispose()).toMatchObject({ ok: true })
    expect(renderLayers.size).toBe(0)
  })

  it('retries only pending preset lifecycle cleanup after a disposal failure', () => {
    const { core, renderLayers } = createComposition()
    const application = applyPreset(core)
    const vectorLayerName = [...renderLayers].at(-1)
    const cleanupAttempts: string[] = []
    let shouldFailVectorCleanup = true

    vi.mocked(core.unregisterRenderLayer).mockImplementation((name: string) => {
      cleanupAttempts.push(name)
      if (name === vectorLayerName && shouldFailVectorCleanup) {
        shouldFailVectorCleanup = false
        throw new Error('vector layer cleanup failed')
      }
      return renderLayers.delete(name)
    })

    let cleanupError: unknown
    try {
      application.dispose()
    } catch (error) {
      cleanupError = error
    }
    expect(cleanupError).toBeInstanceOf(RegistrationRelationError)
    expect((cleanupError as RegistrationRelationError).result).toMatchObject({
      code: 'UNREGISTER_FAILED',
      pendingCleanup: ['render-layer:vector-path-editing']
    })
    expect(renderLayers).toEqual(new Set([vectorLayerName]))

    cleanupAttempts.length = 0
    expect(application.dispose()).toMatchObject({ ok: true })
    expect(cleanupAttempts).toEqual([vectorLayerName])
    expect(renderLayers.size).toBe(0)

    cleanupAttempts.length = 0
    expect(application.dispose()).toMatchObject({ ok: true })
    expect(cleanupAttempts).toEqual([])
  })

  it('does not tear down runtime wiring when graph disposal preflight is closed', () => {
    const {
      core,
      events,
      dataChannelObservers,
      renderLayers,
      selections,
      registrations
    } = createComposition()
    const application = applyPreset(core)
    vi.mocked(core.getRegistration).mockImplementation(() => {
      throw new RegistrationRelationError({
        ok: false,
        code: 'COMPOSITION_CLOSED',
        operation: 'unregister-registration',
        message: 'Registration composition is permanently closed'
      })
    })

    let cleanupError: unknown
    try {
      application.dispose()
    } catch (error) {
      cleanupError = error
    }
    const retainedRuntimeSizes = {
      events: events.size,
      observers: dataChannelObservers.size,
      layers: renderLayers.size,
      selections: selections.size
    }

    vi.mocked(core.getRegistration).mockImplementation((ref) =>
      registrations.get(refKey(ref))
    )
    application.dispose()

    expect(cleanupError).toBeInstanceOf(RegistrationRelationError)
    expect(retainedRuntimeSizes.events).toBeGreaterThan(0)
    expect(retainedRuntimeSizes.observers).toBeGreaterThan(0)
    expect(retainedRuntimeSizes.layers).toBe(2)
    expect(retainedRuntimeSizes.selections).toBeGreaterThan(0)
  })

  it('customizes actual rectangle and oval relations before startup without removing their property targets', () => {
    const application = applyPreset(defaultCore)

    try {
      defaultCore.removeComponentPropertyRelation('rect', 'fills')
      defaultCore.removeComponentPropertyRelation('oval', 'fills')
      defaultCore.removeComponentPropertyRelation('rect', 'strokes')
      defaultCore.defineComponentPropertyRelation('rect', {
        name: 'outline',
        type: PropertyTypes.STROKES
      })

      expect(
        defaultCore
          .getComponentPropertyRelations('rect')
          .map(({ propertyName }) => propertyName)
      ).toEqual([PropertyTypes.POSITION, PropertyTypes.DIMENSION, 'outline'])
      expect(
        defaultCore
          .getComponentPropertyRelations('oval')
          .map(({ propertyName }) => propertyName)
      ).toEqual([PropertyTypes.POSITION, PropertyTypes.DIMENSION, 'strokes'])
      expect(
        defaultCore.getRegistration({
          kind: 'property',
          key: PropertyTypes.FILLS
        })
      ).toBeDefined()

      const unregisterResult = defaultCore.unregisterPropertyType(
        PropertyTypes.FILLS
      )
      expect(unregisterResult.detachedSources).toEqual([
        { kind: 'component', key: 'frame' },
        { kind: 'component', key: 'group' },
        { kind: 'component', key: 'vector' }
      ])
      expect(defaultComponentRegistry.has('rect')).toBe(true)
      expect(defaultComponentRegistry.has('oval')).toBe(true)
      expect(
        defaultCore.getRegistration({
          kind: 'render-strategy',
          key: 'rect'
        })
      ).toBeUndefined()
      expect(
        defaultCore.getRegistration({
          kind: 'property',
          key: PropertyTypes.FILL
        })
      ).toBeDefined()
    } finally {
      application.dispose()
    }
  })
})
