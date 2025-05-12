import { ToolType } from '@asra/utils'

export class ToolState {
  private _state: ToolType = ToolType.SELECT

  set(tool: ToolType) {
    this._state = tool
  }

  get current() {
    return this._state
  }
}

export default new ToolState()
