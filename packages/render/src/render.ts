import { Application, Container, Graphics, Point } from 'pixi.js'
import { initDataContexts } from './subscribes'
import {
  DataTypes,
  EntityTypes,
  GroupRawData,
  MouseEventData
} from '@asra/utils'
import { RenderElementData, RenderContainerData } from './types'
import { Viewport, rectToBounds } from './viewport'

initDataContexts()

type PixiInstance = Container | Graphics

class Render {
  private currentWorkspace: Container
  private _elements: Map<string, PixiInstance> = new Map()
  private _deleteMap: Map<string, PixiInstance> = new Map()
  app: Application | null = null
  viewport: Viewport

  constructor() {
    this.currentWorkspace = new Container()
    this.viewport = new Viewport(this.currentWorkspace)
  }

  async init(width: number, height: number, backgroundColor: number) {
    const app = new Application()

    await app.init({
      width,
      height,
      backgroundColor,
      resolution: Math.min(window.devicePixelRatio, 2),
      resizeTo: window,
      antialias: true,
      autoDensity: true
    })

    this.app = app
    this.app.stage.eventMode = 'static'

    return this.app
  }

  addToMap(elementId: string, instance: PixiInstance) {
    this._elements.set(elementId, instance)
    this.removeFromDeleteMap(elementId)
  }

  removeFromMap(elementId: string) {
    const instance = this.getElementById(elementId) as PixiInstance
    this._elements.delete(elementId)
    this.addToDeleteMap(elementId, instance)
  }

  addToDeleteMap(elementId: string, instance: PixiInstance) {
    this._deleteMap.set(elementId, instance)
  }

  removeFromDeleteMap(elementId: string) {
    this._deleteMap.delete(elementId)
  }

  getElementById(elementId: string): PixiInstance | undefined {
    return this._elements.get(elementId)
  }

  getRestoreElement(elementId: string): PixiInstance | undefined {
    return this._deleteMap.get(elementId)
  }

  groupMapChildren(data: GroupRawData) {
    const group = this.getElementById(data.id)
    if (!group) {
      return
    }

    data.children.forEach((childId) => {
      const child = this.getElementById(childId)
      if (!child) {
        return
      }

      group.addChild(child)
    })
  }

  addRoot(root: Container) {
    this.currentWorkspace = root
  }

  switchWorkspace(workspaceData: RenderContainerData) {
    if (this.currentWorkspace) {
      this.app?.stage.removeChild(this.currentWorkspace)
    }

    const workspace = new Container(workspaceData)
    this.app?.stage.addChild(workspace)
    this.currentWorkspace = workspace
    this.viewport.switchContainer(workspace)
  }

  addContainer(containerData: RenderContainerData) {
    const container = new Container(containerData)
    this._elements.set(containerData.id, container)
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

  zoomFit(uiBounds: DOMRect) {
    const elementsBounds = this.getAllElementsBounds(this.currentWorkspace)
    this.viewport.fitBounds(elementsBounds, rectToBounds(uiBounds))
  }

  /**
   * Move the canvas to the specified position
   * @param x - The x-coordinate to move the canvas to
   * @param y - The y-coordinate to move the canvas to
   * @returns void
   */
  panTo(x: number, y: number) {
    this.viewport.panTo(x, y)
  }

  /**
   * Set the canvas zoom level
   * @param scale - The zoom scale factor. A value of 1.0 represents 100% zoom.
   *               Values greater than 1.0 zoom in, values less than 1.0 zoom out.
   * @returns void
   */
  zoomTo(scale: number) {
    this.viewport.zoomTo(scale)
  }

  /**
   * Set the canvas zoom level centered on a specific point
   * @param scale - The zoom scale factor
   * @param centerX - The x-coordinate of the zoom center
   * @param centerY - The y-coordinate of the zoom center
   * @returns void
   */
  zoomToCenter(scale: number, centerX: number, centerY: number) {
    const currentScale = this.getScale()
    const currentPosition = this.getPosition()

    // Calculate the position of the mouse in world coordinates
    const worldX = (centerX - currentPosition.x) / currentScale
    const worldY = (centerY - currentPosition.y) / currentScale

    // Calculate the new position after zoom
    const newX = centerX - worldX * scale
    const newY = centerY - worldY * scale

    // Apply the new scale and position
    this.zoomTo(scale)
    this.panTo(newX, newY)
  }

  getPosition() {
    return this.viewport.getPosition()
  }

  getScale() {
    return this.viewport.getScale()
  }

  getMousePosInWorkspace(mousePos: MouseEventData) {
    return this.viewport.getMousePosInWorkspace(mousePos)
  }
}

const render = new Render()

export default render
export { Render }

// REMOVE: test data
const randomHexColorCode = () => {
  const n = (Math.random() * 0xfffff * 1000000).toString(16)
  return '#' + n.slice(0, 6)
}
