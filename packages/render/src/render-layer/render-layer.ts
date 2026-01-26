import { Container, Graphics, Point } from 'pixi.js'
import { SceneElement, RenderContainerData, RenderElementData } from '../types'
import { DataTypes, EntityTypes } from '@asyra/utils'
import { ElementInteractionHandler } from './element-interaction-handler'

export class RenderLayer {
  private currentWorkspace: Container
  private _elements: Map<string, SceneElement> = new Map()
  private _deleteMap: Map<string, SceneElement> = new Map()
  private interactionHandler = new ElementInteractionHandler()

  constructor() {
    this.currentWorkspace = new Container()
  }

  get view() {
    return this.currentWorkspace
  }

  addToMap(elementId: string, instance: SceneElement) {
    this._elements.set(elementId, instance)
    this.removeFromDeleteMap(elementId)
    this.interactionHandler.bindElementEvents(instance)
  }

  removeFromMap(elementId: string) {
    const instance = this.getElementById(elementId) as SceneElement
    this.interactionHandler.unbindElementEvents(instance)
    this._elements.delete(elementId)
    this.addToDeleteMap(elementId, instance)
  }

  addToDeleteMap(elementId: string, instance: SceneElement) {
    this._deleteMap.set(elementId, instance)
  }

  removeFromDeleteMap(elementId: string) {
    this._deleteMap.delete(elementId)
  }

  getAllElements() {
    return this._elements
  }

  getElementById(elementId: string): SceneElement | undefined {
    return this._elements.get(elementId)
  }

  getRestoreElement(elementId: string): SceneElement | undefined {
    return this._deleteMap.get(elementId)
  }

  switchWorkspace(workspaceData: RenderContainerData) {
    this.currentWorkspace.label = workspaceData.label
    this.currentWorkspace.x = workspaceData.x
    this.currentWorkspace.y = workspaceData.y
  }

  addContainer(containerData: RenderContainerData) {
    const container = new Container(containerData)
    this._elements.set(containerData.label, container)
    this.currentWorkspace.addChild(container)

    return container
  }

  addElement(data: RenderElementData) {
    const element = this.getRestoreElement(data.id)
    if (element) {
      this.addToMap(data.id, element)
      this.currentWorkspace.addChild(element)
      return element
    }

    const graphic = new Graphics()
    graphic.label = data.id

    switch (data.type) {
      case EntityTypes.RECTANGLE:
        graphic.rect(0, 0, data.width, data.height).fill(randomHexColorCode())
        graphic.x = data.x
        graphic.y = data.y
        break
    }

    this.addToMap(data.id, graphic)
    this.currentWorkspace.addChild(graphic)

    return graphic
  }

  removeElement(elementId: string, parentId?: string) {
    const parent =
      (this.getElementById(parentId as string) as Container) ||
      this.currentWorkspace
    const element = this.getElementById(elementId)

    if (parent && element) {
      this.removeFromMap(elementId)
      parent.removeChild(element)
    }

    return element
  }

  updateElement(
    elementId: string,
    key: string,
    before: DataTypes,
    after: DataTypes
  ) {
    const element = this.getElementById(elementId)
    if (!element) {
      return
    }

    switch (key) {
      case 'children': {
        const oldList = new Set(before as string[])
        let deleteCount = 0
        // Add element
        ;(after as string[]).forEach((childId, index) => {
          const child = this.getElementById(childId)
          if (!child) {
            return
          }

          if (oldList.has(childId)) {
            oldList.delete(childId)
            deleteCount++
          } else {
            element.addChildAt(child, index - deleteCount)
          }
        })

        // Remove element
        oldList.forEach((childId) => {
          const child = this.getElementById(childId)
          if (!child) {
            return
          }

          element.removeChild(child)
        })

        // Move element
        element.children.forEach((child, index) => {
          const newIndex = (after as string[]).indexOf(child.label)
          if (newIndex !== index) {
            element.setChildIndex(child, newIndex)
          }
        })
        break
      }
      default:
        this.updateElementProperties(element, key, after)
    }
  }

  updateElementProperties(
    element: Container | Graphics,
    key: string,
    after: DataTypes
  ) {
    switch (key) {
      case 'x':
        element.x = after as number
        break
      case 'y':
        element.y = after as number
        break
      case 'width':
        element.width = after as number
        break
      case 'height':
        element.height = after as number
        break
    }
  }

  /**
   * Calculates the combined bounding box of all visible elements in the workspace,
   * expressed in the local coordinate space of the workspace (i.e., ignoring zoom and pan).
   *
   * This method ensures consistent bounding box results regardless of the current
   * zoom or pan applied to the workspace.
   *
   * @param workspace - The container holding all elements (typically zoomed/panned).
   * @returns A bounding box object containing { minX, minY, maxX, maxY } in local space.
   */
  getAllElementsBounds(workspace: Container) {
    const bounds = {
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity
    }

    const topLeft = new Point()
    const topRight = new Point()
    const bottomLeft = new Point()
    const bottomRight = new Point()

    for (const [, element] of this._elements) {
      if (element instanceof Graphics && element.visible) {
        // Get the element's local bounds (before transform)
        const localBounds = element.getLocalBounds()

        // Update corner points only when necessary
        topLeft.set(localBounds.x, localBounds.y)
        topRight.set(localBounds.x + localBounds.width, localBounds.y)
        bottomLeft.set(localBounds.x, localBounds.y + localBounds.height)
        bottomRight.set(
          localBounds.x + localBounds.width,
          localBounds.y + localBounds.height
        )

        // Convert each corner to workspace local space and update bounding box
        const corners = [topLeft, topRight, bottomLeft, bottomRight]
        for (const corner of corners) {
          const localCorner = workspace.toLocal(element.toGlobal(corner))
          bounds.minX = Math.min(bounds.minX, localCorner.x)
          bounds.minY = Math.min(bounds.minY, localCorner.y)
          bounds.maxX = Math.max(bounds.maxX, localCorner.x)
          bounds.maxY = Math.max(bounds.maxY, localCorner.y)
        }
      }
    }

    return bounds
  }
}

// REMOVE: test data
const randomHexColorCode = () => {
  const n = (Math.random() * 0xfffff * 1000000).toString(16)
  return '#' + n.slice(0, 6)
}
