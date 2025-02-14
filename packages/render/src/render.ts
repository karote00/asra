import * as PIXI from 'pixi.js'
import sceneTree from '@asra/scene-tree'
import { initDataContexts } from './subscribes'

initDataContexts()

class Render {
  app: PIXI.Application | null = null

  constructor() {}

  async init(width: number, height: number, backgroundColor: number) {
    this.app = new PIXI.Application()

    await this.app.init({
      width,
      height,
      backgroundColor,
      resolution: window.devicePixelRatio || 1,
      antialias: true,
      autoDensity: true
    })

    return this.app
  }
}

export default Render

export const render = new Render()
