import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  BasePropertyComponent,
  propertyComponentRegistry,
  registerPropertyComponent
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
  PropertyTypes,
  SCENE_TREE_ACTIONS,
  SceneTreeChange,
  SharedDataChannelNames,
  Unit,
  resetIdCounter,
  type ComputedAttrs,
  type ElementRawData
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
  subscribeToEvents,
  wasTransactionReplayApplied,
  type AddElementEvent,
  type UpdateComputedDataEvent,
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
      properties: [],
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

  // Test addNewElement (delegated to workspace)
  it('should call addNewElement on the current workspace', () => {
    sceneTree.init()
    const elementData = {
      id: 'test-rect',
      type: 'rect',
      x: 0,
      y: 0
    }
    const workspace = sceneTree.currentWorkspace as Workspace
    vi.spyOn(workspace, 'addNewElement')

    sceneTree.addNewElement(elementData, undefined, -1, false)

    expect(workspace.addNewElement).toHaveBeenCalled()
    expect(workspace.addNewElement).toHaveBeenCalledWith(
      expect.any(Object),
      undefined,
      -1
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
          visible: true,
          lock: false,
          children: []
        },
        'el-load-1': {
          id: 'el-load-1',
          type: 'rect',
          name: 'el-load-1',
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

    // Verify elements are loaded (note: workspace ID may be auto-generated)
    const elementIds = Array.from(sceneTree.getAllElements().keys())
    expect(elementIds).toContain('el-load-1')

    // Verify rectangle element
    const rectElement = sceneTree.getElementById('el-load-1')
    expect(rectElement).toBeDefined()
    expect(rectElement?.get('type')).toBe('rect')

    // Verify workspace element type (ID may differ from input)
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
          visible: true,
          lock: false,
          children: []
        },
        'rect-1': {
          id: 'rect-1',
          type: 'rect',
          name: 'Rect',
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

  it('load should keep valid elements and create a safe workspace when workspace metadata is invalid', () => {
    sceneTree.load({
      workspace: 123 as unknown as string,
      workspaceList: 'invalid' as unknown as string[],
      elements: {
        'rect-1': {
          id: 'rect-1',
          type: 'rect',
          name: 'Rect 1',
          visible: true,
          lock: false
        }
      }
    })

    // Invalid workspace metadata should not drop otherwise valid elements.
    expect(sceneTree.workspace).not.toBe('')
    expect(sceneTree.workspaceList.length).toBeGreaterThan(0)
    expect(sceneTree.getElementById('rect-1')).toBeDefined()
    const workspace = sceneTree.getElementById(sceneTree.workspace)
    expect(workspace?.get('type')).toBe(EntityTypes.WORKSPACE)
  })

  it('should save data correctly', () => {
    sceneTree.init()
    const elementData = { id: 'el-1', type: 'rect' }
    const element = {
      save: vi.fn(() => elementData),
      get: vi.fn(() => 'el-1')
    } as unknown as ElementInstanceTypes
    const workspace = sceneTree.currentWorkspace as Workspace
    const workspaceSaveData = workspace.save()
    sceneTree.addToMap(element)

    const savedData = sceneTree.save()

    expect(savedData.workspace).toBe(workspaceSaveData.id)
    expect(savedData.workspaceList).toEqual([workspaceSaveData.id])
    expect(savedData.elements[workspaceSaveData.id]).toEqual(workspaceSaveData)
    expect(savedData.elements['el-1']).toEqual(elementData)
  })
})
