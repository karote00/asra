import type {
  DataTypes,
  PropertyComponentInstanceDataTypes,
  PropertyComponentRawData,
  PropertySchema,
  Unit
} from '@asyra/utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BasePropertyComponent from '../components/base'
import {
  commitDeclarativePropertyTypeDefinition,
  getDeclarativePropertyTypeDefinition,
  getPropertyComponent,
  getPropertyComponentConfigDefinition,
  getPropertySchema,
  propertyComponentRegistry,
  propertySchemaRegistry,
  PropertyRegistrationError,
  PropertyTypeDefinitionError,
  registerPropertyComponent,
  registerPropertySchema,
  type PropertyComponentConfigRegistration,
  type PropertyTypeDefinition
} from '../index'
import { PropsManager } from '../manager/props-manager'

const TYPE = 'test-declarative-property'
const CHILD_TYPE = 'test-child-property'

const validatePositive = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
const toChildData = (item: Record<string, unknown>) => item
const toChildValue = (
  child: { get: (key: string) => unknown },
  childId: string
) => ({ id: childId, value: child.get('value') })

class InitialComponent extends BasePropertyComponent<PropertyComponentInstanceDataTypes> {
  data = {
    id: '',
    type: TYPE,
    config: { nested: [1, 2] },
    amount: 2,
    amountUnit: 'px',
    children: [] as string[]
  } as PropertyComponentInstanceDataTypes

  constructor(data: Partial<PropertyComponentRawData>) {
    super()
    this.load(data as PropertyComponentRawData)
  }

  load(data: PropertyComponentRawData): void {
    this.data.id = typeof data.id === 'string' ? data.id : this.data.id
    this._init(data as Partial<PropertyComponentInstanceDataTypes>)
  }

  getValue(): Record<string, DataTypes> {
    const data = this.data as unknown as Record<string, DataTypes>
    return {
      config: data.config,
      amount: data.amount,
      children: data.children
    }
  }

  getUnit(): Record<string, Unit> {
    const data = this.data as unknown as Record<string, unknown>
    return { amountUnit: data.amountUnit as Unit }
  }
}

const schema: PropertySchema = {
  type: TYPE,
  fields: [
    {
      key: 'config',
      kind: 'object',
      defaultValue: { nested: [1, 2] }
    },
    {
      key: 'amount',
      kind: 'number',
      defaultValue: 2,
      validate: validatePositive
    },
    {
      key: 'amountUnit',
      kind: 'string',
      defaultValue: 'px',
      allowedUnits: ['px', 'pct']
    },
    {
      key: 'children',
      kind: 'array',
      defaultValue: []
    }
  ]
}

const config: PropertyComponentConfigRegistration = {
  type: TYPE,
  defaults: {
    config: { nested: [1, 2] },
    amount: 2,
    amountUnit: 'px',
    children: []
  },
  persistKeys: ['config', 'amount', 'amountUnit', 'children'],
  valueKeys: ['config', 'amount', 'children'],
  unitKeys: ['amountUnit'],
  allowDynamicKeys: false,
  dynamicReservedKeys: ['reserved'],
  children: {
    key: 'children',
    childType: CHILD_TYPE,
    mode: 'ids-or-objects',
    toChildData,
    toValue: toChildValue
  }
}

const registerDeclarativeType = () => {
  registerPropertySchema(schema)
  registerPropertyComponent(TYPE, InitialComponent, undefined, config)
}

const nextDefinition = (): PropertyTypeDefinition => ({
  type: TYPE,
  allowDynamicKeys: false,
  dynamicReservedKeys: ['reserved'],
  fields: [
    {
      key: 'config',
      kind: 'object',
      defaultValue: { nested: [3, 4] },
      persist: true,
      project: true,
      unit: false
    },
    {
      key: 'children',
      kind: 'array',
      defaultValue: [],
      persist: true,
      project: true,
      unit: false
    },
    {
      key: 'count',
      kind: 'number',
      defaultValue: 10,
      validate: validatePositive,
      persist: true,
      project: true,
      unit: false
    },
    {
      key: 'preview',
      kind: 'string',
      defaultValue: 'draft',
      persist: false,
      project: true,
      unit: false
    },
    {
      key: 'savedOnly',
      kind: 'number',
      defaultValue: 4,
      persist: true,
      project: false,
      unit: false
    },
    {
      key: 'scaleUnit',
      kind: 'string',
      defaultValue: 'px',
      allowedUnits: ['px', 'pct'],
      persist: true,
      project: false,
      unit: true
    }
  ]
})

describe('declarative property type definition owner', () => {
  beforeEach(() => {
    propertySchemaRegistry.clear()
    propertyComponentRegistry.clear()
  })

  it('returns a complete normalized definition deeply detached from registry state', () => {
    registerDeclarativeType()

    const first = getDeclarativePropertyTypeDefinition(TYPE)
    expect(first).toEqual({
      type: TYPE,
      allowDynamicKeys: false,
      dynamicReservedKeys: ['reserved'],
      fields: [
        {
          key: 'config',
          kind: 'object',
          defaultValue: { nested: [1, 2] },
          validate: undefined,
          allowedUnits: undefined,
          persist: true,
          project: true,
          unit: false
        },
        {
          key: 'amount',
          kind: 'number',
          defaultValue: 2,
          validate: validatePositive,
          allowedUnits: undefined,
          persist: true,
          project: true,
          unit: false
        },
        {
          key: 'amountUnit',
          kind: 'string',
          defaultValue: 'px',
          validate: undefined,
          allowedUnits: ['px', 'pct'],
          persist: true,
          project: false,
          unit: true
        },
        {
          key: 'children',
          kind: 'array',
          defaultValue: [],
          validate: undefined,
          allowedUnits: undefined,
          persist: true,
          project: true,
          unit: false
        }
      ]
    })

    const mutable = first as unknown as {
      dynamicReservedKeys: string[]
      fields: { defaultValue: { nested: number[] } }[]
    }
    mutable.dynamicReservedKeys.push('changed')
    mutable.fields[0].defaultValue.nested.push(99)

    expect(getDeclarativePropertyTypeDefinition(TYPE)).toEqual(
      expect.objectContaining({
        dynamicReservedKeys: ['reserved'],
        fields: expect.arrayContaining([
          expect.objectContaining({
            key: 'config',
            defaultValue: { nested: [1, 2] }
          })
        ])
      })
    )
    expect(getPropertySchema(TYPE)).toBe(schema)
  })

  it('returns undefined only for a completely missing registration', () => {
    expect(
      getDeclarativePropertyTypeDefinition('missing-property-type')
    ).toBeUndefined()
  })

  it('rejects constructor mode and schema/runtime drift through stable definition errors', () => {
    registerPropertySchema(schema)
    registerPropertyComponent(TYPE, InitialComponent)

    expect(() => getDeclarativePropertyTypeDefinition(TYPE)).toThrowError(
      expect.objectContaining<Partial<PropertyTypeDefinitionError>>({
        code: 'PROPERTY_TYPE_NOT_DECLARATIVE',
        type: TYPE
      })
    )

    propertyComponentRegistry.clear()
    registerPropertyComponent(TYPE, InitialComponent, undefined, {
      ...config,
      defaults: { ...config.defaults, amount: 99 }
    })

    expect(() => getDeclarativePropertyTypeDefinition(TYPE)).toThrowError(
      expect.objectContaining<Partial<PropertyTypeDefinitionError>>({
        code: 'PROPERTY_TYPE_DEFINITION_DRIFT',
        type: TYPE
      })
    )
  })

  it('rejects invalid complete definitions before changing either registry', () => {
    registerDeclarativeType()
    const oldSchema = getPropertySchema(TYPE)
    const oldComponent = getPropertyComponent(TYPE)
    const invalidDefinitions: PropertyTypeDefinition[] = [
      {
        ...nextDefinition(),
        fields: [nextDefinition().fields[0], nextDefinition().fields[0]]
      },
      {
        ...nextDefinition(),
        fields: [
          {
            ...nextDefinition().fields[0],
            key: 'id'
          }
        ]
      },
      {
        ...nextDefinition(),
        fields: [
          {
            ...nextDefinition().fields[2],
            defaultValue: -1
          }
        ]
      },
      {
        ...nextDefinition(),
        fields: [
          {
            ...nextDefinition().fields[0],
            defaultValue: []
          }
        ]
      },
      {
        ...nextDefinition(),
        fields: [
          {
            ...nextDefinition().fields[5],
            project: true
          }
        ]
      },
      {
        ...nextDefinition(),
        type: 'changed-property-identity'
      },
      {
        ...nextDefinition(),
        fields: [
          {
            ...nextDefinition().fields[2],
            defaultValue: undefined
          }
        ]
      }
    ]

    invalidDefinitions.forEach((definition) => {
      expect(() =>
        commitDeclarativePropertyTypeDefinition(TYPE, definition)
      ).toThrowError(
        expect.objectContaining<Partial<PropertyTypeDefinitionError>>({
          code: 'PROPERTY_TYPE_DEFINITION_INVALID',
          type: TYPE
        })
      )
      expect(getPropertySchema(TYPE)).toBe(oldSchema)
      expect(getPropertyComponent(TYPE)).toBe(oldComponent)
    })
  })

  it.each([
    ['active', false],
    ['replay-retained', true]
  ] as const)(
    'rejects %s property usage before staging or mutation',
    (_label, replayRetained) => {
      registerDeclarativeType()
      const manager = new PropsManager()
      const property = new InitialComponent({
        id: 'property-in-use',
        type: TYPE
      })
      if (replayRetained) {
        manager.addToDeletedMap(property)
      } else {
        manager.addToMap(property)
      }

      expect(() =>
        commitDeclarativePropertyTypeDefinition(TYPE, nextDefinition(), manager)
      ).toThrowError(
        expect.objectContaining<Partial<PropertyRegistrationError>>({
          code: 'PROPERTY_TYPE_IN_USE',
          type: TYPE,
          propertyIds: ['property-in-use']
        })
      )
      expect(getPropertySchema(TYPE)).toBe(schema)
      expect(getPropertyComponent(TYPE)).toBe(InitialComponent)
    }
  )

  it('rejects property usage introduced while staging the next definition', () => {
    registerDeclarativeType()
    const manager = new PropsManager()
    let introducedUsage = false
    const definitionWithStagingUsage: PropertyTypeDefinition = {
      ...nextDefinition(),
      fields: nextDefinition().fields.map((field) =>
        field.key === 'count'
          ? {
              ...field,
              validate: (value: unknown) => {
                if (!introducedUsage) {
                  introducedUsage = true
                  manager.addToMap(
                    new InitialComponent({
                      id: 'introduced-during-staging',
                      type: TYPE
                    })
                  )
                }
                return validatePositive(value)
              }
            }
          : field
      )
    }

    expect(() =>
      commitDeclarativePropertyTypeDefinition(
        TYPE,
        definitionWithStagingUsage,
        manager
      )
    ).toThrowError(
      expect.objectContaining<Partial<PropertyRegistrationError>>({
        code: 'PROPERTY_TYPE_IN_USE',
        type: TYPE,
        propertyIds: ['introduced-during-staging']
      })
    )
    expect(getPropertySchema(TYPE)).toBe(schema)
    expect(getPropertyComponent(TYPE)).toBe(InitialComponent)
  })

  it('atomically commits schema, runtime config, projections, and validation while preserving children', () => {
    registerDeclarativeType()
    const requested = nextDefinition()

    const committed = commitDeclarativePropertyTypeDefinition(TYPE, requested)

    expect(committed).toEqual(nextDefinition())
    expect(committed).not.toBe(requested)
    expect(getPropertySchema(TYPE)?.fields.map((field) => field.key)).toEqual([
      'config',
      'children',
      'count',
      'preview',
      'savedOnly',
      'scaleUnit'
    ])
    expect(getPropertyComponentConfigDefinition(TYPE)?.children).toEqual(
      config.children
    )
    expect(
      getPropertyComponentConfigDefinition(TYPE)?.children?.toChildData
    ).toBe(toChildData)
    expect(getPropertyComponentConfigDefinition(TYPE)?.children?.toValue).toBe(
      toChildValue
    )

    const Component = getPropertyComponent(TYPE)
    if (!Component) throw new Error('Expected committed property constructor')
    const property = new Component({
      id: 'committed-property',
      type: TYPE,
      count: -1,
      preview: 'loaded',
      savedOnly: 8,
      scaleUnit: 'invalid'
    })

    expect(property.get('count' as never)).toBe(10)
    expect(property.get('scaleUnit' as never)).toBe('px')
    property.set('count' as never, -2 as never)
    expect(property.get('count' as never)).toBe(10)
    property.set('count' as never, 12 as never)
    expect(property.getValue()).toMatchObject({
      config: { nested: [3, 4] },
      children: [],
      count: 12,
      preview: 'draft'
    })
    expect(property.getValue()).not.toHaveProperty('savedOnly')
    expect(property.getValue()).not.toHaveProperty('scaleUnit')
    expect(
      (property as unknown as { getUnit: () => Record<string, Unit> }).getUnit()
    ).toEqual({ scaleUnit: 'px' })
    expect(property.save()).toEqual({
      id: 'committed-property',
      type: TYPE,
      config: { nested: [3, 4] },
      children: [],
      count: 12,
      savedOnly: 8,
      scaleUnit: 'px'
    })

    const mutableRequested = requested as unknown as {
      dynamicReservedKeys: string[]
      fields: { key: string; defaultValue: unknown }[]
    }
    const mutableCommitted = committed as unknown as {
      dynamicReservedKeys: string[]
      fields: { key: string; defaultValue: unknown }[]
    }
    mutableRequested.dynamicReservedKeys.push('requested-mutation')
    mutableRequested.fields[0].defaultValue = { nested: [99] }
    mutableCommitted.dynamicReservedKeys.push('result-mutation')
    mutableCommitted.fields[0].defaultValue = { nested: [100] }

    expect(getDeclarativePropertyTypeDefinition(TYPE)).toEqual(nextDefinition())
  })

  it('treats validator exceptions as invalid runtime and load values', () => {
    registerDeclarativeType()
    const throwingDefinition: PropertyTypeDefinition = {
      ...nextDefinition(),
      fields: nextDefinition().fields.map((field) =>
        field.key === 'count'
          ? {
              ...field,
              validate: (value: unknown) => {
                if (value === 13) throw new Error('validator failed')
                return validatePositive(value)
              }
            }
          : field
      )
    }
    commitDeclarativePropertyTypeDefinition(TYPE, throwingDefinition)
    const Component = getPropertyComponent(TYPE)
    if (!Component) throw new Error('Expected committed property constructor')

    const loaded = new Component({
      id: 'validator-load',
      type: TYPE,
      count: 13
    })
    expect(loaded.get('count' as never)).toBe(10)
    expect(() => loaded.set('count' as never, 13 as never)).not.toThrow()
    expect(loaded.get('count' as never)).toBe(10)
  })

  it('rejects an array runtime write for an object field', () => {
    registerDeclarativeType()
    commitDeclarativePropertyTypeDefinition(TYPE, nextDefinition())
    const Component = getPropertyComponent(TYPE)
    if (!Component) throw new Error('Expected committed property constructor')
    const property = new Component({
      id: 'object-runtime-kind',
      type: TYPE
    })

    property.set('config' as never, [] as never)

    expect(property.get('config' as never)).toEqual({ nested: [3, 4] })
  })

  it('uses the object default when load receives an array for an object field', () => {
    registerDeclarativeType()
    commitDeclarativePropertyTypeDefinition(TYPE, nextDefinition())
    const Component = getPropertyComponent(TYPE)
    if (!Component) throw new Error('Expected committed property constructor')

    const loaded = new Component({
      id: 'object-load-kind',
      type: TYPE,
      config: []
    })

    expect(loaded.get('config' as never)).toEqual({ nested: [3, 4] })
  })

  it('clones mutable defaults before using them as invalid-load fallback values', () => {
    registerDeclarativeType()
    commitDeclarativePropertyTypeDefinition(TYPE, nextDefinition())
    const Component = getPropertyComponent(TYPE)
    if (!Component) throw new Error('Expected committed property constructor')

    const first = new Component({
      id: 'mutable-fallback-first',
      type: TYPE,
      config: 'invalid'
    })
    const firstConfig = first.get('config' as never) as unknown as {
      nested: number[]
    }
    firstConfig.nested.push(99)

    expect(getDeclarativePropertyTypeDefinition(TYPE)).toEqual(nextDefinition())

    const second = new Component({
      id: 'mutable-fallback-second',
      type: TYPE,
      config: 'invalid'
    })
    expect(second.get('config' as never)).toEqual({ nested: [3, 4] })
    expect(second.get('config' as never)).not.toBe(firstConfig)
  })

  it('rolls back both registries when the second commit write fails', () => {
    registerDeclarativeType()
    const oldSchema = getPropertySchema(TYPE)
    const oldComponent = getPropertyComponent(TYPE)
    const oldDefinition = getDeclarativePropertyTypeDefinition(TYPE)
    const originalRegister = propertyComponentRegistry.register
    let shouldFail = true
    propertyComponentRegistry.register = vi.fn(
      (...args: Parameters<typeof originalRegister>) => {
        if (shouldFail && args[0] === TYPE) {
          shouldFail = false
          throw new Error('runtime commit failed')
        }
        return originalRegister.call(
          propertyComponentRegistry,
          args[0],
          args[1],
          args[2],
          args[3]
        )
      }
    )

    try {
      expect(() =>
        commitDeclarativePropertyTypeDefinition(TYPE, nextDefinition())
      ).toThrowError(
        expect.objectContaining<Partial<PropertyTypeDefinitionError>>({
          code: 'PROPERTY_TYPE_DEFINITION_COMMIT_FAILED',
          type: TYPE
        })
      )
    } finally {
      propertyComponentRegistry.register = originalRegister
    }

    expect(getPropertySchema(TYPE)).toBe(oldSchema)
    expect(getPropertyComponent(TYPE)).toBe(oldComponent)
    expect(getDeclarativePropertyTypeDefinition(TYPE)).toEqual(oldDefinition)
    expect(getPropertyComponentConfigDefinition(TYPE)?.children).toEqual(
      config.children
    )
  })
})
