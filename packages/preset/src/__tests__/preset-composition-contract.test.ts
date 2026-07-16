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
  const registrations = new Map<string, RegistrationNodeMetadata>()
  const systemProperties = new Map<string, BehaviorSubject<unknown>>()

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
      zoomTo: () => undefined,
      panTo: () => undefined
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
    registerEvent: vi.fn((event: string | { eventName: string }) => ({
      eventName: typeof event === 'string' ? event : event.eventName,
      publish: vi.fn(),
      subscribe: () => new Subscription()
    })),
    registerDataChannelObserver: vi.fn(),
    registerRenderLayer: vi.fn(),
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
    defineSelection: vi.fn(),
    getSelection: () => undefined,
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
    getRegistration: (ref: RegistrationRef) => registrations.get(refKey(ref)),
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
    registrations,
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
