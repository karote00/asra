import InputSystem from '@asra/input-system'
import type { Render } from '@asra/render'
import { Events } from './combinations'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InitCallback = (app: any) => void

class RenderEventManager {
  private inputSystem: InputSystem
  render: Render

  constructor(inputSystem: InputSystem, render: Render) {
    this.inputSystem = inputSystem
    this.render = render

    this._init()
  }

  _init() {
    this.inputSystem.on(Events.ZOOM_FIT, this._handleZoomFit)
  }

  _handleZoomFit = () => {
    this.zoomFit()
  }

  async initRender(
    width: number,
    height: number,
    color: number,
    cb: InitCallback
  ) {
    await this.render.init(width, height, color, cb)
  }

  zoomFit() {
    const centerDiv = document.querySelector('#viewport-anchor')
    const uiBounds = centerDiv?.getBoundingClientRect()
    if (uiBounds) {
      this.render.zoomFit(uiBounds)
    }
  }
}

export default RenderEventManager
