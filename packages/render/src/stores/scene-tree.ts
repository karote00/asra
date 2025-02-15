import type { ElementRawData } from '@asra/utils'
import { isGroupEntity } from '@asra/utils'
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

    const currentWorkspaceId = currentWorkspace.get('id')
    const root = this.addContainer(currentWorkspaceId)

    render.addRoot(root)
    currentWorkspace.get('children').forEach((childId) => {
      const child = sceneTree.getElementById(childId)
      if (!child) return

      if (isGroupEntity(child.get('type'))) {
        this.addGroup(child)
      } else {
        this.addElement(currentWorkspaceId, child.save())
      }
    })
  }

  addContainer(currentWorkspaceId: string) {
    const container = render.addContainer({
      id: currentWorkspaceId,
      x: 0,
      y: 0
    })

    return container
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addGroup(group: any) {
    // console.log(group)
  }

  addElement(parentId: string, data: ElementRawData, index = -1) {
    render.addElement(parentId ?? this._workspace?.get('id'), data, index)
  }

  removeElement(parentId: string, data: ElementRawData) {
    render.removeElement(parentId, data.id)
  }
}

export default RenderSceneTree

const renderSceneTree = new RenderSceneTree()
export { renderSceneTree }
