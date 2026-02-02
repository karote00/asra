import { DefaultPrimaryTool } from '@asyra/utils'

export class PrimaryToolState {
  private _state: string = DefaultPrimaryTool

  set(tool: string) {
    this._state = tool
  }

  get current() {
    return this._state
  }
}

export default new PrimaryToolState()
