import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as ReactiveEventsModule from '@asyra/reactive-events'
import {
  PROPS_ACTIONS,
  PropertyComponentInstanceTypes,
  PropertyComponentInstanceDataTypes,
  PropertyTypes,
  Unit,
  PropsChange
} from '@asyra/utils'
import { PropsManager } from '../props-manager'
import { createProperty } from '../utils'

vi.mock('@asyra/reactive-events', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@asyra/reactive-events')>()

  return {
    ...actual,
    updateTransaction: vi.fn()
  }
})

describe('PropsManager', () => {
  let propsManager: PropsManager

  beforeEach(() => {
    vi.clearAllMocks()

    propsManager = new PropsManager()
  })

  // Test load and save
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

    expect(propsManager.getComponentById('pp-1')?.get('id')).toBe('pp-1')
    expect(propsManager.getComponentById('pp-2')?.get('id')).toBe('pp-2')
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

    expect(propsManager.getComponentById('pp-1')).toBe(p1Component)
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

  // Test commitChanges
  it('should commit changes and clean the changes array', () => {
    const change1 = {
      eventName: ReactiveEventsModule.EventTypes.ADD_PROPERTY
    } as unknown as PropsChange
    const change2 = {
      eventName: ReactiveEventsModule.EventTypes.REMOVE_PROPERTY
    } as unknown as PropsChange
    propsManager.addChange(change1)
    propsManager.addChange(change2)

    propsManager.commitChanges()

    expect(ReactiveEventsModule.updateTransaction).toHaveBeenCalledTimes(2)
    expect(ReactiveEventsModule.updateTransaction).toHaveBeenCalledWith(
      change1.eventName,
      change1
    )
    expect(ReactiveEventsModule.updateTransaction).toHaveBeenCalledWith(
      change2.eventName,
      change2
    )
    expect(propsManager.changes).toEqual([])
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
})
