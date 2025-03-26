import type {
  DataTypes,
  ElementRawData,
  GroupRawData,
  SceneTreeRawData,
  WorkspaceRawData
} from '@asra/utils'
import { EntityTypes, isGroupEntity } from '@asra/utils'
import sceneTree from '@asra/scene-tree'

import { render } from '../render'

class RenderSceneTree {
  private _workspace: WorkspaceRawData | null

  constructor() {
    this._workspace = null
  }

  load(sceneTreeData: SceneTreeRawData) {
    const currentWorkspace = sceneTreeData.elements[
      sceneTreeData.workspace
    ] as WorkspaceRawData
    this._workspace = currentWorkspace

    // Create root render node
    const root = this.addContainer(sceneTreeData.workspace)

    // Create all element render node
    Object.values(sceneTreeData.elements).forEach((elementData) => {
      if (elementData.type !== EntityTypes.WORKSPACE) {
        this.addElement(elementData)
      }
    })

    render.addRoot(root)

    this.groupMapChildren(currentWorkspace)
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

  addElement(data: ElementRawData) {
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
