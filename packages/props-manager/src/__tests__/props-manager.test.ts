import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as ReactiveEventsModule from '@asyra/reactive-events'
import {
  PROPS_ACTIONS,
  PropertyComponentInstanceTypes,
  PropertyComponentInstanceDataTypes,
  PropertySchema,
  PropertyTypes,
  Unit,
  SharedDataChannelNames,
  PropsChange
} from '@asyra/utils'
import { PropsManager } from '../manager/props-manager'
import { getPropertyComponentAccessor } from '../manager/component-accessor'
import { createProperty } from '../factories/create-property'
import elementPropertyRegistry from '../registries/property-definition'
import {
  propertySchemaRegistry,
  registerPropertySchema
} from '../registries/property-schema'
import {
  propertyComponentRegistry,
  registerPropertyComponent
} from '../registries/property-component'
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
    const change1 = {
      eventName: ReactiveEventsModule.EventTypes.ADD_PROPERTY
    } as unknown as PropsChange
    const change2 = {
      eventName: ReactiveEventsModule.EventTypes.REMOVE_PROPERTY
    } as unknown as PropsChange
    propsManager.addChange(change1)
    propsManager.addChange(change2)

    propsManager.commitChanges()

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
