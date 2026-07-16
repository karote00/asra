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
import { RegistrationRelationError, idCounter, nameCounter } from '@asyra/utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { unregisterComponent as unregisterComponentDirect } from '../define-component'
import { Core } from '../core'

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

const expectRelationError = (
  run: () => unknown,
  code: RegistrationRelationError['code']
) => {
  try {
    run()
    throw new Error(`Expected RegistrationRelationError ${code}`)
  } catch (error) {
    expect(error).toBeInstanceOf(RegistrationRelationError)
    expect((error as RegistrationRelationError).code).toBe(code)
  }
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
