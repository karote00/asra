import { initRender, zoomFit } from '@asra/reactive-events'
import type { Render } from '@asra/render'
import type InputSystem from '@asra/input-system'
import { MouseEventData, roundFloat, WheelEventData } from '@asra/utils'
import { Events } from './combinations'
import { coreAddElement } from '@asra/reactive-events/dist/core'

const ZOOM_SMOOTH_RATIO = 0.02

class RenderManager {
  private inputSystem: InputSystem
  private render: Render
  private _isDrag: boolean
  private _startPos: MouseEventData
  private _endPos: MouseEventData

  constructor(inputSystem: InputSystem, render: Render) {
    this.inputSystem = inputSystem
    this.render = render
    this._isDrag = false
    this._startPos = {
      clientX: 0,
      clientY: 0
    }
    this._endPos = {
      clientX: 0,
      clientY: 0
    }

    this._init()
  }

  _init() {
    this.inputSystem.on(Events.ZOOM_FIT, this._handleZoomFit)
    this.inputSystem.on(Events.PAN, this._handlePan)
    this.inputSystem.on(Events.ZOOM, this._handleZoom)
    this.inputSystem.on(Events.DRAG_START, this._handleDragStart)
    this.inputSystem.on(Events.DRAG_UPDATE, this._handleDragUpdate)
    this.inputSystem.on(Events.DRAG_END, this._handleDragEnd)
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

  _handleDragStart = (data: MouseEventData) => {
    this._startPos = { ...data }
  }

  _handleDragUpdate = (data: MouseEventData) => {
    this._isDrag = true
    this._endPos = { ...data }
  }

  _handleDragEnd = (data: MouseEventData) => {
    if (!this._isDrag) {
      const startPos = this.render.getMousePosInWorkspace(this._startPos)
      const pos = {
        x: roundFloat(startPos.x, 2),
        y: roundFloat(startPos.y, 2)
      }

      coreAddElement(pos)
    }

    this._isDrag = false
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

export default RenderManager
