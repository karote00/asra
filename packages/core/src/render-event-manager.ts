import { initRender, zoomFit } from '@asra/reactive-events'
import type { Render } from '@asra/render'
import InputSystem from '@asra/input-system'
import { Events } from './combinations'

class RenderEventManager {
  private inputSystem: InputSystem
  private render: Render

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

  async initRender(width: number, height: number, color: number) {
    return await initRender(width, height, color)
  }

  zoomFit() {
    const centerDiv = document.querySelector('#viewport-anchor')
    const uiBounds = centerDiv?.getBoundingClientRect()
    if (uiBounds) {
      zoomFit(uiBounds)
    }
  }
}

export default RenderEventManager
