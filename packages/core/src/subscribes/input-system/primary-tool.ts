import { InputSystemEvents, RawInputEvent } from '@asyra/utils'
import { HandlerDeps, InteractionCoreActionAPIs } from '../../types'

export class PrimaryToolHandler {
  constructor(
    private inputSystem: HandlerDeps['inputSystem'],
    private deps: InteractionCoreActionAPIs
  ) {
    this.init()
  }

  init() {
    this.inputSystem.on(
      InputSystemEvents.INPUT_SHORTCUT_SWITCH_PRIMARY_TOOL,
      this._handleSwitchPrimaryTool
    )
  }

  _handleSwitchPrimaryTool = (raw: RawInputEvent) => {
    this.deps.executeAction(
      InputSystemEvents.INPUT_SHORTCUT_SWITCH_PRIMARY_TOOL,
      raw.detail
    )
  }
}
