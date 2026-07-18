import {
  propertyComponentRegistry,
  propertySchemaRegistry,
  PropertyRegistrationError,
  PropertyTypeDefinitionError,
  PropsManager,
  type PropertyTypeDefinition,
  type PropertyTypeFieldDefinition
} from '@asyra/props-manager'
import { componentRegistry, SceneTree } from '@asyra/scene-tree'
import {
  idCounter,
  nameCounter,
  RegistrationGraph,
  RegistrationRelationError,
  type PropertyFieldSchema,
  type RegistrationOwnerMetadata
} from '@asyra/utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { unregisterComponent as unregisterComponentDirect } from '../define-component'
import { Core } from '../core'

const STYLE = 'redefinition-style'
const CHILD = 'redefinition-child'
const SHAPE = 'redefinition-shape'
const SECOND_SHAPE = 'redefinition-second-shape'
const PRESET_OWNER: RegistrationOwnerMetadata = {
  packageName: '@asyra/preset',
  name: 'official-properties'
}

const createCoreForTest = () => {
  const props = new PropsManager()
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
    sceneTree: new SceneTree(),
    selection: {} as never,
    systemContext: {} as never
  })
  core.setupInputSystem = vi.fn()
  core.initFeatureSystem = vi.fn()
  core.renderIsReady = vi.fn()
  return { core, props }
}

const cleanup = () => {
  ;[SHAPE, SECOND_SHAPE].forEach((type) => {
    unregisterComponentDirect(type, { force: true })
    componentRegistry.unregister(type)
    idCounter.unregisterType(type)
    nameCounter.unregisterType(type)
  })
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

const fieldsToDefaults = (fields: readonly PropertyFieldSchema[]) =>
  fields.reduce<Record<string, unknown>>((defaults, field) => {
    defaults[field.key] = field.defaultValue
    return defaults
  }, {})

const defineDeclarativeType = (
  core: Core,
  options: {
    type: string
    fields: PropertyFieldSchema[]
    persistKeys?: string[]
    valueKeys?: string[]
    unitKeys?: string[]
    allowDynamicKeys?: boolean
    dynamicReservedKeys?: string[]
    children?: {
      key: string
      childType: string
    }
    owner?: RegistrationOwnerMetadata
  }
) => {
  const owner = options.owner ?? PRESET_OWNER
  core.registerPropertySchema(
    { type: options.type, fields: options.fields },
    undefined,
    { owner }
  )
  return core.definePropertyComponent({
    type: options.type,
    defaults: fieldsToDefaults(options.fields),
    persistKeys: options.persistKeys,
    valueKeys: options.valueKeys,
    unitKeys: options.unitKeys,
    allowDynamicKeys: options.allowDynamicKeys,
    dynamicReservedKeys: options.dynamicReservedKeys,
    children: options.children,
    registration: { owner }
  })
}

const createField = (
  key: string,
  defaultValue: unknown,
  overrides: Partial<PropertyTypeFieldDefinition> = {}
): PropertyTypeFieldDefinition => ({
  key,
  kind: typeof defaultValue === 'number' ? 'number' : 'string',
  defaultValue,
  persist: true,
  project: true,
  unit: false,
  ...overrides
})

const leavePropertyTargetPending = (core: Core, propertyType: string) => {
  const graph = (core as unknown as { registrationGraph: RegistrationGraph })
    .registrationGraph
  const source = { kind: 'test-detach-owner', key: propertyType }
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
}

const setSuccessfulRenderer = (core: Core) => {
  const init = vi.fn(async () => ({ canvas: null, instance: null }))
  core.setRenderer({ name: 'test-renderer', init } as never)
  return init
}

describe('Core declarative property type redefinition', () => {
  beforeEach(cleanup)

  it('returns detached definitions without changing owner or relations', () => {
    const { core } = createCoreForTest()
    defineDeclarativeType(core, {
      type: STYLE,
      fields: [{ key: 'tone', kind: 'string', defaultValue: 'warm' }]
    })
    const owner = core.getRegistration({ kind: 'property', key: STYLE })?.owner
    const relations = core.getRegistrationRelations()

    const first = core.getPropertyTypeDefinition(STYLE)
    const mutable = first as unknown as {
      dynamicReservedKeys: string[]
      fields: { defaultValue: unknown }[]
    }
    mutable.dynamicReservedKeys.push('changed')
    mutable.fields[0].defaultValue = 'cold'

    expect(core.getPropertyTypeDefinition(STYLE)).toEqual({
      type: STYLE,
      allowDynamicKeys: false,
      dynamicReservedKeys: [],
      fields: [createField('tone', 'warm')]
    })
    expect(core.getPropertyTypeDefinition('missing-type')).toBeUndefined()
    expect(
      core.getRegistration({ kind: 'property', key: STYLE })?.owner
    ).toEqual(owner)
    expect(core.getRegistrationRelations()).toEqual(relations)
  })

  it('atomically redefines through Props, transfers app ownership, and preserves relations', () => {
    const { core } = createCoreForTest()
    defineDeclarativeType(core, {
      type: CHILD,
      fields: [{ key: 'value', kind: 'number', defaultValue: 0 }]
    })
    defineDeclarativeType(core, {
      type: STYLE,
      fields: [
        { key: 'tone', kind: 'string', defaultValue: 'warm' },
        { key: 'children', kind: 'array', defaultValue: [] }
      ],
      children: { key: 'children', childType: CHILD }
    })
    core.defineComponent({
      type: SHAPE,
      idPrefix: SHAPE,
      namePrefix: 'Redefinition Shape',
      properties: [{ name: 'style', type: STYLE, alias: ['tone'] }]
    })
    const relations = core.getRegistrationRelations()
    const updater = vi.fn(
      (current: Readonly<PropertyTypeDefinition>): PropertyTypeDefinition => ({
        ...current,
        fields: [...current.fields, createField('weight', 1)]
      })
    )

    const committed = core.redefinePropertyType(STYLE, updater)

    expect(updater).toHaveBeenCalledOnce()
    expect(committed.fields.map((field) => field.key)).toEqual([
      'tone',
      'children',
      'weight'
    ])
    expect(
      core.getRegistration({ kind: 'property', key: STYLE })?.owner
    ).toEqual({ packageName: 'app', name: STYLE })
    expect(core.getRegistrationRelations()).toEqual(relations)
    expect(core.getPropertyChildRelations(STYLE)).toEqual([
      expect.objectContaining({ key: 'children', childType: CHILD })
    ])
  })

  it('keeps definition, owner, and relations unchanged for updater and identity failures', () => {
    const { core } = createCoreForTest()
    defineDeclarativeType(core, {
      type: STYLE,
      fields: [{ key: 'tone', kind: 'string', defaultValue: 'warm' }]
    })
    const definition = core.getPropertyTypeDefinition(STYLE)
    const owner = core.getRegistration({ kind: 'property', key: STYLE })?.owner
    const relations = core.getRegistrationRelations()
    const updaterFailure = new Error('updater failed')

    expect(() =>
      core.redefinePropertyType(STYLE, () => {
        throw updaterFailure
      })
    ).toThrow(updaterFailure)
    expect(() =>
      core.redefinePropertyType(STYLE, (current) => ({
        ...current,
        type: 'changed-identity'
      }))
    ).toThrowError(
      expect.objectContaining<Partial<PropertyTypeDefinitionError>>({
        code: 'PROPERTY_TYPE_DEFINITION_INVALID',
        type: STYLE
      })
    )
    expect(core.getPropertyTypeDefinition(STYLE)).toEqual(definition)
    expect(
      core.getRegistration({ kind: 'property', key: STYLE })?.owner
    ).toEqual(owner)
    expect(core.getRegistrationRelations()).toEqual(relations)
  })

  it('blocks nested composition mutation until owner transfer completes', () => {
    const { core } = createCoreForTest()
    defineDeclarativeType(core, {
      type: STYLE,
      fields: [{ key: 'tone', kind: 'string', defaultValue: 'warm' }]
    })
    const definition = core.getPropertyTypeDefinition(STYLE)
    const owner = core.getRegistration({ kind: 'property', key: STYLE })?.owner

    expectRelationError(
      () =>
        core.redefinePropertyType(STYLE, (current) => {
          core.unregisterPropertyType(STYLE)
          return current
        }),
      'UNREGISTER_FAILED'
    )

    expect(core.getPropertyTypeDefinition(STYLE)).toEqual(definition)
    expect(
      core.getRegistration({ kind: 'property', key: STYLE })?.owner
    ).toEqual(owner)
  })

  it.each([
    ['active', false],
    ['replay-retained', true]
  ] as const)(
    'rejects %s usage without transferring ownership',
    (_label, replay) => {
      const { core, props } = createCoreForTest()
      const Constructor = defineDeclarativeType(core, {
        type: STYLE,
        fields: [{ key: 'tone', kind: 'string', defaultValue: 'warm' }]
      })
      const property = new Constructor({ id: 'style-in-use', type: STYLE })
      if (replay) props.addToDeletedMap(property)
      else props.addToMap(property)

      expect(() =>
        core.redefinePropertyType(STYLE, (current) => current)
      ).toThrowError(
        expect.objectContaining<Partial<PropertyRegistrationError>>({
          code: 'PROPERTY_TYPE_IN_USE',
          type: STYLE,
          propertyIds: ['style-in-use']
        })
      )
      expect(
        core.getRegistration({ kind: 'property', key: STYLE })?.owner
      ).toEqual(PRESET_OWNER)
    }
  )

  it('rejects missing, pending, and closed composition before updater execution', async () => {
    const { core } = createCoreForTest()
    expectRelationError(
      () => core.redefinePropertyType('missing-type', (current) => current),
      'REGISTRATION_NOT_FOUND'
    )

    defineDeclarativeType(core, {
      type: STYLE,
      fields: [{ key: 'tone', kind: 'string', defaultValue: 'warm' }]
    })
    leavePropertyTargetPending(core, STYLE)
    const pendingUpdater = vi.fn((current) => current)
    expectRelationError(
      () => core.redefinePropertyType(STYLE, pendingUpdater),
      'UNREGISTER_FAILED'
    )
    expect(pendingUpdater).not.toHaveBeenCalled()

    const failure = new Error('renderer failed')
    core.setRenderer({
      name: 'failing-renderer',
      init: vi.fn(async () => Promise.reject(failure))
    } as never)
    await expect(
      core.start(document.createElement('div'), { width: 1, height: 1 })
    ).rejects.toBe(failure)
    expectRelationError(
      () => core.getPropertyTypeDefinition(STYLE),
      'COMPOSITION_CLOSED'
    )
    expectRelationError(
      () => core.redefinePropertyType(STYLE, (current) => current),
      'COMPOSITION_CLOSED'
    )
  })

  it('blocks startup when a redefinition leaves a stale fixed component alias', async () => {
    const { core } = createCoreForTest()
    defineDeclarativeType(core, {
      type: STYLE,
      fields: [{ key: 'legacy', kind: 'number', defaultValue: 1 }]
    })
    core.defineComponent({
      type: SHAPE,
      idPrefix: SHAPE,
      namePrefix: 'Redefinition Shape',
      properties: [{ name: 'style', type: STYLE, alias: ['legacy'] }]
    })
    core.redefinePropertyType(STYLE, (current) => ({
      ...current,
      fields: [createField('current', 2)]
    }))
    const init = setSuccessfulRenderer(core)

    await expect(
      core.start(document.createElement('div'), { width: 1, height: 1 })
    ).rejects.toMatchObject({ code: 'DANGLING_RELATION' })
    expect(init).not.toHaveBeenCalled()
  })

  it('blocks startup when a redefinition leaves a stale property-child key', async () => {
    const { core } = createCoreForTest()
    defineDeclarativeType(core, {
      type: CHILD,
      fields: [{ key: 'value', kind: 'number', defaultValue: 0 }]
    })
    defineDeclarativeType(core, {
      type: STYLE,
      fields: [{ key: 'children', kind: 'array', defaultValue: [] }],
      children: { key: 'children', childType: CHILD }
    })
    core.redefinePropertyType(STYLE, (current) => ({
      ...current,
      fields: [createField('current', 2)]
    }))
    const init = setSuccessfulRenderer(core)

    await expect(
      core.start(document.createElement('div'), { width: 1, height: 1 })
    ).rejects.toMatchObject({ code: 'DANGLING_RELATION' })
    expect(init).not.toHaveBeenCalled()
  })

  it('allows an explicitly permitted dynamic component alias after redefinition', async () => {
    const { core } = createCoreForTest()
    defineDeclarativeType(core, {
      type: STYLE,
      fields: [{ key: 'seed', kind: 'number', defaultValue: 1 }],
      allowDynamicKeys: true
    })
    core.defineComponent({
      type: SECOND_SHAPE,
      idPrefix: SECOND_SHAPE,
      namePrefix: 'Dynamic Redefinition Shape',
      properties: [{ name: 'style', type: STYLE, alias: ['customValue'] }]
    })
    core.redefinePropertyType(STYLE, (current) => current)
    const init = setSuccessfulRenderer(core)

    await expect(
      core.start(document.createElement('div'), { width: 1, height: 1 })
    ).resolves.toBeUndefined()
    expect(init).toHaveBeenCalledOnce()
  })

  it('accepts app-declared fields in id-first updates without an unsafe cast', () => {
    interface CustomFields {
      customCount: number
    }
    const { core } = createCoreForTest()

    expect(() =>
      core.updatePropertyById<CustomFields>(
        'missing-property',
        'customCount',
        3
      )
    ).not.toThrow()
  })
})
