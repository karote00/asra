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
import { PresetCompositionError } from '../composition/error'
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
  const engineProviderCleanup = vi.fn()

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
      setEngineFactory: vi.fn(() => engineProviderCleanup),
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
    dependencies,
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
    engineProviderCleanup,
    unregisterComponent,
    unregisterRenderStrategy,
    unregisterUIProperty,
    unregisterFeature,
    unregisterPropertyType
  }
}

const captureCompositionError = (run: () => unknown): unknown => {
  try {
    run()
  } catch (error) {
    return error
  }
  throw new Error('Expected preset composition to fail')
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

  it('completes every observable shared-default group before concrete-engine bootstrap', () => {
    const { core, dependencies } = createComposition()

    const application = applyPreset(core)
    const firstCallOrder = (mock: {
      mock: { invocationCallOrder: number[] }
    }) => mock.mock.invocationCallOrder[0]
    const sharedGroupOrder = [
      firstCallOrder(vi.mocked(core.registerEvent)),
      firstCallOrder(vi.mocked(core.registerPropertySchema)),
      firstCallOrder(vi.mocked(core.definePropertyComponent)),
      firstCallOrder(vi.mocked(core.defineComponent)),
      firstCallOrder(vi.mocked(core.registerRenderStrategy)),
      firstCallOrder(vi.mocked(core.defineSelection)),
      firstCallOrder(vi.mocked(core.defineUIProperty)),
      firstCallOrder(vi.mocked(core.registerSharedDataChannel)),
      firstCallOrder(vi.mocked(core.registerDataChannelObserver)),
      firstCallOrder(vi.mocked(core.registerRenderLayer))
    ]
    const engineBootstrapOrder = firstCallOrder(
      vi.mocked(dependencies.render.setEngineFactory)
    )

    expect(sharedGroupOrder).toEqual(
      [...sharedGroupOrder].sort((a, b) => a - b)
    )
    expect(new Set(sharedGroupOrder).size).toBe(sharedGroupOrder.length)
    expect(engineBootstrapOrder).toBeGreaterThan(sharedGroupOrder.at(-1) ?? 0)
    expect(dependencies.render.setEngineFactory).toHaveBeenCalledOnce()
    expect(application.dispose()).toMatchObject({ ok: true })
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
    expect(rollbackError).toBeInstanceOf(PresetCompositionError)
    expect((rollbackError as PresetCompositionError).result).toMatchObject({
      code: 'CLEANUP_FAILED',
      layer: 'cleanup',
      cleanup: {
        state: 'pending',
        pending: ['render-layer:selection-overlay']
      },
      cause: {
        applyError: expect.objectContaining({
          message: 'late preset layer registration failed'
        })
      }
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
    expect(cleanupError).toBeInstanceOf(PresetCompositionError)
    expect((cleanupError as PresetCompositionError).result).toMatchObject({
      code: 'CLEANUP_FAILED',
      operation: 'dispose-preset',
      layer: 'cleanup',
      cleanup: {
        state: 'pending',
        pending: ['render-layer:vector-path-editing']
      }
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

  it('keeps pending cleanup state local to one Core and application lifetime', () => {
    const first = createComposition()
    const second = createComposition()
    const firstApplication = applyPreset(first.core)
    const secondApplication = applyPreset(second.core)
    const firstVectorLayer = [...first.renderLayers].at(-1)
    let failFirstCleanup = true

    vi.mocked(first.core.unregisterRenderLayer).mockImplementation((name) => {
      if (name === firstVectorLayer && failFirstCleanup) {
        failFirstCleanup = false
        throw new Error('first Core cleanup failed')
      }
      return first.renderLayers.delete(name)
    })

    const firstError = captureCompositionError(() => firstApplication.dispose())

    expect(firstError).toBeInstanceOf(PresetCompositionError)
    expect(
      (firstError as PresetCompositionError).result.cleanup.pending
    ).toEqual(['render-layer:vector-path-editing'])
    expect(secondApplication.dispose()).toMatchObject({ ok: true })
    expect(second.renderLayers.size).toBe(0)
    expect(first.renderLayers).toEqual(new Set([firstVectorLayer]))
    expect(firstApplication.dispose()).toMatchObject({ ok: true })
    expect(first.renderLayers.size).toBe(0)
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

    expect(cleanupError).toBeInstanceOf(PresetCompositionError)
    expect((cleanupError as PresetCompositionError).result).toMatchObject({
      code: 'CLEANUP_FAILED',
      operation: 'dispose-preset',
      layer: 'cleanup',
      cleanup: { state: 'pending' },
      cause: expect.objectContaining({
        cleanupFailures: expect.any(Array)
      })
    })
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

describe('generic preset composition input validation', () => {
  it('publishes stable typed composition contracts from the preset facade', () => {
    expect(publicPreset).toHaveProperty('PresetCompositionError')
    expect(publicPreset).toHaveProperty('PRESET_COMPOSITION_ERROR_CODES')
    expect(publicPreset).toHaveProperty('DEFAULT_PRESET_ENGINE_ID')
  })

  it('accepts the explicit preset-owned default engine identity without changing the compatibility wiring', () => {
    const { core, dependencies } = createComposition()

    const application = applyPreset(core, {
      engine: { id: '@asyra/render-engine-pixi' }
    } as never)

    expect(dependencies.render.setEngineFactory).toHaveBeenCalledOnce()
    expect(application.dispose()).toMatchObject({ ok: true })
  })

  it('treats an empty options object as the omitted compatibility composition', () => {
    const { core, dependencies } = createComposition()

    const application = applyPreset(core, {})

    expect(dependencies.render.setEngineFactory).toHaveBeenCalledOnce()
    expect(application.dispose()).toMatchObject({ ok: true })
  })

  it('rejects incomplete explicit dependencies before mutation', () => {
    const { core, dependencies } = createComposition()

    const error = captureCompositionError(() =>
      applyPreset(core, { dependencies: {} as never })
    )

    expect(error).toMatchObject({
      name: 'PresetCompositionError',
      result: {
        code: 'INVALID_COMPOSITION',
        layer: 'validation',
        cleanup: { state: 'not-required' }
      }
    })
    expect(core.registerEvent).not.toHaveBeenCalled()
    expect(dependencies.render.setEngineFactory).not.toHaveBeenCalled()
  })

  it('accepts an identified custom engine bootstrap with its exact factory', () => {
    const { core, dependencies } = createComposition()
    const customFactory = vi.fn()

    const application = applyPreset(core, {
      engine: { id: '@product/render-engine', factory: customFactory }
    })

    expect(dependencies.render.setEngineFactory).toHaveBeenCalledWith(
      customFactory
    )
    expect(application.dispose()).toMatchObject({ ok: true })
  })

  it('rejects malformed composition containers and engine conflicts with structured errors', () => {
    const malformedComposition = createComposition()
    const malformedError = captureCompositionError(() =>
      applyPreset(malformedComposition.core, [] as never)
    )

    expect(malformedError).toMatchObject({
      name: 'PresetCompositionError',
      result: {
        code: 'INVALID_COMPOSITION',
        layer: 'validation'
      }
    })
    expect(malformedComposition.core.registerEvent).not.toHaveBeenCalled()

    const engineConflictComposition = createComposition()
    const engineConflictError = captureCompositionError(() =>
      applyPreset(engineConflictComposition.core, {
        renderEngineFactory: vi.fn(),
        engine: null
      } as never)
    )

    expect(engineConflictError).toMatchObject({
      name: 'PresetCompositionError',
      result: {
        code: 'INVALID_COMPOSITION',
        layer: 'validation'
      }
    })
    expect(engineConflictComposition.core.registerEvent).not.toHaveBeenCalled()
  })

  it('rejects legacy and identified engine inputs together before mutation', () => {
    const { core, dependencies } = createComposition()

    const error = captureCompositionError(() =>
      applyPreset(core, {
        renderEngineFactory: vi.fn(),
        engine: { id: 'test-engine', factory: vi.fn() }
      } as never)
    )

    expect(error).toMatchObject({
      name: 'PresetCompositionError',
      result: {
        code: 'INVALID_COMPOSITION',
        layer: 'validation',
        cleanup: { state: 'not-required' }
      }
    })
    expect(core.registerEvent).not.toHaveBeenCalled()
    expect(dependencies.render.setEngineFactory).not.toHaveBeenCalled()
  })

  it('rejects an unknown engine bootstrap before mutation', () => {
    const { core, dependencies } = createComposition()

    const error = captureCompositionError(() =>
      applyPreset(core, {
        engine: { id: 'unknown-engine' }
      } as never)
    )

    expect(error).toMatchObject({
      name: 'PresetCompositionError',
      result: {
        code: 'UNKNOWN_ENGINE_BOOTSTRAP',
        layer: 'validation',
        engineId: 'unknown-engine'
      }
    })
    expect(core.registerEvent).not.toHaveBeenCalled()
    expect(dependencies.render.setEngineFactory).not.toHaveBeenCalled()
  })

  it('rejects duplicate bundle identities before mutation', () => {
    const { core, dependencies } = createComposition()
    const bundle = {
      id: 'package/selection-tools',
      owner: { packageName: '@product/selection', name: 'selection-tools' },
      requires: [],
      install: vi.fn(() => ({ outputs: ['selection'], dispose: vi.fn() }))
    }

    const error = captureCompositionError(() =>
      applyPreset(core, {
        dependencies,
        capabilityBundles: [bundle, bundle]
      } as never)
    )

    expect(error).toMatchObject({
      name: 'PresetCompositionError',
      result: {
        code: 'DUPLICATE_TARGET',
        layer: 'validation',
        capabilityBundles: [
          'package/selection-tools',
          'package/selection-tools'
        ]
      }
    })
    expect(core.registerEvent).not.toHaveBeenCalled()
    expect(dependencies.render.setEngineFactory).not.toHaveBeenCalled()
    expect(bundle.install).not.toHaveBeenCalled()
  })

  it('distinguishes missing bundle dependencies from ordering conflicts before mutation', () => {
    const missingComposition = createComposition()
    const missingDependencyBundle = {
      id: 'package/consumer',
      owner: { packageName: '@product/consumer', name: 'consumer' },
      requires: ['package/missing'],
      install: vi.fn(() => ({ outputs: ['consumer'], dispose: vi.fn() }))
    }

    const missingError = captureCompositionError(() =>
      applyPreset(missingComposition.core, {
        dependencies: missingComposition.dependencies,
        capabilityBundles: [missingDependencyBundle]
      } as never)
    )

    expect(missingError).toMatchObject({
      name: 'PresetCompositionError',
      result: {
        code: 'MISSING_CAPABILITY_BUNDLE',
        layer: 'validation',
        failedBundleId: 'package/consumer'
      }
    })
    expect(missingComposition.core.registerEvent).not.toHaveBeenCalled()

    const orderedComposition = createComposition()
    const dependency = {
      id: 'package/dependency',
      owner: { packageName: '@product/dependency', name: 'dependency' },
      requires: [],
      install: vi.fn(() => ({ outputs: ['dependency'], dispose: vi.fn() }))
    }
    const consumer = {
      id: 'package/consumer',
      owner: { packageName: '@product/consumer', name: 'consumer' },
      requires: ['package/dependency'],
      install: vi.fn(() => ({ outputs: ['consumer'], dispose: vi.fn() }))
    }

    const orderingError = captureCompositionError(() =>
      applyPreset(orderedComposition.core, {
        dependencies: orderedComposition.dependencies,
        capabilityBundles: [consumer, dependency]
      } as never)
    )

    expect(orderingError).toMatchObject({
      name: 'PresetCompositionError',
      result: {
        code: 'ORDERING_CONFLICT',
        layer: 'validation',
        failedBundleId: 'package/consumer'
      }
    })
    expect(orderedComposition.core.registerEvent).not.toHaveBeenCalled()
    expect(consumer.install).not.toHaveBeenCalled()
    expect(dependency.install).not.toHaveBeenCalled()
  })

  it('rejects an incomplete or no-op bundle definition before mutation', () => {
    const { core, dependencies } = createComposition()

    const error = captureCompositionError(() =>
      applyPreset(core, {
        dependencies,
        capabilityBundles: [
          {
            id: 'package/no-op',
            owner: { packageName: '@product/no-op', name: 'no-op' },
            requires: []
          }
        ]
      } as never)
    )

    expect(error).toMatchObject({
      name: 'PresetCompositionError',
      result: {
        code: 'INVALID_COMPOSITION',
        layer: 'validation',
        failedBundleId: 'package/no-op'
      }
    })
    expect(core.registerEvent).not.toHaveBeenCalled()
    expect(dependencies.render.setEngineFactory).not.toHaveBeenCalled()
  })
})

describe('generic preset capability bundle orchestration', () => {
  it('installs selected bundles after engine bootstrap in caller-declared order with the public context', () => {
    const { core, dependencies } = createComposition()
    const timeline: string[] = []
    const engineProviderCleanup = vi.fn(() => {
      timeline.push('cleanup:engine')
    })
    vi.mocked(dependencies.render.setEngineFactory).mockImplementation(() => {
      timeline.push('concrete-engine')
      return engineProviderCleanup
    })
    const firstDispose = vi.fn(() => {
      timeline.push('cleanup:package/first')
    })
    const secondDispose = vi.fn(() => {
      timeline.push('cleanup:package/second')
    })
    const first = {
      id: 'package/first',
      owner: { packageName: '@product/first', name: 'first' },
      requires: [],
      install: vi.fn(() => {
        timeline.push('package/first')
        return { outputs: ['first-output'], dispose: firstDispose }
      })
    }
    const second = {
      id: 'package/second',
      owner: { packageName: '@product/second', name: 'second' },
      requires: ['package/first'],
      install: vi.fn(() => {
        timeline.push('package/second')
        return { outputs: ['second-output'], dispose: secondDispose }
      })
    }

    const application = applyPreset(core, {
      dependencies,
      engine: { id: '@product/render-engine', factory: vi.fn() },
      capabilityBundles: [first, second]
    })

    expect(timeline).toEqual([
      'concrete-engine',
      'package/first',
      'package/second'
    ])
    expect(first.install).toHaveBeenCalledWith({
      core,
      dependencies,
      engineId: '@product/render-engine'
    })
    expect(second.install).toHaveBeenCalledWith({
      core,
      dependencies,
      engineId: '@product/render-engine'
    })
    expect(application.dispose()).toMatchObject({ ok: true })
    expect(timeline.slice(-3)).toEqual([
      'cleanup:package/second',
      'cleanup:package/first',
      'cleanup:engine'
    ])
    expect([
      secondDispose.mock.invocationCallOrder[0],
      firstDispose.mock.invocationCallOrder[0]
    ]).toEqual(
      [
        secondDispose.mock.invocationCallOrder[0],
        firstDispose.mock.invocationCallOrder[0]
      ].sort((a, b) => a - b)
    )
  })

  it('reports cleanup state and retries only a pending bundle disposer', () => {
    const { core, dependencies } = createComposition()
    const cleanupAttempts: string[] = []
    let failSecondCleanup = true
    vi.mocked(dependencies.render.setEngineFactory).mockReturnValue(() => {
      cleanupAttempts.push('engine')
    })
    const first = {
      id: 'package/first',
      owner: { packageName: '@product/first', name: 'first' },
      requires: [],
      install: vi.fn(() => ({
        outputs: ['first-output'],
        dispose: () => cleanupAttempts.push('first')
      }))
    }
    const second = {
      id: 'package/second',
      owner: { packageName: '@product/second', name: 'second' },
      requires: ['package/first'],
      install: vi.fn(() => ({
        outputs: ['second-output'],
        dispose: () => {
          cleanupAttempts.push('second')
          if (failSecondCleanup) {
            failSecondCleanup = false
            throw new Error('second bundle cleanup failed')
          }
        }
      }))
    }
    const application = applyPreset(core, {
      dependencies,
      capabilityBundles: [first, second]
    })

    const cleanupError = captureCompositionError(() => application.dispose())

    expect(cleanupAttempts.slice(0, 3)).toEqual(['second', 'first', 'engine'])
    expect(cleanupError).toBeInstanceOf(PresetCompositionError)
    expect((cleanupError as PresetCompositionError).result).toMatchObject({
      code: 'CLEANUP_FAILED',
      layer: 'cleanup',
      cleanup: {
        state: 'pending',
        completed: expect.arrayContaining([
          'capability-bundle:package/first',
          'render-engine-provider'
        ]),
        pending: ['capability-bundle:package/second']
      },
      cause: expect.objectContaining({
        cleanupFailures: [
          expect.objectContaining({
            key: 'capability-bundle:package/second'
          })
        ]
      })
    })

    cleanupAttempts.length = 0
    expect(application.dispose()).toMatchObject({ ok: true })
    expect(cleanupAttempts).toEqual(['second'])
  })

  it('stops after a throwing bundle and cleans earlier bundle plus engine provider', () => {
    const { core, dependencies, engineProviderCleanup, registrations } =
      createComposition()
    const firstDispose = vi.fn()
    const first = {
      id: 'package/first',
      owner: { packageName: '@product/first', name: 'first' },
      requires: [],
      install: vi.fn(() => ({
        outputs: ['first-output'],
        dispose: firstDispose
      }))
    }
    const second = {
      id: 'package/second',
      owner: { packageName: '@product/second', name: 'second' },
      requires: ['package/first'],
      install: vi.fn(() => {
        throw new Error('bundle install failed')
      })
    }
    const third = {
      id: 'package/third',
      owner: { packageName: '@product/third', name: 'third' },
      requires: ['package/second'],
      install: vi.fn(() => ({ outputs: ['third-output'], dispose: vi.fn() }))
    }

    const error = captureCompositionError(() =>
      applyPreset(core, {
        dependencies,
        capabilityBundles: [first, second, third]
      })
    )

    expect(error).toMatchObject({
      name: 'PresetCompositionError',
      result: {
        code: 'LAYER_INSTALL_FAILED',
        layer: 'capability-bundle',
        failedBundleId: 'package/second',
        cleanup: {
          state: 'completed',
          completed: expect.arrayContaining([
            'capability-bundle:package/first',
            'render-engine-provider'
          ]),
          pending: []
        },
        cause: expect.objectContaining({ message: 'bundle install failed' })
      }
    })
    expect(firstDispose).toHaveBeenCalledOnce()
    expect(engineProviderCleanup).toHaveBeenCalledOnce()
    expect(third.install).not.toHaveBeenCalled()
    expect(registrations.size).toBe(0)
  })

  it('rejects an empty installation output and cleans the acquired bundle', () => {
    const { core, dependencies } = createComposition()
    const dispose = vi.fn()
    const bundle = {
      id: 'package/no-output',
      owner: { packageName: '@product/no-output', name: 'no-output' },
      requires: [],
      install: vi.fn(() => ({ outputs: [], dispose }))
    }

    const error = captureCompositionError(() =>
      applyPreset(core, { dependencies, capabilityBundles: [bundle] })
    )

    expect(error).toMatchObject({
      name: 'PresetCompositionError',
      result: {
        code: 'LAYER_INSTALL_FAILED',
        layer: 'capability-bundle',
        failedBundleId: 'package/no-output'
      }
    })
    expect(dispose).toHaveBeenCalledOnce()
  })
})

describe('generic preset composition success diagnostics', () => {
  it('publishes equivalent instance-local results for omitted and explicit default composition', () => {
    const omitted = createComposition()
    const explicit = createComposition()

    const omittedApplication = applyPreset(omitted.core)
    const explicitApplication = applyPreset(explicit.core, {
      engine: { id: '@asyra/render-engine-pixi' }
    })

    expect(omittedApplication.result).toEqual(explicitApplication.result)
    expect(omittedApplication.result).not.toBe(explicitApplication.result)
    expect(omittedApplication.result.sharedGroups).not.toBe(
      explicitApplication.result.sharedGroups
    )
    expect(omittedApplication.result).toMatchObject({
      ok: true,
      state: 'completed',
      engineId: '@asyra/render-engine-pixi',
      capabilityBundles: []
    })
    expect(omittedApplication.result.sharedGroups).toEqual([
      'events',
      'property-schemas',
      'property-components',
      'components',
      'render-strategies',
      'selections',
      'ui-properties',
      'shared-data-channels',
      'render-system-subscriptions',
      'data-channel-observers',
      'render-layers'
    ])
    expect(omittedApplication.result.order).toEqual([
      ...omittedApplication.result.sharedGroups.map(
        (groupId) => `shared-defaults:${groupId}`
      ),
      'concrete-engine:@asyra/render-engine-pixi',
      'composition:completed'
    ])
    omittedApplication.dispose()
    explicitApplication.dispose()
  })

  it('reports selected bundles in declared order with detached immutable diagnostics', () => {
    const { core, dependencies } = createComposition()
    const first = {
      id: 'package/first',
      owner: { packageName: '@product/first', name: 'first' },
      requires: [] as string[],
      install: vi.fn(() => ({ outputs: ['first-output'], dispose: vi.fn() }))
    }
    const second = {
      id: 'package/second',
      owner: { packageName: '@product/second', name: 'second' },
      requires: ['package/first'],
      install: vi.fn(() => ({ outputs: ['second-output'], dispose: vi.fn() }))
    }

    const application = applyPreset(core, {
      dependencies,
      engine: { id: '@product/render-engine', factory: vi.fn() },
      capabilityBundles: [first, second]
    })

    first.id = 'mutated-after-apply'
    second.requires[0] = 'mutated-after-apply'

    expect(application.result).toMatchObject({
      ok: true,
      state: 'completed',
      engineId: '@product/render-engine',
      capabilityBundles: ['package/first', 'package/second']
    })
    expect(application.result.order.slice(-4)).toEqual([
      'concrete-engine:@product/render-engine',
      'capability-bundle:package/first',
      'capability-bundle:package/second',
      'composition:completed'
    ])
    expect(Object.isFrozen(application.result)).toBe(true)
    expect(Object.isFrozen(application.result.sharedGroups)).toBe(true)
    expect(Object.isFrozen(application.result.capabilityBundles)).toBe(true)
    expect(Object.isFrozen(application.result.order)).toBe(true)
    expect(application.result).not.toHaveProperty('mode')
    expect(JSON.stringify(application.result)).not.toMatch(/"(2d|3d|hybrid)"/i)
    application.dispose()
  })
})
