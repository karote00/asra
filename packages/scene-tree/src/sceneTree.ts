import type {
  SceneTreeRawData,
  WorkspaceRawData,
  ElementRawData,
  ElementInstanceTypes,
  GroupInstanceTypes,
  GroupRawData,
  SceneTreeChange
} from '@asra/utils'
import { EntityTypes, OWNER, SCENE_TREE_ACTIONS } from '@asra/utils'
import { createElement, createWorkspace } from './utils'
import type Workspace from './components/workspace'
import { EventTypes } from '@asra/reactive-events'

type InstanceRawData = ElementRawData | GroupRawData | WorkspaceRawData
type SceneTreeDataType = SceneTreeRawData

class SceneTree {
  _elements: Map<string, ElementInstanceTypes> = new Map()
  _deletedMap: Map<string, ElementInstanceTypes> = new Map()
  workspace: string = ''
  workspaceList: string[] = []
  changes: SceneTreeChange[] = []

  _init(): void {
    if (!this.workspace && !this.workspaceList.length) {
      const initWorkspace = createWorkspace()
      if (initWorkspace) {
        this.addToMap(initWorkspace)
        this.workspaceList = [initWorkspace.get('id')]
        this.workspace = this.workspaceList[0]
      }
    }
  }

  init() {
    this._init()
  }

  load(data: SceneTreeDataType) {
    if (!data) return

    if (data.elements) {
      Object.values(data.elements).forEach((elementData: InstanceRawData) => {
        const element =
          elementData.type === EntityTypes.WORKSPACE
            ? createWorkspace(elementData as WorkspaceRawData)
            : createElement(elementData)

        this.addToMap(element as ElementInstanceTypes)
      })
    }

    if (data.workspace) {
      this.workspace = data.workspace
    }

    if (data.workspaceList) {
      this.workspaceList = data.workspaceList
    }
  }

  save() {
    const data: SceneTreeRawData = {
      workspace: this.workspace,
      workspaceList: this.workspaceList,
      elements: {}
    }

    this._elements.forEach((element, id) => {
      data.elements[id] = element.save()
    })

    return data
  }

  addChange(change: SceneTreeChange) {
    this.changes.push(change)
  }

  cleanChanges() {
    this.changes = []
  }

  getAllElements() {
    return this._elements
  }

  getElementById(elementId: string): ElementInstanceTypes {
    return this._elements.get(elementId) as ElementInstanceTypes
  }

  addToMap(element: ElementInstanceTypes) {
    const elId = element.get('id')
    if (!element || !elId) {
      return
    }

    this.removeFromDeleteMap(elId)
    this._elements.set(elId, element)
  }

  removeFromMap(element: ElementInstanceTypes) {
    const elId = element.get('id')
    if (!element || !elId) {
      return
    }

    this.addToDeleteMap(element)
    this._elements.delete(elId)
  }

  getRestoreElementById(elementId: string): ElementInstanceTypes {
    const restoredElement = this._deletedMap.get(
      elementId
    ) as ElementInstanceTypes
    this.addChangeForAddElement(restoredElement)
    return restoredElement
  }

  addToDeleteMap(element: ElementInstanceTypes) {
    this._deletedMap.set(element.get('id'), element)
  }

  removeFromDeleteMap(elementId: string) {
    this._deletedMap.delete(elementId)
  }

  addChangeForAddElement(element: ElementInstanceTypes) {
    this.addChange({
      eventName: EventTypes.ADD_ELEMENT,
      data: element.save(),
      action: SCENE_TREE_ACTIONS.ADD_ELEMENT,
      owner: OWNER.SCENE_TREE,
      undoType: EventTypes.REMOVE_ELEMENT,
      undoAction: EventTypes.REMOVE_ELEMENT
    })
  }

  addChangeForRemoveElement(element: ElementInstanceTypes) {
    this.addChange({
      eventName: EventTypes.REMOVE_ELEMENT,
      data: element.save(),
      action: SCENE_TREE_ACTIONS.REMOVE_ELEMENT,
      owner: OWNER.SCENE_TREE,
      undoType: EventTypes.ADD_ELEMENT,
      undoAction: EventTypes.ADD_ELEMENT
    })
  }

  get currentWorkspace() {
    return this.getElementById(this.workspace)
  }

  createElement(
    elementData: Partial<ElementRawData>
  ): ElementInstanceTypes | null {
    if (elementData.type === EntityTypes.WORKSPACE) {
      return null
    }

    const newElement = createElement(elementData) as ElementInstanceTypes
    this.addChangeForAddElement(newElement)
    return newElement
  }

  addNewElement(
    element: ElementInstanceTypes,
    parent?: GroupInstanceTypes,
    index = -1
  ) {
    const workspace = this.currentWorkspace as Workspace
    if (!workspace) {
      return
    }

    workspace.addNewElement(element, parent, index)
  }

  removeElement(
    data: Partial<ElementRawData>,
    index: number,
    parent?: GroupInstanceTypes
  ) {
    const workspace = this.currentWorkspace as Workspace
    if (!workspace) {
      return
    }

    const elementId = data.id as string
    const element = this.getElementById(elementId)
    sceneTree.addChangeForRemoveElement(element)
    workspace.removeElement(element, index, parent)
  }
}

const sceneTree = new SceneTree()

export default sceneTree
export { SceneTree }
