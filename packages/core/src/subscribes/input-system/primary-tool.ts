import { RawInputEvent } from '@asyra/utils'
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
      'input.shortcut.switchPrimaryTool',
      this._handleSwitchPrimaryTool
    )
  }

  _handleSwitchPrimaryTool = (raw: RawInputEvent) => {
    this.deps.executeAction('input.shortcut.switchPrimaryTool', raw.detail)
  }
}
