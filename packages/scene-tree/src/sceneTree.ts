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
  _deletedMap: Map<string, ElementInstanceTypes> = new Map()
  workspace: string = ''
  workspaceList: Workspace[] = []

  constructor() {
    this._init()
  }

  _init(): void {
    const initWorkspace = new Workspace()
    this.addToMap(initWorkspace)
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

  getElementById(elementId: string): IElement {
    return this._elements.get(elementId) as IElement
  }

  addToMap(node: ElementInstanceTypes) {
    const el = node as IElement
    const elId = el.get('id')
    if (!el || !elId) {
      return
    }

    this._elements.set(elId, node)
  }

  removeFromMap(elementId: string) {
    const el = this.getElementById(elementId) as IElement
    const elId = el.get('id')
    if (!el || !elId) {
      return
    }

    this._deletedMap.set(elId, el)
    this._elements.delete(elId)
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

    return createElement(elementData)
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

  removeElement(
    data: Partial<ElementRawData>,
    index: number,
    parent?: GroupInstanceTypes
  ): ElementInstanceTypes | null {
    const workspace = this.currentWorkspace as Workspace
    if (!workspace) {
      return null
    }

    const elementId = data.id as string
    const element = this.getElementById(elementId)
    const success = workspace.removeElement(element, index, parent)
    if (success) {
      this.removeFromMap(elementId)
    }

    return element
  }
}

const sceneTree = new SceneTree()

export default sceneTree
export { SceneTree }
