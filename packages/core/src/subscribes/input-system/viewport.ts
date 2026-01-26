import {
  InputSystemEvents,
  ModifierKeys,
  PointerEventData,
  RawInputEvent
} from '@asyra/utils'
import {
  HandlerDeps,
  InteractionCoreActionAPIs,
  KeyStateAPIs,
  MouseStateAPIs
} from '../../types'

export class ViewportHandler {
  constructor(
    private inputSystem: HandlerDeps['inputSystem'],
    private deps: InteractionCoreActionAPIs & MouseStateAPIs & KeyStateAPIs
  ) {
    this.init()
  }

  init() {
    this.inputSystem.on(
      InputSystemEvents.INPUT_SHORTCUT_ZOOM_PRESET,
      this._handleZoomFit
    )
    this.inputSystem.on(
      InputSystemEvents.INPUT_WHEEL_SCROLL,
      this._handleWheelScroll
    )
  }

  _handleZoomFit = () => {
    this.deps.executeAction(InputSystemEvents.INPUT_SHORTCUT_ZOOM_PRESET)
  }

  _handleWheelScroll = (raw: RawInputEvent) => {
    const { clientX, clientY, deltaX, deltaY, button } =
      raw.pointer as PointerEventData
    this.deps.updateMouseState({
      position: {
        x: clientX,
        y: clientY
      },
      delta: {
        x: deltaX,
        y: deltaY
      },
      down: false,
      button: button,
      dragging: false
    })
    this.deps.updateKeyState({
      ...(raw.modifiers as ModifierKeys)
    })
    this.deps.executeAction(InputSystemEvents.INPUT_WHEEL_SCROLL)
  }
}
