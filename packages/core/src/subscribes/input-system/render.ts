import {
  ModifierKeys,
  MouseData,
  PointerEventData,
  RawInputEvent,
  InputSystemEvents
} from '@asra/utils'
import {
  HandlerDeps,
  MouseStateAPIs,
  KeyStateAPIs,
  InteractionCoreSessionAPIs
} from '../../types'

export class RenderHandler {
  private _isDown: boolean
  private _isDrag: boolean
  private _startPos: MouseData
  private _endPos: MouseData

  constructor(
    private inputSystem: HandlerDeps['inputSystem'],
    private deps: MouseStateAPIs & InteractionCoreSessionAPIs & KeyStateAPIs
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
    this.inputSystem.on(
      InputSystemEvents.INPUT_DRAG_START,
      this._handleDragStart
    )
    this.inputSystem.on(
      InputSystemEvents.INPUT_DRAG_UPDATE,
      this._handleDragUpdate
    )
    this.inputSystem.on(InputSystemEvents.INPUT_DRAG_END, this._handleDragEnd)
  }

  _handleDragStart = (raw: RawInputEvent) => {
    const { clientX, clientY, button } = raw.pointer as PointerEventData
    this._isDown = true
    this._isDrag = false
    this._startPos = { clientX, clientY }

    this.deps.updateMouseState({
      dragStart: {
        x: clientX,
        y: clientY
      },
      position: {
        x: clientX,
        y: clientY
      },
      delta: {
        x: 0,
        y: 0
      },
      down: this._isDown,
      button: button,
      dragging: this._isDrag
    })
    this.deps.updateKeyState({
      ...(raw.modifiers as ModifierKeys)
    })

    this.deps.startSession(InputSystemEvents.INPUT_DRAG_START)
  }

  _handleDragUpdate = (raw: RawInputEvent) => {
    const { clientX, clientY, button } = raw.pointer as PointerEventData
    this._isDrag = true
    this._endPos = {
      clientX,
      clientY
    }

    this.deps.updateMouseState({
      position: {
        x: clientX,
        y: clientY
      },
      delta: {
        x: clientX - this._startPos.clientX,
        y: clientY - this._startPos.clientY
      },
      down: true,
      button: button,
      dragging: this._isDrag
    })
    this.deps.updateKeyState({
      ...(raw.modifiers as ModifierKeys)
    })

    this.deps.updateSession(InputSystemEvents.INPUT_DRAG_UPDATE)
  }

  _handleDragEnd = async (raw: RawInputEvent) => {
    const { clientX, clientY, button } = raw.pointer as PointerEventData

    this.deps.updateMouseState({
      position: {
        x: clientX,
        y: clientY
      },
      delta: {
        x: clientX - this._startPos.clientX,
        y: clientY - this._startPos.clientY
      },
      button: button,
      down: this._isDown,
      dragging: this._isDrag
    })
    this.deps.updateKeyState({
      ...(raw.modifiers as ModifierKeys)
    })

    this.deps.endSession(InputSystemEvents.INPUT_DRAG_END)

    this._isDown = false
  }
}
