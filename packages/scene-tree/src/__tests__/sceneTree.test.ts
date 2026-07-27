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
  SharedDataChannelNames,
  Unit,
  resetIdCounter,
  type AddRemoveElementChange,
  type AddRemovePropertyChange,
  type ComputedAttrs,
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
  subscribeToEvents,
  wasTransactionReplayApplied,
  type AddElementEvent,
  type UpdateComputedDataBatchEvent,
  type UpdateComputedDataEvent,
  type UpdateComputedDataPatchEvent,
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
        { name: PropertyTypes.POSITION, type: PropertyTypes.POSITION },
        { name: PropertyTypes.DIMENSION, type: PropertyTypes.DIMENSION }
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
    const element = {
      get: vi.fn(() => 'el-add')
    } as unknown as ElementInstanceTypes

    sceneTree.addToMap(element)

    expect(sceneTree.getAllElements().has('el-add')).toBe(true)
  })

  it('should remove an element from the map', () => {
    const element = {
      get: vi.fn(() => 'el-remove')
    } as unknown as ElementInstanceTypes

    sceneTree.addToMap(element)
    expect(sceneTree.getAllElements().has('el-remove')).toBe(true)

    sceneTree.removeFromMap(element)
    expect(sceneTree.getAllElements().has('el-remove')).toBe(false)
  })

  it('should get an element by ID', () => {
    const element = {
      get: vi.fn(() => 'el-get')
    } as unknown as ElementInstanceTypes

    sceneTree.addToMap(element)

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

  it('should add a change for removing an element', () => {
    const elementData = { id: 'el-change-remove', type: 'rect' }
    const element = {
      save: vi.fn(() => elementData),
      get: vi.fn(() => 'el-change-remove')
    } as unknown as ElementInstanceTypes

    sceneTree.addChangeForRemoveElement(element)

    expect(sceneTree.changes.length).toBe(1)
    expect(sceneTree.changes[0].action).toBe(SCENE_TREE_ACTIONS.REMOVE_ELEMENT)
  })

  it('records the original parent and child index before removing an element', () => {
    const observed: SceneTreeChange[] = []
    const subscription = subscribeToEvents((event) => {
      if (
        event.type === EventTypes.UPDATE_TRANSACTION &&
        'payload' in event &&
        (event.payload as SceneTreeChange).action ===
          SCENE_TREE_ACTIONS.REMOVE_ELEMENT
      ) {
        observed.push(event.payload as SceneTreeChange)
      }
    })
    sceneTree.init()
    const workspaceId = sceneTree.workspace
    sceneTree.addNewElement({ id: 'first', type: 'rect', x: 0, y: 0 })
    sceneTree.addNewElement({ id: 'middle', type: 'rect', x: 0, y: 0 })
    sceneTree.addNewElement({ id: 'last', type: 'rect', x: 0, y: 0 })
    sceneTree.cleanChanges()

    expect(sceneTree.removeElement({ id: 'middle' })).toBe(true)

    expect(observed).toEqual([
      expect.objectContaining({
        action: SCENE_TREE_ACTIONS.REMOVE_ELEMENT,
        parentId: workspaceId,
        index: 1
      })
    ])

    subscription.unsubscribe()
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

    expect(sceneTreeSingleton.removeElement({ id: 'middle' }, containerB)).toBe(
      true
    )
    expect(containerB.get('children')).toEqual(['first', 'last'])

    const replayAddChanges: SceneTreeChange[] = []
    const subscription = subscribeToEvents((event) => {
      if (
        event.type !== EventTypes.UPDATE_TRANSACTION ||
        !('payload' in event)
      ) {
        return
      }
      const change = event.payload as SceneTreeChange
      if (
        change.action === SCENE_TREE_ACTIONS.ADD_ELEMENT &&
        'data' in change &&
        change.data.id === 'middle'
      ) {
        replayAddChanges.push(change)
      }
    })

    runInTransactionReplayMode('rollback', () =>
      publishEvent({
        type: EventTypes.ADD_ELEMENT,
        payload: {
          data: { ...removedData, x: 0, y: 0 },
          parentId: 'container-b',
          index: 1
        }
      } as unknown as AddElementEvent)
    )

    expect(containerA.get('children')).toEqual(['container-b'])
    expect(containerB.get('children')).toEqual(['first', 'middle', 'last'])
    expect(sceneTreeSingleton.getElementById('middle')?.get('parentId')).toBe(
      'container-b'
    )
    expect(replayAddChanges).toEqual([
      expect.objectContaining({
        parentId: 'container-b',
        index: 1,
        data: expect.objectContaining({ parentId: 'container-b' })
      })
    ])

    subscription.unsubscribe()
  })

  it('records one structural scene-tree event for each add and remove', () => {
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
    expect(
      sceneTreeSingleton.removeElement({ id: 'single-structural-owner' })
    ).toBe(true)
    expect(getSceneActions()).toEqual([SCENE_TREE_ACTIONS.REMOVE_ELEMENT])

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

    sceneTree.addNewElement(elementData, undefined, -1, false)

    expect(addNewElements).toHaveBeenCalledOnce()
    expect(addNewElements).toHaveBeenCalledWith(
      [expect.any(Object)],
      workspace,
      0
    )
  })

  it('acknowledges replayed add after scene mutation but before commit failure', () => {
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
    sceneTreeSingleton.removeElement({ id: 'replay-add-failure' })

    const replayFailure = new Error('props commit failed after scene add')
    const originalCommitChanges = propsManager.commitChanges
    propsManager.commitChanges = vi.fn(() => {
      throw replayFailure
    })

    let capturedFailure: unknown
    try {
      runInTransactionReplayMode('undo', () =>
        publishEvent({
          type: EventTypes.ADD_ELEMENT,
          payload: {
            data: removedData,
            parentId: sceneTreeSingleton.workspace,
            index: 0
          }
        } as AddElementEvent)
      )
    } catch (failure) {
      capturedFailure = failure
    } finally {
      propsManager.commitChanges = originalCommitChanges
    }

    expect(capturedFailure).toBe(replayFailure)
    expect(wasTransactionReplayApplied(capturedFailure)).toBe(true)
    expect(
      sceneTreeSingleton.getElementById('replay-add-failure')
    ).toBeDefined()
  })

  it('acknowledges replayed remove after scene mutation but before commit failure', () => {
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
    removableElement.cleanup = vi.fn()

    const replayFailure = new Error('props commit failed after scene remove')
    const originalCommitChanges = propsManager.commitChanges
    propsManager.commitChanges = vi.fn(() => {
      throw replayFailure
    })

    let capturedFailure: unknown
    try {
      runInTransactionReplayMode('undo', () =>
        publishEvent({
          type: EventTypes.REMOVE_ELEMENT,
          payload: { data: { id: 'replay-remove-failure' } }
        } as unknown as AddElementEvent)
      )
    } catch (failure) {
      capturedFailure = failure
    } finally {
      propsManager.commitChanges = originalCommitChanges
    }

    expect(capturedFailure).toBe(replayFailure)
    expect(wasTransactionReplayApplied(capturedFailure)).toBe(true)
    expect(
      sceneTreeSingleton.getElementById('replay-remove-failure')
    ).toBeUndefined()
  })

  it('acknowledges replayed computed data after the write but before a listener failure', () => {
    sceneTreeSingleton.init()
    sceneTreeSingleton.addNewElement({
      id: 'computed-post-write-failure',
      type: 'rect',
      x: 0,
      y: 0
    })
    const element = sceneTreeSingleton.getElementById(
      'computed-post-write-failure'
    )
    expect(element).toBeDefined()
    if (!element) {
      throw new Error('Expected computed-post-write-failure element')
    }
    ;(element.computed as unknown as { data: Partial<ComputedAttrs> }).data.x =
      0
    const replayFailure = new Error('computed listener failed after write')
    const unsubscribe = element.computed.on(() => {
      throw replayFailure
    })

    let capturedFailure: unknown
    try {
      runInTransactionReplayMode('undo', () =>
        publishEvent({
          type: EventTypes.UPDATE_COMPUTED_DATA,
          payload: {
            id: 'computed-post-write-failure',
            key: 'x',
            before: 0,
            after: 10,
            owner: 'computed'
          }
        } as UpdateComputedDataEvent)
      )
    } catch (failure) {
      capturedFailure = failure
    } finally {
      unsubscribe()
    }

    expect(capturedFailure).toBe(replayFailure)
    expect(element.computed.get('x')).toBe(10)
    expect(wasTransactionReplayApplied(capturedFailure)).toBe(true)
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

      runInTransactionReplayMode('undo', () =>
        publishEvent({
          type: EventTypes.UPDATE_COMPUTED_DATA,
          payload: {
            id: `element-owner-${key}`,
            key,
            before,
            after,
            owner: 'raw'
          }
        } as UpdateComputedDataEvent)
      )

      expect(element.get(key)).toBe(after)
    }
  )

  it('routes a same-name computed replay through Computed without mutating raw data', () => {
    sceneTreeSingleton.init()
    sceneTreeSingleton.addNewElement({
      id: 'same-name-computed-owner',
      type: 'rect',
      visible: true,
      x: 0,
      y: 0
    })
    const element = sceneTreeSingleton.getElementById(
      'same-name-computed-owner'
    )
    expect(element).toBeDefined()
    if (!element) {
      throw new Error('Expected same-name-computed-owner element')
    }
    const computedData = (
      element.computed as unknown as { data: Record<string, DataTypes> }
    ).data
    computedData.visible = true

    runInTransactionReplayMode('undo', () =>
      publishEvent({
        type: EventTypes.UPDATE_COMPUTED_DATA,
        payload: {
          id: 'same-name-computed-owner',
          key: 'visible',
          before: true,
          after: false,
          owner: 'computed'
        }
      } as UpdateComputedDataEvent)
    )

    expect(element.get('visible')).toBe(true)
    expect(computedData.visible).toBe(false)
  })

  it('applies an ordered computed-data batch as one state-owner event', () => {
    sceneTreeSingleton.init()
    sceneTreeSingleton.addNewElement({
      id: 'computed-batch-owner',
      type: 'rect',
      x: 0,
      y: 0
    })
    const element = sceneTreeSingleton.getElementById('computed-batch-owner')
    expect(element).toBeDefined()
    if (!element) {
      throw new Error('Expected computed-batch-owner element')
    }

    const applied = runInTransactionReplayMode('redo', () =>
      publishEvent({
        type: EventTypes.UPDATE_COMPUTED_DATA,
        payload: {
          action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_BATCH,
          eventName: EventTypes.UPDATE_COMPUTED_DATA,
          id: 'computed-batch-owner',
          changes: [
            { owner: 'computed', key: 'x', before: 0, after: 10 },
            { owner: 'computed', key: 'y', before: 0, after: 20 },
            { owner: 'computed', key: 'x', before: 10, after: 5 }
          ]
        }
      } as UpdateComputedDataBatchEvent)
    )

    expect(applied).toBe(true)
    expect(element.computed.get('x')).toBe(5)
    expect(element.computed.get('y')).toBe(20)
  })

  it('preserves a special own record id during computed patch replay', () => {
    sceneTreeSingleton.init()
    sceneTreeSingleton.addNewElement({
      id: 'special-record-replay',
      type: 'rect',
      x: 0,
      y: 0
    })
    const element = sceneTreeSingleton.getElementById('special-record-replay')
    expect(element).toBeDefined()
    if (!element) {
      throw new Error('Expected special-record-replay element')
    }
    const computedData = (
      element.computed as unknown as { data: Record<string, DataTypes> }
    ).data
    computedData.points = {}
    const set: Record<string, unknown> = {}
    Object.defineProperty(set, '__proto__', {
      value: {
        after: { id: '__proto__', x: 10, y: 20 }
      },
      enumerable: true,
      configurable: true,
      writable: true
    })

    runInTransactionReplayMode('undo', () =>
      publishEvent({
        type: EventTypes.UPDATE_COMPUTED_DATA_PATCH,
        payload: {
          id: 'special-record-replay',
          patch: {
            records: {
              points: { set }
            }
          }
        }
      } as UpdateComputedDataPatchEvent)
    )

    const points = computedData.points as Record<string, unknown>
    expect(Object.prototype.hasOwnProperty.call(points, '__proto__')).toBe(true)
    expect(points['__proto__']).toEqual({
      id: '__proto__',
      x: 10,
      y: 20
    })
  })

  it.each([undefined, 'invalid'] as const)(
    'rejects replay owner %s before canonical mutation',
    (owner) => {
      sceneTreeSingleton.init()
      const id = `invalid-replay-owner-${String(owner)}`
      sceneTreeSingleton.addNewElement({
        id,
        type: 'rect',
        visible: true,
        x: 0,
        y: 0
      })
      const element = sceneTreeSingleton.getElementById(id)
      expect(element).toBeDefined()
      if (!element) {
        throw new Error(`Expected ${id} element`)
      }

      runInTransactionReplayMode('undo', () =>
        publishEvent({
          type: EventTypes.UPDATE_COMPUTED_DATA,
          payload: {
            id,
            key: 'visible',
            before: true,
            after: false,
            owner
          }
        } as unknown as UpdateComputedDataEvent)
      )

      expect(element.get('visible')).toBe(true)
    }
  )

  it('does not acknowledge a replayed computed data failure before the write', () => {
    sceneTreeSingleton.init()
    sceneTreeSingleton.addNewElement({
      id: 'computed-pre-write-failure',
      type: 'rect',
      x: 0,
      y: 0
    })
    const element = sceneTreeSingleton.getElementById(
      'computed-pre-write-failure'
    )
    expect(element).toBeDefined()
    if (!element) {
      throw new Error('Expected computed-pre-write-failure element')
    }
    ;(element.computed as unknown as { data: Partial<ComputedAttrs> }).data.x =
      0
    const replayFailure = new Error('computed failed before write')
    const originalUpdateComputedData = element.updateComputedData
    element.updateComputedData = vi.fn(() => {
      throw replayFailure
    })

    let capturedFailure: unknown
    try {
      runInTransactionReplayMode('undo', () =>
        publishEvent({
          type: EventTypes.UPDATE_COMPUTED_DATA,
          payload: {
            id: 'computed-pre-write-failure',
            key: 'x',
            before: 0,
            after: 10,
            owner: 'computed'
          }
        } as UpdateComputedDataEvent)
      )
    } catch (failure) {
      capturedFailure = failure
    } finally {
      element.updateComputedData = originalUpdateComputedData
    }

    expect(capturedFailure).toBe(replayFailure)
    expect(element.computed.get('x')).toBe(0)
    expect(wasTransactionReplayApplied(capturedFailure)).toBe(false)
  })

  it('does not acknowledge a no-op computed replay before a cleanup failure', () => {
    sceneTreeSingleton.init()
    sceneTreeSingleton.addNewElement({
      id: 'computed-no-op-failure',
      type: 'rect',
      x: 10,
      y: 0
    })
    const element = sceneTreeSingleton.getElementById('computed-no-op-failure')
    expect(element).toBeDefined()
    if (!element) {
      throw new Error('Expected computed-no-op-failure element')
    }
    ;(element.computed as unknown as { data: Partial<ComputedAttrs> }).data.x =
      10
    const replayFailure = new Error('cleanup failed after computed no-op')
    const originalCommitChanges = propsManager.commitChanges
    propsManager.commitChanges = vi.fn(() => {
      throw replayFailure
    })

    let capturedFailure: unknown
    try {
      runInTransactionReplayMode('undo', () =>
        publishEvent({
          type: EventTypes.UPDATE_COMPUTED_DATA,
          payload: {
            id: 'computed-no-op-failure',
            key: 'x',
            before: 0,
            after: 10,
            owner: 'computed'
          }
        } as UpdateComputedDataEvent)
      )
    } catch (failure) {
      capturedFailure = failure
    } finally {
      propsManager.commitChanges = originalCommitChanges
    }

    expect(capturedFailure).toBe(replayFailure)
    expect(element.computed.get('x')).toBe(10)
    expect(wasTransactionReplayApplied(capturedFailure)).toBe(false)
  })

  // Test updateComputedData
  it('should call updateComputedData on the element', () => {
    const element = {
      get: vi.fn(() => 'el-computed'),
      updateComputedData: vi.fn()
    } as unknown as ElementInstanceTypes
    sceneTree.addToMap(element)
    sceneTree.updateComputedData('el-computed', 'x', 100)
    expect(element.updateComputedData).toHaveBeenCalledWith('x', 100)
  })

  it.each([
    ['computed-only', 'pointCoordinateSpace', 'workspace'],
    ['raw same-name', 'visible', false]
  ] as const)(
    'rejects a missing %s top-level value patch before real Element mutation',
    (_case, key, after) => {
      const element = new MockRectangle({
        id: `missing-value-base-${key}`,
        type: 'rect',
        visible: true
      })
      sceneTree.addToMap(element)
      const beforeSnapshot = element.getAllComputedData()

      expect(() =>
        sceneTree.patchComputedData(element.get('id'), {
          values: { [key]: after }
        })
      ).toThrow(`Computed data patch value base "${key}" must already exist`)

      expect(element.getAllComputedData()).toEqual(beforeSnapshot)
      expect(sceneTree.changes).toEqual([])
    }
  )

  it('updates computed data when a property component changes', () => {
    const element = new MockRectangle()
    sceneTree.addToMap(element)

    const positionId = element.props.getPropId(PropertyTypes.POSITION)
    if (!positionId) {
      throw new Error('Position property component was not created.')
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    propsManager.updatePropsData(positionId, 'x' as any, 120)
    expect(element.computed.get('x')).toBe(120)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    propsManager.updatePropsData(positionId, 'xUnit' as any, Unit.PERCENT)
    expect(element.computed.get('x')).toBe(120)
  })

  it('refreshes owner computed data from a nested stroke property snapshot', () => {
    const initialFill: TestPaint = {
      kind: 'solid',
      color: '#cccccc',
      opacity: 1
    }
    const nextFill: TestPaint = {
      kind: 'solid',
      color: '#d90909',
      opacity: 0.5
    }

    const stroke = propsManager.createProperty({
      id: 'stroke-1',
      type: TEST_STROKE_PROPERTY_TYPE,
      fill: initialFill,
      width: 10
    }) as TestStrokeComponent
    propsManager.addToMap(stroke)
    const strokes = propsManager.createProperty({
      id: 'strokes-1',
      type: TEST_STROKES_PROPERTY_TYPE,
      strokes: ['stroke-1']
    })
    propsManager.addToMap(strokes)

    const element = sceneTreeSingleton.createElement({
      id: 'vector-1',
      type: TEST_VECTOR_TYPE,
      props: {
        strokes: 'strokes-1'
      } as unknown as ElementRawData['props']
    }) as ElementInstanceTypes
    sceneTreeSingleton.addToMap(element)
    sceneTreeSingleton.cleanChanges()

    stroke.data.fill = nextFill
    sceneTreeSingleton.refreshComputedDataFromProperty('vector-1', 'strokes', {
      undoable: false
    })

    expect(element.computed.get('strokes')).toEqual({
      'stroke-1': {
        id: 'stroke-1',
        fill: nextFill,
        width: 10
      }
    })
    expect(sceneTreeSingleton.changes).toContainEqual(
      expect.objectContaining({
        action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA,
        id: 'vector-1',
        key: 'strokes',
        after: {
          'stroke-1': {
            id: 'stroke-1',
            fill: nextFill,
            width: 10
          }
        }
      })
    )
  })

  it('publishes owner computed data when a nested stroke property transaction commits', () => {
    const events: UpdateTransactionEvent[] = []
    const subscription = subscribeToEvents((event) => {
      if (event.type === EventTypes.UPDATE_TRANSACTION) {
        events.push(event as UpdateTransactionEvent)
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
      type: TEST_STROKES_PROPERTY_TYPE,
      strokes: ['stroke-1']
    })
    propsManager.addToMap(strokes)

    const element = sceneTreeSingleton.createElement({
      id: 'vector-1',
      type: TEST_VECTOR_TYPE,
      props: {
        strokes: 'strokes-1'
      } as unknown as ElementRawData['props']
    }) as ElementInstanceTypes
    sceneTreeSingleton.addToMap(element)
    sceneTreeSingleton.cleanChanges()

    propsManager.updatePropertyById(
      'stroke-1',
      'fill',
      nextFill,
      {
        ownerElementId: 'vector-1',
        ownerPropertyName: 'strokes'
      },
      { undoable: false }
    )
    expect((stroke as TestStrokeComponent).get('fill')).toEqual(nextFill)
    propsManager.commitChanges({ undoable: false })

    expect(element.computed.get('strokes')).toEqual({
      'stroke-1': {
        id: 'stroke-1',
        fill: nextFill,
        width: 10
      }
    })
    expect(events).toContainEqual(
      expect.objectContaining({
        type: EventTypes.UPDATE_TRANSACTION,
        eventName: EventTypes.UPDATE_COMPUTED_DATA,
        options: expect.objectContaining({
          shared: SharedDataChannelNames.SCENE_TREE
        }),
        payload: expect.objectContaining({
          id: 'vector-1'
        })
      })
    )

    subscription.unsubscribe()
  })

  it('batches transient vector computed-data key deltas in order', () => {
    const events: UpdateTransactionEvent[] = []
    const subscription = subscribeToEvents((event) => {
      if (event.type === EventTypes.UPDATE_TRANSACTION) {
        events.push(event as UpdateTransactionEvent)
      }
    })
    events.length = 0

    sceneTree.addChange({
      action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA,
      eventName: EventTypes.UPDATE_COMPUTED_DATA,
      id: 'vector-1',
      owner: 'computed',
      key: 'points',
      before: {},
      after: { p1: { x: 0, y: 0 } },
      options: { undoable: false }
    } as SceneTreeChange)
    sceneTree.addChange({
      action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA,
      eventName: EventTypes.UPDATE_COMPUTED_DATA,
      id: 'vector-1',
      owner: 'computed',
      key: 'segments',
      before: {},
      after: { s1: { startId: 'p1', endId: 'p2' } },
      options: { undoable: false }
    } as SceneTreeChange)
    sceneTree.addChange({
      action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA,
      eventName: EventTypes.UPDATE_COMPUTED_DATA,
      id: 'vector-1',
      owner: 'computed',
      key: 'networks',
      before: {},
      after: { n1: { pointIds: ['p1', 'p2'], segmentIds: ['s1'] } },
      options: { undoable: false }
    } as SceneTreeChange)

    sceneTree.commitSceneTreeTransaction()

    expect(events).toEqual([
      expect.objectContaining({
        type: EventTypes.UPDATE_TRANSACTION,
        eventName: EventTypes.UPDATE_COMPUTED_DATA,
        payload: {
          action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_BATCH,
          eventName: EventTypes.UPDATE_COMPUTED_DATA,
          id: 'vector-1',
          changes: [
            {
              owner: 'computed',
              key: 'points',
              before: {},
              after: { p1: { x: 0, y: 0 } }
            },
            {
              owner: 'computed',
              key: 'segments',
              before: {},
              after: { s1: { startId: 'p1', endId: 'p2' } }
            },
            {
              owner: 'computed',
              key: 'networks',
              before: {},
              after: { n1: { pointIds: ['p1', 'p2'], segmentIds: ['s1'] } }
            }
          ]
        },
        options: {
          undoable: false,
          shared: SharedDataChannelNames.SCENE_TREE
        }
      })
    ])
    subscription.unsubscribe()
  })

  // Test load and save
  it('should load data correctly', () => {
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
          lock: false
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
          lock: false
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

  it('adds one ordered element batch without cloning the growing parent child list', () => {
    sceneTree.init()
    const workspace = sceneTree.currentWorkspace as Workspace
    const set = vi.spyOn(workspace, 'set')
    const replaceChildren = vi.spyOn(
      workspace,
      'replaceChildrenFromCanonicalBatch'
    )
    const createPropertyBatch = vi.spyOn(
      propsManager,
      'runInPropertyCreationBatch'
    )
    const commit = vi.spyOn(sceneTree, 'commitSceneTreeTransaction')
    const sceneChanges: SceneTreeChange[] = []
    const propsChanges: PropsChange[] = []
    const transactionEvents: UpdateTransactionEvent[] = []
    const subscription = subscribeToEvents((event) => {
      if (event.type === EventTypes.UPDATE_TRANSACTION && 'payload' in event) {
        transactionEvents.push(event as UpdateTransactionEvent)
        if (
          Object.values(SCENE_TREE_ACTIONS).includes(
            (event.payload as SceneTreeChange).action
          )
        ) {
          sceneChanges.push(event.payload as SceneTreeChange)
        }
        if (
          Object.values(PROPS_ACTIONS).includes(
            (event.payload as PropsChange).action
          )
        ) {
          propsChanges.push(event.payload as PropsChange)
        }
      }
    })
    const batchOwner = sceneTree as SceneTree & {
      addNewElements(
        data: readonly {
          id: string
          type: string
          x: number
          y: number
        }[],
        parent?: GroupInstanceTypes,
        index?: number,
        options?: { undoable?: boolean }
      ): readonly string[]
    }

    expect(
      batchOwner.addNewElements(
        [
          { id: 'batch-1', type: 'rect', x: 0, y: 0 },
          { id: 'batch-2', type: 'rect', x: 10, y: 10 },
          { id: 'batch-3', type: 'rect', x: 20, y: 20 }
        ],
        workspace as GroupInstanceTypes,
        undefined,
        { undoable: true }
      )
    ).toEqual(['batch-1', 'batch-2', 'batch-3'])
    expect(workspace.get('children')).toEqual(['batch-1', 'batch-2', 'batch-3'])
    expect(set.mock.calls.filter(([key]) => key === 'children')).toHaveLength(0)
    expect(replaceChildren).toHaveBeenCalledOnce()
    expect(createPropertyBatch).toHaveBeenCalledOnce()
    expect(
      sceneChanges
        .filter(
          (change) =>
            change.action === SCENE_TREE_ACTIONS.ADD_ELEMENT &&
            'data' in change &&
            change.data.id.startsWith('batch-')
        )
        .map((change) => ('data' in change ? change.data.id : null))
    ).toEqual(['batch-1', 'batch-2', 'batch-3'])
    expect(
      sceneChanges.filter(
        (change) =>
          change.action === SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA &&
          'owner' in change &&
          change.owner === 'raw' &&
          change.key === 'children'
      )
    ).toEqual([])
    const propertyBatch = propsChanges.filter(
      (change) => change.action === PROPS_ACTIONS.ADD_PROPERTY
    )
    expect(propertyBatch).toHaveLength(1)
    const propertyData = (propertyBatch[0] as AddRemovePropertyChange).data
    expect(propertyData).toHaveLength(6)
    const propertyIds = new Set(propertyData.map(({ id }) => id))
    const expectedPropertyIds: string[] = []
    ;['batch-1', 'batch-2', 'batch-3'].forEach((elementId, index) => {
      const props = sceneTree.getElementById(elementId)?.save().props
      expectedPropertyIds.push(
        props?.position as string,
        props?.dimension as string
      )
      expect(propertyIds.has(props?.position as string)).toBe(true)
      expect(propertyIds.has(props?.dimension as string)).toBe(true)
      const position = propsManager.getPropertyById(
        props?.position as string
      ) as TestPositionComponent | undefined
      expect(position?.get('x')).toBe(index * 10)
      expect(position?.get('y')).toBe(index * 10)
    })
    expect(propertyData.map(({ id }) => id)).toEqual(expectedPropertyIds)
    expect(propertyData).toEqual(
      expectedPropertyIds.map((propertyId) =>
        propsManager.getPropertyById(propertyId)?.save()
      )
    )
    const orderedBatchEvents = transactionEvents.filter(({ payload }) => {
      const change = payload as PropsChange | SceneTreeChange
      if (change.action === PROPS_ACTIONS.ADD_PROPERTY) {
        return true
      }
      return (
        change.action === SCENE_TREE_ACTIONS.ADD_ELEMENT &&
        'data' in change &&
        change.data.id.startsWith('batch-')
      )
    })
    expect(
      orderedBatchEvents.map(({ payload }) => {
        const change = payload as PropsChange | SceneTreeChange
        return change.action === PROPS_ACTIONS.ADD_PROPERTY
          ? 'props:add'
          : `scene:add:${(change as AddRemoveElementChange).data.id}`
      })
    ).toEqual([
      'props:add',
      'scene:add:batch-1',
      'scene:add:batch-2',
      'scene:add:batch-3'
    ])
    expect(orderedBatchEvents.map(({ options }) => options)).toEqual([
      { undoable: true, shared: SharedDataChannelNames.PROPS },
      { undoable: true, shared: SharedDataChannelNames.SCENE_TREE },
      { undoable: true, shared: SharedDataChannelNames.SCENE_TREE },
      { undoable: true, shared: SharedDataChannelNames.SCENE_TREE }
    ])
    orderedBatchEvents.slice(1).forEach(({ payload }, index) => {
      const change = payload as AddRemoveElementChange
      const elementId = `batch-${index + 1}`
      expect(change.data).toEqual(sceneTree.getElementById(elementId)?.save())
      expect(change.parentId).toBe(workspace.get('id'))
      expect(change.index).toBe(index)
    })
    const detachedPropertyEvidence = structuredClone(propertyData)
    const firstPosition = propsManager.getPropertyById(
      expectedPropertyIds[0]
    ) as TestPositionComponent
    firstPosition.set('x', 999)
    expect(propertyData).toEqual(detachedPropertyEvidence)
    expect(commit).toHaveBeenCalledOnce()
    expect(commit.mock.calls[0]?.[0]).toEqual({ undoable: true })
    expect(
      commit.mock.calls[0]?.[1]?.elements.map((element) => element.get('id'))
    ).toEqual(['batch-1', 'batch-2', 'batch-3'])
    expect(commit.mock.calls[0]?.[1]?.propsEvents).toHaveLength(1)
    subscription.unsubscribe()
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

  it('creates exact canonical properties and elements as one ordered owner batch', () => {
    sceneTree.init()
    const workspace = sceneTree.currentWorkspace as Workspace
    const properties = [
      new TestPositionComponent({
        id: 'canonical-position-1',
        x: 12,
        y: 24
      }).save(),
      new TestDimensionComponent({
        id: 'canonical-dimension-1',
        width: 80,
        height: 40
      }).save(),
      new TestPositionComponent({
        id: 'canonical-position-2',
        x: 36,
        y: 48
      }).save(),
      new TestDimensionComponent({
        id: 'canonical-dimension-2',
        width: 120,
        height: 60
      }).save()
    ]
    const elements = [
      {
        id: 'canonical-element-1',
        type: 'rect',
        name: 'Canonical Rectangle 1',
        parentId: workspace.get('id'),
        visible: true,
        lock: false,
        props: {
          position: 'canonical-position-1',
          dimension: 'canonical-dimension-1'
        }
      },
      {
        id: 'canonical-element-2',
        type: 'rect',
        name: 'Canonical Rectangle 2',
        parentId: workspace.get('id'),
        visible: true,
        lock: false,
        props: {
          position: 'canonical-position-2',
          dimension: 'canonical-dimension-2'
        }
      }
    ] satisfies readonly ElementRawData[]
    const orderedChanges: (PropsChange | AddRemoveElementChange)[] = []
    const { subscription } = (() => {
      const subscription = subscribeToEvents((event) => {
        if (
          event.type !== EventTypes.UPDATE_TRANSACTION ||
          !('payload' in event)
        ) {
          return
        }
        const change = event.payload as SceneTreeChange | PropsChange
        if (
          change.action === SCENE_TREE_ACTIONS.ADD_ELEMENT ||
          change.action === PROPS_ACTIONS.ADD_PROPERTY
        ) {
          orderedChanges.push(change as PropsChange | AddRemoveElementChange)
        }
      })
      orderedChanges.length = 0
      return { subscription }
    })()

    expect(
      sceneTree.addNewElementsFromCanonicalData(
        elements,
        properties,
        workspace as GroupInstanceTypes,
        undefined,
        { undoable: false }
      )
    ).toEqual(['canonical-element-1', 'canonical-element-2'])

    expect(propsManager.save()).toEqual(
      Object.fromEntries(properties.map((property) => [property.id, property]))
    )
    expect(
      elements.map(({ id }) => sceneTree.getElementById(id)?.save())
    ).toEqual(elements)
    expect(
      orderedChanges.map((change) =>
        change.action === PROPS_ACTIONS.ADD_PROPERTY
          ? {
              action: change.action,
              data: (change as AddRemovePropertyChange).data
            }
          : {
              action: change.action,
              data: (change as AddRemoveElementChange).data,
              index: (change as AddRemoveElementChange).index
            }
      )
    ).toEqual([
      { action: PROPS_ACTIONS.ADD_PROPERTY, data: properties },
      {
        action: SCENE_TREE_ACTIONS.ADD_ELEMENT,
        data: elements[0],
        index: 0
      },
      {
        action: SCENE_TREE_ACTIONS.ADD_ELEMENT,
        data: elements[1],
        index: 1
      }
    ])
    subscription.unsubscribe()
  })

  it('keeps canonical property and element evidence detached from caller data', () => {
    sceneTree.init()
    const workspace = sceneTree.currentWorkspace as Workspace
    const stroke = new TestStrokeComponent({
      id: 'detached-canonical-stroke',
      fill: { kind: 'solid', color: '#123456', opacity: 0.75 },
      width: 6
    }).save()
    const strokes = {
      id: 'detached-canonical-strokes',
      type: TEST_REACTIVE_STROKES_PROPERTY_TYPE,
      strokes: ['detached-canonical-stroke']
    } as PropertyComponentRawData
    const element = {
      id: 'detached-canonical-vector',
      type: TEST_REACTIVE_VECTOR_TYPE,
      name: 'Detached Canonical Vector',
      parentId: workspace.get('id'),
      visible: true,
      lock: false,
      props: {
        strokes: 'detached-canonical-strokes'
      } as unknown as ElementRawData['props']
    } satisfies ElementRawData
    const expectedProperties = structuredClone([stroke, strokes])
    const expectedElement = structuredClone(element)
    const orderedChanges: (PropsChange | AddRemoveElementChange)[] = []
    const subscription = subscribeToEvents((event) => {
      if (
        event.type !== EventTypes.UPDATE_TRANSACTION ||
        !('payload' in event)
      ) {
        return
      }
      const change = event.payload as SceneTreeChange | PropsChange
      if (
        change.action === SCENE_TREE_ACTIONS.ADD_ELEMENT ||
        change.action === PROPS_ACTIONS.ADD_PROPERTY
      ) {
        orderedChanges.push(change as PropsChange | AddRemoveElementChange)
      }
    })
    orderedChanges.length = 0

    expect(
      sceneTree.addNewElementsFromCanonicalData(
        [element],
        [stroke, strokes],
        workspace as GroupInstanceTypes
      )
    ).toEqual(['detached-canonical-vector'])
    const evidenceBeforeCallerMutation = structuredClone(orderedChanges)

    ;(
      stroke as unknown as {
        fill: { color: string }
      }
    ).fill.color = '#abcdef'
    ;(
      strokes as unknown as {
        strokes: string[]
      }
    ).strokes.push('caller-only-stroke')
    element.name = 'Caller-only name'
    ;(element.props as Record<string, string>).strokes = 'caller-only-owner'

    expect(
      propsManager.getPropertyById('detached-canonical-stroke')?.save()
    ).toEqual(expectedProperties[0])
    expect(
      propsManager.getPropertyById('detached-canonical-strokes')?.save()
    ).toEqual(expectedProperties[1])
    expect(
      sceneTree.getElementById('detached-canonical-vector')?.save()
    ).toEqual(expectedElement)
    expect(orderedChanges).toEqual(evidenceBeforeCallerMutation)
    subscription.unsubscribe()
  })

  it('binds child-first canonical property relationships through the owner batch', () => {
    sceneTree.init()
    const workspace = sceneTree.currentWorkspace as Workspace
    const stroke = new TestStrokeComponent({
      id: 'canonical-stroke',
      fill: { kind: 'solid', color: '#123456', opacity: 0.75 },
      width: 6
    }).save()
    const strokes = {
      id: 'canonical-strokes',
      type: TEST_REACTIVE_STROKES_PROPERTY_TYPE,
      strokes: ['canonical-stroke']
    } as PropertyComponentRawData
    const element = {
      id: 'canonical-vector',
      type: TEST_REACTIVE_VECTOR_TYPE,
      name: 'Canonical Vector',
      parentId: workspace.get('id'),
      visible: true,
      lock: false,
      props: {
        strokes: 'canonical-strokes'
      } as unknown as ElementRawData['props']
    } satisfies ElementRawData

    expect(
      sceneTree.addNewElementsFromCanonicalData(
        [element],
        [stroke, strokes],
        workspace as GroupInstanceTypes
      )
    ).toEqual(['canonical-vector'])

    expect(sceneTree.getElementById('canonical-vector')?.save()).toEqual(
      element
    )
    expect(
      sceneTree.getElementById('canonical-vector')?.getAllComputedData()
    ).toMatchObject({
      strokes: [
        {
          id: 'canonical-stroke',
          fill: { kind: 'solid', color: '#123456', opacity: 0.75 },
          width: 6
        }
      ]
    })
    expect(propsManager.changes).toEqual([])
    expect(sceneTree.changes).toEqual([])
    const createdStroke = propsManager.getPropertyById('canonical-stroke')
    createdStroke?.set('width' as never, 12 as never)
    expect(
      sceneTree
        .getElementById('canonical-vector')
        ?.computed.get('strokes' as never)
    ).toMatchObject([
      {
        id: 'canonical-stroke',
        fill: { kind: 'solid', color: '#123456', opacity: 0.75 },
        width: 12
      }
    ])
    expect(propsManager.changes).toContainEqual(
      expect.objectContaining({
        id: 'canonical-stroke',
        key: 'width',
        after: 12
      })
    )
  })

  it('reuses exact active property relationships for one ordered canonical element batch', () => {
    sceneTree.init()
    const workspace = sceneTree.currentWorkspace as Workspace
    const strokeData = new TestStrokeComponent({
      id: 'active-canonical-stroke',
      fill: { kind: 'solid', color: '#123456', opacity: 0.75 },
      width: 6
    }).save()
    const stroke = propsManager.createProperty(strokeData)
    propsManager.addProperty([stroke])
    const strokesData = {
      id: 'active-canonical-strokes',
      type: TEST_REACTIVE_STROKES_PROPERTY_TYPE,
      strokes: ['active-canonical-stroke']
    } as PropertyComponentRawData
    const strokes = propsManager.createProperty(strokesData)
    propsManager.addProperty([strokes])
    propsManager.cleanChanges()
    const properties = [strokes.save(), stroke.save()]
    const elements = [1, 2].map(
      (suffix) =>
        ({
          id: `active-canonical-vector-${suffix}`,
          type: TEST_REACTIVE_VECTOR_TYPE,
          name: `Active Canonical Vector ${suffix}`,
          parentId: workspace.get('id'),
          visible: true,
          lock: false,
          props: {
            strokes: 'active-canonical-strokes'
          } as unknown as ElementRawData['props']
        }) satisfies ElementRawData
    )
    const orderedChanges: (PropsChange | AddRemoveElementChange)[] = []
    const subscription = subscribeToEvents((event) => {
      if (
        event.type !== EventTypes.UPDATE_TRANSACTION ||
        !('payload' in event)
      ) {
        return
      }
      const change = event.payload as SceneTreeChange | PropsChange
      if (
        change.action === SCENE_TREE_ACTIONS.ADD_ELEMENT ||
        change.action === PROPS_ACTIONS.ADD_PROPERTY
      ) {
        orderedChanges.push(change as PropsChange | AddRemoveElementChange)
      }
    })
    orderedChanges.length = 0
    const addToMap = vi.spyOn(propsManager, 'addToMap')
    const strokeSave = vi.spyOn(stroke, 'save')
    const strokesSave = vi.spyOn(strokes, 'save')

    const createdIds =
      sceneTree.addNewElementsFromCanonicalDataUsingActiveProperties(
        elements,
        properties,
        workspace as GroupInstanceTypes,
        undefined,
        { undoable: false }
      )
    const repeatedRegistrationCount = addToMap.mock.calls.length
    const exactSaveCounts = {
      stroke: strokeSave.mock.calls.length,
      strokes: strokesSave.mock.calls.length
    }
    addToMap.mockRestore()
    strokeSave.mockRestore()
    strokesSave.mockRestore()

    expect(createdIds).toEqual([
      'active-canonical-vector-1',
      'active-canonical-vector-2'
    ])
    expect(repeatedRegistrationCount).toBe(0)
    expect(exactSaveCounts).toEqual({
      stroke: 2,
      strokes: 2
    })
    expect(propsManager.getPropertyById(strokeData.id)).toBe(stroke)
    expect(propsManager.getPropertyById(strokesData.id)).toBe(strokes)
    expect(
      elements.map(({ id }) => sceneTree.getElementById(id)?.save())
    ).toEqual(elements)
    expect(
      orderedChanges.map((change) => ({
        action: change.action,
        data: (change as AddRemoveElementChange).data,
        index: (change as AddRemoveElementChange).index
      }))
    ).toEqual([
      {
        action: SCENE_TREE_ACTIONS.ADD_ELEMENT,
        data: elements[0],
        index: 0
      },
      {
        action: SCENE_TREE_ACTIONS.ADD_ELEMENT,
        data: elements[1],
        index: 1
      }
    ])

    stroke.set('width' as never, 12 as never)
    expect(
      sceneTree
        .getElementById('active-canonical-vector-1')
        ?.computed.get('strokes' as never)
    ).toMatchObject([
      {
        id: 'active-canonical-stroke',
        width: 12
      }
    ])
    subscription.unsubscribe()
  })

  it('rejects stale active property evidence before applying a scene prefix', () => {
    sceneTree.init()
    sceneTree.cleanChanges()
    const workspace = sceneTree.currentWorkspace as Workspace
    const position = propsManager.createProperty(
      new TestPositionComponent({
        id: 'active-stale-position',
        x: 4,
        y: 8
      }).save()
    )
    const dimension = propsManager.createProperty(
      new TestDimensionComponent({
        id: 'active-stale-dimension',
        width: 16,
        height: 32
      }).save()
    )
    propsManager.addProperty([position, dimension])
    propsManager.cleanChanges()
    const beforeElementIds = [...sceneTree.getAllElements().keys()]
    const beforeChildren = workspace.get('children')
    const beforeChildrenSnapshot = [...beforeChildren]
    const beforeProps = propsManager.save()
    const sceneCommit = vi.spyOn(sceneTree, 'commitSceneTreeTransaction')
    const replaceBatchParentChildren = vi.spyOn(
      workspace,
      'replaceBatchParentChildren'
    )
    const element = {
      id: 'active-stale-element',
      type: 'rect',
      name: 'Active Stale Element',
      parentId: workspace.get('id'),
      visible: true,
      lock: false,
      props: {
        position: 'active-stale-position',
        dimension: 'active-stale-dimension'
      }
    } satisfies ElementRawData

    expect(() =>
      sceneTree.addNewElementsFromCanonicalDataUsingActiveProperties(
        [element],
        [
          { ...position.save(), x: 999 },
          dimension.save()
        ] as readonly PropertyComponentRawData[],
        workspace as GroupInstanceTypes
      )
    ).toThrow(/changed exact component data/i)

    expect([...sceneTree.getAllElements().keys()]).toEqual(beforeElementIds)
    expect(workspace.get('children')).toBe(beforeChildren)
    expect(workspace.get('children')).toEqual(beforeChildrenSnapshot)
    expect(propsManager.save()).toEqual(beforeProps)
    expect(propsManager.changes).toEqual([])
    expect(sceneTree.changes).toEqual([])
    expect(sceneCommit).not.toHaveBeenCalled()
    expect(replaceBatchParentChildren).not.toHaveBeenCalled()
  })

  it('preserves shared new owners and rejects untracked active owners', () => {
    sceneTree.init()
    const workspace = sceneTree.currentWorkspace as Workspace
    const sharedStroke = new TestStrokeComponent({
      id: 'canonical-shared-stroke',
      width: 4
    }).save()
    const sharedStrokes = {
      id: 'canonical-shared-strokes',
      type: TEST_REACTIVE_STROKES_PROPERTY_TYPE,
      strokes: ['canonical-shared-stroke']
    } as PropertyComponentRawData
    const sharedElements = [1, 2].map(
      (suffix) =>
        ({
          id: `canonical-shared-${suffix}`,
          type: TEST_REACTIVE_VECTOR_TYPE,
          name: `Canonical Shared ${suffix}`,
          parentId: workspace.get('id'),
          visible: true,
          lock: false,
          props: {
            strokes: 'canonical-shared-strokes'
          } as unknown as ElementRawData['props']
        }) satisfies ElementRawData
    )

    expect(
      sceneTree.addNewElementsFromCanonicalData(
        sharedElements,
        [sharedStroke, sharedStrokes],
        workspace as GroupInstanceTypes
      )
    ).toEqual(['canonical-shared-1', 'canonical-shared-2'])
    expect(
      sharedElements.map(({ id }) => sceneTree.getElementById(id)?.save())
    ).toEqual(sharedElements)

    const active = propsManager.createProperty({
      id: 'existing-shared-strokes',
      type: TEST_REACTIVE_STROKES_PROPERTY_TYPE,
      strokes: []
    })
    propsManager.addProperty([active])
    propsManager.cleanChanges()
    const ordinaryElement = {
      id: 'ordinary-existing-owner',
      type: TEST_REACTIVE_VECTOR_TYPE,
      name: 'Ordinary Existing Owner',
      parentId: workspace.get('id'),
      visible: true,
      lock: false,
      props: {
        strokes: 'existing-shared-strokes'
      } as unknown as ElementRawData['props']
    } satisfies ElementRawData
    const canonicalElement = {
      ...ordinaryElement,
      id: 'canonical-existing-owner',
      name: 'Canonical Existing Owner'
    } satisfies ElementRawData

    expect(
      sceneTree.addNewElement(
        ordinaryElement as unknown as CreateElementData,
        workspace as GroupInstanceTypes
      )
    ).toBe('ordinary-existing-owner')
    expect(() =>
      sceneTree.addNewElementsFromCanonicalData(
        [canonicalElement],
        [],
        workspace as GroupInstanceTypes
      )
    ).toThrow(/property owner/i)
    expect(sceneTree.getElementById('ordinary-existing-owner')?.save()).toEqual(
      ordinaryElement
    )
    expect(sceneTree.getElementById('canonical-existing-owner')).toBeUndefined()
    expect(propsManager.getPropertyById('existing-shared-strokes')).toBe(active)
  })

  it('creates an exact zero-slot canonical component without inventing properties', () => {
    sceneTree.init()
    const workspace = sceneTree.currentWorkspace as Workspace
    const element = {
      id: 'canonical-empty',
      type: TEST_EMPTY_TYPE,
      name: 'Canonical Empty',
      parentId: workspace.get('id'),
      visible: true,
      lock: false,
      props: {} as unknown as ElementRawData['props']
    } satisfies ElementRawData

    expect(
      sceneTree.addNewElementsFromCanonicalData(
        [element],
        [],
        workspace as GroupInstanceTypes
      )
    ).toEqual(['canonical-empty'])
    expect(sceneTree.getElementById('canonical-empty')?.save()).toEqual(element)
    expect(propsManager.save()).toEqual({})
  })

  it('creates an exact zero-slot canonical component through the active-property route', () => {
    sceneTree.init()
    const workspace = sceneTree.currentWorkspace as Workspace
    const element = {
      id: 'active-canonical-empty',
      type: TEST_EMPTY_TYPE,
      name: 'Active Canonical Empty',
      parentId: workspace.get('id'),
      visible: true,
      lock: false,
      props: {} as unknown as ElementRawData['props']
    } satisfies ElementRawData
    const orderedChanges: (PropsChange | AddRemoveElementChange)[] = []
    const subscription = subscribeToEvents((event) => {
      if (
        event.type !== EventTypes.UPDATE_TRANSACTION ||
        !('payload' in event)
      ) {
        return
      }
      const change = event.payload as SceneTreeChange | PropsChange
      if (
        change.action === SCENE_TREE_ACTIONS.ADD_ELEMENT ||
        change.action === PROPS_ACTIONS.ADD_PROPERTY
      ) {
        orderedChanges.push(change as PropsChange | AddRemoveElementChange)
      }
    })
    orderedChanges.length = 0

    expect(
      sceneTree.addNewElementsFromCanonicalDataUsingActiveProperties(
        [element],
        [],
        workspace as GroupInstanceTypes
      )
    ).toEqual(['active-canonical-empty'])
    expect(sceneTree.getElementById(element.id)?.save()).toEqual(element)
    expect(propsManager.save()).toEqual({})
    expect(orderedChanges).toEqual([
      expect.objectContaining({
        action: SCENE_TREE_ACTIONS.ADD_ELEMENT,
        data: element,
        index: 0
      })
    ])
    subscription.unsubscribe()
  })

  it('rejects invalid canonical ownership and rolls back exact-data failures without a prefix', () => {
    sceneTree.init()
    sceneTree.cleanChanges()
    propsManager.cleanChanges()
    const workspace = sceneTree.currentWorkspace as Workspace
    const beforeElementIds = [...sceneTree.getAllElements().keys()]
    const beforeChildren = [...workspace.get('children')]
    const beforeProps = propsManager.save()
    const position = new TestPositionComponent({
      id: 'canonical-rollback-position',
      x: 4,
      y: 8
    }).save()
    const dimension = new TestDimensionComponent({
      id: 'canonical-rollback-dimension',
      width: 16,
      height: 32
    }).save()
    const element = {
      id: 'canonical-rollback-element',
      type: 'rect',
      name: 'Canonical Rollback Element',
      parentId: workspace.get('id'),
      visible: true,
      lock: false,
      props: {
        position: position.id,
        dimension: dimension.id
      },
      unexpected: 'must not be dropped'
    } as ElementRawData
    const propsCommit = vi.spyOn(propsManager, 'commitChanges')
    const sceneCommit = vi.spyOn(sceneTree, 'commitSceneTreeTransaction')

    expect(() =>
      sceneTree.addNewElementsFromCanonicalData(
        [element],
        [position, dimension],
        workspace as GroupInstanceTypes
      )
    ).toThrow(/changed exact element data/i)

    expect([...sceneTree.getAllElements().keys()]).toEqual(beforeElementIds)
    expect(workspace.get('children')).toEqual(beforeChildren)
    expect(propsManager.save()).toEqual(beforeProps)
    expect(propsManager.changes).toEqual([])
    expect(sceneTree.changes).toEqual([])
    expect(propsCommit).not.toHaveBeenCalled()
    expect(sceneCommit).not.toHaveBeenCalled()

    expect(() =>
      sceneTree.addNewElementsFromCanonicalData(
        [
          {
            ...element,
            unexpected: undefined,
            props: {
              position: dimension.id,
              dimension: position.id
            }
          } as ElementRawData
        ],
        [position, dimension],
        workspace as GroupInstanceTypes
      )
    ).toThrow(/invalid "position" property owner/i)
    expect([...sceneTree.getAllElements().keys()]).toEqual(beforeElementIds)
    expect(propsManager.save()).toEqual(beforeProps)
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

  it('materializes ids-or-objects defaults and descriptor overrides through one final property registry batch', () => {
    const childType = 'scene-ordinary-paint'
    const parentType = 'scene-ordinary-paints'
    const elementType = 'scene-ordinary-painted-element'
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
    const properties = [
      {
        name: 'paints',
        type: parentType,
        defaultValue: [{ color: '#111111', opacity: 1 }]
      }
    ]
    componentRegistry.register({
      type: elementType,
      idPrefix: elementType,
      namePrefix: 'Painted Element',
      constructor: createDynamicComponent(
        elementType,
        elementType,
        'Painted Element',
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
    const registerMany = vi.spyOn(propsManager, 'registerMany')

    expect(
      sceneTree.addNewElements(
        [
          {
            id: 'painted-first',
            type: elementType,
            x: 0,
            y: 0,
            paints: [{ color: '#222222', opacity: 0.5 }]
          },
          {
            id: 'painted-second',
            type: elementType,
            x: 0,
            y: 0,
            paints: [{ color: '#333333', opacity: 0.75 }]
          }
        ] as CreateElementData[],
        workspace as GroupInstanceTypes
      )
    ).toEqual(['painted-first', 'painted-second'])

    expect(registerMany).toHaveBeenCalledTimes(1)
    expect(registerMany.mock.calls[0]?.[0]).toHaveLength(4)
    expect(Object.keys(propsManager.save())).toHaveLength(4)
    expect(
      sceneTree.getElementById('painted-first')?.computed.get('paints' as never)
    ).toEqual([
      expect.objectContaining({
        color: '#222222',
        opacity: 0.5
      })
    ])
    expect(
      sceneTree
        .getElementById('painted-second')
        ?.computed.get('paints' as never)
    ).toEqual([
      expect.objectContaining({
        color: '#333333',
        opacity: 0.75
      })
    ])
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
      sceneTree.removeElement(
        { id: tombstoneId },
        workspace as GroupInstanceTypes
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
    const batchHandoff = vi.fn(
      (
        _events: readonly UpdateTransactionEvent[],
        _evidence: readonly {
          orderedIds: readonly string[]
          sharedRecords?: readonly {
            orderedIds: readonly string[]
            payload: object
          }[]
        }[]
      ) => {
        throw handoffFailure
      }
    )
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
    const deliveryEvidence = batchHandoff.mock.calls[0]?.[1] ?? []
    const propertyRecord = deliveryEvidence[0]?.sharedRecords?.[0]

    expect({
      individualHandoffCalls: individualHandoff.mock.calls.length,
      batchHandoffCalls: batchHandoff.mock.calls.length,
      orderedBatch,
      propsEvidenceOrderedIds: deliveryEvidence[0]?.orderedIds ?? [],
      propsRecordOrderedIds: propertyRecord?.orderedIds ?? [],
      propsRecordPropertyCount:
        (propertyRecord?.payload as AddRemovePropertyChange | undefined)?.data
          .length ?? 0,
      sceneEvidenceOrderedIds: deliveryEvidence[1]?.orderedIds ?? [],
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
      sceneTree.removeElement(
        { id: tombstoneId },
        workspace as GroupInstanceTypes
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
      runWithTransactionOwner(transactionOwner, () =>
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

  it('Step 4 canonical owner: rejects a transaction owner without batch acceptance before any handoff prefix', () => {
    sceneTree.init()
    const workspace = sceneTree.currentWorkspace as Workspace
    const addManyToMap = vi.spyOn(sceneTree, 'addManyToMap')
    const replaceChildren = vi.spyOn(
      workspace,
      'replaceChildrenFromCanonicalBatch'
    )
    const updateTransaction = vi.fn()
    const transactionOwner = {
      startTransaction: vi.fn(),
      updateTransaction,
      endTransaction: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn()
    }

    expect(() =>
      runWithTransactionOwner(transactionOwner, () =>
        sceneTree.addNewElements(
          [{ id: 'non-batch-owner-element', type: 'rect', x: 10, y: 20 }],
          workspace as GroupInstanceTypes
        )
      )
    ).toThrow(/batch-capable transaction owner/i)

    expect(updateTransaction).not.toHaveBeenCalled()
    expect(addManyToMap).not.toHaveBeenCalled()
    expect(replaceChildren).not.toHaveBeenCalled()
    expect(sceneTree.getElementById('non-batch-owner-element')).toBeUndefined()
    expect(workspace.get('children')).toEqual([])
    expect(propsManager.save()).toEqual({})
    expect(propsManager.changes).toEqual([])
    expect(sceneTree.changes).toEqual([])
  })

  it('Step 4 canonical owner: removes one exact Scene batch while separate Props evidence stays active', () => {
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
    const replaceChildren = vi.spyOn(
      workspace,
      'replaceChildrenFromCanonicalBatch'
    )
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

    expect(
      runWithTransactionOwner(transactionOwner, () =>
        sceneTree.removeElementsUsingActiveProperties(removals)
      )
    ).toEqual(['active-props-remove-1', 'active-props-remove-2'])

    expect(workspace.get('children')).toEqual([])
    expect(sceneTree.getElementById('active-props-remove-1')).toBeUndefined()
    expect(sceneTree.getElementById('active-props-remove-2')).toBeUndefined()
    expect(propsManager.save()).toEqual(propertySnapshot)
    expect(replaceChildren).toHaveBeenCalledOnce()
    expect(updateTransaction).not.toHaveBeenCalled()
    expect(updateTransactionBatch).toHaveBeenCalledOnce()
    expect(
      updateTransactionBatch.mock.calls[0]?.[0].map(
        ({ payload }: UpdateTransactionEvent) => ({
          action: (payload as AddRemoveElementChange).action,
          id: (payload as AddRemoveElementChange).data.id
        })
      )
    ).toEqual([
      {
        action: SCENE_TREE_ACTIONS.REMOVE_ELEMENT,
        id: 'active-props-remove-1'
      },
      {
        action: SCENE_TREE_ACTIONS.REMOVE_ELEMENT,
        id: 'active-props-remove-2'
      }
    ])
    expect(updateTransactionBatch.mock.calls[0]?.[1]).toEqual([
      { orderedIds: ['active-props-remove-1'] },
      { orderedIds: ['active-props-remove-2'] }
    ])
    expect(propsManager.changes).toEqual([])
    expect(sceneTree.changes).toEqual([])
  })

  it('Step 4 canonical owner: rejects a later stale active-property removal with no prefix', () => {
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
      sceneTree.removeElementsUsingActiveProperties([
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
    ).toThrow(/exact element evidence/i)

    expect(workspace.get('children')).toEqual(beforeChildren)
    expect(sceneTree.getElementById('active-props-valid-head')).toBe(head)
    expect(sceneTree.getElementById('active-props-stale-tail')).toBe(tail)
    expect(propsManager.save()).toEqual(beforeProps)
    expect(propsManager.changes).toEqual([])
    expect(sceneTree.changes).toEqual([])
  })

  it('Step 4 canonical owner: makes active-property single removal exactly batch-of-one', () => {
    sceneTree.init()
    const workspace = sceneTree.currentWorkspace as Workspace
    sceneTree.addNewElement(
      { id: 'active-props-single', type: 'rect', x: 10, y: 20 },
      workspace as GroupInstanceTypes
    )
    const element = sceneTree.getElementById('active-props-single')
    if (!element) {
      throw new Error('Expected active-property single removal fixture')
    }
    const removal = {
      data: element.save(),
      parentId: workspace.get('id'),
      index: 0
    }
    const removeBatch = vi.spyOn(
      sceneTree,
      'removeElementsUsingActiveProperties'
    )

    expect(sceneTree.removeElementUsingActiveProperties(removal)).toBe(true)
    expect(removeBatch).toHaveBeenCalledOnce()
    expect(removeBatch).toHaveBeenCalledWith([removal], undefined)
  })

  it('Step 4 canonical owner: rejects nested element removals before changing hierarchy or retained properties', () => {
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
      sceneTree.removeElementsUsingActiveProperties([
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

  it('Step 4 canonical owner: leaves replay unapplied when batch handoff fails before acceptance', () => {
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
    const positionId = element.props.getPropId(PropertyTypes.POSITION)
    const position = positionId
      ? (propsManager.getPropertyById(positionId) as TestPositionComponent)
      : undefined
    if (!position) {
      throw new Error('Expected pre-accept retained position property')
    }
    const originalGetValue = position.getValue.bind(position)
    position.getValue = vi.fn(() => {
      throw new Error('rollback must not reconstruct computed subscriptions')
    })
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
    let capturedFailure: unknown

    try {
      runInTransactionReplayMode('undo', () =>
        runWithTransactionOwner(transactionOwner, () =>
          sceneTree.removeElementsUsingActiveProperties([removal])
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

    position.getValue = originalGetValue
    position.set('x', 64)
    expect(element.computed.get('x')).toBe(64)
  })

  it('Step 4 canonical owner: rejects an inactive batch owner without losing canonical evidence', () => {
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

    expect(() =>
      runWithTransactionOwner(transactionOwner, () =>
        sceneTree.removeElementsUsingActiveProperties([
          {
            data: element.save(),
            parentId: workspace.get('id'),
            index: 0
          }
        ])
      )
    ).toThrow(/active transaction/i)

    expect(workspace.get('children')).toEqual([element.get('id')])
    expect(sceneTree.getElementById(element.get('id'))).toBe(element)
    expect(sceneTree._deletedMap.has(element.get('id'))).toBe(false)
    expect(propsManager.save()).toEqual(beforeProps)
    expect(sceneTree.changes).toEqual([])
    expect(propsManager.changes).toEqual([])
  })

  it.each(['undo', 'redo'] as const)(
    'Step 4 canonical owner: rejects a null %s replay handoff without losing canonical evidence',
    (replayMode) => {
      sceneTree.init()
      const workspace = sceneTree.currentWorkspace as Workspace
      sceneTree.addNewElement(
        {
          id: `active-removal-null-${replayMode}`,
          type: 'rect',
          x: 10,
          y: 20
        },
        workspace as GroupInstanceTypes
      )
      const element = sceneTree.getElementById(
        `active-removal-null-${replayMode}`
      )
      if (!element) {
        throw new Error(`Expected null ${replayMode} removal fixture`)
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

      expect(() =>
        runInTransactionReplayMode(replayMode, () =>
          runWithTransactionOwner(transactionOwner, () =>
            sceneTree.removeElementsUsingActiveProperties([
              {
                data: element.save(),
                parentId: workspace.get('id'),
                index: 0
              }
            ])
          )
        )
      ).toThrow(/active transaction/i)

      expect(workspace.get('children')).toEqual([element.get('id')])
      expect(sceneTree.getElementById(element.get('id'))).toBe(element)
      expect(sceneTree._deletedMap.has(element.get('id'))).toBe(false)
      expect(propsManager.save()).toEqual(beforeProps)
      expect(sceneTree.changes).toEqual([])
      expect(propsManager.changes).toEqual([])
    }
  )

  it('Step 4 canonical owner: reactivates computed subscriptions after retained replay restore', () => {
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

    expect(
      sceneTreeSingleton.removeElementUsingActiveProperties({
        data,
        parentId: workspace.get('id'),
        index: 0
      })
    ).toBe(true)
    runInTransactionReplayMode('undo', () =>
      publishEvent({
        type: EventTypes.ADD_ELEMENT,
        payload: {
          data,
          parentId: workspace.get('id'),
          index: 0
        }
      } as AddElementEvent)
    )

    const position = propsManager.getPropertyById(
      positionId
    ) as TestPositionComponent
    position.set('x', 88)

    expect(
      sceneTreeSingleton.getElementById(element.get('id'))?.computed.get('x')
    ).toBe(88)
  })

  it('Step 4 canonical owner: restores a complete retained subtree when its batch handoff is rejected', () => {
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
        sceneTree.removeSubtreeUsingActiveProperties(group.get('id'))
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

    const snapshot = sceneTree.removeSubtreeUsingActiveProperties(
      group.get('id')
    )
    const plan = sceneTree.preflightRestoreSubtree(snapshot)

    expect(plan.entries).toEqual([
      {
        elementId: 'accepted-active-subtree-child',
        strategy: 'reuse'
      },
      {
        elementId: 'accepted-active-subtree',
        strategy: 'reuse'
      }
    ])

    const childTombstone = sceneTree._deletedMap.get(
      'accepted-active-subtree-child'
    )
    const positionId = childTombstone?.props.getPropId(PropertyTypes.POSITION)
    const position = positionId
      ? (propsManager.getPropertyById(positionId) as TestPositionComponent)
      : undefined
    if (!childTombstone || !position) {
      throw new Error('Expected retained subtree property fixture')
    }
    const setupFailure = new Error('retained computed setup failed')
    position.getValue = vi.fn(() => {
      throw setupFailure
    })

    expect(() => sceneTree.applyRestoreSubtree(plan)).toThrow(setupFailure)
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
