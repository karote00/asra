import type {
  SceneTreeRawData,
  WorkspaceRawData,
  ElementRawData,
  ElementInstanceTypes,
  GroupInstanceTypes
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
    if (!this.workspace && !this.workspaceList.length) {
      const initWorkspace = new Workspace()
      this.addToMap(initWorkspace)
      this.workspaceList = [initWorkspace]
      this.workspace = this.workspaceList[0].get('id')
    }
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

  getAllElements() {
    return this._elements
  }

  getElementById(elementId: string): ElementInstanceTypes {
    return this._elements.get(elementId) as ElementInstanceTypes
  }

  private addToMap(element: ElementInstanceTypes) {
    const elId = element.get('id')
    if (!element || !elId) {
      return
    }

    this.removeFromDeleteMap(element)
    this._elements.set(elId, element)
  }

  private removeFromMap(element: ElementInstanceTypes) {
    const elId = element.get('id')
    if (!element || !elId) {
      return
    }

    this.addToDeleteMap(element)
    this._elements.delete(elId)
  }

  getRestoreElementById(elementId: string): ElementInstanceTypes {
    return this._deletedMap.get(elementId) as ElementInstanceTypes
  }

  private addToDeleteMap(element: ElementInstanceTypes) {
    this._deletedMap.set(element.get('id'), element)
  }

  private removeFromDeleteMap(element: ElementInstanceTypes) {
    this._deletedMap.delete(element.get('id'))
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
      this.removeFromMap(element)
    }

    return element
  }
}

const sceneTree = new SceneTree()

export default sceneTree
export { SceneTree }
