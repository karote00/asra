import { unregisterFeature as unregisterFeatureDirect } from '@asyra/feature-system'
import {
  getPropertyComponent,
  propertyComponentRegistry,
  propertySchemaRegistry,
  PropsManager,
  unregisterPropertyComponent
} from '@asyra/props-manager'
import { renderStrategyRegistry } from '@asyra/render'
import sceneTree, { componentRegistry, SceneTree } from '@asyra/scene-tree'
import { propertyRegistry } from '@asyra/ui-context'
import { RegistrationGraph, idCounter, nameCounter } from '@asyra/utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { unregisterComponent as unregisterComponentDirect } from '../define-component'
import { Core } from '../core'
import { expectRelationError } from './registration-test-utils'

const POSITION = 'composition-position'
const FILLS = 'composition-fills'
const PARENT = 'composition-parent'
const SHAPE = 'composition-shape'
const FEATURE = 'composition-feature'

const createCoreForTest = () => {
  const props = new PropsManager()
  const ownedSceneTree = new SceneTree()
  const core = new Core({
    inputSystem: {} as never,
    factory: {
      registerTransactionReplayHandler: vi.fn(() => () => undefined),
      subscribeToCommitCapture: vi.fn(() => () => undefined),
      subscribeToTransactionStatus: vi.fn(() => () => undefined),
      reportPersistenceStatus: vi.fn()
    } as never,
    props,
    render: {
      getViewportPosition: () => ({ x: 0, y: 0 }),
      getViewportScale: () => 1
    } as never,
    sceneTree: ownedSceneTree,
    selection: {} as never,
    systemContext: {} as never
  })
  core.setupInputSystem = vi.fn()
  core.initFeatureSystem = vi.fn()
  core.renderIsReady = vi.fn()
  return { core, props, sceneTree: ownedSceneTree }
}

const cleanup = () => {
  sceneTree.dispose()
  unregisterComponentDirect(SHAPE, { force: true })
  componentRegistry.unregister(SHAPE)
  renderStrategyRegistry.unregister(SHAPE)
  idCounter.unregisterType(SHAPE)
  nameCounter.unregisterType(SHAPE)
  unregisterFeatureDirect(FEATURE)
  propertyRegistry.unregister('composition-ui')
  propertyComponentRegistry.clear()
  propertySchemaRegistry.clear()
}

const leavePropertyTargetPending = (
  core: Core,
  propertyType: string
): RegistrationGraph => {
  const graph = (core as unknown as { registrationGraph: RegistrationGraph })
    .registrationGraph
  const source = { kind: 'a-test-detach-owner', key: propertyType }
  graph.registerNode({
    ref: source,
    handlers: {
      detachRelation: () => {
        throw new Error('test detach failed')
      }
    }
  })
  graph.defineRelation(source, {
    name: 'pending-target',
    target: { kind: 'property', key: propertyType },
    onTargetUnregister: 'detach'
  })

  expectRelationError(
    () => core.unregisterPropertyType(propertyType),
    'RELATION_REMOVE_FAILED'
  )
  graph.removeRelation(source, 'pending-target')
  return graph
}

describe('Core composition coordinator', () => {
  beforeEach(cleanup)

  it('exposes app-friendly component, relation, render, UI, and metadata facades', () => {
    const { core } = createCoreForTest()
    core.definePropertyComponent({ type: POSITION, defaults: { x: 0 } })
    core.definePropertyComponent({ type: FILLS, defaults: { color: 'red' } })
    core.defineComponent({
      type: SHAPE,
      idPrefix: SHAPE,
      namePrefix: 'Composition Shape',
      properties: [
        { name: 'position', type: POSITION },
        { name: 'fills', type: FILLS }
      ]
    })

    expect(core.getRegistration({ kind: 'component', key: SHAPE })).toEqual({
      ref: { kind: 'component', key: SHAPE },
      owner: { packageName: 'app', name: SHAPE }
    })
    expect(
      core
        .getComponentPropertyRelations(SHAPE)
        .map(({ propertyName }) => propertyName)
    ).toEqual(['position', 'fills'])

    core.removeComponentPropertyRelation(SHAPE, 'fills')
    core.defineComponentPropertyRelation(SHAPE, {
      name: 'outline',
      type: FILLS
    })
    expect(
      core
        .getComponentPropertyRelations(SHAPE)
        .map(({ propertyName }) => propertyName)
    ).toEqual(['position', 'outline'])

    const strategy = vi.fn()
    core.registerRenderStrategy(SHAPE, strategy)
    expect(renderStrategyRegistry.get(SHAPE)).toBe(strategy)
    expect(core.unregisterRenderStrategy(SHAPE)).toBe(true)

    propertyRegistry.register('composition-ui', { defaultValue: 0 })
    expect(core.unregisterUIProperty('composition-ui')).toBe(true)
    expect(propertyRegistry.get('composition-ui')).toBeUndefined()
  })

  it('unregisters one property capability, detaches structural sources, and preserves unrelated nodes', () => {
    const { core } = createCoreForTest()
    core.definePropertyComponent({ type: POSITION, defaults: { x: 0 } })
    core.definePropertyComponent({ type: FILLS, defaults: { color: 'red' } })
    core.definePropertyComponent({
      type: PARENT,
      defaults: { childIds: [] },
      children: { key: 'childIds', childType: FILLS }
    })
    core.defineComponent({
      type: SHAPE,
      idPrefix: SHAPE,
      namePrefix: 'Composition Shape',
      properties: [
        { name: 'position', type: POSITION },
        { name: 'fills', type: FILLS },
        { name: 'parent', type: PARENT }
      ]
    })

    const result = core.unregisterPropertyType(FILLS)

    expect(result.detachedSources).toEqual([
      { kind: 'component', key: SHAPE },
      { kind: 'property', key: PARENT }
    ])
    expect(result.recursivelyUnregisteredSources).toEqual([])
    expect(getPropertyComponent(FILLS)).toBeUndefined()
    expect(getPropertyComponent(POSITION)).toBeDefined()
    expect(getPropertyComponent(PARENT)).toBeDefined()
    expect(core.getPropertyChildRelations(PARENT)).toEqual([])
    expect(
      core
        .getComponentPropertyRelations(SHAPE)
        .map(({ propertyName }) => propertyName)
    ).toEqual(['position', 'parent'])
    expect(
      core.getRegistration({ kind: 'component', key: SHAPE })
    ).toBeDefined()
    expect(
      core.getRegistration({ kind: 'property', key: PARENT })
    ).toBeDefined()
  })

  it('unregisters a component without deleting an independent render strategy owner', () => {
    const { core } = createCoreForTest()
    core.definePropertyComponent({ type: FILLS, defaults: {} })
    core.defineComponent({
      type: SHAPE,
      idPrefix: SHAPE,
      namePrefix: 'Composition Shape',
      properties: [
        {
          name: 'fills',
          type: FILLS,
          schema: {
            type: FILLS,
            fields: [{ key: 'color', kind: 'string', defaultValue: 'red' }]
          }
        }
      ]
    })
    const strategy = vi.fn()
    core.registerRenderStrategy(SHAPE, strategy, {
      relations: [
        {
          name: 'fills-runtime',
          target: { kind: 'property', key: FILLS },
          onTargetUnregister: 'unregister-source'
        }
      ]
    })

    expect(core.unregisterComponent(SHAPE)).toBe(true)
    expect(componentRegistry.has(SHAPE)).toBe(false)
    expect(renderStrategyRegistry.get(SHAPE)).toBe(strategy)
    expect(core.getPropertySchema(FILLS)).toBeDefined()
    expect(
      core.getRegistration({ kind: 'render-strategy', key: SHAPE })
    ).toBeDefined()
    expect(() => core.getRegistrationRelations()).not.toThrow()
  })

  it('tracks and recursively cleans a component definition inline render strategy', () => {
    const { core } = createCoreForTest()
    core.definePropertyComponent({ type: FILLS, defaults: {} })
    const inlineStrategy = vi.fn()
    const definition = {
      type: SHAPE,
      idPrefix: SHAPE,
      namePrefix: 'Inline Render Shape',
      properties: [{ name: 'fills', type: FILLS }],
      renderStrategy: inlineStrategy
    }

    core.defineComponent(definition)

    expect(
      core.getRegistration({ kind: 'render-strategy', key: SHAPE })
    ).toEqual({
      ref: { kind: 'render-strategy', key: SHAPE },
      owner: { packageName: 'app', name: SHAPE }
    })
    expect(core.getRegistrationRelations()).toContainEqual({
      source: { kind: 'render-strategy', key: SHAPE },
      name: 'component-owner',
      target: { kind: 'component', key: SHAPE },
      onTargetUnregister: 'unregister-source'
    })

    expect(core.unregisterComponent(SHAPE)).toBe(true)
    expect(componentRegistry.has(SHAPE)).toBe(false)
    expect(renderStrategyRegistry.has(SHAPE)).toBe(false)
    expect(
      core.getRegistration({ kind: 'render-strategy', key: SHAPE })
    ).toBeUndefined()
    expect(() => core.defineComponent(definition)).not.toThrow()
  })

  it('records definition-local owner metadata and recursively unregisters declared opaque dependents', () => {
    const { core } = createCoreForTest()
    const owner = {
      packageName: '@asyra/preset',
      name: 'default-preset'
    }
    const target = { kind: 'property', key: FILLS }

    core.definePropertyComponent({
      type: FILLS,
      defaults: { color: 'red' },
      registration: { owner }
    } as never)
    core.registerRenderStrategy(SHAPE, vi.fn(), {
      owner,
      relations: [
        {
          name: 'fills-runtime',
          target,
          onTargetUnregister: 'unregister-source'
        }
      ]
    } as never)
    core.defineUIProperty('composition-ui', {
      defaultValue: null,
      registration: {
        owner,
        relations: [
          {
            name: 'fills-runtime',
            target,
            onTargetUnregister: 'unregister-source'
          }
        ]
      }
    } as never)
    core.defineFeature(FEATURE, undefined, {
      api: {},
      registration: {
        owner,
        relations: [
          {
            name: 'fills-runtime',
            target,
            onTargetUnregister: 'unregister-source'
          }
        ]
      }
    } as never)

    expect(core.getRegistration(target)?.owner).toEqual(owner)
    expect(
      core.getRegistrationRelations().map(({ source, name, target }) => ({
        source,
        name,
        target
      }))
    ).toEqual([
      {
        source: { kind: 'feature', key: FEATURE },
        name: 'fills-runtime',
        target
      },
      {
        source: { kind: 'render-strategy', key: SHAPE },
        name: 'fills-runtime',
        target
      },
      {
        source: { kind: 'ui-property', key: 'composition-ui' },
        name: 'fills-runtime',
        target
      }
    ])

    const result = core.unregisterPropertyType(FILLS)

    expect(result.recursivelyUnregisteredSources).toEqual([
      { kind: 'feature', key: FEATURE },
      { kind: 'render-strategy', key: SHAPE },
      { kind: 'ui-property', key: 'composition-ui' }
    ])
    expect(renderStrategyRegistry.has(SHAPE)).toBe(false)
    expect(propertyRegistry.get('composition-ui')).toBeUndefined()
    expect(() => core.getFeature(FEATURE)).toThrow()
  })

  it('supports unregister then redefine as the explicit full-capability fallback', () => {
    const { core } = createCoreForTest()
    core.registerPropertySchema({
      type: FILLS,
      fields: [{ key: 'color', kind: 'string', defaultValue: 'red' }]
    })
    core.definePropertyComponent({
      type: FILLS,
      defaults: { color: 'red' }
    })

    expect(core.unregisterPropertyType(FILLS)).toMatchObject({
      ok: true,
      root: { kind: 'property', key: FILLS }
    })

    core.registerPropertySchema({
      type: FILLS,
      fields: [{ key: 'outline', kind: 'string', defaultValue: 'black' }]
    })
    core.definePropertyComponent({
      type: FILLS,
      defaults: { outline: 'black' }
    })

    expect(core.getPropertySchema(FILLS)?.fields).toEqual([
      { key: 'outline', kind: 'string', defaultValue: 'black' }
    ])
    expect(core.getRegistration({ kind: 'property', key: FILLS })).toEqual({
      ref: { kind: 'property', key: FILLS },
      owner: { packageName: 'app', name: FILLS }
    })
  })

  it('fails fast with structured registration conflicts across public facades', () => {
    const { core } = createCoreForTest()
    const schema = {
      type: FILLS,
      fields: [{ key: 'color', kind: 'string' as const, defaultValue: 'red' }]
    }
    core.registerPropertySchema(schema)
    expectRelationError(
      () => core.registerPropertySchema(schema),
      'UNREGISTER_FAILED'
    )

    core.definePropertyComponent({ type: FILLS, defaults: { color: 'red' } })
    expectRelationError(
      () =>
        core.definePropertyComponent({
          type: FILLS,
          defaults: { color: 'blue' }
        }),
      'UNREGISTER_FAILED'
    )

    core.defineComponent({
      type: SHAPE,
      idPrefix: SHAPE,
      namePrefix: 'Composition Shape',
      properties: [{ name: 'fills', type: FILLS }]
    })
    expectRelationError(
      () =>
        core.defineComponent({
          type: SHAPE,
          idPrefix: SHAPE,
          namePrefix: 'Duplicate Shape',
          properties: [{ name: 'fills', type: FILLS }]
        }),
      'UNREGISTER_FAILED'
    )

    core.registerRenderStrategy(SHAPE, vi.fn())
    expectRelationError(
      () => core.registerRenderStrategy(SHAPE, vi.fn()),
      'UNREGISTER_FAILED'
    )

    core.defineUIProperty('composition-ui', { defaultValue: 0 })
    expectRelationError(
      () => core.defineUIProperty('composition-ui', { defaultValue: 1 }),
      'UNREGISTER_FAILED'
    )

    core.defineFeature(FEATURE, undefined, { api: {} })
    expectRelationError(
      () => core.defineFeature(FEATURE, undefined, { api: {} }),
      'UNREGISTER_FAILED'
    )
  })

  it('preflights split property relation conflicts without leaving a stale runtime', () => {
    const { core } = createCoreForTest()
    const relation = {
      name: 'position-runtime',
      target: { kind: 'property', key: POSITION },
      onTargetUnregister: 'unregister-source' as const
    }
    core.definePropertyComponent({ type: POSITION, defaults: { x: 0 } })
    core.registerPropertySchema(
      {
        type: FILLS,
        fields: [{ key: 'color', kind: 'string', defaultValue: 'red' }]
      },
      undefined,
      { relations: [relation] }
    )

    expectRelationError(
      () =>
        core.definePropertyComponent({
          type: FILLS,
          defaults: { color: 'red' },
          registration: { relations: [relation] }
        }),
      'DUPLICATE_RELATION'
    )
    expect(getPropertyComponent(FILLS)).toBeUndefined()
    expect(core.getPropertySchema(FILLS)).toBeDefined()
  })

  it('rejects pending relation targets before component or property owners mutate', () => {
    const { core } = createCoreForTest()
    core.definePropertyComponent({ type: FILLS, defaults: {} })
    core.definePropertyComponent({
      type: PARENT,
      defaults: { childIds: [] },
      children: { key: 'childIds', childType: FILLS }
    })
    core.defineComponent({
      type: SHAPE,
      idPrefix: SHAPE,
      namePrefix: 'Composition Shape',
      properties: [{ name: 'paint', type: FILLS }]
    })
    const graph = leavePropertyTargetPending(core, FILLS)

    expect(core.removeComponentPropertyRelation(SHAPE, 'paint')).toMatchObject({
      ok: true,
      operation: 'remove-relation'
    })
    expect(core.removePropertyChildRelation(PARENT, 'childIds')).toMatchObject({
      ok: true,
      operation: 'remove-relation'
    })

    expectRelationError(
      () =>
        core.defineComponentPropertyRelation(SHAPE, {
          name: 'paint',
          type: FILLS
        }),
      'UNREGISTER_FAILED'
    )
    expectRelationError(
      () =>
        core.definePropertyChildRelation(PARENT, {
          key: 'childIds',
          childType: FILLS
        }),
      'UNREGISTER_FAILED'
    )

    expect(core.getComponentPropertyRelations(SHAPE)).toEqual([])
    expect(core.getPropertyChildRelations(PARENT)).toEqual([])
    expect(
      graph.getOutgoingRelations({ kind: 'component', key: SHAPE })
    ).toEqual([])
    expect(
      graph.getOutgoingRelations({ kind: 'property', key: PARENT })
    ).toEqual([])

    expect(core.unregisterPropertyType(FILLS)).toMatchObject({ ok: true })
    expect(core.getComponentPropertyRelations(SHAPE)).toEqual([])
    expect(core.getPropertyChildRelations(PARENT)).toEqual([])
  })

  it('preflights pending targets before declarative or opaque owners register', () => {
    const { core } = createCoreForTest()
    core.definePropertyComponent({ type: FILLS, defaults: {} })
    const graph = leavePropertyTargetPending(core, FILLS)

    expectRelationError(
      () =>
        core.defineComponent({
          type: SHAPE,
          idPrefix: SHAPE,
          namePrefix: 'Pending Target Shape',
          properties: [{ name: 'paint', type: FILLS }]
        }),
      'UNREGISTER_FAILED'
    )
    expectRelationError(
      () =>
        core.definePropertyComponent({
          type: PARENT,
          defaults: { childIds: [] },
          children: { key: 'childIds', childType: FILLS }
        }),
      'UNREGISTER_FAILED'
    )
    expectRelationError(
      () =>
        core.registerRenderStrategy(SHAPE, vi.fn(), {
          relations: [
            {
              name: 'paint-runtime',
              target: { kind: 'property', key: FILLS },
              onTargetUnregister: 'unregister-source'
            }
          ]
        }),
      'UNREGISTER_FAILED'
    )

    expect(componentRegistry.has(SHAPE)).toBe(false)
    expect(idCounter.hasType(SHAPE)).toBe(false)
    expect(nameCounter.hasType(SHAPE)).toBe(false)
    expect(getPropertyComponent(PARENT)).toBeUndefined()
    expect(renderStrategyRegistry.has(SHAPE)).toBe(false)
    expect(
      graph.getRegistration({ kind: 'component', key: SHAPE })
    ).toBeUndefined()
    expect(
      graph.getRegistration({ kind: 'property', key: PARENT })
    ).toBeUndefined()
    expect(
      graph.getRegistration({ kind: 'render-strategy', key: SHAPE })
    ).toBeUndefined()

    expect(core.unregisterPropertyType(FILLS)).toMatchObject({ ok: true })
  })

  it('rejects pending relation sources before direct owner mutation', () => {
    const { core } = createCoreForTest()
    core.definePropertyComponent({ type: FILLS, defaults: {} })
    core.defineComponent({
      type: SHAPE,
      idPrefix: SHAPE,
      namePrefix: 'Pending Source Shape',
      properties: [{ name: 'paint', type: FILLS }]
    })
    const graph = (core as unknown as { registrationGraph: RegistrationGraph })
      .registrationGraph
    const blocker = { kind: 'a-test-detach-owner', key: SHAPE }
    graph.registerNode({
      ref: blocker,
      handlers: {
        detachRelation: () => {
          throw new Error('test component detach failed')
        }
      }
    })
    graph.defineRelation(blocker, {
      name: 'pending-component',
      target: { kind: 'component', key: SHAPE },
      onTargetUnregister: 'detach'
    })
    expectRelationError(
      () => core.unregisterComponent(SHAPE),
      'RELATION_REMOVE_FAILED'
    )
    graph.removeRelation(blocker, 'pending-component')

    expectRelationError(
      () =>
        core.defineComponentPropertyRelation(SHAPE, {
          name: 'secondary-paint',
          type: FILLS
        }),
      'UNREGISTER_FAILED'
    )
    expectRelationError(
      () => core.removeComponentPropertyRelation(SHAPE, 'paint'),
      'UNREGISTER_FAILED'
    )
    expect(
      core
        .getComponentPropertyRelations(SHAPE)
        .map(({ propertyName }) => propertyName)
    ).toEqual(['paint'])
    expect(
      graph
        .getOutgoingRelations({ kind: 'component', key: SHAPE })
        .map(({ name }) => name)
    ).toEqual(['paint'])

    expect(core.unregisterComponent(SHAPE)).toBe(true)
    expect(getPropertyComponent(FILLS)).toBeDefined()
  })

  it('rejects graph-aware unregister while active or replay-retained property instances exist', () => {
    const { core, props } = createCoreForTest()
    const Constructor = core.definePropertyComponent({
      type: FILLS,
      defaults: { color: 'red' }
    })
    props.addToMap(
      new Constructor({ id: 'active-fills', type: FILLS, color: 'blue' })
    )

    expectRelationError(
      () => core.unregisterPropertyType(FILLS),
      'REGISTRATION_IN_USE'
    )
    props.removeFromMap('active-fills')
    expectRelationError(
      () => core.unregisterPropertyType(FILLS),
      'REGISTRATION_IN_USE'
    )
    expect(getPropertyComponent(FILLS)).toBeDefined()
  })

  it('uses the injected SceneTree to block active component relation mutations', () => {
    const { core, sceneTree: ownedSceneTree } = createCoreForTest()
    core.definePropertyComponent({ type: FILLS, defaults: {} })
    core.defineComponent({
      type: SHAPE,
      idPrefix: SHAPE,
      namePrefix: 'Composition Shape',
      properties: [{ name: 'fills', type: FILLS }]
    })
    ownedSceneTree.addToMap({
      get: (key: string) => {
        if (key === 'id') {
          return 'owned-active-shape'
        }
        if (key === 'type') {
          return SHAPE
        }
        return
      }
    } as never)

    expectRelationError(
      () => core.removeComponentPropertyRelation(SHAPE, 'fills'),
      'REGISTRATION_IN_USE'
    )
    expect(core.getComponentPropertyRelations(SHAPE)).toHaveLength(1)
  })

  it('permanently closes composition at first start entry even when renderer init fails', async () => {
    const { core } = createCoreForTest()
    core.definePropertyComponent({ type: FILLS, defaults: {} })
    core.defineComponent({
      type: SHAPE,
      idPrefix: SHAPE,
      namePrefix: 'Composition Shape',
      properties: [{ name: 'fills', type: FILLS }]
    })
    const failure = new Error('renderer failed')
    core.setRenderer({
      name: 'failing-renderer',
      init: vi.fn(async () => Promise.reject(failure))
    } as never)

    await expect(
      core.start(document.createElement('div'), { width: 1, height: 1 })
    ).rejects.toBe(failure)
    expectRelationError(
      () => core.definePropertyComponent({ type: POSITION, defaults: {} }),
      'COMPOSITION_CLOSED'
    )
    expectRelationError(
      () => core.removeComponentPropertyRelation(SHAPE, 'fills'),
      'COMPOSITION_CLOSED'
    )
    expectRelationError(
      () => core.unregisterPropertyType(FILLS),
      'COMPOSITION_CLOSED'
    )
  })

  it('detects dangling owner registrations before renderer side effects', async () => {
    const { core } = createCoreForTest()
    core.definePropertyComponent({ type: FILLS, defaults: {} })
    core.defineComponent({
      type: SHAPE,
      idPrefix: SHAPE,
      namePrefix: 'Composition Shape',
      properties: [{ name: 'fills', type: FILLS }]
    })
    unregisterPropertyComponent(FILLS)

    const init = vi.fn(async () => ({ canvas: null, instance: null }))
    core.setRenderer({ name: 'renderer', init } as never)

    await expect(
      core.start(document.createElement('div'), { width: 1, height: 1 })
    ).rejects.toMatchObject({ code: 'DANGLING_RELATION' })
    expect(init).not.toHaveBeenCalled()
  })
})
