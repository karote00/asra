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
import { createProperty } from '../factories/create-property'
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
  registerPropertyComponent(PropertyTypes.CUSTOM, CustomComponent)
  registerPropertyComponent(PropertyTypes.ANCHOR_POINT, AnchorPointComponent)
  registerPropertyComponent(PropertyTypes.ANCHOR_POINTS, AnchorPointsComponent)
}

describe('PropsManager', () => {
  let propsManager: PropsManager

  beforeEach(() => {
    vi.clearAllMocks()
    registerTestPropertyComponents()
    registerTestSchemas()

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
        data: Array<Record<string, unknown>>
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
