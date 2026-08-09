import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as ReactiveEventsModule from '@asyra/reactive-events'
import {
  PROPS_ACTIONS,
  PropertyComponentRawData,
  PropertyComponentInstanceTypes,
  PropertyComponentInstanceDataTypes,
  PropertySchema,
  PropertyTypes,
  IDTypes,
  Unit,
  SharedDataChannelNames,
  subscribeToBrowserDragPhases,
  idCounter,
  PropsChange,
  type AddRemovePropertyChange,
  type BasePropertyAttrs,
  type DataTypes,
  type ElementPropertyRelation
} from '@asyra/utils'
import { BasePropertyComponent } from '../components/index.js'
import {
  PropsManager,
  type PropertyMutation,
  type PropertyMutationBatchRequest
} from '../manager/props-manager.js'
import { getPropertyComponentAccessor } from '../manager/component-accessor.js'
import { createProperty } from '../factories/create-property.js'
import elementPropertyRegistry, {
  type PropertyDefinition
} from '../registries/property-definition.js'
import {
  propertySchemaRegistry,
  registerPropertySchema
} from '../registries/property-schema.js'
import {
  propertyComponentRegistry,
  registerPropertyComponent
} from '../registries/property-component.js'
import { createPropertyComponentFromConfig } from '../registries/declarative-property-type.js'
import {
  PositionComponent,
  DimensionComponent,
  CustomComponent,
  AnchorPointComponent,
  AnchorPointsComponent
} from './helpers/test-property-components.js'

interface UpdateTransactionEvent {
  type: string
  eventName: string
  payload: unknown
  canonicalEvidence?: {
    readonly orderedIds: readonly string[]
    readonly sharedRecords?: readonly {
      readonly orderedIds: readonly string[]
      readonly payload: object
    }[]
  }
  historyCandidate?: {
    readonly key: string
    readonly events: readonly UpdateTransactionEvent[]
    readonly eventKeys?: readonly string[]
  }
  options?: {
    undoable?: boolean
    shared?: string
    sharedDelivery?: 'transaction-end' | 'immediate'
    history?: {
      mode: 'replace-latest'
      key: string
    }
  }
}

const captureUpdateTransactionEvents = () => {
  const events: UpdateTransactionEvent[] = []
  const subscription = ReactiveEventsModule.subscribeToEvents((event) => {
    if (event.type === ReactiveEventsModule.EventTypes.UPDATE_TRANSACTION) {
      events.push(event as UpdateTransactionEvent)
    }
  })
  // ReplaySubject replays last event on subscribe; reset to current test scope.
  events.length = 0

  return { events, subscription }
}

const isUnit = (value: unknown) => value === Unit.PX || value === Unit.PERCENT
const isFiniteNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value)

const registerTestSchemas = () => {
  propertySchemaRegistry.clear()

  const positionSchema: PropertySchema = {
    type: PropertyTypes.POSITION,
    fields: [
      {
        key: 'x',
        kind: 'number',
        validate: isFiniteNumber,
        defaultValue: 0
      },
      {
        key: 'y',
        kind: 'number',
        validate: isFiniteNumber,
        defaultValue: 0
      },
      {
        key: 'xUnit',
        kind: 'string',
        validate: isUnit,
        defaultValue: Unit.PX
      },
      {
        key: 'yUnit',
        kind: 'string',
        validate: isUnit,
        defaultValue: Unit.PX
      }
    ]
  }

  const dimensionSchema: PropertySchema = {
    type: PropertyTypes.DIMENSION,
    fields: [
      {
        key: 'width',
        kind: 'number',
        validate: isFiniteNumber,
        defaultValue: 0.1
      },
      {
        key: 'height',
        kind: 'number',
        validate: isFiniteNumber,
        defaultValue: 0.1
      },
      {
        key: 'widthUnit',
        kind: 'string',
        validate: isUnit,
        defaultValue: Unit.PX
      },
      {
        key: 'heightUnit',
        kind: 'string',
        validate: isUnit,
        defaultValue: Unit.PX
      }
    ]
  }

  registerPropertySchema(positionSchema)
  registerPropertySchema(dimensionSchema)
}

const registerTestPropertyComponents = () => {
  propertyComponentRegistry.clear()
  registerPropertyComponent(PropertyTypes.POSITION, PositionComponent)
  registerPropertyComponent(PropertyTypes.DIMENSION, DimensionComponent)
  registerPropertyComponent(PropertyTypes.CUSTOM, CustomComponent, undefined, {
    type: PropertyTypes.CUSTOM,
    persistKeys: ['children'],
    children: {
      key: 'children',
      childType: PropertyTypes.POSITION,
      mode: 'ids'
    }
  })
  registerPropertyComponent(PropertyTypes.ANCHOR_POINT, AnchorPointComponent)
  registerPropertyComponent(PropertyTypes.ANCHOR_POINTS, AnchorPointsComponent)
}

const registerRecursivePropertyType = (type: string) => {
  const definition = {
    type,
    defaults: { children: [] as string[], value: 0 },
    persistKeys: ['children', 'value'],
    valueKeys: ['children', 'value'],
    children: {
      key: 'children',
      childType: type,
      mode: 'ids-or-objects' as const,
      collection: 'array-or-record' as const
    }
  }
  const Component = createPropertyComponentFromConfig(definition)
  registerPropertyComponent(type, Component, undefined, definition)
  registerPropertySchema({
    type,
    fields: [
      {
        key: 'children',
        kind: 'array',
        defaultValue: []
      },
      {
        key: 'value',
        kind: 'number',
        validate: isFiniteNumber,
        defaultValue: 0
      }
    ]
  })
  return Component
}

describe('PropsManager', () => {
  let propsManager: PropsManager

  beforeEach(() => {
    vi.clearAllMocks()
    registerTestPropertyComponents()
    registerTestSchemas()
    elementPropertyRegistry.unregisterComponent('restore-test-element')
    elementPropertyRegistry.register(
      {
        name: 'custom',
        type: PropertyTypes.CUSTOM
      },
      'restore-test-element'
    )

    propsManager = new PropsManager()
  })

  // Test load and save
  it('diagnoses and skips unregistered property types instead of constructing CUSTOM', () => {
    expect(() =>
      createProperty({ id: 'unknown-property', type: 'unknown-property-type' })
    ).toThrow(
      '[props-manager] Property component type "unknown-property-type" is not registered.'
    )

    const validation = propsManager.validateLoadData({
      'unknown-property': {
        id: 'unknown-property',
        type: 'unknown-property-type',
        value: 1
      }
    })

    expect(validation.data).toEqual({})
    expect(validation.diagnostics).toEqual([
      {
        path: 'props.unknown-property.type',
        message:
          'Skipped unregistered property component type "unknown-property-type" during load'
      }
    ])
  })

  it('should load data correctly', () => {
    const dataToLoad = {
      'pp-1': {
        id: 'pp-1',
        type: PropertyTypes.POSITION,
        x: 0,
        y: 0,
        xUnit: Unit.PX,
        yUnit: Unit.PX
      },
      'pp-2': {
        id: 'pp-2',
        type: PropertyTypes.DIMENSION,
        width: 100,
        height: 100,
        widthUnit: Unit.PX,
        heightUnit: Unit.PX
      }
    }

    propsManager.load(dataToLoad)

    expect(propsManager.getPropertyById('pp-1')?.get('id')).toBe('pp-1')
    expect(propsManager.getPropertyById('pp-2')?.get('id')).toBe('pp-2')
  })

  it('should save data correctly', () => {
    const dataToLoad = {
      'pp-1': {
        id: 'pp-1',
        type: PropertyTypes.POSITION,
        x: 0,
        y: 0,
        xUnit: Unit.PX,
        yUnit: Unit.PX
      }
    }
    propsManager.load(dataToLoad)

    const savedData = propsManager.save()

    expect(savedData['pp-1']).toEqual(dataToLoad['pp-1'])
  })

  // Test change tracking
  it('should add a change to the changes array', () => {
    const change = {
      eventName: ReactiveEventsModule.EventTypes.ADD_PROPERTY
    } as unknown as PropsChange

    propsManager.addChange(change)

    expect(propsManager.changes).toEqual([change])
  })

  it('should clean all changes', () => {
    propsManager.addChange({} as unknown as PropsChange)

    propsManager.cleanChanges()

    expect(propsManager.changes).toEqual([])
  })

  it('should add a change for adding a property', () => {
    const p1Data = {
      id: 'pp-1',
      type: PropertyTypes.POSITION,
      x: 0,
      y: 0,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    }
    const p1Component = createProperty(p1Data) as PropertyComponentInstanceTypes

    propsManager.addChangeForAddProperty(p1Component)

    expect(propsManager.changes.length).toBe(1)
    expect(propsManager.changes[0].action).toBe(PROPS_ACTIONS.ADD_PROPERTY)
  })

  it('should add a change for removing a property', () => {
    const p1Data = {
      id: 'pp-1',
      type: PropertyTypes.POSITION,
      x: 0,
      y: 0,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    }
    const p1Component = createProperty(p1Data) as PropertyComponentInstanceTypes

    propsManager.addChangeForRemoveProperty(p1Component)

    expect(propsManager.changes.length).toBe(1)
    expect(propsManager.changes[0].action).toBe(PROPS_ACTIONS.REMOVE_PROPERTY)
  })

  it('captures detached exact remove evidence before later runtime mutation', () => {
    const nestedValue = {
      points: [{ x: 10, y: 20 }]
    }
    const component = new CustomComponent({
      id: 'pp-detached',
      type: PropertyTypes.CUSTOM,
      nestedValue
    } as Partial<PropertyComponentInstanceDataTypes>)
    propsManager.addToMap(component)

    propsManager.removeProperty(['pp-detached'])

    const evidence = (
      propsManager.changes[0] as PropsChange & {
        data: Record<string, unknown>[]
      }
    ).data[0]
    expect(evidence).toEqual({
      id: 'pp-detached',
      type: PropertyTypes.CUSTOM,
      nestedValue: {
        points: [{ x: 10, y: 20 }]
      }
    })
    expect(evidence.nestedValue).not.toBe(nestedValue)

    nestedValue.points[0].x = 99
    expect(evidence.nestedValue).toEqual({
      points: [{ x: 10, y: 20 }]
    })
  })

  // Test component management
  it('should get a component by ID', () => {
    const p1Data = {
      id: 'pp-1',
      type: PropertyTypes.POSITION,
      x: 0,
      y: 0,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    }
    const p1Component = createProperty(p1Data) as PropertyComponentInstanceTypes

    propsManager.addToMap(p1Component)

    expect(propsManager.getPropertyById('pp-1')).toBe(p1Component)
  })

  it('should add a component to the map', () => {
    const p1Data = {
      id: 'pp-1',
      type: PropertyTypes.POSITION,
      x: 0,
      y: 0,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    }
    const p1Component = createProperty(p1Data) as PropertyComponentInstanceTypes

    propsManager.addToMap(p1Component)

    expect(propsManager._components.has('pp-1')).toBe(true)
  })

  it('should remove a component from the map', () => {
    const p1Data = {
      id: 'pp-1',
      type: PropertyTypes.POSITION,
      x: 0,
      y: 0,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    }
    const p1Component = createProperty(p1Data) as PropertyComponentInstanceTypes
    propsManager.addToMap(p1Component)

    propsManager.removeFromMap('pp-1')

    expect(propsManager._components.has('pp-1')).toBe(false)
  })

  // Test deleted map functionality
  it('should add a component to the deleted map', () => {
    const p1Data = {
      id: 'pp-1',
      type: PropertyTypes.POSITION,
      x: 0,
      y: 0,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    }
    const p1Component = createProperty(p1Data) as PropertyComponentInstanceTypes

    propsManager.addToDeletedMap(p1Component)

    expect(propsManager._deletedMap.has('pp-1')).toBe(true)
  })

  it('should remove a component from the deleted map', () => {
    const p1Data = {
      id: 'pp-1',
      type: PropertyTypes.POSITION,
      x: 0,
      y: 0,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    }
    const p1Component = createProperty(p1Data) as PropertyComponentInstanceTypes
    propsManager.addToDeletedMap(p1Component)

    propsManager.removeFromDeletedMap('pp-1')

    expect(propsManager._deletedMap.has('pp-1')).toBe(false)
  })

  it('should get a restored component by ID', () => {
    const p1Data = {
      id: 'pp-1',
      type: PropertyTypes.POSITION,
      x: 0,
      y: 0,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    }
    const p1Component = createProperty(p1Data) as PropertyComponentInstanceTypes

    propsManager.addToDeletedMap(p1Component)
    expect(propsManager.getRestoreComponentById('pp-1')).toBe(p1Component)
  })

  // Test createProperty
  it('should create a property and add a change', () => {
    const p1Data = {
      id: 'pp-1',
      type: PropertyTypes.POSITION,
      x: 0,
      y: 0,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    }
    const newProp = propsManager.createProperty(p1Data)

    expect(newProp?.get('id')).toBe('pp-1')
    expect(propsManager.changes.length).toBe(1)
    expect(propsManager.changes[0].action).toBe(PROPS_ACTIONS.ADD_PROPERTY)
  })

  it('materializes one ordered property creation batch with one final add journal', () => {
    const created = propsManager.runInPropertyCreationBatch(() => {
      const position = propsManager.createProperty({
        id: 'batch-position',
        type: PropertyTypes.POSITION,
        x: Number.NaN,
        y: 20,
        xUnit: Unit.PX,
        yUnit: Unit.PX
      })
      const dimension = propsManager.createProperty({
        id: 'batch-dimension',
        type: PropertyTypes.DIMENSION,
        width: 100,
        height: 200,
        widthUnit: Unit.PX,
        heightUnit: Unit.PX
      })
      propsManager.addProperty([position, dimension])
      return [position, dimension] as const
    }).result

    expect(created.map((component) => component.get('id'))).toEqual([
      'batch-position',
      'batch-dimension'
    ])
    expect(propsManager.changes).toEqual([
      expect.objectContaining({
        action: PROPS_ACTIONS.ADD_PROPERTY,
        eventName: ReactiveEventsModule.EventTypes.ADD_PROPERTY,
        data: [
          expect.objectContaining({
            id: 'batch-position',
            type: PropertyTypes.POSITION,
            x: 0,
            y: 20
          }),
          expect.objectContaining({
            id: 'batch-dimension',
            type: PropertyTypes.DIMENSION,
            width: 100,
            height: 200
          })
        ]
      })
    ])
  })

  it('removes a failed property creation batch without a live or journal prefix', () => {
    const before = propsManager.save()

    expect(() =>
      propsManager.runInPropertyCreationBatch(() => {
        const first = propsManager.createProperty({
          id: 'duplicate-batch-property',
          type: PropertyTypes.POSITION
        })
        propsManager.addProperty([first])
        propsManager.createProperty({
          id: 'duplicate-batch-property',
          type: PropertyTypes.POSITION
        })
      })
    ).toThrow(/duplicate.*property/i)

    expect(propsManager.save()).toEqual(before)
    expect(propsManager.changes).toEqual([])
  })

  it('rejects re-registering an active owner property inside a creation batch', () => {
    const active = propsManager.createProperty({
      id: 'active-owner-property',
      type: PropertyTypes.POSITION
    })
    propsManager.addProperty([active])
    propsManager.cleanChanges()

    expect(() =>
      propsManager.runInPropertyCreationBatch(() => {
        propsManager.addProperty([active])
      })
    ).toThrow(/cannot register active owner property/i)

    expect(propsManager.getPropertyById('active-owner-property')).toBe(active)
    expect(propsManager.changes).toEqual([])
  })

  it('applies one owner-issued canonical property creation prepared with child-first evidence', () => {
    const child = new PositionComponent({
      id: 'prepared-child',
      x: 12,
      y: 24
    }).save()
    const parent = new CustomComponent({
      id: 'prepared-parent',
      children: ['prepared-child']
    } as unknown as Partial<PropertyComponentInstanceDataTypes>).save()
    const getPropertyById = vi.spyOn(propsManager, 'getPropertyById')
    const prepared = propsManager.preflightPropertyCreationBatch(
      [child, parent],
      ['prepared-parent', 'prepared-parent']
    )
    const redundantActiveLookupCount = getPropertyById.mock.calls.length
    getPropertyById.mockRestore()
    const createProperty = vi.spyOn(propsManager, 'createProperty')
    const addProperty = vi.spyOn(propsManager, 'addProperty')
    const addToMap = vi.spyOn(propsManager, 'addToMap')

    expect(redundantActiveLookupCount).toBe(0)
    const appliedIds = propsManager.runInPropertyCreationBatch(() =>
      propsManager.applyPropertyCreationBatch(prepared)
    ).result
    const singleDispatchCounts = {
      addProperty: addProperty.mock.calls.length,
      addToMap: addToMap.mock.calls.length,
      createProperty: createProperty.mock.calls.length
    }
    createProperty.mockRestore()
    addProperty.mockRestore()
    addToMap.mockRestore()

    expect(appliedIds).toEqual(['prepared-child', 'prepared-parent'])
    expect(singleDispatchCounts).toEqual({
      addProperty: 0,
      addToMap: 0,
      createProperty: 0
    })
    expect(() =>
      propsManager.runInPropertyCreationBatch(() =>
        propsManager.applyPropertyCreationBatch(prepared)
      )
    ).toThrow(/one-shot prepared property creation batch/i)
    expect(propsManager.save()).toEqual({
      'prepared-child': child,
      'prepared-parent': parent
    })
    expect(propsManager.changes).toEqual([
      expect.objectContaining({
        action: PROPS_ACTIONS.ADD_PROPERTY,
        data: [child, parent]
      })
    ])
  })

  it('does not scan unrelated active properties while applying an ordinary creation batch', () => {
    const unrelated = propsManager.createProperty({
      id: 'unrelated-active-property',
      type: PropertyTypes.POSITION,
      x: 1,
      y: 2
    })
    propsManager.addProperty([unrelated])
    propsManager.cleanChanges()
    const prepared = propsManager.preflightOrdinaryPropertyCreationBatch([
      {
        definitions: [
          {
            name: PropertyTypes.POSITION,
            type: PropertyTypes.POSITION
          }
        ],
        data: { x: 12, y: 24 },
        propertyIds: {
          [PropertyTypes.POSITION]: 'ordinary-created-property'
        }
      }
    ])
    const get = vi.spyOn(unrelated, 'get')
    let createdSaveCount = 0
    const phaseNames: string[] = []
    const unsubscribe = subscribeToBrowserDragPhases((name) => {
      if (name.startsWith('props-manager:')) {
        phaseNames.push(name)
      }
    })

    try {
      propsManager.runInPropertyCreationBatch(() => {
        const property = propsManager.createProperty({
          id: 'ordinary-created-property',
          type: PropertyTypes.POSITION,
          x: 12,
          y: 24
        })
        const save = property.save.bind(property)
        property.save = () => {
          createdSaveCount += 1
          return save()
        }
        propsManager.addProperty([property])
      }, prepared)
    } finally {
      unsubscribe()
    }

    expect(get).not.toHaveBeenCalledWith('type')
    expect(createdSaveCount).toBe(1)
    expect(phaseNames).not.toContain('props-manager:creation-evidence-clone')
    expect(
      propsManager.getPropertyById('ordinary-created-property')?.save()
    ).toMatchObject({
      id: 'ordinary-created-property',
      x: 12,
      y: 24
    })
  })

  it('registers one canonical property batch through one registerMany owner boundary', () => {
    const source = [
      new PositionComponent({
        id: 'register-many-first',
        x: 10,
        y: 20
      }).save(),
      new PositionComponent({
        id: 'register-many-second',
        x: 30,
        y: 40
      }).save()
    ]
    const registerMany = vi.spyOn(
      propsManager as unknown as {
        registerMany(
          components: readonly PropertyComponentInstanceTypes[]
        ): void
      },
      'registerMany'
    )

    try {
      const prepared = propsManager.preflightPropertyCreationBatch(
        source,
        source.map(({ id }) => id)
      )
      propsManager
        .runInPropertyCreationBatch(() =>
          propsManager.applyPropertyCreationBatch(prepared)
        )
        .complete()

      expect(registerMany).toHaveBeenCalledTimes(1)
      expect(
        registerMany.mock.calls[0]?.[0].map((component) => component.get('id'))
      ).toEqual(['register-many-first', 'register-many-second'])
    } finally {
      registerMany.mockRestore()
    }
  })

  it('keeps ordinary descriptor properties staged until one final registerMany boundary', () => {
    const ordinaryBatchOwner = propsManager as PropsManager & {
      preflightOrdinaryPropertyCreationBatch(
        owners: readonly {
          definitions: readonly PropertyDefinition[]
          data: Readonly<Record<string, unknown>>
          propertyIds?: Readonly<Record<string, string>>
        }[]
      ): object
      runInPropertyCreationBatch<T>(
        operation: () => T,
        prepared: object
      ): { result: T; rollback(): void; complete(): void }
    }
    const prepared = ordinaryBatchOwner.preflightOrdinaryPropertyCreationBatch([
      {
        definitions: [
          { name: PropertyTypes.POSITION, type: PropertyTypes.POSITION },
          { name: PropertyTypes.DIMENSION, type: PropertyTypes.DIMENSION }
        ],
        data: { x: 10, y: 20, width: 30, height: 40 }
      },
      {
        definitions: [
          { name: PropertyTypes.POSITION, type: PropertyTypes.POSITION },
          { name: PropertyTypes.DIMENSION, type: PropertyTypes.DIMENSION }
        ],
        data: { x: 50, y: 60, width: 70, height: 80 }
      }
    ])
    const registerMany = vi.spyOn(propsManager, 'registerMany')
    const activeIdsDuringMaterialization: string[][] = []

    const receipt = ordinaryBatchOwner.runInPropertyCreationBatch(() => {
      const owners = ['first', 'second'].map((owner) => {
        const position = propsManager.createProperty({
          id: `${owner}-position`,
          type: PropertyTypes.POSITION
        })
        const dimension = propsManager.createProperty({
          id: `${owner}-dimension`,
          type: PropertyTypes.DIMENSION
        })
        const propertyIds = propsManager.addProperty([position, dimension])
        activeIdsDuringMaterialization.push(Object.keys(propsManager.save()))
        return propertyIds
      })
      return owners
    }, prepared)

    expect(activeIdsDuringMaterialization).toEqual([[], []])
    expect(registerMany).toHaveBeenCalledTimes(1)
    expect(
      registerMany.mock.calls[0]?.[0].map((component) => component.get('id'))
    ).toEqual([
      'first-position',
      'first-dimension',
      'second-position',
      'second-dimension'
    ])
    expect(Object.keys(propsManager.save())).toEqual([
      'first-position',
      'first-dimension',
      'second-position',
      'second-dimension'
    ])
    expect(propsManager.save()).toMatchObject({
      'first-position': { x: 10, y: 20 },
      'first-dimension': { width: 30, height: 40 },
      'second-position': { x: 50, y: 60 },
      'second-dimension': { width: 70, height: 80 }
    })
    expect(receipt.result).toEqual([
      {
        [PropertyTypes.POSITION]: 'first-position',
        [PropertyTypes.DIMENSION]: 'first-dimension'
      },
      {
        [PropertyTypes.POSITION]: 'second-position',
        [PropertyTypes.DIMENSION]: 'second-dimension'
      }
    ])
  })

  it('preflights record-map relationships before preserving their canonical child ids in one registration batch', () => {
    const parentType = 'ordinary-record-map-parent'
    const relation = {
      key: 'children',
      childType: PropertyTypes.POSITION,
      mode: 'ids-or-objects' as const,
      collection: 'array-or-record' as const,
      toChildData: (
        item: Record<string, unknown>,
        childId?: string
      ): Record<string, unknown> => ({
        id: childId,
        x: item.x,
        y: item.y
      })
    }

    interface RecordMapParentAttrs extends BasePropertyAttrs {
      children: string[]
    }

    class RecordMapParentComponent extends BasePropertyComponent<RecordMapParentAttrs> {
      data: RecordMapParentAttrs = {
        id: '',
        type: parentType,
        children: []
      }

      constructor(data: Partial<PropertyComponentRawData>) {
        super()
        this.load(data as PropertyComponentRawData)
      }

      load(data: PropertyComponentRawData): void {
        this.data.id = typeof data.id === 'string' ? data.id : this.data.id
        const value = (data as Record<string, unknown>).children
        if (Array.isArray(value)) {
          this.data.children = value.filter(
            (childId): childId is string => typeof childId === 'string'
          )
          return
        }
        if (!value || typeof value !== 'object') {
          this.data.children = []
          return
        }

        this.data.children = Object.entries(value).map(
          ([childId, childData]) => {
            if (
              !childData ||
              typeof childData !== 'object' ||
              Array.isArray(childData)
            ) {
              throw new Error(`Invalid child "${childId}"`)
            }
            const child = this.propertyComponentAccessor.createComponent({
              id: childId,
              type: PropertyTypes.POSITION,
              ...childData
            })
            if (!child) {
              throw new Error(`Cannot create child "${childId}"`)
            }
            this.propertyComponentAccessor.addToMap(child)
            return childId
          }
        )
      }

      save(): PropertyComponentRawData {
        return {
          ...super.save(),
          children: [...this.data.children]
        } as PropertyComponentRawData
      }

      getValue(): Record<string, DataTypes> {
        return {
          children: [...this.data.children]
        }
      }

      getUnit(): Record<string, Unit> {
        return {}
      }
    }

    const registerWithCanonicalRelation =
      registerPropertyComponent as unknown as (
        type: string,
        component: typeof RecordMapParentComponent,
        options: undefined,
        definition: undefined,
        canonicalRelation: typeof relation
      ) => void
    registerWithCanonicalRelation(
      parentType,
      RecordMapParentComponent,
      undefined,
      undefined,
      relation
    )
    registerPropertySchema({
      type: parentType,
      fields: [
        {
          key: 'children',
          kind: 'array',
          defaultValue: []
        }
      ]
    })

    const invalidManager = new PropsManager()
    const invalidRegisterMany = vi.spyOn(invalidManager, 'registerMany')
    expect(() =>
      invalidManager.preflightOrdinaryPropertyCreationBatch([
        {
          definitions: [
            {
              name: 'children',
              type: parentType,
              defaultValue: {}
            }
          ],
          data: {
            children: {
              'record-map-child-a': { x: 10, y: 20 },
              'record-map-child-invalid': { x: 'invalid', y: 40 }
            }
          },
          propertyIds: {
            children: 'record-map-parent-invalid'
          }
        }
      ])
    ).toThrow(/invalid runtime property field/i)
    expect(invalidRegisterMany).not.toHaveBeenCalled()
    expect(invalidManager.save()).toEqual({})
    expect(invalidManager.changes).toEqual([])

    const validManager = new PropsManager()
    const registerMany = vi.spyOn(validManager, 'registerMany')
    let ignoredMetadataReadCount = 0
    const children = {
      'record-map-child-a': {
        x: 10,
        y: 20,
        get ignoredMetadata() {
          ignoredMetadataReadCount += 1
          return { trace: 'preflight-snapshot-only' }
        }
      },
      'record-map-child-b': { x: 30, y: 40 }
    }
    const prepared = validManager.preflightOrdinaryPropertyCreationBatch([
      {
        definitions: [
          {
            name: 'children',
            type: parentType,
            defaultValue: {}
          }
        ],
        data: { children },
        propertyIds: {
          children: 'record-map-parent'
        }
      }
    ])
    expect(ignoredMetadataReadCount).toBe(0)
    const receipt = validManager.runInPropertyCreationBatch(() => {
      const parent = validManager.createProperty({
        id: 'record-map-parent',
        type: parentType
      } as Partial<PropertyComponentRawData>)
      return validManager.addProperty([parent])
    }, prepared)

    expect(registerMany).toHaveBeenCalledTimes(1)
    expect(
      registerMany.mock.calls[0]?.[0].map((component) => component.get('id'))
    ).toEqual(['record-map-child-a', 'record-map-child-b', 'record-map-parent'])
    expect(
      validManager.getPropertyById('record-map-parent')?.save()
    ).toMatchObject({
      id: 'record-map-parent',
      type: parentType,
      children: ['record-map-child-a', 'record-map-child-b']
    })
    expect(Object.keys(validManager.save())).toEqual([
      'record-map-child-a',
      'record-map-child-b',
      'record-map-parent'
    ])
    receipt.complete()
  })

  it('rejects an ordinary root id reserved by an explicit relationship child before materialization', () => {
    const childType = 'ordinary-reserved-child'
    const parentType = 'ordinary-reserved-parent'
    const ChildComponent = createPropertyComponentFromConfig({
      type: childType,
      defaults: { value: 0 },
      persistKeys: ['value'],
      valueKeys: ['value']
    })
    const parentDefinition = {
      type: parentType,
      defaults: { children: [] as string[] },
      persistKeys: ['children'],
      valueKeys: ['children'],
      children: {
        key: 'children',
        childType,
        mode: 'ids-or-objects' as const,
        toChildData: (item: Record<string, unknown>) => item
      }
    }
    const ParentComponent = createPropertyComponentFromConfig(parentDefinition)
    registerPropertyComponent(childType, ChildComponent)
    registerPropertyComponent(
      parentType,
      ParentComponent,
      undefined,
      parentDefinition
    )
    const registerMany = vi.spyOn(propsManager, 'registerMany')
    let materializationAttempts = 0

    expect(() => {
      const prepared = propsManager.preflightOrdinaryPropertyCreationBatch([
        {
          definitions: [
            { name: 'standalone', type: childType },
            {
              name: 'children',
              type: parentType,
              defaultValue: []
            }
          ],
          data: {
            children: [{ id: 'ordinary-reserved-id', value: 1 }]
          },
          propertyIds: {
            standalone: 'ordinary-reserved-id'
          }
        }
      ])
      propsManager.runInPropertyCreationBatch(() => {
        materializationAttempts += 1
      }, prepared)
    }).toThrow(/reserved property id/i)

    expect(materializationAttempts).toBe(0)
    expect(registerMany).not.toHaveBeenCalled()
    expect(propsManager.save()).toEqual({})
    expect(propsManager.changes).toEqual([])
  })

  it('preflights relationship entries without materializing a mapped descriptor array', () => {
    const parentType = 'ordinary-direct-descriptor-parent'
    const parentDefinition = {
      type: parentType,
      defaults: { children: [] as string[] },
      persistKeys: ['children'],
      valueKeys: ['children'],
      children: {
        key: 'children',
        childType: PropertyTypes.POSITION,
        mode: 'ids' as const
      }
    }
    const ParentComponent = createPropertyComponentFromConfig(parentDefinition)
    registerPropertyComponent(
      parentType,
      ParentComponent,
      undefined,
      parentDefinition
    )
    let mapReads = 0
    const children = new Proxy(['ordinary-direct-descriptor-child'], {
      get: (target, property, receiver) => {
        if (property === 'map') {
          mapReads += 1
        }
        return Reflect.get(target, property, receiver)
      }
    })

    propsManager.preflightOrdinaryPropertyCreationBatch([
      {
        definitions: [
          { name: 'standalone', type: PropertyTypes.POSITION },
          { name: 'children', type: parentType, defaultValue: [] }
        ],
        data: { children },
        propertyIds: {
          standalone: 'ordinary-direct-descriptor-child',
          children: 'ordinary-direct-descriptor-parent'
        }
      }
    ])

    expect(mapReads).toBe(0)
  })

  it('allows an ordinary relationship string to reference a same-batch requested root with the required type', () => {
    const parentType = 'ordinary-prepared-root-parent'
    const parentDefinition = {
      type: parentType,
      defaults: { children: [] as string[] },
      persistKeys: ['children'],
      valueKeys: ['children'],
      children: {
        key: 'children',
        childType: PropertyTypes.POSITION,
        mode: 'ids' as const
      }
    }
    const ParentComponent = createPropertyComponentFromConfig(parentDefinition)
    registerPropertyComponent(
      parentType,
      ParentComponent,
      undefined,
      parentDefinition
    )
    const registerMany = vi.spyOn(propsManager, 'registerMany')
    const prepared = propsManager.preflightOrdinaryPropertyCreationBatch([
      {
        definitions: [
          { name: 'standalone', type: PropertyTypes.POSITION },
          { name: 'children', type: parentType, defaultValue: [] }
        ],
        data: {
          children: ['ordinary-prepared-root-child']
        },
        propertyIds: {
          standalone: 'ordinary-prepared-root-child',
          children: 'ordinary-prepared-root-parent'
        }
      }
    ])

    const receipt = propsManager.runInPropertyCreationBatch(() => {
      const child = propsManager.createProperty({
        id: 'ordinary-prepared-root-child',
        type: PropertyTypes.POSITION,
        x: 10,
        y: 20
      })
      const parent = propsManager.createProperty({
        id: 'ordinary-prepared-root-parent',
        type: parentType,
        children: ['ordinary-prepared-root-child']
      })
      return propsManager.addProperty([child, parent])
    }, prepared)

    expect(receipt.result).toEqual({
      [PropertyTypes.POSITION]: 'ordinary-prepared-root-child',
      [parentType]: 'ordinary-prepared-root-parent'
    })
    expect(registerMany).toHaveBeenCalledTimes(1)
    expect(
      propsManager.getPropertyById('ordinary-prepared-root-parent')?.save()
    ).toEqual({
      id: 'ordinary-prepared-root-parent',
      type: parentType,
      children: ['ordinary-prepared-root-child']
    })
    receipt.complete()
  })

  it('rejects an ordinary relationship string when its same-batch requested root has the wrong type', () => {
    const parentType = 'ordinary-wrong-prepared-root-parent'
    const parentDefinition = {
      type: parentType,
      defaults: { children: [] as string[] },
      persistKeys: ['children'],
      valueKeys: ['children'],
      children: {
        key: 'children',
        childType: PropertyTypes.POSITION,
        mode: 'ids' as const
      }
    }
    const ParentComponent = createPropertyComponentFromConfig(parentDefinition)
    registerPropertyComponent(
      parentType,
      ParentComponent,
      undefined,
      parentDefinition
    )
    const registerMany = vi.spyOn(propsManager, 'registerMany')
    let materializationAttempts = 0

    expect(() => {
      const prepared = propsManager.preflightOrdinaryPropertyCreationBatch([
        {
          definitions: [
            { name: 'standalone', type: PropertyTypes.DIMENSION },
            { name: 'children', type: parentType, defaultValue: [] }
          ],
          data: {
            children: ['ordinary-wrong-prepared-root-child']
          },
          propertyIds: {
            standalone: 'ordinary-wrong-prepared-root-child',
            children: 'ordinary-wrong-prepared-root-parent'
          }
        }
      ])
      propsManager.runInPropertyCreationBatch(() => {
        materializationAttempts += 1
      }, prepared)
    }).toThrow(/relationship child.*wrong type/i)

    expect(materializationAttempts).toBe(0)
    expect(registerMany).not.toHaveBeenCalled()
    expect(propsManager.save()).toEqual({})
    expect(propsManager.changes).toEqual([])
  })

  it('preserves the action-issued ordinary requested root id without post-action verification', () => {
    const owners = [
      {
        definitions: [
          {
            name: PropertyTypes.POSITION,
            type: PropertyTypes.POSITION
          }
        ],
        data: { x: 10, y: 20 },
        propertyIds: {
          [PropertyTypes.POSITION]: 'ordinary-requested-position'
        }
      }
    ]
    const registerMany = vi.spyOn(propsManager, 'registerMany')

    const matchingPrepared =
      propsManager.preflightOrdinaryPropertyCreationBatch(owners)
    const receipt = propsManager.runInPropertyCreationBatch(() => {
      const property = propsManager.createProperty({
        id: 'ordinary-requested-position',
        type: PropertyTypes.POSITION,
        x: 10,
        y: 20
      })
      return propsManager.addProperty([property])
    }, matchingPrepared)

    expect(receipt.result).toEqual({
      [PropertyTypes.POSITION]: 'ordinary-requested-position'
    })
    expect(registerMany).toHaveBeenCalledTimes(1)
    expect(propsManager.save()).toEqual({
      'ordinary-requested-position': expect.objectContaining({
        id: 'ordinary-requested-position',
        type: PropertyTypes.POSITION,
        x: 10,
        y: 20
      })
    })
    receipt.complete()
  })

  it('allows an ordinary owner to replace a missing requested root id when creation omits an explicit id', () => {
    const prepared = propsManager.preflightOrdinaryPropertyCreationBatch([
      {
        definitions: [
          {
            name: PropertyTypes.POSITION,
            type: PropertyTypes.POSITION
          }
        ],
        data: { x: 10, y: 20 },
        propertyIds: {
          [PropertyTypes.POSITION]: 'ordinary-missing-position'
        }
      }
    ])

    const receipt = propsManager.runInPropertyCreationBatch(() => {
      const property = propsManager.createProperty({
        type: PropertyTypes.POSITION,
        x: 10,
        y: 20
      })
      return propsManager.addProperty([property])
    }, prepared)
    const replacementId = receipt.result[PropertyTypes.POSITION]

    expect(replacementId).toBeDefined()
    expect(replacementId).not.toBe('ordinary-missing-position')
    expect(propsManager.getPropertyById(replacementId)).toBeDefined()
    expect(propsManager.getPropertyById('ordinary-missing-position')).toBe(
      undefined
    )
    receipt.complete()
  })

  it('does not repeat ordinary registration readiness after action materialization', () => {
    const relationshipType = 'ordinary-relationship-target'
    const mutatorType = 'ordinary-registration-mutator'
    const relationshipDefinition = {
      type: relationshipType,
      defaults: { children: [] as string[] },
      persistKeys: ['children'],
      valueKeys: ['children'],
      children: {
        key: 'children',
        childType: PropertyTypes.POSITION,
        mode: 'ids' as const
      }
    }
    const RelationshipComponent = createPropertyComponentFromConfig(
      relationshipDefinition
    )
    const MutatorBase = createPropertyComponentFromConfig({
      type: mutatorType,
      defaults: {},
      persistKeys: [],
      valueKeys: []
    })
    class RelationshipRegistrationMutator extends MutatorBase {
      constructor(data: Partial<PropertyComponentRawData>) {
        super(data)
        propertyComponentRegistry.unregister(relationshipType)
        registerPropertyComponent(relationshipType, RelationshipComponent)
      }
    }
    registerPropertyComponent(
      relationshipType,
      RelationshipComponent,
      undefined,
      relationshipDefinition
    )
    registerPropertyComponent(mutatorType, RelationshipRegistrationMutator)
    const ordinaryBatchOwner = propsManager as PropsManager & {
      preflightOrdinaryPropertyCreationBatch(
        owners: readonly {
          definitions: readonly PropertyDefinition[]
          data: Readonly<Record<string, unknown>>
        }[]
      ): object
      runInPropertyCreationBatch<T>(
        operation: () => T,
        prepared: object
      ): { result: T; rollback(): void; complete(): void }
    }
    const prepared = ordinaryBatchOwner.preflightOrdinaryPropertyCreationBatch([
      {
        definitions: [
          { name: 'mutator', type: mutatorType },
          {
            name: 'relationship',
            type: relationshipType,
            defaultValue: []
          }
        ],
        data: {}
      }
    ])
    const registerMany = vi.spyOn(propsManager, 'registerMany')

    const receipt = ordinaryBatchOwner.runInPropertyCreationBatch(() => {
      const mutator = propsManager.createProperty({
        id: 'ordinary-mutator',
        type: mutatorType
      })
      const relationship = propsManager.createProperty({
        id: 'ordinary-relationship',
        type: relationshipType,
        children: []
      })
      propsManager.addProperty([mutator, relationship])
    }, prepared)

    expect(registerMany).toHaveBeenCalledOnce()
    expect(propsManager.save()).toMatchObject({
      'ordinary-mutator': {
        id: 'ordinary-mutator',
        type: mutatorType
      },
      'ordinary-relationship': {
        id: 'ordinary-relationship',
        type: relationshipType,
        children: []
      }
    })
    receipt.complete()
  })

  it('rejects an active ordinary owner override before materialization can mutate it', () => {
    const active = propsManager.createProperty({
      id: 'ordinary-active-position',
      type: PropertyTypes.POSITION,
      x: 1,
      y: 2
    })
    propsManager.addProperty([active])
    propsManager.cleanChanges()
    const ordinaryBatchOwner = propsManager as PropsManager & {
      preflightOrdinaryPropertyCreationBatch(
        owners: readonly {
          definitions: readonly PropertyDefinition[]
          data: Readonly<Record<string, unknown>>
          propertyIds: Readonly<Record<string, string>>
        }[]
      ): object
    }
    const createProperty = vi.spyOn(propsManager, 'createProperty')

    expect(() =>
      ordinaryBatchOwner.preflightOrdinaryPropertyCreationBatch([
        {
          definitions: [
            {
              name: PropertyTypes.POSITION,
              type: PropertyTypes.POSITION,
              alias: ['x', 'y']
            }
          ],
          data: { x: 99 },
          propertyIds: {
            [PropertyTypes.POSITION]: 'ordinary-active-position'
          }
        }
      ])
    ).toThrow(/active owner override/i)

    expect(createProperty).not.toHaveBeenCalled()
    expect(active.save()).toMatchObject({ x: 1, y: 2 })
    expect(propsManager.changes).toEqual([])
  })

  it('preflights ids-or-objects descriptors against recursive child schemas instead of materialized parent ids', () => {
    const childType = 'ordinary-paint-child'
    const parentType = 'ordinary-paints-parent'
    const childDefaults = { color: '#cccccc', opacity: 1 }
    const ChildComponent = createPropertyComponentFromConfig({
      type: childType,
      defaults: childDefaults,
      persistKeys: ['color', 'opacity'],
      valueKeys: ['color', 'opacity']
    })
    const parentDefinition = {
      type: parentType,
      defaults: { paints: [] as string[] },
      persistKeys: ['paints'],
      valueKeys: ['paints'],
      children: {
        key: 'paints',
        childType,
        mode: 'ids-or-objects' as const,
        toChildData: (item: Record<string, unknown>) => ({
          ...childDefaults,
          ...item
        }),
        toValue: (
          child: { get: (key: string) => unknown },
          childId: string
        ) => ({
          id: childId,
          color: child.get('color'),
          opacity: child.get('opacity')
        })
      }
    }
    const ParentComponent = createPropertyComponentFromConfig(parentDefinition)
    registerPropertySchema({
      type: childType,
      fields: [
        {
          key: 'color',
          kind: 'string',
          validate: (value) => typeof value === 'string' && value.length > 0,
          defaultValue: childDefaults.color
        },
        {
          key: 'opacity',
          kind: 'number',
          validate: (value) =>
            typeof value === 'number' && value >= 0 && value <= 1,
          defaultValue: childDefaults.opacity
        }
      ]
    })
    registerPropertySchema({
      type: parentType,
      fields: [
        {
          key: 'paints',
          kind: 'array',
          validate: (value) =>
            Array.isArray(value) &&
            value.every((item) => typeof item === 'string'),
          defaultValue: []
        }
      ]
    })
    registerPropertyComponent(childType, ChildComponent)
    registerPropertyComponent(
      parentType,
      ParentComponent,
      undefined,
      parentDefinition
    )
    const activeChild = propsManager.createProperty({
      id: 'ordinary-active-paint',
      type: childType,
      color: '#111111',
      opacity: 1
    })
    propsManager.addProperty([activeChild])
    propsManager.cleanChanges()
    const definitions: readonly PropertyDefinition[] = [
      {
        name: 'paints',
        type: parentType,
        defaultValue: [{ color: '#222222', opacity: 0.75 }]
      }
    ]

    expect(() =>
      propsManager.preflightOrdinaryPropertyCreationBatch([
        {
          definitions,
          data: {
            paints: [
              'ordinary-active-paint',
              { color: '#333333', opacity: 0.5 }
            ]
          }
        }
      ])
    ).not.toThrow()
    expect(() =>
      propsManager.preflightOrdinaryPropertyCreationBatch([
        {
          definitions: [
            {
              name: 'paints',
              type: parentType,
              defaultValue: []
            }
          ],
          data: {
            paints: [{ color: '#444444', opacity: 2 }]
          }
        }
      ])
    ).toThrow(/invalid runtime property field.*opacity/i)
    expect(() =>
      propsManager.preflightOrdinaryPropertyCreationBatch([
        {
          definitions: [
            {
              name: 'paints',
              type: parentType,
              defaultValue: []
            }
          ],
          data: { paints: [42] }
        }
      ])
    ).toThrow(/invalid relationship descriptor/i)
    expect(() =>
      propsManager.preflightOrdinaryPropertyCreationBatch([
        {
          definitions: [
            {
              name: 'paints',
              type: parentType,
              defaultValue: []
            }
          ],
          data: { paints: ['missing-paint-id'] }
        }
      ])
    ).toThrow(/missing relationship child/i)
    expect(propsManager.save()).toEqual({
      'ordinary-active-paint': activeChild.save()
    })
    expect(propsManager.changes).toEqual([])
  })

  it('emits detached timings once for each canonical property batch phase', () => {
    const child = new PositionComponent({
      id: 'profiled-property-child',
      x: 12,
      y: 24
    }).save()
    const parent = new CustomComponent({
      id: 'profiled-property-parent',
      children: ['profiled-property-child']
    } as unknown as Partial<PropertyComponentInstanceDataTypes>).save()
    const phaseNames: string[] = []
    const unsubscribe = subscribeToBrowserDragPhases((name) => {
      if (name.startsWith('props-manager:')) {
        phaseNames.push(name)
      }
    })

    try {
      const preparedCreation = propsManager.preflightPropertyCreationBatch(
        [child, parent],
        ['profiled-property-parent']
      )
      propsManager
        .runInPropertyCreationBatch(() =>
          propsManager.applyPropertyCreationBatch(preparedCreation)
        )
        .complete()
      const preparedActive = propsManager.preflightActivePropertyBatch(
        [parent, child],
        ['profiled-property-parent']
      )
      propsManager.runInActivePropertyBatch(preparedActive, () => undefined)
    } finally {
      unsubscribe()
    }

    expect(phaseNames).toEqual([
      'props-manager:creation-preflight',
      'props-manager:creation-registry-readiness',
      'props-manager:creation-materialize',
      'props-manager:creation-post-materialize-readiness',
      'props-manager:creation-relationship-rebind',
      'props-manager:creation-pre-register-readiness',
      'props-manager:creation-register',
      'props-manager:creation-exact',
      'props-manager:creation-operation',
      'props-manager:creation-finalize',
      'props-manager:creation-evidence-save',
      'props-manager:creation-evidence-clone',
      'props-manager:creation-evidence',
      'props-manager:active-preflight-clone',
      'props-manager:active-preflight-exact',
      'props-manager:active-preflight-relations',
      'props-manager:active-preflight',
      'props-manager:active-enter-exact',
      'props-manager:active-rebind-relations',
      'props-manager:active-operation',
      'props-manager:active-exit-exact'
    ])
    expect(propsManager.save()).toEqual({
      'profiled-property-child': child,
      'profiled-property-parent': parent
    })
  })

  it('does not let a failing timing observer change canonical property batches', () => {
    const child = new PositionComponent({
      id: 'observer-safe-property-child',
      x: 4,
      y: 8
    }).save()
    const parent = new CustomComponent({
      id: 'observer-safe-property-parent',
      children: ['observer-safe-property-child']
    } as unknown as Partial<PropertyComponentInstanceDataTypes>).save()
    const unsubscribe = subscribeToBrowserDragPhases(() => {
      throw new Error('diagnostic sink failure')
    })

    try {
      const preparedCreation = propsManager.preflightPropertyCreationBatch(
        [child, parent],
        ['observer-safe-property-parent']
      )
      propsManager
        .runInPropertyCreationBatch(() =>
          propsManager.applyPropertyCreationBatch(preparedCreation)
        )
        .complete()
      const preparedActive = propsManager.preflightActivePropertyBatch(
        [parent, child],
        ['observer-safe-property-parent']
      )
      expect(
        propsManager.runInActivePropertyBatch(
          preparedActive,
          () => 'observer-safe'
        )
      ).toBe('observer-safe')
    } finally {
      unsubscribe()
    }

    expect(propsManager.save()).toEqual({
      'observer-safe-property-child': child,
      'observer-safe-property-parent': parent
    })
    expect(propsManager.changes).toEqual([
      expect.objectContaining({
        action: PROPS_ACTIONS.ADD_PROPERTY,
        data: [child, parent]
      })
    ])
  })

  it('emits bounded owner timings when canonical property preflight rejects', () => {
    const phaseNames: string[] = []
    const unsubscribe = subscribeToBrowserDragPhases((name) => {
      if (name.startsWith('props-manager:')) {
        phaseNames.push(name)
      }
    })
    const child = new PositionComponent({
      id: 'rejected-profile-child',
      x: 1,
      y: 2
    }).save()
    const parent = new CustomComponent({
      id: 'rejected-profile-parent',
      children: ['rejected-profile-child']
    } as unknown as Partial<PropertyComponentInstanceDataTypes>).save()

    try {
      expect(() =>
        propsManager.preflightPropertyCreationBatch(
          [parent, child],
          ['rejected-profile-parent']
        )
      ).toThrow(/child-first/i)

      const active = propsManager.createProperty({
        ...child,
        id: 'rejected-profile-active'
      })
      propsManager.addProperty([active])
      propsManager.cleanChanges()
      expect(() =>
        propsManager.preflightActivePropertyBatch(
          [{ ...active.save(), x: 999 }],
          ['rejected-profile-active']
        )
      ).toThrow(/changed exact component data/i)
    } finally {
      unsubscribe()
    }

    expect(phaseNames).toEqual([
      'props-manager:creation-preflight',
      'props-manager:active-preflight-clone',
      'props-manager:active-preflight'
    ])
  })

  it('does not read the profiling clock when no timing observer is installed', () => {
    const performanceNow = vi.spyOn(performance, 'now')
    const child = new PositionComponent({
      id: 'unprofiled-property-child',
      x: 2,
      y: 6
    }).save()

    try {
      const preparedCreation = propsManager.preflightPropertyCreationBatch(
        [child],
        ['unprofiled-property-child']
      )
      propsManager
        .runInPropertyCreationBatch(() =>
          propsManager.applyPropertyCreationBatch(preparedCreation)
        )
        .complete()
      const preparedActive = propsManager.preflightActivePropertyBatch(
        [child],
        ['unprofiled-property-child']
      )
      propsManager.runInActivePropertyBatch(preparedActive, () => undefined)

      expect(performanceNow).not.toHaveBeenCalled()
    } finally {
      performanceNow.mockRestore()
    }
  })

  it('rejects invalid canonical property graphs and one-shot prepared misuse without mutation', () => {
    const child = new PositionComponent({
      id: 'graph-child',
      x: 1,
      y: 2
    }).save()
    const parent = new CustomComponent({
      id: 'graph-parent',
      children: ['graph-child']
    } as unknown as Partial<PropertyComponentInstanceDataTypes>).save()

    expect(() =>
      propsManager.preflightPropertyCreationBatch(
        [parent, child],
        ['graph-parent']
      )
    ).toThrow(/child-first/i)
    expect(() =>
      propsManager.preflightPropertyCreationBatch(
        [child, parent],
        ['graph-child']
      )
    ).toThrow(/unowned property/i)

    const prepared = propsManager.preflightPropertyCreationBatch(
      [child, parent],
      ['graph-parent']
    )
    expect(() => propsManager.applyPropertyCreationBatch(prepared)).toThrow(
      /active property creation batch/i
    )
    expect(propsManager.save()).toEqual({})
    expect(propsManager.changes).toEqual([])
  })

  it('rejects property constructor registry drift before batch materialization', () => {
    const definition = {
      type: PropertyTypes.CUSTOM,
      defaults: { children: [] as string[] },
      persistKeys: ['children'],
      valueKeys: ['children'],
      children: {
        key: 'children',
        childType: PropertyTypes.POSITION,
        mode: 'ids' as const
      }
    }
    propertyComponentRegistry.unregister(PropertyTypes.CUSTOM)
    const DeclarativeParent = createPropertyComponentFromConfig(definition)
    registerPropertyComponent(
      PropertyTypes.CUSTOM,
      DeclarativeParent,
      undefined,
      definition
    )
    const child = new PositionComponent({
      id: 'registry-drift-child',
      x: 1,
      y: 2
    }).save()
    const parent = {
      id: 'registry-drift-parent',
      type: PropertyTypes.CUSTOM,
      children: ['registry-drift-child']
    } as PropertyComponentRawData
    const prepared = propsManager.preflightPropertyCreationBatch(
      [parent, child],
      ['registry-drift-parent']
    )
    propertyComponentRegistry.unregister(PropertyTypes.CUSTOM)
    registerPropertyComponent(
      PropertyTypes.CUSTOM,
      CustomComponent,
      undefined,
      definition
    )
    const replacementConstruction = vi.spyOn(CustomComponent.prototype, 'load')

    expect(() =>
      propsManager.runInPropertyCreationBatch(() =>
        propsManager.applyPropertyCreationBatch(prepared)
      )
    ).toThrow(/registration changed/i)

    expect(replacementConstruction).not.toHaveBeenCalled()
    replacementConstruction.mockRestore()
    expect(propsManager.save()).toEqual({})
    expect(propsManager.changes).toEqual([])
  })

  it('rejects declarative relationship contract drift before batch materialization', () => {
    const definition = {
      type: PropertyTypes.CUSTOM,
      defaults: { children: [] as string[] },
      persistKeys: ['children'],
      valueKeys: ['children'],
      children: {
        key: 'children',
        childType: PropertyTypes.POSITION,
        mode: 'ids' as const
      }
    }
    propertyComponentRegistry.unregister(PropertyTypes.CUSTOM)
    const DeclarativeParent = createPropertyComponentFromConfig(definition)
    registerPropertyComponent(
      PropertyTypes.CUSTOM,
      DeclarativeParent,
      undefined,
      definition
    )
    const child = new PositionComponent({
      id: 'relation-drift-child',
      x: 1,
      y: 2
    }).save()
    const prepared = propsManager.preflightPropertyCreationBatch(
      [
        {
          id: 'relation-drift-parent',
          type: PropertyTypes.CUSTOM,
          children: ['relation-drift-child']
        } as PropertyComponentRawData,
        child
      ],
      ['relation-drift-parent']
    )
    const driftedDefinition = {
      ...definition,
      defaults: { otherChildren: [] as string[] },
      persistKeys: ['otherChildren'],
      valueKeys: ['otherChildren'],
      children: {
        ...definition.children,
        key: 'otherChildren'
      }
    }
    propertyComponentRegistry.unregister(PropertyTypes.CUSTOM)
    registerPropertyComponent(
      PropertyTypes.CUSTOM,
      DeclarativeParent,
      undefined,
      driftedDefinition
    )
    const replacementConstruction = vi.spyOn(
      DeclarativeParent.prototype,
      'load'
    )

    expect(() =>
      propsManager.runInPropertyCreationBatch(() =>
        propsManager.applyPropertyCreationBatch(prepared)
      )
    ).toThrow(/registration changed/i)

    expect(replacementConstruction).not.toHaveBeenCalled()
    replacementConstruction.mockRestore()
    expect(propsManager.save()).toEqual({})
    expect(propsManager.changes).toEqual([])
  })

  it('rejects child-first declarative relationship drift before batch materialization', () => {
    const definition = {
      type: PropertyTypes.CUSTOM,
      defaults: { children: [] as string[] },
      persistKeys: ['children'],
      valueKeys: ['children'],
      children: {
        key: 'children',
        childType: PropertyTypes.POSITION,
        mode: 'ids' as const
      }
    }
    propertyComponentRegistry.unregister(PropertyTypes.CUSTOM)
    const DeclarativeParent = createPropertyComponentFromConfig(definition)
    registerPropertyComponent(
      PropertyTypes.CUSTOM,
      DeclarativeParent,
      undefined,
      definition
    )
    const child = new PositionComponent({
      id: 'child-first-drift-child',
      x: 1,
      y: 2
    }).save()
    const parent = {
      id: 'child-first-drift-parent',
      type: PropertyTypes.CUSTOM,
      children: ['child-first-drift-child']
    } as PropertyComponentRawData
    const prepared = propsManager.preflightPropertyCreationBatch(
      [child, parent],
      ['child-first-drift-parent']
    )
    const driftedDefinition = {
      ...definition,
      defaults: { otherChildren: [] as string[] },
      persistKeys: ['otherChildren'],
      valueKeys: ['otherChildren'],
      children: {
        ...definition.children,
        key: 'otherChildren'
      }
    }
    propertyComponentRegistry.unregister(PropertyTypes.CUSTOM)
    registerPropertyComponent(
      PropertyTypes.CUSTOM,
      DeclarativeParent,
      undefined,
      driftedDefinition
    )
    const construction = vi.spyOn(DeclarativeParent.prototype, 'load')

    expect(() =>
      propsManager.runInPropertyCreationBatch(() =>
        propsManager.applyPropertyCreationBatch(prepared)
      )
    ).toThrow(/registration changed/i)

    expect(construction).not.toHaveBeenCalled()
    construction.mockRestore()
    expect(propsManager.save()).toEqual({})
    expect(propsManager.changes).toEqual([])
  })

  it.each(['mutated', 'replaced', 'removed'] as const)(
    'rejects %s property schema drift before batch materialization',
    (drift) => {
      const source = [
        new PositionComponent({
          id: `schema-${drift}-first`,
          x: 1,
          y: 2
        }).save(),
        new PositionComponent({
          id: `schema-${drift}-second`,
          x: 3,
          y: 4
        }).save()
      ]
      const prepared = propsManager.preflightPropertyCreationBatch(
        source,
        source.map(({ id }) => id)
      )
      const schema = propertySchemaRegistry.get(PropertyTypes.POSITION)
      if (!schema) {
        throw new Error('Expected the registered position schema')
      }
      if (drift === 'mutated') {
        schema.fields[0].defaultValue = 99
      } else {
        propertySchemaRegistry.unregister(PropertyTypes.POSITION)
        if (drift === 'replaced') {
          registerPropertySchema({
            ...schema,
            fields: schema.fields.map((field, index) =>
              index === 0 ? { ...field, defaultValue: 99 } : { ...field }
            )
          })
        }
      }
      const construction = vi.spyOn(PositionComponent.prototype, 'load')

      expect(() =>
        propsManager.runInPropertyCreationBatch(() =>
          propsManager.applyPropertyCreationBatch(prepared)
        )
      ).toThrow(/registration changed/i)

      expect(construction).not.toHaveBeenCalled()
      construction.mockRestore()
      expect(propsManager.save()).toEqual({})
      expect(propsManager.changes).toEqual([])
    }
  )

  it('rejects a schema added after a schema-free creation preflight', () => {
    const schemaFreeType = 'schema-free-creation'
    class SchemaFreeComponent extends CustomComponent {
      constructor(data: Partial<PropertyComponentInstanceDataTypes>) {
        super(data)
        this.data.type = schemaFreeType
      }
    }
    registerPropertyComponent(schemaFreeType, SchemaFreeComponent)
    const source = [
      { id: 'schema-free-first', type: schemaFreeType },
      { id: 'schema-free-second', type: schemaFreeType }
    ] as PropertyComponentRawData[]
    const prepared = propsManager.preflightPropertyCreationBatch(
      source,
      source.map(({ id }) => id)
    )
    registerPropertySchema({
      type: schemaFreeType,
      fields: [
        {
          key: 'value',
          kind: 'number',
          defaultValue: 0
        }
      ]
    })
    const construction = vi.spyOn(SchemaFreeComponent.prototype, 'load')

    expect(() =>
      propsManager.runInPropertyCreationBatch(() =>
        propsManager.applyPropertyCreationBatch(prepared)
      )
    ).toThrow(/registration changed/i)

    expect(construction).not.toHaveBeenCalled()
    construction.mockRestore()
    expect(propsManager.save()).toEqual({})
    expect(propsManager.changes).toEqual([])
  })

  it('keeps a schema-free prepared valid when unrelated active schemas are cleared', () => {
    const schemaFreeType = 'schema-free-unrelated-clear'
    class SchemaFreeComponent extends CustomComponent {
      constructor(data: Partial<PropertyComponentInstanceDataTypes>) {
        super(data)
        this.data.type = schemaFreeType
      }
    }
    registerPropertyComponent(schemaFreeType, SchemaFreeComponent)
    registerPropertySchema({
      type: schemaFreeType,
      fields: []
    })
    propertySchemaRegistry.unregister(schemaFreeType)
    const source = [
      { id: 'schema-free-clear-first', type: schemaFreeType },
      { id: 'schema-free-clear-second', type: schemaFreeType }
    ] as PropertyComponentRawData[]
    const prepared = propsManager.preflightPropertyCreationBatch(
      source,
      source.map(({ id }) => id)
    )

    propertySchemaRegistry.clear()
    propsManager
      .runInPropertyCreationBatch(() =>
        propsManager.applyPropertyCreationBatch(prepared)
      )
      .complete()

    expect(propsManager.save()).toEqual(
      Object.fromEntries(source.map((component) => [component.id, component]))
    )
  })

  it('uses the captured constructor when an earlier constructor changes a later registration', () => {
    const mutatorType = 'creation-registry-mutator'
    const targetType = 'creation-registry-target'
    let replacementConstructions = 0

    class OriginalTargetComponent extends CustomComponent {
      constructor(data: Partial<PropertyComponentInstanceDataTypes>) {
        super(data)
        this.data.type = targetType
      }
    }
    class ReplacementTargetComponent extends CustomComponent {
      constructor(data: Partial<PropertyComponentInstanceDataTypes>) {
        super(data)
        this.data.type = targetType
        replacementConstructions += 1
      }
    }
    class RegistryMutatorComponent extends CustomComponent {
      constructor(data: Partial<PropertyComponentInstanceDataTypes>) {
        super(data)
        this.data.type = mutatorType
        propertyComponentRegistry.unregister(targetType)
        registerPropertyComponent(targetType, ReplacementTargetComponent)
      }
    }
    registerPropertyComponent(mutatorType, RegistryMutatorComponent)
    registerPropertyComponent(targetType, OriginalTargetComponent)
    const source = [
      { id: 'creation-registry-mutator', type: mutatorType },
      { id: 'creation-registry-target', type: targetType }
    ] as PropertyComponentRawData[]
    const prepared = propsManager.preflightPropertyCreationBatch(
      source,
      source.map(({ id }) => id)
    )

    expect(() =>
      propsManager.runInPropertyCreationBatch(() =>
        propsManager.applyPropertyCreationBatch(prepared)
      )
    ).toThrow(/registration changed/i)

    expect(replacementConstructions).toBe(0)
    expect(propsManager.save()).toEqual({})
    expect(propsManager.changes).toEqual([])
  })

  it('rejects an invalid runtime field before schema-drift materialization', () => {
    const driftType = 'creation-schema-drift'
    const restoreType = 'creation-schema-restore'
    const currentSchema = propertySchemaRegistry.get(PropertyTypes.POSITION)
    if (!currentSchema) {
      throw new Error('Expected the registered position schema')
    }
    const registeredSchema: PropertySchema = currentSchema
    const originalSchema: PropertySchema = registeredSchema
    const registeredXField = originalSchema.fields.find(
      ({ key }) => key === 'x'
    )
    if (!registeredXField) {
      throw new Error('Expected the registered position x field')
    }
    const liveXField = registeredXField
    const originalXField = {
      kind: liveXField.kind,
      defaultValue: liveXField.defaultValue,
      validate: liveXField.validate
    }

    class SchemaDriftComponent extends CustomComponent {
      constructor(data: Partial<PropertyComponentInstanceDataTypes>) {
        super(data)
        this.data.type = driftType
        liveXField.kind = 'string'
        liveXField.defaultValue = ''
        liveXField.validate = (value: unknown) => typeof value === 'string'
      }
    }
    class SchemaRestoreComponent extends CustomComponent {
      constructor(data: Partial<PropertyComponentInstanceDataTypes>) {
        super(data)
        this.data.type = restoreType
        liveXField.kind = originalXField.kind
        liveXField.defaultValue = originalXField.defaultValue
        liveXField.validate = originalXField.validate
      }
    }
    registerPropertyComponent(driftType, SchemaDriftComponent)
    registerPropertyComponent(restoreType, SchemaRestoreComponent)
    const source = [
      { id: 'creation-schema-drift', type: driftType },
      {
        id: 'creation-schema-invalid-position',
        type: PropertyTypes.POSITION,
        x: 'invalid-under-original-schema',
        y: 2,
        xUnit: Unit.PX,
        yUnit: Unit.PX
      },
      { id: 'creation-schema-restore', type: restoreType }
    ] as PropertyComponentRawData[]
    expect(() =>
      propsManager.preflightPropertyCreationBatch(
        source,
        source.map(({ id }) => id)
      )
    ).toThrow(/invalid runtime property field/i)

    expect(propsManager.save()).toEqual({})
    expect(propsManager.changes).toEqual([])
  })

  it('rejects component registration drift restored during materialization', () => {
    const driftType = 'creation-component-drift'
    const targetType = 'creation-component-restore-target'
    const restoreType = 'creation-component-restore'
    let replacementConstructions = 0

    class OriginalTargetComponent extends CustomComponent {
      constructor(data: Partial<PropertyComponentInstanceDataTypes>) {
        super(data)
        this.data.type = targetType
      }
    }
    class ReplacementTargetComponent extends CustomComponent {
      constructor(data: Partial<PropertyComponentInstanceDataTypes>) {
        super(data)
        this.data.type = targetType
        replacementConstructions += 1
      }
    }
    class ComponentDriftComponent extends CustomComponent {
      constructor(data: Partial<PropertyComponentInstanceDataTypes>) {
        super(data)
        this.data.type = driftType
        propertyComponentRegistry.unregister(targetType)
        registerPropertyComponent(targetType, ReplacementTargetComponent)
      }
    }
    class ComponentRestoreComponent extends CustomComponent {
      constructor(data: Partial<PropertyComponentInstanceDataTypes>) {
        super(data)
        this.data.type = restoreType
        propertyComponentRegistry.unregister(targetType)
        registerPropertyComponent(targetType, OriginalTargetComponent)
      }
    }
    registerPropertyComponent(driftType, ComponentDriftComponent)
    registerPropertyComponent(targetType, OriginalTargetComponent)
    registerPropertyComponent(restoreType, ComponentRestoreComponent)
    const source = [
      { id: 'creation-component-drift', type: driftType },
      { id: 'creation-component-target', type: targetType },
      { id: 'creation-component-restore', type: restoreType }
    ] as PropertyComponentRawData[]
    const prepared = propsManager.preflightPropertyCreationBatch(
      source,
      source.map(({ id }) => id)
    )

    expect(() =>
      propsManager.runInPropertyCreationBatch(() =>
        propsManager.applyPropertyCreationBatch(prepared)
      )
    ).toThrow(/registration changed/i)

    expect(replacementConstructions).toBe(0)
    expect(propsManager.save()).toEqual({})
    expect(propsManager.changes).toEqual([])
  })

  it('restores existing active properties with the batch-start schema after failure', () => {
    const mutatorType = 'creation-active-schema-mutator'
    const currentSchema = propertySchemaRegistry.get(PropertyTypes.POSITION)
    if (!currentSchema) {
      throw new Error('Expected the registered position schema')
    }
    const registeredSchema: PropertySchema = currentSchema
    const active = propsManager.createProperty({
      id: 'creation-active-schema-position',
      type: PropertyTypes.POSITION,
      x: 1,
      y: 2,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    })
    propsManager.addProperty([active])
    propsManager.cleanChanges()
    const before = active.save()

    class ActiveSchemaMutatorComponent extends CustomComponent {
      constructor(data: Partial<PropertyComponentInstanceDataTypes>) {
        super(data)
        this.data.type = mutatorType
        propertySchemaRegistry.unregister(PropertyTypes.POSITION)
        registerPropertySchema({
          ...registeredSchema,
          fields: registeredSchema.fields.map((field) =>
            field.key === 'x'
              ? {
                  ...field,
                  kind: 'string',
                  defaultValue: '',
                  validate: (value: unknown) => typeof value === 'string'
                }
              : { ...field }
          )
        })
        getPropertyComponentAccessor()
          .getPropertyById('creation-active-schema-position')
          ?.set('x' as never, 2 as never)
      }
    }
    registerPropertyComponent(mutatorType, ActiveSchemaMutatorComponent)
    const source = [
      {
        id: 'creation-active-schema-mutator',
        type: mutatorType
      },
      {
        id: 'creation-active-schema-new-position',
        type: PropertyTypes.POSITION,
        x: 3,
        y: 4,
        xUnit: Unit.PX,
        yUnit: Unit.PX
      }
    ] as PropertyComponentRawData[]
    const prepared = propsManager.preflightPropertyCreationBatch(
      source,
      source.map(({ id }) => id)
    )

    expect(() =>
      propsManager.runInPropertyCreationBatch(() =>
        propsManager.applyPropertyCreationBatch(prepared)
      )
    ).toThrow(/registration changed/i)

    expect(active.save()).toEqual(before)
    expect(propsManager.save()).toEqual({
      'creation-active-schema-position': before
    })
    expect(propsManager.changes).toEqual([])
  })

  it('rejects schema drift caused by a deferred relationship rebind before registration', () => {
    const relationshipType = 'rebind-schema-drift'
    let validationCount = 0
    const schema: PropertySchema = {
      type: relationshipType,
      fields: [
        {
          key: 'value',
          kind: 'number',
          defaultValue: 0,
          validate: () => {
            validationCount += 1
            if (validationCount === 2) {
              schema.fields[0].defaultValue = 99
            }
            return true
          }
        }
      ]
    }
    const definition = {
      type: relationshipType,
      defaults: { value: 0, children: [] as string[] },
      persistKeys: ['value', 'children'],
      valueKeys: ['value', 'children'],
      children: {
        key: 'children',
        childType: PropertyTypes.POSITION,
        mode: 'ids' as const
      }
    }
    const RelationshipComponent = createPropertyComponentFromConfig(definition)
    registerPropertySchema(schema)
    registerPropertyComponent(
      relationshipType,
      RelationshipComponent,
      undefined,
      definition
    )
    const child = new PositionComponent({
      id: 'rebind-schema-drift-child',
      x: 1,
      y: 2
    }).save()
    const prepared = propsManager.preflightPropertyCreationBatch(
      [
        {
          id: 'rebind-schema-drift-parent',
          type: relationshipType,
          value: 1,
          children: ['rebind-schema-drift-child']
        } as PropertyComponentRawData,
        child
      ],
      ['rebind-schema-drift-parent']
    )

    expect(() =>
      propsManager.runInPropertyCreationBatch(() =>
        propsManager.applyPropertyCreationBatch(prepared)
      )
    ).toThrow(/registration changed/i)

    expect(validationCount).toBe(2)
    expect(propsManager.save()).toEqual({})
    expect(propsManager.changes).toEqual([])
  })

  it('rejects a configured constructor whose registered relationship contract is missing', () => {
    const relationshipType = 'missing-configured-relationship'
    const definition = {
      type: relationshipType,
      defaults: { children: [] as string[] },
      persistKeys: ['children'],
      valueKeys: ['children'],
      children: {
        key: 'children',
        childType: PropertyTypes.POSITION,
        mode: 'ids' as const
      }
    }
    const ConfiguredComponent = createPropertyComponentFromConfig(definition)
    registerPropertyComponent(relationshipType, ConfiguredComponent)

    expect(() =>
      propsManager.preflightPropertyCreationBatch(
        [
          {
            id: 'missing-configured-relationship-parent',
            type: relationshipType,
            children: []
          }
        ],
        ['missing-configured-relationship-parent']
      )
    ).toThrow(/relationship registration/i)

    expect(propsManager.save()).toEqual({})
    expect(propsManager.changes).toEqual([])
  })

  it('reuses one exact active property graph without rebuilding or reordering it', () => {
    const child = propsManager.createProperty(
      new PositionComponent({
        id: 'active-graph-child',
        x: 12,
        y: 24
      }).save()
    )
    propsManager.addProperty([child])
    const parent = propsManager.createProperty(
      new CustomComponent({
        id: 'active-graph-parent',
        children: ['active-graph-child']
      } as unknown as Partial<PropertyComponentInstanceDataTypes>).save()
    )
    propsManager.addProperty([parent])
    propsManager.cleanChanges()
    const source = [parent.save(), child.save()]
    const before = propsManager.save()
    const prepared = propsManager.preflightActivePropertyBatch(source, [
      'active-graph-parent',
      'active-graph-parent'
    ])

    expect(
      propsManager.runInActivePropertyBatch(prepared, () => {
        propsManager.addProperty([parent])
        return ['active-graph-parent']
      })
    ).toEqual(['active-graph-parent'])
    expect(propsManager.getPropertyById('active-graph-child')).toBe(child)
    expect(propsManager.getPropertyById('active-graph-parent')).toBe(parent)
    expect(propsManager.save()).toEqual(before)
    expect(propsManager.changes).toEqual([])
    expect(() =>
      propsManager.runInActivePropertyBatch(prepared, () => undefined)
    ).toThrow(/owner-issued one-shot prepared active property batch/i)
  })

  it('fuses one exact active property preflight with its owner operation', () => {
    const child = propsManager.createProperty(
      new PositionComponent({
        id: 'fused-active-child',
        x: 12,
        y: 24
      }).save()
    )
    propsManager.addProperty([child])
    const parent = propsManager.createProperty(
      new CustomComponent({
        id: 'fused-active-parent',
        children: ['fused-active-child']
      } as unknown as Partial<PropertyComponentInstanceDataTypes>).save()
    )
    propsManager.addProperty([parent])
    propsManager.cleanChanges()
    const source = [parent.save(), child.save()]
    const before = propsManager.save()
    const parentSave = vi.spyOn(parent, 'save')
    const childSave = vi.spyOn(child, 'save')
    const fusedOwner = propsManager as PropsManager & {
      runWithActivePropertyBatch(
        sourceComponents: unknown,
        sourceRootComponentIds: unknown,
        operation: () => readonly string[]
      ): readonly string[]
    }

    expect(
      fusedOwner.runWithActivePropertyBatch(
        source,
        ['fused-active-parent'],
        () => {
          propsManager.addProperty([parent])
          return ['fused-active-parent']
        }
      )
    ).toEqual(['fused-active-parent'])
    const exactSaveCounts = {
      child: childSave.mock.calls.length,
      parent: parentSave.mock.calls.length
    }
    childSave.mockRestore()
    parentSave.mockRestore()

    expect(exactSaveCounts).toEqual({
      child: 2,
      parent: 2
    })
    expect(propsManager.getPropertyById('fused-active-child')).toBe(child)
    expect(propsManager.getPropertyById('fused-active-parent')).toBe(parent)
    expect(propsManager.save()).toEqual(before)
    expect(propsManager.changes).toEqual([])
  })

  it('keeps the two-step active property entry guard against a silent gap mutation', () => {
    const active = propsManager.createProperty(
      new PositionComponent({
        id: 'active-two-step-gap',
        x: 5,
        y: 10
      }).save()
    )
    propsManager.addProperty([active])
    propsManager.cleanChanges()
    const prepared = propsManager.preflightActivePropertyBatch(
      [active.save()],
      ['active-two-step-gap']
    )
    active.load({
      ...active.save(),
      x: 99
    } as never)
    const operation = vi.fn()

    expect(() =>
      propsManager.runInActivePropertyBatch(prepared, operation)
    ).toThrow(/changed exact component data/i)
    expect(operation).not.toHaveBeenCalled()
    expect(active.get('x' as never)).toBe(99)
    expect(propsManager.changes).toEqual([])
  })

  it('accepts exact active source extras without rebuilding or reordering them', () => {
    const child = propsManager.createProperty(
      new PositionComponent({
        id: 'active-source-extra-child',
        x: 1,
        y: 2
      }).save()
    )
    propsManager.addProperty([child])
    const parent = propsManager.createProperty(
      new CustomComponent({
        id: 'active-source-extra-parent',
        children: ['active-source-extra-child']
      } as unknown as Partial<PropertyComponentInstanceDataTypes>).save()
    )
    propsManager.addProperty([parent])
    const extra = propsManager.createProperty(
      new PositionComponent({
        id: 'active-source-extra',
        x: 3,
        y: 4
      }).save()
    )
    propsManager.addProperty([extra])
    propsManager.cleanChanges()
    const before = propsManager.save()
    const beforeIds = Object.keys(before)
    const prepared = propsManager.preflightActivePropertyBatch(
      [parent.save(), child.save(), extra.save()],
      ['active-source-extra-parent']
    )

    expect(
      propsManager.runInActivePropertyBatch(prepared, () => {
        propsManager.addProperty([parent])
        return ['active-source-extra-parent']
      })
    ).toEqual(['active-source-extra-parent'])
    expect(propsManager.getPropertyById('active-source-extra-child')).toBe(
      child
    )
    expect(propsManager.getPropertyById('active-source-extra-parent')).toBe(
      parent
    )
    expect(propsManager.getPropertyById('active-source-extra')).toBe(extra)
    expect(propsManager.save()).toEqual(before)
    expect(Object.keys(propsManager.save())).toEqual(beforeIds)
    expect(propsManager.changes).toEqual([])
  })

  it('rejects stale or malformed active property evidence without mutation', () => {
    const child = propsManager.createProperty(
      new PositionComponent({
        id: 'active-validation-child',
        x: 1,
        y: 2
      }).save()
    )
    propsManager.addProperty([child])
    const parent = propsManager.createProperty(
      new CustomComponent({
        id: 'active-validation-parent',
        children: ['active-validation-child']
      } as unknown as Partial<PropertyComponentInstanceDataTypes>).save()
    )
    propsManager.addProperty([parent])
    const staleExtra = propsManager.createProperty(
      new PositionComponent({
        id: 'active-validation-stale-extra',
        x: 3,
        y: 4
      }).save()
    )
    propsManager.addProperty([staleExtra])
    const malformedParent = propsManager.createProperty(
      new CustomComponent({
        id: 'active-validation-missing-child',
        children: ['missing-active-child']
      } as unknown as Partial<PropertyComponentInstanceDataTypes>).save()
    )
    propsManager.addProperty([malformedParent])
    const wrongTypeChild = propsManager.createProperty({
      id: 'active-validation-wrong-type',
      type: PropertyTypes.DIMENSION
    })
    propsManager.addProperty([wrongTypeChild])
    const wrongTypeParent = propsManager.createProperty(
      new CustomComponent({
        id: 'active-validation-wrong-type-parent',
        children: ['active-validation-wrong-type']
      } as unknown as Partial<PropertyComponentInstanceDataTypes>).save()
    )
    propsManager.addProperty([wrongTypeParent])
    propsManager.cleanChanges()
    const before = propsManager.save()

    expect(() =>
      propsManager.preflightActivePropertyBatch(
        [{ ...parent.save(), children: ['missing-active-child'] }],
        ['active-validation-parent']
      )
    ).toThrow(/changed exact component data|missing relation child/i)
    expect(() =>
      propsManager.preflightActivePropertyBatch(
        [malformedParent.save()],
        ['active-validation-missing-child']
      )
    ).toThrow(/missing relation child/i)
    expect(() =>
      propsManager.preflightActivePropertyBatch(
        [parent.save(), child.save(), malformedParent.save()],
        ['active-validation-parent']
      )
    ).toThrow(/missing relation child/i)
    expect(() =>
      propsManager.preflightActivePropertyBatch(
        [wrongTypeParent.save(), wrongTypeChild.save()],
        ['active-validation-wrong-type-parent']
      )
    ).toThrow(/wrong type/i)
    expect(() =>
      propsManager.preflightActivePropertyBatch(
        [
          parent.save(),
          child.save(),
          wrongTypeParent.save(),
          wrongTypeChild.save()
        ],
        ['active-validation-parent']
      )
    ).toThrow(/wrong type/i)
    expect(() =>
      propsManager.preflightActivePropertyBatch(
        [parent.save(), child.save(), { ...staleExtra.save(), x: 999 }],
        ['active-validation-parent']
      )
    ).toThrow(/changed exact component data/i)
    expect(() =>
      propsManager.preflightActivePropertyBatch(
        [parent.save(), { ...child.save(), x: 999 }],
        ['active-validation-parent']
      )
    ).toThrow(/changed exact component data/i)
    expect(propsManager.save()).toEqual(before)
    expect(propsManager.changes).toEqual([])
  })

  it('rolls back forbidden writes inside an active property reuse batch', () => {
    const active = propsManager.createProperty(
      new PositionComponent({
        id: 'active-reuse-guard',
        x: 5,
        y: 10
      }).save()
    )
    propsManager.addProperty([active])
    propsManager.cleanChanges()
    const before = propsManager.save()
    const preparedUpdate = propsManager.preflightActivePropertyBatch(
      [active.save()],
      ['active-reuse-guard']
    )

    expect(() =>
      propsManager.runInActivePropertyBatch(preparedUpdate, () => {
        active.set('x' as never, 99 as never)
      })
    ).toThrow(/cannot update active property/i)
    expect(propsManager.save()).toEqual(before)
    expect(propsManager.changes).toEqual([])

    const preparedCreation = propsManager.preflightActivePropertyBatch(
      [active.save()],
      ['active-reuse-guard']
    )
    expect(() =>
      propsManager.runInActivePropertyBatch(preparedCreation, () => {
        propsManager.createProperty({
          id: 'forbidden-active-reuse-property',
          type: PropertyTypes.POSITION
        })
      })
    ).toThrow(/cannot create property/i)
    expect(
      propsManager.getPropertyById('forbidden-active-reuse-property')
    ).toBe(undefined)
    expect(propsManager.save()).toEqual(before)
    expect(propsManager.changes).toEqual([])
  })

  it('rolls back a forbidden update to an omitted active relation child', () => {
    const relationChild = propsManager.createProperty(
      new PositionComponent({
        id: 'active-reuse-omitted-child',
        x: 7,
        y: 14
      }).save()
    )
    propsManager.addProperty([relationChild])
    const relationParent = propsManager.createProperty(
      new CustomComponent({
        id: 'active-reuse-parent',
        children: ['active-reuse-omitted-child']
      } as unknown as Partial<PropertyComponentInstanceDataTypes>).save()
    )
    propsManager.addProperty([relationParent])
    propsManager.cleanChanges()
    const before = propsManager.save()
    const prepared = propsManager.preflightActivePropertyBatch(
      [relationParent.save()],
      ['active-reuse-parent']
    )

    expect(() =>
      propsManager.runInActivePropertyBatch(prepared, () => {
        relationChild.set('x' as never, 101 as never)
      })
    ).toThrow(/cannot update active property/i)
    expect(propsManager.save()).toEqual(before)
    expect(propsManager.changes).toEqual([])
  })

  it('should throw error if type is not provided for createProperty', () => {
    expect(() => propsManager.createProperty({})).toThrow('Type is required!')
  })

  it('should throw if the property component type is not registered', () => {
    propertyComponentRegistry.clear()

    expect(() =>
      createProperty({
        id: 'pp-x',
        type: PropertyTypes.POSITION
      })
    ).toThrow(
      '[props-manager] Property component type "position" is not registered.'
    )
  })

  // Test addProperty
  it('should add multiple properties and return their IDs mapped by type', () => {
    const p1Data = {
      id: 'pp-1',
      type: PropertyTypes.POSITION,
      x: 0,
      y: 0,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    }
    const p1Component = createProperty(p1Data) as PropertyComponentInstanceTypes
    const p2Data = {
      id: 'pp-2',
      type: PropertyTypes.DIMENSION,
      width: 100,
      height: 100,
      widthUnit: Unit.PX,
      heightUnit: Unit.PX
    }
    const p2Component = createProperty(p2Data) as PropertyComponentInstanceTypes

    const result = propsManager.addProperty([p1Component, p2Component])

    expect(propsManager._components.has('pp-1')).toBe(true)
    expect(propsManager._components.has('pp-2')).toBe(true)
    expect(result).toEqual({
      [PropertyTypes.POSITION]: 'pp-1',
      [PropertyTypes.DIMENSION]: 'pp-2'
    })
  })

  // Test removeProperty
  it('should remove multiple properties', () => {
    const p1Data = {
      id: 'pp-1',
      type: PropertyTypes.POSITION,
      x: 0,
      y: 0,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    }
    const p1Component = createProperty(p1Data) as PropertyComponentInstanceTypes
    propsManager.addToMap(p1Component)
    const p2Data = {
      id: 'pp-2',
      type: PropertyTypes.POSITION,
      x: 0,
      y: 0,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    }
    const p2Component = createProperty(p2Data) as PropertyComponentInstanceTypes
    propsManager.addToMap(p2Component)

    propsManager.removeProperty(['pp-1', 'pp-2'])

    expect(propsManager._components.has('pp-1')).toBe(false)
    expect(propsManager._components.has('pp-2')).toBe(false)
    expect(propsManager._deletedMap.has('pp-1')).toBe(true)
    expect(propsManager._deletedMap.has('pp-2')).toBe(true)
    expect(propsManager.changes).toEqual([
      expect.objectContaining({
        eventName: ReactiveEventsModule.EventTypes.REMOVE_PROPERTY,
        action: PROPS_ACTIONS.REMOVE_PROPERTY,
        data: [expect.objectContaining({ id: 'pp-1' })]
      }),
      expect.objectContaining({
        eventName: ReactiveEventsModule.EventTypes.REMOVE_PROPERTY,
        action: PROPS_ACTIONS.REMOVE_PROPERTY,
        data: [expect.objectContaining({ id: 'pp-2' })]
      })
    ])
  })

  describe('restore preflight', () => {
    const ownerRelations: ElementPropertyRelation[] = [
      {
        ownerElementId: 'element-restore',
        ownerElementType: 'restore-test-element',
        ownerPropertyName: 'custom',
        componentId: 'custom-restore'
      }
    ]
    const preflight = (
      manager: PropsManager,
      components: readonly unknown[],
      relations: readonly unknown[] = ownerRelations
    ) =>
      (
        manager as unknown as {
          preflightRestoreProperties: (
            snapshot: unknown,
            ownerRelations: unknown
          ) => {
            entries: readonly {
              componentId: string
              strategy: 'reuse' | 'materialize'
            }[]
          }
        }
      ).preflightRestoreProperties({ components }, relations)
    const apply = (
      manager: PropsManager,
      prepared: ReturnType<typeof preflight>
    ) =>
      (
        manager as unknown as {
          applyRestoreProperties: (
            artifact: ReturnType<typeof preflight>
          ) => readonly string[]
        }
      ).applyRestoreProperties(prepared)

    it('prepares exact known-data materialization including registered child relations', () => {
      const components = [
        {
          id: 'position-child',
          type: PropertyTypes.POSITION,
          x: 10,
          y: 20,
          xUnit: Unit.PX,
          yUnit: Unit.PX
        },
        {
          id: 'custom-restore',
          type: PropertyTypes.CUSTOM,
          children: ['position-child'],
          nested: { value: 42 }
        }
      ]
      const before = propsManager.save()

      const prepared = preflight(propsManager, components)

      expect(prepared.entries).toEqual([
        { componentId: 'position-child', strategy: 'materialize' },
        { componentId: 'custom-restore', strategy: 'materialize' }
      ])
      expect(propsManager.save()).toEqual(before)
    })

    it('selects an exact tombstone and accepts an explicit property-free snapshot', () => {
      const component = new CustomComponent({
        id: 'custom-restore',
        type: PropertyTypes.CUSTOM,
        children: []
      } as Partial<PropertyComponentInstanceDataTypes>)
      propsManager.addToMap(component)
      const exactData = component.save()
      propsManager.removeProperty(['custom-restore'])
      propsManager.cleanChanges()
      const before = propsManager.save()

      expect(preflight(propsManager, [exactData]).entries).toEqual([
        { componentId: 'custom-restore', strategy: 'reuse' }
      ])
      expect(preflight(propsManager, [], []).entries).toEqual([])
      expect(propsManager.save()).toEqual(before)
    })

    it('rejects duplicate, active, incompatible, unregistered, and malformed relation evidence without mutation', () => {
      const exact = {
        id: 'custom-restore',
        type: PropertyTypes.CUSTOM,
        children: []
      }
      const expectRejected = (
        manager: PropsManager,
        components: readonly unknown[],
        pattern: RegExp,
        relations: readonly unknown[] = ownerRelations
      ) => {
        const before = manager.save()
        expect(() => preflight(manager, components, relations)).toThrow(pattern)
        expect(manager.save()).toEqual(before)
      }

      expectRejected(propsManager, [exact, exact], /duplicate/i)
      expectRejected(
        propsManager,
        [{ ...exact, type: 'missing-property-type' }],
        /unregistered/i
      )
      expectRejected(
        propsManager,
        [{ ...exact, children: ['missing-child'] }],
        /missing.*child/i
      )
      expectRejected(propsManager, [exact], /missing owner relation/i, [])

      const activeManager = new PropsManager()
      activeManager.addToMap(
        new CustomComponent(
          exact as Partial<PropertyComponentInstanceDataTypes>
        )
      )
      activeManager.cleanChanges()
      expectRejected(activeManager, [exact], /active property/i)

      const tombstoneManager = new PropsManager()
      const tombstone = new CustomComponent({
        ...exact,
        nested: { value: 1 }
      } as Partial<PropertyComponentInstanceDataTypes>)
      tombstoneManager.addToMap(tombstone)
      tombstoneManager.removeProperty(['custom-restore'])
      tombstoneManager.cleanChanges()
      expectRejected(tombstoneManager, [exact], /incompatible tombstone/i)
    })

    it('materializes exact data only in the issuing manager and consumes the prepared once', () => {
      const exact = {
        id: 'custom-restore',
        type: PropertyTypes.CUSTOM,
        children: [],
        nested: { value: 42 }
      }
      const prepared = preflight(propsManager, [exact])
      const otherManager = new PropsManager()

      expect(() => apply(otherManager, prepared)).toThrow(
        /owner-issued one-shot/i
      )
      expect(otherManager.save()).toEqual({})

      expect(apply(propsManager, prepared)).toEqual(['custom-restore'])
      expect(propsManager.save()).toEqual({
        'custom-restore': exact
      })
      expect(() => apply(propsManager, prepared)).toThrow(
        /owner-issued one-shot/i
      )
    })

    it('reuses the compatible tombstone identity without creating a replacement id', () => {
      const tombstone = new CustomComponent({
        id: 'custom-restore',
        type: PropertyTypes.CUSTOM,
        children: [],
        nested: { value: 42 }
      } as Partial<PropertyComponentInstanceDataTypes>)
      propsManager.addToMap(tombstone)
      const exact = tombstone.save()
      propsManager.removeProperty(['custom-restore'])
      propsManager.cleanChanges()
      const prepared = preflight(propsManager, [exact])

      apply(propsManager, prepared)

      expect(propsManager.getPropertyById('custom-restore')).toBe(tombstone)
      expect(propsManager.save()).toEqual({
        'custom-restore': exact
      })
    })

    it('constructs every materialization candidate before canonical map mutation', () => {
      const throwingType = 'throwing-restore-property'
      class ThrowingRestoreComponent extends CustomComponent {
        constructor(data: Partial<PropertyComponentInstanceDataTypes>) {
          super(data)
          throw new Error('restore constructor failed')
        }
      }
      registerPropertyComponent(throwingType, ThrowingRestoreComponent)
      elementPropertyRegistry.register(
        {
          name: 'throwing',
          type: throwingType
        },
        'restore-test-element'
      )
      const relations = [
        ...ownerRelations,
        {
          ownerElementId: 'element-restore',
          ownerElementType: 'restore-test-element',
          ownerPropertyName: 'throwing',
          componentId: 'throwing-restore'
        }
      ]
      const prepared = preflight(
        propsManager,
        [
          {
            id: 'custom-restore',
            type: PropertyTypes.CUSTOM,
            children: []
          },
          {
            id: 'throwing-restore',
            type: throwingType
          }
        ],
        relations
      )

      expect(() => apply(propsManager, prepared)).toThrow(
        /restore constructor failed/i
      )
      expect(propsManager.save()).toEqual({})
    })

    it('rolls back the current restore component and its relationship index when apply-time load fails', () => {
      const throwingType = 'apply-throwing-restore-property'
      class ApplyThrowingRestoreComponent extends CustomComponent {
        constructor(data: Partial<PropertyComponentInstanceDataTypes>) {
          super(data)
          ;(this.data as unknown as Record<string, unknown>).type = throwingType
        }

        load(_data: PropertyComponentRawData): void {
          throw new Error('restore apply load failed')
        }
      }
      const definition = {
        type: throwingType,
        persistKeys: ['children'],
        children: {
          key: 'children',
          childType: PropertyTypes.POSITION,
          mode: 'ids' as const
        }
      }
      registerPropertyComponent(
        throwingType,
        ApplyThrowingRestoreComponent,
        undefined,
        definition
      )
      elementPropertyRegistry.register(
        {
          name: 'apply-throwing',
          type: throwingType
        },
        'restore-test-element'
      )
      const prepared = preflight(
        propsManager,
        [
          {
            id: 'apply-throwing-position-child',
            type: PropertyTypes.POSITION,
            x: 1,
            y: 2,
            xUnit: Unit.PX,
            yUnit: Unit.PX
          },
          {
            id: 'apply-throwing-restore-parent',
            type: throwingType,
            children: ['apply-throwing-position-child']
          }
        ],
        [
          {
            ownerElementId: 'element-restore',
            ownerElementType: 'restore-test-element',
            ownerPropertyName: 'apply-throwing',
            componentId: 'apply-throwing-restore-parent'
          }
        ]
      )

      expect(() => apply(propsManager, prepared)).toThrow(
        /restore apply load failed/i
      )
      expect(propsManager.save()).toEqual({})
      expect(
        propsManager.getRestoreComponentById('apply-throwing-position-child')
      ).toBeUndefined()
      expect(
        propsManager.getRestoreComponentById('apply-throwing-restore-parent')
      ).toBeUndefined()
      expect(propsManager.changes).toEqual([])
    })

    it('constructs materialized components with the issuing manager accessor', () => {
      const probeType = 'restore-accessor-probe'
      class RestoreAccessorProbe extends CustomComponent {
        constructor(data: Partial<PropertyComponentInstanceDataTypes>) {
          super(data)
          ;(this.data as unknown as Record<string, unknown>).type = probeType
          const sharedPosition = getPropertyComponentAccessor().getPropertyById(
            'shared-position'
          ) as unknown as { get: (key: string) => unknown } | undefined
          ;(this.data as unknown as Record<string, unknown>).resolvedX =
            sharedPosition?.get('x')
        }
      }
      registerPropertyComponent(probeType, RestoreAccessorProbe)
      elementPropertyRegistry.register(
        { name: 'probe', type: probeType },
        'restore-test-element'
      )
      propsManager.addToMap(
        new PositionComponent({
          id: 'shared-position',
          type: PropertyTypes.POSITION,
          x: 1,
          y: 0,
          xUnit: Unit.PX,
          yUnit: Unit.PX
        })
      )
      propsManager.cleanChanges()

      const otherManager = new PropsManager()
      otherManager.addToMap(
        new PositionComponent({
          id: 'shared-position',
          type: PropertyTypes.POSITION,
          x: 2,
          y: 0,
          xUnit: Unit.PX,
          yUnit: Unit.PX
        })
      )
      const prepared = preflight(
        propsManager,
        [
          {
            id: 'probe-restore',
            type: probeType,
            resolvedX: 1
          }
        ],
        [
          {
            ownerElementId: 'element-restore',
            ownerElementType: 'restore-test-element',
            ownerPropertyName: 'probe',
            componentId: 'probe-restore'
          }
        ]
      )

      expect(apply(propsManager, prepared)).toEqual(['probe-restore'])
      expect(propsManager.save()['probe-restore']).toEqual({
        id: 'probe-restore',
        type: probeType,
        resolvedX: 1
      })
      expect(otherManager.getPropertyById('probe-restore')).toBeUndefined()
    })
  })

  // Test updatePropsData
  it('should update props data on a component', () => {
    const positionData = {
      id: 'pp-1',
      type: PropertyTypes.POSITION,
      x: 0,
      y: 0,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    }
    const positionComponent = createProperty(
      positionData
    ) as PropertyComponentInstanceTypes
    vi.spyOn(positionComponent, 'set')

    propsManager.addToMap(positionComponent)
    // Type assertion needed because updatePropsData uses union type for keys
    // 'x' is a valid key for PositionAttrs, which is part of PropertyComponentInstanceDataTypes
    propsManager.updatePropsData(
      'pp-1',
      'x' as unknown as keyof PropertyComponentInstanceDataTypes,
      100 as unknown as PropertyComponentInstanceDataTypes[keyof PropertyComponentInstanceDataTypes]
    )
    expect(positionComponent.set).toHaveBeenCalledWith('x', 100)
  })

  it('should update props data with mutation options', () => {
    const positionData = {
      id: 'pp-1',
      type: PropertyTypes.POSITION,
      x: 0,
      y: 0,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    }
    const positionComponent = createProperty(
      positionData
    ) as PropertyComponentInstanceTypes
    vi.spyOn(positionComponent, 'set')

    propsManager.addToMap(positionComponent)
    propsManager.updatePropsData(
      'pp-1',
      'x' as unknown as keyof PropertyComponentInstanceDataTypes,
      100 as unknown as PropertyComponentInstanceDataTypes[keyof PropertyComponentInstanceDataTypes],
      { undoable: false }
    )
    expect(positionComponent.set).toHaveBeenCalledWith('x', 100, {
      undoable: false
    })
  })

  it('prepares two detached ordinary owners and applies one owner-aligned creation batch', () => {
    const ownerElementType = 'detached-ordinary-element'
    const definitions: readonly PropertyDefinition[] = [
      {
        name: PropertyTypes.POSITION,
        type: PropertyTypes.POSITION,
        alias: ['x', 'y']
      }
    ]
    definitions.forEach((definition) =>
      elementPropertyRegistry.register(definition, ownerElementType)
    )
    const request = {
      operations: [
        {
          kind: 'create-owner-properties' as const,
          ownerElementId: 'detached-owner-a',
          ownerElementType,
          definitions,
          data: { x: 10, y: 20 },
          propertyIds: {
            [PropertyTypes.POSITION]: 'detached-position-a'
          }
        },
        {
          kind: 'create-owner-properties' as const,
          ownerElementId: 'detached-owner-b',
          ownerElementType,
          definitions,
          data: { x: 30, y: 40 },
          propertyIds: {
            [PropertyTypes.POSITION]: 'detached-position-b'
          }
        }
      ]
    } satisfies PropertyMutationBatchRequest
    const registerMany = vi.spyOn(propsManager, 'registerMany')
    const { events, subscription } = captureUpdateTransactionEvents()

    const prepared = propsManager.preparePropertyMutationBatch(request)

    expect(propsManager.save()).toEqual({})
    expect(propsManager.changes).toEqual([])
    expect(registerMany).not.toHaveBeenCalled()
    expect(prepared.owners).toEqual([
      {
        orderedId: 'detached-owner-a',
        rootPropertyIds: ['detached-position-a']
      },
      {
        orderedId: 'detached-owner-b',
        rootPropertyIds: ['detached-position-b']
      }
    ])
    expect(prepared.ownerRelations).toEqual([
      {
        ownerElementId: 'detached-owner-a',
        ownerElementType,
        ownerPropertyName: PropertyTypes.POSITION,
        componentId: 'detached-position-a'
      },
      {
        ownerElementId: 'detached-owner-b',
        ownerElementType,
        ownerPropertyName: PropertyTypes.POSITION,
        componentId: 'detached-position-b'
      }
    ])
    expect(prepared.orderedPropertyIds).toEqual([
      'detached-position-a',
      'detached-position-b'
    ])
    expect(Object.isFrozen(prepared.ownerRelations)).toBe(true)

    const result = propsManager.applyPreparedPropertyMutationBatch(prepared)

    expect(registerMany).toHaveBeenCalledTimes(1)
    expect(
      registerMany.mock.calls[0]?.[0].map((component) => component.get('id'))
    ).toEqual(['detached-position-a', 'detached-position-b'])
    expect(propsManager.save()).toMatchObject({
      'detached-position-a': { x: 10, y: 20 },
      'detached-position-b': { x: 30, y: 40 }
    })
    expect(result.ownerRelations).toEqual(prepared.ownerRelations)
    expect(events).toHaveLength(1)
    expect(events[0]?.canonicalEvidence).toEqual({
      orderedIds: ['detached-owner-a', 'detached-owner-b'],
      sharedRecords: [
        {
          orderedIds: ['detached-owner-a'],
          payload: expect.objectContaining({
            data: [
              expect.objectContaining({
                id: 'detached-position-a',
                x: 10,
                y: 20
              })
            ]
          })
        },
        {
          orderedIds: ['detached-owner-b'],
          payload: expect.objectContaining({
            data: [
              expect.objectContaining({
                id: 'detached-position-b',
                x: 30,
                y: 40
              })
            ]
          })
        }
      ]
    })
    subscription.unsubscribe()
  })

  it('normalizes a mapped creation placeholder before generating the canonical child id', () => {
    const ownerElementType = 'detached-placeholder-element'
    const childType = 'detached-placeholder-child'
    const parentType = 'detached-placeholder-parent'
    const propertyName = 'records'
    const ChildComponent = createPropertyComponentFromConfig({
      type: childType,
      defaults: { value: 0 },
      persistKeys: ['value'],
      valueKeys: ['value']
    })
    const parentDefinition = {
      type: parentType,
      defaults: { records: [] as string[] },
      persistKeys: ['records'],
      valueKeys: ['records'],
      children: {
        key: 'records',
        childType,
        mode: 'ids-or-objects' as const,
        collection: 'array-or-record' as const,
        toChildData: (item: Record<string, unknown>) => ({
          id: item.id ?? '',
          value: item.value
        })
      }
    }
    const ParentComponent = createPropertyComponentFromConfig(parentDefinition)
    registerPropertyComponent(childType, ChildComponent)
    registerPropertyComponent(
      parentType,
      ParentComponent,
      undefined,
      parentDefinition
    )
    registerPropertySchema({
      type: childType,
      fields: [
        {
          key: 'value',
          kind: 'number',
          validate: isFiniteNumber,
          defaultValue: 0
        }
      ]
    })
    registerPropertySchema({
      type: parentType,
      fields: [
        {
          key: 'records',
          kind: 'array',
          defaultValue: []
        }
      ]
    })
    const definitions: readonly PropertyDefinition[] = [
      {
        name: propertyName,
        type: parentType,
        defaultValue: []
      }
    ]
    definitions.forEach((definition) =>
      elementPropertyRegistry.register(definition, ownerElementType)
    )

    const prepared = propsManager.preparePropertyMutationBatch({
      operations: [
        {
          kind: 'create-owner-properties',
          ownerElementId: 'detached-placeholder-owner',
          ownerElementType,
          definitions,
          data: {
            records: [
              { id: '', value: 1 },
              { id: 'detached-explicit-child', value: 2 }
            ]
          },
          propertyIds: {
            [propertyName]: 'detached-placeholder-root'
          }
        }
      ]
    })
    propsManager.applyPreparedPropertyMutationBatch(prepared)

    const root = propsManager.getPropertyById('detached-placeholder-root')
    const childIds = (
      root?.save() as unknown as Record<string, unknown> | undefined
    )?.records as string[] | undefined
    expect(childIds).toEqual([
      expect.stringMatching(/^.+$/),
      'detached-explicit-child'
    ])
    expect(childIds?.[0]).not.toBe('detached-explicit-child')
    expect(
      propsManager.getPropertyById(childIds?.[0] ?? '')?.save()
    ).toMatchObject({
      id: childIds?.[0],
      type: childType,
      value: 1
    })
    expect(
      propsManager.getPropertyById('detached-explicit-child')?.save()
    ).toMatchObject({
      id: 'detached-explicit-child',
      type: childType,
      value: 2
    })
  })

  it('rejects a later invalid detached ordinary owner without a registry or evidence prefix', () => {
    const ownerElementType = 'detached-invalid-element'
    const definitions: readonly PropertyDefinition[] = [
      {
        name: PropertyTypes.POSITION,
        type: PropertyTypes.POSITION,
        alias: ['x', 'y']
      }
    ]
    definitions.forEach((definition) =>
      elementPropertyRegistry.register(definition, ownerElementType)
    )
    const registerMany = vi.spyOn(propsManager, 'registerMany')
    const { events, subscription } = captureUpdateTransactionEvents()

    expect(() =>
      propsManager.preparePropertyMutationBatch({
        operations: [
          {
            kind: 'create-owner-properties',
            ownerElementId: 'detached-valid-owner',
            ownerElementType,
            definitions,
            data: { x: 10, y: 20 },
            propertyIds: {
              [PropertyTypes.POSITION]: 'detached-valid-position'
            }
          },
          {
            kind: 'create-owner-properties',
            ownerElementId: 'detached-invalid-owner',
            ownerElementType,
            definitions,
            data: { x: 'invalid', y: 40 },
            propertyIds: {
              [PropertyTypes.POSITION]: 'detached-invalid-position'
            }
          }
        ]
      })
    ).toThrow(/invalid.*detached-invalid-position\.x/i)

    expect(propsManager.save()).toEqual({})
    expect(propsManager.changes).toEqual([])
    expect(registerMany).not.toHaveBeenCalled()
    expect(events).toEqual([])
    subscription.unsubscribe()
  })

  it('combines detached creation with active value and record mutations in one owner batch', () => {
    const ownerElementType = 'detached-mixed-element'
    const definitions: readonly PropertyDefinition[] = [
      {
        name: PropertyTypes.DIMENSION,
        type: PropertyTypes.DIMENSION,
        alias: ['width', 'height']
      }
    ]
    const exactPropertyName = 'detached-mixed-exact'
    definitions.forEach((definition) =>
      elementPropertyRegistry.register(definition, ownerElementType)
    )
    elementPropertyRegistry.register(
      {
        name: exactPropertyName,
        type: PropertyTypes.POSITION
      },
      ownerElementType
    )
    const childType = 'detached-mixed-child'
    const parentType = 'detached-mixed-parent'
    const ChildComponent = createPropertyComponentFromConfig({
      type: childType,
      defaults: { value: 0 },
      persistKeys: ['value'],
      valueKeys: ['value']
    })
    const parentDefinition = {
      type: parentType,
      defaults: { children: [] as string[] },
      persistKeys: ['children'],
      valueKeys: ['children'],
      children: {
        key: 'children',
        childType,
        mode: 'ids-or-objects' as const,
        collection: 'array-or-record' as const
      }
    }
    const ParentComponent = createPropertyComponentFromConfig(parentDefinition)
    registerPropertyComponent(childType, ChildComponent)
    registerPropertyComponent(
      parentType,
      ParentComponent,
      undefined,
      parentDefinition
    )
    registerPropertySchema({
      type: childType,
      fields: [
        {
          key: 'value',
          kind: 'number',
          validate: isFiniteNumber,
          defaultValue: 0
        }
      ]
    })
    registerPropertySchema({
      type: parentType,
      fields: [
        {
          key: 'children',
          kind: 'array',
          defaultValue: []
        }
      ]
    })
    const activePosition = createProperty({
      id: 'detached-mixed-position',
      type: PropertyTypes.POSITION,
      x: 1,
      y: 2,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    }) as PropertyComponentInstanceTypes
    const activeChild = createProperty({
      id: 'detached-mixed-child-id',
      type: childType,
      value: 3
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const activeParent = createProperty({
      id: 'detached-mixed-parent-id',
      type: parentType,
      children: ['detached-mixed-child-id']
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    ;[activePosition, activeChild, activeParent].forEach((component) =>
      propsManager.addToMap(component)
    )
    propsManager.cleanChanges()
    const updateTransactionBatch = vi.fn()
    const registerMany = vi.spyOn(propsManager, 'registerMany')
    const request = {
      operations: [
        {
          kind: 'create-owner-properties' as const,
          ownerElementId: 'detached-mixed-owner',
          ownerElementType,
          definitions,
          data: { width: 100, height: 200 },
          propertyIds: {
            [PropertyTypes.DIMENSION]: 'detached-mixed-dimension'
          }
        },
        {
          kind: 'create-exact-property-graph' as const,
          ownerRelations: [
            {
              ownerElementId: 'detached-mixed-exact-owner',
              ownerElementType,
              ownerPropertyName: exactPropertyName,
              componentId: 'detached-mixed-exact-position'
            }
          ],
          components: [
            {
              id: 'detached-mixed-exact-position',
              type: PropertyTypes.POSITION,
              x: 7,
              y: 8,
              xUnit: Unit.PX,
              yUnit: Unit.PX
            }
          ]
        },
        {
          kind: 'values' as const,
          propertyId: 'detached-mixed-position',
          values: { x: 50 }
        },
        {
          kind: 'records' as const,
          propertyId: 'detached-mixed-parent-id',
          key: 'children',
          set: {
            'detached-mixed-child-id': { value: 30 }
          }
        }
      ]
    } satisfies PropertyMutationBatchRequest

    const result = ReactiveEventsModule.runWithTransactionOwner(
      {
        startTransaction: vi.fn(),
        updateTransactionBatch,
        endTransaction: vi.fn(),
        undo: vi.fn(),
        redo: vi.fn()
      },
      () => propsManager.updateProperties(request)
    )

    expect(result.orderedPropertyIds).toEqual([
      'detached-mixed-dimension',
      'detached-mixed-exact-position',
      'detached-mixed-position',
      'detached-mixed-parent-id'
    ])
    expect(propsManager.save()).toMatchObject({
      'detached-mixed-dimension': { width: 100, height: 200 },
      'detached-mixed-exact-position': {
        x: 7,
        y: 8,
        xUnit: Unit.PX,
        yUnit: Unit.PX
      },
      'detached-mixed-position': { x: 50, y: 2 },
      'detached-mixed-child-id': { value: 30 },
      'detached-mixed-parent-id': { children: ['detached-mixed-child-id'] }
    })
    expect(registerMany).toHaveBeenCalledTimes(1)
    expect(
      registerMany.mock.calls[0]?.[0].map((component) => component.get('id'))
    ).toEqual(['detached-mixed-dimension', 'detached-mixed-exact-position'])
    expect(updateTransactionBatch).toHaveBeenCalledTimes(1)
    expect(updateTransactionBatch.mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({
        eventName: ReactiveEventsModule.EventTypes.ADD_PROPERTY,
        payload: expect.objectContaining({
          data: [
            expect.objectContaining({ id: 'detached-mixed-dimension' }),
            expect.objectContaining({ id: 'detached-mixed-exact-position' })
          ]
        }),
        canonicalEvidence: {
          orderedIds: ['detached-mixed-owner', 'detached-mixed-exact-owner'],
          sharedRecords: [
            {
              orderedIds: ['detached-mixed-owner'],
              payload: expect.objectContaining({
                data: [
                  expect.objectContaining({
                    id: 'detached-mixed-dimension'
                  })
                ]
              })
            },
            {
              orderedIds: ['detached-mixed-exact-owner'],
              payload: expect.objectContaining({
                data: [
                  expect.objectContaining({
                    id: 'detached-mixed-exact-position'
                  })
                ]
              })
            }
          ]
        }
      }),
      expect.objectContaining({
        canonicalEvidence: {
          orderedIds: ['detached-mixed-position']
        }
      }),
      expect.objectContaining({
        canonicalEvidence: {
          orderedIds: ['detached-mixed-parent-id']
        }
      })
    ])
  })

  it('creates one exact component shared by two distinct owner relations', () => {
    const propertyType = 'detached-shared-root'
    const ownerElementType = 'detached-shared-root-element'
    const ownerPropertyName = 'shared'
    let constructorCount = 0
    const SharedRootBase = createPropertyComponentFromConfig({
      type: propertyType,
      defaults: { value: 0 },
      persistKeys: ['value'],
      valueKeys: ['value']
    })
    class SharedRootComponent extends SharedRootBase {
      constructor(data: Partial<PropertyComponentRawData>) {
        super(data)
        constructorCount += 1
      }
    }
    registerPropertyComponent(propertyType, SharedRootComponent)
    registerPropertySchema({
      type: propertyType,
      fields: [
        {
          key: 'value',
          kind: 'number',
          validate: isFiniteNumber,
          defaultValue: 0
        }
      ]
    })
    elementPropertyRegistry.register(
      {
        name: ownerPropertyName,
        type: propertyType
      },
      ownerElementType
    )
    const ownerRelations: ElementPropertyRelation[] = [
      {
        ownerElementId: 'detached-shared-root-owner-a',
        ownerElementType,
        ownerPropertyName,
        componentId: 'detached-shared-root-id'
      },
      {
        ownerElementId: 'detached-shared-root-owner-b',
        ownerElementType,
        ownerPropertyName,
        componentId: 'detached-shared-root-id'
      }
    ]
    const registerMany = vi.spyOn(propsManager, 'registerMany')
    const { events, subscription } = captureUpdateTransactionEvents()

    const prepared = propsManager.preparePropertyMutationBatch({
      operations: [
        {
          kind: 'create-exact-property-graph',
          ownerRelations,
          components: [
            {
              id: 'detached-shared-root-id',
              type: propertyType,
              value: 42
            }
          ]
        }
      ]
    })

    expect(constructorCount).toBe(0)
    expect(registerMany).not.toHaveBeenCalled()
    expect(prepared.ownerRelations).toEqual(ownerRelations)
    expect(prepared.orderedPropertyIds).toEqual(['detached-shared-root-id'])
    expect(propsManager.save()).toEqual({})

    const result = propsManager.applyPreparedPropertyMutationBatch(prepared)

    expect(constructorCount).toBe(1)
    expect(registerMany).toHaveBeenCalledTimes(1)
    expect(registerMany.mock.calls[0]?.[0]).toHaveLength(1)
    expect(registerMany.mock.calls[0]?.[0]?.[0]?.get('id')).toBe(
      'detached-shared-root-id'
    )
    expect(result.ownerRelations).toEqual(ownerRelations)
    expect(Object.keys(propsManager.save())).toEqual([
      'detached-shared-root-id'
    ])
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      payload: {
        action: PROPS_ACTIONS.ADD_PROPERTY,
        data: [
          expect.objectContaining({
            id: 'detached-shared-root-id',
            value: 42
          })
        ]
      },
      canonicalEvidence: {
        orderedIds: [
          'detached-shared-root-owner-a',
          'detached-shared-root-owner-b'
        ],
        sharedRecords: [
          {
            orderedIds: [
              'detached-shared-root-owner-a',
              'detached-shared-root-owner-b'
            ],
            payload: {
              action: PROPS_ACTIONS.ADD_PROPERTY,
              data: [
                expect.objectContaining({
                  id: 'detached-shared-root-id',
                  value: 42
                })
              ]
            }
          }
        ]
      }
    })
    subscription.unsubscribe()
  })

  it('reactivates one exact inactive property graph with the same canonical data', () => {
    const component = createProperty({
      id: 'exact-inactive-property',
      type: PropertyTypes.CUSTOM,
      children: []
    }) as PropertyComponentInstanceTypes
    propsManager.addToMap(component)
    const exact = component.save()
    propsManager.cleanChanges()
    propsManager.removeProperty([component.get('id')])
    propsManager.cleanChanges()

    expect(propsManager.getPropertyById(component.get('id'))).toBeUndefined()
    expect(propsManager.getRestoreComponentById(component.get('id'))).toBe(
      component
    )

    const prepared = propsManager.preparePropertyMutationBatch({
      operations: [
        {
          kind: 'create-exact-property-graph',
          ownerRelations: [
            {
              ownerElementId: 'exact-inactive-owner',
              ownerElementType: 'restore-test-element',
              ownerPropertyName: 'custom',
              componentId: component.get('id')
            }
          ],
          components: [exact]
        }
      ]
    })
    const result = propsManager.applyPreparedPropertyMutationBatch(prepared)

    expect(result.orderedPropertyIds).toEqual([component.get('id')])
    expect(result.evidence).toEqual([
      expect.objectContaining({
        action: PROPS_ACTIONS.ADD_PROPERTY,
        data: [exact]
      })
    ])
    expect(propsManager.getPropertyById(component.get('id'))).toBe(component)
    expect(
      propsManager.getRestoreComponentById(component.get('id'))
    ).toBeUndefined()
    expect(component.save()).toEqual(exact)
  })

  it('reuses one active exact root for a new Scene-owned relation without property evidence', () => {
    const ownerElementType = 'detached-active-shared-root-element'
    const ownerPropertyName = PropertyTypes.POSITION
    elementPropertyRegistry.register(
      {
        name: ownerPropertyName,
        type: PropertyTypes.POSITION
      },
      ownerElementType
    )
    const active = createProperty({
      id: 'detached-active-shared-root-id',
      type: PropertyTypes.POSITION,
      x: 10,
      y: 20,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    }) as PropertyComponentInstanceTypes
    propsManager.addToMap(active)
    propsManager.cleanChanges()
    const before = active.save()
    const load = vi.spyOn(active, 'load')
    const ownerRelations: ElementPropertyRelation[] = [
      {
        ownerElementId: 'detached-active-shared-owner-b',
        ownerElementType,
        ownerPropertyName,
        componentId: active.get('id')
      }
    ]
    const registerMany = vi.spyOn(propsManager, 'registerMany')
    const { events, subscription } = captureUpdateTransactionEvents()

    const prepared = propsManager.preparePropertyMutationBatch({
      operations: [
        {
          kind: 'create-exact-property-graph',
          ownerRelations,
          components: []
        }
      ]
    })

    expect(prepared.ownerRelations).toEqual(ownerRelations)
    expect(prepared.orderedPropertyIds).toEqual([active.get('id')])
    expect(propsManager.getPropertyById(active.get('id'))).toBe(active)
    expect(active.save()).toEqual(before)
    expect(registerMany).not.toHaveBeenCalled()

    const result = propsManager.applyPreparedPropertyMutationBatch(prepared)

    expect(result.ownerRelations).toEqual(ownerRelations)
    expect(result.orderedPropertyIds).toEqual([active.get('id')])
    expect(result.evidence).toEqual([])
    expect(propsManager.getPropertyById(active.get('id'))).toBe(active)
    expect(active.save()).toEqual(before)
    expect(registerMany).not.toHaveBeenCalled()
    expect(load).not.toHaveBeenCalled()
    expect(events).toEqual([])
    expect(propsManager.changes).toEqual([])
    subscription.unsubscribe()
  })

  it('reuses one active ordinary root with a creation default for multiple owner relations without property evidence', () => {
    const propertyType = 'ordinary-active-shared-root'
    const ownerElementType = 'ordinary-active-shared-root-element'
    const ownerPropertyName = 'shared'
    const SharedRootComponent = createPropertyComponentFromConfig({
      type: propertyType,
      defaults: { value: 0 },
      persistKeys: ['value'],
      valueKeys: ['value']
    })
    registerPropertyComponent(propertyType, SharedRootComponent)
    registerPropertySchema({
      type: propertyType,
      fields: [
        {
          key: 'value',
          kind: 'number',
          validate: isFiniteNumber,
          defaultValue: 0
        }
      ]
    })
    const definition: PropertyDefinition = {
      name: ownerPropertyName,
      type: propertyType,
      defaultValue: 99
    }
    elementPropertyRegistry.register(definition, ownerElementType)
    const active = createProperty({
      id: 'ordinary-active-shared-root-id',
      type: propertyType,
      value: 42
    }) as PropertyComponentInstanceTypes
    propsManager.addToMap(active)
    propsManager.cleanChanges()
    const before = active.save()
    const registerMany = vi.spyOn(propsManager, 'registerMany')
    const { events, subscription } = captureUpdateTransactionEvents()

    const prepared = propsManager.preparePropertyMutationBatch({
      operations: [
        {
          kind: 'create-owner-properties',
          ownerElementId: 'ordinary-active-owner-a',
          ownerElementType,
          definitions: [definition],
          data: {},
          propertyIds: {
            [ownerPropertyName]: active.get('id')
          }
        },
        {
          kind: 'create-owner-properties',
          ownerElementId: 'ordinary-active-owner-b',
          ownerElementType,
          definitions: [definition],
          data: {},
          propertyIds: {
            [ownerPropertyName]: active.get('id')
          }
        }
      ]
    })
    const result = propsManager.applyPreparedPropertyMutationBatch(prepared)

    expect(prepared.ownerRelations).toEqual([
      {
        ownerElementId: 'ordinary-active-owner-a',
        ownerElementType,
        ownerPropertyName,
        componentId: active.get('id')
      },
      {
        ownerElementId: 'ordinary-active-owner-b',
        ownerElementType,
        ownerPropertyName,
        componentId: active.get('id')
      }
    ])
    expect(result.evidence).toEqual([])
    expect(propsManager.getPropertyById(active.get('id'))).toBe(active)
    expect(active.save()).toEqual(before)
    expect(registerMany).not.toHaveBeenCalled()
    expect(events).toEqual([])
    subscription.unsubscribe()
  })

  it('resolves one changed shared child to its ordered property ancestor closure without mutation', () => {
    const parentType = 'projection-shared-parent'
    const parentDefinition = {
      type: parentType,
      defaults: { children: [] as string[] },
      persistKeys: ['children'],
      valueKeys: ['children'],
      children: {
        key: 'children',
        childType: PropertyTypes.POSITION,
        mode: 'ids' as const
      }
    }
    const ParentComponent = createPropertyComponentFromConfig(parentDefinition)
    registerPropertyComponent(
      parentType,
      ParentComponent,
      undefined,
      parentDefinition
    )
    const child = propsManager.createProperty({
      id: 'projection-shared-child',
      type: PropertyTypes.POSITION,
      x: 1,
      y: 2
    })
    const firstRoot = propsManager.createProperty({
      id: 'projection-shared-root-a',
      type: parentType,
      children: [child.get('id')]
    })
    const secondRoot = propsManager.createProperty({
      id: 'projection-shared-root-b',
      type: parentType,
      children: [child.get('id')]
    })
    propsManager.addToMap(child)
    propsManager.addToMap(firstRoot)
    propsManager.addToMap(secondRoot)
    propsManager.cleanChanges()
    const before = propsManager.save()

    const ancestorIds = (
      propsManager as PropsManager & {
        resolvePropertyAncestorIds(
          propertyIds: readonly string[]
        ): readonly string[]
      }
    ).resolvePropertyAncestorIds([child.get('id')])

    expect(ancestorIds).toEqual([
      'projection-shared-child',
      'projection-shared-root-a',
      'projection-shared-root-b'
    ])
    expect(propsManager.save()).toEqual(before)
    expect(propsManager.changes).toEqual([])
  })

  it('rejects stale, missing, wrong-type, or later-invalid active exact root reuse without a prefix', () => {
    const ownerElementType = 'detached-active-reuse-guard-element'
    const ownerPropertyName = PropertyTypes.POSITION
    elementPropertyRegistry.register(
      {
        name: ownerPropertyName,
        type: PropertyTypes.POSITION
      },
      ownerElementType
    )
    const active = createProperty({
      id: 'detached-active-reuse-guard-position',
      type: PropertyTypes.POSITION,
      x: 1,
      y: 2,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    }) as PropertyComponentInstanceTypes
    const wrongType = createProperty({
      id: 'detached-active-reuse-guard-dimension',
      type: PropertyTypes.DIMENSION,
      width: 30,
      height: 40,
      widthUnit: Unit.PX,
      heightUnit: Unit.PX
    }) as PropertyComponentInstanceTypes
    const wrongConstructor = new CustomComponent({
      id: 'detached-active-reuse-guard-wrong-constructor',
      type: PropertyTypes.CUSTOM,
      x: 3,
      y: 4,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    })
    wrongConstructor.data.type = PropertyTypes.POSITION
    propsManager.addToMap(active)
    propsManager.addToMap(wrongType)
    propsManager.addToMap(wrongConstructor)
    propsManager.cleanChanges()
    const relation = (
      ownerElementId: string,
      componentId: string
    ): ElementPropertyRelation => ({
      ownerElementId,
      ownerElementType,
      ownerPropertyName,
      componentId
    })
    const exactReuse = (
      ownerElementId: string,
      componentId: string
    ): PropertyMutation => ({
      kind: 'create-exact-property-graph',
      ownerRelations: [relation(ownerElementId, componentId)],
      components: []
    })
    const { events, subscription } = captureUpdateTransactionEvents()

    expect(() =>
      propsManager.preparePropertyMutationBatch({
        operations: [
          exactReuse(
            'detached-active-reuse-wrong-type-owner',
            wrongType.get('id')
          )
        ]
      })
    ).toThrow(/wrong type/i)
    expect(() =>
      propsManager.preparePropertyMutationBatch({
        operations: [
          exactReuse(
            'detached-active-reuse-wrong-constructor-owner',
            wrongConstructor.get('id')
          )
        ]
      })
    ).toThrow(/invalid active root/i)
    expect(() =>
      propsManager.preparePropertyMutationBatch({
        operations: [
          exactReuse(
            'detached-active-reuse-missing-owner',
            'detached-active-reuse-missing-root'
          )
        ]
      })
    ).toThrow(/missing active root/i)
    expect(() =>
      propsManager.preparePropertyMutationBatch({
        operations: [
          exactReuse('detached-active-reuse-valid-owner', active.get('id')),
          exactReuse(
            'detached-active-reuse-later-invalid-owner',
            'detached-active-reuse-later-invalid-root'
          )
        ]
      })
    ).toThrow(/missing active root/i)
    expect(() =>
      propsManager.preparePropertyMutationBatch({
        operations: [
          {
            ...exactReuse(
              'detached-active-reuse-overwrite-owner',
              active.get('id')
            ),
            components: [active.save()]
          }
        ]
      })
    ).toThrow(/duplicate or invalid component ids/i)
    expect(propsManager.getPropertyById(active.get('id'))).toBe(active)
    expect(propsManager.changes).toEqual([])
    expect(events).toEqual([])

    const stalePrepared = propsManager.preparePropertyMutationBatch({
      operations: [
        exactReuse('detached-active-reuse-stale-owner', active.get('id'))
      ]
    })
    active.load({
      ...active.save(),
      x: 99
    })

    expect(() =>
      propsManager.applyPreparedPropertyMutationBatch(stalePrepared)
    ).toThrow(/no longer matches active state/i)
    expect(propsManager.getPropertyById(active.get('id'))).toBe(active)
    expect(active.save()).toMatchObject({ x: 99 })
    expect(events).toEqual([])
    subscription.unsubscribe()
  })

  it('rejects partial, unowned, duplicate, and wrong-type exact property graphs', () => {
    const ownerElementType = 'detached-exact-element'
    elementPropertyRegistry.register(
      {
        name: PropertyTypes.CUSTOM,
        type: PropertyTypes.CUSTOM
      },
      ownerElementType
    )
    const cycleType = 'detached-exact-cycle'
    const cycleDefinition = {
      type: cycleType,
      defaults: { children: [] as string[] },
      persistKeys: ['children'],
      valueKeys: ['children'],
      children: {
        key: 'children',
        childType: cycleType,
        mode: 'ids' as const
      }
    }
    registerPropertyComponent(
      cycleType,
      createPropertyComponentFromConfig(cycleDefinition),
      undefined,
      cycleDefinition
    )
    registerPropertySchema({
      type: cycleType,
      fields: [
        {
          key: 'children',
          kind: 'array',
          defaultValue: []
        }
      ]
    })
    elementPropertyRegistry.register(
      {
        name: 'cycle',
        type: cycleType
      },
      ownerElementType
    )
    const ownerRelations: ElementPropertyRelation[] = [
      {
        ownerElementId: 'detached-exact-owner',
        ownerElementType,
        ownerPropertyName: PropertyTypes.CUSTOM,
        componentId: 'detached-exact-root'
      }
    ]
    const root = {
      id: 'detached-exact-root',
      type: PropertyTypes.CUSTOM,
      children: ['detached-exact-child']
    } as PropertyComponentRawData
    const child = {
      id: 'detached-exact-child',
      type: PropertyTypes.POSITION,
      x: 1,
      y: 2,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    } as PropertyComponentRawData
    const cases: readonly {
      label: RegExp
      components: readonly PropertyComponentRawData[]
      relations?: readonly (typeof ownerRelations)[number][]
    }[] = [
      {
        label: /missing relation child/i,
        components: [root]
      },
      {
        label: /unowned property/i,
        components: [{ ...root, children: [] }, child]
      },
      {
        label: /duplicate or invalid component ids/i,
        components: [child, child, root]
      },
      {
        label: /wrong type/i,
        components: [
          {
            ...child,
            id: 'detached-exact-root'
          }
        ]
      },
      {
        label: /duplicate owner relation/i,
        components: [child, root],
        relations: [...ownerRelations, ...ownerRelations]
      },
      {
        label: /owner relation/i,
        components: [child, root],
        relations: []
      },
      {
        label: /owner relation/i,
        components: [child, root],
        relations: [
          {
            ...ownerRelations[0],
            ownerPropertyName: 'not-registered'
          }
        ]
      },
      {
        label: /relationship cycle/i,
        relations: [
          {
            ownerElementId: 'detached-exact-cycle-owner',
            ownerElementType,
            ownerPropertyName: 'cycle',
            componentId: 'detached-exact-cycle-root'
          }
        ],
        components: [
          {
            id: 'detached-exact-cycle-root',
            type: cycleType,
            children: ['detached-exact-cycle-root']
          } as PropertyComponentRawData
        ]
      }
    ]

    cases.forEach(({ label, components, relations = ownerRelations }) => {
      expect(() =>
        propsManager.preparePropertyMutationBatch({
          operations: [
            {
              kind: 'create-exact-property-graph',
              ownerRelations: relations,
              components
            }
          ]
        })
      ).toThrow(label)
      expect(propsManager.save()).toEqual({})
      expect(propsManager.changes).toEqual([])
    })
  })

  it('rejects a duplicate owner relation across ordinary and exact creation operations', () => {
    const ownerElementType = 'detached-global-owner-relation'
    const definition: PropertyDefinition = {
      name: PropertyTypes.POSITION,
      type: PropertyTypes.POSITION
    }
    elementPropertyRegistry.register(definition, ownerElementType)

    expect(() =>
      propsManager.preparePropertyMutationBatch({
        operations: [
          {
            kind: 'create-owner-properties',
            ownerElementId: 'detached-global-owner',
            ownerElementType,
            definitions: [definition],
            data: {},
            propertyIds: {
              [PropertyTypes.POSITION]:
                'detached-global-owner-ordinary-position'
            }
          },
          {
            kind: 'create-exact-property-graph',
            ownerRelations: [
              {
                ownerElementId: 'detached-global-owner',
                ownerElementType,
                ownerPropertyName: PropertyTypes.POSITION,
                componentId: 'detached-global-owner-exact-position'
              }
            ],
            components: [
              {
                id: 'detached-global-owner-exact-position',
                type: PropertyTypes.POSITION,
                x: 1,
                y: 2,
                xUnit: Unit.PX,
                yUnit: Unit.PX
              }
            ]
          }
        ]
      })
    ).toThrow(/duplicate owner relation/i)
    expect(propsManager.save()).toEqual({})
    expect(propsManager.changes).toEqual([])
  })

  it('materializes preflighted snapshots without re-saving every new component', () => {
    const propertyType = 'detached-save-free-materialization'
    const ownerElementType = 'detached-save-free-element'
    let saveCount = 0
    const FailingBase = createPropertyComponentFromConfig({
      type: propertyType,
      persistKeys: []
    })
    class FailingSaveComponent extends FailingBase {
      save(): PropertyComponentRawData {
        saveCount += 1
        throw new Error('materialization must not re-save prepared data')
      }
    }
    registerPropertyComponent(propertyType, FailingSaveComponent)
    registerPropertySchema({
      type: propertyType,
      fields: []
    })
    elementPropertyRegistry.register(
      {
        name: 'failing',
        type: propertyType
      },
      ownerElementType
    )

    const prepared = propsManager.preparePropertyMutationBatch({
      operations: [
        {
          kind: 'create-exact-property-graph',
          ownerRelations: [
            {
              ownerElementId: 'detached-save-free-owner',
              ownerElementType,
              ownerPropertyName: 'failing',
              componentId: 'detached-save-free-id'
            }
          ],
          components: [
            {
              id: 'detached-save-free-id',
              type: propertyType
            } as PropertyComponentRawData
          ]
        }
      ]
    })

    expect(saveCount).toBe(0)
    expect(() =>
      propsManager.applyPreparedPropertyMutationBatch(prepared)
    ).not.toThrow()
    expect(saveCount).toBe(0)
    expect(
      propsManager.getPropertyById('detached-save-free-id')?.get('id')
    ).toBe('detached-save-free-id')
  })

  it('preflights exact properties without materialization and constructs each component once during apply', () => {
    const trackedType = 'detached-exact-tracked'
    const ownerElementType = 'detached-exact-tracked-element'
    let constructorCount = 0
    let disposeCount = 0
    const TrackedBase = createPropertyComponentFromConfig({
      type: trackedType,
      defaults: {
        x: 0,
        y: 0,
        xUnit: Unit.PX,
        yUnit: Unit.PX
      },
      persistKeys: ['x', 'y', 'xUnit', 'yUnit'],
      valueKeys: ['x', 'y'],
      unitKeys: ['xUnit', 'yUnit']
    })
    class TrackedPositionComponent extends TrackedBase {
      constructor(data: Partial<PropertyComponentRawData>) {
        super(data)
        constructorCount += 1
      }

      dispose(): void {
        disposeCount += 1
      }
    }
    registerPropertyComponent(trackedType, TrackedPositionComponent)
    registerPropertySchema({
      type: trackedType,
      fields: [
        {
          key: 'x',
          kind: 'number',
          validate: isFiniteNumber,
          defaultValue: 0
        },
        {
          key: 'y',
          kind: 'number',
          validate: isFiniteNumber,
          defaultValue: 0
        },
        {
          key: 'xUnit',
          kind: 'string',
          validate: isUnit,
          defaultValue: Unit.PX
        },
        {
          key: 'yUnit',
          kind: 'string',
          validate: isUnit,
          defaultValue: Unit.PX
        }
      ]
    })
    elementPropertyRegistry.register(
      {
        name: 'tracked',
        type: trackedType
      },
      ownerElementType
    )
    const snapshot = {
      id: 'detached-exact-tracked-id',
      type: trackedType,
      x: 10,
      y: 20,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    } as PropertyComponentRawData

    const registerMany = vi.spyOn(propsManager, 'registerMany')
    const prepared = propsManager.preparePropertyMutationBatch({
      operations: [
        {
          kind: 'create-exact-property-graph',
          ownerRelations: [
            {
              ownerElementId: 'detached-exact-tracked-owner',
              ownerElementType,
              ownerPropertyName: 'tracked',
              componentId: snapshot.id
            }
          ],
          components: [snapshot]
        }
      ]
    })

    expect(constructorCount).toBe(0)
    expect(disposeCount).toBe(0)
    expect(propsManager.save()).toEqual({})
    expect(registerMany).not.toHaveBeenCalled()

    propsManager.applyPreparedPropertyMutationBatch(prepared)

    expect(constructorCount).toBe(1)
    expect(disposeCount).toBe(0)
    expect(registerMany).toHaveBeenCalledTimes(1)
    expect(propsManager.save()[snapshot.id]).toEqual(snapshot)
  })

  it('projects ordinary defaults to canonical persistent fields before materialization', () => {
    const propertyType = 'ordinary-persistent-defaults'
    const ownerElementType = 'ordinary-persistent-defaults-element'
    const propertyName = 'payload'
    const definition = {
      type: propertyType,
      defaults: {
        persisted: 5
      },
      persistKeys: ['persisted'],
      valueKeys: ['persisted']
    }
    const Component = createPropertyComponentFromConfig(definition)
    registerPropertyComponent(propertyType, Component, undefined, definition)
    registerPropertySchema({
      type: propertyType,
      fields: [
        {
          key: 'persisted',
          kind: 'number',
          defaultValue: 5
        },
        {
          key: 'transient',
          kind: 'number',
          defaultValue: 9
        }
      ]
    })
    const propertyDefinition: PropertyDefinition = {
      name: propertyName,
      type: propertyType
    }
    elementPropertyRegistry.register(propertyDefinition, ownerElementType)

    const prepared = propsManager.preparePropertyMutationBatch({
      operations: [
        {
          kind: 'create-owner-properties',
          ownerElementId: 'ordinary-persistent-defaults-owner',
          ownerElementType,
          definitions: [propertyDefinition],
          data: {},
          propertyIds: {
            [propertyName]: 'ordinary-persistent-defaults-id'
          }
        }
      ]
    })

    propsManager.applyPreparedPropertyMutationBatch(prepared)

    expect(propsManager.save()['ordinary-persistent-defaults-id']).toEqual({
      id: 'ordinary-persistent-defaults-id',
      type: propertyType,
      persisted: 5
    })
  })

  it('reserves every explicit ordinary root before resolving forward batch relationships', () => {
    const childType = 'ordinary-forward-child'
    const parentType = 'ordinary-forward-parent'
    const ownerElementType = 'ordinary-forward-element'
    const childDefinition = {
      type: childType,
      defaults: { value: 0 },
      persistKeys: ['value'],
      valueKeys: ['value']
    }
    const parentDefinition = {
      type: parentType,
      defaults: { children: [] as string[] },
      persistKeys: ['children'],
      valueKeys: ['children'],
      children: {
        key: 'children',
        childType,
        mode: 'ids' as const
      }
    }
    registerPropertyComponent(
      childType,
      createPropertyComponentFromConfig(childDefinition),
      undefined,
      childDefinition
    )
    registerPropertyComponent(
      parentType,
      createPropertyComponentFromConfig(parentDefinition),
      undefined,
      parentDefinition
    )
    registerPropertySchema({
      type: childType,
      fields: [
        {
          key: 'value',
          kind: 'number',
          defaultValue: 0
        }
      ]
    })
    registerPropertySchema({
      type: parentType,
      fields: [
        {
          key: 'children',
          kind: 'array',
          defaultValue: []
        }
      ]
    })
    const parentOwnerDefinition: PropertyDefinition = {
      name: 'tree',
      type: parentType
    }
    const childOwnerDefinition: PropertyDefinition = {
      name: 'node',
      type: childType
    }
    elementPropertyRegistry.register(parentOwnerDefinition, ownerElementType)
    elementPropertyRegistry.register(childOwnerDefinition, ownerElementType)

    const prepared = propsManager.preparePropertyMutationBatch({
      operations: [
        {
          kind: 'create-owner-properties',
          ownerElementId: 'ordinary-forward-parent-owner',
          ownerElementType,
          definitions: [parentOwnerDefinition],
          data: {
            children: ['ordinary-forward-child-id']
          },
          propertyIds: {
            tree: 'ordinary-forward-parent-id'
          }
        },
        {
          kind: 'create-owner-properties',
          ownerElementId: 'ordinary-forward-child-owner',
          ownerElementType,
          definitions: [childOwnerDefinition],
          data: {
            value: 42
          },
          propertyIds: {
            node: 'ordinary-forward-child-id'
          }
        }
      ]
    })

    propsManager.applyPreparedPropertyMutationBatch(prepared)

    expect(propsManager.save()['ordinary-forward-parent-id']).toEqual({
      id: 'ordinary-forward-parent-id',
      type: parentType,
      children: ['ordinary-forward-child-id']
    })
    expect(propsManager.save()['ordinary-forward-child-id']).toEqual({
      id: 'ordinary-forward-child-id',
      type: childType,
      value: 42
    })
  })

  it('skips every reserved explicit id when an earlier relationship child needs an automatic id', () => {
    const childType = 'ordinary-reserved-auto-child'
    const parentType = 'ordinary-reserved-auto-parent'
    const ownerElementType = 'ordinary-reserved-auto-element'
    const childConfig = {
      type: childType,
      defaults: { value: 0 },
      persistKeys: ['value'],
      valueKeys: ['value']
    }
    const parentConfig = {
      type: parentType,
      defaults: { children: [] as string[] },
      persistKeys: ['children'],
      valueKeys: ['children'],
      children: {
        key: 'children',
        childType,
        mode: 'ids-or-objects' as const
      }
    }
    registerPropertyComponent(
      childType,
      createPropertyComponentFromConfig(childConfig),
      undefined,
      childConfig
    )
    registerPropertyComponent(
      parentType,
      createPropertyComponentFromConfig(parentConfig),
      undefined,
      parentConfig
    )
    registerPropertySchema({
      type: childType,
      fields: [
        {
          key: 'value',
          kind: 'number',
          defaultValue: 0
        }
      ]
    })
    registerPropertySchema({
      type: parentType,
      fields: [
        {
          key: 'children',
          kind: 'array',
          defaultValue: []
        }
      ]
    })
    const parentDefinition: PropertyDefinition = {
      name: 'tree',
      type: parentType
    }
    const childDefinition: PropertyDefinition = {
      name: 'node',
      type: childType
    }
    elementPropertyRegistry.register(parentDefinition, ownerElementType)
    elementPropertyRegistry.register(childDefinition, ownerElementType)
    const previousPropsId = idCounter.current(IDTypes.PROPS)

    try {
      idCounter.update(IDTypes.PROPS, 'pp-8000')
      const prepared = propsManager.preparePropertyMutationBatch({
        operations: [
          {
            kind: 'create-owner-properties',
            ownerElementId: 'ordinary-reserved-auto-parent-owner',
            ownerElementType,
            definitions: [parentDefinition],
            data: {
              children: [{ value: 1 }]
            },
            propertyIds: {
              tree: 'ordinary-reserved-auto-parent-id'
            }
          },
          {
            kind: 'create-owner-properties',
            ownerElementId: 'ordinary-reserved-auto-child-owner',
            ownerElementType,
            definitions: [childDefinition],
            data: {
              value: 2
            },
            propertyIds: {
              node: 'pp-8001'
            }
          }
        ]
      })

      propsManager.applyPreparedPropertyMutationBatch(prepared)

      expect(propsManager.save()['ordinary-reserved-auto-parent-id']).toEqual({
        id: 'ordinary-reserved-auto-parent-id',
        type: parentType,
        children: ['pp-8002']
      })
      expect(propsManager.save()['pp-8001']).toEqual({
        id: 'pp-8001',
        type: childType,
        value: 2
      })
      expect(propsManager.save()['pp-8002']).toEqual({
        id: 'pp-8002',
        type: childType,
        value: 1
      })
    } finally {
      idCounter.update(IDTypes.PROPS, previousPropsId)
    }
  })

  it('rejects a reentrant canonical mutation before consuming or applying the nested batch', () => {
    const outerPropertyType = 'reentrant-canonical-outer'
    const nestedPropertyType = 'reentrant-canonical-nested'
    const ownerElementType = 'reentrant-canonical-element'
    let applyNested: (() => void) | undefined
    const OuterBase = createPropertyComponentFromConfig({
      type: outerPropertyType,
      persistKeys: []
    })
    class ReentrantOuterComponent extends OuterBase {
      constructor(data: Partial<PropertyComponentRawData>) {
        super(data)
        applyNested?.()
      }
    }
    const NestedComponent = createPropertyComponentFromConfig({
      type: nestedPropertyType,
      persistKeys: []
    })
    registerPropertyComponent(outerPropertyType, ReentrantOuterComponent)
    registerPropertyComponent(nestedPropertyType, NestedComponent)
    registerPropertySchema({
      type: outerPropertyType,
      fields: []
    })
    registerPropertySchema({
      type: nestedPropertyType,
      fields: []
    })
    elementPropertyRegistry.register(
      { name: 'outer', type: outerPropertyType },
      ownerElementType
    )
    elementPropertyRegistry.register(
      { name: 'nested', type: nestedPropertyType },
      ownerElementType
    )
    const registerMany = vi.spyOn(propsManager, 'registerMany')
    const { events, subscription } = captureUpdateTransactionEvents()
    const nestedPrepared = propsManager.preparePropertyMutationBatch({
      operations: [
        {
          kind: 'create-exact-property-graph',
          ownerRelations: [
            {
              ownerElementId: 'reentrant-canonical-owner',
              ownerElementType,
              ownerPropertyName: 'nested',
              componentId: 'reentrant-canonical-nested-property'
            }
          ],
          components: [
            {
              id: 'reentrant-canonical-nested-property',
              type: nestedPropertyType
            }
          ]
        }
      ]
    })
    const outerPrepared = propsManager.preparePropertyMutationBatch({
      operations: [
        {
          kind: 'create-exact-property-graph',
          ownerRelations: [
            {
              ownerElementId: 'reentrant-canonical-owner',
              ownerElementType,
              ownerPropertyName: 'outer',
              componentId: 'reentrant-canonical-outer-property'
            }
          ],
          components: [
            {
              id: 'reentrant-canonical-outer-property',
              type: outerPropertyType
            }
          ]
        }
      ]
    })

    applyNested = () => {
      propsManager.applyPreparedPropertyMutationBatch(nestedPrepared)
    }

    expect(() =>
      propsManager.applyPreparedPropertyMutationBatch(outerPrepared)
    ).toThrow(/reentrant canonical property mutation/i)
    expect(
      propsManager.getPropertyById('reentrant-canonical-outer-property')
    ).toBeUndefined()
    expect(
      propsManager.getPropertyById('reentrant-canonical-nested-property')
    ).toBeUndefined()
    expect(propsManager.changes).toEqual([])
    expect(registerMany).not.toHaveBeenCalled()
    expect(events).toEqual([])

    applyNested = undefined
    propsManager.applyPreparedPropertyMutationBatch(nestedPrepared)

    expect(
      propsManager.getPropertyById('reentrant-canonical-nested-property')
    ).toBeDefined()
    subscription.unsubscribe()
  })

  it('disposes an earlier staged component when a later constructor rejects the batch', () => {
    const propertyType = 'later-constructor-failure'
    const ownerElementType = 'later-constructor-failure-element'
    const disposedIds: string[] = []
    const ComponentBase = createPropertyComponentFromConfig({
      type: propertyType,
      persistKeys: []
    })
    class LaterConstructorFailureComponent extends ComponentBase {
      constructor(data: Partial<PropertyComponentRawData>) {
        super(data)
        if (data.id === 'later-constructor-failure-second') {
          throw new Error('later constructor failure')
        }
      }

      dispose(): void {
        disposedIds.push(this.get('id') as string)
      }
    }
    registerPropertyComponent(propertyType, LaterConstructorFailureComponent)
    registerPropertySchema({
      type: propertyType,
      fields: []
    })
    ;['first', 'second'].forEach((name) =>
      elementPropertyRegistry.register(
        {
          name,
          type: propertyType
        },
        ownerElementType
      )
    )
    const registerMany = vi.spyOn(propsManager, 'registerMany')
    const { events, subscription } = captureUpdateTransactionEvents()
    const prepared = propsManager.preparePropertyMutationBatch({
      operations: [
        {
          kind: 'create-exact-property-graph',
          ownerRelations: [
            {
              ownerElementId: 'later-constructor-failure-owner',
              ownerElementType,
              ownerPropertyName: 'first',
              componentId: 'later-constructor-failure-first'
            },
            {
              ownerElementId: 'later-constructor-failure-owner',
              ownerElementType,
              ownerPropertyName: 'second',
              componentId: 'later-constructor-failure-second'
            }
          ],
          components: [
            {
              id: 'later-constructor-failure-first',
              type: propertyType
            },
            {
              id: 'later-constructor-failure-second',
              type: propertyType
            }
          ]
        }
      ]
    })

    expect(() =>
      propsManager.applyPreparedPropertyMutationBatch(prepared)
    ).toThrow('later constructor failure')
    expect(disposedIds).toEqual(['later-constructor-failure-first'])
    expect(
      propsManager.getPropertyById('later-constructor-failure-first')
    ).toBeUndefined()
    expect(
      propsManager.getPropertyById('later-constructor-failure-second')
    ).toBeUndefined()
    expect(propsManager.changes).toEqual([])
    expect(registerMany).not.toHaveBeenCalled()
    expect(events).toEqual([])
    subscription.unsubscribe()
  })

  it('cleans every applied creation when rollback disposal throws without replacing the primary error', () => {
    const propertyType = 'detached-apply-cleanup'
    const ownerElementType = 'detached-apply-cleanup-element'
    let throwOnDispose = false
    const disposedIds: string[] = []
    const CleanupBase = createPropertyComponentFromConfig({
      type: propertyType,
      persistKeys: []
    })
    class CleanupComponent extends CleanupBase {
      dispose(): void {
        disposedIds.push(this.get('id') as string)
        if (throwOnDispose) {
          throw new Error('secondary apply dispose failure')
        }
      }
    }
    registerPropertyComponent(propertyType, CleanupComponent)
    registerPropertySchema({
      type: propertyType,
      fields: []
    })
    ;['first', 'second'].forEach((name) =>
      elementPropertyRegistry.register(
        {
          name,
          type: propertyType
        },
        ownerElementType
      )
    )
    const componentIds = [
      'detached-apply-cleanup-first',
      'detached-apply-cleanup-second'
    ]
    const prepared = propsManager.preparePropertyMutationBatch({
      operations: [
        {
          kind: 'create-exact-property-graph',
          ownerRelations: componentIds.map((componentId, index) => ({
            ownerElementId: 'detached-apply-cleanup-owner',
            ownerElementType,
            ownerPropertyName: index === 0 ? 'first' : 'second',
            componentId
          })),
          components: componentIds.map(
            (componentId) =>
              ({
                id: componentId,
                type: propertyType
              }) as PropertyComponentRawData
          )
        }
      ]
    })
    disposedIds.length = 0
    throwOnDispose = true

    expect(() =>
      ReactiveEventsModule.runWithTransactionOwner(
        {
          startTransaction: vi.fn(),
          updateTransactionBatch: vi.fn(() => {
            throw new Error('primary apply handoff failure')
          }),
          endTransaction: vi.fn(),
          undo: vi.fn(),
          redo: vi.fn()
        },
        () => propsManager.applyPreparedPropertyMutationBatch(prepared)
      )
    ).toThrow('primary apply handoff failure')
    expect(new Set(disposedIds)).toEqual(new Set(componentIds))
    componentIds.forEach((componentId) => {
      expect(propsManager.getPropertyById(componentId)).toBeUndefined()
    })
    expect(propsManager.changes).toEqual([])
  })

  it('keeps disjoint prepared batches valid while consuming a prepared-id collision once', () => {
    const ownerElementType = 'detached-stale-element'
    const definition: PropertyDefinition = {
      name: PropertyTypes.POSITION,
      type: PropertyTypes.POSITION
    }
    elementPropertyRegistry.register(definition, ownerElementType)
    const prepare = (ownerElementId: string, propertyId: string) =>
      propsManager.preparePropertyMutationBatch({
        operations: [
          {
            kind: 'create-owner-properties',
            ownerElementId,
            ownerElementType,
            definitions: [definition],
            data: {},
            propertyIds: {
              [PropertyTypes.POSITION]: propertyId
            }
          }
        ]
      })
    const collidingPrepared = prepare(
      'detached-colliding-owner',
      'detached-colliding-position'
    )
    const disjointPrepared = prepare(
      'detached-disjoint-owner',
      'detached-disjoint-position'
    )
    const collision = createProperty({
      id: 'detached-colliding-position',
      type: PropertyTypes.POSITION
    }) as PropertyComponentInstanceTypes
    const unrelated = createProperty({
      id: 'detached-unrelated-position',
      type: PropertyTypes.POSITION
    }) as PropertyComponentInstanceTypes
    propsManager.addToMap(collision)
    propsManager.addToMap(unrelated)

    expect(() =>
      propsManager.applyPreparedPropertyMutationBatch(disjointPrepared)
    ).not.toThrow()
    expect(() =>
      propsManager.applyPreparedPropertyMutationBatch(collidingPrepared)
    ).toThrow(/no longer matches active state/i)
    expect(() =>
      propsManager.applyPreparedPropertyMutationBatch(collidingPrepared)
    ).toThrow(/owner-issued one-shot prepared property mutation batch/i)
    expect(propsManager.getPropertyById('detached-colliding-position')).toBe(
      collision
    )
    expect(
      propsManager.getPropertyById('detached-disjoint-position')
    ).toBeDefined()
  })

  it('rejects detached creation after its owner definition registration changes', () => {
    const ownerElementType = 'detached-owner-definition-drift'
    const definition: PropertyDefinition = {
      name: PropertyTypes.POSITION,
      type: PropertyTypes.POSITION
    }
    elementPropertyRegistry.register(definition, ownerElementType)
    const prepared = propsManager.preparePropertyMutationBatch({
      operations: [
        {
          kind: 'create-owner-properties',
          ownerElementId: 'detached-owner-definition-element',
          ownerElementType,
          definitions: [definition],
          data: {},
          propertyIds: {
            [PropertyTypes.POSITION]: 'detached-owner-definition-position'
          }
        }
      ]
    })

    elementPropertyRegistry.unregisterRelation(
      ownerElementType,
      PropertyTypes.POSITION
    )

    expect(() =>
      propsManager.applyPreparedPropertyMutationBatch(prepared)
    ).toThrow(/owner definition registration changed/i)
    expect(
      propsManager.getPropertyById('detached-owner-definition-position')
    ).toBeUndefined()
  })

  it('rejects an evidence-free active-owner reuse prepared after its property changes', () => {
    const ownerElementType = 'detached-active-reuse'
    const definition: PropertyDefinition = {
      name: PropertyTypes.POSITION,
      type: PropertyTypes.POSITION
    }
    elementPropertyRegistry.register(definition, ownerElementType)
    const active = createProperty({
      id: 'detached-active-reuse-position',
      type: PropertyTypes.POSITION,
      x: 1,
      y: 2,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    }) as PropertyComponentInstanceTypes
    propsManager.addToMap(active)
    const prepared = propsManager.preparePropertyMutationBatch({
      operations: [
        {
          kind: 'create-owner-properties',
          ownerElementId: 'detached-active-reuse-owner',
          ownerElementType,
          definitions: [definition],
          data: {},
          propertyIds: {
            [PropertyTypes.POSITION]: active.get('id')
          }
        }
      ]
    })
    active.load({
      ...active.save(),
      x: 99
    })

    expect(() =>
      propsManager.applyPreparedPropertyMutationBatch(prepared)
    ).toThrow(/no longer matches active state/i)
    expect(active.save()).toMatchObject({ x: 99 })
  })

  it('rejects changed removal semantics but accepts an exchangeable shared owner edge', () => {
    const childType = 'detached-index-child'
    const parentType = 'detached-index-parent'
    const ChildComponent = createPropertyComponentFromConfig({
      type: childType,
      defaults: { value: 0 },
      persistKeys: ['value'],
      valueKeys: ['value']
    })
    const parentDefinition = {
      type: parentType,
      defaults: { children: [] as string[] },
      persistKeys: ['children'],
      valueKeys: ['children'],
      children: {
        key: 'children',
        childType,
        mode: 'ids-or-objects' as const,
        collection: 'array-or-record' as const
      }
    }
    registerPropertyComponent(childType, ChildComponent)
    registerPropertyComponent(
      parentType,
      createPropertyComponentFromConfig(parentDefinition),
      undefined,
      parentDefinition
    )
    registerPropertySchema({
      type: childType,
      fields: [
        {
          key: 'value',
          kind: 'number',
          validate: isFiniteNumber,
          defaultValue: 0
        }
      ]
    })
    registerPropertySchema({
      type: parentType,
      fields: [
        {
          key: 'children',
          kind: 'array',
          defaultValue: []
        }
      ]
    })
    const child = createProperty({
      id: 'detached-index-child-id',
      type: childType,
      value: 1
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const target = createProperty({
      id: 'detached-index-target',
      type: parentType,
      children: [child.get('id')]
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const peer = createProperty({
      id: 'detached-index-peer',
      type: parentType,
      children: []
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    ;[child, target, peer].forEach((component) =>
      propsManager.addToMap(component)
    )
    propsManager.cleanChanges()
    const prepared = propsManager.preparePropertyMutationBatch({
      operations: [
        {
          kind: 'records',
          propertyId: target.get('id'),
          key: 'children',
          remove: [child.get('id')]
        }
      ]
    })

    propsManager.updateProperties({
      operations: [
        {
          kind: 'records',
          propertyId: peer.get('id'),
          key: 'children',
          set: {
            [child.get('id')]: {}
          }
        }
      ]
    })

    expect(() =>
      propsManager.applyPreparedPropertyMutationBatch(prepared)
    ).toThrow(/no longer matches active state/i)
    expect(target.save()).toMatchObject({
      children: ['detached-index-child-id']
    })
    expect(peer.save()).toMatchObject({
      children: ['detached-index-child-id']
    })
    expect(propsManager.getPropertyById(child.get('id'))).toBe(child)

    const replacement = createProperty({
      id: 'detached-index-replacement',
      type: parentType,
      children: []
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    propsManager.addToMap(replacement)
    propsManager.cleanChanges()
    const exchangeablePrepared = propsManager.preparePropertyMutationBatch({
      operations: [
        {
          kind: 'records',
          propertyId: target.get('id'),
          key: 'children',
          remove: [child.get('id')]
        }
      ]
    })
    propsManager.updateProperties({
      operations: [
        {
          kind: 'records',
          propertyId: peer.get('id'),
          key: 'children',
          remove: [child.get('id')]
        },
        {
          kind: 'records',
          propertyId: replacement.get('id'),
          key: 'children',
          set: {
            [child.get('id')]: {}
          }
        }
      ]
    })

    expect(() =>
      propsManager.applyPreparedPropertyMutationBatch(exchangeablePrepared)
    ).not.toThrow()
    expect(target.save()).toMatchObject({ children: [] })
    expect(peer.save()).toMatchObject({ children: [] })
    expect(replacement.save()).toMatchObject({
      children: ['detached-index-child-id']
    })
    expect(propsManager.getPropertyById(child.get('id'))).toBe(child)
  })

  it('reactivates an exact inactive record during transaction replay', () => {
    const childType = 'replay-record-child'
    const parentType = 'replay-record-parent'
    const ChildComponent = createPropertyComponentFromConfig({
      type: childType,
      defaults: { value: 0 },
      persistKeys: ['value'],
      valueKeys: ['value']
    })
    const parentDefinition = {
      type: parentType,
      defaults: { children: [] as string[] },
      persistKeys: ['children'],
      valueKeys: ['children'],
      children: {
        key: 'children',
        childType,
        mode: 'ids-or-objects' as const,
        collection: 'array-or-record' as const
      }
    }
    registerPropertyComponent(childType, ChildComponent)
    registerPropertyComponent(
      parentType,
      createPropertyComponentFromConfig(parentDefinition),
      undefined,
      parentDefinition
    )
    registerPropertySchema({
      type: childType,
      fields: [
        {
          key: 'value',
          kind: 'number',
          validate: isFiniteNumber,
          defaultValue: 0
        }
      ]
    })
    registerPropertySchema({
      type: parentType,
      fields: [
        {
          key: 'children',
          kind: 'array',
          defaultValue: []
        }
      ]
    })
    const child = createProperty({
      id: 'replay-record-child-id',
      type: childType,
      value: 7
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const parent = createProperty({
      id: 'replay-record-parent-id',
      type: parentType,
      children: [child.get('id')]
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    ;[child, parent].forEach((component) => propsManager.addToMap(component))
    propsManager.cleanChanges()
    propsManager.updateProperties({
      operations: [
        {
          kind: 'records',
          propertyId: parent.get('id'),
          key: 'children',
          remove: [child.get('id')]
        }
      ]
    })
    propsManager.cleanChanges()

    expect(propsManager.getPropertyById(child.get('id'))).toBeUndefined()
    expect(propsManager.getRestoreComponentById(child.get('id'))).toBe(child)

    const result = ReactiveEventsModule.runInTransactionReplayMode('redo', () =>
      propsManager.updateProperties({
        operations: [
          {
            kind: 'records',
            propertyId: parent.get('id'),
            key: 'children',
            set: {
              [child.get('id')]: child.save() as unknown as Record<
                string,
                unknown
              >
            }
          }
        ]
      })
    )

    expect(result.orderedPropertyIds).toEqual([parent.get('id')])
    expect(propsManager.getPropertyById(child.get('id'))).toBe(child)
    expect(
      propsManager.getRestoreComponentById(child.get('id'))
    ).toBeUndefined()
    expect(parent.save()).toMatchObject({ children: [child.get('id')] })
  })

  it('keeps pre-prepared creation roots valid when each adds an edge to the same active child', () => {
    const childType = 'detached-created-edge-child'
    const parentType = 'detached-created-edge-parent'
    const ownerElementType = 'detached-created-edge-element'
    const ChildComponent = createPropertyComponentFromConfig({
      type: childType,
      persistKeys: []
    })
    const parentDefinition = {
      type: parentType,
      defaults: { children: [] as string[] },
      persistKeys: ['children'],
      valueKeys: ['children'],
      children: {
        key: 'children',
        childType,
        mode: 'ids' as const
      }
    }
    registerPropertyComponent(childType, ChildComponent)
    registerPropertyComponent(
      parentType,
      createPropertyComponentFromConfig(parentDefinition),
      undefined,
      parentDefinition
    )
    registerPropertySchema({
      type: childType,
      fields: []
    })
    registerPropertySchema({
      type: parentType,
      fields: [
        {
          key: 'children',
          kind: 'array',
          defaultValue: []
        }
      ]
    })
    elementPropertyRegistry.register(
      {
        name: 'children',
        type: parentType
      },
      ownerElementType
    )
    const child = createProperty({
      id: 'detached-created-edge-child-id',
      type: childType
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    propsManager.addToMap(child)
    propsManager.cleanChanges()
    const prepare = (suffix: string) =>
      propsManager.preparePropertyMutationBatch({
        operations: [
          {
            kind: 'create-exact-property-graph',
            ownerRelations: [
              {
                ownerElementId: `detached-created-edge-owner-${suffix}`,
                ownerElementType,
                ownerPropertyName: 'children',
                componentId: `detached-created-edge-parent-${suffix}`
              }
            ],
            components: [
              {
                id: `detached-created-edge-parent-${suffix}`,
                type: parentType,
                children: [child.get('id')]
              } as PropertyComponentRawData
            ]
          }
        ]
      })
    const firstPrepared = prepare('a')
    const secondPrepared = prepare('b')

    expect(() =>
      propsManager.applyPreparedPropertyMutationBatch(firstPrepared)
    ).not.toThrow()
    expect(() =>
      propsManager.applyPreparedPropertyMutationBatch(secondPrepared)
    ).not.toThrow()
    ;['a', 'b'].forEach((suffix) => {
      expect(
        propsManager
          .getPropertyById(`detached-created-edge-parent-${suffix}`)
          ?.save()
      ).toMatchObject({
        children: ['detached-created-edge-child-id']
      })
    })
    expect(propsManager.getPropertyById(child.get('id'))).toBe(child)
  })

  it('restores detached creation registration and revision when transaction handoff rejects apply', () => {
    const ownerElementType = 'detached-rollback-element'
    const definition: PropertyDefinition = {
      name: PropertyTypes.POSITION,
      type: PropertyTypes.POSITION
    }
    elementPropertyRegistry.register(definition, ownerElementType)
    const prepare = (ownerElementId: string, propertyId: string) =>
      propsManager.preparePropertyMutationBatch({
        operations: [
          {
            kind: 'create-owner-properties',
            ownerElementId,
            ownerElementType,
            definitions: [definition],
            data: {},
            propertyIds: {
              [PropertyTypes.POSITION]: propertyId
            }
          }
        ]
      })
    const rejectedPrepared = prepare(
      'detached-rejected-owner',
      'detached-rejected-position'
    )
    const retainedPrepared = prepare(
      'detached-retained-owner',
      'detached-retained-position'
    )

    expect(() =>
      ReactiveEventsModule.runWithTransactionOwner(
        {
          startTransaction: vi.fn(),
          updateTransactionBatch: vi.fn(() => {
            throw new Error('rejected detached creation handoff')
          }),
          endTransaction: vi.fn(),
          undo: vi.fn(),
          redo: vi.fn()
        },
        () => propsManager.applyPreparedPropertyMutationBatch(rejectedPrepared)
      )
    ).toThrow('rejected detached creation handoff')

    expect(propsManager.save()).toEqual({})
    expect(propsManager.changes).toEqual([])
    expect(() =>
      propsManager.applyPreparedPropertyMutationBatch(rejectedPrepared)
    ).toThrow(/owner-issued one-shot prepared property mutation batch/i)
    expect(() =>
      propsManager.applyPreparedPropertyMutationBatch(retainedPrepared)
    ).not.toThrow()
    expect(
      propsManager.getPropertyById('detached-retained-position')
    ).toBeDefined()
  })

  it('rejects a later invalid active-property update before mutating any prefix or recording evidence', () => {
    const first = createProperty({
      id: 'batch-position-a',
      type: PropertyTypes.POSITION,
      x: 1,
      y: 2,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    }) as PropertyComponentInstanceTypes
    const second = createProperty({
      id: 'batch-position-b',
      type: PropertyTypes.POSITION,
      x: 3,
      y: 4,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    }) as PropertyComponentInstanceTypes
    propsManager.addToMap(first)
    propsManager.addToMap(second)
    const before = propsManager.save()
    const { events, subscription } = captureUpdateTransactionEvents()

    expect(() =>
      propsManager.updateProperties({
        operations: [
          {
            kind: 'values',
            propertyId: 'batch-position-a',
            values: { x: 10 }
          },
          {
            kind: 'values',
            propertyId: 'batch-position-b',
            values: { y: 'invalid' }
          }
        ]
      })
    ).toThrow(/invalid.*batch-position-b\.y/i)

    expect(propsManager.save()).toEqual(before)
    expect(propsManager.changes).toEqual([])
    expect(events).toEqual([])
    subscription.unsubscribe()
  })

  it('applies a detached owner-issued property prepared once with ordered evidence', () => {
    const first = createProperty({
      id: 'prepared-position-a',
      type: PropertyTypes.POSITION,
      x: 1,
      y: 2,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    }) as PropertyComponentInstanceTypes
    const second = createProperty({
      id: 'prepared-position-b',
      type: PropertyTypes.POSITION,
      x: 3,
      y: 4,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    }) as PropertyComponentInstanceTypes
    propsManager.addToMap(first)
    propsManager.addToMap(second)
    const requests = [
      {
        kind: 'values' as const,
        propertyId: 'prepared-position-a',
        values: { x: 10 }
      },
      {
        kind: 'values' as const,
        propertyId: 'prepared-position-b',
        values: { y: 20 }
      }
    ]
    const prepared = propsManager.preparePropertyMutationBatch({
      operations: requests,
      options: { undoable: false }
    })
    const firstRequest = requests[0]
    if (!firstRequest) {
      throw new Error('Expected the first property mutation request')
    }
    firstRequest.values.x = 999
    const { events, subscription } = captureUpdateTransactionEvents()

    expect(prepared.owners).toEqual([
      {
        orderedId: 'prepared-position-a',
        rootPropertyIds: ['prepared-position-a']
      },
      {
        orderedId: 'prepared-position-b',
        rootPropertyIds: ['prepared-position-b']
      }
    ])
    expect(Object.isFrozen(prepared.owners)).toBe(true)
    expect(Object.isFrozen(prepared.owners[0]?.rootPropertyIds)).toBe(true)

    const result = propsManager.applyPreparedPropertyMutationBatch(prepared)

    expect(first.save()).toMatchObject({ x: 10 })
    expect(second.save()).toMatchObject({ y: 20 })
    expect(result.orderedPropertyIds).toEqual([
      'prepared-position-a',
      'prepared-position-b'
    ])
    expect(result.owners).toEqual(prepared.owners)
    expect(result.evidence).toEqual([
      expect.objectContaining({
        id: 'prepared-position-a',
        key: 'x',
        before: 1,
        after: 10
      }),
      expect.objectContaining({
        id: 'prepared-position-b',
        key: 'y',
        before: 4,
        after: 20
      })
    ])
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.evidence)).toBe(true)
    expect(Object.isFrozen(result.evidence[0])).toBe(true)
    expect(events).toHaveLength(2)
    expect(events.map(({ canonicalEvidence }) => canonicalEvidence)).toEqual([
      { orderedIds: ['prepared-position-a'] },
      { orderedIds: ['prepared-position-b'] }
    ])
    expect(events.map(({ options }) => options)).toEqual([
      {
        undoable: false,
        shared: SharedDataChannelNames.PROPS
      },
      {
        undoable: false,
        shared: SharedDataChannelNames.PROPS
      }
    ])
    expect(() =>
      propsManager.applyPreparedPropertyMutationBatch(prepared)
    ).toThrow(/owner-issued one-shot prepared property mutation batch/i)
    expect(() =>
      propsManager.applyPreparedPropertyMutationBatch({
        kind: 'prepared-property-mutation-batch',
        owners: [
          {
            orderedId: 'prepared-position-a',
            rootPropertyIds: ['prepared-position-a']
          }
        ],
        ownerRelations: [],
        orderedPropertyIds: ['prepared-position-a']
      })
    ).toThrow(/owner-issued one-shot prepared property mutation batch/i)
    subscription.unsubscribe()
  })

  it('rejects a property prepared issued by another Props Manager', () => {
    const sourceManager = new PropsManager()
    const otherManager = new PropsManager()
    const position = createProperty({
      id: 'cross-manager-position',
      type: PropertyTypes.POSITION,
      x: 1,
      y: 2,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    }) as PropertyComponentInstanceTypes
    sourceManager.addToMap(position)
    const prepared = sourceManager.preparePropertyMutationBatch({
      operations: [
        {
          kind: 'values',
          propertyId: 'cross-manager-position',
          values: { x: 10 }
        }
      ]
    })

    expect(() =>
      otherManager.applyPreparedPropertyMutationBatch(prepared)
    ).toThrow(/owner-issued one-shot prepared property mutation batch/i)
    expect(position.save()).toMatchObject({ x: 1 })
    sourceManager.dispose()
    otherManager.dispose()
  })

  it('hands one frozen ordered evidence batch to the transaction owner', () => {
    const first = createProperty({
      id: 'owner-batch-position-a',
      type: PropertyTypes.POSITION,
      x: 1,
      y: 2,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    }) as PropertyComponentInstanceTypes
    const second = createProperty({
      id: 'owner-batch-position-b',
      type: PropertyTypes.POSITION,
      x: 3,
      y: 4,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    }) as PropertyComponentInstanceTypes
    propsManager.addToMap(first)
    propsManager.addToMap(second)
    const updateTransactionBatch = vi.fn()

    ReactiveEventsModule.runWithTransactionOwner(
      {
        startTransaction: vi.fn(),
        updateTransactionBatch,
        endTransaction: vi.fn(),
        undo: vi.fn(),
        redo: vi.fn()
      },
      () =>
        propsManager.updateProperties({
          operations: [
            {
              kind: 'values',
              propertyId: 'owner-batch-position-a',
              values: { x: 10 }
            },
            {
              kind: 'values',
              propertyId: 'owner-batch-position-b',
              values: { y: 20 }
            }
          ]
        })
    )

    expect(updateTransactionBatch).toHaveBeenCalledTimes(1)
    const ownerBatch = updateTransactionBatch.mock.calls[0]?.[0] as
      | readonly UpdateTransactionEvent[]
      | undefined
    expect(ownerBatch).toHaveLength(2)
    expect(ownerBatch?.map(({ eventName }) => eventName)).toEqual([
      ReactiveEventsModule.EventTypes.UPDATE_PROPERTY,
      ReactiveEventsModule.EventTypes.UPDATE_PROPERTY
    ])
    expect(
      ownerBatch?.map(({ canonicalEvidence }) => canonicalEvidence)
    ).toEqual([
      { orderedIds: ['owner-batch-position-a'] },
      { orderedIds: ['owner-batch-position-b'] }
    ])
    expect(Object.isFrozen(ownerBatch)).toBe(true)
    expect(ownerBatch?.every((event) => Object.isFrozen(event))).toBe(true)
  })

  it('hands a complete replace-latest History candidate alongside effective property evidence', () => {
    const position = createProperty({
      id: 'staged-history-position',
      type: PropertyTypes.POSITION,
      x: 10,
      y: 2,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    }) as PropertyComponentInstanceTypes
    propsManager.addToMap(position)
    const updateTransactionBatch = vi.fn()

    ReactiveEventsModule.runWithTransactionOwner(
      {
        startTransaction: vi.fn(),
        updateTransactionBatch,
        endTransaction: vi.fn(),
        undo: vi.fn(),
        redo: vi.fn()
      },
      () =>
        propsManager.updateProperties({
          operations: [
            {
              kind: 'values',
              propertyId: 'staged-history-position',
              values: { x: 10, y: 25 }
            }
          ],
          options: {
            history: {
              mode: 'replace-latest',
              key: 'move-session'
            }
          }
        })
    )

    const ownerBatch = updateTransactionBatch.mock.calls[0]?.[0] as
      | readonly UpdateTransactionEvent[]
      | undefined
    expect(ownerBatch).toHaveLength(1)
    expect(ownerBatch?.[0]?.payload).toMatchObject({
      id: 'staged-history-position',
      key: 'y',
      before: 2,
      after: 25
    })
    expect(
      ownerBatch?.[0]?.historyCandidate?.events.map(({ payload }) => payload)
    ).toEqual([
      expect.objectContaining({
        id: 'staged-history-position',
        key: 'x',
        before: 10,
        after: 10
      }),
      expect.objectContaining({
        id: 'staged-history-position',
        key: 'y',
        before: 2,
        after: 25
      })
    ])
    expect(ownerBatch?.[0]?.historyCandidate?.key).toBe('move-session')
    expect(ownerBatch?.[0]?.historyCandidate?.eventKeys).toEqual([
      JSON.stringify([
        ReactiveEventsModule.EventTypes.UPDATE_PROPERTY,
        'staged-history-position',
        'x'
      ]),
      JSON.stringify([
        ReactiveEventsModule.EventTypes.UPDATE_PROPERTY,
        'staged-history-position',
        'y'
      ])
    ])
    expect(Object.isFrozen(ownerBatch?.[0]?.historyCandidate)).toBe(true)
    expect(Object.isFrozen(ownerBatch?.[0]?.historyCandidate?.events)).toBe(
      true
    )
  })

  it('hands stable existing record fields to Factory as a replace-latest History candidate', () => {
    const type = 'replace-latest-record'
    registerRecursivePropertyType(type)
    const child = createProperty({
      id: 'replace-latest-record-child',
      type,
      children: [],
      value: 1
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const parent = createProperty({
      id: 'replace-latest-record-parent',
      type,
      children: [child.get('id')],
      value: 0
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    propsManager.addToMap(child)
    propsManager.addToMap(parent)
    propsManager.cleanChanges()
    const updateTransactionBatch = vi.fn()

    ReactiveEventsModule.runWithTransactionOwner(
      {
        startTransaction: vi.fn(),
        updateTransactionBatch,
        endTransaction: vi.fn(),
        undo: vi.fn(),
        redo: vi.fn()
      },
      () =>
        propsManager.updateProperties({
          operations: [
            {
              kind: 'records',
              propertyId: parent.get('id'),
              key: 'children',
              set: {
                [child.get('id')]: { value: 2 }
              }
            }
          ],
          options: {
            history: {
              mode: 'replace-latest',
              key: 'record-drag'
            }
          }
        })
    )

    const ownerBatch = updateTransactionBatch.mock.calls[0]?.[0] as
      | readonly UpdateTransactionEvent[]
      | undefined
    expect(ownerBatch).toHaveLength(1)
    expect(ownerBatch?.[0]?.payload).toMatchObject({
      id: child.get('id'),
      key: 'value',
      before: 1,
      after: 2
    })
    expect(ownerBatch?.[0]?.historyCandidate).toMatchObject({
      key: 'record-drag',
      eventKeys: [
        JSON.stringify([
          ReactiveEventsModule.EventTypes.UPDATE_PROPERTY,
          child.get('id'),
          'value'
        ])
      ],
      events: [
        expect.objectContaining({
          payload: expect.objectContaining({
            id: child.get('id'),
            key: 'value',
            before: 1,
            after: 2
          })
        })
      ]
    })
  })

  it('passes record lifecycle History options to Factory without deciding replace-latest support', () => {
    const type = 'replace-latest-record-lifecycle'
    registerRecursivePropertyType(type)
    const child = createProperty({
      id: 'replace-latest-lifecycle-child',
      type,
      children: [],
      value: 1
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const parent = createProperty({
      id: 'replace-latest-lifecycle-parent',
      type,
      children: [child.get('id')],
      value: 0
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    propsManager.addToMap(child)
    propsManager.addToMap(parent)
    propsManager.cleanChanges()
    const updateTransactionBatch = vi.fn()

    expect(() =>
      ReactiveEventsModule.runWithTransactionOwner(
        {
          startTransaction: vi.fn(),
          updateTransactionBatch,
          endTransaction: vi.fn(),
          undo: vi.fn(),
          redo: vi.fn()
        },
        () =>
          propsManager.updateProperties({
            operations: [
              {
                kind: 'records',
                propertyId: parent.get('id'),
                key: 'children',
                remove: [child.get('id')]
              }
            ],
            options: {
              history: {
                mode: 'replace-latest',
                key: 'record-lifecycle'
              }
            }
          })
      )
    ).not.toThrow()

    const ownerBatch = updateTransactionBatch.mock.calls[0]?.[0] as
      | readonly UpdateTransactionEvent[]
      | undefined
    expect(ownerBatch?.length).toBeGreaterThan(0)
    expect(
      ownerBatch?.every(
        (event) =>
          event.options?.history?.mode === 'replace-latest' &&
          event.options.history.key === 'record-lifecycle'
      )
    ).toBe(true)
    expect(ownerBatch?.every((event) => !event.historyCandidate)).toBe(true)
  })

  it('does not snapshot unrelated registry entries for a property value batch', () => {
    const touched = createProperty({
      id: 'touched-position',
      type: PropertyTypes.POSITION,
      x: 1,
      y: 2,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    }) as PropertyComponentInstanceTypes
    const unrelated = createProperty({
      id: 'unrelated-position',
      type: PropertyTypes.POSITION,
      x: 3,
      y: 4,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    }) as PropertyComponentInstanceTypes
    propsManager.addToMap(touched)
    propsManager.addToMap(unrelated)
    const unrelatedSave = vi.fn(unrelated.save.bind(unrelated))
    unrelated.save = unrelatedSave

    propsManager.updateProperties({
      operations: [
        {
          kind: 'values',
          propertyId: 'touched-position',
          values: { x: 10 }
        }
      ]
    })

    expect(touched.save()).toMatchObject({ x: 10 })
    expect(unrelatedSave).not.toHaveBeenCalled()
  })

  it('rejects a canonical property batch while legacy scalar evidence is pending', () => {
    const pending = createProperty({
      id: 'pending-position',
      type: PropertyTypes.POSITION,
      x: 1,
      y: 2,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    }) as PropertyComponentInstanceTypes
    const applied = createProperty({
      id: 'applied-position',
      type: PropertyTypes.POSITION,
      x: 3,
      y: 4,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    }) as PropertyComponentInstanceTypes
    propsManager.addToMap(pending)
    propsManager.addToMap(applied)
    propsManager.updatePropsData('pending-position', 'x', 5)
    const pendingEvidence = [...propsManager.changes]

    expect(() =>
      propsManager.updateProperties({
        operations: [
          {
            kind: 'values',
            propertyId: 'applied-position',
            values: { y: 10 }
          }
        ]
      })
    ).toThrow(/pending.*property evidence/i)

    expect(propsManager.changes).toEqual(pendingEvidence)
    expect(pending.save()).toMatchObject({ x: 5 })
    expect(applied.save()).toMatchObject({ y: 4 })
  })

  it('treats an empty property request as an empty valid batch', () => {
    const before = propsManager.save()
    const { events, subscription } = captureUpdateTransactionEvents()

    const result = propsManager.updateProperties({ operations: [] })

    expect(result).toEqual({
      owners: [],
      ownerRelations: [],
      orderedPropertyIds: [],
      evidence: []
    })
    expect(Object.isFrozen(result)).toBe(true)
    expect(propsManager.save()).toEqual(before)
    expect(propsManager.changes).toEqual([])
    expect(events).toEqual([])
    subscription.unsubscribe()
  })

  it('rejects an initiating element owner on a property-source mutation', () => {
    const position = createProperty({
      id: 'source-owned-position',
      type: PropertyTypes.POSITION,
      x: 1,
      y: 2,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    }) as PropertyComponentInstanceTypes
    propsManager.addToMap(position)

    expect(() =>
      propsManager.updateProperties({
        operations: [
          {
            kind: 'values',
            propertyId: 'source-owned-position',
            values: { x: 10 },
            owner: {
              ownerElementId: 'initiating-element',
              ownerPropertyName: 'position'
            }
          }
        ]
      } as unknown as PropertyMutationBatchRequest)
    ).toThrow(/initiating owner|property-source/i)

    expect(position.save()).toMatchObject({ x: 1 })
    expect(propsManager.changes).toEqual([])

    expect(() =>
      propsManager.addChange({
        action: PROPS_ACTIONS.UPDATE_PROPERTY,
        eventName: ReactiveEventsModule.EventTypes.UPDATE_PROPERTY,
        id: 'source-owned-position',
        key: 'x',
        before: 1,
        after: 10,
        ownerElementId: 'initiating-element',
        ownerPropertyName: 'position'
      } as unknown as PropsChange)
    ).toThrow(/initiating owner|property-source/i)
    expect(propsManager.changes).toEqual([])
  })

  it('rejects legacy top-level owner fields on value and record source mutations', () => {
    const position = createProperty({
      id: 'legacy-owner-position',
      type: PropertyTypes.POSITION,
      x: 1,
      y: 2,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    }) as PropertyComponentInstanceTypes
    const relationType = 'legacy-owner-record'
    registerRecursivePropertyType(relationType)
    const record = createProperty({
      id: 'legacy-owner-record-root',
      type: relationType,
      children: [],
      value: 1
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    propsManager.addToMap(position)
    propsManager.addToMap(record)
    propsManager.cleanChanges()

    expect(() =>
      propsManager.updateProperties({
        operations: [
          {
            kind: 'values',
            propertyId: 'legacy-owner-position',
            values: { x: 10 },
            ownerElementId: 'legacy-value-owner'
          }
        ]
      } as unknown as PropertyMutationBatchRequest)
    ).toThrow(/initiating owner|property-source/i)
    expect(() =>
      propsManager.updateProperties({
        operations: [
          {
            kind: 'records',
            propertyId: 'legacy-owner-record-root',
            key: 'children',
            values: { value: 10 },
            ownerPropertyName: 'children'
          }
        ]
      } as unknown as PropertyMutationBatchRequest)
    ).toThrow(/initiating owner|property-source/i)

    expect(position.save()).toMatchObject({ x: 1 })
    expect(record.save()).toMatchObject({ value: 1 })
    expect(propsManager.changes).toEqual([])
  })

  it('removes exact orphan roots through one fixed property-graph mutation', () => {
    const first = createProperty({
      id: 'exact-orphan-position-a',
      type: PropertyTypes.POSITION,
      x: 1,
      y: 2,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    }) as PropertyComponentInstanceTypes
    const second = createProperty({
      id: 'exact-orphan-position-b',
      type: PropertyTypes.POSITION,
      x: 3,
      y: 4,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    }) as PropertyComponentInstanceTypes
    propsManager.addToMap(first)
    propsManager.addToMap(second)
    propsManager.cleanChanges()
    const { events, subscription } = captureUpdateTransactionEvents()

    const result = propsManager.updateProperties({
      operations: [
        {
          kind: 'remove-exact-orphan-property-graphs',
          orphanRootPropertyIds: [
            'exact-orphan-position-a',
            'exact-orphan-position-b'
          ],
          retainedRootPropertyIds: []
        }
      ]
    } as PropertyMutationBatchRequest)

    expect(
      propsManager.getPropertyById('exact-orphan-position-a')
    ).toBeUndefined()
    expect(
      propsManager.getPropertyById('exact-orphan-position-b')
    ).toBeUndefined()
    expect(result.evidence).toEqual([
      expect.objectContaining({
        action: PROPS_ACTIONS.REMOVE_PROPERTY,
        data: [
          expect.objectContaining({ id: 'exact-orphan-position-a' }),
          expect.objectContaining({ id: 'exact-orphan-position-b' })
        ]
      })
    ])
    expect(events).toHaveLength(1)
    subscription.unsubscribe()
  })

  it('requires an explicit retained-root set for exact orphan removal', () => {
    const root = createProperty({
      id: 'missing-retained-set-root',
      type: PropertyTypes.POSITION
    }) as PropertyComponentInstanceTypes
    propsManager.addToMap(root)
    propsManager.cleanChanges()

    expect(() =>
      propsManager.preparePropertyMutationBatch({
        operations: [
          {
            kind: 'remove-exact-orphan-property-graphs',
            orphanRootPropertyIds: ['missing-retained-set-root']
          }
        ]
      } as unknown as PropertyMutationBatchRequest)
    ).toThrow(/retained.*root|root-id set/i)

    expect(propsManager.getPropertyById('missing-retained-set-root')).toBe(root)
    expect(propsManager.changes).toEqual([])
  })

  it('stops exact orphan traversal at an explicitly retained nested shared root', () => {
    const type = 'explicit-retained-nested-root'
    registerRecursivePropertyType(type)
    const grandchild = createProperty({
      id: 'explicit-retained-grandchild',
      type,
      children: []
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const retainedRoot = createProperty({
      id: 'explicit-retained-root',
      type,
      children: ['explicit-retained-grandchild']
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const orphanRoot = createProperty({
      id: 'explicit-retained-orphan-root',
      type,
      children: ['explicit-retained-root']
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    ;[grandchild, retainedRoot, orphanRoot].forEach((component) =>
      propsManager.addToMap(component)
    )
    propsManager.cleanChanges()

    const firstResult = propsManager.updateProperties({
      operations: [
        {
          kind: 'remove-exact-orphan-property-graphs',
          orphanRootPropertyIds: ['explicit-retained-orphan-root'],
          retainedRootPropertyIds: ['explicit-retained-root']
        }
      ]
    } as PropertyMutationBatchRequest)

    expect(
      propsManager.getPropertyById('explicit-retained-orphan-root')
    ).toBeUndefined()
    expect(propsManager.getPropertyById('explicit-retained-root')).toBe(
      retainedRoot
    )
    expect(propsManager.getPropertyById('explicit-retained-grandchild')).toBe(
      grandchild
    )
    expect(
      (firstResult.evidence[0] as AddRemovePropertyChange).data.map(
        ({ id }) => id
      )
    ).toEqual(['explicit-retained-orphan-root'])

    propsManager.updateProperties({
      operations: [
        {
          kind: 'remove-exact-orphan-property-graphs',
          orphanRootPropertyIds: ['explicit-retained-root'],
          retainedRootPropertyIds: []
        }
      ]
    } as PropertyMutationBatchRequest)

    expect(
      propsManager.getPropertyById('explicit-retained-root')
    ).toBeUndefined()
    expect(
      propsManager.getPropertyById('explicit-retained-grandchild')
    ).toBeUndefined()
  })

  it('rejects duplicate, overlapping, or missing retained root IDs', () => {
    const orphan = createProperty({
      id: 'invalid-retained-orphan',
      type: PropertyTypes.POSITION
    }) as PropertyComponentInstanceTypes
    const retained = createProperty({
      id: 'invalid-retained-active',
      type: PropertyTypes.POSITION
    }) as PropertyComponentInstanceTypes
    propsManager.addToMap(orphan)
    propsManager.addToMap(retained)
    propsManager.cleanChanges()

    expect(() =>
      propsManager.preparePropertyMutationBatch({
        operations: [
          {
            kind: 'remove-exact-orphan-property-graphs',
            orphanRootPropertyIds: ['invalid-retained-orphan'],
            retainedRootPropertyIds: [
              'invalid-retained-active',
              'invalid-retained-active'
            ]
          }
        ]
      } as PropertyMutationBatchRequest)
    ).toThrow(/deduplicated|duplicate/i)
    expect(() =>
      propsManager.preparePropertyMutationBatch({
        operations: [
          {
            kind: 'remove-exact-orphan-property-graphs',
            orphanRootPropertyIds: ['invalid-retained-orphan'],
            retainedRootPropertyIds: ['invalid-retained-orphan']
          }
        ]
      } as PropertyMutationBatchRequest)
    ).toThrow(/overlap|disjoint/i)
    expect(() =>
      propsManager.preparePropertyMutationBatch({
        operations: [
          {
            kind: 'remove-exact-orphan-property-graphs',
            orphanRootPropertyIds: ['invalid-retained-orphan'],
            retainedRootPropertyIds: ['missing-retained-root']
          }
        ]
      } as PropertyMutationBatchRequest)
    ).toThrow(/missing.*retained|active retained/i)

    expect(propsManager.getPropertyById('invalid-retained-orphan')).toBe(orphan)
    expect(propsManager.getPropertyById('invalid-retained-active')).toBe(
      retained
    )
    expect(propsManager.changes).toEqual([])
  })

  it('detaches retained-root input from caller mutation', () => {
    const type = 'detached-retained-root-input'
    registerRecursivePropertyType(type)
    const retainedRoot = createProperty({
      id: 'detached-retained-root',
      type,
      children: []
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const orphanRoot = createProperty({
      id: 'detached-retained-orphan',
      type,
      children: ['detached-retained-root']
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    propsManager.addToMap(retainedRoot)
    propsManager.addToMap(orphanRoot)
    propsManager.cleanChanges()
    const orphanRootPropertyIds = ['detached-retained-orphan']
    const retainedRootPropertyIds = ['detached-retained-root']
    const prepared = propsManager.preparePropertyMutationBatch({
      operations: [
        {
          kind: 'remove-exact-orphan-property-graphs',
          orphanRootPropertyIds,
          retainedRootPropertyIds
        }
      ]
    } as PropertyMutationBatchRequest)
    orphanRootPropertyIds[0] = 'caller-mutated-orphan'
    retainedRootPropertyIds[0] = 'caller-mutated-retained'

    propsManager.applyPreparedPropertyMutationBatch(prepared)

    expect(
      propsManager.getPropertyById('detached-retained-orphan')
    ).toBeUndefined()
    expect(propsManager.getPropertyById('detached-retained-root')).toBe(
      retainedRoot
    )
    expect(Object.isFrozen(prepared)).toBe(true)
    expect(propsManager.changes).toEqual([])
  })

  it('rejects retained-root identity drift before apply mutates an orphan', () => {
    const type = 'stale-retained-root-identity'
    registerRecursivePropertyType(type)
    const retainedRoot = createProperty({
      id: 'stale-retained-root',
      type,
      children: []
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const orphanRoot = createProperty({
      id: 'stale-retained-orphan',
      type,
      children: ['stale-retained-root']
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    propsManager.addToMap(retainedRoot)
    propsManager.addToMap(orphanRoot)
    propsManager.cleanChanges()
    const prepared = propsManager.preparePropertyMutationBatch({
      operations: [
        {
          kind: 'remove-exact-orphan-property-graphs',
          orphanRootPropertyIds: ['stale-retained-orphan'],
          retainedRootPropertyIds: ['stale-retained-root']
        }
      ]
    } as PropertyMutationBatchRequest)
    const replacement = createProperty({
      id: 'stale-retained-root',
      type,
      children: []
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    propsManager._components.set('stale-retained-root', replacement)

    expect(() =>
      propsManager.applyPreparedPropertyMutationBatch(prepared)
    ).toThrow(/no longer matches active state|retained.*identity/i)
    expect(propsManager.getPropertyById('stale-retained-orphan')).toBe(
      orphanRoot
    )
    expect(propsManager.getPropertyById('stale-retained-root')).toBe(
      replacement
    )
    expect(propsManager.changes).toEqual([])
  })

  it('removes two orphan roots without traversing their shared retained root', () => {
    const type = 'shared-retained-root-boundary'
    registerRecursivePropertyType(type)
    const grandchild = createProperty({
      id: 'shared-retained-grandchild',
      type,
      children: []
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const retainedRoot = createProperty({
      id: 'shared-retained-root',
      type,
      children: ['shared-retained-grandchild']
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const firstOrphan = createProperty({
      id: 'shared-retained-orphan-a',
      type,
      children: ['shared-retained-root']
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const secondOrphan = createProperty({
      id: 'shared-retained-orphan-b',
      type,
      children: ['shared-retained-root']
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    ;[grandchild, retainedRoot, firstOrphan, secondOrphan].forEach(
      (component) => propsManager.addToMap(component)
    )
    propsManager.cleanChanges()

    const result = propsManager.updateProperties({
      operations: [
        {
          kind: 'remove-exact-orphan-property-graphs',
          orphanRootPropertyIds: [
            'shared-retained-orphan-a',
            'shared-retained-orphan-b'
          ],
          retainedRootPropertyIds: ['shared-retained-root']
        }
      ]
    })

    expect(
      (result.evidence[0] as AddRemovePropertyChange).data.map(({ id }) => id)
    ).toEqual(['shared-retained-orphan-a', 'shared-retained-orphan-b'])
    expect(propsManager.getPropertyById('shared-retained-root')).toBe(
      retainedRoot
    )
    expect(propsManager.getPropertyById('shared-retained-grandchild')).toBe(
      grandchild
    )
  })

  it('does not traverse a retained subtree cycle while removing its orphan owner', () => {
    const type = 'retained-subtree-cycle-boundary'
    registerRecursivePropertyType(type)
    const retainedRoot = createProperty({
      id: 'retained-cycle-root',
      type,
      children: ['retained-cycle-child']
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const retainedChild = createProperty({
      id: 'retained-cycle-child',
      type,
      children: ['retained-cycle-root']
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const orphanRoot = createProperty({
      id: 'retained-cycle-orphan',
      type,
      children: ['retained-cycle-root']
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    ;[retainedRoot, retainedChild, orphanRoot].forEach((component) =>
      propsManager.addToMap(component)
    )
    propsManager.cleanChanges()

    expect(() =>
      propsManager.updateProperties({
        operations: [
          {
            kind: 'remove-exact-orphan-property-graphs',
            orphanRootPropertyIds: ['retained-cycle-orphan'],
            retainedRootPropertyIds: ['retained-cycle-root']
          }
        ]
      })
    ).not.toThrow()

    expect(
      propsManager.getPropertyById('retained-cycle-orphan')
    ).toBeUndefined()
    expect(propsManager.getPropertyById('retained-cycle-root')).toBe(
      retainedRoot
    )
    expect(propsManager.getPropertyById('retained-cycle-child')).toBe(
      retainedChild
    )
  })

  it('uses retained-root identity without snapshotting or staling on data-only changes', () => {
    const type = 'retained-root-identity-only-read'
    registerRecursivePropertyType(type)
    const retainedRoot = createProperty({
      id: 'identity-only-retained-root',
      type,
      children: [],
      value: 1
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const orphanRoot = createProperty({
      id: 'identity-only-orphan-root',
      type,
      children: ['identity-only-retained-root']
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    propsManager.addToMap(retainedRoot)
    propsManager.addToMap(orphanRoot)
    propsManager.cleanChanges()
    const retainedSave = vi.spyOn(retainedRoot, 'save')
    const prepared = propsManager.preparePropertyMutationBatch({
      operations: [
        {
          kind: 'remove-exact-orphan-property-graphs',
          orphanRootPropertyIds: ['identity-only-orphan-root'],
          retainedRootPropertyIds: ['identity-only-retained-root']
        }
      ]
    })

    expect(retainedSave).not.toHaveBeenCalled()
    retainedRoot.load({
      id: 'identity-only-retained-root',
      type,
      children: [],
      value: 42
    })

    expect(() =>
      propsManager.applyPreparedPropertyMutationBatch(prepared)
    ).not.toThrow()
    expect(
      propsManager.getPropertyById('identity-only-orphan-root')
    ).toBeUndefined()
    expect(propsManager.getPropertyById('identity-only-retained-root')).toBe(
      retainedRoot
    )
    expect(
      (
        retainedRoot as unknown as {
          get(key: string): unknown
        }
      ).get('value')
    ).toBe(42)
    expect(retainedSave).not.toHaveBeenCalled()
  })

  it('reads a retained external property parent without snapshotting or staling its data-only changes', () => {
    const type = 'retained-external-parent-identity-read'
    registerRecursivePropertyType(type)
    const orphanRoot = createProperty({
      id: 'retained-parent-orphan-root',
      type,
      children: []
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const retainedParent = createProperty({
      id: 'retained-external-parent',
      type,
      children: ['retained-parent-orphan-root'],
      value: 1
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    propsManager.addToMap(orphanRoot)
    propsManager.addToMap(retainedParent)
    propsManager.cleanChanges()
    const retainedSave = vi.spyOn(retainedParent, 'save')
    const prepared = propsManager.preparePropertyMutationBatch({
      operations: [
        {
          kind: 'remove-exact-orphan-property-graphs',
          orphanRootPropertyIds: ['retained-parent-orphan-root'],
          retainedRootPropertyIds: ['retained-external-parent']
        }
      ]
    })

    expect(retainedSave).not.toHaveBeenCalled()
    retainedParent.load({
      id: 'retained-external-parent',
      type,
      children: ['retained-parent-orphan-root'],
      value: 42
    })

    const result = propsManager.applyPreparedPropertyMutationBatch(prepared)

    expect(result.evidence).toEqual([])
    expect(propsManager.getPropertyById('retained-parent-orphan-root')).toBe(
      orphanRoot
    )
    expect(propsManager.getPropertyById('retained-external-parent')).toBe(
      retainedParent
    )
    expect(
      (
        retainedParent as unknown as {
          get(key: string): unknown
        }
      ).get('value')
    ).toBe(42)
    expect(retainedSave).not.toHaveBeenCalled()
  })

  it('rejects retained external parent relationship data drift before apply', () => {
    const type = 'retained-external-parent-relation-drift'
    registerRecursivePropertyType(type)
    const orphanRoot = createProperty({
      id: 'relation-drift-orphan-root',
      type,
      children: []
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const retainedParent = createProperty({
      id: 'relation-drift-retained-parent',
      type,
      children: ['relation-drift-orphan-root']
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    propsManager.addToMap(orphanRoot)
    propsManager.addToMap(retainedParent)
    propsManager.cleanChanges()
    const prepared = propsManager.preparePropertyMutationBatch({
      operations: [
        {
          kind: 'remove-exact-orphan-property-graphs',
          orphanRootPropertyIds: ['relation-drift-orphan-root'],
          retainedRootPropertyIds: ['relation-drift-retained-parent']
        }
      ]
    })
    retainedParent.load({
      id: 'relation-drift-retained-parent',
      type,
      children: []
    })

    expect(() =>
      propsManager.applyPreparedPropertyMutationBatch(prepared)
    ).toThrow(/no longer matches active state/i)
    expect(propsManager.getPropertyById('relation-drift-orphan-root')).toBe(
      orphanRoot
    )
    expect(propsManager.getPropertyById('relation-drift-retained-parent')).toBe(
      retainedParent
    )
    expect(propsManager.changes).toEqual([])
  })

  it('rejects retained external parent relationship index drift before apply', () => {
    const type = 'retained-external-parent-index-drift'
    registerRecursivePropertyType(type)
    const orphanRoot = createProperty({
      id: 'index-drift-orphan-root',
      type,
      children: []
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const retainedParent = createProperty({
      id: 'index-drift-retained-parent',
      type,
      children: ['index-drift-orphan-root']
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    propsManager.addToMap(orphanRoot)
    propsManager.addToMap(retainedParent)
    propsManager.cleanChanges()
    const prepared = propsManager.preparePropertyMutationBatch({
      operations: [
        {
          kind: 'remove-exact-orphan-property-graphs',
          orphanRootPropertyIds: ['index-drift-orphan-root'],
          retainedRootPropertyIds: ['index-drift-retained-parent']
        }
      ]
    })
    ;(
      propsManager as unknown as {
        relationshipChildIdsByOwnerId: Map<string, readonly string[]>
      }
    ).relationshipChildIdsByOwnerId.set('index-drift-retained-parent', [])

    expect(() =>
      propsManager.applyPreparedPropertyMutationBatch(prepared)
    ).toThrow(/no longer matches active state/i)
    expect(propsManager.getPropertyById('index-drift-orphan-root')).toBe(
      orphanRoot
    )
    expect(propsManager.getPropertyById('index-drift-retained-parent')).toBe(
      retainedParent
    )
    expect(propsManager.changes).toEqual([])
  })

  it('rejects a retained-root removal before apply mutates an orphan', () => {
    const type = 'removed-retained-root-identity'
    registerRecursivePropertyType(type)
    const retainedRoot = createProperty({
      id: 'removed-retained-root',
      type,
      children: []
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const orphanRoot = createProperty({
      id: 'removed-retained-orphan',
      type,
      children: ['removed-retained-root']
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    propsManager.addToMap(retainedRoot)
    propsManager.addToMap(orphanRoot)
    propsManager.cleanChanges()
    const prepared = propsManager.preparePropertyMutationBatch({
      operations: [
        {
          kind: 'remove-exact-orphan-property-graphs',
          orphanRootPropertyIds: ['removed-retained-orphan'],
          retainedRootPropertyIds: ['removed-retained-root']
        }
      ]
    })
    propsManager._components.delete('removed-retained-root')

    expect(() =>
      propsManager.applyPreparedPropertyMutationBatch(prepared)
    ).toThrow(/no longer matches active state|retained.*identity/i)
    expect(propsManager.getPropertyById('removed-retained-orphan')).toBe(
      orphanRoot
    )
    expect(propsManager.changes).toEqual([])
  })

  it('removes two orphan roots and their shared descendant exactly once', () => {
    const type = 'exact-orphan-shared-graph'
    registerRecursivePropertyType(type)
    const shared = createProperty({
      id: 'exact-orphan-shared-child',
      type,
      children: [],
      value: 3
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const firstRoot = createProperty({
      id: 'exact-orphan-shared-root-a',
      type,
      children: ['exact-orphan-shared-child'],
      value: 1
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const secondRoot = createProperty({
      id: 'exact-orphan-shared-root-b',
      type,
      children: ['exact-orphan-shared-child'],
      value: 2
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    ;[shared, firstRoot, secondRoot].forEach((component) =>
      propsManager.addToMap(component)
    )
    propsManager.cleanChanges()

    const result = propsManager.updateProperties({
      operations: [
        {
          kind: 'remove-exact-orphan-property-graphs',
          orphanRootPropertyIds: [
            'exact-orphan-shared-root-a',
            'exact-orphan-shared-root-b'
          ],
          retainedRootPropertyIds: []
        }
      ]
    })

    expect(
      propsManager.getPropertyById('exact-orphan-shared-root-a')
    ).toBeUndefined()
    expect(
      propsManager.getPropertyById('exact-orphan-shared-root-b')
    ).toBeUndefined()
    expect(
      propsManager.getPropertyById('exact-orphan-shared-child')
    ).toBeUndefined()
    expect(result.evidence).toHaveLength(1)
    const removed = (result.evidence[0] as AddRemovePropertyChange).data.map(
      ({ id }) => id
    )
    expect(removed).toEqual([
      'exact-orphan-shared-root-a',
      'exact-orphan-shared-root-b',
      'exact-orphan-shared-child'
    ])
    expect(new Set(removed).size).toBe(removed.length)
  })

  it('retains an exact orphan root graph while a property owner still references it', () => {
    const type = 'exact-orphan-retained-graph'
    registerRecursivePropertyType(type)
    const leaf = createProperty({
      id: 'exact-orphan-retained-leaf',
      type,
      children: []
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const root = createProperty({
      id: 'exact-orphan-retained-root',
      type,
      children: ['exact-orphan-retained-leaf']
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const propertyOwner = createProperty({
      id: 'exact-orphan-retaining-owner',
      type,
      children: ['exact-orphan-retained-root']
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    ;[leaf, root, propertyOwner].forEach((component) =>
      propsManager.addToMap(component)
    )
    propsManager.cleanChanges()

    const result = propsManager.updateProperties({
      operations: [
        {
          kind: 'remove-exact-orphan-property-graphs',
          orphanRootPropertyIds: ['exact-orphan-retained-root'],
          retainedRootPropertyIds: []
        }
      ]
    })

    expect(propsManager.getPropertyById('exact-orphan-retained-root')).toBe(
      root
    )
    expect(propsManager.getPropertyById('exact-orphan-retained-leaf')).toBe(
      leaf
    )
    expect(result.evidence).toEqual([])
  })

  it('rejects an exact orphan prepared when an affected forward edge is missing from the reverse index', () => {
    const type = 'exact-orphan-inconsistent-external-owner'
    registerRecursivePropertyType(type)
    const leaf = createProperty({
      id: 'inconsistent-external-leaf',
      type,
      children: []
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const root = createProperty({
      id: 'inconsistent-external-root',
      type,
      children: ['inconsistent-external-leaf']
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const externalOwner = createProperty({
      id: 'inconsistent-external-owner',
      type,
      children: ['inconsistent-external-root']
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    ;[leaf, root, externalOwner].forEach((component) =>
      propsManager.addToMap(component)
    )
    propsManager.cleanChanges()
    const reverseIndex = (
      propsManager as unknown as {
        relationshipOwnerIdsByChildId: Map<string, Set<string>>
      }
    ).relationshipOwnerIdsByChildId
    reverseIndex
      .get('inconsistent-external-root')
      ?.delete('inconsistent-external-owner')
    const before = propsManager.save()

    expect(() =>
      propsManager.preparePropertyMutationBatch({
        operations: [
          {
            kind: 'remove-exact-orphan-property-graphs',
            orphanRootPropertyIds: ['inconsistent-external-root'],
            retainedRootPropertyIds: []
          }
        ]
      })
    ).toThrow(/inconsistent.*relationship|reverse/i)

    expect(propsManager.save()).toEqual(before)
    expect(propsManager.changes).toEqual([])
  })

  it('propagates exact graph closure through a node visited first by a non-exact mutation', () => {
    const type = 'exact-orphan-upgraded-graph-closure'
    registerRecursivePropertyType(type)
    const grandchild = createProperty({
      id: 'upgraded-closure-grandchild',
      type,
      children: []
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const descendant = createProperty({
      id: 'upgraded-closure-descendant',
      type,
      children: ['upgraded-closure-grandchild']
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const root = createProperty({
      id: 'upgraded-closure-root',
      type,
      children: ['upgraded-closure-descendant']
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const externalOwner = createProperty({
      id: 'upgraded-closure-external-owner',
      type,
      children: ['upgraded-closure-grandchild']
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    ;[grandchild, descendant, root, externalOwner].forEach((component) =>
      propsManager.addToMap(component)
    )
    propsManager.cleanChanges()
    const reverseIndex = (
      propsManager as unknown as {
        relationshipOwnerIdsByChildId: Map<string, Set<string>>
      }
    ).relationshipOwnerIdsByChildId
    reverseIndex
      .get('upgraded-closure-grandchild')
      ?.delete('upgraded-closure-external-owner')
    const before = propsManager.save()

    expect(() =>
      propsManager.preparePropertyMutationBatch({
        operations: [
          {
            kind: 'records',
            propertyId: 'upgraded-closure-descendant',
            key: 'children',
            values: { value: 10 }
          },
          {
            kind: 'remove-exact-orphan-property-graphs',
            orphanRootPropertyIds: ['upgraded-closure-root'],
            retainedRootPropertyIds: []
          }
        ]
      })
    ).toThrow(/inconsistent.*relationship|reverse/i)

    expect(propsManager.save()).toEqual(before)
    expect(propsManager.changes).toEqual([])
  })

  it('ignores an unrelated graph inconsistency while removing an exact orphan graph', () => {
    const type = 'exact-orphan-unrelated-inconsistency'
    registerRecursivePropertyType(type)
    const orphanLeaf = createProperty({
      id: 'unrelated-inconsistency-orphan-leaf',
      type,
      children: []
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const orphanRoot = createProperty({
      id: 'unrelated-inconsistency-orphan-root',
      type,
      children: ['unrelated-inconsistency-orphan-leaf']
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const unrelatedChild = createProperty({
      id: 'unrelated-inconsistency-child',
      type,
      children: []
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const unrelatedOwner = createProperty({
      id: 'unrelated-inconsistency-owner',
      type,
      children: ['unrelated-inconsistency-child']
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    ;[orphanLeaf, orphanRoot, unrelatedChild, unrelatedOwner].forEach(
      (component) => propsManager.addToMap(component)
    )
    propsManager.cleanChanges()
    const reverseIndex = (
      propsManager as unknown as {
        relationshipOwnerIdsByChildId: Map<string, Set<string>>
      }
    ).relationshipOwnerIdsByChildId
    reverseIndex
      .get('unrelated-inconsistency-child')
      ?.delete('unrelated-inconsistency-owner')

    expect(() =>
      propsManager.updateProperties({
        operations: [
          {
            kind: 'remove-exact-orphan-property-graphs',
            orphanRootPropertyIds: ['unrelated-inconsistency-orphan-root'],
            retainedRootPropertyIds: []
          }
        ]
      })
    ).not.toThrow()

    expect(
      propsManager.getPropertyById('unrelated-inconsistency-orphan-root')
    ).toBeUndefined()
    expect(
      propsManager.getPropertyById('unrelated-inconsistency-orphan-leaf')
    ).toBeUndefined()
    expect(propsManager.getPropertyById('unrelated-inconsistency-owner')).toBe(
      unrelatedOwner
    )
    expect(propsManager.getPropertyById('unrelated-inconsistency-child')).toBe(
      unrelatedChild
    )
  })

  it('rejects duplicate, missing, cyclic, and created-and-removed orphan roots during preflight', () => {
    const type = 'exact-orphan-invalid-graph'
    registerRecursivePropertyType(type)
    const first = createProperty({
      id: 'exact-orphan-cycle-a',
      type,
      children: ['exact-orphan-cycle-b']
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const second = createProperty({
      id: 'exact-orphan-cycle-b',
      type,
      children: ['exact-orphan-cycle-a']
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    propsManager.addToMap(first)
    propsManager.addToMap(second)
    propsManager.cleanChanges()

    expect(() =>
      propsManager.preparePropertyMutationBatch({
        operations: [
          {
            kind: 'remove-exact-orphan-property-graphs',
            orphanRootPropertyIds: [
              'exact-orphan-cycle-a',
              'exact-orphan-cycle-a'
            ],
            retainedRootPropertyIds: []
          }
        ]
      })
    ).toThrow(/deduplicated root-id set/i)
    expect(() =>
      propsManager.preparePropertyMutationBatch({
        operations: [
          {
            kind: 'remove-exact-orphan-property-graphs',
            orphanRootPropertyIds: ['missing-exact-orphan-root'],
            retainedRootPropertyIds: []
          }
        ]
      })
    ).toThrow(/missing active root/i)
    expect(() =>
      propsManager.preparePropertyMutationBatch({
        operations: [
          {
            kind: 'remove-exact-orphan-property-graphs',
            orphanRootPropertyIds: ['exact-orphan-cycle-a'],
            retainedRootPropertyIds: []
          }
        ]
      })
    ).toThrow(/relationship cycle/i)

    const wrongTypeChild = createProperty({
      id: 'exact-orphan-wrong-type-child',
      type: PropertyTypes.POSITION
    }) as PropertyComponentInstanceTypes
    const wrongTypeRoot = createProperty({
      id: 'exact-orphan-wrong-type-root',
      type,
      children: ['exact-orphan-wrong-type-child']
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    propsManager.addToMap(wrongTypeChild)
    propsManager.addToMap(wrongTypeRoot)
    expect(() =>
      propsManager.preparePropertyMutationBatch({
        operations: [
          {
            kind: 'remove-exact-orphan-property-graphs',
            orphanRootPropertyIds: ['exact-orphan-wrong-type-root'],
            retainedRootPropertyIds: []
          }
        ]
      })
    ).toThrow(/invalid relationship child/i)

    const createdAndRemovedRequest = {
      operations: [
        {
          kind: 'create-exact-property-graph',
          ownerRelations: [
            {
              ownerElementId: 'created-and-removed-owner',
              ownerElementType: 'restore-test-element',
              ownerPropertyName: 'custom',
              componentId: 'created-and-removed-property'
            }
          ],
          components: [
            {
              id: 'created-and-removed-property',
              type: PropertyTypes.CUSTOM,
              children: []
            }
          ]
        },
        {
          kind: 'remove-exact-orphan-property-graphs',
          orphanRootPropertyIds: ['created-and-removed-property'],
          retainedRootPropertyIds: []
        }
      ]
    } satisfies PropertyMutationBatchRequest
    expect(() =>
      propsManager.preparePropertyMutationBatch(createdAndRemovedRequest)
    ).toThrow(/duplicate root/i)
    expect(propsManager.changes).toEqual([])
  })

  it('rejects exact orphan apply after forward or reverse relation drift', () => {
    const type = 'exact-orphan-stale-graph'
    registerRecursivePropertyType(type)
    const leaf = createProperty({
      id: 'exact-orphan-stale-leaf',
      type,
      children: []
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const root = createProperty({
      id: 'exact-orphan-stale-root',
      type,
      children: ['exact-orphan-stale-leaf']
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    propsManager.addToMap(leaf)
    propsManager.addToMap(root)
    propsManager.cleanChanges()
    const forwardPrepared = propsManager.preparePropertyMutationBatch({
      operations: [
        {
          kind: 'remove-exact-orphan-property-graphs',
          orphanRootPropertyIds: ['exact-orphan-stale-root'],
          retainedRootPropertyIds: []
        }
      ]
    })
    root.load({
      id: 'exact-orphan-stale-root',
      type,
      children: [],
      value: 0
    })

    expect(() =>
      propsManager.applyPreparedPropertyMutationBatch(forwardPrepared)
    ).toThrow(/no longer matches active state/i)
    expect(propsManager.getPropertyById('exact-orphan-stale-root')).toBe(root)

    root.load({
      id: 'exact-orphan-stale-root',
      type,
      children: ['exact-orphan-stale-leaf'],
      value: 0
    })
    const reversePrepared = propsManager.preparePropertyMutationBatch({
      operations: [
        {
          kind: 'remove-exact-orphan-property-graphs',
          orphanRootPropertyIds: ['exact-orphan-stale-root'],
          retainedRootPropertyIds: []
        }
      ]
    })
    const retainingOwner = createProperty({
      id: 'exact-orphan-stale-retaining-owner',
      type,
      children: ['exact-orphan-stale-root']
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    propsManager.addToMap(retainingOwner)

    expect(() =>
      propsManager.applyPreparedPropertyMutationBatch(reversePrepared)
    ).toThrow(/no longer matches active state/i)
    expect(propsManager.getPropertyById('exact-orphan-stale-root')).toBe(root)
    expect(propsManager.changes).toEqual([])
  })

  it('isolates an exact orphan prepared and its removal evidence from caller mutation', () => {
    const root = createProperty({
      id: 'isolated-exact-orphan-root',
      type: PropertyTypes.POSITION,
      x: 1,
      y: 2,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    }) as PropertyComponentInstanceTypes
    propsManager.addToMap(root)
    propsManager.cleanChanges()
    const orphanRootPropertyIds = ['isolated-exact-orphan-root']
    const prepared = propsManager.preparePropertyMutationBatch({
      operations: [
        {
          kind: 'remove-exact-orphan-property-graphs',
          orphanRootPropertyIds,
          retainedRootPropertyIds: []
        }
      ]
    })
    orphanRootPropertyIds[0] = 'caller-mutated-root'

    const result = propsManager.applyPreparedPropertyMutationBatch(prepared)

    expect(
      propsManager.getPropertyById('isolated-exact-orphan-root')
    ).toBeUndefined()
    expect(result.evidence).toEqual([
      expect.objectContaining({
        data: [
          expect.objectContaining({ id: 'isolated-exact-orphan-root', x: 1 })
        ]
      })
    ])
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.evidence)).toBe(true)
    expect(
      Object.isFrozen((result.evidence[0] as AddRemovePropertyChange).data)
    ).toBe(true)
  })

  it('restores exact orphan identities after an unaccepted transaction handoff', () => {
    const type = 'exact-orphan-rollback-graph'
    registerRecursivePropertyType(type)
    const child = createProperty({
      id: 'exact-orphan-rollback-child',
      type,
      children: []
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const root = createProperty({
      id: 'exact-orphan-rollback-root',
      type,
      children: ['exact-orphan-rollback-child']
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    propsManager.addToMap(child)
    propsManager.addToMap(root)
    propsManager.cleanChanges()
    const rejection = Object.assign(new Error('orphan handoff rejected'), {
      batchAccepted: false
    })
    let removedDuringHandoff = false

    expect(() =>
      ReactiveEventsModule.runWithTransactionOwner(
        {
          startTransaction: vi.fn(),
          updateTransactionBatch: vi.fn(() => {
            removedDuringHandoff =
              propsManager.getPropertyById('exact-orphan-rollback-root') ===
                undefined &&
              propsManager.getPropertyById('exact-orphan-rollback-child') ===
                undefined
            throw rejection
          }),
          endTransaction: vi.fn(),
          undo: vi.fn(),
          redo: vi.fn()
        },
        () =>
          propsManager.updateProperties({
            operations: [
              {
                kind: 'remove-exact-orphan-property-graphs',
                orphanRootPropertyIds: ['exact-orphan-rollback-root'],
                retainedRootPropertyIds: []
              }
            ]
          })
      )
    ).toThrow(rejection)

    expect(removedDuringHandoff).toBe(true)
    expect(propsManager.getPropertyById('exact-orphan-rollback-root')).toBe(
      root
    )
    expect(propsManager.getPropertyById('exact-orphan-rollback-child')).toBe(
      child
    )
    expect(
      propsManager.getRestoreComponentById('exact-orphan-rollback-root')
    ).toBeUndefined()
    expect(
      propsManager.getRestoreComponentById('exact-orphan-rollback-child')
    ).toBeUndefined()
    expect(propsManager.changes).toEqual([])
  })

  it('keeps exact orphan removal at the accepted Factory journal point', () => {
    const root = createProperty({
      id: 'accepted-exact-orphan-root',
      type: PropertyTypes.POSITION,
      x: 1,
      y: 2,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    }) as PropertyComponentInstanceTypes
    propsManager.addToMap(root)
    propsManager.cleanChanges()
    const rejection = Object.assign(new Error('orphan handoff accepted'), {
      batchAccepted: true
    })

    expect(() =>
      ReactiveEventsModule.runWithTransactionOwner(
        {
          startTransaction: vi.fn(),
          updateTransactionBatch: vi.fn(() => {
            throw rejection
          }),
          endTransaction: vi.fn(),
          undo: vi.fn(),
          redo: vi.fn()
        },
        () =>
          propsManager.updateProperties({
            operations: [
              {
                kind: 'remove-exact-orphan-property-graphs',
                orphanRootPropertyIds: ['accepted-exact-orphan-root'],
                retainedRootPropertyIds: []
              }
            ]
          })
      )
    ).toThrow(rejection)

    expect(
      propsManager.getPropertyById('accepted-exact-orphan-root')
    ).toBeUndefined()
    expect(
      propsManager.getRestoreComponentById('accepted-exact-orphan-root')
    ).toBe(root)
    expect(propsManager.changes).toEqual([])
  })

  it('rejects a prepared property prepared after its schema registration changes', () => {
    const position = createProperty({
      id: 'stale-prepared-position',
      type: PropertyTypes.POSITION,
      x: 1,
      y: 2,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    }) as PropertyComponentInstanceTypes
    propsManager.addToMap(position)
    const prepared = propsManager.preparePropertyMutationBatch({
      operations: [
        {
          kind: 'values',
          propertyId: 'stale-prepared-position',
          values: { x: 10 }
        }
      ]
    })
    propertySchemaRegistry.unregister(PropertyTypes.POSITION)
    registerPropertySchema({
      type: PropertyTypes.POSITION,
      fields: [
        {
          key: 'x',
          kind: 'number',
          validate: isFiniteNumber,
          defaultValue: 0
        },
        {
          key: 'y',
          kind: 'number',
          validate: isFiniteNumber,
          defaultValue: 0
        },
        {
          key: 'xUnit',
          kind: 'string',
          validate: isUnit,
          defaultValue: Unit.PX
        },
        {
          key: 'yUnit',
          kind: 'string',
          validate: isUnit,
          defaultValue: Unit.PX
        }
      ]
    })

    expect(() =>
      propsManager.applyPreparedPropertyMutationBatch(prepared)
    ).toThrow(/registration changed/i)
    expect(position.save()).toMatchObject({ x: 1 })
    expect(propsManager.changes).toEqual([])
  })

  it('restores the entire prepared property batch when apply fails after a prefix', () => {
    const first = createProperty({
      id: 'rollback-position-a',
      type: PropertyTypes.POSITION,
      x: 1,
      y: 2,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    }) as PropertyComponentInstanceTypes
    const second = createProperty({
      id: 'rollback-position-b',
      type: PropertyTypes.POSITION,
      x: 3,
      y: 4,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    }) as PropertyComponentInstanceTypes
    propsManager.addToMap(first)
    propsManager.addToMap(second)
    const before = propsManager.save()
    const prepared = propsManager.preparePropertyMutationBatch({
      operations: [
        {
          kind: 'values',
          propertyId: 'rollback-position-a',
          values: { x: 10 }
        },
        {
          kind: 'values',
          propertyId: 'rollback-position-b',
          values: { y: 20 }
        }
      ]
    })
    const originalLoad = second.load.bind(second)
    second.load = vi.fn((data: PropertyComponentRawData) => {
      if ((data as unknown as Record<string, unknown>).y === 20) {
        throw new Error('injected apply failure')
      }
      originalLoad(data)
    })
    const { events, subscription } = captureUpdateTransactionEvents()

    expect(() =>
      propsManager.applyPreparedPropertyMutationBatch(prepared)
    ).toThrow('injected apply failure')
    expect(propsManager.save()).toEqual(before)
    expect(propsManager.changes).toEqual([])
    expect(events).toEqual([])
    subscription.unsubscribe()
  })

  it('groups relation-backed lifecycle evidence as ADD then UPDATE then REMOVE atomically', () => {
    const childType = 'mutation-record-child'
    const parentType = 'mutation-record-parent'
    const ChildComponent = createPropertyComponentFromConfig({
      type: childType,
      defaults: { value: 0 },
      persistKeys: ['value'],
      valueKeys: ['value']
    })
    const parentDefinition = {
      type: parentType,
      defaults: { children: [] as string[], label: 'initial' },
      persistKeys: ['children', 'label'],
      valueKeys: ['children', 'label'],
      children: {
        key: 'children',
        childType,
        mode: 'ids-or-objects' as const,
        collection: 'array-or-record' as const,
        toChildData: (item: Record<string, unknown>) => ({
          value: item.value
        })
      }
    }
    const ParentComponent = createPropertyComponentFromConfig(parentDefinition)
    registerPropertyComponent(childType, ChildComponent)
    registerPropertyComponent(
      parentType,
      ParentComponent,
      undefined,
      parentDefinition
    )
    registerPropertySchema({
      type: childType,
      fields: [
        {
          key: 'value',
          kind: 'number',
          validate: isFiniteNumber,
          defaultValue: 0
        }
      ]
    })
    registerPropertySchema({
      type: parentType,
      fields: [
        {
          key: 'children',
          kind: 'array',
          defaultValue: []
        },
        {
          key: 'label',
          kind: 'string',
          defaultValue: 'initial'
        }
      ]
    })

    const childA = createProperty({
      id: 'mutation-child-a',
      type: childType,
      value: 1
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const sharedChild = createProperty({
      id: 'mutation-child-shared',
      type: childType,
      value: 2
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const retainedChild = createProperty({
      id: 'mutation-child-retained',
      type: childType,
      value: 3
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const firstParent = createProperty({
      id: 'mutation-parent-a',
      type: parentType,
      children: [
        'mutation-child-a',
        'mutation-child-shared',
        'mutation-child-retained'
      ]
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const secondParent = createProperty({
      id: 'mutation-parent-b',
      type: parentType,
      children: ['mutation-child-shared']
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    ;[childA, sharedChild, retainedChild, firstParent, secondParent].forEach(
      (component) => propsManager.addToMap(component)
    )
    propsManager.cleanChanges()
    const { events, subscription } = captureUpdateTransactionEvents()

    const result = propsManager.updateProperties({
      operations: [
        {
          kind: 'records',
          propertyId: 'mutation-parent-a',
          key: 'children',
          values: {
            label: 'updated'
          },
          set: {
            'mutation-child-retained': { value: 30 },
            'mutation-child-b': { value: 20 }
          },
          remove: ['mutation-child-a', 'mutation-child-shared']
        }
      ],
      options: { undoable: true }
    })

    expect(firstParent.save()).toMatchObject({
      children: ['mutation-child-retained', 'mutation-child-b'],
      label: 'updated'
    })
    expect(secondParent.save()).toMatchObject({
      children: ['mutation-child-shared']
    })
    expect(
      propsManager.getPropertyById('mutation-child-b')?.save()
    ).toMatchObject({
      id: 'mutation-child-b',
      type: childType,
      value: 20
    })
    expect(propsManager.getPropertyById('mutation-child-a')).toBeUndefined()
    expect(
      propsManager.getRestoreComponentById('mutation-child-a')?.save()
    ).toMatchObject({
      id: 'mutation-child-a',
      value: 1
    })
    expect(propsManager.getPropertyById('mutation-child-shared')).toBe(
      sharedChild
    )
    expect(
      propsManager.getPropertyById('mutation-child-retained')?.save()
    ).toMatchObject({
      value: 30
    })
    expect(result.evidence.map(({ action }) => action)).toEqual([
      PROPS_ACTIONS.ADD_PROPERTY,
      PROPS_ACTIONS.UPDATE_PROPERTY,
      PROPS_ACTIONS.UPDATE_PROPERTY,
      PROPS_ACTIONS.UPDATE_PROPERTY,
      PROPS_ACTIONS.REMOVE_PROPERTY
    ])
    expect(result.evidence).toEqual([
      expect.objectContaining({
        action: PROPS_ACTIONS.ADD_PROPERTY,
        data: [
          expect.objectContaining({
            id: 'mutation-child-b',
            value: 20
          })
        ]
      }),
      expect.objectContaining({
        action: PROPS_ACTIONS.UPDATE_PROPERTY,
        id: 'mutation-child-retained',
        key: 'value',
        before: 3,
        after: 30
      }),
      expect.objectContaining({
        action: PROPS_ACTIONS.UPDATE_PROPERTY,
        id: 'mutation-parent-a',
        key: 'label',
        before: 'initial',
        after: 'updated'
      }),
      expect.objectContaining({
        action: PROPS_ACTIONS.UPDATE_PROPERTY,
        id: 'mutation-parent-a',
        key: 'children',
        before: [
          'mutation-child-a',
          'mutation-child-shared',
          'mutation-child-retained'
        ],
        after: ['mutation-child-retained', 'mutation-child-b']
      }),
      expect.objectContaining({
        action: PROPS_ACTIONS.REMOVE_PROPERTY,
        data: [
          expect.objectContaining({
            id: 'mutation-child-a',
            value: 1
          })
        ]
      })
    ])
    expect(result.owners).toEqual([
      {
        orderedId: 'mutation-parent-a',
        rootPropertyIds: ['mutation-parent-a']
      }
    ])
    expect(events.map(({ canonicalEvidence }) => canonicalEvidence)).toEqual([
      {
        orderedIds: ['mutation-parent-a'],
        sharedRecords: [
          {
            orderedIds: ['mutation-parent-a'],
            payload: expect.objectContaining({
              action: PROPS_ACTIONS.ADD_PROPERTY,
              data: [expect.objectContaining({ id: 'mutation-child-b' })]
            })
          }
        ]
      },
      { orderedIds: ['mutation-parent-a'] },
      { orderedIds: ['mutation-parent-a'] },
      { orderedIds: ['mutation-parent-a'] },
      {
        orderedIds: ['mutation-parent-a'],
        sharedRecords: [
          {
            orderedIds: ['mutation-parent-a'],
            payload: expect.objectContaining({
              action: PROPS_ACTIONS.REMOVE_PROPERTY,
              data: [expect.objectContaining({ id: 'mutation-child-a' })]
            })
          }
        ]
      }
    ])
    subscription.unsubscribe()
  })

  it('splits record lifecycle delivery by each property source', () => {
    const childType = 'owner-split-record-child'
    const parentType = 'owner-split-record-parent'
    const ChildComponent = createPropertyComponentFromConfig({
      type: childType,
      defaults: { value: 0 },
      persistKeys: ['value'],
      valueKeys: ['value']
    })
    const parentDefinition = {
      type: parentType,
      defaults: { children: [] as string[] },
      persistKeys: ['children'],
      valueKeys: ['children'],
      children: {
        key: 'children',
        childType,
        mode: 'ids-or-objects' as const,
        collection: 'array-or-record' as const
      }
    }
    const ParentComponent = createPropertyComponentFromConfig(parentDefinition)
    registerPropertyComponent(childType, ChildComponent)
    registerPropertyComponent(
      parentType,
      ParentComponent,
      undefined,
      parentDefinition
    )
    registerPropertySchema({
      type: childType,
      fields: [
        {
          key: 'value',
          kind: 'number',
          validate: isFiniteNumber,
          defaultValue: 0
        }
      ]
    })
    registerPropertySchema({
      type: parentType,
      fields: [
        {
          key: 'children',
          kind: 'array',
          defaultValue: []
        }
      ]
    })
    const oldChildA = createProperty({
      id: 'owner-split-old-child-a',
      type: childType,
      value: 1
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const oldChildB = createProperty({
      id: 'owner-split-old-child-b',
      type: childType,
      value: 2
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const parentA = createProperty({
      id: 'owner-split-parent-a',
      type: parentType,
      children: ['owner-split-old-child-a']
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const parentB = createProperty({
      id: 'owner-split-parent-b',
      type: parentType,
      children: ['owner-split-old-child-b']
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    ;[oldChildA, oldChildB, parentA, parentB].forEach((component) =>
      propsManager.addToMap(component)
    )
    propsManager.cleanChanges()
    const { events, subscription } = captureUpdateTransactionEvents()

    const result = propsManager.updateProperties({
      operations: [
        {
          kind: 'records',
          propertyId: 'owner-split-parent-a',
          key: 'children',
          set: {
            'owner-split-new-child-a': { value: 10 }
          },
          remove: ['owner-split-old-child-a']
        },
        {
          kind: 'records',
          propertyId: 'owner-split-parent-b',
          key: 'children',
          set: {
            'owner-split-new-child-b': { value: 20 }
          },
          remove: ['owner-split-old-child-b']
        }
      ]
    })

    expect(result.owners).toEqual([
      {
        orderedId: 'owner-split-parent-a',
        rootPropertyIds: ['owner-split-parent-a']
      },
      {
        orderedId: 'owner-split-parent-b',
        rootPropertyIds: ['owner-split-parent-b']
      }
    ])
    const addEvent = events.find(
      ({ payload }) =>
        (payload as PropsChange).action === PROPS_ACTIONS.ADD_PROPERTY
    )
    const removeEvent = events.find(
      ({ payload }) =>
        (payload as PropsChange).action === PROPS_ACTIONS.REMOVE_PROPERTY
    )
    expect(addEvent?.canonicalEvidence).toEqual({
      orderedIds: ['owner-split-parent-a', 'owner-split-parent-b'],
      sharedRecords: [
        {
          orderedIds: ['owner-split-parent-a'],
          payload: expect.objectContaining({
            data: [expect.objectContaining({ id: 'owner-split-new-child-a' })]
          })
        },
        {
          orderedIds: ['owner-split-parent-b'],
          payload: expect.objectContaining({
            data: [expect.objectContaining({ id: 'owner-split-new-child-b' })]
          })
        }
      ]
    })
    expect(removeEvent?.canonicalEvidence).toEqual({
      orderedIds: ['owner-split-parent-a', 'owner-split-parent-b'],
      sharedRecords: [
        {
          orderedIds: ['owner-split-parent-a'],
          payload: expect.objectContaining({
            data: [expect.objectContaining({ id: 'owner-split-old-child-a' })]
          })
        },
        {
          orderedIds: ['owner-split-parent-b'],
          payload: expect.objectContaining({
            data: [expect.objectContaining({ id: 'owner-split-old-child-b' })]
          })
        }
      ]
    })
    subscription.unsubscribe()
  })

  it('propagates every reachable canonical owner to a shared newly-created descendant', () => {
    const nodeType = 'shared-created-descendant-node'
    const rootType = 'shared-created-descendant-root'
    const nodeDefinition = {
      type: nodeType,
      defaults: { children: [] as string[] },
      persistKeys: ['children'],
      valueKeys: ['children'],
      children: {
        key: 'children',
        childType: nodeType,
        mode: 'ids-or-objects' as const,
        collection: 'array-or-record' as const
      }
    }
    const rootDefinition = {
      type: rootType,
      defaults: { children: [] as string[] },
      persistKeys: ['children'],
      valueKeys: ['children'],
      children: {
        key: 'children',
        childType: nodeType,
        mode: 'ids-or-objects' as const,
        collection: 'array-or-record' as const
      }
    }
    const NodeComponent = createPropertyComponentFromConfig(nodeDefinition)
    const RootComponent = createPropertyComponentFromConfig(rootDefinition)
    registerPropertyComponent(
      nodeType,
      NodeComponent,
      undefined,
      nodeDefinition
    )
    registerPropertyComponent(
      rootType,
      RootComponent,
      undefined,
      rootDefinition
    )
    ;[nodeType, rootType].forEach((type) =>
      registerPropertySchema({
        type,
        fields: [
          {
            key: 'children',
            kind: 'array',
            defaultValue: []
          }
        ]
      })
    )
    const rootA = createProperty({
      id: 'shared-created-root-a',
      type: rootType,
      children: []
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const rootB = createProperty({
      id: 'shared-created-root-b',
      type: rootType,
      children: []
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    propsManager.addToMap(rootA)
    propsManager.addToMap(rootB)
    propsManager.cleanChanges()
    const { events, subscription } = captureUpdateTransactionEvents()

    propsManager.updateProperties({
      operations: [
        {
          kind: 'records',
          propertyId: 'shared-created-root-a',
          key: 'children',
          set: {
            'shared-created-leaf': { children: [] }
          }
        },
        {
          kind: 'records',
          propertyId: 'shared-created-root-b',
          key: 'children',
          set: {
            'shared-created-branch': {
              children: ['shared-created-leaf']
            }
          }
        }
      ]
    })

    const addEvent = events.find(
      ({ payload }) =>
        (payload as PropsChange).action === PROPS_ACTIONS.ADD_PROPERTY
    )
    expect(addEvent?.canonicalEvidence).toEqual({
      orderedIds: ['shared-created-root-a', 'shared-created-root-b'],
      sharedRecords: [
        {
          orderedIds: ['shared-created-root-a', 'shared-created-root-b'],
          payload: expect.objectContaining({
            data: [expect.objectContaining({ id: 'shared-created-leaf' })]
          })
        },
        {
          orderedIds: ['shared-created-root-b'],
          payload: expect.objectContaining({
            data: [expect.objectContaining({ id: 'shared-created-branch' })]
          })
        }
      ]
    })
    subscription.unsubscribe()
  })

  const prepareRecordReplacement = (prefix: string) => {
    const childType = `${prefix}-child`
    const parentType = `${prefix}-parent`
    const disposedIds: string[] = []
    const ChildBase = createPropertyComponentFromConfig({
      type: childType,
      defaults: { value: 0 },
      persistKeys: ['value'],
      valueKeys: ['value']
    })
    class TrackedChild extends ChildBase {
      dispose(): void {
        disposedIds.push(this.get('id'))
      }
    }
    const parentDefinition = {
      type: parentType,
      defaults: { children: [] as string[] },
      persistKeys: ['children'],
      valueKeys: ['children'],
      children: {
        key: 'children',
        childType,
        mode: 'ids-or-objects' as const,
        collection: 'array-or-record' as const
      }
    }
    const ParentComponent = createPropertyComponentFromConfig(parentDefinition)
    registerPropertyComponent(childType, TrackedChild)
    registerPropertyComponent(
      parentType,
      ParentComponent,
      undefined,
      parentDefinition
    )
    registerPropertySchema({
      type: childType,
      fields: [
        {
          key: 'value',
          kind: 'number',
          validate: isFiniteNumber,
          defaultValue: 0
        }
      ]
    })
    registerPropertySchema({
      type: parentType,
      fields: [
        {
          key: 'children',
          kind: 'array',
          defaultValue: []
        }
      ]
    })
    const oldChildId = `${prefix}-old-child`
    const newChildId = `${prefix}-new-child`
    const parentId = `${prefix}-parent-id`
    const oldChild = createProperty({
      id: oldChildId,
      type: childType,
      value: 1
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const parent = createProperty({
      id: parentId,
      type: parentType,
      children: [oldChildId]
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    propsManager.addToMap(oldChild)
    propsManager.addToMap(parent)
    propsManager.cleanChanges()
    const prepared = propsManager.preparePropertyMutationBatch({
      operations: [
        {
          kind: 'records',
          propertyId: parentId,
          key: 'children',
          set: {
            [newChildId]: { value: 2 }
          },
          remove: [oldChildId]
        }
      ]
    })
    return {
      disposedIds,
      newChildId,
      oldChild,
      oldChildId,
      parent,
      parentId,
      prepared
    }
  }

  it('rolls back an unaccepted record lifecycle handoff locally with exact identities', () => {
    const setup = prepareRecordReplacement('unaccepted-record-handoff')
    const rejection = Object.assign(new Error('unaccepted record handoff'), {
      batchAccepted: false
    })
    let appliedNewChild: PropertyComponentInstanceTypes | undefined

    expect(() =>
      ReactiveEventsModule.runWithTransactionOwner(
        {
          startTransaction: vi.fn(),
          updateTransactionBatch: vi.fn(() => {
            appliedNewChild = propsManager.getPropertyById(setup.newChildId)
            throw rejection
          }),
          endTransaction: vi.fn(),
          undo: vi.fn(),
          redo: vi.fn()
        },
        () => propsManager.applyPreparedPropertyMutationBatch(setup.prepared)
      )
    ).toThrow(rejection)

    expect(appliedNewChild).toBeDefined()
    expect(propsManager.getPropertyById(setup.newChildId)).toBeUndefined()
    expect(setup.disposedIds).toEqual([setup.newChildId])
    expect(propsManager.getPropertyById(setup.oldChildId)).toBe(setup.oldChild)
    expect(
      propsManager.getRestoreComponentById(setup.oldChildId)
    ).toBeUndefined()
    expect(propsManager.getPropertyById(setup.parentId)).toBe(setup.parent)
    expect(setup.parent.save()).toMatchObject({
      children: [setup.oldChildId]
    })
    expect(propsManager.changes).toEqual([])
    expect(() =>
      propsManager.applyPreparedPropertyMutationBatch(setup.prepared)
    ).toThrow(/owner-issued one-shot prepared property mutation batch/i)
  })

  it('leaves an accepted record lifecycle handoff at the exact journal point for Factory replay', () => {
    const setup = prepareRecordReplacement('accepted-record-handoff')
    const rejection = Object.assign(new Error('accepted record handoff'), {
      batchAccepted: true
    })
    let acceptedNewChild: PropertyComponentInstanceTypes | undefined

    expect(() =>
      ReactiveEventsModule.runWithTransactionOwner(
        {
          startTransaction: vi.fn(),
          updateTransactionBatch: vi.fn(() => {
            acceptedNewChild = propsManager.getPropertyById(setup.newChildId)
            throw rejection
          }),
          endTransaction: vi.fn(),
          undo: vi.fn(),
          redo: vi.fn()
        },
        () => propsManager.applyPreparedPropertyMutationBatch(setup.prepared)
      )
    ).toThrow(rejection)

    expect(acceptedNewChild).toBeDefined()
    expect(propsManager.getPropertyById(setup.newChildId)).toBe(
      acceptedNewChild
    )
    expect(setup.disposedIds).toEqual([])
    expect(propsManager.getPropertyById(setup.oldChildId)).toBeUndefined()
    expect(propsManager.getRestoreComponentById(setup.oldChildId)).toBe(
      setup.oldChild
    )
    expect(propsManager.getPropertyById(setup.parentId)).toBe(setup.parent)
    expect(setup.parent.save()).toMatchObject({
      children: [setup.newChildId]
    })
    expect(propsManager.changes).toEqual([])
    expect(() =>
      propsManager.applyPreparedPropertyMutationBatch(setup.prepared)
    ).toThrow(/owner-issued one-shot prepared property mutation batch/i)
  })

  it('restores relationship ownership after transaction handoff rejects an applied batch', () => {
    const childType = 'rollback-record-child'
    const parentType = 'rollback-record-parent'
    const ChildComponent = createPropertyComponentFromConfig({
      type: childType,
      defaults: { value: 0 },
      persistKeys: ['value'],
      valueKeys: ['value']
    })
    const parentDefinition = {
      type: parentType,
      defaults: { children: [] as string[] },
      persistKeys: ['children'],
      valueKeys: ['children'],
      children: {
        key: 'children',
        childType,
        mode: 'ids-or-objects' as const,
        collection: 'array-or-record' as const
      }
    }
    const ParentComponent = createPropertyComponentFromConfig(parentDefinition)
    registerPropertyComponent(childType, ChildComponent)
    registerPropertyComponent(
      parentType,
      ParentComponent,
      undefined,
      parentDefinition
    )
    registerPropertySchema({
      type: childType,
      fields: [
        {
          key: 'value',
          kind: 'number',
          validate: isFiniteNumber,
          defaultValue: 0
        }
      ]
    })
    registerPropertySchema({
      type: parentType,
      fields: [
        {
          key: 'children',
          kind: 'array',
          defaultValue: []
        }
      ]
    })
    const child = createProperty({
      id: 'rollback-record-shared-child',
      type: childType,
      value: 1
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const firstParent = createProperty({
      id: 'rollback-record-parent-a',
      type: parentType,
      children: ['rollback-record-shared-child']
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const secondParent = createProperty({
      id: 'rollback-record-parent-b',
      type: parentType,
      children: ['rollback-record-shared-child']
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    ;[child, firstParent, secondParent].forEach((component) =>
      propsManager.addToMap(component)
    )
    const before = propsManager.save()

    expect(() =>
      ReactiveEventsModule.runWithTransactionOwner(
        {
          startTransaction: vi.fn(),
          updateTransactionBatch: vi.fn(() => {
            throw new Error('transaction owner rejected relationship batch')
          }),
          endTransaction: vi.fn(),
          undo: vi.fn(),
          redo: vi.fn()
        },
        () =>
          propsManager.updateProperties({
            operations: [
              {
                kind: 'values',
                propertyId: 'rollback-record-parent-a',
                values: { children: [] }
              }
            ]
          })
      )
    ).toThrow(/transaction owner rejected relationship batch/i)

    expect(propsManager.save()).toEqual(before)
    expect(propsManager.changes).toEqual([])

    propsManager.updateProperties({
      operations: [
        {
          kind: 'values',
          propertyId: 'rollback-record-parent-b',
          values: { children: [] }
        }
      ]
    })

    expect(propsManager.getPropertyById('rollback-record-shared-child')).toBe(
      child
    )
    expect(firstParent.save()).toMatchObject({
      children: ['rollback-record-shared-child']
    })
    expect(secondParent.save()).toMatchObject({ children: [] })
  })

  it('infers omitted persist keys from registered child defaults during missing-record preflight', () => {
    const childType = 'defaulted-record-child'
    const parentType = 'defaulted-record-parent'
    const ChildComponent = createPropertyComponentFromConfig({
      type: childType,
      defaults: {
        value: 7,
        optionalLabel: undefined as string | undefined
      }
    })
    const parentDefinition = {
      type: parentType,
      defaults: { children: [] as string[] },
      persistKeys: ['children'],
      valueKeys: ['children'],
      children: {
        key: 'children',
        childType,
        mode: 'ids-or-objects' as const,
        collection: 'array-or-record' as const,
        toChildData: (item: Record<string, unknown>) => item
      }
    }
    const ParentComponent = createPropertyComponentFromConfig(parentDefinition)
    registerPropertyComponent(childType, ChildComponent, undefined, {
      type: childType,
      defaults: {
        value: 7,
        optionalLabel: undefined as string | undefined
      }
    })
    registerPropertyComponent(
      parentType,
      ParentComponent,
      undefined,
      parentDefinition
    )
    registerPropertySchema({
      type: childType,
      fields: [
        {
          key: 'value',
          kind: 'number',
          validate: isFiniteNumber,
          defaultValue: 7
        },
        {
          key: 'optionalLabel',
          kind: 'string'
        }
      ]
    })
    const parent = createProperty({
      id: 'defaulted-record-parent-id',
      type: parentType,
      children: []
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    propsManager.addToMap(parent)

    const result = propsManager.updateProperties({
      operations: [
        {
          kind: 'records',
          propertyId: 'defaulted-record-parent-id',
          key: 'children',
          set: {
            'defaulted-record-child-id': {},
            'overridden-record-child-id': { value: 11 },
            'optional-record-child-id': {
              value: 13,
              optionalLabel: 'linked'
            }
          }
        }
      ]
    })

    expect(
      propsManager.getPropertyById('defaulted-record-child-id')?.save()
    ).toMatchObject({
      id: 'defaulted-record-child-id',
      type: childType,
      value: 7
    })
    expect(
      propsManager.getPropertyById('overridden-record-child-id')?.save()
    ).toMatchObject({
      id: 'overridden-record-child-id',
      type: childType,
      value: 11
    })
    expect(
      propsManager.getPropertyById('defaulted-record-child-id')?.save()
    ).not.toHaveProperty('optionalLabel')
    expect(
      propsManager.getPropertyById('optional-record-child-id')?.save()
    ).toMatchObject({
      id: 'optional-record-child-id',
      type: childType,
      value: 13,
      optionalLabel: 'linked'
    })
    expect(result.evidence[0]).toMatchObject({
      action: PROPS_ACTIONS.ADD_PROPERTY,
      data: [
        {
          id: 'defaulted-record-child-id',
          type: childType,
          value: 7
        },
        {
          id: 'overridden-record-child-id',
          type: childType,
          value: 11
        },
        {
          id: 'optional-record-child-id',
          type: childType,
          value: 13,
          optionalLabel: 'linked'
        }
      ]
    })
    expect(
      (result.evidence[0] as AddRemovePropertyChange).data[0]
    ).not.toHaveProperty('optionalLabel')
  })

  it('registers all materialized relation records through one batch boundary', () => {
    const childType = 'registered-record-child'
    const parentType = 'registered-record-parent'
    const ChildComponent = createPropertyComponentFromConfig({
      type: childType,
      defaults: { value: 0 },
      persistKeys: ['value'],
      valueKeys: ['value']
    })
    const parentDefinition = {
      type: parentType,
      defaults: { children: [] as string[] },
      persistKeys: ['children'],
      valueKeys: ['children'],
      children: {
        key: 'children',
        childType,
        mode: 'ids-or-objects' as const,
        collection: 'array-or-record' as const,
        toChildData: (item: Record<string, unknown>) => item
      }
    }
    const ParentComponent = createPropertyComponentFromConfig(parentDefinition)
    registerPropertyComponent(childType, ChildComponent)
    registerPropertyComponent(
      parentType,
      ParentComponent,
      undefined,
      parentDefinition
    )
    registerPropertySchema({
      type: childType,
      fields: [
        {
          key: 'value',
          kind: 'number',
          validate: isFiniteNumber,
          defaultValue: 0
        }
      ]
    })
    const parent = createProperty({
      id: 'registered-record-parent-id',
      type: parentType,
      children: []
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    propsManager.addToMap(parent)
    const registerMany = vi.spyOn(propsManager, 'registerMany')

    propsManager.updateProperties({
      operations: [
        {
          kind: 'records',
          propertyId: 'registered-record-parent-id',
          key: 'children',
          set: {
            'registered-record-child-a': { value: 1 },
            'registered-record-child-b': { value: 2 }
          }
        }
      ]
    })

    expect(registerMany).toHaveBeenCalledTimes(1)
    expect(
      registerMany.mock.calls[0]?.[0].map((component) => component.get('id'))
    ).toEqual(['registered-record-child-a', 'registered-record-child-b'])
  })

  it('does not snapshot unrelated active properties during staged record materialization', () => {
    const childType = 'active-reading-record-child'
    const parentType = 'active-reading-record-parent'
    let observedActiveX: unknown
    const ChildBase = createPropertyComponentFromConfig({
      type: childType,
      defaults: { value: 0 },
      persistKeys: ['value'],
      valueKeys: ['value']
    })
    class ActiveReadingChild extends ChildBase {
      constructor(data: Partial<PropertyComponentRawData>) {
        super(data)
        observedActiveX = (
          getPropertyComponentAccessor().getPropertyById(
            'active-reading-position'
          ) as unknown as { get: (key: string) => unknown } | undefined
        )?.get('x')
      }
    }
    const parentDefinition = {
      type: parentType,
      defaults: { children: [] as string[] },
      persistKeys: ['children'],
      valueKeys: ['children'],
      children: {
        key: 'children',
        childType,
        mode: 'ids-or-objects' as const,
        collection: 'array-or-record' as const
      }
    }
    const ParentComponent = createPropertyComponentFromConfig(parentDefinition)
    registerPropertyComponent(childType, ActiveReadingChild)
    registerPropertyComponent(
      parentType,
      ParentComponent,
      undefined,
      parentDefinition
    )
    registerPropertySchema({
      type: childType,
      fields: [
        {
          key: 'value',
          kind: 'number',
          validate: isFiniteNumber,
          defaultValue: 0
        }
      ]
    })
    registerPropertySchema({
      type: parentType,
      fields: [
        {
          key: 'children',
          kind: 'array',
          defaultValue: []
        }
      ]
    })
    const activePosition = createProperty({
      id: 'active-reading-position',
      type: PropertyTypes.POSITION,
      x: 1,
      y: 2,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    }) as PropertyComponentInstanceTypes
    const parent = createProperty({
      id: 'active-reading-record-parent-id',
      type: parentType,
      children: []
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    propsManager.addToMap(activePosition)
    propsManager.addToMap(parent)
    const activeSave = vi.fn(activePosition.save.bind(activePosition))
    ;(
      activePosition as PropertyComponentInstanceTypes & {
        save: typeof activeSave
      }
    ).save = activeSave
    const registerMany = vi.spyOn(propsManager, 'registerMany')
    const updateTransactionBatch = vi.fn()

    ReactiveEventsModule.runWithTransactionOwner(
      {
        startTransaction: vi.fn(),
        updateTransactionBatch,
        endTransaction: vi.fn(),
        undo: vi.fn(),
        redo: vi.fn()
      },
      () =>
        propsManager.updateProperties({
          operations: [
            {
              kind: 'records',
              propertyId: 'active-reading-record-parent-id',
              key: 'children',
              set: {
                'active-reading-record-child-id': { value: 1 }
              }
            }
          ]
        })
    )

    expect(observedActiveX).toBe(1)
    expect(activeSave).not.toHaveBeenCalled()
    expect(
      (
        propsManager.getPropertyById(
          'active-reading-record-child-id'
        ) as unknown as { get: (key: string) => unknown } | undefined
      )?.get('value')
    ).toBe(1)
    expect(
      (
        activePosition as unknown as {
          get: (key: string) => unknown
        }
      ).get('x')
    ).toBe(1)
    expect(registerMany).toHaveBeenCalledOnce()
    expect(updateTransactionBatch).toHaveBeenCalledOnce()
  })

  it('rejects registration revision drift after staged record materialization before registering it', () => {
    const childType = 'registration-drifting-record-child'
    const parentType = 'registration-drifting-record-parent'
    const ChildBase = createPropertyComponentFromConfig({
      type: childType,
      defaults: { value: 0 },
      persistKeys: ['value'],
      valueKeys: ['value']
    })
    class RegistrationDriftingChild extends ChildBase {
      constructor(data: Partial<PropertyComponentRawData>) {
        super(data)
        propertyComponentRegistry.unregister(childType)
        registerPropertyComponent(childType, RegistrationDriftingChild)
      }
    }
    const parentDefinition = {
      type: parentType,
      defaults: { children: [] as string[] },
      persistKeys: ['children'],
      valueKeys: ['children'],
      children: {
        key: 'children',
        childType,
        mode: 'ids-or-objects' as const,
        collection: 'array-or-record' as const
      }
    }
    const ParentComponent = createPropertyComponentFromConfig(parentDefinition)
    registerPropertyComponent(childType, RegistrationDriftingChild)
    registerPropertyComponent(
      parentType,
      ParentComponent,
      undefined,
      parentDefinition
    )
    registerPropertySchema({
      type: childType,
      fields: [
        {
          key: 'value',
          kind: 'number',
          validate: isFiniteNumber,
          defaultValue: 0
        }
      ]
    })
    registerPropertySchema({
      type: parentType,
      fields: [
        {
          key: 'children',
          kind: 'array',
          defaultValue: []
        }
      ]
    })
    const parent = createProperty({
      id: 'registration-drifting-record-parent-id',
      type: parentType,
      children: []
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    propsManager.addToMap(parent)
    const before = propsManager.save()
    const registerMany = vi.spyOn(propsManager, 'registerMany')
    const updateTransactionBatch = vi.fn()

    expect(() =>
      ReactiveEventsModule.runWithTransactionOwner(
        {
          startTransaction: vi.fn(),
          updateTransactionBatch,
          endTransaction: vi.fn(),
          undo: vi.fn(),
          redo: vi.fn()
        },
        () =>
          propsManager.updateProperties({
            operations: [
              {
                kind: 'records',
                propertyId: 'registration-drifting-record-parent-id',
                key: 'children',
                set: {
                  'registration-drifting-record-child-id': { value: 1 }
                }
              }
            ]
          })
      )
    ).toThrow(/registration changed/i)

    expect(propsManager.save()).toEqual(before)
    expect(
      propsManager.getPropertyById('registration-drifting-record-child-id')
    ).toBeUndefined()
    expect(propsManager.changes).toEqual([])
    expect(registerMany).not.toHaveBeenCalled()
    expect(updateTransactionBatch).not.toHaveBeenCalled()
  })

  it('rejects a cycle in the affected relationship graph before applying the batch', () => {
    const relationType = 'cyclic-record-property'
    const relationDefinition = {
      type: relationType,
      defaults: { children: [] as string[] },
      persistKeys: ['children'],
      valueKeys: ['children'],
      children: {
        key: 'children',
        childType: relationType,
        mode: 'ids-or-objects' as const,
        collection: 'array-or-record' as const
      }
    }
    const RelationComponent =
      createPropertyComponentFromConfig(relationDefinition)
    registerPropertyComponent(
      relationType,
      RelationComponent,
      undefined,
      relationDefinition
    )
    registerPropertySchema({
      type: relationType,
      fields: [
        {
          key: 'children',
          kind: 'array',
          defaultValue: []
        }
      ]
    })
    const first = createProperty({
      id: 'cyclic-record-a',
      type: relationType,
      children: []
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const second = createProperty({
      id: 'cyclic-record-b',
      type: relationType,
      children: []
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    propsManager.addToMap(first)
    propsManager.addToMap(second)
    const before = propsManager.save()

    expect(() =>
      propsManager.updateProperties({
        operations: [
          {
            kind: 'values',
            propertyId: 'cyclic-record-a',
            values: { children: ['cyclic-record-b'] }
          },
          {
            kind: 'values',
            propertyId: 'cyclic-record-b',
            values: { children: ['cyclic-record-a'] }
          }
        ]
      })
    ).toThrow(/relationship cycle/i)

    expect(propsManager.save()).toEqual(before)
    expect(propsManager.changes).toEqual([])
  })

  it('removes a detached relationship subtree when a child is visited before its orphan owner', () => {
    const relationType = 'ordered-orphan-record-property'
    const relationDefinition = {
      type: relationType,
      defaults: { children: [] as string[] },
      persistKeys: ['children'],
      valueKeys: ['children'],
      children: {
        key: 'children',
        childType: relationType,
        mode: 'ids-or-objects' as const,
        collection: 'array-or-record' as const
      }
    }
    const RelationComponent =
      createPropertyComponentFromConfig(relationDefinition)
    registerPropertyComponent(
      relationType,
      RelationComponent,
      undefined,
      relationDefinition
    )
    registerPropertySchema({
      type: relationType,
      fields: [
        {
          key: 'children',
          kind: 'array',
          defaultValue: []
        }
      ]
    })
    const leaf = createProperty({
      id: 'ordered-orphan-leaf',
      type: relationType,
      children: []
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const owner = createProperty({
      id: 'ordered-orphan-owner',
      type: relationType,
      children: ['ordered-orphan-leaf']
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const root = createProperty({
      id: 'ordered-orphan-root',
      type: relationType,
      children: ['ordered-orphan-leaf', 'ordered-orphan-owner']
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    ;[leaf, owner, root].forEach((component) =>
      propsManager.addToMap(component)
    )

    const result = propsManager.updateProperties({
      operations: [
        {
          kind: 'values',
          propertyId: 'ordered-orphan-root',
          values: { children: [] }
        }
      ]
    })

    expect(propsManager.getPropertyById('ordered-orphan-owner')).toBeUndefined()
    expect(propsManager.getPropertyById('ordered-orphan-leaf')).toBeUndefined()
    expect(propsManager.getRestoreComponentById('ordered-orphan-owner')).toBe(
      owner
    )
    expect(propsManager.getRestoreComponentById('ordered-orphan-leaf')).toBe(
      leaf
    )
    expect(result.evidence.at(-1)).toMatchObject({
      action: PROPS_ACTIONS.REMOVE_PROPERTY,
      data: [
        expect.objectContaining({ id: 'ordered-orphan-owner' }),
        expect.objectContaining({ id: 'ordered-orphan-leaf' })
      ]
    })
  })

  it('does not snapshot an unrelated relationship owner for an affected relationship batch', () => {
    const relationType = 'sparse-relationship-property'
    const relationDefinition = {
      type: relationType,
      defaults: { children: [] as string[] },
      persistKeys: ['children'],
      valueKeys: ['children'],
      children: {
        key: 'children',
        childType: relationType,
        mode: 'ids-or-objects' as const,
        collection: 'array-or-record' as const
      }
    }
    const RelationComponent =
      createPropertyComponentFromConfig(relationDefinition)
    registerPropertyComponent(
      relationType,
      RelationComponent,
      undefined,
      relationDefinition
    )
    registerPropertySchema({
      type: relationType,
      fields: [
        {
          key: 'children',
          kind: 'array',
          defaultValue: []
        }
      ]
    })
    const affectedChild = createProperty({
      id: 'sparse-relationship-affected-child',
      type: relationType,
      children: []
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const affectedOwner = createProperty({
      id: 'sparse-relationship-affected-owner',
      type: relationType,
      children: ['sparse-relationship-affected-child']
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const unrelatedChild = createProperty({
      id: 'sparse-relationship-unrelated-child',
      type: relationType,
      children: []
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    const unrelatedOwner = createProperty({
      id: 'sparse-relationship-unrelated-owner',
      type: relationType,
      children: ['sparse-relationship-unrelated-child']
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    ;[affectedChild, affectedOwner, unrelatedChild, unrelatedOwner].forEach(
      (component) => propsManager.addToMap(component)
    )
    const unrelatedSave = vi.fn(unrelatedOwner.save.bind(unrelatedOwner))
    unrelatedOwner.save = unrelatedSave

    propsManager.updateProperties({
      operations: [
        {
          kind: 'values',
          propertyId: 'sparse-relationship-affected-owner',
          values: { children: [] }
        }
      ]
    })

    expect(unrelatedSave).not.toHaveBeenCalled()
    expect(unrelatedOwner.save()).toMatchObject({
      children: ['sparse-relationship-unrelated-child']
    })
    expect(
      propsManager.getPropertyById('sparse-relationship-unrelated-child')
    ).toBe(unrelatedChild)
  })

  it('rejects an invalid missing record before applying an earlier valid property update', () => {
    const childType = 'invalid-record-child'
    const parentType = 'invalid-record-parent'
    const ChildComponent = createPropertyComponentFromConfig({
      type: childType,
      defaults: { value: 0 },
      persistKeys: ['value'],
      valueKeys: ['value']
    })
    const parentDefinition = {
      type: parentType,
      defaults: { children: [] as string[] },
      persistKeys: ['children'],
      valueKeys: ['children'],
      children: {
        key: 'children',
        childType,
        mode: 'ids-or-objects' as const,
        collection: 'array-or-record' as const,
        toChildData: (item: Record<string, unknown>) => ({
          value: item.value
        })
      }
    }
    const ParentComponent = createPropertyComponentFromConfig(parentDefinition)
    registerPropertyComponent(childType, ChildComponent)
    registerPropertyComponent(
      parentType,
      ParentComponent,
      undefined,
      parentDefinition
    )
    registerPropertySchema({
      type: childType,
      fields: [
        {
          key: 'value',
          kind: 'number',
          validate: isFiniteNumber,
          defaultValue: 0
        }
      ]
    })
    const position = createProperty({
      id: 'invalid-record-position',
      type: PropertyTypes.POSITION,
      x: 1,
      y: 2,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    }) as PropertyComponentInstanceTypes
    const parent = createProperty({
      id: 'invalid-record-parent-id',
      type: parentType,
      children: []
    } as Partial<PropertyComponentRawData>) as PropertyComponentInstanceTypes
    propsManager.addToMap(position)
    propsManager.addToMap(parent)
    const before = propsManager.save()

    expect(() =>
      propsManager.updateProperties({
        operations: [
          {
            kind: 'values',
            propertyId: 'invalid-record-position',
            values: { x: 100 }
          },
          {
            kind: 'records',
            propertyId: 'invalid-record-parent-id',
            key: 'children',
            set: {
              'invalid-record-child-id': { value: 'invalid' }
            }
          }
        ]
      })
    ).toThrow(/invalid.*invalid-record-child-id\.value/i)

    expect(propsManager.save()).toEqual(before)
    expect(
      propsManager.getPropertyById('invalid-record-child-id')
    ).toBeUndefined()
    expect(propsManager.changes).toEqual([])
  })

  // Test commitChanges
  it('should commit changes and clean the changes array', () => {
    const { events, subscription } = captureUpdateTransactionEvents()
    const prepareTransactionEvents = vi.spyOn(
      propsManager,
      'prepareTransactionEvents'
    )
    const change1: PropsChange = {
      action: PROPS_ACTIONS.ADD_PROPERTY,
      undoType: ReactiveEventsModule.EventTypes.REMOVE_PROPERTY,
      undoAction: PROPS_ACTIONS.REMOVE_PROPERTY,
      eventName: ReactiveEventsModule.EventTypes.ADD_PROPERTY,
      data: []
    }
    const change2: PropsChange = {
      action: PROPS_ACTIONS.REMOVE_PROPERTY,
      undoType: ReactiveEventsModule.EventTypes.ADD_PROPERTY,
      undoAction: PROPS_ACTIONS.ADD_PROPERTY,
      eventName: ReactiveEventsModule.EventTypes.REMOVE_PROPERTY,
      data: []
    }
    propsManager.addChange(change1)
    propsManager.addChange(change2)

    propsManager.commitChanges()

    expect(prepareTransactionEvents).toHaveBeenCalledTimes(1)
    expect(events).toHaveLength(2)
    expect(events[0]).toEqual(
      expect.objectContaining({
        type: ReactiveEventsModule.EventTypes.UPDATE_TRANSACTION,
        eventName: change1.eventName,
        payload: change1,
        options: { shared: SharedDataChannelNames.PROPS }
      })
    )
    expect(events[1]).toEqual(
      expect.objectContaining({
        type: ReactiveEventsModule.EventTypes.UPDATE_TRANSACTION,
        eventName: change2.eventName,
        payload: change2,
        options: { shared: SharedDataChannelNames.PROPS }
      })
    )
    expect(propsManager.changes).toEqual([])
    subscription.unsubscribe()
  })

  it('prepares routed transaction events without consuming pending changes', () => {
    const change = {
      eventName: ReactiveEventsModule.EventTypes.ADD_PROPERTY,
      action: PROPS_ACTIONS.ADD_PROPERTY,
      undoType: ReactiveEventsModule.EventTypes.REMOVE_PROPERTY,
      undoAction: PROPS_ACTIONS.REMOVE_PROPERTY,
      data: []
    } as AddRemovePropertyChange
    propsManager.addChange(change)
    const prepare = (
      propsManager as PropsManager & {
        prepareTransactionEvents(options?: {
          rollbackable?: boolean
        }): readonly {
          eventName: string
          payload: PropsChange
          options: {
            rollbackable?: boolean
            shared?: string
          }
          canonicalEvidence: {
            orderedIds: readonly string[]
          }
        }[]
      }
    ).prepareTransactionEvents

    expect(prepare.call(propsManager, { rollbackable: false })).toEqual([
      {
        type: ReactiveEventsModule.EventTypes.UPDATE_TRANSACTION,
        eventName: ReactiveEventsModule.EventTypes.ADD_PROPERTY,
        payload: change,
        options: {
          rollbackable: false,
          shared: SharedDataChannelNames.PROPS
        },
        canonicalEvidence: {
          orderedIds: []
        }
      }
    ])
    expect(propsManager.changes).toEqual([change])
  })

  it('prepares no Props delivery for property-free element batches', () => {
    expect(
      propsManager.prepareCanonicalElementTransactionEvents({
        rollbackable: false
      })
    ).toEqual([])
    expect(propsManager.changes).toEqual([])
  })

  it('creates one Props-owned relationship delivery record per element owner', () => {
    const sharedChild = new PositionComponent({
      id: 'delivery-shared-child',
      x: 10,
      y: 20
    }).save()
    const firstRoot = new CustomComponent({
      id: 'delivery-first-root',
      children: ['delivery-shared-child']
    } as unknown as Partial<PropertyComponentInstanceDataTypes>).save()
    const secondRoot = new CustomComponent({
      id: 'delivery-second-root',
      children: ['delivery-shared-child']
    } as unknown as Partial<PropertyComponentInstanceDataTypes>).save()
    const change: AddRemovePropertyChange = {
      eventName: ReactiveEventsModule.EventTypes.ADD_PROPERTY,
      action: PROPS_ACTIONS.ADD_PROPERTY,
      undoType: ReactiveEventsModule.EventTypes.REMOVE_PROPERTY,
      undoAction: PROPS_ACTIONS.REMOVE_PROPERTY,
      data: [sharedChild, secondRoot, firstRoot]
    }
    const createRecords = (
      propsManager as PropsManager & {
        createCanonicalPropertyDeliveryRecords(
          change: AddRemovePropertyChange,
          owners: readonly {
            orderedId: string
            rootPropertyIds: readonly string[]
          }[]
        ): readonly {
          orderedIds: readonly string[]
          payload: AddRemovePropertyChange
        }[]
      }
    ).createCanonicalPropertyDeliveryRecords

    expect(
      createRecords.call(propsManager, change, [
        {
          orderedId: 'delivery-first-element',
          rootPropertyIds: ['delivery-first-root']
        },
        {
          orderedId: 'delivery-second-element',
          rootPropertyIds: ['delivery-second-root']
        },
        {
          orderedId: 'delivery-property-free-element',
          rootPropertyIds: []
        }
      ])
    ).toEqual([
      {
        orderedIds: ['delivery-first-element'],
        payload: {
          ...change,
          data: [sharedChild, firstRoot]
        }
      },
      {
        orderedIds: ['delivery-second-element'],
        payload: {
          ...change,
          data: [secondRoot]
        }
      },
      {
        orderedIds: ['delivery-property-free-element'],
        payload: {
          ...change,
          data: []
        }
      }
    ])
  })

  it('preflights element property values against Props-owned schemas', () => {
    const definitions: readonly PropertyDefinition[] = [
      {
        name: PropertyTypes.POSITION,
        type: PropertyTypes.POSITION,
        alias: ['x', 'y']
      }
    ]
    const preflight = (
      propsManager as PropsManager & {
        preflightElementPropertyValues(
          definitions: readonly PropertyDefinition[],
          data: Readonly<Record<string, unknown>>
        ): void
      }
    ).preflightElementPropertyValues

    expect(() =>
      preflight.call(propsManager, definitions, {
        id: 'valid-element',
        type: 'rect',
        x: 10,
        y: 20
      })
    ).not.toThrow()
    expect(() =>
      preflight.call(propsManager, definitions, {
        id: 'invalid-element',
        type: 'rect',
        x: 'invalid',
        y: 20
      })
    ).toThrow(/invalid.*x/i)
    expect(() =>
      preflight.call(propsManager, definitions, {
        id: 'non-finite-element',
        type: 'rect',
        x: Number.NaN,
        y: 20
      })
    ).toThrow(/invalid.*x.*non-finite number/i)
    expect(propsManager.save()).toEqual({})
    expect(propsManager.changes).toEqual([])
  })

  it('should commit per-change options to updateTransaction', () => {
    const { events, subscription } = captureUpdateTransactionEvents()
    const change: PropsChange = {
      action: PROPS_ACTIONS.UPDATE_PROPERTY,
      eventName: ReactiveEventsModule.EventTypes.UPDATE_PROPERTY,
      id: 'option-position',
      key: 'x',
      before: 1,
      after: 2,
      options: { undoable: false }
    }
    propsManager.addChange(change)

    propsManager.commitChanges()

    expect(events).toEqual([
      expect.objectContaining({
        type: ReactiveEventsModule.EventTypes.UPDATE_TRANSACTION,
        eventName: change.eventName,
        payload: change,
        options: {
          undoable: false,
          shared: SharedDataChannelNames.PROPS
        }
      })
    ])
    expect(propsManager.changes).toEqual([])
    subscription.unsubscribe()
  })

  it('reuses owner-issued add snapshots and rematerializes only updated components', () => {
    const unchanged = createProperty({
      id: 'pp-unchanged',
      type: PropertyTypes.CUSTOM,
      children: ['child-a']
    }) as PropertyComponentInstanceTypes
    const updated = createProperty({
      id: 'pp-updated',
      type: PropertyTypes.POSITION,
      x: 0,
      y: 0,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    }) as PropertyComponentInstanceTypes
    const unchangedSave = vi.fn(unchanged.save.bind(unchanged))
    const updatedSave = vi.fn(updated.save.bind(updated))
    unchanged.save = unchangedSave
    updated.save = updatedSave
    propsManager.addToMap(unchanged)
    propsManager.addToMap(updated)
    propsManager.addChangeForAddProperty(unchanged)
    propsManager.addChangeForAddProperty(updated)

    updated.load({
      id: 'pp-updated',
      type: PropertyTypes.POSITION,
      x: 120,
      y: 240,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    })
    propsManager.addChange({
      action: PROPS_ACTIONS.UPDATE_PROPERTY,
      eventName: ReactiveEventsModule.EventTypes.UPDATE_PROPERTY,
      id: 'pp-updated',
      key: 'x',
      before: 0,
      after: 120
    })

    const { events, subscription } = captureUpdateTransactionEvents()
    propsManager.commitChanges()

    expect(unchangedSave).toHaveBeenCalledTimes(1)
    expect(updatedSave).toHaveBeenCalledTimes(2)
    expect(events).toHaveLength(1)
    expect(
      (events[0]?.payload as { data: Record<string, unknown>[] }).data
    ).toEqual([
      expect.objectContaining({
        id: 'pp-unchanged',
        children: ['child-a']
      }),
      expect.objectContaining({
        id: 'pp-updated',
        x: 120,
        y: 240
      })
    ])

    unchanged.load({
      id: 'pp-unchanged',
      type: PropertyTypes.CUSTOM,
      children: ['child-b']
    })
    expect(
      (events[0]?.payload as { data: Record<string, unknown>[] }).data[0]
    ).toMatchObject({ id: 'pp-unchanged', children: ['child-a'] })
    subscription.unsubscribe()
  })

  it('commits one final canonical property batch for newly created components', () => {
    const position = createProperty({
      id: 'pp-position',
      type: PropertyTypes.POSITION,
      x: 0,
      y: 0,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    }) as PropertyComponentInstanceTypes
    const related = createProperty({
      id: 'pp-related',
      type: PropertyTypes.CUSTOM,
      children: ['pp-position']
    }) as PropertyComponentInstanceTypes
    propsManager.addToMap(position)
    propsManager.addToMap(related)
    propsManager.addChangeForAddProperty(position)
    propsManager.addChangeForAddProperty(related)

    position.load({
      id: 'pp-position',
      type: PropertyTypes.POSITION,
      x: 120,
      y: 240,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    })
    propsManager.addChange({
      action: PROPS_ACTIONS.UPDATE_PROPERTY,
      eventName: ReactiveEventsModule.EventTypes.UPDATE_PROPERTY,
      id: 'pp-position',
      key: 'x',
      before: 0,
      after: 120
    })
    propsManager.addChange({
      action: PROPS_ACTIONS.UPDATE_PROPERTY,
      eventName: ReactiveEventsModule.EventTypes.UPDATE_PROPERTY,
      id: 'pp-position',
      key: 'y',
      before: 0,
      after: 240
    })

    const { events, subscription } = captureUpdateTransactionEvents()
    propsManager.commitChanges()

    expect(events).toEqual([
      expect.objectContaining({
        eventName: ReactiveEventsModule.EventTypes.ADD_PROPERTY,
        payload: expect.objectContaining({
          action: PROPS_ACTIONS.ADD_PROPERTY,
          data: [position.save(), related.save()]
        }),
        options: { shared: SharedDataChannelNames.PROPS }
      })
    ])
    position.load({
      id: 'pp-position',
      type: PropertyTypes.POSITION,
      x: 999,
      y: 240,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    })
    expect(
      (events[0]?.payload as { data: Record<string, unknown>[] }).data[0]
    ).toMatchObject({ id: 'pp-position', x: 120, y: 240 })
    subscription.unsubscribe()
  })

  it('preserves separate property deliveries across mutation option boundaries', () => {
    const position = createProperty({
      id: 'pp-option-position',
      type: PropertyTypes.POSITION
    }) as PropertyComponentInstanceTypes
    const dimension = createProperty({
      id: 'pp-option-dimension',
      type: PropertyTypes.DIMENSION
    }) as PropertyComponentInstanceTypes
    propsManager.addToMap(position)
    propsManager.addToMap(dimension)
    propsManager.addChangeForAddProperty(position)
    propsManager.addChangeForAddProperty(dimension)
    propsManager.changes[1].options = { undoable: false }

    const { events, subscription } = captureUpdateTransactionEvents()
    propsManager.commitChanges()

    expect(events).toHaveLength(2)
    expect(events.map(({ eventName }) => eventName)).toEqual([
      ReactiveEventsModule.EventTypes.ADD_PROPERTY,
      ReactiveEventsModule.EventTypes.ADD_PROPERTY
    ])
    expect(events[0].options).toEqual({
      shared: SharedDataChannelNames.PROPS
    })
    expect(events[1].options).toEqual({
      undoable: false,
      shared: SharedDataChannelNames.PROPS
    })
    subscription.unsubscribe()
  })

  it('folds a newly created property update into its source-only add evidence', () => {
    const position = createProperty({
      id: 'pp-owner-position',
      type: PropertyTypes.POSITION,
      x: 0
    }) as PropertyComponentInstanceTypes
    propsManager.addToMap(position)
    propsManager.addChangeForAddProperty(position)
    position.load({
      id: 'pp-owner-position',
      type: PropertyTypes.POSITION,
      x: 12
    })
    propsManager.addChange({
      action: PROPS_ACTIONS.UPDATE_PROPERTY,
      eventName: ReactiveEventsModule.EventTypes.UPDATE_PROPERTY,
      id: 'pp-owner-position',
      key: 'x',
      before: 0,
      after: 12
    })

    const { events, subscription } = captureUpdateTransactionEvents()
    propsManager.commitChanges()

    expect(events).toHaveLength(1)
    expect(events[0]).toEqual(
      expect.objectContaining({
        eventName: ReactiveEventsModule.EventTypes.ADD_PROPERTY,
        payload: expect.objectContaining({
          data: [
            expect.objectContaining({
              id: 'pp-owner-position',
              x: 12
            })
          ]
        })
      })
    )
    expect(events[0]?.canonicalEvidence).toEqual({
      orderedIds: ['pp-owner-position']
    })
    expect(events[0]?.payload).not.toHaveProperty('ownerElementId')
    expect(events[0]?.payload).not.toHaveProperty('ownerPropertyName')
    subscription.unsubscribe()
  })

  it('preserves an invalid update-before-add delivery order for downstream rejection', () => {
    const position = createProperty({
      id: 'pp-out-of-order',
      type: PropertyTypes.POSITION,
      x: 12
    }) as PropertyComponentInstanceTypes
    propsManager.addToMap(position)
    propsManager.addChange({
      action: PROPS_ACTIONS.UPDATE_PROPERTY,
      eventName: ReactiveEventsModule.EventTypes.UPDATE_PROPERTY,
      id: 'pp-out-of-order',
      key: 'x',
      before: 0,
      after: 12
    })
    propsManager.addChangeForAddProperty(position)

    const { events, subscription } = captureUpdateTransactionEvents()
    propsManager.commitChanges()

    expect(events.map(({ eventName }) => eventName)).toEqual([
      ReactiveEventsModule.EventTypes.UPDATE_PROPERTY,
      ReactiveEventsModule.EventTypes.ADD_PROPERTY
    ])
    subscription.unsubscribe()
  })

  it('should reject invalid numeric value by schema in updatePropsData', () => {
    const positionData = {
      id: 'pp-1',
      type: PropertyTypes.POSITION,
      x: 10,
      y: 20,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    }
    const positionComponent = createProperty(
      positionData
    ) as PropertyComponentInstanceTypes
    propsManager.addToMap(positionComponent)

    propsManager.updatePropsData(
      'pp-1',
      'x' as unknown as keyof PropertyComponentInstanceDataTypes,
      '中文' as unknown as PropertyComponentInstanceDataTypes[keyof PropertyComponentInstanceDataTypes]
    )

    const position = positionComponent as unknown as {
      get: (key: string) => unknown
    }
    expect(position.get('x')).toBe(10)
  })

  it('should fallback to default value when loading invalid field data', () => {
    const positionComponent = createProperty({
      id: 'pp-1',
      type: PropertyTypes.POSITION,
      x: '中文',
      y: null,
      xUnit: 'invalid-unit',
      yUnit: Unit.PERCENT
    }) as PropertyComponentInstanceTypes

    const position = positionComponent as unknown as {
      get: (key: string) => unknown
    }
    expect(position.get('x')).toBe(0)
    expect(position.get('y')).toBe(0)
    expect(position.get('xUnit')).toBe(Unit.PX)
    expect(position.get('yUnit')).toBe(Unit.PERCENT)
  })

  it('load should replace the entire props snapshot and remove stale components', () => {
    propsManager.load({
      'pp-old': {
        id: 'pp-old',
        type: PropertyTypes.POSITION,
        x: 0,
        y: 0,
        xUnit: Unit.PX,
        yUnit: Unit.PX
      }
    })
    expect(propsManager.getPropertyById('pp-old')).toBeDefined()

    // The second load is a new full snapshot. Old IDs not present in this payload
    // must be removed from runtime state (replace semantics, not merge semantics).
    propsManager.load({
      'pp-new': {
        id: 'pp-new',
        type: PropertyTypes.DIMENSION,
        width: 100,
        height: 100,
        widthUnit: Unit.PX,
        heightUnit: Unit.PX
      }
    })

    expect(propsManager.getPropertyById('pp-old')).toBeUndefined()
    expect(propsManager.getPropertyById('pp-new')).toBeDefined()
  })

  it('validateLoadData should keep valid entries and report malformed props entries', () => {
    const { data, diagnostics } = propsManager.validateLoadData({
      'pp-valid': {
        id: 'pp-valid',
        type: PropertyTypes.POSITION,
        x: 1,
        y: 2,
        xUnit: Unit.PX,
        yUnit: Unit.PX
      },
      'pp-invalid-shape': 'invalid',
      'pp-invalid-type': { id: 'pp-invalid-type', type: 123 }
    })

    expect(Object.keys(data)).toEqual(['pp-valid'])
    expect(diagnostics).toHaveLength(2)
    expect(diagnostics.map((item) => item.path)).toEqual([
      'props.pp-invalid-shape',
      'props.pp-invalid-type.type'
    ])
  })

  it('applies only its own one-shot validated artifact without rerunning validation', () => {
    const validation = propsManager.validateLoadData({
      'pp-valid': {
        id: 'pp-valid',
        type: PropertyTypes.POSITION,
        x: 1,
        y: 2,
        xUnit: Unit.PX,
        yUnit: Unit.PX
      }
    })
    const foreignManager = new PropsManager()
    const forged = {
      data: validation.data,
      diagnostics: validation.diagnostics
    }

    validation.data['pp-valid'].type = 'unregistered-after-validation'
    propsManager.validateLoadData = vi.fn(() => {
      throw new Error('validation must not rerun during apply')
    })

    expect(() => foreignManager.applyValidatedLoad(validation)).toThrow(
      /owner-issued.*artifact/i
    )
    expect(() =>
      propsManager.applyValidatedLoad(forged as typeof validation)
    ).toThrow(/owner-issued.*artifact/i)

    propsManager.applyValidatedLoad(validation)

    expect(propsManager.validateLoadData).not.toHaveBeenCalled()
    expect(propsManager.getPropertyById('pp-valid')?.get('type')).toBe(
      PropertyTypes.POSITION
    )
    expect(() => propsManager.applyValidatedLoad(validation)).toThrow(
      /owner-issued.*artifact/i
    )
  })
})
