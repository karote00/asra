import Factory, { SceneTreeChange } from '@asra/factory'
import {
  SceneTreeRawData,
  WorkspaceRawData,
  ElementRawData,
  EntityTypes,
  ElementInstanceTypes,
  GroupInstanceTypes,
  IElement
} from '@asra/utils'
import Workspace from './workspace'
import { createElement } from './utils'
import { ACTIONS, CHANGES } from '@asra/factory'

type SceneTreeDataType = Partial<SceneTreeRawData>

class SceneTree {
  _elements: Map<string, ElementInstanceTypes> = new Map()
  workspace: string = ''
  workspaceList: Workspace[] = []
  private listeners: ((change: SceneTreeChange) => void)[] = []

  constructor() {
    this._init()
  }

  _init(): void {
    const initWorkspace = new Workspace()
    this._elements.set(initWorkspace.get('id'), initWorkspace)
    this.workspaceList = [initWorkspace]
    this.workspace = this.workspaceList[0].get('id')
  }

  emit(change: SceneTreeChange) {
    Factory.transact.update(CHANGES.SCENE_TREE, change)
  }

  load(data: SceneTreeDataType) {
    if (!data) {
      return
    }

    this.workspace = data.workspace!

    if (data.workspaceList) {
      this.workspaceList = data.workspaceList.map(
        (workspaceData: WorkspaceRawData) => {
          const newWorkspace = new Workspace()
          newWorkspace.load(workspaceData)
          return newWorkspace
        }
      )
    }
  }

  addToMap(node: ElementInstanceTypes) {
    const el = node as IElement
    if (!el || !el.get('id')) {
      return
    }

    this._elements.set(el.get('id'), node)
  }

  get currentWorkspace() {
    return this._elements.get(this.workspace)
  }

  createElement(
    parent: GroupInstanceTypes,
    elementData: ElementRawData,
    index?: number
  ) {
    if (elementData.type === EntityTypes.WORKSPACE) {
      return null
    }

    const newElement = createElement(elementData) as ElementInstanceTypes
    if (newElement) {
      this.addNewElement(newElement, parent, index)
    }

    return newElement
  }

  addNewElement(
    element: ElementInstanceTypes,
    parent?: GroupInstanceTypes,
    index: number = -1
  ) {
    const workspace = this.currentWorkspace as Workspace
    if (!workspace) {
      return
    }

    Factory.transact.start()
    const success = workspace.addNewElement(element, parent, index)
    if (success) {
      this.addToMap(element)
      this.emit({
        action: ACTIONS.ADD_ELEMENT,
        parentId: parent ? parent.get('id') : '',
        index,
        data: element.save()
      })
    }
    Factory.transact.end()
  }

  addRectangle(
    elementData: ElementRawData,
    parent?: GroupInstanceTypes,
    index: number = -1
  ) {
    const newRectangle = createElement(elementData)
    if (newRectangle) {
      this.addNewElement(newRectangle, parent, index)
    }
  }

  onChange(listener: (change: SceneTreeChange) => void) {
    this.listeners.push(listener)
  }
}

const sceneTree = new SceneTree()

export default sceneTree
export { SceneTree }
