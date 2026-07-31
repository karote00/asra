import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  BasePropertyComponent,
  createPropertyComponentFromConfig,
  propertyComponentRegistry,
  registerPropertyComponent,
  registerPropertySchema,
  unregisterPropertySchema
} from '@asyra/props-manager'
import propsManager from '@asyra/props-manager'
import {
  DataTypes,
  DefaultDimensionData,
  DefaultPositionData,
  DimensionAttrs,
  DimensionComponentRawData,
  ElementInstanceTypes,
  EntityTypes,
  GroupInstanceTypes,
  PositionAttrs,
  PositionComponentRawData,
  PROPS_ACTIONS,
  PropertyTypes,
  SCENE_TREE_ACTIONS,
  SceneTreeChange,
  Unit,
  resetIdCounter,
  type AddRemoveElementChange,
  type AddRemoveElementsChange,
  type AddRemovePropertyChange,
  type CreateElementData,
  type ElementRawData,
  type PropertyComponentRawData,
  type PropsChange
} from '@asyra/utils'
import sceneTreeSingleton, { SceneTree } from '../sceneTree'
import Element from '../components/element'
import Workspace from '../components/workspace'
import componentRegistry from '../component-registry'
import { createDynamicComponent } from '../create-dynamic-component'
import { initSceneTreeSubscribes } from '../subscribes'
import {
  EventTypes,
  publishEvent,
  runInTransactionReplayMode,
  runWithTransactionOwner,
  subscribeToEventBatches,
  subscribeToEvents,
  wasTransactionReplayApplied,
  type AddElementEvent,
  type RemoveElementEvent,
  type UpdateElementDataEvent,
  type TransactionOwner,
  type UpdateTransactionEvent
} from '@asyra/reactive-events'

initSceneTreeSubscribes()

// Create a mock Rectangle component for testing
class MockRectangle extends Element {
  constructor(data?: Partial<ElementRawData>) {
    super(data)
    this.data.type = 'rect'
  }
}

class TestPositionComponent extends BasePropertyComponent<PositionAttrs> {
  data: PositionAttrs = {
    id: '',
    type: PropertyTypes.POSITION,
    ...DefaultPositionData
  }

  constructor(data: Partial<PositionAttrs>) {
    super()
    this.load(data as PositionComponentRawData)
  }

  load(data: PositionComponentRawData): void {
    this.data.id = typeof data.id === 'string' ? data.id : this.data.id
    this.assignLoadedValue('x', data.x)
    this.assignLoadedValue('y', data.y)
    this.assignLoadedValue('xUnit', data.xUnit)
    this.assignLoadedValue('yUnit', data.yUnit)
  }

  getValue(): Record<string, DataTypes> {
    return { x: this.data.x, y: this.data.y }
  }

  getUnit(): Record<string, Unit> {
    return {
      xUnit: this.data.xUnit,
      yUnit: this.data.yUnit
    }
  }

  save(): PositionComponentRawData {
    return {
      ...super.save(),
      x: this.data.x,
      y: this.data.y,
      xUnit: this.data.xUnit,
      yUnit: this.data.yUnit
    } as PositionComponentRawData
  }
}

class TestDimensionComponent extends BasePropertyComponent<DimensionAttrs> {
  data: DimensionAttrs = {
    id: '',
    type: PropertyTypes.DIMENSION,
    ...DefaultDimensionData
  }

  constructor(data: Partial<DimensionAttrs>) {
    super()
    this.load(data as DimensionComponentRawData)
  }

  load(data: DimensionComponentRawData): void {
    this.data.id = typeof data.id === 'string' ? data.id : this.data.id
    this.assignLoadedValue('width', data.width)
    this.assignLoadedValue('height', data.height)
    this.assignLoadedValue('widthUnit', data.widthUnit)
    this.assignLoadedValue('heightUnit', data.heightUnit)
  }

  getValue(): Record<string, DataTypes> {
    return {
      width: this.data.width,
      height: this.data.height
    }
  }

  getUnit(): Record<string, Unit> {
    return {
      widthUnit: this.data.widthUnit,
      heightUnit: this.data.heightUnit
    }
  }

  save(): DimensionComponentRawData {
    return {
      ...super.save(),
      width: this.data.width,
      height: this.data.height,
      widthUnit: this.data.widthUnit,
      heightUnit: this.data.heightUnit
    } as DimensionComponentRawData
  }
}

interface TestPaint {
  kind: 'solid'
  color: string
  opacity: number
}

interface TestStrokeAttrs {
  id: string
  type: string
  fill: TestPaint
  width: number
}

interface TestStrokesAttrs {
  id: string
  type: string
  strokes: string[]
}

const TEST_STROKE_PROPERTY_TYPE = 'test-stroke'
const TEST_STROKES_PROPERTY_TYPE = 'test-strokes'
const TEST_VECTOR_TYPE = 'test-vector'
const TEST_REACTIVE_STROKES_PROPERTY_TYPE = 'test-reactive-strokes'
const TEST_REACTIVE_VECTOR_TYPE = 'test-reactive-vector'
const TEST_EMPTY_TYPE = 'test-empty'
const TEST_PREPARED_OWNER_TYPE = 'test-prepared-owner'

class TestStrokeComponent extends BasePropertyComponent<TestStrokeAttrs> {
  data: TestStrokeAttrs = {
    id: '',
    type: TEST_STROKE_PROPERTY_TYPE,
    fill: { kind: 'solid', color: '#cccccc', opacity: 1 },
    width: 10
  }

  constructor(data: Partial<TestStrokeAttrs>) {
    super()
    this.load(data)
  }

  load(data: Partial<TestStrokeAttrs>): void {
    this.data.id = typeof data.id === 'string' ? data.id : this.data.id
    this.data.type =
      typeof data.type === 'string' ? data.type : TEST_STROKE_PROPERTY_TYPE
    if (data.fill && typeof data.fill === 'object') {
      this.data.fill = data.fill
    }
    this.assignLoadedValue('width', data.width)
  }

  getValue(): Record<string, DataTypes> {
    return {
      fill: this.data.fill as unknown as DataTypes,
      width: this.data.width
    }
  }

  getUnit(): Record<string, Unit> {
    return {}
  }

  save(): PropertyComponentRawData {
    return {
      ...super.save(),
      fill: this.data.fill,
      width: this.data.width
    } as PropertyComponentRawData
  }
}

class TestStrokesComponent extends BasePropertyComponent<TestStrokesAttrs> {
  data: TestStrokesAttrs = {
    id: '',
    type: TEST_STROKES_PROPERTY_TYPE,
    strokes: []
  }

  constructor(data: Partial<TestStrokesAttrs>) {
    super()
    this.load(data)
  }

  load(data: Partial<TestStrokesAttrs>): void {
    this.data.id = typeof data.id === 'string' ? data.id : this.data.id
    this.data.type =
      typeof data.type === 'string' ? data.type : TEST_STROKES_PROPERTY_TYPE
    this.data.strokes = Array.isArray(data.strokes) ? data.strokes : []
  }

  getValue(): Record<string, DataTypes> {
    const strokes: Record<string, unknown> = {}

    this.data.strokes.forEach((strokeId) => {
      const stroke = propsManager.getPropertyById(strokeId) as
        | TestStrokeComponent
        | undefined
      if (!stroke) {
        return
      }

      strokes[strokeId] = {
        id: strokeId,
        fill: stroke.get('fill'),
        width: stroke.get('width')
      }
    })

    return {
      strokes: strokes as unknown as DataTypes
    }
  }

  getUnit(): Record<string, Unit> {
    return {}
  }

  save(): PropertyComponentRawData {
    return {
      ...super.save(),
      strokes: [...this.data.strokes]
    } as PropertyComponentRawData
  }
}

const createTestTransactionOwner = () =>
  ({
    startTransaction: vi.fn(),
    updateTransactionBatch: vi.fn(),
    endTransaction: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn()
  }) satisfies TransactionOwner

describe('SceneTree', () => {
  let sceneTree: SceneTree

  beforeEach(() => {
    vi.clearAllMocks()

    resetIdCounter()
    sceneTree = new SceneTree()
    sceneTreeSingleton.reset()
    propsManager.reset()
    propertyComponentRegistry.clear()
    registerPropertyComponent(PropertyTypes.POSITION, TestPositionComponent)
    registerPropertyComponent(PropertyTypes.DIMENSION, TestDimensionComponent)
    registerPropertyComponent(TEST_STROKE_PROPERTY_TYPE, TestStrokeComponent)
    registerPropertyComponent(TEST_STROKES_PROPERTY_TYPE, TestStrokesComponent)
    const reactiveStrokesDefinition = {
      type: TEST_REACTIVE_STROKES_PROPERTY_TYPE,
      defaults: { strokes: [] },
      persistKeys: ['strokes'],
      valueKeys: ['strokes'],
      children: {
        key: 'strokes',
        childType: TEST_STROKE_PROPERTY_TYPE,
        mode: 'ids' as const,
        toValue: (
          child: { get: (key: string) => unknown },
          childId: string
        ) => ({
          id: childId,
          fill: child.get('fill'),
          width: child.get('width')
        })
      }
    }
    registerPropertyComponent(
      TEST_REACTIVE_STROKES_PROPERTY_TYPE,
      createPropertyComponentFromConfig(reactiveStrokesDefinition),
      undefined,
      reactiveStrokesDefinition
    )

    // Clear any existing registrations before adding our test component
    componentRegistry.getAll().forEach((_, type) => {
      componentRegistry.unregister(type)
    })

    // Register a mock Rectangle component for tests
    componentRegistry.register({
      type: 'rect',
      idPrefix: 'rect',
      namePrefix: 'Rectangle',
      constructor: MockRectangle as new (
        data?: Partial<ElementRawData>
      ) => Element,
      properties: [
        {
          name: PropertyTypes.POSITION,
          type: PropertyTypes.POSITION,
          alias: ['x', 'y']
        },
        {
          name: PropertyTypes.DIMENSION,
          type: PropertyTypes.DIMENSION,
          alias: ['width', 'height']
        }
      ],
      defaults: {}
    })

    componentRegistry.register({
      type: TEST_REACTIVE_VECTOR_TYPE,
      idPrefix: TEST_REACTIVE_VECTOR_TYPE,
      namePrefix: 'Test Reactive Vector',
      constructor: createDynamicComponent(
        TEST_REACTIVE_VECTOR_TYPE,
        TEST_REACTIVE_VECTOR_TYPE,
        'Test Reactive Vector',
        [
          {
            name: 'strokes',
            type: TEST_REACTIVE_STROKES_PROPERTY_TYPE
          }
        ],
        {}
      ),
      properties: [
        { name: 'strokes', type: TEST_REACTIVE_STROKES_PROPERTY_TYPE }
      ],
      defaults: {}
    })

    componentRegistry.register({
      type: TEST_VECTOR_TYPE,
      idPrefix: TEST_VECTOR_TYPE,
      namePrefix: 'Test Vector',
      constructor: createDynamicComponent(
        TEST_VECTOR_TYPE,
        TEST_VECTOR_TYPE,
        'Test Vector',
        [{ name: 'strokes', type: TEST_STROKES_PROPERTY_TYPE }],
        {}
      ),
      properties: [{ name: 'strokes', type: TEST_STROKES_PROPERTY_TYPE }],
      defaults: {}
    })

    componentRegistry.register({
      type: TEST_EMPTY_TYPE,
      idPrefix: TEST_EMPTY_TYPE,
      namePrefix: 'Test Empty',
      constructor: createDynamicComponent(
        TEST_EMPTY_TYPE,
        TEST_EMPTY_TYPE,
        'Test Empty',
        [],
        {}
      ),
      properties: [],
      defaults: {}
    })

    const preparedOwnerProperties = [
      {
        name: PropertyTypes.POSITION,
        type: PropertyTypes.POSITION,
        alias: ['x', 'y']
      },
      {
        name: PropertyTypes.DIMENSION,
        type: PropertyTypes.DIMENSION,
        alias: ['width', 'height']
      }
    ]
    componentRegistry.register({
      type: TEST_PREPARED_OWNER_TYPE,
      idPrefix: TEST_PREPARED_OWNER_TYPE,
      namePrefix: 'Test Prepared Owner',
      constructor: createDynamicComponent(
        TEST_PREPARED_OWNER_TYPE,
        TEST_PREPARED_OWNER_TYPE,
        'Test Prepared Owner',
        preparedOwnerProperties,
        {}
      ),
      properties: preparedOwnerProperties,
      defaults: {}
    })
  })

  // Test _init() and basic workspace creation
  it('should initialize with a new workspace if none exists', () => {
    sceneTree.init()

    expect(sceneTree.workspace).toBeDefined()
    expect(sceneTree.workspaceList.length).toBeGreaterThan(0)
    const workspaceId = sceneTree.workspace
    expect(sceneTree.getAllElements().has(workspaceId)).toBe(true)

    const workspace = sceneTree.getElementById(workspaceId)
    expect(workspace?.get('type')).toBe(EntityTypes.WORKSPACE)
  })

  it('should not create a new workspace if one already exists', () => {
    const customSceneTree = new SceneTree()
    customSceneTree.workspace = 'existing-workspace'
    customSceneTree.workspaceList = ['existing-workspace']

    customSceneTree.init()

    // Check that workspace wasn't changed
    expect(customSceneTree.workspace).toBe('existing-workspace')
    expect(customSceneTree.workspaceList).toEqual(['existing-workspace'])
    // No new elements added since workspace already exists
    expect(customSceneTree.getAllElements().size).toBe(0)
  })

  // Test element creation and management
  it('should create a new element and add a change for it', () => {
    const elementData = { id: 'el-1', type: 'rect' }

    sceneTree.createElement(elementData)

    // Note: createElement requires component registry to have ELEMENT type
    // For now, we just test the change tracking
    expect(sceneTree.changes.length).toBe(1)
    expect(sceneTree.changes[0]).toEqual({
      eventName: EventTypes.ADD_ELEMENT,
      data: expect.any(Object),
      action: SCENE_TREE_ACTIONS.ADD_ELEMENT,
      undoType: EventTypes.REMOVE_ELEMENT,
      undoAction: EventTypes.REMOVE_ELEMENT
    })
  })

  it('should not create a workspace element using createElement', () => {
    const elementData = { id: 'ws-2', type: EntityTypes.WORKSPACE }
    const newElement = sceneTree.createElement(elementData)

    expect(newElement).toBeNull()
    expect(sceneTree.changes.length).toBe(0)
  })

  it('should add an element to the map', () => {
    const element = sceneTree.createElement(
      { id: 'el-add', type: TEST_EMPTY_TYPE },
      false
    )
    expect(element).not.toBeNull()

    sceneTree.addToMap(element as ElementInstanceTypes)

    expect(sceneTree.getAllElements().has('el-add')).toBe(true)
  })

  it('should remove an element from the map', () => {
    const element = sceneTree.createElement(
      { id: 'el-remove', type: TEST_EMPTY_TYPE },
      false
    )
    expect(element).not.toBeNull()

    sceneTree.addToMap(element as ElementInstanceTypes)
    expect(sceneTree.getAllElements().has('el-remove')).toBe(true)

    sceneTree.removeFromMap(element as ElementInstanceTypes)
    expect(sceneTree.getAllElements().has('el-remove')).toBe(false)
  })

  it('should get an element by ID', () => {
    const element = sceneTree.createElement(
      { id: 'el-get', type: TEST_EMPTY_TYPE },
      false
    )
    expect(element).not.toBeNull()

    sceneTree.addToMap(element as ElementInstanceTypes)

    expect(sceneTree.getElementById('el-get')).toBe(element)
  })

  // Test change tracking
  it('should add a change to the changes array', () => {
    const change = {
      eventName: EventTypes.ADD_ELEMENT
    } as unknown as SceneTreeChange

    sceneTree.addChange(change)

    expect(sceneTree.changes).toEqual([change])
  })

  it('should clean all changes', () => {
    sceneTree.addChange({} as unknown as SceneTreeChange)

    sceneTree.cleanChanges()

    expect(sceneTree.changes).toEqual([])
  })

  it('should add a change for adding an element', () => {
    const elementData = { id: 'el-change', type: 'rect' }
    const element = {
      save: vi.fn(() => elementData),
      get: vi.fn(() => 'el-change')
    } as unknown as ElementInstanceTypes

    sceneTree.addChangeForAddElement(element)

    expect(sceneTree.changes.length).toBe(1)
    expect(sceneTree.changes[0].action).toBe(SCENE_TREE_ACTIONS.ADD_ELEMENT)
  })

  it('records the original parent and child index before removing an element', () => {
    sceneTree.init()
    const workspaceId = sceneTree.workspace
    sceneTree.addNewElement({ id: 'first', type: 'rect', x: 0, y: 0 })
    sceneTree.addNewElement({ id: 'middle', type: 'rect', x: 0, y: 0 })
    sceneTree.addNewElement({ id: 'last', type: 'rect', x: 0, y: 0 })
    sceneTree.cleanChanges()
    const transactionOwner = createTestTransactionOwner()

    expect(
      runWithTransactionOwner(transactionOwner, () =>
        sceneTree.removeElement({ id: 'middle' })
      )
    ).toBe(true)

    expect(transactionOwner.updateTransactionBatch).toHaveBeenCalledWith([
      expect.objectContaining({
        eventName: EventTypes.REMOVE_ELEMENTS,
        payload: expect.objectContaining({
          action: SCENE_TREE_ACTIONS.REMOVE_ELEMENTS,
          entries: [
            expect.objectContaining({
              parentId: workspaceId,
              index: 1,
              data: expect.objectContaining({ id: 'middle' })
            })
          ]
        })
      })
    ])
  })

  it('restores a removed element to its original container and child index', () => {
    const containerType = 'test-container'
    componentRegistry.register({
      type: containerType,
      idPrefix: containerType,
      namePrefix: 'Test Container',
      constructor: createDynamicComponent(
        containerType,
        containerType,
        'Test Container',
        [],
        {},
        true
      ),
      properties: [],
      defaults: {},
      isContainer: true
    })
    sceneTreeSingleton.init()
    sceneTreeSingleton.addNewElement({
      id: 'container-a',
      type: containerType,
      x: 0,
      y: 0
    })
    sceneTreeSingleton.addNewElement({
      id: 'container-b',
      type: containerType,
      x: 0,
      y: 0
    })
    const containerA = sceneTreeSingleton.getElementById(
      'container-a'
    ) as GroupInstanceTypes
    const containerB = sceneTreeSingleton.getElementById(
      'container-b'
    ) as GroupInstanceTypes
    sceneTreeSingleton.addNewElement(
      { id: 'first', type: 'rect', x: 0, y: 0 },
      containerB
    )
    sceneTreeSingleton.addNewElement(
      { id: 'middle', type: 'rect', x: 0, y: 0 },
      containerB
    )
    sceneTreeSingleton.addNewElement(
      { id: 'last', type: 'rect', x: 0, y: 0 },
      containerB
    )
    const removedData = sceneTreeSingleton.getElementById('middle')?.save()
    if (!removedData) {
      throw new Error('Expected middle element before removal')
    }

    const removalOwner = createTestTransactionOwner()
    expect(
      runWithTransactionOwner(removalOwner, () =>
        sceneTreeSingleton.removeElement({ id: 'middle' }, containerB)
      )
    ).toBe(true)
    expect(containerB.get('children')).toEqual(['first', 'last'])

    const updateTransactionBatch = vi.fn()
    const transactionOwner: TransactionOwner = {
      startTransaction: vi.fn(),
      updateTransactionBatch,
      endTransaction: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn()
    }
    runInTransactionReplayMode('rollback', () =>
      runWithTransactionOwner(transactionOwner, () =>
        publishEvent({
          type: EventTypes.ADD_ELEMENT,
          payload: {
            data: removedData,
            parentId: 'container-b',
            index: 1
          }
        } as unknown as AddElementEvent)
      )
    )

    expect(containerA.get('children')).toEqual(['container-b'])
    expect(containerB.get('children')).toEqual(['first', 'middle', 'last'])
    expect(sceneTreeSingleton.getElementById('middle')?.get('parentId')).toBe(
      'container-b'
    )
    expect(updateTransactionBatch).toHaveBeenCalledOnce()
    expect(updateTransactionBatch.mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({
        eventName: EventTypes.ADD_ELEMENTS,
        payload: expect.objectContaining({
          action: SCENE_TREE_ACTIONS.ADD_ELEMENTS,
          entries: [
            expect.objectContaining({
              parentId: 'container-b',
              index: 1,
              data: expect.objectContaining({
                id: 'middle',
                parentId: 'container-b'
              })
            })
          ]
        })
      })
    ])
  })

  it('records ordinary add and typed batch removal evidence', () => {
    sceneTreeSingleton.init()
    const events: UpdateTransactionEvent[] = []
    const subscription = subscribeToEvents((event) => {
      if (event.type === EventTypes.UPDATE_TRANSACTION) {
        events.push(event as UpdateTransactionEvent)
      }
    })
    const getSceneActions = () =>
      events
        .map((event) => (event.payload as SceneTreeChange).action)
        .filter((action) =>
          Object.values(SCENE_TREE_ACTIONS).includes(
            action as SCENE_TREE_ACTIONS
          )
        )

    events.length = 0
    sceneTreeSingleton.addNewElement({
      id: 'single-structural-owner',
      type: 'rect',
      x: 0,
      y: 0
    })
    expect(getSceneActions()).toEqual([SCENE_TREE_ACTIONS.ADD_ELEMENT])

    events.length = 0
    const removalOwner = createTestTransactionOwner()
    expect(
      runWithTransactionOwner(removalOwner, () =>
        sceneTreeSingleton.removeElement({ id: 'single-structural-owner' })
      )
    ).toBe(true)
    expect(removalOwner.updateTransactionBatch).toHaveBeenCalledWith([
      expect.objectContaining({
        eventName: EventTypes.REMOVE_ELEMENTS,
        payload: expect.objectContaining({
          action: SCENE_TREE_ACTIONS.REMOVE_ELEMENTS,
          entries: [
            expect.objectContaining({
              data: expect.objectContaining({
                id: 'single-structural-owner'
              })
            })
          ]
        })
      })
    ])

    subscription.unsubscribe()
  })

  it('publishes referenced property adds before the element add', () => {
    sceneTreeSingleton.init()
    const events: UpdateTransactionEvent[] = []
    const subscription = subscribeToEvents((event) => {
      if (event.type === EventTypes.UPDATE_TRANSACTION) {
        events.push(event as UpdateTransactionEvent)
      }
    })

    events.length = 0
    sceneTreeSingleton.addNewElement({
      id: 'property-order-owner',
      type: 'rect',
      x: 10,
      y: 20
    })

    const changes = events.map(
      (event) => event.payload as SceneTreeChange | PropsChange
    )
    const elementAddIndex = changes.findIndex(
      (change) => change.action === SCENE_TREE_ACTIONS.ADD_ELEMENT
    )
    const elementAdd = changes[elementAddIndex] as AddRemoveElementChange
    const referencedPropertyIds = Object.values(
      elementAdd.data.props ?? {}
    ).filter(
      (propertyId): propertyId is string => typeof propertyId === 'string'
    )
    const propertyAddIndexById = new Map<string, number>()

    changes.forEach((change, index) => {
      if (change.action !== PROPS_ACTIONS.ADD_PROPERTY) return
      ;(change as AddRemovePropertyChange).data.forEach((property) => {
        propertyAddIndexById.set(property.id, index)
      })
    })

    expect(elementAddIndex).toBeGreaterThan(-1)
    expect(referencedPropertyIds.length).toBeGreaterThan(0)
    referencedPropertyIds.forEach((propertyId) => {
      expect(propertyAddIndexById.get(propertyId)).toBeLessThan(elementAddIndex)
    })

    subscription.unsubscribe()
  })

  // Test delete map functionality
  it('should add an element to the deleted map', () => {
    const element = {
      get: vi.fn(() => 'el-deleted')
    } as unknown as ElementInstanceTypes

    sceneTree.addToDeleteMap(element)

    expect(sceneTree._deletedMap.has('el-deleted')).toBe(true)
  })

  it('should remove an element from the deleted map', () => {
    const element = {
      get: vi.fn(() => 'el-deleted-remove')
    } as unknown as ElementInstanceTypes
    sceneTree.addToDeleteMap(element)

    sceneTree.removeFromDeleteMap('el-deleted-remove')

    expect(sceneTree._deletedMap.has('el-deleted-remove')).toBe(false)
  })

  it('should restore an element from the deleted map and add a change', () => {
    const elementData = { id: 'el-restore', type: 'rect' }
    const element = {
      save: vi.fn(() => elementData),
      get: vi.fn(() => 'el-restore')
    } as unknown as ElementInstanceTypes
    sceneTree.addToDeleteMap(element)

    const restored = sceneTree.getRestoreElementById('el-restore')

    expect(restored).toBe(element)
    expect(sceneTree.changes.length).toBe(1)
    expect(sceneTree.changes[0].action).toBe(SCENE_TREE_ACTIONS.ADD_ELEMENT)
  })

  it('delegates normal single creation to the workspace batch boundary', () => {
    sceneTree.init()
    const elementData = {
      id: 'test-rect',
      type: 'rect',
      x: 0,
      y: 0
    }
    const workspace = sceneTree.currentWorkspace as Workspace
    const addNewElements = vi.spyOn(workspace, 'addNewElements')

    sceneTree.addNewElement(elementData, undefined, -1)

    expect(addNewElements).toHaveBeenCalledOnce()
    expect(addNewElements).toHaveBeenCalledWith(
      [expect.any(Object)],
      workspace,
      0
    )
  })

  it('acknowledges replayed add after the transaction owner accepts its Scene batch', () => {
    sceneTreeSingleton.init()
    sceneTreeSingleton.addNewElement({
      id: 'replay-add-failure',
      type: 'rect',
      x: 0,
      y: 0
    })
    const removedData = sceneTreeSingleton
      .getElementById('replay-add-failure')
      ?.save()
    expect(removedData).toBeDefined()
    runWithTransactionOwner(createTestTransactionOwner(), () =>
      sceneTreeSingleton.removeElement({ id: 'replay-add-failure' })
    )

    const replayFailure = Object.assign(
      new Error('transaction owner failed after accepting scene add'),
      { batchAccepted: true }
    )
    const transactionOwner: TransactionOwner = {
      startTransaction: vi.fn(),
      updateTransactionBatch: vi.fn(() => {
        throw replayFailure
      }),
      endTransaction: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn()
    }

    let capturedFailure: unknown
    try {
      runInTransactionReplayMode('undo', () =>
        runWithTransactionOwner(transactionOwner, () =>
          publishEvent({
            type: EventTypes.ADD_ELEMENT,
            payload: {
              data: removedData,
              parentId: sceneTreeSingleton.workspace,
              index: 0
            }
          } as AddElementEvent)
        )
      )
    } catch (failure) {
      capturedFailure = failure
    }

    expect(capturedFailure).toBe(replayFailure)
    expect(wasTransactionReplayApplied(capturedFailure)).toBe(true)
    expect(
      sceneTreeSingleton.getElementById('replay-add-failure')
    ).toBeDefined()
  })

  it('acknowledges replayed remove after the transaction owner accepts its Scene batch', () => {
    sceneTreeSingleton.init()
    sceneTreeSingleton.addNewElement({
      id: 'replay-remove-failure',
      type: 'rect',
      x: 0,
      y: 0
    })
    const removableElement = sceneTreeSingleton.getElementById(
      'replay-remove-failure'
    )
    expect(removableElement).toBeDefined()
    if (!removableElement) {
      throw new Error('Expected replay-remove-failure before removal')
    }
    const data = removableElement.save()
    const replayFailure = Object.assign(
      new Error('transaction owner failed after accepting scene remove'),
      { batchAccepted: true }
    )
    const transactionOwner: TransactionOwner = {
      startTransaction: vi.fn(),
      updateTransactionBatch: vi.fn(() => {
        throw replayFailure
      }),
      endTransaction: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn()
    }

    let capturedFailure: unknown
    try {
      runInTransactionReplayMode('undo', () =>
        runWithTransactionOwner(transactionOwner, () =>
          publishEvent({
            type: EventTypes.REMOVE_ELEMENT,
            payload: {
              data,
              parentId: sceneTreeSingleton.workspace,
              index: 0
            }
          } as RemoveElementEvent)
        )
      )
    } catch (failure) {
      capturedFailure = failure
    }

    expect(capturedFailure).toBe(replayFailure)
    expect(wasTransactionReplayApplied(capturedFailure)).toBe(true)
    expect(
      sceneTreeSingleton.getElementById('replay-remove-failure')
    ).toBeUndefined()
  })

  it.each([
    ['visible', true, false],
    ['lock', false, true],
    ['name', 'Replay owner before', 'Replay owner after']
  ] as const)(
    'routes replay of element-owned %s through Element data',
    (key, before, after) => {
      sceneTreeSingleton.init()
      sceneTreeSingleton.addNewElement({
        id: `element-owner-${key}`,
        type: 'rect',
        name: key === 'name' ? before : undefined,
        visible: key === 'visible' ? before : undefined,
        lock: key === 'lock' ? before : undefined,
        x: 0,
        y: 0
      })
      const element = sceneTreeSingleton.getElementById(`element-owner-${key}`)
      expect(element).toBeDefined()
      if (!element) {
        throw new Error(`Expected element-owner-${key}`)
      }

      const transactionOwner: TransactionOwner = {
        startTransaction: vi.fn(),
        updateTransactionBatch: vi.fn(),
        endTransaction: vi.fn(),
        undo: vi.fn(),
        redo: vi.fn()
      }
      const applied = runInTransactionReplayMode('undo', () =>
        runWithTransactionOwner(transactionOwner, () =>
          publishEvent({
            type: EventTypes.UPDATE_ELEMENT_DATA,
            payload: {
              id: `element-owner-${key}`,
              changes: [{ key, before, after }]
            }
          } as UpdateElementDataEvent)
        )
      )

      expect(applied).toBe(true)
      expect(element.get(key)).toBe(after)
    }
  )

  it('replays one raw element field batch through one Scene preparation handoff', () => {
    sceneTreeSingleton.init()
    sceneTreeSingleton.addNewElement({
      id: 'raw-element-batch-replay',
      type: 'rect',
      name: 'Before',
      visible: true,
      lock: false,
      x: 0,
      y: 0
    })
    const element = sceneTreeSingleton.getElementById(
      'raw-element-batch-replay'
    )
    expect(element).toBeDefined()
    if (!element) {
      throw new Error('Expected raw-element-batch-replay element')
    }
    const updateTransactionBatch = vi.fn()
    const transactionOwner: TransactionOwner = {
      startTransaction: vi.fn(),
      updateTransactionBatch,
      endTransaction: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn()
    }

    const applied = runInTransactionReplayMode('redo', () =>
      runWithTransactionOwner(transactionOwner, () =>
        publishEvent({
          type: EventTypes.UPDATE_ELEMENT_DATA,
          payload: {
            id: 'raw-element-batch-replay',
            changes: [
              { key: 'name', before: 'Before', after: 'After' },
              { key: 'visible', before: true, after: false },
              { key: 'lock', before: false, after: true }
            ]
          }
        } as UpdateElementDataEvent)
      )
    )

    expect(applied).toBe(true)
    expect(element.get('name')).toBe('After')
    expect(element.get('visible')).toBe(false)
    expect(element.get('lock')).toBe(true)
    expect(updateTransactionBatch).toHaveBeenCalledOnce()
    expect(
      (
        updateTransactionBatch.mock
          .calls[0]?.[0] as readonly UpdateTransactionEvent[]
      )[0]?.payload
    ).toMatchObject({
      action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_DATA,
      id: 'raw-element-batch-replay',
      changes: [
        { key: 'name', before: 'Before', after: 'After' },
        { key: 'visible', before: true, after: false },
        { key: 'lock', before: false, after: true }
      ]
    })
  })

  it('preflights local computed patches before mutating computed state', () => {
    const element = new MockRectangle({
      id: 'missing-value-base',
      type: 'rect',
      visible: true
    })
    sceneTree.addToMap(element)
    const beforeSnapshot = element.getAllComputedData()

    expect(() =>
      sceneTree.patchLocalComputedData([
        {
          elementId: element.get('id'),
          patch: {
            values: { pointCoordinateSpace: 'workspace' }
          }
        }
      ])
    ).toThrow(
      'Computed data patch value base "pointCoordinateSpace" must already exist'
    )
    expect(() =>
      sceneTree.patchLocalComputedData([
        {
          elementId: element.get('id'),
          patch: {
            values: { visible: false }
          }
        }
      ])
    ).toThrow('Local computed patches cannot update canonical key "visible"')

    expect(element.getAllComputedData()).toEqual(beforeSnapshot)
    expect(sceneTree.changes).toEqual([])
  })

  it('preserves special own record ids on the local computed patch route', () => {
    const element = new MockRectangle({
      id: 'special-record-local-patch',
      type: 'rect'
    })
    sceneTree.addToMap(element)
    sceneTree.updateLocalComputedData([
      {
        elementId: element.get('id'),
        values: { points: {} }
      }
    ])
    const after = { id: '__proto__', x: 10, y: 20 }
    const set = Object.create(null) as Record<string, typeof after>
    Object.defineProperty(set, '__proto__', {
      value: after,
      enumerable: true,
      configurable: true,
      writable: true
    })

    sceneTree.patchLocalComputedData([
      {
        elementId: element.get('id'),
        patch: {
          records: {
            points: { set }
          }
        }
      }
    ])

    const points = (
      element.getAllComputedData() as unknown as Record<string, unknown>
    ).points as Record<string, unknown>
    expect(Object.prototype.hasOwnProperty.call(points, '__proto__')).toBe(true)
    expect(points['__proto__']).toEqual({
      id: '__proto__',
      x: 10,
      y: 20
    })
    expect(sceneTree.changes).toEqual([])
  })

  it('derives nested shared-component computed data locally from one canonical property commit', () => {
    const events: UpdateTransactionEvent[] = []
    const computedBatches: unknown[][] = []
    const subscription = subscribeToEvents((event) => {
      if (event.type === EventTypes.UPDATE_TRANSACTION) {
        events.push(event as UpdateTransactionEvent)
      }
    })
    const batchSubscription = subscribeToEventBatches((eventBatch) => {
      const computedEvents = eventBatch.filter(
        (event) =>
          event.type === EventTypes.UPDATE_COMPUTED_DATA ||
          event.type === EventTypes.UPDATE_COMPUTED_DATA_PATCH
      )
      if (computedEvents.length > 0) {
        computedBatches.push(computedEvents)
      }
    })
    events.length = 0

    const nextFill: TestPaint = {
      kind: 'solid',
      color: '#d90909',
      opacity: 0.5
    }
    const stroke = propsManager.createProperty({
      id: 'stroke-1',
      type: TEST_STROKE_PROPERTY_TYPE,
      fill: { kind: 'solid', color: '#cccccc', opacity: 1 },
      width: 10
    })
    propsManager.addToMap(stroke)
    const strokes = propsManager.createProperty({
      id: 'strokes-1',
      type: TEST_REACTIVE_STROKES_PROPERTY_TYPE,
      strokes: ['stroke-1']
    })
    propsManager.addToMap(strokes)

    const element = sceneTreeSingleton.createElement({
      id: 'vector-1',
      type: TEST_REACTIVE_VECTOR_TYPE,
      props: {
        strokes: 'strokes-1'
      } as unknown as ElementRawData['props']
    }) as ElementInstanceTypes
    sceneTreeSingleton.addToMap(element)
    sceneTreeSingleton.cleanChanges()

    try {
      propsManager.updatePropertyById('stroke-1', 'fill', nextFill, {
        undoable: false
      })
      expect((stroke as TestStrokeComponent).get('fill')).toEqual(nextFill)
      propsManager.commitChanges({ undoable: false })

      expect(computedBatches).toEqual([
        [
          expect.objectContaining({
            type: EventTypes.UPDATE_COMPUTED_DATA,
            payload: expect.objectContaining({
              id: 'vector-1'
            })
          })
        ]
      ])
      expect(element.computed.get('strokes')).toEqual([
        {
          id: 'stroke-1',
          fill: nextFill,
          width: 10
        }
      ])
      expect(
        events.filter(
          ({ eventName }) => eventName === EventTypes.UPDATE_COMPUTED_DATA
        )
      ).toEqual([])
    } finally {
      batchSubscription.unsubscribe()
      subscription.unsubscribe()
    }
  })

  // Test load and save
  it('should load data correctly', () => {
    const position = propsManager.createProperty(
      new TestPositionComponent({
        id: 'load-position',
        x: 10,
        y: 20
      }).save()
    )
    const dimension = propsManager.createProperty(
      new TestDimensionComponent({
        id: 'load-dimension',
        width: 100,
        height: 80
      }).save()
    )
    propsManager.addProperty([position, dimension])
    const dataToLoad = {
      workspace: 'ws-load',
      workspaceList: ['ws-load'],
      elements: {
        'ws-load': {
          id: 'ws-load',
          type: EntityTypes.WORKSPACE,
          name: 'ws-load',
          parentId: '',
          visible: true,
          lock: false,
          children: ['el-load-1']
        },
        'el-load-1': {
          id: 'el-load-1',
          type: 'rect',
          name: 'el-load-1',
          parentId: 'ws-load',
          visible: true,
          lock: false,
          props: {
            position: position.get('id'),
            dimension: dimension.get('id')
          }
        }
      }
    }

    sceneTree.load(dataToLoad)

    expect(sceneTree.workspace).not.toBe('')
    expect(sceneTree.workspaceList).toContain(sceneTree.workspace)
    expect(sceneTree.workspaceList).toHaveLength(1)
    expect(sceneTree.getAllElements().size).toBe(2)

    // Verify exact element and workspace identities are loaded.
    const elementIds = Array.from(sceneTree.getAllElements().keys())
    expect(elementIds).toContain('el-load-1')

    // Verify rectangle element
    const rectElement = sceneTree.getElementById('el-load-1')
    expect(rectElement).toBeDefined()
    expect(rectElement?.get('type')).toBe('rect')

    // Verify workspace element type.
    const wsId = elementIds.find((id) => id !== 'el-load-1')
    if (wsId) {
      const wsElement = sceneTree.getElementById(wsId)
      expect(wsElement).toBeDefined()
      expect(wsElement?.get('type')).toBe(EntityTypes.WORKSPACE)
    } else {
      // Workspace not found - this is unexpected
      throw new Error('Workspace element not found in loaded data')
    }
  })

  it('validateLoadData should keep valid elements and report skipped malformed entries', () => {
    const { data, diagnostics } = sceneTree.validateLoadData({
      workspace: 'ws-load',
      workspaceList: ['ws-load'],
      elements: {
        'ws-load': {
          id: 'ws-load',
          type: EntityTypes.WORKSPACE,
          name: 'workspace',
          parentId: '',
          visible: true,
          lock: false,
          children: ['rect-1']
        },
        'rect-1': {
          id: 'rect-1',
          type: 'rect',
          name: 'Rect',
          parentId: 'ws-load',
          visible: true,
          lock: false
        },
        'invalid-shape': 'invalid',
        'unknown-type': {
          id: 'unknown-type',
          type: 'unknown',
          name: 'Unknown',
          visible: true,
          lock: false
        }
      }
    })

    expect(Object.keys(data.elements)).toEqual(['ws-load', 'rect-1'])
    expect(diagnostics).toHaveLength(2)
    expect(diagnostics.map((item) => item.path)).toEqual([
      'sceneTree.elements.invalid-shape',
      'sceneTree.elements.unknown-type.type'
    ])
  })

  it('rejects malformed hierarchy artifacts before replace-style apply', () => {
    const containerType = 'gate3-load-container'
    const leafType = 'gate3-load-leaf'
    componentRegistry.register({
      type: containerType,
      idPrefix: containerType,
      namePrefix: 'Load Container',
      constructor: createDynamicComponent(
        containerType,
        containerType,
        'Load Container',
        [],
        {},
        true
      ),
      properties: [],
      defaults: {},
      isContainer: true
    })
    componentRegistry.register({
      type: leafType,
      idPrefix: leafType,
      namePrefix: 'Load Leaf',
      constructor: createDynamicComponent(
        leafType,
        leafType,
        'Load Leaf',
        [],
        {}
      ),
      properties: [],
      defaults: {}
    })

    const createValidPayload = () => ({
      workspace: 'workspace',
      workspaceList: ['workspace'],
      elements: {
        workspace: {
          id: 'workspace',
          type: EntityTypes.WORKSPACE,
          name: 'Workspace',
          parentId: '',
          visible: true,
          lock: false,
          children: ['container']
        },
        container: {
          id: 'container',
          type: containerType,
          name: 'Container',
          parentId: 'workspace',
          visible: true,
          lock: false,
          props: {},
          children: ['leaf']
        },
        leaf: {
          id: 'leaf',
          type: leafType,
          name: 'Leaf',
          parentId: 'container',
          visible: true,
          lock: false,
          props: {}
        }
      }
    })
    const cases: [
      string,
      (payload: ReturnType<typeof createValidPayload>) => void
    ][] = [
      [
        'missing parent',
        (payload) => {
          payload.elements.leaf.parentId = 'missing'
        }
      ],
      [
        'missing child',
        (payload) => {
          payload.elements.container.children = ['missing']
        }
      ],
      [
        'duplicate membership',
        (payload) => {
          payload.elements.workspace.children.push('leaf')
        }
      ],
      [
        'parent and child mismatch',
        (payload) => {
          payload.elements.leaf.parentId = 'workspace'
        }
      ],
      [
        'invalid workspace root',
        (payload) => {
          payload.workspace = 'missing-workspace'
        }
      ],
      [
        'duplicate normalized id',
        (payload) => {
          payload.elements.leaf.id = 'container'
        }
      ],
      [
        'cycle',
        (payload) => {
          payload.elements.workspace.children = []
          payload.elements.container.parentId = 'leaf'
          Object.assign(payload.elements.leaf, {
            type: containerType,
            parentId: 'container',
            children: ['container']
          })
        }
      ]
    ]

    sceneTree.init()
    const originalWorkspace = sceneTree.workspace
    for (const [label, mutate] of cases) {
      const payload = createValidPayload()
      mutate(payload)
      const validation = sceneTree.validateLoadData(payload)

      expect(validation.valid, label).toBe(false)
      expect(validation.diagnostics.length, label).toBeGreaterThan(0)
      expect(() => sceneTree.applyValidatedLoad(validation), label).toThrow(
        /invalid hierarchy/i
      )
      expect(sceneTree.workspace, label).toBe(originalWorkspace)
      expect(sceneTree.getAllElements().size, label).toBe(1)
    }
  })

  it('round-trips exact nested hierarchy order and Group data', () => {
    const containerType = 'gate3-round-trip-container'
    const leafType = 'gate3-round-trip-leaf'
    componentRegistry.register({
      type: containerType,
      idPrefix: containerType,
      namePrefix: 'Round Trip Container',
      constructor: createDynamicComponent(
        containerType,
        containerType,
        'Round Trip Container',
        [],
        {},
        true
      ),
      properties: [],
      defaults: {},
      isContainer: true
    })
    componentRegistry.register({
      type: leafType,
      idPrefix: leafType,
      namePrefix: 'Round Trip Leaf',
      constructor: createDynamicComponent(
        leafType,
        leafType,
        'Round Trip Leaf',
        [],
        {}
      ),
      properties: [],
      defaults: {}
    })
    const payload = {
      workspace: 'workspace',
      workspaceList: ['workspace'],
      elements: {
        workspace: {
          id: 'workspace',
          type: EntityTypes.WORKSPACE,
          name: 'Workspace',
          parentId: '',
          visible: true,
          lock: false,
          children: ['outer']
        },
        outer: {
          id: 'outer',
          type: containerType,
          name: 'Outer',
          parentId: 'workspace',
          visible: true,
          lock: false,
          props: {},
          children: ['first', 'inner', 'last']
        },
        first: {
          id: 'first',
          type: leafType,
          name: 'First',
          parentId: 'outer',
          visible: true,
          lock: false,
          props: {}
        },
        inner: {
          id: 'inner',
          type: containerType,
          name: 'Inner',
          parentId: 'outer',
          visible: true,
          lock: false,
          props: {},
          children: ['nested']
        },
        nested: {
          id: 'nested',
          type: leafType,
          name: 'Nested',
          parentId: 'inner',
          visible: true,
          lock: false,
          props: {}
        },
        last: {
          id: 'last',
          type: leafType,
          name: 'Last',
          parentId: 'outer',
          visible: true,
          lock: false,
          props: {}
        }
      }
    }

    const validation = sceneTree.validateLoadData(payload)
    expect(validation.valid).toBe(true)
    expect(validation.diagnostics).toEqual([])

    sceneTree.applyValidatedLoad(validation)

    expect(sceneTree.save()).toEqual(payload)
  })

  it('applies only its own one-shot validated artifact without rerunning validation', () => {
    const position = propsManager.createProperty(
      new TestPositionComponent({
        id: 'one-shot-load-position',
        x: 1,
        y: 2
      }).save()
    )
    const dimension = propsManager.createProperty(
      new TestDimensionComponent({
        id: 'one-shot-load-dimension',
        width: 30,
        height: 40
      }).save()
    )
    propsManager.addProperty([position, dimension])
    const validation = sceneTree.validateLoadData({
      workspace: 'workspace',
      workspaceList: ['workspace'],
      elements: {
        workspace: {
          id: 'workspace',
          type: EntityTypes.WORKSPACE,
          name: 'Workspace',
          parentId: '',
          visible: true,
          lock: false,
          children: ['rect-1']
        },
        'rect-1': {
          id: 'rect-1',
          type: 'rect',
          name: 'Rect',
          parentId: 'workspace',
          visible: true,
          lock: false,
          props: {
            position: position.get('id'),
            dimension: dimension.get('id')
          }
        }
      }
    })
    const foreignSceneTree = new SceneTree()
    const forged = {
      data: validation.data,
      diagnostics: validation.diagnostics
    }

    validation.data.elements['rect-1'].type = 'unknown-after-validation'
    sceneTree.validateLoadData = vi.fn(() => {
      throw new Error('validation must not rerun during apply')
    })

    expect(() => foreignSceneTree.applyValidatedLoad(validation)).toThrow(
      /owner-issued.*artifact/i
    )
    expect(() =>
      sceneTree.applyValidatedLoad(forged as typeof validation)
    ).toThrow(/owner-issued.*artifact/i)

    sceneTree.applyValidatedLoad(validation)

    expect(sceneTree.validateLoadData).not.toHaveBeenCalled()
    expect(sceneTree.getElementById('rect-1')?.get('type')).toBe('rect')
    expect(() => sceneTree.applyValidatedLoad(validation)).toThrow(
      /owner-issued.*artifact/i
    )
  })

  it('rejects invalid workspace metadata without replacing current hierarchy', () => {
    sceneTree.init()
    const originalWorkspace = sceneTree.workspace

    expect(() =>
      sceneTree.load({
        workspace: 123 as unknown as string,
        workspaceList: 'invalid' as unknown as string[],
        elements: {
          'rect-1': {
            id: 'rect-1',
            type: 'rect',
            name: 'Rect 1',
            parentId: 'missing-workspace',
            visible: true,
            lock: false
          }
        }
      })
    ).toThrow(/invalid hierarchy/i)

    expect(sceneTree.workspace).toBe(originalWorkspace)
    expect(sceneTree.getAllElements().size).toBe(1)
    expect(sceneTree.getElementById('rect-1')).toBeUndefined()
  })

  it('refuses to serialize a non-canonical hierarchy', () => {
    sceneTree.init()
    const workspace = sceneTree.currentWorkspace as Workspace
    workspace.set('children', ['missing-child'])
    sceneTree.cleanChanges()

    expect(() => sceneTree.save()).toThrow(/invalid canonical hierarchy/i)
  })

  it('should save data correctly', () => {
    sceneTree.init()
    const workspace = sceneTree.currentWorkspace as Workspace
    sceneTree.addNewElement(
      { id: 'el-1', type: 'rect', x: 0, y: 0 },
      workspace as GroupInstanceTypes
    )
    const workspaceSaveData = workspace.save()

    const savedData = sceneTree.save()

    expect(savedData.workspace).toBe(workspaceSaveData.id)
    expect(savedData.workspaceList).toEqual([workspaceSaveData.id])
    expect(savedData.elements[workspaceSaveData.id]).toEqual(workspaceSaveData)
    expect(savedData.elements['el-1']).toEqual(
      expect.objectContaining({
        id: 'el-1',
        type: 'rect',
        parentId: workspaceSaveData.id
      })
    )
  })

  it('keeps empty, partial, and mixed ordinary props on the existing creation path', () => {
    sceneTree.init()
    const workspace = sceneTree.currentWorkspace as Workspace

    expect(
      sceneTree.addNewElements(
        [
          { id: 'empty-props', type: 'rect', x: 1, y: 2, props: {} },
          {
            id: 'partial-props',
            type: 'rect',
            x: 3,
            y: 4,
            props: { position: 'missing-requested-position' }
          },
          { id: 'implicit-props', type: 'rect', x: 5, y: 6 }
        ] as CreateElementData[],
        workspace as GroupInstanceTypes
      )
    ).toEqual(['empty-props', 'partial-props', 'implicit-props'])
    ;['empty-props', 'partial-props', 'implicit-props'].forEach((elementId) => {
      const propertyIds = Object.values(
        sceneTree.getElementById(elementId)?.save().props ?? {}
      )
      expect(propertyIds).toHaveLength(2)
      propertyIds.forEach((propertyId) => {
        expect(propsManager.getPropertyById(propertyId)).toBeDefined()
      })
    })
  })

  it('materializes explicit ordinary property owners from descriptor values before computed projection', () => {
    sceneTree.init()
    const workspace = sceneTree.currentWorkspace as Workspace

    expect(
      sceneTree.addNewElements(
        [
          {
            id: 'prepared-owner-first',
            type: TEST_PREPARED_OWNER_TYPE,
            x: 17,
            y: 29,
            width: 131,
            height: 197,
            props: {
              position: 'prepared-owner-first-position',
              dimension: 'prepared-owner-first-dimension'
            }
          },
          {
            id: 'prepared-owner-second',
            type: TEST_PREPARED_OWNER_TYPE,
            x: 31,
            y: 43,
            width: 211,
            height: 223,
            props: {
              position: 'prepared-owner-second-position',
              dimension: 'prepared-owner-second-dimension'
            }
          }
        ],
        workspace as GroupInstanceTypes
      )
    ).toEqual(['prepared-owner-first', 'prepared-owner-second'])

    expect(propsManager.save()).toMatchObject({
      'prepared-owner-first-position': {
        id: 'prepared-owner-first-position',
        x: 17,
        y: 29
      },
      'prepared-owner-first-dimension': {
        id: 'prepared-owner-first-dimension',
        width: 131,
        height: 197
      },
      'prepared-owner-second-position': {
        id: 'prepared-owner-second-position',
        x: 31,
        y: 43
      },
      'prepared-owner-second-dimension': {
        id: 'prepared-owner-second-dimension',
        width: 211,
        height: 223
      }
    })
    expect(
      sceneTree.getElementById('prepared-owner-first')?.getAllComputedData()
    ).toMatchObject({
      x: 17,
      y: 29,
      width: 131,
      height: 197
    })
    expect(
      sceneTree.getElementById('prepared-owner-second')?.getAllComputedData()
    ).toMatchObject({
      x: 31,
      y: 43,
      width: 211,
      height: 223
    })
  })

  it('rejects a failed canonical element batch without a scene or property prefix', () => {
    sceneTree.init()
    sceneTree.cleanChanges()
    propsManager.cleanChanges()
    const workspace = sceneTree.currentWorkspace as Workspace
    const beforeElementIds = [...sceneTree.getAllElements().keys()]
    const beforeChildren = [...workspace.get('children')]
    const beforeProps = propsManager.save()
    const propsCommit = vi.spyOn(propsManager, 'commitChanges')
    const sceneCommit = vi.spyOn(sceneTree, 'commitSceneTreeTransaction')

    expect(() =>
      sceneTree.addNewElements(
        [
          { id: 'failed-batch-prefix', type: 'rect', x: 0, y: 0 },
          {
            id: 'failed-batch-tail',
            type: 'unregistered-component',
            x: 10,
            y: 10
          }
        ],
        workspace as GroupInstanceTypes,
        undefined,
        { undoable: true }
      )
    ).toThrow(/no component registered/i)

    expect([...sceneTree.getAllElements().keys()]).toEqual(beforeElementIds)
    expect(workspace.get('children')).toEqual(beforeChildren)
    expect(propsManager.save()).toEqual(beforeProps)
    expect(sceneTree.changes).toEqual([])
    expect(propsManager.changes).toEqual([])
    expect(propsCommit).not.toHaveBeenCalled()
    expect(sceneCommit).not.toHaveBeenCalled()
  })

  it('rolls back a prepared property batch when transaction preparation fails', () => {
    sceneTree.init()
    sceneTree.cleanChanges()
    propsManager.cleanChanges()
    const workspace = sceneTree.currentWorkspace as Workspace
    const beforeElementIds = [...sceneTree.getAllElements().keys()]
    const beforeProps = propsManager.save()
    vi.spyOn(propsManager, 'prepareTransactionEvents').mockImplementationOnce(
      () => {
        throw new Error('property transaction preparation failure')
      }
    )

    expect(() =>
      sceneTree.addNewElements(
        [{ id: 'failed-property-commit', type: 'rect', x: 2, y: 4 }],
        workspace as GroupInstanceTypes,
        undefined,
        { undoable: true }
      )
    ).toThrow('property transaction preparation failure')

    expect([...sceneTree.getAllElements().keys()]).toEqual(beforeElementIds)
    expect(workspace.get('children')).toEqual([])
    expect(propsManager.save()).toEqual(beforeProps)
    expect(sceneTree.changes).toEqual([])
    expect(propsManager.changes).toEqual([])
  })

  it('rejects a later invalid runtime property value during whole-batch preflight', () => {
    sceneTree.init()
    sceneTree.cleanChanges()
    propsManager.cleanChanges()
    registerPropertySchema({
      type: PropertyTypes.POSITION,
      fields: [
        {
          key: 'x',
          kind: 'number',
          defaultValue: 0
        }
      ]
    })
    const workspace = sceneTree.currentWorkspace as Workspace
    const beforeElementIds = [...sceneTree.getAllElements().keys()]
    const beforeProps = propsManager.save()
    const createPropertyBatch = vi.spyOn(
      propsManager,
      'runInPropertyCreationBatch'
    )
    const propsChanges: PropsChange[] = []
    const subscription = subscribeToEvents((event) => {
      if (
        event.type === EventTypes.UPDATE_TRANSACTION &&
        'payload' in event &&
        Object.values(PROPS_ACTIONS).includes(
          (event.payload as PropsChange).action
        )
      ) {
        propsChanges.push(event.payload as PropsChange)
      }
    })

    try {
      expect(() =>
        sceneTree.addNewElements(
          [
            { id: 'valid-runtime-prefix', type: 'rect', x: 4, y: 8 },
            {
              id: 'invalid-runtime-tail',
              type: 'rect',
              x: Number.NaN,
              y: 12
            }
          ],
          workspace as GroupInstanceTypes,
          undefined,
          { undoable: true }
        )
      ).toThrow(/invalid runtime property field "position.x"/i)
    } finally {
      unregisterPropertySchema(PropertyTypes.POSITION)
    }

    expect([...sceneTree.getAllElements().keys()]).toEqual(beforeElementIds)
    expect(workspace.get('children')).toEqual([])
    expect(propsManager.save()).toEqual(beforeProps)
    expect(sceneTree.changes).toEqual([])
    expect(propsManager.changes).toEqual([])
    expect(createPropertyBatch).not.toHaveBeenCalled()
    expect(propsChanges).toEqual([])
    subscription.unsubscribe()
  })

  it('keeps ordinary descriptor properties inactive through materialization and registers them once', () => {
    sceneTree.init()
    sceneTree.cleanChanges()
    propsManager.cleanChanges()
    const workspace = sceneTree.currentWorkspace as Workspace
    const activePropertyIdsDuringMaterialization: string[][] = []
    const addProperty = propsManager.addProperty.bind(propsManager)
    const addPropertySpy = vi
      .spyOn(propsManager, 'addProperty')
      .mockImplementation((components) => {
        const propertyIds = addProperty(components)
        activePropertyIdsDuringMaterialization.push(
          Object.keys(propsManager.save())
        )
        return propertyIds
      })
    const registerMany = vi.spyOn(propsManager, 'registerMany')

    expect(
      sceneTree.addNewElements(
        [
          { id: 'ordinary-staged-first', type: 'rect', x: 1, y: 2 },
          { id: 'ordinary-staged-second', type: 'rect', x: 3, y: 4 }
        ],
        workspace as GroupInstanceTypes
      )
    ).toEqual(['ordinary-staged-first', 'ordinary-staged-second'])

    expect(activePropertyIdsDuringMaterialization).toEqual([[], []])
    expect(addPropertySpy).toHaveBeenCalledTimes(2)
    expect(registerMany).toHaveBeenCalledTimes(1)
    expect(registerMany.mock.calls[0]?.[0]).toHaveLength(4)
    expect(Object.keys(propsManager.save())).toHaveLength(4)
    expect(workspace.get('children')).toEqual([
      'ordinary-staged-first',
      'ordinary-staged-second'
    ])
  })

  it('leaves no ordinary descriptor prefix when property registration drifts during materialization', () => {
    sceneTree.init()
    sceneTree.cleanChanges()
    propsManager.cleanChanges()
    const workspace = sceneTree.currentWorkspace as Workspace
    const beforeElementIds = [...sceneTree.getAllElements().keys()]
    const beforeChildren = [...workspace.get('children')]
    const beforeProps = propsManager.save()

    class RegistrationDriftingPosition extends TestPositionComponent {
      constructor(data: Partial<PositionAttrs>) {
        super(data)
        propertyComponentRegistry.unregister(PropertyTypes.DIMENSION)
        registerPropertyComponent(
          PropertyTypes.DIMENSION,
          TestDimensionComponent
        )
      }
    }
    propertyComponentRegistry.unregister(PropertyTypes.POSITION)
    registerPropertyComponent(
      PropertyTypes.POSITION,
      RegistrationDriftingPosition
    )
    const registerMany = vi.spyOn(propsManager, 'registerMany')

    expect(() =>
      sceneTree.addNewElements(
        [
          { id: 'ordinary-drift-first', type: 'rect', x: 1, y: 2 },
          { id: 'ordinary-drift-second', type: 'rect', x: 3, y: 4 }
        ],
        workspace as GroupInstanceTypes
      )
    ).toThrow(/registration changed/i)

    expect(registerMany).not.toHaveBeenCalled()
    expect([...sceneTree.getAllElements().keys()]).toEqual(beforeElementIds)
    expect(workspace.get('children')).toEqual(beforeChildren)
    expect(propsManager.save()).toEqual(beforeProps)
    expect(sceneTree.changes).toEqual([])
    expect(propsManager.changes).toEqual([])
  })

  it('rejects a later invalid ids-or-objects child before ordinary batch materialization', () => {
    const childType = 'scene-invalid-paint'
    const parentType = 'scene-invalid-paints'
    const elementType = 'scene-invalid-painted-element'
    const ChildComponent = createPropertyComponentFromConfig({
      type: childType,
      defaults: { opacity: 1 },
      persistKeys: ['opacity'],
      valueKeys: ['opacity']
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
          opacity: 1,
          ...item
        })
      }
    }
    registerPropertySchema({
      type: childType,
      fields: [
        {
          key: 'opacity',
          kind: 'number',
          validate: (value) =>
            typeof value === 'number' && value >= 0 && value <= 1,
          defaultValue: 1
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
      createPropertyComponentFromConfig(parentDefinition),
      undefined,
      parentDefinition
    )
    const properties = [
      {
        name: 'paints',
        type: parentType,
        defaultValue: [] as unknown[]
      }
    ]
    componentRegistry.register({
      type: elementType,
      idPrefix: elementType,
      namePrefix: 'Invalid Painted Element',
      constructor: createDynamicComponent(
        elementType,
        elementType,
        'Invalid Painted Element',
        properties,
        {}
      ),
      properties,
      defaults: {}
    })
    sceneTree.init()
    sceneTree.cleanChanges()
    propsManager.cleanChanges()
    const workspace = sceneTree.currentWorkspace as Workspace
    const beforeElementIds = [...sceneTree.getAllElements().keys()]
    const beforeProps = propsManager.save()
    const createPropertyBatch = vi.spyOn(
      propsManager,
      'runInPropertyCreationBatch'
    )

    expect(() =>
      sceneTree.addNewElements(
        [
          {
            id: 'valid-painted-prefix',
            type: elementType,
            x: 0,
            y: 0,
            paints: [{ opacity: 0.5 }]
          },
          {
            id: 'invalid-painted-tail',
            type: elementType,
            x: 0,
            y: 0,
            paints: [{ opacity: 2 }]
          }
        ] as CreateElementData[],
        workspace as GroupInstanceTypes
      )
    ).toThrow(/invalid runtime property field.*opacity/i)

    expect(createPropertyBatch).not.toHaveBeenCalled()
    expect([...sceneTree.getAllElements().keys()]).toEqual(beforeElementIds)
    expect(workspace.get('children')).toEqual([])
    expect(propsManager.save()).toEqual(beforeProps)
    expect(propsManager.changes).toEqual([])
    expect(sceneTree.changes).toEqual([])
  })

  it('emits detached owner timings for each canonical element batch stage', () => {
    sceneTree.init()
    const phaseNames: string[] = []
    const runtime = globalThis as typeof globalThis & {
      __asyraBrowserDragPhaseSink?: (name: string, durationMs: number) => void
    }
    runtime.__asyraBrowserDragPhaseSink = (name) => {
      if (name.startsWith('scene-tree:element-batch:')) {
        phaseNames.push(name)
      }
    }

    try {
      sceneTree.addNewElements(
        [
          { id: 'profiled-batch-1', type: 'rect', x: 0, y: 0 },
          { id: 'profiled-batch-2', type: 'rect', x: 10, y: 10 }
        ],
        sceneTree.currentWorkspace as GroupInstanceTypes,
        undefined,
        { undoable: true }
      )
    } finally {
      delete runtime.__asyraBrowserDragPhaseSink
    }

    expect(phaseNames).toEqual([
      'scene-tree:element-batch:materialize',
      'scene-tree:element-batch:parent-membership',
      'scene-tree:element-batch:record-evidence',
      'scene-tree:element-batch:commit-props',
      'scene-tree:element-batch:commit-scene'
    ])
  })

  it('does not let a failing timing observer change canonical batch behavior', () => {
    sceneTree.init()
    const runtime = globalThis as typeof globalThis & {
      __asyraBrowserDragPhaseSink?: (name: string, durationMs: number) => void
    }
    runtime.__asyraBrowserDragPhaseSink = () => {
      throw new Error('diagnostic sink failure')
    }

    try {
      expect(
        sceneTree.addNewElements(
          [{ id: 'observer-safe-batch', type: 'rect', x: 4, y: 8 }],
          sceneTree.currentWorkspace as GroupInstanceTypes,
          undefined,
          { undoable: true }
        )
      ).toEqual(['observer-safe-batch'])
    } finally {
      delete runtime.__asyraBrowserDragPhaseSink
    }

    expect(sceneTree.getElementById('observer-safe-batch')?.save()).toEqual(
      expect.objectContaining({
        id: 'observer-safe-batch',
        parentId: sceneTree.workspace
      })
    )
  })

  it('Step 4 canonical owner: rejects a later invalid item before materialization or apply', () => {
    sceneTree.init()
    const workspace = sceneTree.currentWorkspace as Workspace
    const constructorCall = vi.fn()
    const trackedType = 'preflight-tracked-element'

    class PreflightTrackedElement extends Element {
      constructor(data?: Partial<ElementRawData>) {
        super(data)
        constructorCall()
        this.data.type = trackedType
      }
    }

    componentRegistry.register({
      type: trackedType,
      idPrefix: trackedType,
      namePrefix: 'Preflight Tracked Element',
      constructor: PreflightTrackedElement,
      properties: [],
      defaults: {}
    })

    const replaceChildren = vi.spyOn(
      workspace,
      'replaceChildrenFromCanonicalBatch'
    )
    const addToMap = vi.spyOn(sceneTree, 'addToMap')
    const propsCommit = vi.spyOn(propsManager, 'commitChanges')
    const sceneCommit = vi.spyOn(sceneTree, 'commitSceneTreeTransaction')

    expect(() =>
      sceneTree.addNewElements(
        [
          {
            id: 'preflight-valid-prefix',
            type: trackedType,
            x: 0,
            y: 0
          },
          {
            id: 'preflight-invalid-tail',
            type: 'unregistered-component',
            x: 0,
            y: 0
          }
        ],
        workspace as GroupInstanceTypes
      )
    ).toThrow(/no component registered/i)

    expect({
      constructorCalls: constructorCall.mock.calls.length,
      parentReplacementCalls: replaceChildren.mock.calls.length,
      mapRegistrationCalls: addToMap.mock.calls.length,
      propsCommitCalls: propsCommit.mock.calls.length,
      sceneCommitCalls: sceneCommit.mock.calls.length
    }).toEqual({
      constructorCalls: 0,
      parentReplacementCalls: 0,
      mapRegistrationCalls: 0,
      propsCommitCalls: 0,
      sceneCommitCalls: 0
    })
  })

  it('Step 4 canonical owner: registers one ordered element batch through one registry boundary', () => {
    sceneTree.init()
    const workspace = sceneTree.currentWorkspace as Workspace
    const addToMap = sceneTree.addToMap.bind(sceneTree)
    const addManyToMap = vi.fn((elements: readonly ElementInstanceTypes[]) => {
      elements.forEach(addToMap)
    })
    ;(
      sceneTree as SceneTree & {
        addManyToMap: (elements: readonly ElementInstanceTypes[]) => void
      }
    ).addManyToMap = addManyToMap

    expect(
      sceneTree.addNewElements(
        [
          { id: 'registry-batch-1', type: TEST_EMPTY_TYPE, x: 0, y: 0 },
          { id: 'registry-batch-2', type: TEST_EMPTY_TYPE, x: 0, y: 0 },
          { id: 'registry-batch-3', type: TEST_EMPTY_TYPE, x: 0, y: 0 }
        ],
        workspace as GroupInstanceTypes
      )
    ).toEqual(['registry-batch-1', 'registry-batch-2', 'registry-batch-3'])

    expect({
      boundaryCalls: addManyToMap.mock.calls.length,
      orderedIds:
        addManyToMap.mock.calls[0]?.[0].map((element) => element.get('id')) ??
        []
    }).toEqual({
      boundaryCalls: 1,
      orderedIds: ['registry-batch-1', 'registry-batch-2', 'registry-batch-3']
    })
  })

  it('Step 4 canonical owner: makes the normal single create exactly batch-of-one', () => {
    sceneTree.init()
    const workspace = sceneTree.currentWorkspace as Workspace
    const addToMap = sceneTree.addToMap.bind(sceneTree)
    const addManyToMap = vi.fn((elements: readonly ElementInstanceTypes[]) => {
      elements.forEach(addToMap)
    })
    ;(
      sceneTree as SceneTree & {
        addManyToMap: (elements: readonly ElementInstanceTypes[]) => void
      }
    ).addManyToMap = addManyToMap
    const replaceChildren = vi.spyOn(
      workspace,
      'replaceChildrenFromCanonicalBatch'
    )
    const readBoundary = () => ({
      registryBatchCalls: addManyToMap.mock.calls.length,
      registeredElementCount: addManyToMap.mock.calls[0]?.[0].length ?? 0,
      parentReplacementCalls: replaceChildren.mock.calls.length
    })

    expect(
      sceneTree.addNewElement(
        { id: 'normal-single', type: TEST_EMPTY_TYPE, x: 0, y: 0 },
        workspace as GroupInstanceTypes
      )
    ).toBe('normal-single')
    const normalSingleBoundary = readBoundary()

    addManyToMap.mockClear()
    replaceChildren.mockClear()

    expect(
      sceneTree.addNewElements(
        [
          {
            id: 'explicit-batch-of-one',
            type: TEST_EMPTY_TYPE,
            x: 0,
            y: 0
          }
        ],
        workspace as GroupInstanceTypes
      )
    ).toEqual(['explicit-batch-of-one'])
    const explicitBatchBoundary = readBoundary()

    expect(normalSingleBoundary).toEqual(explicitBatchBoundary)
    expect(normalSingleBoundary).toEqual({
      registryBatchCalls: 1,
      registeredElementCount: 1,
      parentReplacementCalls: 1
    })
  })

  it('Step 4 canonical owner: hands off one ordered Props and Scene batch or restores the complete pre-apply state', () => {
    sceneTree.init()
    const workspace = sceneTree.currentWorkspace as Workspace
    const reusedId = 'failed-combined-handoff'
    const tombstoneId = 'unrelated-combined-handoff-tombstone'

    sceneTree.addNewElement(
      { id: tombstoneId, type: 'rect', x: 1, y: 2 },
      workspace as GroupInstanceTypes
    )
    const tombstone = sceneTree.getElementById(tombstoneId)
    expect(tombstone).toBeDefined()
    if (!tombstone) {
      throw new Error('Expected canonical tombstone fixture')
    }
    expect(
      runWithTransactionOwner(createTestTransactionOwner(), () =>
        sceneTree.removeElement(
          { id: tombstoneId },
          workspace as GroupInstanceTypes
        )
      )
    ).toBe(true)
    expect(sceneTree._deletedMap.get(tombstoneId)).toBe(tombstone)

    const beforeChildren = [...workspace.get('children')]
    const beforeProps = propsManager.save()
    sceneTree.cleanChanges()
    propsManager.cleanChanges()

    const handoffFailure = new Error('combined owner handoff failed')
    const individualHandoff = vi.fn((_event: UpdateTransactionEvent) => {
      throw handoffFailure
    })
    const batchHandoff = vi.fn((_events: readonly UpdateTransactionEvent[]) => {
      throw handoffFailure
    })
    const transactionOwner = {
      startTransaction: vi.fn(),
      updateTransaction: individualHandoff,
      updateTransactionBatch: batchHandoff,
      endTransaction: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn()
    }

    let capturedFailure: unknown
    try {
      runInTransactionReplayMode('redo', () =>
        runWithTransactionOwner(transactionOwner, () =>
          sceneTree.addNewElements(
            [{ id: reusedId, type: 'rect', x: 10, y: 20 }],
            workspace as GroupInstanceTypes,
            undefined,
            { undoable: true }
          )
        )
      )
    } catch (error) {
      capturedFailure = error
    }
    expect(capturedFailure).toBe(handoffFailure)
    expect(wasTransactionReplayApplied(capturedFailure)).toBe(false)

    const orderedBatch =
      batchHandoff.mock.calls[0]?.[0].map(({ payload }) => {
        const change = payload as PropsChange | SceneTreeChange
        if (change.action === PROPS_ACTIONS.ADD_PROPERTY) {
          return 'props:add'
        }
        if (
          change.action === SCENE_TREE_ACTIONS.ADD_ELEMENT &&
          'data' in change
        ) {
          return `scene:add:${change.data.id}`
        }
        return `unexpected:${change.action}`
      }) ?? []
    const deliveredEvents = batchHandoff.mock.calls[0]?.[0] ?? []
    const propertyRecord =
      deliveredEvents[0]?.canonicalEvidence?.sharedRecords?.[0]

    expect({
      individualHandoffCalls: individualHandoff.mock.calls.length,
      batchHandoffCalls: batchHandoff.mock.calls.length,
      orderedBatch,
      propsEvidenceOrderedIds:
        deliveredEvents[0]?.canonicalEvidence?.orderedIds ?? [],
      propsRecordOrderedIds: propertyRecord?.orderedIds ?? [],
      propsRecordPropertyCount:
        (propertyRecord?.payload as AddRemovePropertyChange | undefined)?.data
          .length ?? 0,
      sceneEvidenceOrderedIds:
        deliveredEvents[1]?.canonicalEvidence?.orderedIds ?? [],
      activeElementRestored: sceneTree.getElementById(reusedId) === undefined,
      tombstoneRestored: sceneTree._deletedMap.get(tombstoneId) === tombstone,
      parentRestored:
        JSON.stringify(workspace.get('children')) ===
        JSON.stringify(beforeChildren),
      propertiesRestored:
        JSON.stringify(propsManager.save()) === JSON.stringify(beforeProps),
      propsEvidenceCount: propsManager.changes.length,
      sceneEvidenceCount: sceneTree.changes.length
    }).toEqual({
      individualHandoffCalls: 0,
      batchHandoffCalls: 1,
      orderedBatch: ['props:add', `scene:add:${reusedId}`],
      propsEvidenceOrderedIds: [reusedId],
      propsRecordOrderedIds: [reusedId],
      propsRecordPropertyCount: 2,
      sceneEvidenceOrderedIds: [reusedId],
      activeElementRestored: true,
      tombstoneRestored: true,
      parentRestored: true,
      propertiesRestored: true,
      propsEvidenceCount: 0,
      sceneEvidenceCount: 0
    })
  })

  it('Step 4 canonical owner: rejects active and tombstoned ids before batch materialization or registry replacement', () => {
    sceneTree.init()
    const workspace = sceneTree.currentWorkspace as Workspace
    const tombstoneId = 'canonical-tombstone-collision'

    sceneTree.addNewElement(
      { id: tombstoneId, type: 'rect', x: 1, y: 2 },
      workspace as GroupInstanceTypes
    )
    const tombstone = sceneTree.getElementById(tombstoneId)
    expect(tombstone).toBeDefined()
    if (!tombstone) {
      throw new Error('Expected canonical collision tombstone fixture')
    }
    expect(
      runWithTransactionOwner(createTestTransactionOwner(), () =>
        sceneTree.removeElement(
          { id: tombstoneId },
          workspace as GroupInstanceTypes
        )
      )
    ).toBe(true)

    const beforeChildren = [...workspace.get('children')]
    const beforeProps = propsManager.save()
    expect(() =>
      sceneTree.addNewElements(
        [
          { id: tombstoneId, type: 'rect', x: 10, y: 20 },
          { id: 'canonical-tail-after-tombstone', type: 'rect', x: 30, y: 40 }
        ],
        workspace as GroupInstanceTypes
      )
    ).toThrow(/unique inactive ids/i)

    expect(sceneTree.getElementById(tombstoneId)).toBeUndefined()
    expect(sceneTree._deletedMap.get(tombstoneId)).toBe(tombstone)
    expect(workspace.get('children')).toEqual(beforeChildren)
    expect(propsManager.save()).toEqual(beforeProps)
    expect(() =>
      sceneTree.addManyToMap([tombstone], workspace.get('id'))
    ).toThrow(/unique inactive ids/i)
  })

  it('Step 4 canonical owner: emits no per-event observer traversal after one batch handoff', () => {
    sceneTree.init()
    const workspace = sceneTree.currentWorkspace as Workspace
    const updateEvents: UpdateTransactionEvent[] = []
    const subscription = subscribeToEvents((event) => {
      if (event.type === EventTypes.UPDATE_TRANSACTION) {
        updateEvents.push(event as UpdateTransactionEvent)
      }
    })
    updateEvents.length = 0
    const batchHandoff = vi.fn()
    const transactionOwner = {
      startTransaction: vi.fn(),
      updateTransaction: vi.fn(),
      updateTransactionBatch: batchHandoff,
      endTransaction: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn()
    }

    expect(
      runWithTransactionOwner(
        transactionOwner as unknown as TransactionOwner,
        () =>
          sceneTree.addNewElements(
            [
              { id: 'observer-batch-1', type: TEST_EMPTY_TYPE, x: 0, y: 0 },
              { id: 'observer-batch-2', type: TEST_EMPTY_TYPE, x: 0, y: 0 },
              { id: 'observer-batch-3', type: TEST_EMPTY_TYPE, x: 0, y: 0 }
            ],
            workspace as GroupInstanceTypes
          )
      )
    ).toEqual(['observer-batch-1', 'observer-batch-2', 'observer-batch-3'])

    expect(batchHandoff).toHaveBeenCalledOnce()
    expect(updateEvents).toEqual([])
    subscription.unsubscribe()
  })

  it('Step 4 canonical owner: rolls back a pre-handoff projection failure even when it reports batch acceptance', () => {
    sceneTree.init()
    const workspace = sceneTree.currentWorkspace as Workspace
    const beforeChildren = [...workspace.get('children')]
    const beforeProps = propsManager.save()
    const projectBatch = workspace.addNewElements.bind(workspace)
    const preHandoffFailure = Object.assign(
      new Error('pre-handoff projection failed'),
      { batchAccepted: true }
    )
    vi.spyOn(workspace, 'addNewElements').mockImplementation(
      (elements, parent, index) => {
        projectBatch(elements, parent, index)
        throw preHandoffFailure
      }
    )
    const batchHandoff = vi.fn()
    const transactionOwner = {
      startTransaction: vi.fn(),
      updateTransaction: vi.fn(),
      updateTransactionBatch: batchHandoff,
      endTransaction: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn()
    }

    expect(() =>
      runWithTransactionOwner(transactionOwner, () =>
        sceneTree.addNewElements(
          [{ id: 'pre-handoff-accepted-shape', type: 'rect', x: 10, y: 20 }],
          workspace as GroupInstanceTypes
        )
      )
    ).toThrow(preHandoffFailure)

    expect(batchHandoff).not.toHaveBeenCalled()
    expect(
      sceneTree.getElementById('pre-handoff-accepted-shape')
    ).toBeUndefined()
    expect(workspace.get('children')).toEqual(beforeChildren)
    expect(propsManager.save()).toEqual(beforeProps)
    expect(propsManager.changes).toEqual([])
    expect(sceneTree.changes).toEqual([])
  })

  it('Step 4 canonical owner: leaves accepted batch state for one outer Factory rollback and only clears pending evidence', () => {
    sceneTree.init()
    const workspace = sceneTree.currentWorkspace as Workspace
    const acceptedFailure = Object.assign(
      new Error('accepted canonical batch failed'),
      { batchAccepted: true }
    )
    const transactionOwner = {
      startTransaction: vi.fn(),
      updateTransaction: vi.fn(),
      updateTransactionBatch: vi.fn(() => {
        throw acceptedFailure
      }),
      endTransaction: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn()
    }

    expect(() =>
      runWithTransactionOwner(transactionOwner, () =>
        sceneTree.addNewElements(
          [{ id: 'accepted-for-outer-rollback', type: 'rect', x: 10, y: 20 }],
          workspace as GroupInstanceTypes
        )
      )
    ).toThrow(acceptedFailure)

    expect(
      sceneTree.getElementById('accepted-for-outer-rollback')
    ).toBeDefined()
    expect(workspace.get('children')).toContain('accepted-for-outer-rollback')
    expect(Object.keys(propsManager.save()).length).toBeGreaterThan(0)
    expect(propsManager.changes).toEqual([])
    expect(sceneTree.changes).toEqual([])
  })

  it('keeps one plural Scene event while exposing one ordered shared record per inserted element', () => {
    sceneTree.init()
    const workspace = sceneTree.currentWorkspace as Workspace
    const parentId = workspace.get('id')
    const elements = [
      {
        id: 'progressive-scene-record-a',
        type: TEST_EMPTY_TYPE,
        name: 'Progressive Scene Record A',
        parentId,
        visible: true,
        lock: false,
        props: {}
      },
      {
        id: 'progressive-scene-record-b',
        type: TEST_EMPTY_TYPE,
        name: 'Progressive Scene Record B',
        parentId,
        visible: true,
        lock: false,
        props: {}
      }
    ] as unknown as readonly ElementRawData[]
    const transactionOwner = createTestTransactionOwner()
    const preparedMutation = sceneTree.prepareElementInsertion({
      elements,
      ownerRelations: [],
      parentId
    })

    const result = runWithTransactionOwner(transactionOwner, () =>
      sceneTree.applyPreparedElementMutation(preparedMutation)
    )

    expect(result.orderedElementIds).toEqual(elements.map(({ id }) => id))
    expect(transactionOwner.updateTransactionBatch).toHaveBeenCalledOnce()
    const events = transactionOwner.updateTransactionBatch.mock
      .calls[0]?.[0] as readonly UpdateTransactionEvent[] | undefined
    expect(events).toHaveLength(1)
    expect(events?.[0]?.eventName).toBe(EventTypes.ADD_ELEMENTS)
    expect(
      (events?.[0]?.payload as AddRemoveElementsChange).entries.map(
        ({ data }) => data.id
      )
    ).toEqual(elements.map(({ id }) => id))
    expect(
      events?.[0]?.canonicalEvidence?.sharedRecords?.map(
        ({ orderedIds, payload }) => ({
          orderedIds,
          payloadIds: (payload as AddRemoveElementsChange).entries.map(
            ({ data }) => data.id
          )
        })
      )
    ).toEqual([
      {
        orderedIds: ['progressive-scene-record-a'],
        payloadIds: ['progressive-scene-record-a']
      },
      {
        orderedIds: ['progressive-scene-record-b'],
        payloadIds: ['progressive-scene-record-b']
      }
    ])
  })

  it('applies one exact canonical Scene removal preparation while Props stay active', () => {
    sceneTree.init()
    const workspace = sceneTree.currentWorkspace as Workspace
    sceneTree.addNewElements(
      [
        { id: 'active-props-remove-1', type: 'rect', x: 10, y: 20 },
        { id: 'active-props-remove-2', type: 'rect', x: 30, y: 40 }
      ],
      workspace as GroupInstanceTypes
    )
    const elements = [
      sceneTree.getElementById('active-props-remove-1'),
      sceneTree.getElementById('active-props-remove-2')
    ]
    if (elements.some((element) => !element)) {
      throw new Error('Expected active-property removal fixtures')
    }
    const removals = elements.map((element, index) => ({
      data: (element as ElementInstanceTypes).save(),
      parentId: workspace.get('id'),
      index
    }))
    const propertySnapshot = propsManager.save()
    const replaceChildren = vi.spyOn(workspace, 'replaceBatchParentChildren')
    sceneTree.cleanChanges()
    propsManager.cleanChanges()
    const updateTransaction = vi.fn()
    const updateTransactionBatch = vi.fn()
    const transactionOwner = {
      startTransaction: vi.fn(),
      updateTransaction,
      updateTransactionBatch,
      endTransaction: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn()
    }

    const preparedMutation = sceneTree.prepareCanonicalElementRemoval(removals)
    const result = runWithTransactionOwner(transactionOwner, () =>
      sceneTree.applyPreparedElementMutation(preparedMutation)
    )

    expect(result.orderedElementIds).toEqual([
      'active-props-remove-1',
      'active-props-remove-2'
    ])

    expect(workspace.get('children')).toEqual([])
    expect(sceneTree.getElementById('active-props-remove-1')).toBeUndefined()
    expect(sceneTree.getElementById('active-props-remove-2')).toBeUndefined()
    expect(propsManager.save()).toEqual(propertySnapshot)
    expect(replaceChildren).toHaveBeenCalledOnce()
    expect(updateTransaction).not.toHaveBeenCalled()
    expect(updateTransactionBatch).toHaveBeenCalledOnce()
    const events = updateTransactionBatch.mock
      .calls[0]?.[0] as readonly UpdateTransactionEvent[]
    expect(events).toHaveLength(1)
    expect(events[0]?.payload).toMatchObject({
      action: SCENE_TREE_ACTIONS.REMOVE_ELEMENTS
    })
    expect(
      (events[0]?.payload as AddRemoveElementsChange).entries.map(
        ({ data }) => data.id
      )
    ).toEqual(['active-props-remove-1', 'active-props-remove-2'])
    expect(updateTransactionBatch.mock.calls[0]).toHaveLength(1)
    expect(events[0]?.canonicalEvidence?.orderedIds).toEqual([
      'active-props-remove-1',
      'active-props-remove-2'
    ])
    expect(
      events[0]?.canonicalEvidence?.sharedRecords?.map(
        ({ orderedIds, payload }) => ({
          orderedIds,
          payloadIds: (payload as AddRemoveElementsChange).entries.map(
            ({ data }) => data.id
          )
        })
      )
    ).toEqual([
      {
        orderedIds: ['active-props-remove-1'],
        payloadIds: ['active-props-remove-1']
      },
      {
        orderedIds: ['active-props-remove-2'],
        payloadIds: ['active-props-remove-2']
      }
    ])
    expect(propsManager.changes).toEqual([])
    expect(sceneTree.changes).toEqual([])
  })

  it('rejects later stale canonical removal evidence with no Scene prefix', () => {
    sceneTree.init()
    const workspace = sceneTree.currentWorkspace as Workspace
    sceneTree.addNewElements(
      [
        { id: 'active-props-valid-head', type: 'rect', x: 10, y: 20 },
        { id: 'active-props-stale-tail', type: 'rect', x: 30, y: 40 }
      ],
      workspace as GroupInstanceTypes
    )
    const head = sceneTree.getElementById('active-props-valid-head')
    const tail = sceneTree.getElementById('active-props-stale-tail')
    if (!head || !tail) {
      throw new Error('Expected stale active-property removal fixtures')
    }
    const beforeProps = propsManager.save()
    const beforeChildren = [...workspace.get('children')]
    sceneTree.cleanChanges()
    propsManager.cleanChanges()

    expect(() =>
      sceneTree.prepareCanonicalElementRemoval([
        {
          data: head.save(),
          parentId: workspace.get('id'),
          index: 0
        },
        {
          data: { ...tail.save(), name: 'stale canonical name' },
          parentId: workspace.get('id'),
          index: 1
        }
      ])
    ).toThrow(/stale canonical evidence/i)

    expect(workspace.get('children')).toEqual(beforeChildren)
    expect(sceneTree.getElementById('active-props-valid-head')).toBe(head)
    expect(sceneTree.getElementById('active-props-stale-tail')).toBe(tail)
    expect(propsManager.save()).toEqual(beforeProps)
    expect(propsManager.changes).toEqual([])
    expect(sceneTree.changes).toEqual([])
  })

  it('rejects nested canonical removals before changing hierarchy or retained properties', () => {
    const containerType = 'active-removal-container'
    componentRegistry.register({
      type: containerType,
      idPrefix: containerType,
      namePrefix: 'Active Removal Container',
      constructor: createDynamicComponent(
        containerType,
        containerType,
        'Active Removal Container',
        [],
        {},
        true
      ),
      properties: [],
      defaults: {},
      isContainer: true
    })
    sceneTree.init()
    const workspace = sceneTree.currentWorkspace as Workspace
    sceneTree.addNewElement(
      { id: 'active-removal-group', type: containerType, x: 0, y: 0 },
      workspace as GroupInstanceTypes
    )
    const group = sceneTree.getElementById(
      'active-removal-group'
    ) as GroupInstanceTypes
    sceneTree.addNewElement(
      { id: 'active-removal-child', type: 'rect', x: 10, y: 20 },
      group
    )
    const child = sceneTree.getElementById('active-removal-child')
    if (!child) {
      throw new Error('Expected nested active-property removal fixture')
    }
    const beforeWorkspaceChildren = [...workspace.get('children')]
    const beforeGroupChildren = [...group.get('children')]
    const beforeProps = propsManager.save()
    sceneTree.cleanChanges()
    propsManager.cleanChanges()

    expect(() =>
      sceneTree.prepareCanonicalElementRemoval([
        {
          data: group.save(),
          parentId: workspace.get('id'),
          index: 0
        },
        {
          data: child.save(),
          parentId: group.get('id'),
          index: 0
        }
      ])
    ).toThrow(/subtree/i)

    expect(workspace.get('children')).toEqual(beforeWorkspaceChildren)
    expect(group.get('children')).toEqual(beforeGroupChildren)
    expect(sceneTree.getElementById(group.get('id'))).toBe(group)
    expect(sceneTree.getElementById(child.get('id'))).toBe(child)
    expect(propsManager.save()).toEqual(beforeProps)
    expect(sceneTree.changes).toEqual([])
    expect(propsManager.changes).toEqual([])
  })

  it('leaves canonical replay unapplied when its Scene batch handoff is rejected', () => {
    sceneTree.init()
    const workspace = sceneTree.currentWorkspace as Workspace
    sceneTree.addNewElement(
      { id: 'active-removal-preaccept', type: 'rect', x: 10, y: 20 },
      workspace as GroupInstanceTypes
    )
    const element = sceneTree.getElementById('active-removal-preaccept')
    if (!element) {
      throw new Error('Expected pre-accept removal fixture')
    }
    const removal = {
      data: element.save(),
      parentId: workspace.get('id'),
      index: 0
    }
    const beforeProps = propsManager.save()
    sceneTree.cleanChanges()
    propsManager.cleanChanges()
    const preacceptFailure = Object.assign(
      new Error('active removal rejected before acceptance'),
      { batchAccepted: false }
    )
    const transactionOwner = {
      startTransaction: vi.fn(),
      updateTransaction: vi.fn(),
      updateTransactionBatch: vi.fn(() => {
        throw preacceptFailure
      }),
      endTransaction: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn()
    }
    const preparedMutation = sceneTree.prepareCanonicalElementRemoval([removal])
    let capturedFailure: unknown

    try {
      runInTransactionReplayMode('undo', () =>
        runWithTransactionOwner(transactionOwner, () =>
          sceneTree.applyPreparedElementMutation(preparedMutation)
        )
      )
    } catch (error) {
      capturedFailure = error
    }

    expect(capturedFailure).toBe(preacceptFailure)
    expect(wasTransactionReplayApplied(capturedFailure)).toBe(false)
    expect(workspace.get('children')).toEqual([element.get('id')])
    expect(sceneTree.getElementById(element.get('id'))).toBe(element)
    expect(sceneTree._deletedMap.has(element.get('id'))).toBe(false)
    expect(propsManager.save()).toEqual(beforeProps)
    expect(sceneTree.changes).toEqual([])
    expect(propsManager.changes).toEqual([])
  })

  it('treats canonical Scene batch handoff as void', () => {
    sceneTree.init()
    const workspace = sceneTree.currentWorkspace as Workspace
    sceneTree.addNewElement(
      { id: 'active-removal-inactive-owner', type: 'rect', x: 10, y: 20 },
      workspace as GroupInstanceTypes
    )
    const element = sceneTree.getElementById('active-removal-inactive-owner')
    if (!element) {
      throw new Error('Expected inactive-owner removal fixture')
    }
    const beforeProps = propsManager.save()
    sceneTree.cleanChanges()
    propsManager.cleanChanges()
    const transactionOwner = {
      startTransaction: vi.fn(),
      updateTransaction: vi.fn(),
      updateTransactionBatch: vi.fn(() => null),
      endTransaction: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn()
    }

    const preparedMutation = sceneTree.prepareCanonicalElementRemoval([
      {
        data: element.save(),
        parentId: workspace.get('id'),
        index: 0
      }
    ])
    const result = runWithTransactionOwner(transactionOwner, () =>
      sceneTree.applyPreparedElementMutation(preparedMutation)
    )

    expect(result.orderedElementIds).toEqual([element.get('id')])

    expect(transactionOwner.updateTransactionBatch).toHaveBeenCalledOnce()
    expect(transactionOwner.updateTransactionBatch.mock.calls[0]).toHaveLength(
      1
    )
    expect(workspace.get('children')).toEqual([])
    expect(sceneTree.getElementById(element.get('id'))).toBeUndefined()
    expect(sceneTree._deletedMap.get(element.get('id'))).toBe(element)
    expect(propsManager.save()).toEqual(beforeProps)
    expect(sceneTree.changes).toEqual([])
    expect(propsManager.changes).toEqual([])
  })

  it('restores property relations before canonical projection resumes', () => {
    sceneTreeSingleton.init()
    const workspace = sceneTreeSingleton.currentWorkspace as Workspace
    sceneTreeSingleton.addNewElement(
      { id: 'retained-computed-restore', type: 'rect', x: 10, y: 20 },
      workspace as GroupInstanceTypes
    )
    const element = sceneTreeSingleton.getElementById(
      'retained-computed-restore'
    )
    if (!element) {
      throw new Error('Expected retained computed restore fixture')
    }
    const data = element.save()
    const positionId = element.props.getPropId(PropertyTypes.POSITION)
    if (!positionId) {
      throw new Error('Expected retained position property')
    }
    sceneTreeSingleton.cleanChanges()
    propsManager.cleanChanges()

    const preparedRemoval = sceneTreeSingleton.prepareCanonicalElementRemoval([
      {
        data,
        parentId: workspace.get('id'),
        index: 0
      }
    ])
    const removalOwner: TransactionOwner = {
      startTransaction: vi.fn(),
      updateTransactionBatch: vi.fn(),
      endTransaction: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn()
    }
    expect(
      runWithTransactionOwner(removalOwner, () =>
        sceneTreeSingleton.applyPreparedElementMutation(preparedRemoval)
      ).orderedElementIds
    ).toEqual([data.id])
    const transactionOwner: TransactionOwner = {
      startTransaction: vi.fn(),
      updateTransactionBatch: vi.fn(),
      endTransaction: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn()
    }
    runInTransactionReplayMode('undo', () =>
      runWithTransactionOwner(transactionOwner, () =>
        publishEvent({
          type: EventTypes.ADD_ELEMENT,
          payload: {
            data,
            parentId: workspace.get('id'),
            index: 0
          }
        } as AddElementEvent)
      )
    )

    expect(
      sceneTreeSingleton.getElementPropertyRelations(positionId)
    ).toContainEqual(
      expect.objectContaining({
        ownerElementId: element.get('id'),
        ownerPropertyName: PropertyTypes.POSITION,
        componentId: positionId
      })
    )
    propsManager.updatePropertyById(positionId, 'x', 88)
    propsManager.commitChanges()

    expect(
      sceneTreeSingleton.getElementById(element.get('id'))?.computed.get('x')
    ).toBe(88)
  })

  it('restores a complete retained subtree when its Scene batch handoff is rejected', () => {
    const containerType = 'active-subtree-container'
    componentRegistry.register({
      type: containerType,
      idPrefix: containerType,
      namePrefix: 'Active Subtree Container',
      constructor: createDynamicComponent(
        containerType,
        containerType,
        'Active Subtree Container',
        [],
        {},
        true
      ),
      properties: [],
      defaults: {},
      isContainer: true
    })
    sceneTree.init()
    const workspace = sceneTree.currentWorkspace as Workspace
    sceneTree.addNewElement(
      { id: 'active-subtree-root', type: containerType, x: 0, y: 0 },
      workspace as GroupInstanceTypes
    )
    const group = sceneTree.getElementById(
      'active-subtree-root'
    ) as GroupInstanceTypes
    sceneTree.addNewElement(
      { id: 'active-subtree-child', type: 'rect', x: 10, y: 20 },
      group
    )
    const child = sceneTree.getElementById('active-subtree-child')
    if (!child) {
      throw new Error('Expected retained subtree child fixture')
    }
    const beforeWorkspaceChildren = [...workspace.get('children')]
    const beforeGroupChildren = [...group.get('children')]
    const beforeProps = propsManager.save()
    sceneTree.cleanChanges()
    propsManager.cleanChanges()
    const handoffFailure = Object.assign(
      new Error('retained subtree handoff rejected'),
      { batchAccepted: false }
    )
    const transactionOwner = {
      startTransaction: vi.fn(),
      updateTransaction: vi.fn(() => {
        throw new Error('retained subtree used the single-event handoff')
      }),
      updateTransactionBatch: vi.fn(() => {
        throw handoffFailure
      }),
      endTransaction: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn()
    }

    expect(() =>
      runWithTransactionOwner(transactionOwner, () =>
        sceneTree.removeSubtree(group.get('id'))
      )
    ).toThrow(handoffFailure)

    expect(transactionOwner.updateTransaction).not.toHaveBeenCalled()
    expect(transactionOwner.updateTransactionBatch).toHaveBeenCalledOnce()
    expect(workspace.get('children')).toEqual(beforeWorkspaceChildren)
    expect(group.get('children')).toEqual(beforeGroupChildren)
    expect(sceneTree.getElementById(group.get('id'))).toBe(group)
    expect(sceneTree.getElementById(child.get('id'))).toBe(child)
    expect(sceneTree._deletedMap.has(group.get('id'))).toBe(false)
    expect(sceneTree._deletedMap.has(child.get('id'))).toBe(false)
    expect(propsManager.save()).toEqual(beforeProps)
    expect(sceneTree.changes).toEqual([])
    expect(propsManager.changes).toEqual([])
  })

  it('Step 4 canonical owner: leaves an accepted retained subtree compatible with exact restore preflight', () => {
    const containerType = 'accepted-active-subtree-container'
    componentRegistry.register({
      type: containerType,
      idPrefix: containerType,
      namePrefix: 'Accepted Active Subtree Container',
      constructor: createDynamicComponent(
        containerType,
        containerType,
        'Accepted Active Subtree Container',
        [],
        {},
        true
      ),
      properties: [],
      defaults: {},
      isContainer: true
    })
    sceneTree.init()
    const workspace = sceneTree.currentWorkspace as Workspace
    sceneTree.addNewElement(
      { id: 'accepted-active-subtree', type: containerType, x: 0, y: 0 },
      workspace as GroupInstanceTypes
    )
    const group = sceneTree.getElementById(
      'accepted-active-subtree'
    ) as GroupInstanceTypes
    sceneTree.addNewElement(
      { id: 'accepted-active-subtree-child', type: 'rect', x: 10, y: 20 },
      group
    )
    sceneTree.cleanChanges()
    propsManager.cleanChanges()

    const transactionOwner = {
      startTransaction: vi.fn(),
      updateTransactionBatch: vi.fn(),
      endTransaction: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn()
    } as TransactionOwner
    const snapshot = runWithTransactionOwner(transactionOwner, () =>
      sceneTree.removeSubtree(group.get('id'))
    )
    const preparedMutation = sceneTree.preflightRestoreSubtree(snapshot)

    expect(preparedMutation.entries).toEqual([
      {
        elementId: 'accepted-active-subtree-child',
        strategy: 'reuse'
      },
      {
        elementId: 'accepted-active-subtree',
        strategy: 'reuse'
      }
    ])

    const hierarchyFailure = new Error('retained hierarchy restore failed')
    const replaceBatchParentChildren =
      workspace.replaceBatchParentChildren.bind(workspace)
    vi.spyOn(workspace, 'replaceBatchParentChildren').mockImplementation(
      (parent, children) => {
        if (parent.get('id') === group.get('id') && children.length > 0) {
          throw hierarchyFailure
        }
        replaceBatchParentChildren(parent, children)
      }
    )

    expect(() => sceneTree.applyRestoreSubtree(preparedMutation)).toThrow(
      hierarchyFailure
    )
    expect(workspace.get('children')).toEqual([])
    expect(sceneTree.getElementById('accepted-active-subtree')).toBeUndefined()
    expect(
      sceneTree.getElementById('accepted-active-subtree-child')
    ).toBeUndefined()
    expect(
      sceneTree._deletedMap.get('accepted-active-subtree')?.get('parentId')
    ).toBe('')
    expect(
      sceneTree._deletedMap
        .get('accepted-active-subtree-child')
        ?.get('parentId')
    ).toBe('')
  })
})
