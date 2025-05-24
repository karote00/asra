import { InputSystemEvents, RawInputEvent } from '@asra/utils'
import {
  HandlerDeps,
  PrimaryToolActionAPIs,
  InteractionCoreActionAPIs
} from '../../types'

export class SiwtchPrimaryToolHandler {
  constructor(
    private inputSystem: HandlerDeps['inputSystem'],
    private deps: PrimaryToolActionAPIs & InteractionCoreActionAPIs
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
    this.deps.decideAction(
      InputSystemEvents.INPUT_SHORTCUT_SWITCH_PRIMARY_TOOL,
      raw.detail
    )
  }
}
