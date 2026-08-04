import {
  getFeatureRegistry,
  unregisterFeature as unregisterFeatureDirect
} from '@asyra/feature-system'
import {
  PropertyRegistrationError,
  propertyComponentRegistry,
  propertySchemaRegistry,
  PropsManager
} from '@asyra/props-manager'
import type { PropertyComponentInstanceDataTypes } from '@asyra/utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Core } from '../core.js'
import type { CorePresetInstallAPIs } from '../index.js'

const FEATURE_NAME = 'core-facade-feature'
const PROPERTY_TYPE = 'core-facade-property'

const createCoreForTest = () => {
  const props = new PropsManager()
  const sharedChannels = new Map<string, unknown>()
  const core = new Core({
    inputSystem: {} as never,
    factory: {
      registerTransactionReplayHandler: vi.fn(() => () => undefined),
      subscribeToCommitCapture: vi.fn(() => () => undefined),
      subscribeToTransactionStatus: vi.fn(() => () => undefined),
      registerSharedDataChannel: vi.fn((name: string, channel: unknown) => {
        sharedChannels.set(name, channel)
      }),
      unregisterSharedDataChannel: vi.fn((name: string) =>
        sharedChannels.delete(name)
      ),
      hasSharedDataChannel: vi.fn((name: string) => sharedChannels.has(name)),
      createLocalSharedDataChannel: vi.fn(() => ({ owner: 'local' }))
    } as never,
    props,
    render: {
      getViewportPosition: () => ({ x: 0, y: 0 }),
      getViewportScale: () => 1
    } as never,
    sceneTree: {} as never,
    selection: {} as never,
    systemContext: {} as never
  })
  return { core, props, sharedChannels }
}

describe('Core registration facade', () => {
  beforeEach(() => {
    unregisterFeatureDirect(FEATURE_NAME)
    propertyComponentRegistry.clear()
    propertySchemaRegistry.clear()
  })

  it('defines, queries, and unregisters a feature through one Core instance', () => {
    const { core } = createCoreForTest()
    const registration = core.defineFeature(FEATURE_NAME, undefined, {
      api: { owner: 'app' }
    })

    expect(registration.api).toEqual({ owner: 'app' })
    expect(core.getFeature(FEATURE_NAME)).toEqual({ owner: 'app' })
    expect(core.unregisterFeature(FEATURE_NAME)).toBe(true)
    expect(getFeatureRegistry().has(FEATURE_NAME)).toBe(false)
  })

  it('preserves duplicate feature registration failure', () => {
    const { core } = createCoreForTest()
    core.defineFeature(FEATURE_NAME, undefined, { api: {} })

    expect(() =>
      core.defineFeature(FEATURE_NAME, undefined, { api: {} })
    ).toThrow(`Feature "${FEATURE_NAME}" is already registered`)
  })

  it('defines property runtime and schema registration through Core', () => {
    const { core } = createCoreForTest()
    const Constructor = core.definePropertyComponent({
      type: PROPERTY_TYPE,
      defaults: { value: 0 }
    })
    core.registerPropertySchema({
      type: PROPERTY_TYPE,
      fields: [{ key: 'value', kind: 'number', defaultValue: 0 }]
    })

    expect(core.getPropertyComponent(PROPERTY_TYPE)).toBe(Constructor)
    expect(core.getPropertySchema(PROPERTY_TYPE)).toMatchObject({
      type: PROPERTY_TYPE
    })
  })

  it('delegates property active-use guard to the injected PropsManager', () => {
    const { core, props } = createCoreForTest()
    const Constructor = core.definePropertyComponent({
      type: PROPERTY_TYPE,
      defaults: { value: 0 }
    })
    core.registerPropertySchema({
      type: PROPERTY_TYPE,
      fields: [{ key: 'value', kind: 'number', defaultValue: 0 }]
    })
    props.addToMap(
      new Constructor({ id: 'core-property', type: PROPERTY_TYPE, value: 1 })
    )

    expect(() => core.unregisterPropertyRegistration(PROPERTY_TYPE)).toThrow(
      expect.objectContaining<Partial<PropertyRegistrationError>>({
        code: 'PROPERTY_TYPE_IN_USE',
        propertyIds: ['core-property']
      })
    )
    expect(core.getPropertyComponent(PROPERTY_TYPE)).toBe(Constructor)

    props.dispose()
    expect(core.unregisterPropertyRegistration(PROPERTY_TYPE)).toEqual({
      ok: true,
      type: PROPERTY_TYPE,
      removedSchema: true,
      removedComponent: true
    })
  })

  it('exposes structured missing property unregister result', () => {
    const { core } = createCoreForTest()

    expect(core.unregisterPropertyRegistration(PROPERTY_TYPE)).toEqual({
      ok: false,
      code: 'PROPERTY_REGISTRATION_NOT_FOUND',
      type: PROPERTY_TYPE,
      removedSchema: false,
      removedComponent: false
    })
  })

  it('forwards explicit property cleanup scope without adding Core policy', () => {
    const { core } = createCoreForTest()
    const Constructor = core.definePropertyComponent({
      type: PROPERTY_TYPE,
      defaults: { value: 0 }
    })
    core.registerPropertySchema({
      type: PROPERTY_TYPE,
      fields: [{ key: 'value', kind: 'number', defaultValue: 0 }]
    })

    expect(
      core.unregisterPropertyRegistration(PROPERTY_TYPE, 'runtime')
    ).toEqual({
      ok: true,
      type: PROPERTY_TYPE,
      removedSchema: false,
      removedComponent: true
    })
    expect(core.getPropertySchema(PROPERTY_TYPE)).toBeDefined()
    expect(core.getPropertyComponent(PROPERTY_TYPE)).toBeUndefined()
    expect(Constructor).toBeDefined()
  })

  it('includes lifecycle APIs in the strict preset install tier', () => {
    const { core } = createCoreForTest()
    const presetApi: CorePresetInstallAPIs = core

    expect(presetApi.defineFeature).toBe(core.defineFeature)
    expect(presetApi.unregisterFeature).toBe(core.unregisterFeature)
    expect(presetApi.definePropertyComponent).toBe(core.definePropertyComponent)
    expect(presetApi.unregisterPropertyRegistration).toBe(
      core.unregisterPropertyRegistration
    )
    expect(presetApi.unregisterEvent).toBe(core.unregisterEvent)
    expect(presetApi.unregisterRenderLayer).toBe(core.unregisterRenderLayer)
    expect(presetApi.unregisterSelection).toBe(core.unregisterSelection)
    expect(presetApi.unregisterDataChannelObserver).toBe(
      core.unregisterDataChannelObserver
    )
    expect(presetApi.registerSharedDataChannel).toBe(
      core.registerSharedDataChannel
    )
    expect(presetApi.unregisterSharedDataChannel).toBe(
      core.unregisterSharedDataChannel
    )
    expect(presetApi.hasSharedDataChannel).toBe(core.hasSharedDataChannel)
    expect(presetApi.createLocalSharedDataChannel).toBe(
      core.createLocalSharedDataChannel
    )
  })

  it('preserves render-layer shouldUpdate through the Core facade contract', () => {
    const registerLayer = vi.fn()
    const core = new Core({
      inputSystem: {} as never,
      factory: {
        registerTransactionReplayHandler: vi.fn(() => () => undefined),
        subscribeToCommitCapture: vi.fn(() => () => undefined),
        subscribeToTransactionStatus: vi.fn(() => () => undefined)
      } as never,
      props: new PropsManager(),
      render: {
        getViewportPosition: () => ({ x: 0, y: 0 }),
        getViewportScale: () => 1,
        registerLayer
      } as never,
      sceneTree: {} as never,
      selection: {} as never,
      systemContext: {} as never
    })
    const shouldUpdate = vi.fn(() => false)

    core.registerRenderLayer({
      name: 'diagnostic-layer',
      layer: {},
      shouldUpdate,
      update: () => true
    })

    expect(registerLayer).toHaveBeenCalledWith(
      expect.objectContaining({ shouldUpdate }),
      undefined
    )
  })

  it('routes shared data channels through the injected Factory', () => {
    const { core, sharedChannels } = createCoreForTest()
    const channel = { owner: 'injected-factory' }

    core.registerSharedDataChannel('core-channel', channel as never)

    expect(core.hasSharedDataChannel('core-channel')).toBe(true)
    expect(sharedChannels.get('core-channel')).toBe(channel)
    expect(core.unregisterSharedDataChannel('core-channel')).toBe(true)
    expect(sharedChannels.has('core-channel')).toBe(false)
  })

  it('creates configured runtime values without changing schema semantics', () => {
    const { core } = createCoreForTest()
    const Constructor = core.definePropertyComponent({
      type: PROPERTY_TYPE,
      defaults: { value: 0 }
    })
    const component = new Constructor({
      id: 'configured-property',
      type: PROPERTY_TYPE,
      value: 5
    })

    expect(
      component.get('value' as keyof PropertyComponentInstanceDataTypes)
    ).toBe(5)
  })
})
