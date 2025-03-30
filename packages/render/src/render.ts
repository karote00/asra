import { Application, Container, Graphics } from 'pixi.js'
import { initDataContexts } from './subscribes'
import {
  DataTypes,
  ElementRawData,
  EntityTypes,
  GroupRawData
} from '@asra/utils'
import { RenderElementData } from './types'

initDataContexts()

type PixiInstance = Container | Graphics

class Render {
  app: Application | null = null
  private _root: Container
  private _elements: Map<string, PixiInstance> = new Map()
  private _deleteMap: Map<string, PixiInstance> = new Map()

  constructor() {
    this._root = new Container()
  }

  async init(
    width: number,
    height: number,
    backgroundColor: number,
    initCallback: (app: Application) => void
  ) {
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

    initCallback(app)

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
    this._root = root
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addContainer(containerData: any) {
    const container = new Container(containerData)
    this._elements.set(containerData.id, container)
    this.app?.stage.addChild(container)

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
        graphic
          .rect(data.x + 300, data.y + 300, data.width, data.height)
          .fill(randomHexColorCode())
        break
    }

    this.addToMap(data.id, graphic)

    return graphic
  }

  removeElement(elementId: string, parentId?: string) {
    const parent =
      (this.getElementById(parentId as string) as Container) || this._root
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
    }
    // const parent = (this.getElementById(parentId) as Container) || this._root

    // if (parent && graphic) {
    //   const idx = index > -1 ? index : parent.children.length
    //   parent.addChildAt(graphic, idx)
    // }
  }
}

export default Render

export const render = new Render()

// REMOVE: test data
const randomHexColorCode = () => {
  const n = (Math.random() * 0xfffff * 1000000).toString(16)
  return '#' + n.slice(0, 6)
}
