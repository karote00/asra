import type {
  ComputedAttrs,
  SceneTreeRawData,
  WorkspaceRawData,
  ElementRawData,
  ElementInstanceTypes,
  GroupInstanceTypes,
  SceneTreeChange,
  EVENT_OPTIONS,
  CreateElementData
} from '@asyra/utils'
import { EntityTypes, OWNER, SCENE_TREE_ACTIONS } from '@asyra/utils'
import { EventTypes, updateTransaction } from '@asyra/reactive-events'
import propsManager from '@asyra/props-manager'
import { createElement, createWorkspace, stripNonRawFields } from './utils'
import type Workspace from './components/workspace'

type SceneTreeDataType = SceneTreeRawData

class SceneTree {
  _elements: Map<string, ElementInstanceTypes> = new Map()
  _deletedMap: Map<string, ElementInstanceTypes> = new Map()
  workspace: string = ''
  workspaceList: string[] = []
  changes: SceneTreeChange[] = []

  _init(): void {
    if (!this.workspace && !this.workspaceList.length) {
      const initWorkspace = createWorkspace() as ElementInstanceTypes
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
      for (const elementId in data.elements) {
        const elementData = data.elements[elementId]
        let element
        if (elementData.type === EntityTypes.WORKSPACE) {
          element = createWorkspace(elementData as WorkspaceRawData)
        } else {
          element = createElement(elementData)
        }

        this.addToMap(element as ElementInstanceTypes)
      }
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

  getElementById(elementId: string): ElementInstanceTypes | undefined {
    return this._elements.get(elementId)
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
    elementData: CreateElementData,
    parent?: GroupInstanceTypes,
    index = -1,
    inUndoRedo = false
  ): string {
    const workspace = this.currentWorkspace as Workspace
    if (!workspace) {
      return ''
    }

    let newElement: ElementInstanceTypes | null = null

    const propOverrides = stripNonRawFields(elementData)
    if (inUndoRedo) {
      newElement = this.getRestoreElementById(elementData.id as string)
    } else {
      newElement = this.createElement(elementData)
    }

    if (newElement) {
      // Override props after finish creating new instance
      Object.keys(propOverrides).forEach((propKey) => {
        newElement.updateComputedData(
          propKey as keyof ComputedAttrs,
          propOverrides[propKey]
        )
      })
      propsManager.commitChanges()

      workspace.addNewElement(newElement, parent, index)

      this.commitSceneTreeTransaction()

      return newElement.get('id')
    }

    return ''
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
    if (!element) {
      return
    }

    this.addChangeForRemoveElement(element)
    workspace.removeElement(element, index, parent)
  }

  updateComputedData<K extends keyof ComputedAttrs>(
    elementId: string,
    key: K,
    data: ComputedAttrs[K]
  ) {
    const element = this.getElementById(elementId)
    if (!element) {
      return
    }

    element.updateComputedData(key, data)
  }

  commitSceneTreeTransaction(options?: EVENT_OPTIONS) {
    this.changes.forEach((change) => {
      updateTransaction(change.eventName, change, options)
    })
    this.cleanChanges()
  }
}

export { SceneTree }

const sceneTree = new SceneTree()
export default sceneTree
