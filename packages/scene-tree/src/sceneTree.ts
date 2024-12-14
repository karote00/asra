import {
  SceneTreeRawData,
  WorkspaceRawData,
  ElementRawData,
  EntityTypes
} from '@asra/utils'
import Workspace from './workspace'
import { createElement } from './utils'
import { ElementInstanceTypes, GroupInstanceTypes } from './constants'

type SceneTreeDataType = Partial<SceneTreeRawData>

class SceneTree {
  _elements: Map<string, ElementInstanceTypes> = new Map()
  workspace: string = ''
  workspaceList: Workspace[] = []

  constructor() {
    this._init()
  }

  _init(): void {
    const initWorkspace = new Workspace()
    this._elements.set(initWorkspace.id, initWorkspace)
    this.workspaceList = [initWorkspace]
    this.workspace = this.workspaceList[0].id
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
    if (!node || !node.id) {
      return
    }

    this._elements.set(node.id, node)
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
    index?: number
  ) {
    const workspace = this.currentWorkspace as Workspace
    if (!workspace) {
      return
    }

    workspace.addNewElement(element, parent, index)
  }

  addRectangle(
    elementData: ElementRawData,
    parent?: GroupInstanceTypes,
    index?: number
  ) {
    const newRectangle = createElement(elementData)

    if (newRectangle) {
      this.addNewElement(newRectangle, parent, index)
    }
  }
}

export default SceneTree
