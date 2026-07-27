import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as ReactiveEventsModule from '@asyra/reactive-events'
import {
  PROPS_ACTIONS,
  PropertyComponentRawData,
  PropertyComponentInstanceTypes,
  PropertyComponentInstanceDataTypes,
  PropertySchema,
  PropertyTypes,
  Unit,
  SharedDataChannelNames,
  PropsChange,
  type AddRemovePropertyChange,
  type BasePropertyAttrs,
  type DataTypes
} from '@asyra/utils'
import { BasePropertyComponent } from '../components'
import { PropsManager } from '../manager/props-manager'
import { getPropertyComponentAccessor } from '../manager/component-accessor'
import { createProperty } from '../factories/create-property'
import elementPropertyRegistry, {
  type PropertyDefinition
} from '../registries/property-definition'
import {
  propertySchemaRegistry,
  registerPropertySchema
} from '../registries/property-schema'
import {
  propertyComponentRegistry,
  registerPropertyComponent
} from '../registries/property-component'
import { createPropertyComponentFromConfig } from '../registries/declarative-property-type'
import {
  PositionComponent,
  DimensionComponent,
  CustomComponent,
  AnchorPointComponent,
  AnchorPointsComponent
} from './helpers/test-property-components'

interface UpdateTransactionEvent {
  type: string
  eventName: string
  payload: unknown
  options?: {
    undoable?: boolean
    shared?: string
  }
}

interface BrowserDragPhaseRuntime {
  __asyraBrowserDragPhaseSink?: (name: string, durationMs: number) => void
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

  it('applies one owner-issued canonical property creation plan with child-first evidence', () => {
    const child = new PositionComponent({
      id: 'planned-child',
      x: 12,
      y: 24
    }).save()
    const parent = new CustomComponent({
      id: 'planned-parent',
      children: ['planned-child']
    } as unknown as Partial<PropertyComponentInstanceDataTypes>).save()
    const getPropertyById = vi.spyOn(propsManager, 'getPropertyById')
    const plan = propsManager.preflightPropertyCreationBatch(
      [child, parent],
      ['planned-parent', 'planned-parent']
    )
    const redundantActiveLookupCount = getPropertyById.mock.calls.length
    getPropertyById.mockRestore()
    const createProperty = vi.spyOn(propsManager, 'createProperty')
    const addProperty = vi.spyOn(propsManager, 'addProperty')
    const addToMap = vi.spyOn(propsManager, 'addToMap')

    expect(redundantActiveLookupCount).toBe(0)
    const appliedIds = propsManager.runInPropertyCreationBatch(() =>
      propsManager.applyPropertyCreationBatch(plan)
    ).result
    const singleDispatchCounts = {
      addProperty: addProperty.mock.calls.length,
      addToMap: addToMap.mock.calls.length,
      createProperty: createProperty.mock.calls.length
    }
    createProperty.mockRestore()
    addProperty.mockRestore()
    addToMap.mockRestore()

    expect(appliedIds).toEqual(['planned-child', 'planned-parent'])
    expect(singleDispatchCounts).toEqual({
      addProperty: 0,
      addToMap: 0,
      createProperty: 0
    })
    expect(() =>
      propsManager.runInPropertyCreationBatch(() =>
        propsManager.applyPropertyCreationBatch(plan)
      )
    ).toThrow(/one-shot property creation plan/i)
    expect(propsManager.save()).toEqual({
      'planned-child': child,
      'planned-parent': parent
    })
    expect(propsManager.changes).toEqual([
      expect.objectContaining({
        action: PROPS_ACTIONS.ADD_PROPERTY,
        data: [child, parent]
      })
    ])
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
      const plan = propsManager.preflightPropertyCreationBatch(
        source,
        source.map(({ id }) => id)
      )
      propsManager
        .runInPropertyCreationBatch(() =>
          propsManager.applyPropertyCreationBatch(plan)
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
        plan: object
      ): { result: T; rollback(): void; complete(): void }
    }
    const plan = ordinaryBatchOwner.preflightOrdinaryPropertyCreationBatch([
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
    }, plan)

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
    const children = {
      'record-map-child-a': { x: 10, y: 20 },
      'record-map-child-b': { x: 30, y: 40 }
    }
    const plan = validManager.preflightOrdinaryPropertyCreationBatch([
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
    const receipt = validManager.runInPropertyCreationBatch(() => {
      const parent = validManager.createProperty({
        id: 'record-map-parent',
        type: parentType,
        children
      } as Partial<PropertyComponentRawData>)
      return validManager.addProperty([parent])
    }, plan)

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
      const plan = propsManager.preflightOrdinaryPropertyCreationBatch([
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
      }, plan)
    }).toThrow(/reserved property id/i)

    expect(materializationAttempts).toBe(0)
    expect(registerMany).not.toHaveBeenCalled()
    expect(propsManager.save()).toEqual({})
    expect(propsManager.changes).toEqual([])
  })

  it('allows an ordinary relationship string to reference a same-batch requested root with the required type', () => {
    const parentType = 'ordinary-planned-root-parent'
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
    const plan = propsManager.preflightOrdinaryPropertyCreationBatch([
      {
        definitions: [
          { name: 'standalone', type: PropertyTypes.POSITION },
          { name: 'children', type: parentType, defaultValue: [] }
        ],
        data: {
          children: ['ordinary-planned-root-child']
        },
        propertyIds: {
          standalone: 'ordinary-planned-root-child',
          children: 'ordinary-planned-root-parent'
        }
      }
    ])

    const receipt = propsManager.runInPropertyCreationBatch(() => {
      const child = propsManager.createProperty({
        id: 'ordinary-planned-root-child',
        type: PropertyTypes.POSITION,
        x: 10,
        y: 20
      })
      const parent = propsManager.createProperty({
        id: 'ordinary-planned-root-parent',
        type: parentType,
        children: ['ordinary-planned-root-child']
      })
      return propsManager.addProperty([child, parent])
    }, plan)

    expect(receipt.result).toEqual({
      [PropertyTypes.POSITION]: 'ordinary-planned-root-child',
      [parentType]: 'ordinary-planned-root-parent'
    })
    expect(registerMany).toHaveBeenCalledTimes(1)
    expect(
      propsManager.getPropertyById('ordinary-planned-root-parent')?.save()
    ).toEqual({
      id: 'ordinary-planned-root-parent',
      type: parentType,
      children: ['ordinary-planned-root-child']
    })
    receipt.complete()
  })

  it('rejects an ordinary relationship string when its same-batch requested root has the wrong type', () => {
    const parentType = 'ordinary-wrong-planned-root-parent'
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
      const plan = propsManager.preflightOrdinaryPropertyCreationBatch([
        {
          definitions: [
            { name: 'standalone', type: PropertyTypes.DIMENSION },
            { name: 'children', type: parentType, defaultValue: [] }
          ],
          data: {
            children: ['ordinary-wrong-planned-root-child']
          },
          propertyIds: {
            standalone: 'ordinary-wrong-planned-root-child',
            children: 'ordinary-wrong-planned-root-parent'
          }
        }
      ])
      propsManager.runInPropertyCreationBatch(() => {
        materializationAttempts += 1
      }, plan)
    }).toThrow(/relationship child.*wrong type/i)

    expect(materializationAttempts).toBe(0)
    expect(registerMany).not.toHaveBeenCalled()
    expect(propsManager.save()).toEqual({})
    expect(propsManager.changes).toEqual([])
  })

  it('preserves and validates a new ordinary requested root id through finalize', () => {
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
    const mismatchedPlan =
      propsManager.preflightOrdinaryPropertyCreationBatch(owners)
    const registerMany = vi.spyOn(propsManager, 'registerMany')

    expect(() =>
      propsManager.runInPropertyCreationBatch(() => {
        const property = propsManager.createProperty({
          id: 'ordinary-unrequested-position',
          type: PropertyTypes.POSITION,
          x: 10,
          y: 20
        })
        propsManager.addProperty([property])
      }, mismatchedPlan)
    ).toThrow(/changed owner property/i)

    expect(registerMany).not.toHaveBeenCalled()
    expect(propsManager.save()).toEqual({})
    expect(propsManager.changes).toEqual([])

    const matchingPlan =
      propsManager.preflightOrdinaryPropertyCreationBatch(owners)
    const receipt = propsManager.runInPropertyCreationBatch(() => {
      const property = propsManager.createProperty({
        id: 'ordinary-requested-position',
        type: PropertyTypes.POSITION,
        x: 10,
        y: 20
      })
      return propsManager.addProperty([property])
    }, matchingPlan)

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
    const plan = propsManager.preflightOrdinaryPropertyCreationBatch([
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
    }, plan)
    const replacementId = receipt.result[PropertyTypes.POSITION]

    expect(replacementId).toBeDefined()
    expect(replacementId).not.toBe('ordinary-missing-position')
    expect(propsManager.getPropertyById(replacementId)).toBeDefined()
    expect(propsManager.getPropertyById('ordinary-missing-position')).toBe(
      undefined
    )
    receipt.complete()
  })

  it('rolls back an ordinary property graph when a relationship contract drifts during materialization', () => {
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
        plan: object
      ): { result: T; rollback(): void; complete(): void }
    }
    const plan = ordinaryBatchOwner.preflightOrdinaryPropertyCreationBatch([
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

    expect(() =>
      ordinaryBatchOwner.runInPropertyCreationBatch(() => {
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
      }, plan)
    ).toThrow(/registration changed/i)

    expect(registerMany).not.toHaveBeenCalled()
    expect(propsManager.save()).toEqual({})
    expect(propsManager.changes).toEqual([])
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
    const runtime = globalThis as typeof globalThis & BrowserDragPhaseRuntime
    const previousSink = runtime.__asyraBrowserDragPhaseSink
    runtime.__asyraBrowserDragPhaseSink = (name) => {
      if (name.startsWith('props-manager:')) {
        phaseNames.push(name)
      }
    }

    try {
      const creationPlan = propsManager.preflightPropertyCreationBatch(
        [child, parent],
        ['profiled-property-parent']
      )
      propsManager
        .runInPropertyCreationBatch(() =>
          propsManager.applyPropertyCreationBatch(creationPlan)
        )
        .complete()
      const activePlan = propsManager.preflightActivePropertyBatch(
        [parent, child],
        ['profiled-property-parent']
      )
      propsManager.runInActivePropertyBatch(activePlan, () => undefined)
    } finally {
      if (previousSink) {
        runtime.__asyraBrowserDragPhaseSink = previousSink
      } else {
        delete runtime.__asyraBrowserDragPhaseSink
      }
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
    const runtime = globalThis as typeof globalThis & BrowserDragPhaseRuntime
    const previousSink = runtime.__asyraBrowserDragPhaseSink
    runtime.__asyraBrowserDragPhaseSink = () => {
      throw new Error('diagnostic sink failure')
    }

    try {
      const creationPlan = propsManager.preflightPropertyCreationBatch(
        [child, parent],
        ['observer-safe-property-parent']
      )
      propsManager
        .runInPropertyCreationBatch(() =>
          propsManager.applyPropertyCreationBatch(creationPlan)
        )
        .complete()
      const activePlan = propsManager.preflightActivePropertyBatch(
        [parent, child],
        ['observer-safe-property-parent']
      )
      expect(
        propsManager.runInActivePropertyBatch(activePlan, () => 'observer-safe')
      ).toBe('observer-safe')
    } finally {
      if (previousSink) {
        runtime.__asyraBrowserDragPhaseSink = previousSink
      } else {
        delete runtime.__asyraBrowserDragPhaseSink
      }
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
    const runtime = globalThis as typeof globalThis & BrowserDragPhaseRuntime
    const previousSink = runtime.__asyraBrowserDragPhaseSink
    const phaseNames: string[] = []
    runtime.__asyraBrowserDragPhaseSink = (name) => {
      if (name.startsWith('props-manager:')) {
        phaseNames.push(name)
      }
    }
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
      if (previousSink) {
        runtime.__asyraBrowserDragPhaseSink = previousSink
      } else {
        delete runtime.__asyraBrowserDragPhaseSink
      }
    }

    expect(phaseNames).toEqual([
      'props-manager:creation-preflight',
      'props-manager:active-preflight-clone',
      'props-manager:active-preflight'
    ])
  })

  it('does not read the profiling clock when no timing observer is installed', () => {
    const runtime = globalThis as typeof globalThis & BrowserDragPhaseRuntime
    const previousSink = runtime.__asyraBrowserDragPhaseSink
    delete runtime.__asyraBrowserDragPhaseSink
    const performanceNow = vi.spyOn(performance, 'now')
    const child = new PositionComponent({
      id: 'unprofiled-property-child',
      x: 2,
      y: 6
    }).save()

    try {
      const creationPlan = propsManager.preflightPropertyCreationBatch(
        [child],
        ['unprofiled-property-child']
      )
      propsManager
        .runInPropertyCreationBatch(() =>
          propsManager.applyPropertyCreationBatch(creationPlan)
        )
        .complete()
      const activePlan = propsManager.preflightActivePropertyBatch(
        [child],
        ['unprofiled-property-child']
      )
      propsManager.runInActivePropertyBatch(activePlan, () => undefined)

      expect(performanceNow).not.toHaveBeenCalled()
    } finally {
      performanceNow.mockRestore()
      if (previousSink) {
        runtime.__asyraBrowserDragPhaseSink = previousSink
      }
    }
  })

  it('rejects invalid canonical property graphs and one-shot plan misuse without mutation', () => {
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

    const plan = propsManager.preflightPropertyCreationBatch(
      [child, parent],
      ['graph-parent']
    )
    expect(() => propsManager.applyPropertyCreationBatch(plan)).toThrow(
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
    const plan = propsManager.preflightPropertyCreationBatch(
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
        propsManager.applyPropertyCreationBatch(plan)
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
    const plan = propsManager.preflightPropertyCreationBatch(
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
        propsManager.applyPropertyCreationBatch(plan)
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
    const plan = propsManager.preflightPropertyCreationBatch(
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
        propsManager.applyPropertyCreationBatch(plan)
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
      const plan = propsManager.preflightPropertyCreationBatch(
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
          propsManager.applyPropertyCreationBatch(plan)
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
    const plan = propsManager.preflightPropertyCreationBatch(
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
        propsManager.applyPropertyCreationBatch(plan)
      )
    ).toThrow(/registration changed/i)

    expect(construction).not.toHaveBeenCalled()
    construction.mockRestore()
    expect(propsManager.save()).toEqual({})
    expect(propsManager.changes).toEqual([])
  })

  it('keeps a schema-free plan valid when unrelated active schemas are cleared', () => {
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
    const plan = propsManager.preflightPropertyCreationBatch(
      source,
      source.map(({ id }) => id)
    )

    propertySchemaRegistry.clear()
    propsManager
      .runInPropertyCreationBatch(() =>
        propsManager.applyPropertyCreationBatch(plan)
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
    const plan = propsManager.preflightPropertyCreationBatch(
      source,
      source.map(({ id }) => id)
    )

    expect(() =>
      propsManager.runInPropertyCreationBatch(() =>
        propsManager.applyPropertyCreationBatch(plan)
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
    const plan = propsManager.preflightPropertyCreationBatch(
      source,
      source.map(({ id }) => id)
    )

    expect(() =>
      propsManager.runInPropertyCreationBatch(() =>
        propsManager.applyPropertyCreationBatch(plan)
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
    const plan = propsManager.preflightPropertyCreationBatch(
      source,
      source.map(({ id }) => id)
    )

    expect(() =>
      propsManager.runInPropertyCreationBatch(() =>
        propsManager.applyPropertyCreationBatch(plan)
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
    const plan = propsManager.preflightPropertyCreationBatch(
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
        propsManager.applyPropertyCreationBatch(plan)
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
    const plan = propsManager.preflightActivePropertyBatch(source, [
      'active-graph-parent',
      'active-graph-parent'
    ])

    expect(
      propsManager.runInActivePropertyBatch(plan, () => {
        propsManager.addProperty([parent])
        return ['active-graph-parent']
      })
    ).toEqual(['active-graph-parent'])
    expect(propsManager.getPropertyById('active-graph-child')).toBe(child)
    expect(propsManager.getPropertyById('active-graph-parent')).toBe(parent)
    expect(propsManager.save()).toEqual(before)
    expect(propsManager.changes).toEqual([])
    expect(() =>
      propsManager.runInActivePropertyBatch(plan, () => undefined)
    ).toThrow(/owner-issued one-shot active property plan/i)
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
    const plan = propsManager.preflightActivePropertyBatch(
      [active.save()],
      ['active-two-step-gap']
    )
    active.load({
      ...active.save(),
      x: 99
    } as never)
    const operation = vi.fn()

    expect(() =>
      propsManager.runInActivePropertyBatch(plan, operation)
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
    const plan = propsManager.preflightActivePropertyBatch(
      [parent.save(), child.save(), extra.save()],
      ['active-source-extra-parent']
    )

    expect(
      propsManager.runInActivePropertyBatch(plan, () => {
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
    const updatePlan = propsManager.preflightActivePropertyBatch(
      [active.save()],
      ['active-reuse-guard']
    )

    expect(() =>
      propsManager.runInActivePropertyBatch(updatePlan, () => {
        active.set('x' as never, 99 as never)
      })
    ).toThrow(/cannot update active property/i)
    expect(propsManager.save()).toEqual(before)
    expect(propsManager.changes).toEqual([])

    const creationPlan = propsManager.preflightActivePropertyBatch(
      [active.save()],
      ['active-reuse-guard']
    )
    expect(() =>
      propsManager.runInActivePropertyBatch(creationPlan, () => {
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
    const plan = propsManager.preflightActivePropertyBatch(
      [relationParent.save()],
      ['active-reuse-parent']
    )

    expect(() =>
      propsManager.runInActivePropertyBatch(plan, () => {
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
    const ownerRelations = [
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
    const apply = (manager: PropsManager, plan: ReturnType<typeof preflight>) =>
      (
        manager as unknown as {
          applyRestoreProperties: (
            artifact: ReturnType<typeof preflight>
          ) => readonly string[]
        }
      ).applyRestoreProperties(plan)

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

      const plan = preflight(propsManager, components)

      expect(plan.entries).toEqual([
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

    it('materializes exact data only in the issuing manager and consumes the plan once', () => {
      const exact = {
        id: 'custom-restore',
        type: PropertyTypes.CUSTOM,
        children: [],
        nested: { value: 42 }
      }
      const plan = preflight(propsManager, [exact])
      const otherManager = new PropsManager()

      expect(() => apply(otherManager, plan)).toThrow(/owner-issued one-shot/i)
      expect(otherManager.save()).toEqual({})

      expect(apply(propsManager, plan)).toEqual(['custom-restore'])
      expect(propsManager.save()).toEqual({
        'custom-restore': exact
      })
      expect(() => apply(propsManager, plan)).toThrow(/owner-issued one-shot/i)
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
      const plan = preflight(propsManager, [exact])

      apply(propsManager, plan)

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
      const plan = preflight(
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

      expect(() => apply(propsManager, plan)).toThrow(
        /restore constructor failed/i
      )
      expect(propsManager.save()).toEqual({})
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
      const plan = preflight(
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

      expect(apply(propsManager, plan)).toEqual(['probe-restore'])
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

  // Test commitChanges
  it('should commit changes and clean the changes array', () => {
    const { events, subscription } = captureUpdateTransactionEvents()
    const prepareTransactionEvents = vi.spyOn(
      propsManager,
      'prepareTransactionEvents'
    )
    const change1 = {
      eventName: ReactiveEventsModule.EventTypes.ADD_PROPERTY
    } as unknown as PropsChange
    const change2 = {
      eventName: ReactiveEventsModule.EventTypes.REMOVE_PROPERTY
    } as unknown as PropsChange
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
        }[]
      }
    ).prepareTransactionEvents

    expect(prepare.call(propsManager, { rollbackable: false })).toEqual([
      {
        eventName: ReactiveEventsModule.EventTypes.ADD_PROPERTY,
        payload: change,
        options: {
          rollbackable: false,
          shared: SharedDataChannelNames.PROPS
        }
      }
    ])
    expect(propsManager.changes).toEqual([change])
  })

  it('prepares one empty additive Props delivery for property-free element batches', () => {
    expect(
      propsManager.prepareCanonicalElementTransactionEvents({
        rollbackable: false
      })
    ).toEqual([
      {
        eventName: ReactiveEventsModule.EventTypes.ADD_PROPERTY,
        payload: {
          eventName: ReactiveEventsModule.EventTypes.ADD_PROPERTY,
          action: PROPS_ACTIONS.ADD_PROPERTY,
          undoType: ReactiveEventsModule.EventTypes.REMOVE_PROPERTY,
          undoAction: PROPS_ACTIONS.REMOVE_PROPERTY,
          data: []
        },
        options: {
          rollbackable: false,
          shared: SharedDataChannelNames.PROPS
        }
      }
    ])
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
    expect(propsManager.save()).toEqual({})
    expect(propsManager.changes).toEqual([])
  })

  it('should commit per-change options to updateTransaction', () => {
    const { events, subscription } = captureUpdateTransactionEvents()
    const change = {
      eventName: ReactiveEventsModule.EventTypes.UPDATE_PROPERTY,
      options: { undoable: false }
    } as unknown as PropsChange
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

  it('preserves owner-tagged updates for a newly created property', () => {
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
      after: 12,
      ownerElementId: 'owner-element',
      ownerPropertyName: 'position'
    })

    const { events, subscription } = captureUpdateTransactionEvents()
    propsManager.commitChanges()

    expect(events).toHaveLength(2)
    expect(events[1]).toEqual(
      expect.objectContaining({
        eventName: ReactiveEventsModule.EventTypes.UPDATE_PROPERTY,
        payload: expect.objectContaining({
          id: 'pp-owner-position',
          key: 'x',
          after: 12,
          ownerElementId: 'owner-element',
          ownerPropertyName: 'position'
        })
      })
    )
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
