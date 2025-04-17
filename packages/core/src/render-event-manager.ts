import { initRender, zoomFit } from '@asra/reactive-events'
import type { Render } from '@asra/render'
import InputSystem from '@asra/input-system'
import { WheelEventData } from '@asra/utils'
import { Events } from './combinations'

const ZOOM_SMOOTH_RATIO = 0.02

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
    this.inputSystem.on(Events.PAN, this._handlePan)
    this.inputSystem.on(Events.ZOOM, this._handleZoom)
  }

  _handleZoomFit = () => {
    this.zoomFit()
  }

  _handlePan = (data: WheelEventData) => {
    const { deltaX, deltaY } = data
    const currentPosition = this.render.getPosition()
    this.render.panTo(currentPosition.x - deltaX, currentPosition.y - deltaY)
  }

  _handleZoom = (data: WheelEventData) => {
    const { deltaY, clientX, clientY } = data
    const currentScale = this.render.getScale()
    // Adjust zoom scale based on wheel direction. deltaY > 0 means scrolling up (zoom in)
    // Using a smaller scale factor (1.05) for smoother zooming
    const newScale =
      currentScale *
      (deltaY > 0 ? 1 + ZOOM_SMOOTH_RATIO : 1 - ZOOM_SMOOTH_RATIO)
    this.render.zoomToCenter(newScale, clientX, clientY)
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
