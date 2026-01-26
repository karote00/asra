import { InputSystemEvents, ModifierKeys, RawInputEvent } from '@asyra/utils'
import {
  HandlerDeps,
  InteractionCoreActionAPIs,
  KeyStateAPIs
} from '../../types'

export class UndoHandler {
  constructor(
    private inputSystem: HandlerDeps['inputSystem'],
    private deps: InteractionCoreActionAPIs & KeyStateAPIs
  ) {
    this.init()
  }

  init() {
    this.inputSystem.on(
      InputSystemEvents.INPUT_SHORTCUT_UNDOREDO,
      this._handleUndoRedo
    )
  }

  _handleUndoRedo = (raw: RawInputEvent) => {
    this.deps.updateKeyState({
      ...(raw.modifiers as ModifierKeys)
    })
    this.deps.executeAction(InputSystemEvents.INPUT_SHORTCUT_UNDOREDO)
  }
}
