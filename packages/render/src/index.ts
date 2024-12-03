import * as PIXI from 'pixi.js'

type RenderProps = {
  version: string
}

type RenderDataType = Partial<RenderProps> | undefined

class Render {
  constructor(data?: RenderDataType) {
    this._init(data)
  }

  _init(data: RenderDataType) {}

  async init(width: number, height: number, backgroundColor: number) {
    const app = new PIXI.Application()

    await app.init({
      width,
      height,
      backgroundColor,
      resolution: window.devicePixelRatio || 1,
      antialias: true,
      autoDensity: true
    } as any)

    return app
  }
}

interface Render extends RenderProps {}

export default Render
