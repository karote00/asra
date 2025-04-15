import { Application, Container, Graphics } from 'pixi.js'
import { initDataContexts } from './subscribes'
import { DataTypes, EntityTypes, GroupRawData } from '@asra/utils'
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

    this.currentWorkspace.addChild(graphic)
    this.addToMap(data.id, graphic)

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
    // const parent = (this.getElementById(parentId) as Container) || this._root

    // if (parent && graphic) {
    //   const idx = index > -1 ? index : parent.children.length
    //   parent.addChildAt(graphic, idx)
    // }
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

  getAllElementsRect() {
    const rect = { x: Infinity, y: Infinity, width: 0, height: 0 }
    for (const [, element] of this._elements) {
      if (element instanceof Graphics) {
        const elementBounds = element.getLocalBounds()

        rect.x = Math.min(rect.x, elementBounds.x)
        rect.y = Math.min(rect.y, elementBounds.y)
        rect.width = Math.max(
          rect.width,
          elementBounds.x + elementBounds.width - rect.x
        )
        rect.height = Math.max(
          rect.height,
          elementBounds.y + elementBounds.height - rect.y
        )
      }
    }

    return rect
  }

  zoomFit(uiBounds: DOMRect) {
    const elementsRect = this.getAllElementsRect()
    this.viewport.fitBounds(rectToBounds(elementsRect), rectToBounds(uiBounds))
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
