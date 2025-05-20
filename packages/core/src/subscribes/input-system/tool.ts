import { PrimaryToolType } from '@asra/utils'
import { HandlerDeps } from '../../types'
import { PrimaryToolActionAPIs } from '../../types/system-context/primary-tool'
import { Events } from '../../combinations'

export class SiwtchPrimaryToolHandler {
  constructor(
    private inputSystem: HandlerDeps['inputSystem'],
    private deps: PrimaryToolActionAPIs
  ) {
    this.init()
  }

  init() {
    this.inputSystem.on(
      Events.SWITCH_TO_SELECT_TOOL,
      this._handleSwitchToSelectTool
    )
    this.inputSystem.on(
      Events.SWITCH_TO_RECTANGLE_TOOL,
      this._handleSwitchToRectangleTool
    )
  }

  _handleSwitchToSelectTool = () => {
    this.deps.switchPrimaryTool(PrimaryToolType.SELECT)
  }

  _handleSwitchToRectangleTool = () => {
    this.deps.switchPrimaryTool(PrimaryToolType.RECTANGLE)
  }
}
