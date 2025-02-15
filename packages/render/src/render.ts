import { Application, Container, Graphics } from 'pixi.js'
import { initDataContexts } from './subscribes'
import { ElementRawData, EntityTypes } from '@asra/utils'

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

  addElement(parentId: string, data: ElementRawData, index = -1) {
    const graphic = new Graphics()

    switch (data.type) {
      case EntityTypes.RECTANGLE:
        graphic
          .rect(
            getRandomInt(200) + 300,
            getRandomInt(200) + 300,
            getRandomInt(100) + 100,
            getRandomInt(100) + 100
          )
          .fill(randomHexColorCode())
        break
    }

    const parent = (this.getElementById(parentId) as Container) || this._root

    if (parent && graphic) {
      this.addToMap(data.id, graphic)
      const idx = index > -1 ? index : parent.children.length
      parent.addChildAt(graphic, idx)
    }

    return graphic
  }

  removeElement(parentId: string, elementId: string) {
    const parent = (this.getElementById(parentId) as Container) || this._root
    const element = this.getElementById(elementId)

    if (parent && element) {
      this.removeFromMap(elementId)
      parent.removeChild(element)
    }

    return element
  }
}

// REMOVE: test data
const randomHexColorCode = () => {
  const n = (Math.random() * 0xfffff * 1000000).toString(16)
  return '#' + n.slice(0, 6)
}

// REMOVE: test data
const getRandomInt = (max: number) => {
  return Math.floor(Math.random() * max)
}

export default Render

export const render = new Render()
