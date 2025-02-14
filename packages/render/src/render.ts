import { Application, Container, Graphics } from 'pixi.js'
import { initDataContexts } from './subscribes'
import { ElementRawData } from '@asra/utils'

type PixiInstance = Container | Graphics

initDataContexts()

class Render {
  _app: Application | null = null
  _elements: Map<string, PixiInstance> = new Map()

  get app() {
    return this._app
  }

  getElementById(elementId: string): PixiInstance | undefined {
    return this._elements.get(elementId)
  }

  async init(
    width: number,
    height: number,
    backgroundColor: number,
    cb: (app: Application) => void
  ) {
    const app = new Application()

    await app
      .init({
        width,
        height,
        backgroundColor,
        resolution: window.devicePixelRatio || 1,
        antialias: true,
        autoDensity: true
      })
      .then(() => {
        cb(app)
      })

    this._app = app

    return this._app
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addContainer(containerData: any) {
    const container = new Container(containerData)
    this._elements.set(containerData.id, container)
    this.app?.stage.addChild(container)
  }

  addRectangle(parentId: string, data: ElementRawData, index = -1) {
    const rectangle = new Graphics()
    rectangle
      .rect(
        getRandomInt(200) + 300,
        getRandomInt(200) + 300,
        getRandomInt(100) + 100,
        getRandomInt(100) + 100
      )
      .fill(randomHexColorCode())

    const parent = this.getElementById(parentId) as Container

    if (parent) {
      parent.addChild(rectangle)
    }
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
