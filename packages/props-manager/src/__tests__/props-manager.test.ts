import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as ReactiveEventsModule from '@asra/reactive-events'
import {
  PROPS_ACTIONS,
  PropertyComponentInstanceTypes,
  PropertyComponentInstanceDataTypes,
  PropertyComponentRawData,
  PropertyTypes,
  Unit,
  PropsChange
} from '@asra/utils'

// Mock external dependencies - must be before imports
const { mockCreateProperty } = vi.hoisted(() => {
  return {
    mockCreateProperty: vi.fn()
  }
})

vi.mock('../utils', () => ({
  createProperty: mockCreateProperty
}))

vi.mock('@asra/reactive-events', () => ({
  updateTransaction: vi.fn(),
  EventTypes: {
    ADD_PROPERTY: 'ADD_PROPERTY',
    REMOVE_PROPERTY: 'REMOVE_PROPERTY'
  }
}))

// Import after mocks to ensure mocks are applied
import { PropsManager } from '../props-manager'

describe('PropsManager', () => {
  let propsManager: PropsManager
  let mockPropertyComponent: PropertyComponentInstanceTypes

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetAllMocks()

    mockPropertyComponent = {
      get: vi.fn((key: string) => {
        if (key === 'id') return 'prop-id-1'
        if (key === 'type') return PropertyTypes.POSITION
        return undefined
      }),
      save: vi.fn(() => ({ id: 'prop-id-1', type: PropertyTypes.POSITION })),
      set: vi.fn()
    } as unknown as PropertyComponentInstanceTypes

    mockCreateProperty.mockImplementation(
      (data: PropertyComponentRawData) =>
        ({
          get: vi.fn((key: string) => {
            if (key === 'id') return data.id || 'mock-prop-id'
            if (key === 'type') return data.type || PropertyTypes.POSITION
            return undefined
          }),
          save: vi.fn(() => data),
          set: vi.fn()
        }) as unknown as PropertyComponentInstanceTypes
    )

    propsManager = new PropsManager()
  })

  // Test load and save
  it('should load data correctly', () => {
    const dataToLoad = {
      'prop-id-1': {
        id: 'prop-id-1',
        type: PropertyTypes.POSITION,
        x: 0,
        y: 0,
        xUnit: Unit.PX,
        yUnit: Unit.PX
      },
      'prop-id-2': {
        id: 'prop-id-2',
        type: PropertyTypes.DIMENSION,
        width: 100,
        height: 100,
        widthUnit: Unit.PX,
        heightUnit: Unit.PX
      }
    }

    // Capture the instances returned by createProperty
    const createdProps: PropertyComponentInstanceTypes[] = []
    mockCreateProperty.mockImplementation((data: PropertyComponentRawData) => {
      const newMock = {
        get: vi.fn((key: string) => {
          if (key === 'id') return data.id || 'mock-prop-id'
          if (key === 'type') return data.type || PropertyTypes.POSITION
          return undefined
        }),
        save: vi.fn(() => data),
        set: vi.fn()
      } as unknown as PropertyComponentInstanceTypes
      createdProps.push(newMock)
      return newMock
    })

    propsManager.load(dataToLoad)

    expect(mockCreateProperty).toHaveBeenCalledTimes(2)
    expect(propsManager.getComponentById('prop-id-1')).toBe(createdProps[0])
    expect(propsManager.getComponentById('prop-id-2')).toBe(createdProps[1])
  })

  it('should save data correctly', () => {
    propsManager.addToMap(mockPropertyComponent)
    const savedData = propsManager.save()

    expect(mockPropertyComponent.save).toHaveBeenCalledTimes(1)
    expect(savedData['prop-id-1']).toEqual({
      id: 'prop-id-1',
      type: PropertyTypes.POSITION
    })
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
    propsManager.addChangeForAddProperty(mockPropertyComponent)
    expect(propsManager.changes.length).toBe(1)
    expect(propsManager.changes[0].action).toBe(PROPS_ACTIONS.ADD_PROPERTY)
  })

  it('should add a change for removing a property', () => {
    propsManager.addChangeForRemoveProperty(mockPropertyComponent)
    expect(propsManager.changes.length).toBe(1)
    expect(propsManager.changes[0].action).toBe(PROPS_ACTIONS.REMOVE_PROPERTY)
  })

  // Test component management
  it('should get a component by ID', () => {
    propsManager.addToMap(mockPropertyComponent)
    expect(propsManager.getComponentById('prop-id-1')).toBe(
      mockPropertyComponent
    )
  })

  it('should add a component to the map', () => {
    propsManager.addToMap(mockPropertyComponent)
    expect(propsManager._components.has('prop-id-1')).toBe(true)
  })

  it('should remove a component from the map', () => {
    propsManager.addToMap(mockPropertyComponent)
    propsManager.removeFromMap('prop-id-1')
    expect(propsManager._components.has('prop-id-1')).toBe(false)
  })

  // Test deleted map functionality
  it('should add a component to the deleted map', () => {
    propsManager.addToDeletedMap(mockPropertyComponent)
    expect(propsManager._deletedMap.has('prop-id-1')).toBe(true)
  })

  it('should remove a component from the deleted map', () => {
    propsManager.addToDeletedMap(mockPropertyComponent)
    propsManager.removeFromDeletedMap('prop-id-1')
    expect(propsManager._deletedMap.has('prop-id-1')).toBe(false)
  })

  it('should get a restored component by ID', () => {
    propsManager.addToDeletedMap(mockPropertyComponent)
    expect(propsManager.getRestoreComponentById('prop-id-1')).toBe(
      mockPropertyComponent
    )
  })

  // Test createProperty
  it('should create a property and add a change', () => {
    const propData = { id: 'new-prop-id', type: PropertyTypes.POSITION }
    const newProp = propsManager.createProperty(propData)
    expect(mockCreateProperty).toHaveBeenCalledWith({
      ...propData,
      type: PropertyTypes.POSITION
    })
    expect(newProp?.get('id')).toBe('new-prop-id')
    expect(propsManager.changes.length).toBe(1)
    expect(propsManager.changes[0].action).toBe(PROPS_ACTIONS.ADD_PROPERTY)
  })

  it('should throw error if type is not provided for createProperty', () => {
    expect(() => propsManager.createProperty({})).toThrow('Type is required!')
  })

  // Test addProperty
  it('should add multiple properties and return their IDs mapped by type', () => {
    const mockProp1 = {
      get: vi.fn((key: string) =>
        key === 'id' ? 'p1' : PropertyTypes.POSITION
      )
    } as unknown as PropertyComponentInstanceTypes
    const mockProp2 = {
      get: vi.fn((key: string) =>
        key === 'id' ? 'p2' : PropertyTypes.DIMENSION
      )
    } as unknown as PropertyComponentInstanceTypes

    const result = propsManager.addProperty([mockProp1, mockProp2])

    expect(propsManager._components.has('p1')).toBe(true)
    expect(propsManager._components.has('p2')).toBe(true)
    expect(result).toEqual({
      [PropertyTypes.POSITION]: 'p1',
      [PropertyTypes.DIMENSION]: 'p2'
    })
  })

  // Test removeProperty
  it('should remove multiple properties', () => {
    propsManager.addToMap(mockPropertyComponent) // Add mockPropertyComponent with id 'prop-id-1'
    const mockProp2 = {
      get: vi.fn(() => 'prop-id-2')
    } as unknown as PropertyComponentInstanceTypes
    propsManager.addToMap(mockProp2)

    propsManager.removeProperty(['prop-id-1', 'prop-id-2'])

    expect(propsManager._components.has('prop-id-1')).toBe(false)
    expect(propsManager._components.has('prop-id-2')).toBe(false)
    expect(propsManager._deletedMap.has('prop-id-1')).toBe(true)
    expect(propsManager._deletedMap.has('prop-id-2')).toBe(true)
  })

  // Test updatePropsData
  it('should update props data on a component', () => {
    // Create a proper Position component mock
    const positionComponent = {
      get: vi.fn((key: string) => {
        if (key === 'id') return 'prop-id-1'
        if (key === 'type') return PropertyTypes.POSITION
        if (key === 'x') return 0
        if (key === 'y') return 0
        if (key === 'xUnit') return Unit.PX
        if (key === 'yUnit') return Unit.PX
        return undefined
      }),
      save: vi.fn(() => ({
        id: 'prop-id-1',
        type: PropertyTypes.POSITION,
        x: 0,
        y: 0,
        xUnit: Unit.PX,
        yUnit: Unit.PX
      })),
      set: vi.fn()
    } as unknown as PropertyComponentInstanceTypes

    propsManager.addToMap(positionComponent)
    // Type assertion needed because updatePropsData uses union type for keys
    // 'x' is a valid key for PositionAttrs, which is part of PropertyComponentInstanceDataTypes
    propsManager.updatePropsData(
      'prop-id-1',
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
})
