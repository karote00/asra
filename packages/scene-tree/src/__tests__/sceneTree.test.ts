import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  ElementInstanceTypes,
  EntityTypes,
  OWNER,
  SCENE_TREE_ACTIONS,
  SceneTreeChange,
  resetIdCounter,
  type ElementRawData
} from '@asyra/utils'
import { SceneTree } from '../sceneTree'
import Element from '../components/element'
import Workspace from '../components/workspace'
import componentRegistry from '../component-registry'
import { EventTypes } from '@asyra/reactive-events'

// Create a mock Rectangle component for testing
class MockRectangle extends Element {
  constructor(data?: Partial<ElementRawData>) {
    super(data)
    this.data.type = 'rect'
  }
}

describe('SceneTree', () => {
  let sceneTree: SceneTree

  beforeEach(() => {
    vi.clearAllMocks()

    resetIdCounter()
    sceneTree = new SceneTree()

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
      owner: OWNER.SCENE_TREE,
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
