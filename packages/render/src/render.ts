import * as PIXI from 'pixi.js'
import sceneTree from '@asra/scene-tree'
import { initDataContexts } from './subscribes'

initDataContexts()

class Render {
  app: PIXI.Application | null = null

  async init(
    width: number,
    height: number,
    backgroundColor: number,
    cb: (app: PIXI.Application) => void
  ) {
    const app = new PIXI.Application()

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

    this.app = app

    return this.app
  }
}

export default Render

export const render = new Render()
