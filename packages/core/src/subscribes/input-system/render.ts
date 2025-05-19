import {
  ModifierKeys,
  MouseData,
  MouseEventData,
  roundFloat
} from '@asra/utils'
import { Events } from '../../combinations'
import { HandlerDeps, RenderRawAPIs, SceneTreeHandlerAPIs } from '../../types'
import { updateMouseStata } from '@asra/reactive-events'

export class RenderHandler {
  private _isDrag: boolean
  private _startPos: MouseData
  private _endPos: MouseData

  constructor(
    private inputSystem: HandlerDeps['inputSystem'],
    private render: HandlerDeps['render'],
    private deps: RenderRawAPIs & SceneTreeHandlerAPIs
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

    this.init()
  }

  init() {
    this.inputSystem.on(Events.DRAG_START, this._handleDragStart)
    this.inputSystem.on(Events.DRAG_UPDATE, this._handleDragUpdate)
    this.inputSystem.on(Events.DRAG_END, this._handleDragEnd)
  }

  _handleDragStart = (modifiers: ModifierKeys, data: MouseEventData) => {
    this._startPos = { clientX: data.clientX, clientY: data.clientY }

    updateMouseStata({
      position: {
        x: data.clientX,
        y: data.clientY
      },
      down: true,
      button: data.button,
      dragging: false,
      modifiers
    })
  }

  _handleDragUpdate = (modifiers: ModifierKeys, data: MouseEventData) => {
    this._isDrag = true
    this._endPos = { ...data }
  }

  _handleDragEnd = (modifiers: ModifierKeys, data: MouseEventData) => {
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
