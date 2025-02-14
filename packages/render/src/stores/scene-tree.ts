import type { ElementRawData } from '@asra/utils'
import { isGroupEntity } from '@asra/utils'
import type { Workspace } from '@asra/scene-tree'
import sceneTree from '@asra/scene-tree'
import { render } from '../render'

class RenderSceneTree {
  reload() {
    const currentWorkspace = sceneTree.currentWorkspace as Workspace
    const currentWorkspaceId = currentWorkspace.get('id')
    this.addContainer(currentWorkspaceId)
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
    render.addContainer({
      id: currentWorkspaceId,
      x: 0,
      y: 0
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addGroup(group: any) {
    // console.log(group)
  }

  addElement(parentId: string, data: ElementRawData, index = -1) {
    render.addRectangle(parentId, data, index)
  }

  removeElement(parentId: string, data: ElementRawData) {
    // console.log({ parentId, data })
  }
}

export default RenderSceneTree

const renderSceneTree = new RenderSceneTree()
export { renderSceneTree }
