import { ModifierKeys, MouseData, MouseEventData } from '@asra/utils'
import { Events } from '../../combinations'
import {
  HandlerDeps,
  InteractionCoreActionAPIs,
  MouseStateAPIs,
  RenderRawAPIs,
  SceneTreeHandlerAPIs,
  KeyStateAPIs
} from '../../types'

export class RenderHandler {
  private _isDown: boolean
  private _isDrag: boolean
  private _startPos: MouseData
  private _endPos: MouseData

  constructor(
    private inputSystem: HandlerDeps['inputSystem'],
    private render: HandlerDeps['render'],
    private deps: RenderRawAPIs &
      SceneTreeHandlerAPIs &
      MouseStateAPIs &
      InteractionCoreActionAPIs &
      KeyStateAPIs
  ) {
    this._isDown = false
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
    console.log('fuck')
    this._isDown = true
    this._isDrag = false
    this._startPos = { clientX: data.clientX, clientY: data.clientY }

    this.deps.updateMouseState({
      position: {
        x: data.clientX,
        y: data.clientY
      },
      delta: {
        x: 0,
        y: 0
      },
      down: this._isDown,
      button: data.button,
      dragging: this._isDrag
    })
    this.deps.updateKeyState({
      ...modifiers,
      pressedKeys: []
    })

    this.deps.decideAction()
  }

  _handleDragUpdate = (modifiers: ModifierKeys, data: MouseEventData) => {
    this._isDrag = true
    this._endPos = { ...data }

    this.deps.updateMouseState({
      position: {
        x: data.clientX,
        y: data.clientY
      },
      delta: {
        x: data.clientX - this._startPos.clientX,
        y: data.clientY - this._startPos.clientY
      },
      down: true,
      button: data.button,
      dragging: this._isDrag
    })
    this.deps.updateKeyState({
      ...modifiers,
      pressedKeys: []
    })

    this.deps.decideAction()
  }

  _handleDragEnd = (modifiers: ModifierKeys, data: MouseEventData) => {
    this.deps.updateMouseState({
      position: {
        x: data.clientX,
        y: data.clientY
      },
      delta: {
        x: data.clientX - this._startPos.clientX,
        y: data.clientY - this._startPos.clientY
      },
      down: false,
      button: data.button,
      dragging: false
    })
    this.deps.updateKeyState({
      ...modifiers,
      pressedKeys: []
    })

    // if (!this._isDrag) {
    //   const startPos = this.render.getMousePosInWorkspace(this._startPos)
    //   const pos = {
    //     x: roundFloat(startPos.x, 2),
    //     y: roundFloat(startPos.y, 2)
    //   }

    //   this.deps.addRectangle(pos)
    // }
    this.deps.decideAction()

    this._isDown = false
  }
}
