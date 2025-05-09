import { MouseEventData, roundFloat } from '@asra/utils'
import { Events } from '../../combinations'
import { HandlerDeps, RenderAPIs, SceneTreeAPIs } from '../../types/core-apis'

export class RenderHandler {
  private _isDrag: boolean
  private _startPos: MouseEventData
  private _endPos: MouseEventData

  constructor(
    private inputSystem: HandlerDeps['inputSystem'],
    private render: HandlerDeps['render'],
    private deps: RenderAPIs & SceneTreeAPIs
  ) {
    this._isDrag = false
    this._startPos = {
      clientX: 0,
      clientY: 0
    }
    this._endPos = {
      clientX: 0,
      clientY: 0
    }

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

      this.deps.addRectangle(pos)
    }

    this._isDrag = false
  }
}
