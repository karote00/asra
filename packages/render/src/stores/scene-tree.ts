import type { DataTypes, ElementRawData, WorkspaceRawData } from '@asyra/utils'
import { EntityTypes } from '@asyra/utils'
import sceneTree from '@asyra/scene-tree'
import { RenderElementData } from '../types'

import render from '../render'

class RenderSceneTree {
  private _workspace: WorkspaceRawData | null
  private pendingElementUpdates = new Set<string>()
  private pendingFlush = false

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
    // Computed data updates arrive per-key; coalesce into a single render pass.
    this.pendingElementUpdates.add(elementId)
    if (this.pendingFlush) {
      return
    }

    this.pendingFlush = true
    const schedule =
      typeof queueMicrotask === 'function'
        ? queueMicrotask
        : (callback: () => void) => {
            Promise.resolve().then(callback)
          }

    schedule(() => {
      this.pendingFlush = false
      const ids = Array.from(this.pendingElementUpdates)
      this.pendingElementUpdates.clear()
      ids.forEach((id) => {
        const data = this._getRenderData(id)
        if (data) {
          render.updateElement(
            id,
            'computed',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            undefined as any as DataTypes,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            undefined as any as DataTypes,
            data
          )
        }
      })
    })
  }
}

export { RenderSceneTree }

const renderSceneTree = new RenderSceneTree()
export default renderSceneTree
