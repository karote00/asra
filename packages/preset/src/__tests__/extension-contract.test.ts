import { BehaviorSubject, Subscription } from 'rxjs'
import { describe, expect, it, vi } from 'vitest'
import defaultCore from '@asyra/core'
import type { PropertyComponentDefinition } from '@asyra/core'
import type { PropertySchema } from '@asyra/utils'
import { PropertyTypes } from '@asyra/utils'
import {
  PRESET_EXTENSION_OWNER,
  PRESET_EXTENSION_TARGETS,
  applyPreset,
  getPresetExtensionTarget,
  getPresetExtensionTargets,
  type PresetCoreAPIs,
  type PresetDependencies,
  type PresetExtension
} from '../index'

const createComposition = () => {
  const schemas = new Map<string, PropertySchema>()
  const components = new Map<string, PropertyComponentDefinition>()
  const features = new Map<string, Record<string, unknown>>()
  const systemProperties = new Map<string, BehaviorSubject<unknown>>()
  const lifecycle: string[] = []

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

  const core = {
    getPresetDependencies: () => dependencies,
    registerEvent: vi.fn((event: string | { eventName: string }) => ({
      eventName: typeof event === 'string' ? event : event.eventName,
      publish: vi.fn(),
      subscribe: () => new Subscription()
    })),
    registerDataChannelObserver: vi.fn(),
    registerRenderLayer: vi.fn(),
    registerPropertySchema: vi.fn((schema: PropertySchema) => {
      if (schemas.has(schema.type)) {
        throw new Error(`duplicate schema: ${schema.type}`)
      }
      schemas.set(schema.type, schema)
    }),
    definePropertyComponent: vi.fn(
      (definition: PropertyComponentDefinition) => {
        if (components.has(definition.type)) {
          throw new Error(`duplicate runtime: ${definition.type}`)
        }
        components.set(definition.type, definition)
        return class PresetTestPropertyComponent {
          readonly type = definition.type
        } as never
      }
    ),
    unregisterPropertyRegistration: vi.fn(
      (type: string, scope: 'all' | 'schema' | 'runtime' = 'all') => {
        const removedSchema =
          (scope === 'all' || scope === 'schema') && schemas.delete(type)
        const removedComponent =
          (scope === 'all' || scope === 'runtime') && components.delete(type)
        if (!removedSchema && !removedComponent) {
          return {
            ok: false as const,
            code: 'PROPERTY_REGISTRATION_NOT_FOUND' as const,
            type,
            removedSchema: false as const,
            removedComponent: false as const
          }
        }
        return {
          ok: true as const,
          type,
          removedSchema,
          removedComponent
        }
      }
    ),
    defineFeature: vi.fn(
      (
        name: string,
        _keyConfig: unknown,
        definition: { api?: Record<string, unknown> }
      ) => {
        if (features.has(name)) {
          throw new Error(`duplicate feature: ${name}`)
        }
        const api = definition.api ?? {}
        features.set(name, api)
        return {
          api,
          dispose: () => features.delete(name)
        }
      }
    ),
    getFeature: (name: string) => features.get(name) ?? {},
    unregisterFeature: (name: string) => features.delete(name),
    defineSelection: vi.fn(),
    getSelection: () => undefined,
    defineUIProperty: vi.fn(),
    defineSystemProperty: <T>(key: string, defaultValue: T) => {
      const existing = systemProperties.get(key)
      if (existing) {
        return existing as BehaviorSubject<T>
      }
      const state = new BehaviorSubject(defaultValue)
      systemProperties.set(key, state as BehaviorSubject<unknown>)
      return state
    },
    getSystemPropertyObservable: <T>(key: string) =>
      systemProperties.get(key) as BehaviorSubject<T> | undefined,
    createRenderGradientFillStyle: vi.fn()
  } as unknown as PresetCoreAPIs

  return {
    core,
    dependencies,
    schemas,
    components,
    features,
    lifecycle
  }
}

const extension = (
  value: Omit<PresetExtension, 'owner'> & {
    owner?: PresetExtension['owner']
  }
): PresetExtension => ({
  owner: { packageName: '@asyra/asyra-design', name: 'test-app' },
  ...value
})

describe('preset extension contract', () => {
  it('publishes stable detached target identity and owner metadata', () => {
    const positionSchemaTarget =
      PRESET_EXTENSION_TARGETS.PROPERTY_SCHEMAS[PropertyTypes.POSITION]
    const positionRuntimeTarget =
      PRESET_EXTENSION_TARGETS.PROPERTY_RUNTIMES[PropertyTypes.POSITION]

    expect(PRESET_EXTENSION_TARGETS.FEATURE_REGISTRATIONS).toBe(
      'preset.feature.registrations'
    )
    expect(positionSchemaTarget).toBe('preset.property.schema:position')
    expect(positionRuntimeTarget).toBe('preset.property.runtime:position')

    const metadata = getPresetExtensionTarget(positionRuntimeTarget)
    expect(metadata).toMatchObject({
      key: positionRuntimeTarget,
      name: 'Position property runtime',
      kind: 'property-runtime',
      owner: PRESET_EXTENSION_OWNER,
      supportedStrategies: ['replace']
    })

    if (!metadata) {
      throw new Error('position runtime metadata is required')
    }
    ;(metadata.owner as { name: string }).name = 'mutated'
    ;(metadata.supportedStrategies as string[]).push('append')

    expect(getPresetExtensionTarget(positionRuntimeTarget)).toMatchObject({
      owner: PRESET_EXTENSION_OWNER,
      supportedStrategies: ['replace']
    })
    expect(getPresetExtensionTargets().at(-1)?.key).toBe(
      PRESET_EXTENSION_TARGETS.FEATURE_REGISTRATIONS
    )
  })

  it('extends feature registration through the public target in deterministic order', () => {
    const { core, features, lifecycle } = createComposition()
    const targetKey = PRESET_EXTENSION_TARGETS.FEATURE_REGISTRATIONS
    const resources = new Set<string>()
    const createInstaller = (key: string) => () => {
      lifecycle.push(`install:${key}`)
      resources.add(key)
      return () => {
        lifecycle.push(`dispose:${key}`)
        resources.delete(key)
      }
    }

    const application = applyPreset(core, {
      extensions: [
        extension({
          key: 'feature-before-1',
          targetKey,
          strategy: 'before',
          install: createInstaller('before-1')
        }),
        extension({
          key: 'feature-before-2',
          targetKey,
          strategy: 'before',
          install: createInstaller('before-2')
        }),
        extension({
          key: 'feature-replace',
          targetKey,
          strategy: 'replace',
          install: ({ core: presetCore }) => {
            lifecycle.push('install:replace')
            const registration = presetCore.defineFeature(
              'app-extended-feature',
              undefined,
              { api: { owner: 'app' } }
            )
            return () => {
              lifecycle.push('dispose:replace')
              registration.dispose()
            }
          }
        }),
        extension({
          key: 'feature-after',
          targetKey,
          strategy: 'after',
          install: createInstaller('after')
        }),
        extension({
          key: 'feature-append',
          targetKey,
          strategy: 'append',
          install: createInstaller('append')
        })
      ]
    })

    expect(lifecycle).toEqual([
      'install:before-1',
      'install:before-2',
      'install:replace',
      'install:after',
      'install:append'
    ])
    expect(features.get('app-extended-feature')).toEqual({ owner: 'app' })

    expect(application.unregisterTarget(targetKey)).toMatchObject({
      ok: true,
      targetKey,
      appliedKeys: [
        'feature-before-1',
        'feature-before-2',
        'feature-replace',
        'feature-after',
        'feature-append'
      ]
    })
    expect(lifecycle.slice(5)).toEqual([
      'dispose:append',
      'dispose:after',
      'dispose:replace',
      'dispose:before-2',
      'dispose:before-1'
    ])
    expect(features.has('app-extended-feature')).toBe(false)
    expect(resources.size).toBe(0)
  })

  it('explicitly replaces property schema and runtime defaults without duplicate registration', () => {
    const { core, schemas, components } = createComposition()
    const customSchema: PropertySchema = {
      type: PropertyTypes.POSITION,
      fields: [{ key: 'x', kind: 'number', defaultValue: 10 }]
    }
    const customRuntime: PropertyComponentDefinition = {
      type: PropertyTypes.POSITION,
      defaults: { x: 10, y: 20 }
    }

    applyPreset(core, {
      extensions: [
        extension({
          key: 'custom-position-schema',
          targetKey:
            PRESET_EXTENSION_TARGETS.PROPERTY_SCHEMAS[PropertyTypes.POSITION],
          strategy: 'replace',
          install: ({ core: presetCore }) => {
            presetCore.registerPropertySchema(customSchema)
            return () => {
              presetCore.unregisterPropertyRegistration(
                PropertyTypes.POSITION,
                'schema'
              )
            }
          }
        }),
        extension({
          key: 'custom-position-runtime',
          targetKey:
            PRESET_EXTENSION_TARGETS.PROPERTY_RUNTIMES[PropertyTypes.POSITION],
          strategy: 'replace',
          install: ({ core: presetCore }) => {
            presetCore.definePropertyComponent(customRuntime)
            return () => {
              presetCore.unregisterPropertyRegistration(
                PropertyTypes.POSITION,
                'runtime'
              )
            }
          }
        })
      ]
    })

    expect(schemas.get(PropertyTypes.POSITION)).toBe(customSchema)
    expect(components.get(PropertyTypes.POSITION)).toBe(customRuntime)
  })

  it('uses unregister then redefine as the deterministic unsupported-strategy fallback', () => {
    const { core, components } = createComposition()
    const targetKey =
      PRESET_EXTENSION_TARGETS.PROPERTY_RUNTIMES[PropertyTypes.POSITION]
    const application = applyPreset(core)

    expect(application.getTarget(targetKey)?.supportedStrategies).toEqual([
      'replace'
    ])
    expect(application.unregisterTarget(targetKey)).toMatchObject({
      ok: true,
      targetKey
    })
    expect(components.has(PropertyTypes.POSITION)).toBe(false)

    const customRuntime: PropertyComponentDefinition = {
      type: PropertyTypes.POSITION,
      defaults: { x: 50, y: 60 }
    }
    core.definePropertyComponent(customRuntime)
    expect(components.get(PropertyTypes.POSITION)).toBe(customRuntime)

    expect(() => application.unregisterTarget(targetKey)).toThrow(
      expect.objectContaining({ code: 'TARGET_NOT_APPLIED' })
    )
    expect(components.get(PropertyTypes.POSITION)).toBe(customRuntime)
  })

  it.each([
    {
      name: 'missing target',
      expectedCode: 'TARGET_NOT_FOUND',
      extensions: [
        extension({
          key: 'missing-target-extension',
          targetKey: 'preset.missing',
          strategy: 'append',
          install: () => () => undefined
        })
      ]
    },
    {
      name: 'invalid strategy',
      expectedCode: 'INVALID_STRATEGY',
      extensions: [
        extension({
          key: 'invalid-strategy-extension',
          targetKey: PRESET_EXTENSION_TARGETS.FEATURE_REGISTRATIONS,
          strategy: 'sideways' as never,
          install: () => () => undefined
        })
      ]
    },
    {
      name: 'unsupported strategy',
      expectedCode: 'UNSUPPORTED_STRATEGY',
      extensions: [
        extension({
          key: 'unsupported-property-extension',
          targetKey:
            PRESET_EXTENSION_TARGETS.PROPERTY_RUNTIMES[PropertyTypes.POSITION],
          strategy: 'after',
          install: () => () => undefined
        })
      ]
    },
    {
      name: 'duplicate extension key',
      expectedCode: 'DUPLICATE_EXTENSION',
      extensions: [
        extension({
          key: 'duplicate-extension',
          targetKey: PRESET_EXTENSION_TARGETS.FEATURE_REGISTRATIONS,
          strategy: 'before',
          install: () => () => undefined
        }),
        extension({
          key: 'duplicate-extension',
          targetKey: PRESET_EXTENSION_TARGETS.FEATURE_REGISTRATIONS,
          strategy: 'after',
          install: () => () => undefined
        })
      ]
    },
    {
      name: 'replace conflict',
      expectedCode: 'REPLACE_CONFLICT',
      extensions: [
        extension({
          key: 'replace-one',
          targetKey: PRESET_EXTENSION_TARGETS.FEATURE_REGISTRATIONS,
          strategy: 'replace',
          install: () => () => undefined
        }),
        extension({
          key: 'replace-two',
          targetKey: PRESET_EXTENSION_TARGETS.FEATURE_REGISTRATIONS,
          strategy: 'replace',
          install: () => () => undefined
        })
      ]
    }
  ])('fails fast with a stable structured $name error', (testCase) => {
    const { core, schemas, components, features } = createComposition()

    expect(() =>
      applyPreset(core, { extensions: testCase.extensions })
    ).toThrow(expect.objectContaining({ code: testCase.expectedCode }))
    expect(schemas.size).toBe(0)
    expect(components.size).toBe(0)
    expect(features.size).toBe(0)
  })

  it('disposes all applied property targets and extension resources without stale registrations', () => {
    const { core, schemas, components } = createComposition()
    const resources = new Set(['observer', 'handler'])
    const application = applyPreset(core, {
      extensions: [
        extension({
          key: 'owned-feature-resources',
          targetKey: PRESET_EXTENSION_TARGETS.FEATURE_REGISTRATIONS,
          strategy: 'append',
          install: () => () => resources.clear()
        })
      ]
    })

    expect(schemas.size).toBeGreaterThan(0)
    expect(components.size).toBeGreaterThan(0)
    expect(application.dispose()).toMatchObject({
      ok: true,
      operation: 'dispose'
    })
    expect(schemas.size).toBe(0)
    expect(components.size).toBe(0)
    expect(resources.size).toBe(0)
  })

  it('rolls back applied targets when later preset startup wiring fails', () => {
    const { core, schemas, components } = createComposition()
    vi.mocked(core.defineUIProperty).mockImplementationOnce(() => {
      throw new Error('later preset wiring failed')
    })

    expect(() => applyPreset(core)).toThrow('later preset wiring failed')
    expect(schemas.size).toBe(0)
    expect(components.size).toBe(0)
  })

  it('routes a public feature extension through the actual Core and feature lifecycle owners', () => {
    const featureName = 'preset-public-feature-integration'
    defaultCore.unregisterFeature(featureName)

    const application = applyPreset(defaultCore, {
      extensions: [
        extension({
          key: 'actual-core-feature',
          targetKey: PRESET_EXTENSION_TARGETS.FEATURE_REGISTRATIONS,
          strategy: 'append',
          install: ({ core }) => {
            const registration = core.defineFeature(featureName, undefined, {
              api: { owner: 'actual-core' }
            })
            return () => registration.dispose()
          }
        })
      ]
    })

    expect(defaultCore.getFeature(featureName)).toEqual({
      owner: 'actual-core'
    })
    expect(
      application.unregisterTarget(
        PRESET_EXTENSION_TARGETS.FEATURE_REGISTRATIONS
      )
    ).toMatchObject({ ok: true })
    expect(() => defaultCore.getFeature(featureName)).toThrow(
      `Feature "${featureName}" not found`
    )
    expect(application.dispose()).toMatchObject({ ok: true })
  })
})
