import { DefaultPrimaryTool, PrimaryToolType } from '@asra/utils'

export class PrimaryToolState {
  private _state: PrimaryToolType = DefaultPrimaryTool

  set(tool: PrimaryToolType) {
    this._state = tool
  }

  get current() {
    return this._state
  }
}

export default new PrimaryToolState()
