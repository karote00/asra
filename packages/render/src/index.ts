import * as PIXI from 'pixi.js'

class Render {
  constructor() {
    this._init()
  }

  _init() {
    // init
  }

  async init(width: number, height: number, backgroundColor: number) {
    const app = new PIXI.Application()

    await app.init({
      width,
      height,
      backgroundColor,
      resolution: window.devicePixelRatio || 1,
      antialias: true,
      autoDensity: true
    })

    return app
  }
}

export default Render
