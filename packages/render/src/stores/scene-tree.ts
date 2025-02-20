import type {
  DataTypes,
  ElementRawData,
  GroupRawData,
  WorkspaceRawData
} from '@asra/utils'
import { EntityTypes, isGroupEntity } from '@asra/utils'
import type { Workspace } from '@asra/scene-tree'
import sceneTree from '@asra/scene-tree'
import { render } from '../render'

class RenderSceneTree {
  private _workspace: Workspace | null

  constructor() {
    this._workspace = null
  }

  reload() {
    const currentWorkspace = sceneTree.currentWorkspace as Workspace
    this._workspace = currentWorkspace

    // Create root render node
    const currentWorkspaceId = currentWorkspace.get('id')
    const root = this.addContainer(currentWorkspaceId)

    // Create all element render node
    sceneTree.getAllElements().forEach((element) => {
      if (element.get('type') !== EntityTypes.WORKSPACE) {
        this.addElement(element.save())
      }
    })

    render.addRoot(root)

    this.groupMapChildren(currentWorkspace.save())
  }

  addContainer(currentWorkspaceId: string) {
    const container = render.addContainer({
      id: currentWorkspaceId,
      x: 0,
      y: 0
    })

    return container
  }

  groupMapChildren(data: GroupRawData) {
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

  removeElement(parentId: string, data: ElementRawData, index = -1) {
    render.removeElement(parentId, data.id, index)
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
