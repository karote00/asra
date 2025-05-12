import { HandlerDeps } from '../types'
import { ToolActionAPIs } from '../types/system-context'
import { Events } from '../combinations'
import { ToolType } from '@asra/utils'

export class SiwtchModeHandler {
  constructor(
    private inputSystem: HandlerDeps['inputSystem'],
    private deps: ToolActionAPIs
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
    this.deps.switchTool(ToolType.SELECT)
  }

  _handleSwitchToRectangleTool = () => {
    this.deps.switchTool(ToolType.RECTANGLE)
  }
}
