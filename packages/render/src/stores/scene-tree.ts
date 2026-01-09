import type { DataTypes, ElementRawData, WorkspaceRawData } from '@asra/utils'
import { EntityTypes } from '@asra/utils'
import sceneTree from '@asra/scene-tree'
import { RenderElementData } from '../types'

import render from '../render'

class RenderSceneTree {
  private _workspace: WorkspaceRawData | null

  constructor() {
    this._workspace = null
  }

  reload() {
    if (!sceneTree.currentWorkspace) return

    const currentWorkspaceData =
      sceneTree.currentWorkspace.save() as WorkspaceRawData
    this._workspace = currentWorkspaceData

    // Create root render node
    render.switchWorkspace({
      label: currentWorkspaceData.id,
      x: 0,
      y: 0
    })

    // Create all element render node
    sceneTree.getAllElements().forEach((element) => {
      const renderElementData = this._getRenderData(element.get('id'))
      if (element.get('type') !== EntityTypes.WORKSPACE && renderElementData) {
        this.addElement(renderElementData)
      }
    })
  }

  private _getRenderData(id: string) {
    const element = sceneTree.getElementById(id)
    if (!element) return null

    const elementComputedData = element.getAllComputedData()
    const elementData = {
      ...element.save(),
      ...elementComputedData
    } as RenderElementData

    return elementData
  }

  addElementById(id: string) {
    const renderElementData = this._getRenderData(id)
    if (renderElementData) {
      this.addElement(renderElementData)
    }
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

export { RenderSceneTree }

const renderSceneTree = new RenderSceneTree()
export default renderSceneTree
