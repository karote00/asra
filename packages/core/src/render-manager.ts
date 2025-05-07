import type { Render } from '@asra/render'
import type InputSystem from '@asra/input-system'
import { MouseEventData, roundFloat } from '@asra/utils'
import { Events } from './combinations'
import { coreAddElement } from '@asra/reactive-events/dist/core'

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
    this.inputSystem.on(Events.DRAG_START, this._handleDragStart)
    this.inputSystem.on(Events.DRAG_UPDATE, this._handleDragUpdate)
    this.inputSystem.on(Events.DRAG_END, this._handleDragEnd)
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
}

export default RenderManager
