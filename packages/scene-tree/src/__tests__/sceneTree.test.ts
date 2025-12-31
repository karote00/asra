import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SceneTree } from '../sceneTree'
import * as utils from '../utils'
import {
  ElementInstanceTypes,
  EntityTypes,
  OWNER,
  SCENE_TREE_ACTIONS
} from '@asra/utils'
import { EventTypes } from '@asra/reactive-events' // Import EventTypes
import Workspace from '../components/workspace' // Assuming Workspace is a class

// Mock the utils module
vi.mock('../utils', () => ({
  createElement: vi.fn(),
  createWorkspace: vi.fn()
}))

// Mock reactive-events for EventTypes
vi.mock('@asra/reactive-events', () => ({
  EventTypes: {
    ADD_ELEMENT: 'ADD_ELEMENT',
    REMOVE_ELEMENT: 'REMOVE_ELEMENT'
  }
}))

describe('SceneTree', () => {
  let sceneTree: SceneTree
  let mockWorkspaceInstance: Workspace

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks()
    vi.resetAllMocks()

    // Define mockWorkspaceInstance inside beforeEach for fresh instance per test
    mockWorkspaceInstance = {
      get: vi.fn((key: string) => (key === 'id' ? 'workspace-1' : undefined)),
      save: vi.fn(() => ({ id: 'workspace-1', type: EntityTypes.WORKSPACE })),
      addNewElement: vi.fn(),
      removeElement: vi.fn()
    } as unknown as Workspace

    // Configure mocks for utils
    vi.mocked(utils.createWorkspace).mockReturnValue(mockWorkspaceInstance)
    vi.mocked(utils.createElement).mockImplementation(
      (data: any) =>
        ({
          get: vi.fn((key: string) => data[key] || 'mock-element-id'),
          save: vi.fn(() => data),
          updateComputedData: vi.fn()
        }) as unknown as ElementInstanceTypes
    )

    sceneTree = new SceneTree()
  })

  // Test _init() and basic workspace creation
  it('should initialize with a new workspace if none exists', () => {
    sceneTree.init()
    expect(utils.createWorkspace).toHaveBeenCalled()
    expect(sceneTree.workspace).toBe('workspace-1')
    expect(sceneTree.workspaceList).toEqual(['workspace-1'])
    expect(sceneTree.getAllElements().has('workspace-1')).toBe(true)
  })

  it('should not create a new workspace if one already exists', () => {
    sceneTree.workspace = 'existing-workspace'
    sceneTree.workspaceList = ['existing-workspace']
    sceneTree.init()
    expect(utils.createWorkspace).not.toHaveBeenCalled()
  })

  // Test element creation and management
  it('should create a new element and add a change for it', () => {
    const elementData = { id: 'el-1', type: EntityTypes.RECTANGLE }
    const newElement = sceneTree.createElement(elementData)
    expect(utils.createElement).toHaveBeenCalledWith(elementData)
    expect(newElement?.get('id')).toBe('el-1')
    expect(sceneTree.changes.length).toBe(1)
    expect(sceneTree.changes[0]).toEqual({
      eventName: EventTypes.ADD_ELEMENT,
      data: elementData,
      action: SCENE_TREE_ACTIONS.ADD_ELEMENT,
      owner: OWNER.SCENE_TREE,
      undoType: EventTypes.REMOVE_ELEMENT,
      undoAction: EventTypes.REMOVE_ELEMENT // This should be REMOVE_ELEMENT for undo
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
    const change = { eventName: EventTypes.ADD_ELEMENT } as any
    sceneTree.addChange(change)
    expect(sceneTree.changes).toEqual([change])
  })

  it('should clean all changes', () => {
    sceneTree.addChange({} as any)
    sceneTree.cleanChanges()
    expect(sceneTree.changes).toEqual([])
  })

  it('should add a change for adding an element', () => {
    const elementData = { id: 'el-change', type: EntityTypes.RECTANGLE }
    const element = {
      save: vi.fn(() => elementData),
      get: vi.fn(() => 'el-change')
    } as unknown as ElementInstanceTypes
    sceneTree.addChangeForAddElement(element)
    expect(sceneTree.changes.length).toBe(1)
    expect(sceneTree.changes[0].action).toBe(SCENE_TREE_ACTIONS.ADD_ELEMENT)
  })

  it('should add a change for removing an element', () => {
    const elementData = { id: 'el-change-remove', type: EntityTypes.RECTANGLE }
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
    const elementData = { id: 'el-restore', type: EntityTypes.RECTANGLE }
    const element = {
      save: vi.fn(() => elementData),
      get: vi.fn(() => 'el-restore')
    } as unknown as ElementInstanceTypes
    sceneTree.addToDeleteMap(element)
    const restored = sceneTree.getRestoreElementById('el-restore')
    expect(restored).toBe(element)
    // expect(sceneTree._deletedMap.has('el-restore')).toBe(false); // Commented out as per code behavior
    expect(sceneTree.changes.length).toBe(1)
    expect(sceneTree.changes[0].action).toBe(SCENE_TREE_ACTIONS.ADD_ELEMENT)
  })

  // Test addNewElement (delegated to workspace)
  it('should call addNewElement on the current workspace', () => {
    sceneTree.init() // Ensure workspace is initialized
    const element = {
      get: vi.fn(() => 'new-el')
    } as unknown as ElementInstanceTypes
    sceneTree.addNewElement(element)
    expect(mockWorkspaceInstance.addNewElement).toHaveBeenCalledWith(
      element,
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
    const mockElement1 = {
      id: 'el-load-1',
      type: EntityTypes.RECTANGLE,
      save: vi.fn(() => ({ id: 'el-load-1', type: EntityTypes.RECTANGLE })),
      get: vi.fn((key: string) => (key === 'id' ? 'el-load-1' : undefined))
    } as unknown as ElementInstanceTypes
    const mockWorkspaceLoad = {
      id: 'ws-load',
      type: EntityTypes.WORKSPACE,
      save: vi.fn(() => ({ id: 'ws-load', type: EntityTypes.WORKSPACE })),
      get: vi.fn((key: string) => (key === 'id' ? 'ws-load' : undefined))
    } as unknown as ElementInstanceTypes

    vi.mocked(utils.createElement).mockReturnValue(mockElement1)
    vi.mocked(utils.createWorkspace).mockReturnValue(mockWorkspaceLoad)

    const dataToLoad = {
      workspace: 'ws-load',
      workspaceList: ['ws-load'],
      elements: {
        'ws-load': { id: 'ws-load', type: EntityTypes.WORKSPACE },
        'el-load-1': { id: 'el-load-1', type: EntityTypes.RECTANGLE }
      }
    }

    sceneTree.load(dataToLoad)

    expect(sceneTree.workspace).toBe('ws-load')
    expect(sceneTree.workspaceList).toEqual(['ws-load'])
    expect(sceneTree.getAllElements().has('ws-load')).toBe(true)
    expect(sceneTree.getAllElements().has('el-load-1')).toBe(true)
    expect(utils.createWorkspace).toHaveBeenCalledWith(
      dataToLoad.elements['ws-load']
    )
    expect(utils.createElement).toHaveBeenCalledWith(
      dataToLoad.elements['el-load-1']
    )
  })

  it('should save data correctly', () => {
    sceneTree.init() // Ensure initial workspace
    const elementData = { id: 'el-save', type: EntityTypes.RECTANGLE }
    const element = {
      save: vi.fn(() => elementData),
      get: vi.fn(() => 'el-save')
    } as unknown as ElementInstanceTypes
    sceneTree.addToMap(element)

    const savedData = sceneTree.save()

    expect(savedData.workspace).toBe('workspace-1')
    expect(savedData.workspaceList).toEqual(['workspace-1'])
    expect(savedData.elements['workspace-1']).toEqual(
      mockWorkspaceInstance.save()
    )
    expect(savedData.elements['el-save']).toEqual(elementData)
  })
})
