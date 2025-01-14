import type {
  SceneTreeRawData,
  WorkspaceRawData,
  ElementRawData,
  ElementInstanceTypes,
  GroupInstanceTypes,
  IElement
} from '@asra/utils'
import { EntityTypes } from '@asra/utils'
import Workspace from './components/workspace'
import { createElement } from './utils'

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
    this._elements.set(initWorkspace.get('id'), initWorkspace)
    this.workspaceList = [initWorkspace]
    this.workspace = this.workspaceList[0].get('id')
  }

  load(data: SceneTreeDataType) {
    if (!data) {
      return
    }

    if (data.workspace) {
      this.workspace = data.workspace
    }

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
    index = -1
  ): boolean {
    const workspace = this.currentWorkspace as Workspace
    if (!workspace) {
      return false
    }

    const success = workspace.addNewElement(element, parent, index)
    if (success) {
      this.addToMap(element)
    }

    return success
  }

  undo() {
    console.log('SceneTree UNDO')
  }

  redo() {
    console.log('SceneTree REDO')
  }
}

const sceneTree = new SceneTree()

export default sceneTree
export { SceneTree }
