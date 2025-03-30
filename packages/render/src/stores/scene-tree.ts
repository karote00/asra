import type {
  DataTypes,
  ElementRawData,
  GroupRawData,
  WorkspaceRawData
} from '@asra/utils'
import { EntityTypes, isGroupEntity } from '@asra/utils'
import sceneTree from '@asra/scene-tree'
import { RenderElementData } from '../types'

import { render } from '../render'

class RenderSceneTree {
  private _workspace: WorkspaceRawData | null

  constructor() {
    this._workspace = null
  }

  reload() {
    const currentWorkspaceData =
      sceneTree.currentWorkspace.save() as WorkspaceRawData
    this._workspace = currentWorkspaceData

    // Create root render node
    const root = this.addContainer(currentWorkspaceData.id)

    // Create all element render node
    sceneTree.getAllElements().forEach((element) => {
      const elementComputedData = element.getAllComputedData()
      const elementData = {
        ...element.save(),
        ...elementComputedData
      } as RenderElementData
      elementData.id = element.get('id')
      if (element.get('type') !== EntityTypes.WORKSPACE) {
        this.addElement(elementData)
      }
    })

    render.addRoot(root)

    this.groupMapChildren(currentWorkspaceData)
  }

  addContainer(currentWorkspaceId: string) {
    const container = render.addContainer({
      id: currentWorkspaceId,
      x: 0,
      y: 0
    })

    return container
  }

  groupMapChildren(data: WorkspaceRawData | GroupRawData) {
    render.groupMapChildren(data)

    data.children.forEach((childId) => {
      const child = sceneTree.getElementById(childId)
      if (!child) return

      // Map children to group
      if (isGroupEntity(child.get('type'))) {
        this.groupMapChildren(child.save() as GroupRawData)
      }
    })
  }

  addElement(data: RenderElementData) {
    render.addElement(data)
  }

  removeElement(data: ElementRawData, parentId?: string) {
    render.removeElement(data.id, parentId)
  }

  updateElement(
    elementId: string,
    key: string,
    before: DataTypes,
    after: DataTypes
  ) {
    render.updateElement(elementId, key, before, after)
  }
}

export default RenderSceneTree

const renderSceneTree = new RenderSceneTree()
export { renderSceneTree }
